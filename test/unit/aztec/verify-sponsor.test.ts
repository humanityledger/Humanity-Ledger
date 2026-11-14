import { describe, expect, it } from 'vitest';
// @ts-ignore plain ESM script without types
import { ALPHA, SPONSOR_MAX_FEE, evaluate } from '../../../scripts/aztec/verify-sponsor.mjs';
import { SPONSOR_MAX_FEE as CLIENT_CAP } from '@/lib/aztec/wallet/ledger-sponsor';
import { AZTEC_NETWORKS } from '@/lib/aztec/sequencer/networks';

const ADDR = '0x' + 'ab'.repeat(32);
const CLS = '0x' + 'cd'.repeat(32);
const good = () => ({
  server: { address: ADDR, enabled: true, signer: { xHi: '0x01', xLo: '0x02', yHi: '0x03', yLo: '0x04' }, limits: { perWallet: 3, perDay: 200 } },
  nodeInfo: { l1ChainId: 1, rollupVersion: 2070860440 },
  deployed: true,
  classId: { actual: CLS, expected: CLS.toUpperCase().replace('0X', '0x') },
  address: { expected: ADDR },
  balance: 500n * 10n ** 18n,
  record: ADDR,
});
const status = (f: any) => Object.fromEntries(evaluate(f).map((c: any) => [c.id, c.status]));

describe('scripts/aztec/verify-sponsor.mjs', () => {
  it('uses the client cap and the Alpha pins (no drift)', () => {
    expect(SPONSOR_MAX_FEE).toBe(CLIENT_CAP);
    expect(ALPHA).toEqual({ l1ChainId: AZTEC_NETWORKS.mainnet.l1ChainId, rollupVersion: AZTEC_NETWORKS.mainnet.rollupVersion, publicNodeRpc: AZTEC_NETWORKS.mainnet.publicNodeRpc });
  });

  it('passes a sponsor that is configured, deployed with the server key and cap, funded and recorded', () => {
    expect(evaluate(good()).every((c: any) => c.status === 'PASS')).toBe(true);
  });

  it('fails a sponsor deployed with another key or cap, or another class', () => {
    expect(status({ ...good(), address: { expected: '0x' + '11'.repeat(32) } })['key+cap']).toBe('FAIL');
    expect(status({ ...good(), classId: { actual: '0x' + '22'.repeat(32), expected: CLS } }).code).toBe('FAIL');
  });

  it('fails the wrong network, a missing key, no contract and an empty sponsor', () => {
    expect(status({ ...good(), nodeInfo: { l1ChainId: 11155111, rollupVersion: 679261766 } }).network).toBe('FAIL');
    expect(status({ ...good(), server: { ...good().server, signer: null } }).server).toBe('FAIL');
    expect(status({ ...good(), deployed: false }).deployed).toBe('FAIL');
    expect(status({ ...good(), balance: 0n }).funded).toBe('FAIL');
    expect(status({ ...good(), server: { error: 'HTTP 502' } }).server).toBe('FAIL');
  });

  it('warns on a low balance, limits at zero and an unrecorded deployment', () => {
    const s = status({ ...good(), balance: 39n * 10n ** 18n, record: null, server: { ...good().server, limits: { perWallet: 0, perDay: 200 } } });
    expect(s).toMatchObject({ funded: 'WARN', record: 'WARN', limits: 'WARN' });
    expect(status({ ...good(), record: '0x' + '33'.repeat(32) }).record).toBe('FAIL');
  });
});
