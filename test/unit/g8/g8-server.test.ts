import { describe, it, expect } from 'vitest';
import { readFileSync } from 'fs';
import path from 'path';
import { checkPublicInputs, verifyAdmissionProof, G8_CIRCUIT, type AdmissionProof } from '@/lib/g8/verifier';
import { contextBinding, hex32 } from '@/lib/g8/hash';
import { normFingerprint, normAddr } from '@/lib/g8/server';

const root = path.resolve(__dirname, '../../..');
const read = (p: string) => readFileSync(path.join(root, p), 'utf8');

async function proof(over: Partial<AdmissionProof['publicInputs']> = {}, tNow = 1_800_000_000): Promise<AdmissionProof> {
  const context = { wallet: '0x' + 'a'.repeat(40), inbox: 'inbox-a', nonce: 'f'.repeat(32), tNow };
  return { proofHex: '0x00', context, publicInputs: { root: '0x01', sanctionRoot: '0x02', scope: '0x03', tag: '0x04', context: hex32(await contextBinding(context)), tMin: 0, tierMask: 0, ...over } };
}
const st = { roots: ['0x01', '0x09'], sanctionRoot: '0x02', myScope: '0x03', now: 1_800_000_000_000 };

describe('G8 verifier (fail-closed)', () => {
  it('checks root (incl. grace), sanctions, scope, freshness and context binding', async () => {
    expect(await checkPublicInputs(await proof(), st)).toEqual({ ok: true, tag: '0x04' });
    expect(await checkPublicInputs(await proof({ root: '0x09' }), st)).toEqual({ ok: true, tag: '0x04' });
    expect((await checkPublicInputs(await proof({ root: '0x07' }), st))).toEqual({ ok: false, reason: 'root' });
    expect((await checkPublicInputs(await proof({ sanctionRoot: '0x07' }), st))).toEqual({ ok: false, reason: 'sanctions' });
    expect((await checkPublicInputs(await proof({ scope: '0x07' }), st))).toEqual({ ok: false, reason: 'scope' });
    expect((await checkPublicInputs(await proof({}, 1_800_000_500), st))).toEqual({ ok: false, reason: 'stale' });
    const stolen = await proof(); stolen.context = { ...stolen.context, wallet: '0x' + 'e'.repeat(40) };
    expect(await checkPublicInputs(stolen, st)).toEqual({ ok: false, reason: 'context' });
  });
  it('rejects every proof until the compiled circuit is pinned (never fakes Level 2)', async () => {
    expect(G8_CIRCUIT).toBeNull();
    expect(await verifyAdmissionProof(await proof(), st)).toEqual({ ok: false, reason: 'circuit-not-pinned' });
  });
  it('server stores only fingerprints and addresses in canonical form', () => {
    expect(normFingerprint('a'.repeat(64))).toBe('a'.repeat(64));
    expect(normFingerprint('0x' + 'a'.repeat(64))).toBeNull();
    expect(normAddr(' 0x' + 'A'.repeat(40))).toBe('0x' + 'a'.repeat(40));
    const schema = read('prisma/schema.prisma');
    expect(schema).toMatch(/model G8BlockedFingerprint \{[\s\S]*fingerprint String/);
    expect(schema).not.toMatch(/model G8BlockedFingerprint \{[^}]*tag /);
  });
  it('routes use requireWallet, rate limits and mutual blocks', () => {
    for (const r of ['app/api/g8/challenge/route.ts', 'app/api/g8/invite/route.ts', 'app/api/g8/blocks/route.ts']) {
      const s = read(r);
      expect(s).toMatch(/requireWallet\(req\)/);
      expect(s).toMatch(/getClientIP\(req\)/);
    }
    expect(read('app/api/g8/invite/route.ts')).toMatch(/already used/);
    expect(read('app/api/g8/challenge/route.ts')).toMatch(/isMutuallyBlocked/);
  });
});
