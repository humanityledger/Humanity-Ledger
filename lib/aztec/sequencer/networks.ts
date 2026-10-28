/**
 * Aztec networks as they are today (v6.0.0, canonical since 26 Oct 2026 08:00 UTC).
 *
 * Every value below was checked on 27 Oct 2026 against three sources that
 * agree with each other:
 *   - docs.aztec.network/networks (published addresses)
 *   - the public nodes (aztec_getNodeInfo / aztec_getL1ContractAddresses)
 *   - the L1 contracts themselves (Registry.getCanonicalRollup, Rollup.getVersion)
 *
 * Nothing here is a secret. When Aztec ships a new rollup version these
 * values change: the node refuses to leave standby until the canonical
 * rollup matches it, and `checkNetworkDrift` below reports the mismatch.
 */

export type AztecNetworkId = 'mainnet' | 'testnet';

export interface AztecNetworkConfig {
  id: AztecNetworkId;
  /** Exact value for `aztec start --network <value>`. */
  cliNetwork: AztecNetworkId;
  label: string;
  nodeVersion: string;
  dockerImage: string;
  l1ChainId: number;
  l1ChainName: string;
  rollupVersion: number;
  /** Public read-only Aztec node RPC (rate limited). */
  publicNodeRpc: string;
  bootnodesUrl: string;
  /** Read-only public Ethereum RPC used when no private one is configured. */
  defaultL1Rpc: string;
  l1: {
    registry: `0x${string}`;
    rollup: `0x${string}`;
    inbox: `0x${string}`;
    outbox: `0x${string}`;
    feeJuice: `0x${string}`;
    feeJuicePortal: `0x${string}`;
    stakingAsset: `0x${string}`;
    gse: `0x${string}`;
    stakingRegistry: `0x${string}`;
    coinIssuer: `0x${string}`;
    rewardDistributor: `0x${string}`;
    governanceProposer: `0x${string}`;
    governance: `0x${string}`;
    slasher: `0x${string}`;
    tallySlashingProposer: `0x${string}`;
    honkVerifier: `0x${string}`;
  };
  stakingDashboard: string;
}

export const AZTEC_NODE_VERSION = '6.0.0';
export const AZTEC_DOCKER_IMAGE = 'azteclabs/aztec:6.0.0';

export const AZTEC_NETWORKS: Record<AztecNetworkId, AztecNetworkConfig> = {
  mainnet: {
    id: 'mainnet',
    cliNetwork: 'mainnet',
    label: 'Aztec Alpha (Mainnet)',
    nodeVersion: AZTEC_NODE_VERSION,
    dockerImage: AZTEC_DOCKER_IMAGE,
    l1ChainId: 1,
    l1ChainName: 'Ethereum Mainnet',
    rollupVersion: 2070860440,
    publicNodeRpc: 'https://aztec-mainnet.drpc.org',
    bootnodesUrl: 'http://static.aztec.network/mainnet/bootnodes.json',
    defaultL1Rpc: 'https://ethereum-rpc.publicnode.com',
    l1: {
      registry: '0x35b22e09Ee0390539439E24f06Da43D83f90e298',
      rollup: '0xE37A2663Cc9c119BA41572C40fAb0bbb23a5402f',
      inbox: '0x603B06cEcC1d537Aad83f1d46651e32014c5B6aD',
      outbox: '0xFD2a12658A82d7156DA56c7A8d49A69fC966c8D1',
      feeJuice: '0xA27EC0006e59f245217Ff08CD52A7E8b169E62D2',
      feeJuicePortal: '0x534361be805CA30Bdb6404eC5E6cDAFFB3E9f3b3',
      stakingAsset: '0xA27EC0006e59f245217Ff08CD52A7E8b169E62D2',
      gse: '0xa92ecFD0E70c9cd5E5cd76c50Af0F7Da93567a4f',
      stakingRegistry: '0x042dF8f42790d6943F41C25C2132400fd727f452',
      coinIssuer: '0x02FAdF157d551aa6d761b2A2237D03Af68E41CA6',
      rewardDistributor: '0x555bAAc4757A89f1CE0c84fA35afE9dD7aa8E1d3',
      governanceProposer: '0x06Ef1DcF87E419C48B94a331B252819FADbD63ef',
      governance: '0x1102471Eb3378FEE427121c9EfcEa452E4B6B75e',
      slasher: '0x08B364720b6E4C2089FBdD8A6A722F474013a2B7',
      tallySlashingProposer: '0xa2Ff1BF784D6B1D7Ba1BfD67c3538B85F9f85295',
      honkVerifier: '0x09ae3B0362bCce6E447ce4130c4963630b5a67db',
    },
    stakingDashboard: 'https://stake.aztec.network',
  },
  testnet: {
    id: 'testnet',
    cliNetwork: 'testnet',
    label: 'Aztec Testnet (Sepolia)',
    nodeVersion: AZTEC_NODE_VERSION,
    dockerImage: AZTEC_DOCKER_IMAGE,
    l1ChainId: 11155111,
    l1ChainName: 'Sepolia',
    rollupVersion: 679261766,
    publicNodeRpc: 'https://aztec-testnet.drpc.org',
    bootnodesUrl: 'http://static.aztec.network/testnet/bootnodes.json',
    defaultL1Rpc: 'https://ethereum-sepolia-rpc.publicnode.com',
    l1: {
      registry: '0xA0BFb1B494FB49041e5c6e8c2C1BE09cD171c6Ba',
      rollup: '0x1f435a7F2dA358caF887A470FAeEE7d5D5f4eFBA',
      inbox: '0x7cdC32Dd7d008870A95f1837Ffd7229ef676EF8A',
      outbox: '0xA5A0f7a7BDAf280964a1922A68C83462E5F6E15b',
      feeJuice: '0x762C132040fdA6183066Fa3B14d985ee55aA3C18',
      feeJuicePortal: '0xE59aCBA462a0324B1d619a7A1b219419f156f505',
      stakingAsset: '0x5595cb9ED193cAc2C0Bc5393313bc6115817954B',
      gse: '0xb6A38A51a6C1de9012f9d8EA9745ef957212eAaC',
      stakingRegistry: '0xC6EcC1832c8BF6a41c927BEb4E9ec610FBeDd1C2',
      coinIssuer: '0xE05d0A62045b4237556C1EC423e59eEa9A24EAeE',
      rewardDistributor: '0x83B2A93EF343cAb7Be9D8Bba7317f314975e5CB0',
      governanceProposer: '0x01C7D4ca153748D2377968Fef22894cB162E9480',
      governance: '0xCAf7447721447B22Cd0076aC7C63877c3AFD329F',
      slasher: '0xaFfC002e2dA0A45176ed6015604aC1fFF1b55fA7',
      tallySlashingProposer: '0x11E38CFf51ee20142Eb1eBb9Bd0A3f7934aA9B65',
      honkVerifier: '0x4DD7F03FFa501c699F2B7Fe4eCA460aC0FdA7B00',
    },
    stakingDashboard: 'https://stake.aztec.network',
  },
};

/** Requirements published in the operator docs for v6. */
export const SEQUENCER_REQUIREMENTS = {
  /** Stake per sequencer identity, in whole AZTEC (on-chain activation threshold is 200,000e18). */
  stakeAztec: 200_000,
  hardware: { cores: '8 cores / 16 vCPU (Skylake or newer)', ramGb: 8, diskTb: 1, diskType: 'NVMe SSD', bandwidthMbps: 25 },
  ports: { p2p: 40400, nodeApi: 8080, adminApi: 8880 },
  /** Publisher ETH: opening top-up and yearly running cost, per attester. */
  publisherTopUpEth: 0.01,
  publisherYearlyEth: 0.03,
  /** Docs alert threshold for the publisher balance. */
  publisherAlertEth: 0.1,
  /** Slashing is off for this many slots after v6 became canonical (~7 days). */
  slashingGraceSlots: 8_400,
  l1Requirements: [
    'Ethereum execution RPC (ETHEREUM_HOSTS), comma-separated for failover',
    'Ethereum consensus / beacon RPC (L1_CONSENSUS_HOST_URLS)',
    'An execution RPC that serves debug_traceTransaction or trace_transaction (ETHEREUM_DEBUG_HOSTS)',
  ],
} as const;

/** On-chain attester status codes returned by Rollup.getAttesterView / getStatus. */
export const ATTESTER_STATUS = ['NONE', 'VALIDATING', 'ZOMBIE', 'EXITING'] as const;
export type AttesterStatus = (typeof ATTESTER_STATUS)[number] | 'UNKNOWN';

export function attesterStatusName(code: number | bigint | undefined | null): AttesterStatus {
  if (code === undefined || code === null) return 'UNKNOWN';
  const n = Number(code);
  return (ATTESTER_STATUS as readonly string[])[n] as AttesterStatus ?? 'UNKNOWN';
}

export function resolveNetworkId(value: string | undefined | null): AztecNetworkId {
  const v = String(value ?? '').trim().toLowerCase();
  if (v === 'testnet' || v === 'sepolia') return 'testnet';
  return 'mainnet';
}

export interface NetworkDrift {
  field: 'rollupVersion' | 'l1ChainId' | 'nodeVersion' | 'rollupAddress';
  expected: string;
  actual: string;
}

/** Compare what a node reports with the values this build was made for. */
export function checkNetworkDrift(
  net: AztecNetworkConfig,
  info: { rollupVersion?: number; l1ChainId?: number; nodeVersion?: string; l1ContractAddresses?: { rollupAddress?: string } },
): NetworkDrift[] {
  const drift: NetworkDrift[] = [];
  if (info.rollupVersion !== undefined && info.rollupVersion !== net.rollupVersion)
    drift.push({ field: 'rollupVersion', expected: String(net.rollupVersion), actual: String(info.rollupVersion) });
  if (info.l1ChainId !== undefined && info.l1ChainId !== net.l1ChainId)
    drift.push({ field: 'l1ChainId', expected: String(net.l1ChainId), actual: String(info.l1ChainId) });
  if (info.nodeVersion !== undefined && info.nodeVersion !== net.nodeVersion)
    drift.push({ field: 'nodeVersion', expected: net.nodeVersion, actual: info.nodeVersion });
  const r = info.l1ContractAddresses?.rollupAddress;
  if (r && r.toLowerCase() !== net.l1.rollup.toLowerCase())
    drift.push({ field: 'rollupAddress', expected: net.l1.rollup, actual: r });
  return drift;
}
