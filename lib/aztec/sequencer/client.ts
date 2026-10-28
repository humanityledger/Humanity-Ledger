/**
 * Aztec v6 sequencer operations client (server only).
 *
 * Reads, never writes:
 *   - the Aztec node JSON-RPC (`aztec_*`, the same API `createAztecNodeClient`
 *     speaks) on a public reference node and, when configured, our own node;
 *   - the Aztec L1 contracts on Ethereum (Registry, Rollup) for stake,
 *     committee, status and rewards of our attesters;
 *   - the ETH balance of our publisher accounts.
 *
 * Configuration (server env, none of it public):
 *   AZTEC_NETWORK                mainnet | testnet            (default mainnet)
 *   AZTEC_NODE_URL               our node's API, e.g. http://aztec-sequencer:8080
 *   AZTEC_REFERENCE_NODE_URL     overrides the public node used for network reads
 *   AZTEC_L1_RPC_URL             Ethereum RPC for contract reads (default: public node)
 *   AZTEC_ATTESTER_ADDRESSES     comma-separated attester (sequencer) addresses
 *   AZTEC_PUBLISHER_ADDRESSES    comma-separated publisher addresses (default: attesters)
 *   AZTEC_COINBASE_ADDRESS       where L1 rewards accrue (default: first attester)
 *
 * Private keys never come anywhere near this module: they live in the node's
 * keystore (KEY_STORE_DIRECTORY), see docker/aztec-sequencer.
 */

import { isAddress, getAddress } from 'viem';
import { AZTEC_NETWORKS, SEQUENCER_REQUIREMENTS, attesterStatusName, checkNetworkDrift, resolveNetworkId, type AztecNetworkConfig } from './networks';
import { aztecRpc, nodeStatusOk } from './rpc';
import { l1Client, readAttesterView, readPublisher, readRollupState, readSequencerRewards } from './l1';
import {
  fail, ok,
  type AttesterState, type ChainTips, type L2BlockSummary, type NodeInfo, type OperatorAlert, type OwnNodeState,
  type Reading, type RollupState, type SequencerConfig, type SequencerOverview, type SingleValidatorStats, type WorldStateSyncStatus,
} from './types';

/** v6 became canonical on mainnet and testnet at this instant (release notes). */
export const V6_CANONICAL_AT_MS = Date.UTC(2026, 9, 26, 8, 0, 0);

const MAX_ADDRESSES = 64;
const RECENT_BLOCKS = 8;
const SYNC_LAG_BLOCKS = 4;

function parseAddressList(raw: string | undefined): `0x${string}`[] {
  if (!raw) return [];
  const out = new Set<`0x${string}`>();
  for (const part of raw.split(/[\s,]+/)) {
    const v = part.trim();
    if (v && isAddress(v)) out.add(getAddress(v));
    if (out.size >= MAX_ADDRESSES) break;
  }
  return [...out];
}

function cleanUrl(raw: string | undefined): string | null {
  if (!raw) return null;
  try {
    const u = new URL(raw.trim());
    if (u.protocol !== 'http:' && u.protocol !== 'https:') return null;
    return u.toString().replace(/\/+$/, '');
  } catch {
    return null;
  }
}

export function loadSequencerConfig(env: Record<string, string | undefined> = process.env): SequencerConfig {
  const network = resolveNetworkId(env.AZTEC_NETWORK);
  const net = AZTEC_NETWORKS[network];
  const attesters = parseAddressList(env.AZTEC_ATTESTER_ADDRESSES);
  const publishers = parseAddressList(env.AZTEC_PUBLISHER_ADDRESSES);
  const coinbaseRaw = env.AZTEC_COINBASE_ADDRESS?.trim();
  return {
    network,
    ownNodeUrl: cleanUrl(env.AZTEC_NODE_URL),
    referenceNodeUrl: cleanUrl(env.AZTEC_REFERENCE_NODE_URL) ?? net.publicNodeRpc,
    l1RpcUrl: cleanUrl(env.AZTEC_L1_RPC_URL) ?? net.defaultL1Rpc,
    attesters,
    // The keystore's publisher defaults to the attester key, so watch those.
    publishers: publishers.length ? publishers : attesters,
    coinbase: coinbaseRaw && isAddress(coinbaseRaw) ? getAddress(coinbaseRaw) : attesters[0] ?? null,
    timeoutMs: 8_000,
  };
}

// ── Node reads ────────────────────────────────────────────────────────────

const hexToDec = (v: unknown): string => {
  if (typeof v === 'number') return String(v);
  if (typeof v !== 'string' || v === '') return '0';
  try { return BigInt(v).toString(); } catch { return '0'; }
};

export function summarizeBlock(raw: any): L2BlockSummary {
  const h = raw?.header ?? {};
  const gv = h.globalVariables ?? {};
  const partial = h.state?.partial ?? {};
  return {
    number: Number(raw?.number ?? gv.blockNumber ?? 0),
    hash: String(raw?.hash ?? ''),
    checkpointNumber: Number(raw?.checkpointNumber ?? 0),
    slot: Number(hexToDec(gv.slotNumber)),
    timestamp: Number(hexToDec(gv.timestamp)),
    coinbase: String(gv.coinbase ?? ''),
    totalFees: hexToDec(h.totalFees),
    totalManaUsed: hexToDec(h.totalManaUsed),
    feePerL2Gas: hexToDec(gv.gasFees?.feePerL2Gas),
    archiveRoot: String(raw?.archive?.root ?? ''),
    noteHashTreeRoot: partial.noteHashTree?.root,
    nullifierTreeRoot: partial.nullifierTree?.root,
    publicDataTreeRoot: partial.publicDataTree?.root,
    l1ToL2MessageTreeRoot: h.state?.l1ToL2MessageTree?.root,
    noteHashLeaves: partial.noteHashTree?.nextAvailableLeafIndex,
    nullifierLeaves: partial.nullifierTree?.nextAvailableLeafIndex,
  };
}

async function read<T>(p: Promise<T>): Promise<Reading<T>> {
  try { return ok(await p); } catch (e) { return fail<T>(e); }
}

export async function readRecentBlocks(url: string, tip: number, count = RECENT_BLOCKS, timeoutMs = 8_000): Promise<L2BlockSummary[]> {
  const nums = Array.from({ length: Math.min(count, Math.max(0, tip)) }, (_, i) => tip - i).filter(n => n >= 1);
  const settled = await Promise.allSettled(nums.map(n => aztecRpc<any>(url, 'aztec_getBlock', [n], timeoutMs)));
  return settled.flatMap(s => (s.status === 'fulfilled' && s.value ? [summarizeBlock(s.value)] : []));
}

async function readOwnNode(cfg: SequencerConfig, net: AztecNetworkConfig, referenceTip: number | null): Promise<OwnNodeState> {
  const url = cfg.ownNodeUrl;
  const base: OwnNodeState = {
    url, mode: 'NOT_CONFIGURED', statusOk: false, ready: null, info: null, tips: null,
    worldState: null, pendingTxCount: null, lagBlocks: null, drift: [],
  };
  if (!url) return base;

  const statusOk = await nodeStatusOk(url);
  const [info, tips, ready, world, pending] = await Promise.all([
    read(aztecRpc<NodeInfo>(url, 'aztec_getNodeInfo', [], cfg.timeoutMs)),
    read(aztecRpc<ChainTips>(url, 'aztec_getChainTips', [], cfg.timeoutMs)),
    read(aztecRpc<boolean>(url, 'aztec_isReady', [], cfg.timeoutMs)),
    read(aztecRpc<WorldStateSyncStatus>(url, 'aztec_getWorldStateSyncStatus', [], cfg.timeoutMs)),
    read(aztecRpc<number>(url, 'aztec_getPendingTxCount', [], cfg.timeoutMs)),
  ]);

  const state: OwnNodeState = {
    ...base,
    statusOk,
    ready: ready.ok ? ready.value : null,
    info: info.ok ? info.value : null,
    tips: tips.ok ? tips.value : null,
    worldState: world.ok ? world.value : null,
    pendingTxCount: pending.ok ? pending.value : null,
  };
  state.drift = state.info ? checkNetworkDrift(net, state.info) : [];
  if (state.tips && referenceTip !== null) state.lagBlocks = Math.max(0, referenceTip - state.tips.proposed.number);

  if (!statusOk && !info.ok) {
    state.mode = 'DOWN';
    state.error = info.ok ? undefined : info.error;
  } else if (statusOk && !info.ok) {
    // v6 standby: only the health endpoint answers until the canonical rollup matches.
    state.mode = 'STANDBY';
  } else if (state.ready === false || (state.worldState && !state.worldState.treesAreSynched) || (state.lagBlocks ?? 0) > SYNC_LAG_BLOCKS) {
    state.mode = 'SYNCING';
  } else {
    state.mode = 'READY';
  }
  return state;
}

// ── Attesters ─────────────────────────────────────────────────────────────

async function readAttesters(cfg: SequencerConfig, net: AztecNetworkConfig, rollup: RollupState | null, statsNodeUrl: string): Promise<AttesterState[]> {
  const client = l1Client(net, cfg.l1RpcUrl);
  const committee = new Set((rollup?.committee ?? []).map(a => a.toLowerCase()));
  const proposer = rollup?.currentProposer?.toLowerCase();
  return Promise.all(cfg.attesters.map(async (address): Promise<AttesterState> => {
    const [viewR, stats] = await Promise.all([
      read(readAttesterView(client, net, address)),
      read(aztecRpc<SingleValidatorStats>(statsNodeUrl, 'aztec_getValidatorStats', [address.toLowerCase()], cfg.timeoutMs)),
    ]);
    // One unreadable attester must not hide the others.
    if (!viewR.ok) {
      return {
        address, status: 'UNKNOWN', effectiveBalance: '0', withdrawer: '', error: viewR.error,
        exit: { exists: false, amount: '0', exitableAt: 0, recipientOrWithdrawer: '', isRecipient: false },
        inCurrentCommittee: committee.has(address.toLowerCase()), isCurrentProposer: proposer === address.toLowerCase(), stats,
      };
    }
    const view = viewR.value;
    return {
      address,
      status: attesterStatusName(view.status),
      effectiveBalance: view.effectiveBalance,
      withdrawer: view.withdrawer,
      exit: view.exit,
      inCurrentCommittee: committee.has(address.toLowerCase()),
      isCurrentProposer: proposer === address.toLowerCase(),
      stats,
    };
  }));
}

// ── Alerts ────────────────────────────────────────────────────────────────

export function buildAlerts(o: Omit<SequencerOverview, 'alerts'>, cfg: SequencerConfig, now = Date.now()): OperatorAlert[] {
  const alerts: OperatorAlert[] = [];
  const add = (level: OperatorAlert['level'], code: string, message: string) => alerts.push({ level, code, message });

  if (o.reference.drift.length) {
    add('critical', 'NETWORK_CHANGED', `The network no longer matches this build (${o.reference.drift.map(d => `${d.field} ${d.actual}, expected ${d.expected}`).join('; ')}). A new rollup version may be live: update lib/aztec/sequencer/networks.ts and the node image.`);
  }
  if (o.rollup.ok && !o.rollup.value.isCanonical) {
    add('critical', 'ROLLUP_NOT_CANONICAL', `The Registry's canonical rollup is ${o.rollup.value.canonicalRollup}, not ${o.network.l1.rollup}. Sequencers on the old rollup earn nothing.`);
  }
  if (!o.rollup.ok) add('warning', 'L1_UNREADABLE', `Could not read the Rollup contract on L1: ${o.rollup.error}`);

  const n = o.ownNode;
  if (n.mode === 'NOT_CONFIGURED') add('info', 'NODE_NOT_CONFIGURED', 'Set AZTEC_NODE_URL to the API of your sequencer node (port 8080) to monitor it.');
  if (n.mode === 'DOWN') add('critical', 'NODE_DOWN', `Your node does not answer at ${n.url}${n.error ? `: ${n.error}` : ''}.`);
  if (n.mode === 'STANDBY') add('warning', 'NODE_STANDBY', 'Your node is in standby: the canonical rollup does not match its version yet. It starts on its own when it does; check the image is azteclabs/aztec:6.0.0.');
  if (n.mode === 'SYNCING') add('warning', 'NODE_SYNCING', `Your node is still syncing${n.lagBlocks !== null ? ` (${n.lagBlocks} blocks behind)` : ''}. It cannot propose or attest until it catches up.`);
  for (const d of n.drift) add('critical', 'NODE_VERSION_MISMATCH', `Your node reports ${d.field} ${d.actual}; this network expects ${d.expected}.`);

  if (cfg.attesters.length === 0) {
    add('info', 'NO_ATTESTERS', `No attester addresses configured (AZTEC_ATTESTER_ADDRESSES). Each sequencer needs ${SEQUENCER_REQUIREMENTS.stakeAztec.toLocaleString('en-US')} AZTEC staked through ${AZTEC_NETWORKS[cfg.network].stakingDashboard}.`);
  }
  if (o.attesters.ok) {
    const threshold = o.rollup.ok ? BigInt(o.rollup.value.activationThreshold) : null;
    for (const a of o.attesters.value) {
      const short = `${a.address.slice(0, 8)}…${a.address.slice(-4)}`;
      if (a.status === 'UNKNOWN') add('warning', 'ATTESTER_UNREADABLE', `Could not read ${short} on L1${a.error ? `: ${a.error}` : ''}.`);
      if (a.status === 'NONE') add('critical', 'ATTESTER_NOT_STAKED', `${short} is not registered on the rollup. Stake it through the staking dashboard with its keyN_staker_output.json.`);
      if (a.status === 'ZOMBIE') add('critical', 'ATTESTER_ZOMBIE', `${short} is a zombie: its stake fell below the ejection threshold and it no longer validates. Withdraw and re-stake.`);
      if (a.status === 'EXITING') add('warning', 'ATTESTER_EXITING', `${short} is exiting${a.exit.exitableAt ? `; funds are withdrawable after ${new Date(a.exit.exitableAt * 1000).toISOString()}` : ''}.`);
      if (a.status === 'VALIDATING' && threshold !== null && BigInt(a.effectiveBalance) < threshold) {
        add('warning', 'ATTESTER_UNDERSTAKED', `${short} has less than the activation threshold staked.`);
      }
      if (a.stats.ok) {
        const s = a.stats.value.validator;
        if (s.missedProposals.currentStreak > 0) add('warning', 'MISSED_PROPOSALS', `${short} missed its last ${s.missedProposals.currentStreak} proposal(s).`);
        if (s.missedAttestations.currentStreak >= 3) add('warning', 'MISSED_ATTESTATIONS', `${short} missed ${s.missedAttestations.currentStreak} attestations in a row.`);
      }
    }
  } else if (cfg.attesters.length) {
    add('warning', 'ATTESTERS_UNREADABLE', `Could not read attester status: ${o.attesters.error}`);
  }

  if (o.publishers.ok) {
    for (const p of o.publishers.value) {
      if (p.low) add('critical', 'PUBLISHER_LOW', `Publisher ${p.address.slice(0, 8)}… holds ${p.balanceEth.toFixed(4)} ETH, below the ${SEQUENCER_REQUIREMENTS.publisherAlertEth} ETH alert level. A sequencer without a funded publisher skips its slot.`);
    }
  }

  const graceEndsMs = V6_CANONICAL_AT_MS + SEQUENCER_REQUIREMENTS.slashingGraceSlots * (o.rollup.ok ? o.rollup.value.slotDurationSeconds : 72) * 1000;
  if (now < graceEndsMs) {
    add('info', 'SLASHING_GRACE', `Slashing is off until about ${new Date(graceEndsMs).toISOString().slice(0, 16).replace('T', ' ')} UTC (first 8,400 slots of v6). Missed slots still cost rewards.`);
  }

  const rank = { critical: 0, warning: 1, info: 2 } as const;
  return alerts.sort((a, b) => rank[a.level] - rank[b.level]);
}

// ── Overview ──────────────────────────────────────────────────────────────

export async function buildOverview(cfg: SequencerConfig = loadSequencerConfig()): Promise<SequencerOverview> {
  const net = AZTEC_NETWORKS[cfg.network];
  const refUrl = cfg.referenceNodeUrl;
  const client = l1Client(net, cfg.l1RpcUrl);

  const [info, tips, pending, rollup] = await Promise.all([
    read(aztecRpc<NodeInfo>(refUrl, 'aztec_getNodeInfo', [], cfg.timeoutMs)),
    read(aztecRpc<ChainTips>(refUrl, 'aztec_getChainTips', [], cfg.timeoutMs)),
    read(aztecRpc<number>(refUrl, 'aztec_getPendingTxCount', [], cfg.timeoutMs)),
    read(readRollupState(client, net)),
  ]);
  const tip = tips.ok ? tips.value.proposed.number : null;

  const statsNode = cfg.ownNodeUrl ?? refUrl;
  const [recentBlocks, ownNode, attesters, publishers, rewards] = await Promise.all([
    tip !== null ? read(readRecentBlocks(refUrl, tip, RECENT_BLOCKS, cfg.timeoutMs)) : Promise.resolve(fail<L2BlockSummary[]>('chain tip unavailable')),
    readOwnNode(cfg, net, tip),
    read(readAttesters(cfg, net, rollup.ok ? rollup.value : null, statsNode)),
    read(Promise.all(cfg.publishers.map(p => readPublisher(client, p)))),
    read(cfg.coinbase ? readSequencerRewards(client, net, cfg.coinbase).then(claimable => ({ coinbase: cfg.coinbase as string, claimable })) : Promise.resolve(null)),
  ]);

  const partial: Omit<SequencerOverview, 'alerts'> = {
    network: {
      id: net.id, label: net.label, expectedNodeVersion: net.nodeVersion,
      rollupVersion: net.rollupVersion, l1ChainId: net.l1ChainId, l1: { ...net.l1 },
    },
    generatedAt: Date.now(),
    reference: {
      url: refUrl, info, tips, pendingTxCount: pending, recentBlocks,
      drift: info.ok ? checkNetworkDrift(net, info.value) : [],
    },
    rollup,
    ownNode,
    attesters,
    publishers,
    rewards,
  };
  return { ...partial, alerts: buildAlerts(partial, cfg) };
}

// One refresh serves every viewer for a few seconds: a slot is 72 s, so
// nothing on this page changes faster, and the RPCs stay well under limits.
const CACHE_MS = 10_000;
let cached: { at: number; key: string; value: SequencerOverview } | null = null;
let inflight: { key: string; p: Promise<SequencerOverview> } | null = null;

export async function getSequencerOverview(cfg: SequencerConfig = loadSequencerConfig()): Promise<SequencerOverview> {
  const key = JSON.stringify(cfg);
  if (cached && cached.key === key && Date.now() - cached.at < CACHE_MS) return cached.value;
  if (inflight && inflight.key === key) return inflight.p;
  const p = buildOverview(cfg)
    .then(value => { cached = { at: Date.now(), key, value }; return value; })
    .finally(() => { inflight = null; });
  inflight = { key, p };
  return p;
}

/** For tests. */
export function clearOverviewCache(): void {
  cached = null;
  inflight = null;
}
