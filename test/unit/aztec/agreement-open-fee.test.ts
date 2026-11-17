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
  it('refuses an escrow amount the contract would refuse, on the current class', async () => {
    expect(ids.escrow.length).toBeGreaterThan(0);
    await expect(assertCanOpen('escrow', 9_999n, ids.escrow[0])).rejects.toThrow(
      'This amount is refused. The contract would not accept the fee.',
    );
    await expect(assertCanOpen('escrow', 1_000_000_001n, ids.escrow[0])).rejects.toThrow(
      'This amount is refused. The contract would not accept the fee.',
    );
  });

  it('refuses a pre-fee class before it talks about the treasury', async () => {
    await expect(assertCanOpen('escrow', 20_000n, OTHER)).rejects.toThrow(
      'This artifact is not the current agreement class.',
    );
    await expect(assertCanOpen('streams', 2_000_000_000n, OTHER)).rejects.toThrow(
      'This artifact is not the current agreement class.',
    );
  });

  it('blocks a valid escrow and a large stream while the source with the treasury awaits recompile', async () => {
    const pending = 'This agreement contract is being recompiled with the treasury address.';
    await expect(assertCanOpen('escrow', 20_000n, ids.escrow[0], 'testnet')).rejects.toThrow(pending);
    // A stream total over TX_CAP is not a fee refusal. create_stream allows it.
    await expect(assertCanOpen('streams', 2_000_000_000n, ids.streams[0], 'testnet')).rejects.toThrow(pending);
  });

  it('on Aztec Alpha refuses because there is no external audit, with the treasury designated', async () => {
    const noAudit = 'Escrows and streams cannot be opened on Aztec Alpha. The contracts have no external audit';
    await expect(assertCanOpen('escrow', 20_000n, ids.escrow[0], 'mainnet')).rejects.toThrow(noAudit);
    await expect(assertCanOpen('streams', 2_000_000_000n, ids.streams[0], 'mainnet')).rejects.toThrow(noAudit);
  });
});
