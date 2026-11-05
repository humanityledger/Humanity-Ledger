/**
 * lib/aztec/fees.ts
 *
 * How a transaction pays its fee, per network.
 *
 * Aztec Alpha (mainnet, L1 chain 1) has no Sponsored FPC: docs.aztec.network/networks
 * lists it only for the test network, and a sponsored payment there fails at
 * simulation. On Alpha a transaction pays in Fee Juice, either from the
 * account's balance (the default, no payment method) or by claiming Fee Juice
 * bridged from L1 in the same transaction (FeeJuicePaymentMethodWithClaim).
 * The SDK's PrivateFeePaymentMethod and PublicFeePaymentMethod are deprecated
 * and do not work on Alpha, so they are never offered.
 *
 * The network is identified from what the node reports (its L1 chain ID),
 * never from configuration alone, so a mistyped URL cannot make the client
 * offer a payment method the network does not have.
 */
import { AZTEC_NETWORKS, checkNetworkDrift, type AztecNetworkId, type NetworkDrift } from './sequencer/networks';

export type FeeNetwork = AztecNetworkId | 'local';

/** Canonical Sponsored FPC per network (salt 0); absent where none is deployed. */
export const SPONSORED_FPC: Readonly<Partial<Record<FeeNetwork, string>>> = {
  testnet: '0x2d8fff82a3b0c15d0a89169e7d8d043e079ab94d52031f1de1e4972ebad169d3',
};

/** L1 chain ID of the local network started by `aztec start --local-network`. */
export const LOCAL_L1_CHAIN_ID = 31337;

export type FeeChoice =
  | { kind: 'sponsored'; fpc: string }
  | { kind: 'fee-juice' }
  | { kind: 'fee-juice-claim' };

/** The network a node belongs to, from the L1 chain ID it reports. */
export function feeNetworkFromL1ChainId(l1ChainId: number): FeeNetwork | undefined {
  if (l1ChainId === AZTEC_NETWORKS.mainnet.l1ChainId) return 'mainnet';
  if (l1ChainId === AZTEC_NETWORKS.testnet.l1ChainId) return 'testnet';
  if (l1ChainId === LOCAL_L1_CHAIN_ID) return 'local';
  return undefined;
}

/**
 * Payment methods a client may offer on `network`, in order of preference.
 * `localSponsoredFpc` is the address the local network reports, if any.
 */
export function feeChoices(network: FeeNetwork, localSponsoredFpc?: string): FeeChoice[] {
  const juice: FeeChoice[] = [{ kind: 'fee-juice' }, { kind: 'fee-juice-claim' }];
  const fpc = network === 'local' ? localSponsoredFpc : SPONSORED_FPC[network];
  return fpc ? [{ kind: 'sponsored', fpc }, ...juice] : juice;
}

/** Throws when `choice` is not available on `network` (for example, sponsored fees on Alpha). */
export function assertFeeChoice(network: FeeNetwork, choice: FeeChoice, localSponsoredFpc?: string): void {
  const ok = feeChoices(network, localSponsoredFpc).some(
    (c) => c.kind === choice.kind && (c.kind !== 'sponsored' || c.fpc.toLowerCase() === (choice as { fpc: string }).fpc.toLowerCase()),
  );
  if (!ok) {
    throw new Error(
      choice.kind === 'sponsored'
        ? `No sponsored fee payer at ${choice.fpc} on ${network}; pay with Fee Juice`
        : `Fee payment "${choice.kind}" is not available on ${network}`,
    );
  }
}

export interface NodeIdentity {
  network: FeeNetwork | undefined;
  /** Differences from the values this build was made for (empty when it matches). */
  drift: NetworkDrift[];
}

/** What a node says it is, checked against the pinned network values. */
export function identifyNode(info: {
  l1ChainId: number | bigint | string;
  rollupVersion?: number | bigint | string;
  nodeVersion?: string;
  l1ContractAddresses?: { rollupAddress?: { toString(): string } | string };
}): NodeIdentity {
  const l1ChainId = Number(info.l1ChainId);
  const network = feeNetworkFromL1ChainId(l1ChainId);
  if (network === undefined || network === 'local') return { network, drift: [] };
  const drift = checkNetworkDrift(AZTEC_NETWORKS[network], {
    l1ChainId,
    rollupVersion: info.rollupVersion === undefined ? undefined : Number(info.rollupVersion),
    nodeVersion: info.nodeVersion,
    l1ContractAddresses: info.l1ContractAddresses?.rollupAddress
      ? { rollupAddress: info.l1ContractAddresses.rollupAddress.toString() }
      : undefined,
  });
  return { network, drift };
}
