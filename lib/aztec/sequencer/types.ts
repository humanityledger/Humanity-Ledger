/**
 * Types for the Aztec v6 sequencer integration.
 *
 * Node shapes mirror what an Aztec 6.0.0 node actually returns over its
 * `aztec_*` JSON-RPC namespace (checked against the public mainnet and
 * testnet nodes on 27 Oct 2026). L1 shapes mirror the Rollup, GSE and
 * Registry contracts on Ethereum.
 *
 * A value we could not read is never replaced by a made-up one: every
 * section is a `Reading<T>`, either the value or the reason it is missing.
 */

import type { AttesterStatus, AztecNetworkId, NetworkDrift } from './networks';

export type Reading<T> = { ok: true; value: T } | { ok: false; error: string };

export const ok = <T>(value: T): Reading<T> => ({ ok: true, value });
export const fail = <T = never>(error: unknown): Reading<T> => ({
  ok: false,
  error: error instanceof Error ? error.message : String(error),
});

// ── Node JSON-RPC (aztec_*) ────────────────────────────────────────────────

export interface BlockRef {
  number: number;
  hash: string;
}

export interface CheckpointRef {
  block: BlockRef;
  checkpoint: BlockRef;
}

/** aztec_getChainTips */
export interface ChainTips {
  proposed: BlockRef;
  checkpointed: CheckpointRef;
  proven: CheckpointRef;
  finalized: CheckpointRef;
}

/** aztec_getNodeInfo (fields we use) */
export interface NodeInfo {
  nodeVersion: string;
  l1ChainId: number;
  rollupVersion: number;
  enr?: string;
  realProofs?: boolean;
  l1ContractAddresses: Record<string, string>;
  protocolContractAddresses?: Record<string, string>;
  txsLimits?: { gas?: { daGas?: number; l2Gas?: number } };
}

/** aztec_getWorldStateSyncStatus */
export interface WorldStateSyncStatus {
  latestBlockNumber: number;
  latestBlockHash: string;
  finalizedBlockNumber: number;
  oldestHistoricBlockNumber: number;
  treesAreSynched: boolean;
}

export interface MissedCounter {
  currentStreak: number;
  rate?: number;
  count: number;
  total: number;
}

export type SlotDuty =
  | 'attestation-sent'
  | 'attestation-missed'
  | 'checkpoint-mined'
  | 'checkpoint-proposed'
  | 'checkpoint-missed'
  | 'blocks-missed'
  | string;

/** One entry of aztec_getValidatorsStats().stats / aztec_getValidatorStats(addr).validator */
export interface ValidatorStats {
  address: string;
  lastProposal?: { timestamp: string; slot: number; date: string };
  lastAttestation?: { timestamp: string; slot: number; date: string };
  totalSlots: number;
  missedProposals: MissedCounter;
  missedAttestations: MissedCounter;
  history: { slot: number; status: SlotDuty }[];
}

/** aztec_getValidatorStats(address) */
export interface SingleValidatorStats {
  validator: ValidatorStats;
  allTimeEpochPerformance?: { epoch: number; missed: number; total: number }[];
  lastProcessedSlot?: number;
  initialSlot?: number;
  slotWindow?: number;
}

/** What we keep from aztec_getBlock(n). */
export interface L2BlockSummary {
  number: number;
  hash: string;
  checkpointNumber: number;
  slot: number;
  timestamp: number;
  coinbase: string;
  /** Total fees, in fee-juice base units (decimal string). */
  totalFees: string;
  /** Mana used, decimal string. */
  totalManaUsed: string;
  feePerL2Gas: string;
  archiveRoot: string;
  noteHashTreeRoot?: string;
  nullifierTreeRoot?: string;
  publicDataTreeRoot?: string;
  l1ToL2MessageTreeRoot?: string;
  noteHashLeaves?: number;
  nullifierLeaves?: number;
}

// ── L1 (Ethereum) ─────────────────────────────────────────────────────────

export interface RollupState {
  canonicalRollup: string;
  isCanonical: boolean;
  version: string;
  currentEpoch: number;
  currentSlot: number;
  slotDurationSeconds: number;
  epochDurationSlots: number;
  targetCommitteeSize: number;
  activeAttesterCount: number;
  entryQueueLength: number;
  /** Wei-style integer strings in the staking asset's base unit. */
  activationThreshold: string;
  ejectionThreshold: string;
  exitDelaySeconds: number;
  pendingCheckpoint: number;
  provenCheckpoint: number;
  currentProposer: string;
  committee: string[];
  genesisTime: number;
  stakingAsset: { address: string; symbol: string; decimals: number };
}

export interface AttesterExit {
  exists: boolean;
  amount: string;
  exitableAt: number;
  recipientOrWithdrawer: string;
  isRecipient: boolean;
}

export interface AttesterState {
  address: string;
  status: AttesterStatus;
  effectiveBalance: string;
  withdrawer: string;
  exit: AttesterExit;
  inCurrentCommittee: boolean;
  isCurrentProposer: boolean;
  /** From the node's slot tracker (only covers the node's recent window). */
  stats: Reading<SingleValidatorStats>;
  /** Set when the L1 view could not be read; status is then UNKNOWN. */
  error?: string;
}

export interface PublisherState {
  address: string;
  balanceWei: string;
  balanceEth: number;
  /** Below the docs' alert threshold (0.1 ETH). */
  low: boolean;
}

export interface RewardsState {
  coinbase: string;
  /** Claimable with Rollup.claimSequencerRewards(coinbase); staking-asset base units. */
  claimable: string;
}

// ── Our own node ─────────────────────────────────────────────────────────

export type OwnNodeMode = 'NOT_CONFIGURED' | 'DOWN' | 'STANDBY' | 'SYNCING' | 'READY';

export interface OwnNodeState {
  url: string | null;
  mode: OwnNodeMode;
  /** GET /status answered 200. */
  statusOk: boolean;
  ready: boolean | null;
  info: NodeInfo | null;
  tips: ChainTips | null;
  worldState: WorldStateSyncStatus | null;
  pendingTxCount: number | null;
  /** Blocks behind the reference node (proposed tip). */
  lagBlocks: number | null;
  drift: NetworkDrift[];
  error?: string;
}

// ── Aggregate ────────────────────────────────────────────────────────────

export interface SequencerOverview {
  network: {
    id: AztecNetworkId;
    label: string;
    expectedNodeVersion: string;
    rollupVersion: number;
    l1ChainId: number;
    l1: Record<string, string>;
  };
  generatedAt: number;
  /** The public reference node (or our node when no public one is set). */
  reference: {
    url: string;
    info: Reading<NodeInfo>;
    tips: Reading<ChainTips>;
    pendingTxCount: Reading<number>;
    recentBlocks: Reading<L2BlockSummary[]>;
    drift: NetworkDrift[];
  };
  rollup: Reading<RollupState>;
  ownNode: OwnNodeState;
  attesters: Reading<AttesterState[]>;
  publishers: Reading<PublisherState[]>;
  rewards: Reading<RewardsState | null>;
  /** Plain-language problems an operator must fix, worst first. */
  alerts: OperatorAlert[];
}

export interface OperatorAlert {
  level: 'critical' | 'warning' | 'info';
  code: string;
  message: string;
}

export interface SequencerConfig {
  network: AztecNetworkId;
  /** Our own node's API (port 8080). Never exposed to browsers. */
  ownNodeUrl: string | null;
  /** Node used for network-wide reads. */
  referenceNodeUrl: string;
  l1RpcUrl: string;
  attesters: `0x${string}`[];
  publishers: `0x${string}`[];
  coinbase: `0x${string}` | null;
  timeoutMs: number;
}
