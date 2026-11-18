/**
 * The Alpha client cannot deploy the fee classes: there is no external audit.
 * The designated treasury is in the source, the client and nowhere else. On
 * 17 November 2026 the "Aztec contracts" workflow recompiled escrow and streams
 * from that source (run 44061471400, TXE green) and committed the artifacts, so
 * the pending-recompile hold is empty. Source checks only: no network, no transaction.
 */
import { describe, it, expect } from 'vitest';
import fs from 'node:fs';
import { createHash } from 'node:crypto';
import { TREASURY_ADDRESS, TREASURY_ADDRESS_SET, baselineFee, BASELINE_ESCROW_SCHEDULE, BASELINE_STREAM_SCHEDULE, BASELINE_TX_CAP } from '@/lib/protocol/fees';
import { AUDIT_REFUSED, RECOMPILE_REFUSED, TREASURY_REFUSED, buildNetwork, deployRefusal, hasAudit } from '@/lib/protocol/agreement-gate';

const read = (p: string) => fs.readFileSync(p, 'utf8');
const DESIGNATED = '0x177395a38df8c95a572d3e7591240312b2fddbaf14d294d9e1443f3b0d55faed';
const mainnet = JSON.parse(read('deployments/aztec-mainnet.json'));
const pending = JSON.parse(read('deployments/aztec-pending-recompile.json')).pending as Array<{ contract: string; source: string; sha256: string }>;

describe('designated treasury', () => {
  it('client and both contract sources carry the same address, and only that one', () => {
    expect(TREASURY_ADDRESS).toBe(DESIGNATED);
    expect(TREASURY_ADDRESS_SET).toBe(true);
    for (const f of ['contracts/aztec/escrow/src/main.nr', 'contracts/aztec/streams/src/main.nr']) {
      const src = read(f);
      expect(src).toContain(`global TREASURY: AztecAddress = AztecAddress { inner: ${DESIGNATED} };`);
      expect(src.match(/global TREASURY:/g)?.length).toBe(1);
    }
  });

  it('the internal security review is recorded as such and never counts as an audit', () => {
    expect(mainnet.audit).toBe(null);
    expect(mainnet.internalReview).toMatchObject({ date: '2026-11-18', baseCommit: '6251a73' });
    expect(fs.existsSync(mainnet.internalReview.report)).toBe(true);
    // The gate reads only `audit`: an internal review leaves Alpha refused.
    expect(hasAudit(mainnet.audit)).toBe(false);
    expect(deployRefusal({ kind: 'escrow', network: 'mainnet', audit: mainnet.audit, pendingContracts: [], treasurySet: true })).toBe(AUDIT_REFUSED);
    // The words of an audit do not describe it anywhere in the record.
    expect(JSON.stringify(mainnet.internalReview)).not.toMatch(/audited|audit seal|certified/i);
  });

  it('no audit is recorded, and no treasury field is invented in the deployment records', () => {
    expect(mainnet.audit).toBe(null);
    for (const f of ['deployments/aztec-mainnet.json', 'deployments/aztec-testnet.json']) {
      expect(read(f)).not.toMatch(/"treasury"\s*:/i);
    }
  });

  it('nothing is held for recompile, and the committed artifacts carry the designated treasury, not zero', () => {
    expect(pending).toEqual([]);
    const artifacts = ['contracts/aztec/escrow/target/private_escrow-PrivateEscrow.json', 'contracts/aztec/streams/target/payment_stream-PaymentStream.json'];
    for (const a of artifacts) {
      const raw = read(a);
      expect(raw, a).toContain(DESIGNATED.slice(2));
      expect(raw, a).not.toContain('global TREASURY: AztecAddress = AztecAddress { inner: 0 }');
      // The artifact was built from the source on disk.
      const files = Object.values(JSON.parse(raw).file_map ?? {}) as Array<{ path: string; source: string }>;
      const main = files.find((f) => f.path.endsWith('src/main.nr'));
      expect(main && createHash('sha256').update(main.source).digest('hex'), a).toBe(createHash('sha256').update(read(a.replace(/target\/.*$/, 'src/main.nr'))).digest('hex'));
    }
  });
});

describe('deploy gate', () => {
  const base = { kind: 'escrow' as const, audit: null, pendingContracts: [] as string[], treasurySet: true };

  it('Alpha without an audit is refused first, even with the treasury set and nothing pending', () => {
    expect(deployRefusal({ ...base, network: 'mainnet' })).toBe(AUDIT_REFUSED);
    expect(deployRefusal({ ...base, network: 'mainnet', audit: {} })).toBe(AUDIT_REFUSED);
    expect(hasAudit({ report: 'x' })).toBe(true);
  });

  it('a pending recompile refuses; without it and with a treasury the test network may deploy', () => {
    expect(deployRefusal({ ...base, network: 'testnet', pendingContracts: ['PrivateEscrow'] })).toBe(RECOMPILE_REFUSED);
    expect(deployRefusal({ ...base, network: 'testnet', kind: 'streams', pendingContracts: ['PrivateEscrow'] })).toBe(null);
    expect(deployRefusal({ ...base, network: 'testnet', treasurySet: false })).toBe(TREASURY_REFUSED);
  });

  it('Alpha is chosen only by name', () => {
    expect(buildNetwork('alpha')).toBe('mainnet');
    expect(buildNetwork('mainnet')).toBe('testnet');
    expect(buildNetwork(undefined)).toBe('testnet');
  });

  it('the app reads the network by its literal variable name, so the browser bundle gets it', () => {
    expect(read('lib/protocol/agreement-gate.ts')).toContain('process.env.NEXT_PUBLIC_AZTEC_NETWORK');
  });
});

describe('composer and assertCanOpen use the same rule', () => {
  const composer = read('components/chat/AgreementComposer.tsx');
  const agreements = read('lib/aztec/agreements.ts');

  it('the refusal is shown before any field and disables Open', () => {
    const notice = composer.indexOf('{notice} You can still share your Aztec address.');
    expect(notice).toBeGreaterThan(-1);
    expect(composer.indexOf('Share my Aztec address')).toBeGreaterThan(notice);
    expect(composer).toContain('!!refusalFor(kind)');
    expect(agreements).toContain('deployRefusal({');
  });

  it('the composer refuses what the alpha contracts refuse, for escrows and streams; the baseline formula is kept for later', () => {
    expect(composer).toContain("quote.q.reason === 'above-alpha-maximum'");
    expect(composer).toContain('No protocol fee during the closed alpha.');
    expect(composer).toContain('(!!quote && !quote.q.ok)');
    // D-1..D-5, option A: the baseline arithmetic stays as the technical base for after the alpha.
    expect(baselineFee(2_000_000_000n, BASELINE_STREAM_SCHEDULE)).toEqual({ ok: false, reason: 'fee-exceeds-tx-cap' });
    expect(baselineFee(9_999n, BASELINE_ESCROW_SCHEDULE).ok).toBe(false);
    expect(baselineFee(1_000_000_000n, BASELINE_ESCROW_SCHEDULE)).toEqual({ ok: true, fee: BASELINE_TX_CAP, net: 995_000_000n });
    expect(baselineFee(1_000_000_001n, BASELINE_ESCROW_SCHEDULE)).toEqual({ ok: false, reason: 'fee-exceeds-tx-cap' });
  });
});

describe('scripts', () => {
  it('keyed deploy refuses Alpha, the shared gate and a class that is not current, before any wallet', () => {
    const src = read('scripts/aztec/deploy-keyed.ts');
    const alpha = src.indexOf('Deploy blocked: this node settles on Ethereum mainnet (Aztec Alpha).');
    const gate = src.indexOf('deployRefusal({');
    const current = src.indexOf('is not a current ${CONTRACT} class');
    const wallet = src.indexOf('EmbeddedWallet.create(');
    expect(alpha).toBeGreaterThan(-1);
    expect(gate).toBeGreaterThan(alpha);
    expect(current).toBeGreaterThan(gate);
    expect(wallet).toBeGreaterThan(current);
  });

  it('the end-to-end run refuses Alpha and a pending recompile', () => {
    const src = read('scripts/aztec/e2e-escrow-testnet.mts');
    expect(src).toContain('Refusing to run: this node settles on Ethereum mainnet (Aztec Alpha).');
    expect(src).toContain('deployRefusal({');
  });

  it('no route claims a working sponsor', () => {
    expect(fs.existsSync('app/api/test-aztec/route.ts')).toBe(false);
    expect(fs.existsSync('app/api/aztec/sponsor/route.ts')).toBe(false);
    expect(read('lib/security/retiredRoutes.ts')).toContain("'/api/aztec/sponsor'");
  });
});

describe('copy', () => {
  it('community screens never say end-to-end encrypted', () => {
    const join = read('app/join/[code]/page.tsx');
    expect(join).not.toMatch(/end-to-end encrypted community|encrypted private community/i);
  });

  it('payments copy names the public fee payer and no "no on-chain trail"', () => {
    expect(read('components/zk/ZkInvoiceModal.tsx')).not.toMatch(/without on-chain trail/i);
    expect(read('components/terminal/LedgerChatV2.tsx')).not.toContain('Payments settle privately on Aztec.');
  });
});
