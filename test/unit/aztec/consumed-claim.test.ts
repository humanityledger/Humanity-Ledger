import { describe, expect, it } from 'vitest';
import fs from 'node:fs';
import { consumedMessageHash, sameMessageHash } from '@/lib/aztec/fee-juice';

// 15 Nov 2026, Alpha: a path that paid its fee by claiming the account's own deposit never dropped it,
// so every later transaction failed with this error (message from the PXE).
const PXE_ERROR = 'No non-nullified L1 to L2 message found for message hash 0x00e7b65294673af444cd4066743061b3ac6970fcdc2e4cebe88fc58882b55a68';

describe('a deposit already claimed on Aztec', () => {
  it('is recognised from the PXE error, as an Error or a string', () => {
    const h = BigInt('0x00e7b65294673af444cd4066743061b3ac6970fcdc2e4cebe88fc58882b55a68');
    expect(consumedMessageHash(new Error(PXE_ERROR))).toBe(h);
    expect(consumedMessageHash(`Simulation failed: ${PXE_ERROR}. More text`)).toBe(h);
    expect(consumedMessageHash(new Error('Insufficient fee payer balance'))).toBeNull();
    expect(consumedMessageHash(undefined)).toBeNull();
  });

  it('matches the stored claim whatever the hex spelling', () => {
    const h = consumedMessageHash(PXE_ERROR)!;
    expect(sameMessageHash('0xe7b65294673af444cd4066743061b3ac6970fcdc2e4cebe88fc58882b55a68', h)).toBe(true);
    expect(sameMessageHash('0x00E7B65294673AF444CD4066743061B3AC6970FCDC2E4CEBE88FC58882B55A68', h)).toBe(true);
    expect(sameMessageHash('0x01', h)).toBe(false);
    expect(sameMessageHash('not hex', h)).toBe(false);
  });
});

describe('wallet paths that claim a deposit for their fee', () => {
  const w = fs.readFileSync('lib/aztec/wallet/client.ts', 'utf8');
  const between = (a: string, b: string) => w.slice(w.indexOf(a), w.indexOf(b, w.indexOf(a)));

  it('a failed send forgets an own deposit the node says was already claimed', () => {
    const send = between('private async sendAndWait(', 'agreementContext()');
    expect(send).toMatch(/status: 'failed'[\s\S]{0,200}this\.healConsumedClaim\(err\);[\s\S]{0,40}return null;/);
  });
});
