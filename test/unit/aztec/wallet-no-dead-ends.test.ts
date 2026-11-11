/**
 * Points where a user with real funds on Aztec Alpha could get stuck or be led
 * to pay twice. Fixed on 11 November 2026; these tests keep them fixed.
 */
import { describe, expect, it } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';

const root = path.resolve(__dirname, '../../..');
const read = (p: string) => fs.readFileSync(path.join(root, p), 'utf8');

describe('a transaction that was sent but not confirmed in time', () => {
  it('is recognised as a confirmation timeout, and its message says to check before sending again', async () => {
    const { isConfirmationTimeout, humanError, UNCONFIRMED_MESSAGE } = await import('@/lib/aztec/wallet/client');
    expect(isConfirmationTimeout(new Error('Timeout awaiting isMined'))).toBe(true);
    expect(isConfirmationTimeout({ name: 'TimeoutError', message: '' })).toBe(true);
    expect(isConfirmationTimeout(new Error('Assertion failed: balance too low'))).toBe(false);
    expect(UNCONFIRMED_MESSAGE).toMatch(/before sending again/);
    expect(humanError(new Error(UNCONFIRMED_MESSAGE))).toBe(UNCONFIRMED_MESSAGE);
  });

  it('is recorded as pending, never as failed (client.ts)', () => {
    const src = read('lib/aztec/wallet/client.ts');
    expect(src).toMatch(/if \(txHash && isConfirmationTimeout\(err\)\) \{\s*\/\/[^\n]*\n\s*upsertActivity\(me, \{ id, kind, txHash, status: 'pending'/);
  });
});

describe('a failed balance read never undoes an open wallet or a confirmed payment', () => {
  it('open, account creation and every sent transaction refresh quietly', () => {
    const src = read('lib/aztec/wallet/client.ts');
    expect(src).toMatch(/this\.set\(\{ phase: 'ready', step: undefined \}\);\s*await this\.refreshQuietly\(\);/);
    expect(src).toMatch(/if \(receipt && consumes\) this\.dropClaim\(consumes\);[\s\S]{0,200}await this\.refreshQuietly\(\);/);
    expect(src).not.toMatch(/phase: 'ready', step: undefined \}\);\s*await this\.refresh\(\);/);
  });
});

describe('ZkWalletPanel on Aztec Alpha', () => {
  const panel = read('components/zk/ZkWalletPanel.tsx');
  it('offers the Fee Juice bridge when the account is waiting for Fee Juice, instead of another signature', () => {
    expect(panel).toMatch(/!ready && state\.phase === 'needs-fee-juice' \? \(/);
    expect(panel).toMatch(/<FeeJuiceStation userAddress=\{address\} \/>/);
  });
  it('shows the Fee Juice balance and a way to add more once the wallet is open', () => {
    expect(panel).toMatch(/Fee Juice for network fees/);
    expect(panel).toMatch(/sheet === 'fees' && <FeeJuiceStation/);
  });
});

describe('humanError: network failures say what failed', () => {
  it('a stale page after a deploy asks for a reload, not a connection check', async () => {
    const { humanError } = await import('@/lib/aztec/wallet/client');
    expect(humanError(new TypeError('Failed to fetch dynamically imported module: https://ledgerchat.org/_next/static/chunks/123.js'))).toMatch(/updated while this page was open/);
    expect(humanError(new Error('ChunkLoadError: Loading chunk 4521 failed.'))).toMatch(/Reload the page/);
  });
  it('a plain network failure names the host when the error does and keeps the raw reason', async () => {
    const { humanError } = await import('@/lib/aztec/wallet/client');
    const m = humanError(new Error('fetch failed: https://aztec-mainnet.drpc.org'));
    expect(m).toMatch(/Could not reach aztec-mainnet\.drpc\.org/);
    expect(m).toMatch(/\(fetch failed/);
  });
});
