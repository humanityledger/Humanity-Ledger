import { describe, it, expect } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';
import { assertCanOpen } from '@/lib/aztec/agreements';
import { currentClassIds } from '@/lib/aztec/agreement-invite';

const root = path.resolve(__dirname, '../../..');
const record = JSON.parse(fs.readFileSync(path.join(root, 'deployments/aztec-testnet.json'), 'utf8'));
const ids = currentClassIds(record);
const OTHER = `0x${'11'.repeat(32)}`;

describe('direct agreement creation', () => {
  it('refuses what the alpha contracts refuse: more than 100 HLC (OD-2), for an escrow and a stream', async () => {
    expect(ids.escrow.length).toBeGreaterThan(0);
    const max = 'This amount is above the closed alpha maximum of 100 HLC per agreement.';
    await expect(assertCanOpen('escrow', 100_000_001n, ids.escrow[0], 'testnet')).rejects.toThrow(max);
    await expect(assertCanOpen('streams', 100_000_001n, ids.streams[0], 'testnet')).rejects.toThrow(max);
    // No protocol fee (OD-7): small amounts the baseline refused are accepted.
    await expect(assertCanOpen('escrow', 9_999n, ids.escrow[0], 'testnet')).resolves.toBeUndefined();
    await expect(assertCanOpen('escrow', 1n, ids.escrow[0], 'testnet')).resolves.toBeUndefined();
  });

  it('refuses a pre-fee class before it talks about the treasury', async () => {
    await expect(assertCanOpen('escrow', 20_000n, OTHER)).rejects.toThrow(
      'This artifact is not the current agreement class.',
    );
    await expect(assertCanOpen('streams', 2_000_000_000n, OTHER)).rejects.toThrow(
      'This artifact is not the current agreement class.',
    );
  });

  it('the current classes are the closed-alpha ones, one each', () => {
    // Closed alpha, wave 1 (OD-2, OD-7): class ids from print-class-ids, run 44288052113.
    expect(ids.escrow).toEqual(['0x165090de7e22e636ed3c392069f26895eca9600c5355d5766265b84d59c6f143']);
    expect(ids.streams).toEqual(['0x0f2ba459de8636b73e86365de0d9a8d775b3b82bc47f39333dd17deeef6fc1e3']);
  });

  it('refuses the classes compiled with a zero treasury', async () => {
    const refused = 'This artifact is not the current agreement class.';
    await expect(assertCanOpen('escrow', 20_000n, '0x177021740d92d13f78e3f96a5bd3447eeb268cb6e9073e88832d14856b66e0ee', 'testnet')).rejects.toThrow(refused);
    await expect(assertCanOpen('streams', 2_000_000_000n, '0x2c22f32674231c50fe77c970d5f604f9a5bd60f9dd800bd575c1f6f89eba1ae3', 'testnet')).rejects.toThrow(refused);
  });

  it('with nothing held for recompile, the test network accepts the alpha maximum on the current class', async () => {
    await expect(assertCanOpen('escrow', 100_000_000n, ids.escrow[0], 'testnet')).resolves.toBeUndefined();
    await expect(assertCanOpen('streams', 100_000_000n, ids.streams[0], 'testnet')).resolves.toBeUndefined();
  });

  it('on Aztec Alpha refuses because there is no external audit, with the treasury designated', async () => {
    const noAudit = 'Escrows and streams cannot be opened on Aztec Alpha. The contracts have no external audit';
    await expect(assertCanOpen('escrow', 20_000n, ids.escrow[0], 'mainnet')).rejects.toThrow(noAudit);
    await expect(assertCanOpen('streams', 50_000_000n, ids.streams[0], 'mainnet')).rejects.toThrow(noAudit);
  });
});
