import { describe, it, expect } from 'vitest';
import { privateKeyToAccount } from 'viem/accounts';
import { foundationPoseidon2, humanId, leafHash, merkleRoot, scopeId, scopedTag, contextBinding, blockFingerprint, sanctionRoot, hex32 } from '@/lib/g8/hash';
import { decideAdmission } from '@/lib/g8/admission';
import { newInvitePayload, inviteMessage, encodeInvite, decodeInvite, verifyInvite } from '@/lib/g8/invite';
import { G8Level, TREE_DEPTH } from '@/lib/g8/constants';

const zeros = () => Array(TREE_DEPTH).fill(0n) as bigint[];

describe('G8 hashing (same functions as circuits/g8_admission)', () => {
  it('one human → one tag per scope; different scopes are unlinkable', async () => {
    const p2 = await foundationPoseidon2();
    const s = 0x1234n;
    const bob = await scopeId(p2, '0x' + 'b'.repeat(40));
    const carol = await scopeId(p2, '0x' + 'c'.repeat(40));
    const t1 = await scopedTag(p2, s, bob);
    expect(await scopedTag(p2, s, bob)).toBe(t1);           // a million wallets: still this tag
    expect(await scopedTag(p2, s, carol) === t1).toBe(false); // other scope: different tag
    expect(await scopedTag(p2, s + 1n, bob) === t1).toBe(false);
    expect(await scopeId(p2, '0x' + 'B'.repeat(40))).toBe(bob); // case-insensitive target
  });

  it('the leaf has no wallet input and the Merkle path follows the index bits', async () => {
    const p2 = await foundationPoseidon2();
    const leaf = await leafHash(p2, 11n, { jurisdiction: 724, tExp: 100, attrs: 9, salt: 77n });
    const r5 = await merkleRoot(p2, leaf, 5, zeros());
    const r4 = await merkleRoot(p2, leaf, 4, zeros());
    expect(r5 === r4).toBe(false);
    expect(await merkleRoot(p2, leaf, 5, zeros())).toBe(r5);
    expect(hex32(await humanId(p2, 11n))).toMatch(/^0x[0-9a-f]{64}$/);
    expect(typeof (await sanctionRoot(p2, []))).toBe('bigint');
  });

  it('context binding pins wallet, inbox, nonce and time (no replay from another account)', async () => {
    const base = { wallet: '0x' + 'a'.repeat(40), inbox: 'inbox-a', nonce: 'n1', tNow: 1_800_000_000 };
    const c = await contextBinding(base);
    expect(await contextBinding({ ...base, wallet: '0x' + 'A'.repeat(40) })).toBe(c);
    for (const change of [{ wallet: '0x' + 'f'.repeat(40) }, { inbox: 'inbox-x' }, { nonce: 'n2' }, { tNow: 1_800_000_001 }]) {
      expect(await contextBinding({ ...base, ...change }) === c).toBe(false);
    }
  });

  it('a block fingerprint follows the human, not the wallet', async () => {
    const p2 = await foundationPoseidon2();
    const owner = '0x' + 'b'.repeat(40);
    const T = await scopedTag(p2, 99n, await scopeId(p2, owner));
    const h = await blockFingerprint(owner, T);
    expect(h).toMatch(/^[0-9a-f]{64}$/);
    expect(await blockFingerprint(owner.toUpperCase(), T)).toBe(h);
    expect(await blockFingerprint('0x' + 'c'.repeat(40), T) === h).toBe(false);
  });
});

describe('Admission (spec §7)', () => {
  it('contacts are never affected; blocks drop; shield quarantines cold senders', () => {
    expect(decideAdmission({ consent: 'allowed', blocked: false, requiredLevel: G8Level.UniqueHuman })).toBe('deliver');
    expect(decideAdmission({ consent: 'allowed', blocked: true })).toBe('drop');
    expect(decideAdmission({ consent: 'unknown', blocked: false })).toBe('request');
    expect(decideAdmission({ consent: 'unknown', blocked: false, requiredLevel: G8Level.Hardware })).toBe('quarantine');
    expect(decideAdmission({ consent: 'unknown', blocked: false, requiredLevel: G8Level.Hardware, presented: G8Level.Invite })).toBe('quarantine');
    expect(decideAdmission({ consent: 'unknown', blocked: false, requiredLevel: G8Level.Invite, presented: G8Level.Invite })).toBe('request');
    expect(decideAdmission({ consent: 'unknown', blocked: false, requiredLevel: G8Level.Hardware, presented: G8Level.UniqueHuman })).toBe('request');
  });
});

describe('Invite Capability (Level 0)', () => {
  const issuer = privateKeyToAccount('0x' + '11'.repeat(32) as `0x${string}`);
  it('round-trips, verifies, rejects tampering and expiry', async () => {
    const payload = newInvitePayload(issuer.address, 3600, 1_800_000_000_000);
    const sig = await issuer.signMessage({ message: inviteMessage(payload) });
    const token = encodeInvite({ payload, sig });
    const back = decodeInvite(token)!;
    expect(back.payload).toEqual(payload);
    expect(await verifyInvite(back, 1_800_000_000_000)).toEqual({ ok: true });
    expect(await verifyInvite({ ...back, payload: { ...back.payload, exp: back.payload.exp + 1 } }, 1_800_000_000_000)).toEqual({ ok: false, reason: 'signature' });
    expect(await verifyInvite(back, (payload.exp + 1) * 1000)).toEqual({ ok: false, reason: 'expired' });
    expect(decodeInvite('garbage')).toBeNull();
  });
});
