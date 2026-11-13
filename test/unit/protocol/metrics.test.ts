import { readFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
import {
  buildMetrics,
  canonicalJson,
  parseField,
  parseSafeInt,
  storageSlot,
  type Metric,
  type Snapshot,
} from '@/lib/protocol/metrics';

const HLC = {
  symbol: 'HLC',
  decimals: 6,
  address: '0x2cd0f3775d129210ecf2165e338e1b6b708f2243ac1b30feb0ac49875366e55d',
  deployTx: '0x0dfc7146b9f807432d06bccf43d3cea88e849455f8f62372ea2b93d41be29136',
  deployBlock: 24544,
};

function snapshot(over: Partial<Snapshot> = {}): Snapshot {
  return {
    nodeHost: 'aztec-mainnet.drpc.org',
    node: { ok: true, blockNumber: 30000, nodeVersion: '6.0.0', l1ChainId: 1, rollupVersion: 2070860440, drift: [] },
    record: { contracts: [], tokens: [HLC], audit: false, sponsoredFpc: null },
    token: { totalSupply: 1_000_000_000_000_000n, admin: 0x01c7e18f1751ea94e3d63aad2d0b7221642ad299454f769103f0d32364ce549bn },
    sponsor: { configuredAddress: null, requests24h: null },
    pins: { l1ChainId: 1, rollup: '0xE37A', feeJuicePortal: '0x5343', nodeVersion: '6.0.0', rollupVersion: 2070860440 },
    ...over,
  };
}

const byId = (ms: Metric[], id: string) => {
  const m = ms.find((x) => x.id === id);
  if (!m) throw new Error(`missing metric ${id}`);
  return m;
};

describe('storageSlot', () => {
  it('reads slots from a raw nargo artifact (our own escrow)', () => {
    const artifact = JSON.parse(readFileSync('contracts/aztec/escrow/target/private_escrow-PrivateEscrow.json', 'utf8'));
    expect(storageSlot(artifact, 'PrivateEscrow', 'claims')).toBe(1n);
    expect(storageSlot(artifact, 'PrivateEscrow', 'refunds')).toBe(2n);
    expect(storageSlot(artifact, 'PrivateEscrow', 'nope')).toBeUndefined();
    expect(storageSlot(artifact, 'OtherContract', 'claims')).toBeUndefined();
  });
  it('reads the parsed form and refuses junk', () => {
    expect(storageSlot({ storageLayout: { total_supply: { slot: '0x04' } } }, 'Token', 'total_supply')).toBe(4n);
    expect(storageSlot({ storageLayout: { total_supply: { slot: '0x00' } } }, 'Token', 'total_supply')).toBeUndefined();
    expect(storageSlot(null, 'Token', 'total_supply')).toBeUndefined();
    expect(storageSlot({ outputs: { globals: { storage: 'x' } } }, 'Token', 'total_supply')).toBeUndefined();
  });
});

describe('parsers', () => {
  it('accepts only field elements', () => {
    expect(parseField('0x00')).toBe(0n);
    expect(parseField('0x' + 'f'.repeat(64))).toBeUndefined(); // above the BN254 modulus
    expect(parseField(12)).toBeUndefined();
    expect(parseField('12')).toBeUndefined();
  });
  it('accepts only safe non-negative integers', () => {
    expect(parseSafeInt(5)).toBe(5);
    expect(parseSafeInt('0x10')).toBe(16);
    expect(parseSafeInt(-1)).toBeUndefined();
    expect(parseSafeInt(1.5)).toBeUndefined();
    expect(parseSafeInt('9007199254740993')).toBeUndefined();
  });
});

describe('buildMetrics', () => {
  it('states the mainnet record as it is: no escrow, no fees, private volume not measurable', () => {
    const ms = buildMetrics(snapshot());
    expect(byId(ms, 'escrows')).toMatchObject({ status: 'not-deployed', value: '0' });
    expect(byId(ms, 'protocol-fees')).toMatchObject({ status: 'not-deployed' });
    expect(byId(ms, 'protocol-fees').value).toBeUndefined();
    expect(byId(ms, 'protocol-fees').detail).toMatch(/Phase 0 pending/);
    expect(byId(ms, 'shielded-volume')).toMatchObject({ status: 'not-measurable' });
    expect(byId(ms, 'shielded-volume').value).toBeUndefined();
    expect(byId(ms, 'sponsor-pool')).toMatchObject({ status: 'not-deployed' });
    expect(byId(ms, 'audit')).toMatchObject({ status: 'not-deployed', value: 'None (Alpha)' });
    expect(byId(ms, 'contracts')).toMatchObject({ status: 'live', value: '1' });
  });

  it('formats the supply exactly from bigint base units', () => {
    const ms = buildMetrics(snapshot({ token: { totalSupply: 1_234_567_890_123_456n, admin: 0n } }));
    expect(byId(ms, 'hlc-supply')).toMatchObject({ status: 'live', value: '1,234,567,890.123456 HLC', raw: '1234567890123456' });
    expect(byId(ms, 'hlc-admin')).toMatchObject({ status: 'live', value: 'Zero address' });
  });

  it('a live admin means the supply is not fixed', () => {
    const m = byId(buildMetrics(snapshot()), 'hlc-admin');
    expect(m.status).toBe('live');
    expect(m.detail).toMatch(/not fixed/);
  });

  it('fails closed: a node that does not answer gives no figures, never zeros or old values', () => {
    const ms = buildMetrics(
      snapshot({
        node: { ok: false, error: 'node_getBlockNumber timed out' },
        token: { totalSupply: { error: 'the node did not answer' }, admin: { error: 'the node did not answer' } },
      }),
    );
    expect(byId(ms, 'aztec-node')).toMatchObject({ status: 'unavailable', value: 'Node not responding' });
    expect(byId(ms, 'aztec-node').raw).toBeUndefined();
    expect(byId(ms, 'l1-pins').status).toBe('unavailable');
    expect(byId(ms, 'hlc-supply')).toMatchObject({ status: 'unavailable' });
    expect(byId(ms, 'hlc-supply').value).toBeUndefined();
    expect(byId(ms, 'hlc-admin').value).toBeUndefined();
  });

  it('a node that differs from the pins is a mismatch', () => {
    const ms = buildMetrics(
      snapshot({ node: { ok: true, blockNumber: 1, nodeVersion: '6.0.1', l1ChainId: 1, rollupVersion: 1, drift: ['rollupVersion 1 (expected 2070860440)'] } }),
    );
    expect(byId(ms, 'aztec-node').status).toBe('mismatch');
    expect(byId(ms, 'l1-pins').status).toBe('mismatch');
  });

  it('an invalid deployment record authorises nothing and shows no count', () => {
    const ms = buildMetrics(snapshot({ record: undefined }));
    expect(byId(ms, 'contracts')).toMatchObject({ status: 'unavailable' });
    expect(byId(ms, 'contracts').value).toBeUndefined();
    expect(byId(ms, 'hlc-supply').status).toBe('not-deployed');
  });

  it('a sponsor counter that cannot be read is not shown as 0', () => {
    const ms = buildMetrics(snapshot({ sponsor: { configuredAddress: '0x' + '1'.repeat(64), requests24h: null } }));
    expect(byId(ms, 'sponsor-requests')).toMatchObject({ status: 'unavailable' });
    expect(byId(ms, 'sponsor-requests').value).toBeUndefined();
    // Configured on the server but not recorded: still not deployed.
    expect(byId(ms, 'sponsor-pool').status).toBe('not-deployed');
  });
});

describe('canonicalJson', () => {
  it('sorts keys at every level, drops undefined and writes bigint as decimal', () => {
    expect(canonicalJson({ b: 1, a: { d: 2n, c: undefined, b: [{ z: 1, y: 2 }] } })).toBe('{"a":{"b":[{"y":2,"z":1}],"d":"2"},"b":1}');
  });
  it('the same content always hashes the same', () => {
    const h = (v: unknown) => createHash('sha256').update(canonicalJson(v)).digest('hex');
    expect(h({ x: 1, y: [2, 3] })).toBe(h({ y: [2, 3], x: 1 }));
  });
});
