/**
 * lib/aztec/private-fees.ts — pay the network fee without showing which account paid it.
 *
 * On Aztec Alpha a transaction names its fee payer publicly. When an account pays its own fee in
 * Fee Juice, that account is the public payer. The private fee payment contract recommended by the
 * Aztec documentation (PrivateFPC, npm @alejoamiras/private-fee-juice, community-maintained,
 * originally by Wonderland) pays instead: it has no public functions, no owner and no operator,
 * holds Fee Juice as a private note balance per user, and is never deployed (its address comes
 * from its bytecode and a shared salt, so every app using it shares one privacy set). The public
 * fee payer is then the shared contract, not the person. This follows decision Q8: a fee contract
 * run by Aztec or the community, never one of ours.
 *
 * Flow:
 *   1. Top-up: an L1 deposit to the Fee Juice portal with the PrivateFPC as recipient and a secret
 *      bound to this account: secret = poseidon2([bridgeSalt, me], DOM_SEP__FPC_BRIDGE_SECRET).
 *      The L1 deposit itself is public on Ethereum, as any Fee Juice deposit is.
 *   2. The next payment claims it and pays its fee in the same transaction
 *      (PrivateMintAndPayFeePaymentMethod); what is left stays as this account's private balance.
 *   3. Later payments pay from that balance (FPCFeePaymentMethod).
 *
 * Safety, because a mistake here loses funds:
 *   - the PrivateFPC address is only valid for one Aztec version: nothing is deposited or paid
 *     unless the node runs exactly the canonical version, and registration asserts the address;
 *   - the contract keeps the maximum fee (no refund), so it is used only with gas limits estimated
 *     by a simulation; without an estimate the payment uses the account's own Fee Juice as before;
 *   - bridge salts are derived from the wallet signature (never random), so a deposit can be found
 *     again from another device;
 *   - off unless NEXT_PUBLIC_AZTEC_PRIVATE_FEES=on.
 */
import canonical from '@alejoamiras/private-fee-juice/canonical-deployment.json';
import type { FeeJuiceClaim } from './fee-juice';

export const PRIVATE_FPC_ADDRESS: string = canonical.expectedAddress.toLowerCase();
export const PRIVATE_FPC_SALT: string = canonical.salt;
export const PRIVATE_FPC_AZTEC_VERSION: string = canonical.aztecVersion;
/** contracts: PrivateFPC derive_bridge_secret. */
export const DOM_SEP__FPC_BRIDGE_SECRET = 3952304070;
/** Ours: bridge salts derived from the wallet's claim secrets, separated from the claim secrets themselves. */
export const DOM_SEP__HL_PRIVATE_FEE_SALT = 1_801_812_021;

export const PRIVATE_FEES_BUILD_ON = process.env.NEXT_PUBLIC_AZTEC_PRIVATE_FEES === 'on';

/** True only on the exact Aztec version the canonical address was computed for. */
export function versionMatches(nodeVersion: string | undefined | null): boolean {
  if (!nodeVersion) return false;
  return String(nodeVersion).trim().replace(/^v/, '') === PRIVATE_FPC_AZTEC_VERSION;
}

/** A deposit made to the PrivateFPC for this account. `recipient` is the PrivateFPC. */
export interface PrivateFeeDeposit extends FeeJuiceClaim {
  /** Aztec address of the account that may mint it (it is in the secret). */
  claimer: string;
}

const KEY = (claimer: string) => `hl.aztec.privatefees.deposits.${claimer.toLowerCase()}`;

export function loadPrivateDeposits(claimer: string, storage: Pick<Storage, 'getItem'> | undefined = globalThis.localStorage): PrivateFeeDeposit[] {
  try {
    const raw = storage?.getItem(KEY(claimer));
    const list = raw ? JSON.parse(raw) : [];
    return Array.isArray(list) ? list.filter((d) => d && typeof d.messageHash === 'string' && typeof d.claimAmount === 'string') : [];
  } catch {
    return [];
  }
}

export function savePrivateDeposits(claimer: string, list: PrivateFeeDeposit[], storage: Pick<Storage, 'setItem'> | undefined = globalThis.localStorage): void {
  try {
    storage?.setItem(KEY(claimer), JSON.stringify(list));
  } catch {
    /* the deposit can be found again from L1 (deterministic salts) */
  }
}

/** The first salt index no pending deposit uses. */
export function nextPrivateSaltIndex(pending: Pick<PrivateFeeDeposit, 'secretIndex'>[], used: number[] = [], max = 15): number {
  const taken = new Set([...pending.map((d) => d.secretIndex), ...used]);
  for (let i = 0; i < max; i++) if (!taken.has(i)) return i;
  return max;
}

export type PrivateFeeChoice =
  | { kind: 'balance' }
  | { kind: 'mint-and-pay'; deposit: PrivateFeeDeposit }
  | { kind: 'none'; reason: string };

/**
 * How the next payment pays its fee privately, or why it cannot. `maxFee` is the fee the estimated
 * gas limits can cost (the contract keeps all of it). A deposit is only used when it alone covers
 * the fee; otherwise the payment falls back to the account's own Fee Juice.
 */
export function privateFeeChoice(p: {
  enabled: boolean;
  versionOk: boolean;
  balance: bigint;
  maxFee: bigint;
  deposits: { deposit: PrivateFeeDeposit; ready: boolean }[];
}): PrivateFeeChoice {
  if (!p.enabled) return { kind: 'none', reason: 'private fees are off' };
  if (!p.versionOk) return { kind: 'none', reason: `the network does not run Aztec ${PRIVATE_FPC_AZTEC_VERSION}` };
  if (p.maxFee <= 0n) return { kind: 'none', reason: 'no gas estimate' };
  if (p.balance >= p.maxFee) return { kind: 'balance' };
  const ready = p.deposits
    .filter((d) => d.ready && BigInt(d.deposit.claimAmount) + p.balance >= p.maxFee && BigInt(d.deposit.claimAmount) >= p.maxFee)
    .sort((a, b) => (BigInt(a.deposit.claimAmount) < BigInt(b.deposit.claimAmount) ? -1 : 1));
  if (ready.length) return { kind: 'mint-and-pay', deposit: ready[0].deposit };
  return { kind: 'none', reason: 'no private Fee Juice covers this fee yet' };
}

/** Fee of a transaction with these gas limits at these maximum fees per gas (what the contract keeps). */
export function maxFeeOf(g: { daGas: bigint; l2Gas: bigint }, perGas: { feePerDaGas: bigint; feePerL2Gas: bigint }, teardown = { daGas: 0n, l2Gas: 0n }): bigint {
  return (g.daGas + teardown.daGas) * perGas.feePerDaGas + (g.l2Gas + teardown.l2Gas) * perGas.feePerL2Gas;
}
