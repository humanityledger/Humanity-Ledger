import fs from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';

// Product decision, 15 Nov 2026: Ledger Chat sponsors no fee. Every account pays its own network fees
// (its own Fee Juice, or Fee Juice a contact bridges through a fee link). Nothing in the code can turn
// sponsorship on, whatever any environment variable says: there is no contract, route, client path
// or operator screen left to switch on.

function files(dir: string): string[] {
  if (!fs.existsSync(dir)) return [];
  return fs.readdirSync(dir, { withFileTypes: true }).flatMap((e) => {
    const p = path.join(dir, e.name);
    if (e.isDirectory()) return ['node_modules', '.next', 'archive', 'legacy'].includes(e.name) ? [] : files(p);
    return /\.(ts|tsx|mjs|js)$/.test(e.name) ? [p] : [];
  });
}

describe('no fee sponsorship on Aztec Alpha', () => {
  it('the sponsor contract, its route, its client and its operator tools are gone', () => {
    for (const p of [
      'contracts/aztec/sponsor',
      'app/api/aztec/sponsor',
      'lib/aztec/wallet/ledger-sponsor.ts',
      'lib/aztec/sponsor-voucher.ts',
      'lib/aztec/sponsor-quota.ts',
      'scripts/aztec/verify-sponsor.mjs',
      '.github/workflows/aztec-verify-sponsor.yml',
    ]) expect(fs.existsSync(p), p).toBe(false);
  });

  it('no code reads a sponsorship variable or calls the sponsor', () => {
    const offenders: string[] = [];
    for (const f of [...files('app'), ...files('lib'), ...files('components'), ...files('hooks'), 'middleware.ts']) {
      const src = fs.readFileSync(f, 'utf8');
      if (/NEXT_PUBLIC_AZTEC_SPONSOR\b|NEXT_PUBLIC_AZTEC_SPONSOR_ADMIN|AZTEC_SPONSOR_(SIGNER_KEY|PER_WALLET|PER_DAY)|ledger-sponsor|LedgerSponsor|trySponsor|deployLedgerSponsor/.test(src)) offenders.push(f);
    }
    expect(offenders).toEqual([]);
    expect(fs.readFileSync('Dockerfile', 'utf8')).not.toMatch(/NEXT_PUBLIC_AZTEC_SPONSOR(\s|$|_ADMIN)/);
  });

  it('the old endpoint answers 410 at the edge, and nothing is recorded as a fee payer', async () => {
    const { isRetiredApiRoute } = await import('@/lib/security/retiredRoutes');
    expect(isRetiredApiRoute('/api/aztec/sponsor')).toBe(true);
    expect(JSON.parse(fs.readFileSync('deployments/aztec-mainnet.json', 'utf8')).sponsoredFpc).toBeNull();
  });

  it('on Alpha the fee plan never sponsors and no variable can add a sponsored fee payer', async () => {
    const { feePlan } = await import('@/lib/aztec/fee-juice');
    expect(feePlan({ network: 'mainnet', hasSponsor: true, feeJuiceBalance: 0n, minBalance: 1n, claims: [] } as any).kind).not.toBe('sponsored');
    const cfg = fs.readFileSync('lib/aztec/wallet/config.ts', 'utf8');
    expect(cfg).toMatch(/sponsoredFpc: NETWORK === 'testnet' \? SPONSORED_FPC : '',/);
    const { feeChoices } = await import('@/lib/aztec/fees');
    expect(feeChoices('mainnet').some((c) => c.kind === 'sponsored')).toBe(false);
  });
});
