/**
 * Read-only views of the Aztec L1 contracts on Ethereum (v6).
 *
 * Every function signature here was called successfully against the
 * mainnet and Sepolia deployments on 27 Oct 2026:
 *   Registry.getCanonicalRollup()
 *   Rollup.getVersion / getCurrentEpoch / getCurrentSlot / getSlotDuration /
 *          getEpochDuration / getTargetCommitteeSize / getActiveAttesterCount /
 *          getEntryQueueLength / getActivationThreshold / getEjectionThreshold /
 *          getExitDelay / getPendingCheckpointNumber / getProvenCheckpointNumber /
 *          getCurrentProposer / getCurrentEpochCommittee / getGenesisTime /
 *          getStakingAsset / getAttesterView(address) / getSequencerRewards(address)
 * Nothing here signs or sends a transaction.
 */

import { createPublicClient, formatEther, http, parseAbi, type PublicClient } from 'viem';
import { mainnet, sepolia } from 'viem/chains';
import type { AztecNetworkConfig } from './networks';
import { attesterStatusName } from './networks';
import type { AttesterExit, PublisherState, RollupState } from './types';
import { SEQUENCER_REQUIREMENTS } from './networks';

export const REGISTRY_ABI = parseAbi([
  'function getCanonicalRollup() view returns (address)',
]);

export const ROLLUP_ABI = parseAbi([
  'function getVersion() view returns (uint256)',
  'function getCurrentEpoch() view returns (uint256)',
  'function getCurrentSlot() view returns (uint256)',
  'function getSlotDuration() view returns (uint256)',
  'function getEpochDuration() view returns (uint256)',
  'function getTargetCommitteeSize() view returns (uint256)',
  'function getActiveAttesterCount() view returns (uint256)',
  'function getEntryQueueLength() view returns (uint256)',
  'function getActivationThreshold() view returns (uint256)',
  'function getEjectionThreshold() view returns (uint256)',
  'function getExitDelay() view returns (uint256)',
  'function getPendingCheckpointNumber() view returns (uint256)',
  'function getProvenCheckpointNumber() view returns (uint256)',
  'function getCurrentProposer() view returns (address)',
  'function getCurrentEpochCommittee() view returns (address[])',
  'function getGenesisTime() view returns (uint256)',
  'function getStakingAsset() view returns (address)',
  'function getSequencerRewards(address) view returns (uint256)',
  'struct Exit { uint256 withdrawalId; uint256 amount; uint256 exitableAt; address recipientOrWithdrawer; bool isRecipient; bool exists; }',
  'struct G1Point { uint256 x; uint256 y; }',
  'struct AttesterConfig { G1Point publicKey; address withdrawer; }',
  'struct AttesterView { uint8 status; uint256 effectiveBalance; Exit exit; AttesterConfig config; }',
  'function getAttesterView(address) view returns (AttesterView)',
]);

export const ERC20_META_ABI = parseAbi([
  'function symbol() view returns (string)',
  'function decimals() view returns (uint8)',
]);

const clients = new Map<string, PublicClient>();

export function l1Client(net: AztecNetworkConfig, rpcUrl: string): PublicClient {
  const key = `${net.id}|${rpcUrl}`;
  let c = clients.get(key);
  if (!c) {
    c = createPublicClient({
      chain: net.l1ChainId === 1 ? mainnet : sepolia,
      // Multicall batches the ~16 view calls of a refresh into one request.
      batch: { multicall: true },
      transport: http(rpcUrl, { timeout: 10_000, retryCount: 1 }),
    }) as PublicClient;
    clients.set(key, c);
  }
  return c;
}

const toNum = (v: bigint) => Number(v);

const assetMetaCache = new Map<string, { symbol: string; decimals: number }>();

export async function readRollupState(client: PublicClient, net: AztecNetworkConfig): Promise<RollupState> {
  const rollup = net.l1.rollup;
  const r = <T>(functionName: any, args: readonly unknown[] = []) =>
    client.readContract({ address: rollup, abi: ROLLUP_ABI, functionName, args: args as any }) as Promise<T>;

  const [
    canonical, version, epoch, slot, slotDur, epochDur, committeeSize, active, queue,
    activation, ejection, exitDelay, pending, proven, proposer, committee, genesis, stakingAsset,
  ] = await Promise.all([
    client.readContract({ address: net.l1.registry, abi: REGISTRY_ABI, functionName: 'getCanonicalRollup' }) as Promise<string>,
    r<bigint>('getVersion'), r<bigint>('getCurrentEpoch'), r<bigint>('getCurrentSlot'),
    r<bigint>('getSlotDuration'), r<bigint>('getEpochDuration'), r<bigint>('getTargetCommitteeSize'),
    r<bigint>('getActiveAttesterCount'), r<bigint>('getEntryQueueLength'),
    r<bigint>('getActivationThreshold'), r<bigint>('getEjectionThreshold'), r<bigint>('getExitDelay'),
    r<bigint>('getPendingCheckpointNumber'), r<bigint>('getProvenCheckpointNumber'),
    r<string>('getCurrentProposer'), r<readonly string[]>('getCurrentEpochCommittee'),
    r<bigint>('getGenesisTime'), r<string>('getStakingAsset'),
  ]);

  let meta = assetMetaCache.get(stakingAsset.toLowerCase());
  if (!meta) {
    const [symbol, decimals] = await Promise.all([
      client.readContract({ address: stakingAsset as `0x${string}`, abi: ERC20_META_ABI, functionName: 'symbol' }) as Promise<string>,
      client.readContract({ address: stakingAsset as `0x${string}`, abi: ERC20_META_ABI, functionName: 'decimals' }) as Promise<number>,
    ]);
    meta = { symbol, decimals: Number(decimals) };
    assetMetaCache.set(stakingAsset.toLowerCase(), meta);
  }

  return {
    canonicalRollup: canonical,
    isCanonical: canonical.toLowerCase() === rollup.toLowerCase(),
    version: version.toString(),
    currentEpoch: toNum(epoch),
    currentSlot: toNum(slot),
    slotDurationSeconds: toNum(slotDur),
    epochDurationSlots: toNum(epochDur),
    targetCommitteeSize: toNum(committeeSize),
    activeAttesterCount: toNum(active),
    entryQueueLength: toNum(queue),
    activationThreshold: activation.toString(),
    ejectionThreshold: ejection.toString(),
    exitDelaySeconds: toNum(exitDelay),
    pendingCheckpoint: toNum(pending),
    provenCheckpoint: toNum(proven),
    currentProposer: proposer,
    committee: [...committee],
    genesisTime: toNum(genesis),
    stakingAsset: { address: stakingAsset, ...meta },
  };
}

export interface RawAttesterView {
  status: number;
  effectiveBalance: string;
  withdrawer: string;
  exit: AttesterExit;
}

export async function readAttesterView(client: PublicClient, net: AztecNetworkConfig, attester: `0x${string}`): Promise<RawAttesterView> {
  const v: any = await client.readContract({ address: net.l1.rollup, abi: ROLLUP_ABI, functionName: 'getAttesterView', args: [attester] });
  return {
    status: Number(v.status),
    effectiveBalance: BigInt(v.effectiveBalance).toString(),
    withdrawer: v.config?.withdrawer ?? '0x0000000000000000000000000000000000000000',
    exit: {
      exists: Boolean(v.exit?.exists),
      amount: BigInt(v.exit?.amount ?? 0).toString(),
      exitableAt: Number(v.exit?.exitableAt ?? 0),
      recipientOrWithdrawer: v.exit?.recipientOrWithdrawer ?? '0x0000000000000000000000000000000000000000',
      isRecipient: Boolean(v.exit?.isRecipient),
    },
  };
}

export { attesterStatusName };

export async function readSequencerRewards(client: PublicClient, net: AztecNetworkConfig, coinbase: `0x${string}`): Promise<string> {
  const v = (await client.readContract({ address: net.l1.rollup, abi: ROLLUP_ABI, functionName: 'getSequencerRewards', args: [coinbase] })) as bigint;
  return v.toString();
}

export async function readPublisher(client: PublicClient, address: `0x${string}`): Promise<PublisherState> {
  const wei = await client.getBalance({ address });
  const eth = Number(formatEther(wei));
  return { address, balanceWei: wei.toString(), balanceEth: eth, low: eth < SEQUENCER_REQUIREMENTS.publisherAlertEth };
}
