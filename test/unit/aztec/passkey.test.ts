/**
 * Passkey unlock of the private wallet (lib/aztec/wallet/passkey.ts), against a simulated
 * authenticator whose PRF is HMAC-SHA256(credential secret, salt), as in CTAP2 hmac-secret.
 */
import { describe, it, expect } from 'vitest';
import { createHmac, randomBytes } from 'node:crypto';
import {
  enrolPasskey,
  fromB64url,
  mergeRecords,
  PasskeyRecordSchema,
  toB64url,
  unlockWithPasskey,
  unwrapRoot,
  type PasskeyRecord,
  type WebAuthnApi,
} from '@/lib/aztec/wallet/passkey';

const EVM = '0x' + '1'.repeat(40);
const ROOT = '0x' + 'ab'.repeat(65); // a 65-byte EIP-712 signature
const RP = 'ledgerchat.org';

type Mode = 'results-at-create' | 'enabled-only' | 'no-prf';
/** `exclude: false` stands for several authenticators behind one API (each holds one passkey). */
function authenticator(mode: Mode = 'results-at-create', exclude = true) {
  const creds = new Map<string, Buffer>(); // credentialId -> secret
  let pick: string | null = null;
  const prf = (id: string, salt: ArrayBuffer) => new Uint8Array(createHmac('sha256', creds.get(id)!).update(Buffer.from(salt)).digest()).buffer;
  const cred = (id: string, ext: any) => ({ rawId: fromB64url(id).buffer, getClientExtensionResults: () => ext }) as any;
  const api: WebAuthnApi = {
    async create(o) {
      const pk: any = o.publicKey!;
      if (exclude) for (const ex of pk.excludeCredentials ?? []) if (creds.has(toB64url(new Uint8Array(ex.id)))) throw Object.assign(new Error('exists'), { name: 'InvalidStateError' });
      const id = toB64url(randomBytes(32));
      creds.set(id, randomBytes(32));
      if (mode === 'no-prf') return cred(id, { prf: { enabled: false } });
      if (mode === 'enabled-only') return cred(id, { prf: { enabled: true } });
      return cred(id, { prf: { enabled: true, results: { first: prf(id, pk.extensions.prf.eval.first) } } });
    },
    async get(o) {
      const pk: any = o.publicKey!;
      expect(pk.userVerification).toBe('required');
      const allowed = (pk.allowCredentials ?? []).map((c: any) => toB64url(new Uint8Array(c.id)));
      const id = pick ?? allowed.find((a: string) => creds.has(a));
      if (!id || !creds.has(id)) throw Object.assign(new Error('none'), { name: 'NotAllowedError' });
      return cred(id, { prf: { results: { first: prf(id, pk.extensions.prf.evalByCredential[id].first) } } });
    },
  };
  return { api, creds, use: (id: string | null) => (pick = id) };
}

/** The promise rejects with a PasskeyError of this code. */
async function expectCode(p: Promise<unknown>, code: string) {
  let err: any = null;
  try {
    await p;
  } catch (e) {
    err = e;
  }
  expect(err?.code).toBe(code);
}

const enrol = (api: WebAuthnApi, existing: PasskeyRecord[] = [], network: 'testnet' | 'mainnet' = 'mainnet') =>
  enrolPasskey({ evm: EVM, network, rootHex: ROOT, label: 'Mac', existing, rpId: RP, api });

describe('passkey unlock', () => {
  it('enrols a passkey and gets the same account root back, with no secret in the record', async () => {
    const a = authenticator();
    const rec = await enrol(a.api);
    expect(PasskeyRecordSchema.parse(rec)).toEqual(rec);
    expect(JSON.stringify(rec)).not.toContain(ROOT.slice(2, 20));
    const { rootHex, record } = await unlockWithPasskey({ evm: EVM, network: 'mainnet', records: [rec], rpId: RP, api: a.api });
    expect(rootHex).toBe(ROOT);
    expect(record.credentialId).toBe(rec.credentialId);
  });

  it('works with authenticators that give PRF only on use (one more confirmation)', async () => {
    const a = authenticator('enabled-only');
    const rec = await enrol(a.api);
    expect((await unlockWithPasskey({ evm: EVM, network: 'mainnet', records: [rec], rpId: RP, api: a.api })).rootHex).toBe(ROOT);
  });

  it('refuses an authenticator without PRF', async () => {
    await expectCode(enrol(authenticator('no-prf').api), 'NO_PRF');
  });

  it('several passkeys open the same account; each opens only its own record', async () => {
    const a = authenticator('results-at-create', false);
    const r1 = await enrol(a.api);
    const r2 = await enrol(a.api, [r1]);
    for (const r of [r1, r2]) {
      a.use(r.credentialId);
      expect((await unlockWithPasskey({ evm: EVM, network: 'mainnet', records: [r1, r2], rpId: RP, api: a.api })).rootHex).toBe(ROOT);
    }
    a.use(r2.credentialId);
    // r2's PRF cannot open r1's ciphertext.
    const swapped = { ...r1, credentialId: r2.credentialId };
    await expectCode(unlockWithPasskey({ evm: EVM, network: 'mainnet', records: [swapped], rpId: RP, api: a.api }), 'CORRUPT');
  });

  it('a record moved to another account or network does not open', async () => {
    const a = authenticator();
    const rec = await enrol(a.api);
    const prfOut = new Uint8Array(32); // wrong key anyway
    await expectCode(unwrapRoot(prfOut, rec), 'CORRUPT');
    const moved = { ...rec, network: 'testnet' as const };
    await expectCode(unlockWithPasskey({ evm: EVM, network: 'testnet', records: [moved], rpId: RP, api: a.api }), 'CORRUPT');
    await expectCode(unlockWithPasskey({ evm: '0x' + '2'.repeat(40), network: 'mainnet', records: [rec], rpId: RP, api: a.api }), 'NO_RECORD');
  });

  it('a tampered ciphertext does not open', async () => {
    const a = authenticator();
    const rec = await enrol(a.api);
    const ct = fromB64url(rec.ct);
    ct[3] ^= 1;
    await expectCode(unlockWithPasskey({ evm: EVM, network: 'mainnet', records: [{ ...rec, ct: toB64url(ct) }], rpId: RP, api: a.api }), 'CORRUPT');
  });

  it('the same authenticator is not enrolled twice; at most ten passkeys', async () => {
    const a = authenticator();
    const rec = await enrol(a.api);
    await expectCode(enrol(a.api, [rec]), 'LIMIT'); // excludeCredentials: this authenticator already has one
    await expectCode(enrolPasskey({ evm: EVM, network: 'mainnet', rootHex: ROOT, label: 'x', existing: Array(10).fill(rec), rpId: RP, api: a.api }), 'LIMIT');
  });

  it('a closed prompt is CANCELLED, not an error', async () => {
    const a = authenticator();
    const rec = await enrol(a.api);
    a.creds.clear();
    await expectCode(unlockWithPasskey({ evm: EVM, network: 'mainnet', records: [rec], rpId: RP, api: a.api }), 'CANCELLED');
  });

  it('merges device and backup records, one per credential, newest wins, invalid dropped', async () => {
    const a = authenticator();
    const r1 = await enrol(a.api);
    const newer = { ...r1, label: 'Renamed', createdAt: r1.createdAt + 1 };
    const merged = mergeRecords([r1], [newer, { junk: true } as any]);
    expect(merged).toHaveLength(1);
    expect(merged[0].label).toBe('Renamed');
  });
});

describe('passkey hardening', () => {
  it('a root is accepted only if it is the account\'s own signature over the network typed data', async () => {
    const { privateKeyToAccount } = await import('viem/accounts');
    const { assertRootOwner } = await import('@/lib/aztec/wallet/passkey');
    const { WALLET_TYPED_DATA_ALPHA, WALLET_TYPED_DATA } = await import('@/lib/aztec/wallet/keys');
    const me = privateKeyToAccount(('0x' + '11'.repeat(32)) as `0x${string}`);
    const other = privateKeyToAccount(('0x' + '22'.repeat(32)) as `0x${string}`);
    const mine = await me.signTypedData(WALLET_TYPED_DATA_ALPHA as any);
    const theirs = await other.signTypedData(WALLET_TYPED_DATA_ALPHA as any);
    const testnet = await me.signTypedData(WALLET_TYPED_DATA as any);
    await assertRootOwner(mine, me.address.toLowerCase(), WALLET_TYPED_DATA_ALPHA as any);
    const refused = async (root: string) => {
      try {
        await assertRootOwner(root, me.address.toLowerCase(), WALLET_TYPED_DATA_ALPHA as any);
        return null;
      } catch (e: any) {
        return e.code;
      }
    };
    expect(await refused(theirs)).toBe('MISMATCH');
    // The test-network signature of the same wallet does not open the Alpha account.
    expect(await refused(testnet)).toBe('MISMATCH');
    // A smart-account signature (not 65 bytes) cannot be checked offline and is let through.
    expect(await refused('0x' + 'ab'.repeat(100))).toBeNull();
  });

  it('the backup never replaces a record this device holds; it only adds missing credentials', async () => {
    const { mergeKeepingLocal } = await import('@/lib/aztec/wallet/passkey');
    const a = authenticator(undefined, false);
    const r1 = await enrol(a.api);
    const r2 = await enrol(a.api, [r1]);
    const planted = { ...r1, ct: r1.ct.slice(0, -4) + 'AAAA', createdAt: r1.createdAt + 1000 };
    const merged = mergeKeepingLocal([r1], [planted, r2]);
    expect(merged.map((r) => r.credentialId).sort()).toEqual([r1.credentialId, r2.credentialId].sort());
    expect(merged.find((r) => r.credentialId === r1.credentialId)!.ct).toBe(r1.ct);
  });

  it('passkeys are bound to ledgerchat.org on every subdomain, and to the host elsewhere', async () => {
    const { passkeyRpId } = await import('@/lib/aztec/wallet/passkey');
    expect(passkeyRpId('ledgerchat.org')).toBe('ledgerchat.org');
    expect(passkeyRpId('www.ledgerchat.org')).toBe('ledgerchat.org');
    expect(passkeyRpId('evil-ledgerchat.org')).toBe('evil-ledgerchat.org');
    expect(passkeyRpId('localhost')).toBe('localhost');
  });
});
