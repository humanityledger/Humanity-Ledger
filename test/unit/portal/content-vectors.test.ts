/**
 * Differential vectors (internal security review, 18 November 2026): lib/portal/receivers.ts
 * builds the same message contents as the node:crypto reference in scripts/security/portal-vectors.mjs,
 * which Solidity (test/foundry/Differential.t.sol) and Noir (portal_token/src/test.nr) also check.
 */
import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { mintToPrivateContent, withdrawContent } from '@/lib/portal/receivers';

const v = JSON.parse(readFileSync('test/vectors/portal-content.json', 'utf8')) as {
  mints: { amount: string; content: string }[];
  withdraws: { recipient: string; amount: string; caller: string; content: string }[];
};

describe('portal message contents match the differential vectors', () => {
  it('mint_to_private(amount)', async () => {
    expect(v.mints.length).toBeGreaterThan(20);
    for (const m of v.mints) expect(await mintToPrivateContent(BigInt(m.amount))).toBe(m.content);
  });
  it('withdraw(recipient, amount, caller)', async () => {
    expect(v.withdraws.length).toBeGreaterThan(10);
    for (const w of v.withdraws) expect(await withdrawContent(w.recipient, BigInt(w.amount), w.caller)).toBe(w.content);
  });
});
