import { readFileSync } from 'node:fs';
import { buildMetrics, type Snapshot } from '@/lib/protocol/metrics';
import { recordedSponsor } from '@/lib/protocol/read';

/**
 * P-12. The sponsor's Fee Juice balance slot is captured from the SDK's own getFeeJuiceBalance
 * (scripts/aztec/fee-juice-slot.mjs), so neither the map slot, the hash nor the order of the
 * node_getPublicStorageAt parameters is assumed. The vector below is the HLC token address of
 * deployments/aztec-mainnet.json used as an owner.
 */
const HLC = '0x2cd0f3775d129210ecf2165e338e1b6b708f2243ac1b30feb0ac49875366e55d';
const OTHER = '0x01c7e18f1751ea94e3d63aad2d0b7221642ad299454f769103f0d32364ce549b';
const HEX32 = /^0x[0-9a-f]{64}$/;

async function capture(owner: string) {
  const mod = await import('../../../scripts/aztec/fee-juice-slot.mjs');
  return (mod.captureFeeJuiceRead as (o: string) => Promise<{ block: string; feeJuiceContract: string; feeJuiceBalanceSlot: string }>)(owner);
}

describe('sponsor Fee Juice balance slot', () => {
  it('is captured from the SDK, in the parameter order /protocol sends (block, contract, slot)', async () => {
    const r = await capture(HLC);
    console.info('[P-12 vector] owner', HLC, 'feeJuiceContract', r.feeJuiceContract, 'slot', r.feeJuiceBalanceSlot, 'block', r.block);
    expect(r.feeJuiceContract.toLowerCase()).toMatch(HEX32);
    expect(r.feeJuiceBalanceSlot.toLowerCase()).toMatch(HEX32);
    // The SDK reads the latest state; the dashboard pins a concrete block instead, same position.
    expect(r.block === 'latest' || /^\d+$/.test(r.block)).toBe(true);
  });

  it('is deterministic per owner and differs between owners', async () => {
    const a = await capture(HLC);
    const b = await capture(HLC);
    const c = await capture(OTHER);
    expect(a.feeJuiceBalanceSlot).toBe(b.feeJuiceBalanceSlot);
    expect(c.feeJuiceBalanceSlot).not.toBe(a.feeJuiceBalanceSlot);
    expect(c.feeJuiceContract).toBe(a.feeJuiceContract);
  });

  it('a sponsor recorded in deployments/aztec-mainnet.json has the slot the SDK computes', async () => {
    const record = JSON.parse(readFileSync('deployments/aztec-mainnet.json', 'utf8'));
    const sp = recordedSponsor(record.sponsoredFpc);
    if (!sp) {
      expect(record.sponsoredFpc).toBeNull(); // not deployed yet
      return;
    }
    const r = await capture(sp.address);
    expect(sp.feeJuiceBalanceSlot).toBe(r.feeJuiceBalanceSlot.toLowerCase());
    expect(sp.feeJuiceContract).toBe(r.feeJuiceContract.toLowerCase());
  });
});

describe('sponsor pool metric', () => {
  const base: Snapshot = {
    nodeHost: 'aztec-mainnet.drpc.org',
    node: { ok: true, blockNumber: 40000, nodeVersion: '6.0.0', l1ChainId: 1, rollupVersion: 2070860440, drift: [] },
    record: { contracts: [], tokens: [], audit: false, sponsoredFpc: null },
    sponsor: { configuredAddress: null, requests24h: null },
    pins: { l1ChainId: 1, rollup: '0x', feeJuicePortal: '0x', nodeVersion: '6.0.0', rollupVersion: 2070860440 },
  };
  const pool = (s: Snapshot) => buildMetrics(s).find((m) => m.id === 'sponsor-pool')!;
  const sponsor = { address: OTHER, feeJuiceContract: '0x' + '0'.repeat(63) + '5', feeJuiceBalanceSlot: '0x' + '1'.repeat(64) };

  it('not deployed: no value, never 0', () => {
    expect(pool(base)).toMatchObject({ status: 'not-deployed' });
    expect(pool(base).value).toBeUndefined();
  });

  it('read: exact 18-decimal bigint formatting', () => {
    const m = pool({ ...base, record: { ...base.record!, sponsoredFpc: sponsor }, sponsor: { ...base.sponsor, balance: 28_123_456_789_000_000_000n } });
    expect(m).toMatchObject({ status: 'live', value: '28.1234 Fee Juice', raw: '28123456789000000000' });
  });

  it('recorded but not read: no value', () => {
    const m = pool({ ...base, record: { ...base.record!, sponsoredFpc: sponsor }, sponsor: { ...base.sponsor, balance: { error: 'the node did not answer' } } });
    expect(m.status).toBe('unavailable');
    expect(m.value).toBeUndefined();
  });

  it('parses the record: null, a bare address, or the full entry', () => {
    expect(recordedSponsor(null)).toBeNull();
    expect(recordedSponsor('nope')).toBeNull();
    expect(recordedSponsor(OTHER)).toEqual({ address: OTHER, feeJuiceContract: null, feeJuiceBalanceSlot: null });
    expect(recordedSponsor(sponsor)).toEqual(sponsor);
  });
});
