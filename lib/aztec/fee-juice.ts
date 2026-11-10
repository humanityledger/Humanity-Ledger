/**
 * lib/aztec/fee-juice.ts — paying Aztec fees in Fee Juice (gate G2).
 *
 * Facts this module relies on, checked against Aztec v6.0.0 (aztec-packages
 * tag v6.0.0 -> aztec-node 1b6de149, aztec.js src/fee and src/ethereum, and
 * docs-developers "Paying Fees" / "Fees"):
 *
 *  - Fee Juice is the AZTEC ERC-20 bridged one way from L1 through the
 *    enshrined FeeJuicePortal (depositToAztecPublic(bytes32 to, uint256
 *    amount, bytes32 secretHash), event DepositToAztecPublic(bytes32 indexed
 *    to, uint256 amount, bytes32 secretHash, bytes32 key, uint256 index)).
 *    It is non-transferable on L2 and there is no way back to L1.
 *  - A new account pays for its own deployment by claiming in the same
 *    transaction: FeeJuicePaymentMethodWithClaim(sender, { claimAmount,
 *    claimSecret, messageLeafIndex }). After that, an account with a Fee
 *    Juice balance pays by default (no payment method).
 *  - The claim can only be consumed once the L1->L2 message is in the tree
 *    (isL1ToL2MessageReady(node, messageHash)); in practice a few L2 blocks.
 *  - Alpha has no Sponsored FPC, and the SDK's Private/PublicFeePaymentMethod
 *    are deprecated and do not work on Alpha (lib/aztec/fees.ts).
 *  - Paying with your own Fee Juice is PUBLIC: the account is the visible fee
 *    payer of each transaction. Amounts and recipients of private transfers
 *    stay private, but your transactions can be linked to each other. A
 *    private FPC removes that link; see docs/MAINNET_READINESS.md (G2).
 *
 * Security decisions:
 *  - The L1 portal and token come from the pins in sequencer/networks.ts.
 *    A node reporting different addresses is refused: otherwise a malicious
 *    or misconfigured node could have the user deposit AZTEC into a contract
 *    it controls.
 *  - Claim secrets are DERIVED from the wallet signature (keys.ts,
 *    deriveFeeJuiceClaimSecret), never only stored. Fee Juice bridged to an
 *    address whose claim secret is lost can never be used, so the secret must
 *    be recoverable on any device: recoverClaims() finds deposits to the
 *    account on L1 and re-derives their secrets.
 */
import { AZTEC_NETWORKS, type AztecNetworkId } from './sequencer/networks';
import type { FeeNetwork } from './fees';

// ─── Pins ───────────────────────────────────────────────────────────────────

export interface FeeJuiceL1 {
  portal: string;
  token: string;
  l1ChainId: number;
}

export function pinnedFeeJuice(network: AztecNetworkId): FeeJuiceL1 {
  const n = AZTEC_NETWORKS[network];
  return { portal: n.l1.feeJuicePortal, token: n.l1.feeJuice, l1ChainId: n.l1ChainId };
}

/**
 * Compares what the node reports (getNodeInfo().l1ContractAddresses) with the
 * pins. Throws on any difference; a missing field is also refused.
 */
export function assertNodeFeeJuiceMatchesPins(
  network: AztecNetworkId,
  reported: { feeJuicePortalAddress?: { toString(): string } | string; feeJuiceAddress?: { toString(): string } | string } | undefined,
): FeeJuiceL1 {
  const pin = pinnedFeeJuice(network);
  const portal = reported?.feeJuicePortalAddress?.toString().toLowerCase();
  const token = reported?.feeJuiceAddress?.toString().toLowerCase();
  if (portal !== pin.portal.toLowerCase() || token !== pin.token.toLowerCase()) {
    throw new Error(
      `The Aztec node reports a different Fee Juice portal or token than this build expects ` +
        `(portal ${portal ?? 'none'}, expected ${pin.portal}; token ${token ?? 'none'}, expected ${pin.token}). ` +
        `Nothing was sent.`,
    );
  }
  return pin;
}

// ─── Claims ─────────────────────────────────────────────────────────────────

/** A deposit made on L1 and not yet consumed on L2. Strings so it survives JSON. */
export interface FeeJuiceClaim {
  /** Aztec address the Fee Juice is credited to. */
  recipient: string;
  /** Base units (18 decimals). */
  claimAmount: string;
  /** Which derived secret (keys.ts deriveFeeJuiceClaimSecret index). */
  secretIndex: number;
  /** L1->L2 message hash (the event's `key`). */
  messageHash: string;
  /** Leaf index in the L1->L2 message tree (the event's `index`). */
  messageLeafIndex: string;
  l1TxHash?: string;
  createdAt: number;
}

const STORE_KEY = (recipient: string) => `hl.aztec.feejuice.claims.${recipient.toLowerCase()}`;

/** Pending claims for an account. Contains no secrets (those are re-derived). */
export function loadClaims(recipient: string, storage: Pick<Storage, 'getItem'> | undefined = globalThis.localStorage): FeeJuiceClaim[] {
  try {
    const raw = storage?.getItem(STORE_KEY(recipient));
    const list = raw ? (JSON.parse(raw) as FeeJuiceClaim[]) : [];
    return Array.isArray(list) ? list.filter((c) => c && c.recipient?.toLowerCase() === recipient.toLowerCase()) : [];
  } catch {
    return [];
  }
}

export function saveClaims(recipient: string, claims: FeeJuiceClaim[], storage: Pick<Storage, 'setItem'> | undefined = globalThis.localStorage): void {
  try {
    storage?.setItem(STORE_KEY(recipient), JSON.stringify(claims));
  } catch {
    // Storage full or blocked: claims are recoverable from L1 (recoverClaims).
  }
}

/** Merges by message hash; later information wins. */
export function mergeClaims(a: FeeJuiceClaim[], b: FeeJuiceClaim[]): FeeJuiceClaim[] {
  const m = new Map<string, FeeJuiceClaim>();
  for (const c of [...a, ...b]) m.set(c.messageHash.toLowerCase(), { ...m.get(c.messageHash.toLowerCase()), ...c });
  return [...m.values()].sort((x, y) => x.createdAt - y.createdAt);
}

/** The next unused secret index for new deposits. */
export function nextSecretIndex(claims: FeeJuiceClaim[], consumedIndexes: number[] = []): number {
  const used = new Set([...claims.map((c) => c.secretIndex), ...consumedIndexes]);
  let i = 0;
  while (used.has(i)) i++;
  return i;
}

// ─── Fee plan ───────────────────────────────────────────────────────────────

export type FeePlan =
  /** Test network: the canonical Sponsored FPC pays. */
  | { kind: 'sponsored' }
  /** The account pays from its own Fee Juice balance (no payment method). */
  | { kind: 'balance' }
  /** Claim this deposit and pay with it in the same transaction. Required for the first transaction of a new account. */
  | { kind: 'claim'; claim: FeeJuiceClaim }
  /** A deposit exists but its L1->L2 message is not consumable yet. */
  | { kind: 'wait-claim'; claim: FeeJuiceClaim }
  /** No Fee Juice and nothing on the way: the user must bridge from L1. */
  | { kind: 'bridge' };

export interface FeePlanInput {
  network: FeeNetwork;
  /** A sponsor exists on this network (lib/aztec/fees.ts feeChoices). */
  hasSponsor: boolean;
  feeJuiceBalance: bigint;
  /** Balance below which a transaction is likely to fail (max fee estimate). */
  minBalance: bigint;
  /** Pending claims with whether each message is ready on L2. */
  claims: { claim: FeeJuiceClaim; ready: boolean }[];
}

/**
 * How the next transaction should pay. Consumes a ready claim before using
 * the balance, so bridged Fee Juice is never left unclaimed.
 */
export function feePlan(p: FeePlanInput): FeePlan {
  if (p.hasSponsor && p.network !== 'mainnet') return { kind: 'sponsored' };
  const ready = p.claims.find((c) => c.ready);
  if (ready) return { kind: 'claim', claim: ready.claim };
  if (p.feeJuiceBalance >= p.minBalance && p.feeJuiceBalance > 0n) return { kind: 'balance' };
  const pending = p.claims.find((c) => !c.ready);
  if (pending) return { kind: 'wait-claim', claim: pending.claim };
  return { kind: 'bridge' };
}

// ─── L1 bridge (browser, user's own Ethereum wallet) ────────────────────────

export const FEE_JUICE_PORTAL_ABI = [
  {
    type: 'function',
    name: 'depositToAztecPublic',
    stateMutability: 'nonpayable',
    inputs: [
      { name: '_to', type: 'bytes32' },
      { name: '_amount', type: 'uint256' },
      { name: '_secretHash', type: 'bytes32' },
    ],
    outputs: [
      { name: '', type: 'bytes32' },
      { name: '', type: 'uint256' },
    ],
  },
  {
    type: 'event',
    name: 'DepositToAztecPublic',
    inputs: [
      { name: 'to', type: 'bytes32', indexed: true },
      { name: 'amount', type: 'uint256', indexed: false },
      { name: 'secretHash', type: 'bytes32', indexed: false },
      { name: 'key', type: 'bytes32', indexed: false },
      { name: 'index', type: 'uint256', indexed: false },
    ],
  },
] as const;

export const ERC20_ABI = [
  { type: 'function', name: 'balanceOf', stateMutability: 'view', inputs: [{ name: 'a', type: 'address' }], outputs: [{ name: '', type: 'uint256' }] },
  { type: 'function', name: 'decimals', stateMutability: 'view', inputs: [], outputs: [{ name: '', type: 'uint8' }] },
  {
    type: 'function',
    name: 'allowance',
    stateMutability: 'view',
    inputs: [{ name: 'o', type: 'address' }, { name: 's', type: 'address' }],
    outputs: [{ name: '', type: 'uint256' }],
  },
  {
    type: 'function',
    name: 'approve',
    stateMutability: 'nonpayable',
    inputs: [{ name: 's', type: 'address' }, { name: 'v', type: 'uint256' }],
    outputs: [{ name: '', type: 'bool' }],
  },
] as const;

/** Minimal viem surface used here (PublicClient + WalletClient for the user's account). */
export interface L1Clients {
  account: `0x${string}`;
  chainId: number;
  readContract: (args: any) => Promise<any>;
  estimateContractGas: (args: any) => Promise<bigint>;
  writeContract: (args: any) => Promise<`0x${string}`>;
  waitForTransactionReceipt: (args: { hash: `0x${string}` }) => Promise<{ status: string; logs: any[]; transactionHash: string }>;
  getLogs?: (args: any) => Promise<any[]>;
  /** ETH balance of `account` (viem getBalance). Enables the L1 gas check. */
  getBalance?: (args: { address: `0x${string}` }) => Promise<bigint>;
  /** viem estimateFeesPerGas. Enables the L1 gas check. */
  estimateFeesPerGas?: () => Promise<{ maxFeePerGas?: bigint; gasPrice?: bigint }>;
}

/** Stages of a deposit, for the interface. */
export type BridgeStep = 'checking' | 'approving' | 'approval-confirming' | 'depositing' | 'deposit-confirming' | 'deposited';

/**
 * Upper bound on L1 gas for approve + deposit. The deposit itself is sent
 * with twice its estimate; 60k approve + 2 x 125k deposit covers the Inbox
 * insert at a subtree boundary with room to spare.
 */
export const L1_GAS_BUDGET = 310_000n;

const to32 = (hex: string) => ('0x' + hex.replace(/^0x/, '').toLowerCase().padStart(64, '0')) as `0x${string}`;

/**
 * Deposits `amount` AZTEC into the pinned FeeJuicePortal for `recipient`.
 * Approves first if needed. Returns once the L1 transaction is mined.
 * The gas limit is doubled, as aztec.js does for Inbox deposits (the
 * Inbox insert cost swings by ~40k gas with the message index).
 */
export async function bridgeFeeJuice(
  l1: L1Clients,
  args: { network: AztecNetworkId; recipient: string; amount: bigint; secretHash: string; secretIndex: number },
  onStep: (step: BridgeStep, l1TxHash?: string) => void = () => {},
): Promise<FeeJuiceClaim> {
  onStep('checking');
  const pin = pinnedFeeJuice(args.network);
  if (l1.chainId !== pin.l1ChainId) {
    throw new Error(`Switch your wallet to ${AZTEC_NETWORKS[args.network].l1ChainName} to add Fee Juice.`);
  }
  if (args.amount <= 0n) throw new Error('Enter an amount of AZTEC to bridge.');
  const portal = pin.portal as `0x${string}`;
  const token = pin.token as `0x${string}`;

  const balance: bigint = await l1.readContract({ address: token, abi: ERC20_ABI, functionName: 'balanceOf', args: [l1.account] });
  if (balance < args.amount) throw new Error('Your Ethereum wallet does not hold enough AZTEC for this amount.');

  // Refuse before the approval if the wallet cannot also pay for the deposit:
  // an approval followed by a deposit that runs out of ETH strands nothing,
  // but it costs gas and confuses people.
  if (l1.getBalance && l1.estimateFeesPerGas) {
    const [eth, fees] = await Promise.all([l1.getBalance({ address: l1.account }), l1.estimateFeesPerGas()]);
    const price = fees.maxFeePerGas ?? fees.gasPrice ?? 0n;
    if (price > 0n && eth < L1_GAS_BUDGET * price) {
      throw new Error('Your Ethereum wallet does not hold enough ETH to pay Ethereum gas for the approval and the deposit.');
    }
  }

  const allowance: bigint = await l1.readContract({ address: token, abi: ERC20_ABI, functionName: 'allowance', args: [l1.account, portal] });
  if (allowance < args.amount) {
    // Exact amount, never an unlimited approval.
    onStep('approving');
    const h = await l1.writeContract({ address: token, abi: ERC20_ABI, functionName: 'approve', args: [portal, args.amount], account: l1.account });
    onStep('approval-confirming', h);
    const r = await l1.waitForTransactionReceipt({ hash: h });
    if (r.status !== 'success') throw new Error('The approval failed on Ethereum. Nothing was bridged.');
  }

  const call = {
    address: portal,
    abi: FEE_JUICE_PORTAL_ABI,
    functionName: 'depositToAztecPublic',
    args: [to32(args.recipient), args.amount, to32(args.secretHash)],
    account: l1.account,
  } as const;
  onStep('depositing');
  const gas = (await l1.estimateContractGas(call)) * 2n;
  const hash = await l1.writeContract({ ...call, gas });
  onStep('deposit-confirming', hash);
  const receipt = await l1.waitForTransactionReceipt({ hash });
  if (receipt.status !== 'success') throw new Error('The deposit failed on Ethereum. Your AZTEC was not moved.');

  const ev = await findDepositEvent(receipt.logs, portal, args.recipient, args.amount, args.secretHash);
  if (!ev) throw new Error('The deposit was mined but its event was not found. Do not bridge again; reload to recover it.');
  onStep('deposited', hash);
  return {
    recipient: args.recipient.toLowerCase(),
    claimAmount: args.amount.toString(),
    secretIndex: args.secretIndex,
    messageHash: ev.key,
    messageLeafIndex: ev.index.toString(),
    l1TxHash: receipt.transactionHash,
    createdAt: Date.now(),
  };
}

/** Decodes DepositToAztecPublic logs from the portal and returns the one matching our deposit. */
async function findDepositEvent(logs: any[], portal: string, recipient: string, amount: bigint, secretHash: string) {
  let decodeEventLog: ((a: any) => any) | null = null;
  for (const log of logs) {
    if (String(log.address).toLowerCase() !== portal.toLowerCase()) continue;
    decodeEventLog ??= (await import('viem')).decodeEventLog as any;
    try {
      const d = decodeEventLog!({ abi: FEE_JUICE_PORTAL_ABI, data: log.data, topics: log.topics });
      if (d.eventName !== 'DepositToAztecPublic') continue;
      const a = d.args;
      if (
        String(a.to).toLowerCase() === to32(recipient) &&
        BigInt(a.amount) === amount &&
        String(a.secretHash).toLowerCase() === to32(secretHash)
      ) {
        return { key: String(a.key), index: BigInt(a.index), amount: BigInt(a.amount), secretHash: String(a.secretHash) };
      }
    } catch {
      // Not our event.
    }
  }
  return null;
}

/**
 * Rebuilds pending claims from L1 after local storage was lost: finds
 * DepositToAztecPublic events to `recipient` on the pinned portal and matches
 * each secretHash against the first `maxIndex` derived secrets.
 *
 * `secretHashForIndex` is computeSecretHash(deriveFeeJuiceClaimSecret(i)).
 * Already-consumed claims are filtered by the caller (the L2 claim nullifier
 * makes a second consumption fail anyway).
 */
export async function recoverClaims(
  l1: Required<Pick<L1Clients, 'getLogs'>>,
  args: { network: AztecNetworkId; recipient: string; fromBlock: bigint; maxIndex?: number; secretHashForIndex: (i: number) => Promise<string> },
): Promise<FeeJuiceClaim[]> {
  const pin = pinnedFeeJuice(args.network);
  const event = FEE_JUICE_PORTAL_ABI[1];
  const logs = await l1.getLogs({ address: pin.portal, event, args: { to: to32(args.recipient) }, fromBlock: args.fromBlock });
  const hashes = new Map<string, number>();
  for (let i = 0; i < (args.maxIndex ?? 16); i++) hashes.set((await args.secretHashForIndex(i)).toLowerCase().replace(/^0x/, '').padStart(64, '0'), i);
  const out: FeeJuiceClaim[] = [];
  for (const log of logs) {
    const a = log.args ?? {};
    const sh = String(a.secretHash ?? '').toLowerCase().replace(/^0x/, '').padStart(64, '0');
    const idx = hashes.get(sh);
    if (idx === undefined) continue; // not ours (someone else's deposit to this address)
    out.push({
      recipient: args.recipient.toLowerCase(),
      claimAmount: BigInt(a.amount).toString(),
      secretIndex: idx,
      messageHash: String(a.key),
      messageLeafIndex: BigInt(a.index).toString(),
      l1TxHash: log.transactionHash,
      createdAt: Date.now(),
    });
  }
  return out;
}

/**
 * Adapts viem clients (as returned by wagmi's usePublicClient() and
 * useWalletClient()) to L1Clients. The wallet client signs in the user's own
 * Ethereum wallet; nothing here holds a private key.
 */
export function l1ClientsFromViem(publicClient: any, walletClient: any): L1Clients {
  const account = walletClient?.account?.address as `0x${string}` | undefined;
  const chainId = Number(walletClient?.chain?.id);
  if (!account || !chainId) throw new Error('Connect your Ethereum wallet first.');
  return {
    account,
    chainId,
    readContract: (a) => publicClient.readContract(a),
    estimateContractGas: (a) => publicClient.estimateContractGas(a),
    writeContract: (a) => walletClient.writeContract({ ...a, chain: walletClient.chain }),
    waitForTransactionReceipt: (a) => publicClient.waitForTransactionReceipt(a),
    getLogs: (a) => publicClient.getLogs(a),
    getBalance: (a) => publicClient.getBalance(a),
    estimateFeesPerGas: () => publicClient.estimateFeesPerGas(),
  };
}
