/**
 * lib/aztec/wallet/passkey.ts — open the private wallet with a passkey.
 *
 * KEY MODEL (docs/ACCOUNT_MODEL.md)
 *
 *   account root   the EIP-712 signature over WALLET_TYPED_DATA(_ALPHA) by the person's Ethereum
 *                  wallet (lib/aztec/wallet/keys.ts). Every Aztec key comes from it by HKDF:
 *                  account secret (nsk, ivsk, ovsk, tsk are derived from it by aztec.js), salt,
 *                  Schnorr signing key, store key, Fee Juice claim secrets.
 *   passkey        a WebAuthn credential with the PRF extension. Its PRF output, evaluated on a
 *                  random 32-byte salt kept with the record, never leaves this module: it is
 *                  stretched by HKDF into an AES-256-GCM key that wraps the account root.
 *   record         { credentialId, prfSalt, iv, ciphertext } — no secret in it. It is kept on this
 *                  device and, encrypted as it is, in the person's server backup (api/aztec/passkeys),
 *                  so a passkey synced to a new device (iCloud Keychain, Google Password Manager,
 *                  1Password) opens the same account there.
 *
 * Several passkeys can wrap the same root (one record each). Unlocking with any of them yields the
 * root, and the wallet then derives exactly the keys the Ethereum signature would have given: the
 * account, its address and its notes are the same. Nothing about the account changes on chain.
 *
 * What a passkey record is, stated plainly: a second way to obtain the account root. Whoever holds
 * the passkey (and passes its user verification) can open the wallet and spend, exactly like whoever
 * holds the Ethereum wallet. Removing a passkey removes its record here and in the backup; it does
 * not rotate the account (the root is the same). Rotation means moving funds to a new account.
 *
 * RECOVERY: the Ethereum wallet always recovers the account (the signature is deterministic). If the
 * Ethereum wallet is lost, any enrolled passkey with its record recovers it. If both are lost, the
 * account cannot be recovered by anyone, Ledger Chat included.
 *
 * NOT DONE (deferred, docs/ACCOUNT_MODEL.md §4): a passkey as the account's SIGNING key, verified by
 * the account contract (secp256r1 / WebAuthn assertion in Noir). It needs a new account contract,
 * its audit, and a migration of every account; until then the Schnorr signing key is derived in
 * the browser from the root, as before.
 *
 * Runs in the browser. The WebAuthn API is injected (WebAuthnApi) so the protocol is tested
 * without an authenticator.
 */
import { z } from 'zod';

export const PASSKEY_SCHEME = 'hl/passkey-unlock/v1';
/** Most records accepted per account and network (enrolled authenticators). */
export const MAX_PASSKEYS = 10;

const b64url = z.string().regex(/^[A-Za-z0-9_-]+$/).max(1400);

export const PasskeyRecordSchema = z
  .object({
    v: z.literal(1),
    scheme: z.literal(PASSKEY_SCHEME),
    evm: z.string().regex(/^0x[0-9a-f]{40}$/),
    network: z.enum(['testnet', 'mainnet']),
    credentialId: b64url.min(16),
    prfSalt: b64url.length(43), // 32 bytes
    iv: b64url.length(16), // 12 bytes
    ct: b64url.min(80).max(400), // 65-byte signature + 16-byte tag
    label: z.string().min(1).max(60),
    createdAt: z.number().int().positive(),
  })
  .strict();
export type PasskeyRecord = z.infer<typeof PasskeyRecordSchema>;

export class PasskeyError extends Error {
  constructor(
    public code: 'UNSUPPORTED' | 'NO_PRF' | 'CANCELLED' | 'NO_RECORD' | 'MISMATCH' | 'CORRUPT' | 'LIMIT',
    message: string,
  ) {
    super(message);
    this.name = 'PasskeyError';
  }
}

/** The two WebAuthn calls this module makes; navigator.credentials in the browser. */
export interface WebAuthnApi {
  create(options: CredentialCreationOptions): Promise<Credential | null>;
  get(options: CredentialRequestOptions): Promise<Credential | null>;
}

/**
 * The relying party a passkey is bound to. On ledgerchat.org and any of its subdomains it is the
 * registrable domain, so a passkey enrolled on www.ledgerchat.org also opens the wallet on
 * ledgerchat.org (and no other site can ever ask for it: browsers only allow an rpId that is the
 * page's own domain or a parent of it). Anywhere else (a self-hosted copy, localhost) it is the
 * page's host.
 */
export function passkeyRpId(hostname: string): string {
  const h = hostname.toLowerCase();
  return h === 'ledgerchat.org' || h.endsWith('.ledgerchat.org') ? 'ledgerchat.org' : h;
}

export function browserWebAuthn(): WebAuthnApi | null {
  if (typeof navigator === 'undefined' || !navigator.credentials || typeof PublicKeyCredential === 'undefined') return null;
  return { create: (o) => navigator.credentials.create(o), get: (o) => navigator.credentials.get(o) };
}

/**
 * Whether this browser says it can evaluate PRF. A "maybe" (no capability API) is true: the
 * authenticator decides at enrolment, and enrolPasskey refuses cleanly when it cannot.
 */
export async function passkeysAvailable(): Promise<boolean> {
  if (typeof PublicKeyCredential === 'undefined') return false;
  try {
    const caps = await (PublicKeyCredential as any).getClientCapabilities?.();
    if (caps && typeof caps === 'object' && 'extension:prf' in caps) return !!caps['extension:prf'];
  } catch {
    /* no capability API */
  }
  return true;
}

/* ----------------------------------------------------------------- encoding */

export function toB64url(bytes: Uint8Array): string {
  let s = '';
  for (const b of bytes) s += String.fromCharCode(b);
  return btoa(s).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}
export function fromB64url(text: string): Uint8Array {
  const s = atob(text.replace(/-/g, '+').replace(/_/g, '/') + '==='.slice((text.length + 3) % 4));
  const out = new Uint8Array(s.length);
  for (let i = 0; i < s.length; i++) out[i] = s.charCodeAt(i);
  return out;
}
function hexToBytes(hex: string): Uint8Array {
  const clean = hex.startsWith('0x') ? hex.slice(2) : hex;
  if (!/^[0-9a-fA-F]*$/.test(clean) || clean.length % 2) throw new PasskeyError('CORRUPT', 'The account root is not hex.');
  const out = new Uint8Array(clean.length / 2);
  for (let i = 0; i < out.length; i++) out[i] = parseInt(clean.slice(i * 2, i * 2 + 2), 16);
  return out;
}
function bytesToHex(b: Uint8Array): string {
  return '0x' + Array.from(b, (x) => x.toString(16).padStart(2, '0')).join('');
}
const enc = new TextEncoder();
const toBuf = (u: Uint8Array): ArrayBuffer => u.buffer.slice(u.byteOffset, u.byteOffset + u.byteLength) as ArrayBuffer;

/* ------------------------------------------------------------------- crypto */

/** Everything a record is bound to: a ciphertext moved to another account or network fails to open. */
export function recordAad(r: Pick<PasskeyRecord, 'evm' | 'network' | 'credentialId'>): Uint8Array {
  return enc.encode(`${PASSKEY_SCHEME}|${r.evm}|${r.network}|${r.credentialId}`);
}

async function wrapKey(prfOutput: Uint8Array): Promise<CryptoKey> {
  if (prfOutput.length < 32) throw new PasskeyError('NO_PRF', 'The passkey returned no usable secret.');
  const ikm = await crypto.subtle.importKey('raw', toBuf(prfOutput), 'HKDF', false, ['deriveKey']);
  return crypto.subtle.deriveKey(
    { name: 'HKDF', hash: 'SHA-256', salt: toBuf(enc.encode('humanity-ledger/passkey')), info: toBuf(enc.encode(`${PASSKEY_SCHEME}/wrap`)) },
    ikm,
    { name: 'AES-GCM', length: 256 },
    false,
    ['encrypt', 'decrypt'],
  );
}

export async function wrapRoot(prfOutput: Uint8Array, rootHex: string, aad: Uint8Array): Promise<{ iv: string; ct: string }> {
  const root = hexToBytes(rootHex);
  if (root.length < 64) throw new PasskeyError('CORRUPT', 'The account root is too short.');
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const ct = new Uint8Array(await crypto.subtle.encrypt({ name: 'AES-GCM', iv: toBuf(iv), additionalData: toBuf(aad) }, await wrapKey(prfOutput), toBuf(root)));
  root.fill(0);
  return { iv: toB64url(iv), ct: toB64url(ct) };
}

export async function unwrapRoot(prfOutput: Uint8Array, r: PasskeyRecord): Promise<string> {
  try {
    const pt = new Uint8Array(
      await crypto.subtle.decrypt(
        { name: 'AES-GCM', iv: toBuf(fromB64url(r.iv)), additionalData: toBuf(recordAad(r)) },
        await wrapKey(prfOutput),
        toBuf(fromB64url(r.ct)),
      ),
    );
    const hex = bytesToHex(pt);
    pt.fill(0);
    return hex;
  } catch (e) {
    if (e instanceof PasskeyError) throw e;
    throw new PasskeyError('CORRUPT', 'This passkey could not open the saved key: it was changed, or it belongs to another account.');
  }
}

/** The PRF output WebAuthn returned, if any. */
function prfFirst(cred: Credential | null): { enabled?: boolean; first?: Uint8Array } {
  const ext = (cred as any)?.getClientExtensionResults?.() ?? {};
  const prf = ext.prf ?? {};
  const first = prf.results?.first;
  return { enabled: prf.enabled, first: first ? new Uint8Array(first instanceof ArrayBuffer ? first : first.buffer ?? first) : undefined };
}

function rawIdOf(cred: Credential | null): Uint8Array {
  const raw = (cred as any)?.rawId;
  if (!raw) throw new PasskeyError('CANCELLED', 'No passkey was used.');
  return new Uint8Array(raw instanceof ArrayBuffer ? raw : raw.buffer ?? raw);
}

function cancelled(e: any): never {
  if (e instanceof PasskeyError) throw e;
  if (e?.name === 'NotAllowedError' || e?.name === 'AbortError') throw new PasskeyError('CANCELLED', 'The passkey request was closed.');
  if (e?.name === 'InvalidStateError') throw new PasskeyError('LIMIT', 'This authenticator already holds a passkey for this account.');
  if (e?.name === 'NotSupportedError' || e?.name === 'SecurityError') throw new PasskeyError('UNSUPPORTED', 'This browser cannot use passkeys here.');
  throw e;
}

/* ---------------------------------------------------------------- enrolment */

export interface EnrolInput {
  /** The person's Ethereum address (lowercase), the account the root belongs to. */
  evm: string;
  network: 'testnet' | 'mainnet';
  /** The account root (wallet signature). The caller has checked it derives the open account. */
  rootHex: string;
  label: string;
  /** Records already enrolled for this account and network (excluded, counted). */
  existing: PasskeyRecord[];
  rpId: string;
  api: WebAuthnApi;
}

/** A stable WebAuthn user handle per account and network, so an authenticator keeps one passkey for it. */
export async function userHandle(evm: string, network: string): Promise<Uint8Array> {
  const h = new Uint8Array(await crypto.subtle.digest('SHA-256', toBuf(enc.encode(`${PASSKEY_SCHEME}/user|${evm}|${network}`))));
  return h.slice(0, 16);
}

export async function enrolPasskey(i: EnrolInput): Promise<PasskeyRecord> {
  if (i.existing.length >= MAX_PASSKEYS) throw new PasskeyError('LIMIT', `At most ${MAX_PASSKEYS} passkeys per account.`);
  const prfSalt = crypto.getRandomValues(new Uint8Array(32));
  let cred: Credential | null;
  try {
    cred = await i.api.create({
      publicKey: {
        rp: { id: i.rpId, name: 'Ledger Chat' },
        user: {
          id: toBuf(await userHandle(i.evm, i.network)),
          name: `${i.evm.slice(0, 6)}…${i.evm.slice(-4)}${i.network === 'mainnet' ? ' · Aztec Alpha' : ' · Aztec test network'}`,
          displayName: 'Ledger Chat private wallet',
        },
        challenge: toBuf(crypto.getRandomValues(new Uint8Array(32))),
        pubKeyCredParams: [
          { type: 'public-key', alg: -7 }, // ES256
          { type: 'public-key', alg: -257 }, // RS256 (Windows Hello)
        ],
        authenticatorSelection: { residentKey: 'required', userVerification: 'required' },
        excludeCredentials: i.existing.map((r) => ({ type: 'public-key' as const, id: toBuf(fromB64url(r.credentialId)) })),
        timeout: 120_000,
        extensions: { prf: { eval: { first: toBuf(prfSalt) } } } as any,
      },
    });
  } catch (e) {
    cancelled(e);
  }
  const credentialId = toB64url(rawIdOf(cred));
  let { enabled, first } = prfFirst(cred);
  if (!first) {
    if (enabled === false) {
      throw new PasskeyError('NO_PRF', 'This passkey cannot derive a secret (no PRF). Use iCloud Keychain, Google Password Manager, 1Password, or a security key that supports it.');
    }
    // Some authenticators evaluate PRF only on use: one more confirmation.
    first = (await evaluate(i.api, i.rpId, [{ credentialId, prfSalt: toB64url(prfSalt) }])).prf;
  }
  const base = { evm: i.evm, network: i.network, credentialId };
  const { iv, ct } = await wrapRoot(first, i.rootHex, recordAad(base));
  first.fill(0);
  return PasskeyRecordSchema.parse({
    v: 1,
    scheme: PASSKEY_SCHEME,
    ...base,
    prfSalt: toB64url(prfSalt),
    iv,
    ct,
    label: i.label.trim().slice(0, 60) || 'Passkey',
    createdAt: Date.now(),
  });
}

/* ------------------------------------------------------------------- unlock */

async function evaluate(
  api: WebAuthnApi,
  rpId: string,
  records: Array<Pick<PasskeyRecord, 'credentialId' | 'prfSalt'>>,
): Promise<{ credentialId: string; prf: Uint8Array }> {
  const evalByCredential: Record<string, { first: ArrayBuffer }> = {};
  for (const r of records) evalByCredential[r.credentialId] = { first: toBuf(fromB64url(r.prfSalt)) };
  let cred: Credential | null;
  try {
    cred = await api.get({
      publicKey: {
        rpId,
        challenge: toBuf(crypto.getRandomValues(new Uint8Array(32))),
        allowCredentials: records.map((r) => ({ type: 'public-key' as const, id: toBuf(fromB64url(r.credentialId)) })),
        userVerification: 'required',
        timeout: 120_000,
        extensions: { prf: { evalByCredential } } as any,
      },
    });
  } catch (e) {
    cancelled(e);
  }
  const credentialId = toB64url(rawIdOf(cred));
  const { first } = prfFirst(cred);
  if (!first) throw new PasskeyError('NO_PRF', 'The passkey did not return its secret. This browser or authenticator does not support PRF.');
  return { credentialId, prf: first };
}

/**
 * Asks for any of the enrolled passkeys and returns the account root it wraps. Only records for
 * this account and network are offered. The caller derives the keys and checks the address.
 */
export async function unlockWithPasskey(i: {
  evm: string;
  network: 'testnet' | 'mainnet';
  records: PasskeyRecord[];
  rpId: string;
  api: WebAuthnApi;
}): Promise<{ record: PasskeyRecord; rootHex: string }> {
  const mine = i.records.filter((r) => r.evm === i.evm && r.network === i.network);
  if (!mine.length) throw new PasskeyError('NO_RECORD', 'No passkey is enrolled for this account on this network.');
  const { credentialId, prf } = await evaluate(i.api, i.rpId, mine);
  const record = mine.find((r) => r.credentialId === credentialId);
  if (!record) throw new PasskeyError('NO_RECORD', 'That passkey is not enrolled for this account.');
  const rootHex = await unwrapRoot(prf, record);
  prf.fill(0);
  return { record, rootHex };
}

/**
 * Checks that an unwrapped root is what the account's Ethereum wallet signs: an ECDSA signature
 * (65 bytes) over the network's typed data must recover to `evm`. A root that recovers to anyone
 * else is refused, so no record (corrupted, planted or from an old bug) can open an account other
 * than the one the person chose. A longer root is a smart-account signature (EIP-1271/6492), which
 * cannot be checked offline; it is accepted as before and the derived address is what the wallet
 * shows.
 */
export async function assertRootOwner(
  rootHex: string,
  evm: string,
  typedData: { domain: object; types: object; primaryType: string; message: object },
): Promise<void> {
  const clean = rootHex.startsWith('0x') ? rootHex.slice(2) : rootHex;
  if (clean.length !== 130) return;
  let who: string;
  try {
    const { recoverTypedDataAddress } = await import('viem');
    who = await recoverTypedDataAddress({ ...(typedData as any), signature: ('0x' + clean) as `0x${string}` });
  } catch {
    throw new PasskeyError('MISMATCH', 'This passkey record does not open your account.');
  }
  if (who.toLowerCase() !== evm.toLowerCase()) {
    throw new PasskeyError('MISMATCH', 'This passkey record opens a different account. It was not used.');
  }
}

/**
 * Records from this device first; the backup only adds credentials this device does not hold.
 * The server can therefore never replace a record the person already has here (a bad copy could
 * only fail to decrypt, but it would have overwritten the good one).
 */
export function mergeKeepingLocal(local: PasskeyRecord[], remote: PasskeyRecord[]): PasskeyRecord[] {
  const mine = mergeRecords(local);
  const have = new Set(mine.map((r) => r.credentialId));
  return mergeRecords(mine, mergeRecords(remote).filter((r) => !have.has(r.credentialId)));
}

/** Merges records from this device and the backup: one per credential, the newest wins. */
export function mergeRecords(...lists: PasskeyRecord[][]): PasskeyRecord[] {
  const by = new Map<string, PasskeyRecord>();
  for (const list of lists) {
    for (const raw of list) {
      const p = PasskeyRecordSchema.safeParse(raw);
      if (!p.success) continue;
      const prev = by.get(p.data.credentialId);
      if (!prev || prev.createdAt < p.data.createdAt) by.set(p.data.credentialId, p.data);
    }
  }
  return [...by.values()].sort((a, b) => a.createdAt - b.createdAt);
}
