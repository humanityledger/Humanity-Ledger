/**
 * A token that cannot be loaded right now no longer keeps the private wallet shut, a token that
 * fails the G3 check is still never used, and a wallet that does not open says exactly why.
 */
import { describe, expect, it } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';

const src = fs.readFileSync(path.resolve(__dirname, '../../../lib/aztec/wallet/client.ts'), 'utf8');

describe('private wallet opening', () => {
  it('loads tokens one by one and never throws for one of them', () => {
    expect(src).toMatch(/const tokenIssues = await this\.ensureTokens\(\);/);
    expect(src).not.toMatch(/is not a token this app can use on/);
    // G3 still decides: a token that fails the check is skipped, never registered.
    expect(src).toMatch(/if \(!c\.ok\) \{ issues\.push\(`\$\{t\.symbol\}: \$\{c\.reason\}`\); continue; \}/);
  });

  it('retries a missing token on Sync, and refuses to send with one that is not loaded', () => {
    expect(src).toMatch(/this\.tokens\.size < AZTEC_WALLET_CONFIG\.tokens\.length \? await this\.ensureTokens\(\) : \[\]/);
    expect(src).toMatch(/const c = this\.tokens\.get\(t\.key\);\s*if \(!c\) continue;/);
    expect(src).toMatch(/if \(!contract\) throw new Error\(`\$\{tokenConfig\(key\)\.symbol\} is not available in your wallet right now\./);
  });

  it('keeps the exact reason for "Copy details"', async () => {
    const { errorDetailFor, tokenIssuesMessage } = await import('@/lib/aztec/wallet/client');
    const agg = new AggregateError([new TypeError('Load failed'), new Error('boom')], '2 of 2 concurrent operations failed');
    const d = errorDetailFor('Loading tokens', agg);
    expect(d).toMatch(/step: Loading tokens/);
    expect(d).toMatch(/causes: Load failed \| boom/);
    expect(d.length).toBeLessThanOrEqual(2000);
    expect(tokenIssuesMessage(['HLC: Load failed'])).toMatch(/^Your wallet is open, but HLC: Load failed\. .*tap Sync/);
    const panel = fs.readFileSync(path.resolve(__dirname, '../../../components/zk/ZkWalletPanel.tsx'), 'utf8');
    expect(panel).toMatch(/errorDetail=\{state\.errorDetail\}/);
    expect(panel).toMatch(/Copy details/);
  });
});
