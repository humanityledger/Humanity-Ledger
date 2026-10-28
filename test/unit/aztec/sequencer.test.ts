import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

// L1 reads are mocked: these tests cover our logic, not Ethereum.
vi.mock('@/lib/aztec/sequencer/l1', () => ({
  l1Client: () => ({}),
  readRollupState: vi.fn(async () => ({
    canonicalRollup: '0xE37A2663Cc9c119BA41572C40fAb0bbb23a5402f', isCanonical: true, version: '2070860440',
    currentEpoch: 647, currentSlot: 20721, slotDurationSeconds: 72, epochDurationSlots: 32, targetCommitteeSize: 48,
    activeAttesterCount: 3205, entryQueueLength: 0, activationThreshold: '200000000000000000000000',
    ejectionThreshold: '100000000000000000000000', exitDelaySeconds: 345600, pendingCheckpoint: 1189, provenCheckpoint: 1173,
    currentProposer: '0x1111111111111111111111111111111111111111', committee: ['0x2222222222222222222222222222222222222222'],
    genesisTime: 1791612059, stakingAsset: { address: '0xA27EC0006e59f245217Ff08CD52A7E8b169E62D2', symbol: 'AZTEC', decimals: 18 },
  })),
  readAttesterView: vi.fn(async (_c: unknown, _n: unknown, a: string) => ({
    status: a.toLowerCase().endsWith('2222') ? 1 : 0,
    effectiveBalance: a.toLowerCase().endsWith('2222') ? '200000000000000000000000' : '0',
    withdrawer: '0x0000000000000000000000000000000000000000',
    exit: { exists: false, amount: '0', exitableAt: 0, recipientOrWithdrawer: '0x0000000000000000000000000000000000000000', isRecipient: false },
  })),
  readPublisher: vi.fn(async (_c: unknown, address: string) => ({ address, balanceWei: '5000000000000000', balanceEth: 0.005, low: true })),
  readSequencerRewards: vi.fn(async () => '0'),
}));

import { AZTEC_NETWORKS, attesterStatusName, checkNetworkDrift, resolveNetworkId } from '@/lib/aztec/sequencer/networks';
import { buildAlerts, buildOverview, loadSequencerConfig, summarizeBlock, V6_CANONICAL_AT_MS } from '@/lib/aztec/sequencer/client';
import { aztecRpc, AztecRpcError, resetBreakers } from '@/lib/aztec/sequencer/rpc';

const A1 = '0x2222222222222222222222222222222222222222';
const A2 = '0x3333333333333333333333333333333333333333';

// A block exactly as an Aztec 6.0.0 node returns it (trimmed).
const RAW_BLOCK = {
  header: {
    lastArchive: { root: '0x11', nextAvailableLeafIndex: 1543 },
    state: {
      l1ToL2MessageTree: { root: '0x2a', nextAvailableLeafIndex: 235 },
      partial: {
        noteHashTree: { root: '0x09', nextAvailableLeafIndex: 31488 },
        nullifierTree: { root: '0x0b', nextAvailableLeafIndex: 31616 },
        publicDataTree: { root: '0x08', nextAvailableLeafIndex: 195 },
      },
    },
    globalVariables: {
      blockNumber: 1543, slotNumber: '0x00000000000000000000000000000000000000000000000000000000000050f2', timestamp: '1793104043',
      coinbase: '0xfa7116a4ad0289bfa6549f675a117f2dd05eaed8', gasFees: { feePerDaGas: '0', feePerL2Gas: '1824086380784' },
    },
    totalFees: '0x00000000000000000000000000000000000000000000000010af6b035384b7d0',
    totalManaUsed: '0x00000000000000000000000000000000000000000000000000000000000a0eb3',
  },
  archive: { root: '0x1beb', nextAvailableLeafIndex: 1544 },
  hash: '0x1b68', checkpointNumber: 1190, indexWithinCheckpoint: 0, number: 1543,
};

const NODE_INFO = {
  nodeVersion: '6.0.0', l1ChainId: 1, rollupVersion: 2070860440, enr: 'enr:-x',
  l1ContractAddresses: { rollupAddress: '0xe37a2663cc9c119ba41572c40fab0bbb23a5402f' },
};
const TIPS = {
  proposed: { number: 1543, hash: '0x1' },
  checkpointed: { block: { number: 1542, hash: '0x2' }, checkpoint: { number: 1189, hash: '0x3' } },
  proven: { block: { number: 1522, hash: '0x4' }, checkpoint: { number: 1173, hash: '0x5' } },
  finalized: { block: { number: 1522, hash: '0x4' }, checkpoint: { number: 1173, hash: '0x5' } },
};

type Handler = (method: string, params: unknown[], url: string) => unknown;
function mockFetch(handler: Handler, statusOk: (url: string) => boolean = () => true) {
  const f = vi.fn(async (url: string, init?: RequestInit) => {
    if (url.endsWith('/status')) return new Response('{}', { status: statusOk(url) ? 200 : 503 });
    const body = JSON.parse(String(init?.body ?? '{}'));
    try {
      const result = handler(body.method, body.params ?? [], url);
      return new Response(JSON.stringify({ jsonrpc: '2.0', id: body.id, result }), { status: 200 });
    } catch (e: any) {
      if (e?.network) throw new TypeError('fetch failed');
      return new Response(JSON.stringify({ jsonrpc: '2.0', id: body.id, error: { code: -32601, message: e.message } }), { status: 400 });
    }
  });
  vi.stubGlobal('fetch', f);
  return f;
}

const publicNode: Handler = (method, params) => {
  switch (method) {
    case 'aztec_getNodeInfo': return NODE_INFO;
    case 'aztec_getChainTips': return TIPS;
    case 'aztec_getPendingTxCount': return 0;
    case 'aztec_getBlock': return { ...RAW_BLOCK, number: params[0] };
    case 'aztec_getValidatorStats':
      return { validator: { address: params[0], totalSlots: 3, missedProposals: { currentStreak: 0, count: 0, total: 0 }, missedAttestations: { currentStreak: 0, count: 0, total: 3 }, history: [] } };
    default: throw new Error('method is not available');
  }
};

beforeEach(() => { resetBreakers(); });
afterEach(() => { vi.unstubAllGlobals(); vi.clearAllMocks(); });

describe('networks', () => {
  it('pins the v6 values verified on chain', () => {
    expect(AZTEC_NETWORKS.mainnet.rollupVersion).toBe(2070860440);
    expect(AZTEC_NETWORKS.testnet.rollupVersion).toBe(679261766);
    expect(AZTEC_NETWORKS.mainnet.dockerImage).toBe('azteclabs/aztec:6.0.0');
    expect(AZTEC_NETWORKS.mainnet.l1.gse).toBe('0xa92ecFD0E70c9cd5E5cd76c50Af0F7Da93567a4f');
  });
  it('maps status codes and network names', () => {
    expect([0, 1, 2, 3, 9].map(attesterStatusName)).toEqual(['NONE', 'VALIDATING', 'ZOMBIE', 'EXITING', 'UNKNOWN']);
    expect(resolveNetworkId('sepolia')).toBe('testnet');
    expect(resolveNetworkId(undefined)).toBe('mainnet');
  });
  it('reports drift when the node runs another rollup', () => {
    expect(checkNetworkDrift(AZTEC_NETWORKS.mainnet, NODE_INFO)).toEqual([]);
    const d = checkNetworkDrift(AZTEC_NETWORKS.mainnet, { ...NODE_INFO, nodeVersion: '5.2.0', rollupVersion: 1 });
    expect(d.map(x => x.field).sort()).toEqual(['nodeVersion', 'rollupVersion']);
  });
});

describe('config', () => {
  it('parses addresses, drops junk and defaults publishers to attesters', () => {
    const cfg = loadSequencerConfig({
      AZTEC_NETWORK: 'testnet',
      AZTEC_ATTESTER_ADDRESSES: `${A1}, nope ,${A2},${A1}`,
      AZTEC_NODE_URL: 'javascript:alert(1)',
    });
    expect(cfg.network).toBe('testnet');
    expect(cfg.attesters).toHaveLength(2);
    expect(cfg.publishers).toEqual(cfg.attesters);
    expect(cfg.coinbase).toBe(cfg.attesters[0]);
    expect(cfg.ownNodeUrl).toBeNull();
    expect(cfg.referenceNodeUrl).toBe(AZTEC_NETWORKS.testnet.publicNodeRpc);
  });
});

describe('summarizeBlock', () => {
  it('reads a real v6 block', () => {
    const b = summarizeBlock(RAW_BLOCK);
    expect(b.number).toBe(1543);
    expect(b.slot).toBe(0x50f2);
    expect(b.timestamp).toBe(1793104043);
    expect(b.totalManaUsed).toBe(String(0x0a0eb3));
    expect(b.checkpointNumber).toBe(1190);
    expect(b.noteHashLeaves).toBe(31488);
  });
});

describe('rpc transport', () => {
  it('does not retry or trip the breaker on JSON-RPC errors', async () => {
    const f = mockFetch(() => { throw new Error('method is not available'); });
    for (let i = 0; i < 6; i++) await expect(aztecRpc('http://n', 'aztec_x')).rejects.toBeInstanceOf(AztecRpcError);
    expect(f).toHaveBeenCalledTimes(6);
  });
  it('opens the breaker after repeated network failures', async () => {
    const f = mockFetch(() => { throw Object.assign(new Error('down'), { network: true }); });
    for (let i = 0; i < 5; i++) await expect(aztecRpc('http://dead', 'aztec_getBlockNumber')).rejects.toThrow();
    const calls = f.mock.calls.length;
    await expect(aztecRpc('http://dead', 'aztec_getBlockNumber')).rejects.toThrow(/unreachable/);
    expect(f.mock.calls.length).toBe(calls);
  });
});

describe('overview', () => {
  it('reads the network and flags unstaked attesters and low publishers', async () => {
    mockFetch(publicNode);
    const cfg = loadSequencerConfig({ AZTEC_NETWORK: 'mainnet', AZTEC_ATTESTER_ADDRESSES: `${A1},${A2}` });
    const o = await buildOverview(cfg);
    expect(o.reference.tips.ok && o.reference.tips.value.proposed.number).toBe(1543);
    expect(o.reference.recentBlocks.ok && o.reference.recentBlocks.value.map(b => b.number)).toEqual([1543, 1542, 1541, 1540, 1539, 1538, 1537, 1536]);
    expect(o.attesters.ok && o.attesters.value.map(a => a.status)).toEqual(['VALIDATING', 'NONE']);
    expect(o.attesters.ok && o.attesters.value[0].inCurrentCommittee).toBe(true);
    const codes = o.alerts.map(a => a.code);
    expect(codes).toContain('ATTESTER_NOT_STAKED');
    expect(codes).toContain('PUBLISHER_LOW');
    expect(codes).toContain('NODE_NOT_CONFIGURED');
    expect(o.alerts[0].level).toBe('critical');
  });

  it('detects v6 standby: /status answers but the JSON-RPC does not', async () => {
    mockFetch((m, p, url) => {
      if (url.startsWith('http://own')) throw Object.assign(new Error('down'), { network: true });
      return publicNode(m, p, url);
    });
    const cfg = loadSequencerConfig({ AZTEC_NETWORK: 'mainnet', AZTEC_NODE_URL: 'http://own:8080' });
    const o = await buildOverview(cfg);
    expect(o.ownNode.mode).toBe('STANDBY');
    expect(o.alerts.map(a => a.code)).toContain('NODE_STANDBY');
  });

  it('marks a lagging node as syncing and a wrong version as critical', async () => {
    mockFetch((m, p, url) => {
      if (url.startsWith('http://own')) {
        if (m === 'aztec_getNodeInfo') return { ...NODE_INFO, nodeVersion: '5.2.0' };
        if (m === 'aztec_getChainTips') return { ...TIPS, proposed: { number: 1500, hash: '0x' } };
        if (m === 'aztec_isReady') return true;
        if (m === 'aztec_getWorldStateSyncStatus') return { latestBlockNumber: 1500, latestBlockHash: '0x', finalizedBlockNumber: 1490, oldestHistoricBlockNumber: 1, treesAreSynched: true };
        if (m === 'aztec_getPendingTxCount') return 0;
      }
      return publicNode(m, p, url);
    });
    const o = await buildOverview(loadSequencerConfig({ AZTEC_NODE_URL: 'http://own:8080' }));
    expect(o.ownNode.mode).toBe('SYNCING');
    expect(o.ownNode.lagBlocks).toBe(43);
    expect(o.alerts.find(a => a.code === 'NODE_VERSION_MISMATCH')?.level).toBe('critical');
  });

  it('never invents data when the network is unreachable', async () => {
    mockFetch(() => { throw Object.assign(new Error('down'), { network: true }); });
    const o = await buildOverview(loadSequencerConfig({}));
    expect(o.reference.tips.ok).toBe(false);
    expect(o.reference.recentBlocks.ok).toBe(false);
  });
});

describe('alerts', () => {
  it('announces the slashing grace period only inside it', () => {
    const base: any = {
      network: { l1: { rollup: AZTEC_NETWORKS.mainnet.l1.rollup } },
      reference: { drift: [] },
      rollup: { ok: false, error: 'x' },
      ownNode: { mode: 'READY', drift: [], lagBlocks: 0 },
      attesters: { ok: true, value: [] },
      publishers: { ok: true, value: [] },
    };
    const cfg = loadSequencerConfig({ AZTEC_ATTESTER_ADDRESSES: A1 });
    expect(buildAlerts(base, cfg, V6_CANONICAL_AT_MS + 1000).map(a => a.code)).toContain('SLASHING_GRACE');
    expect(buildAlerts(base, cfg, V6_CANONICAL_AT_MS + 8 * 86400_000).map(a => a.code)).not.toContain('SLASHING_GRACE');
  });
});
