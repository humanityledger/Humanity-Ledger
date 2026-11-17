/**
 * lib/portal/l1.ts — Ethereum side of the portal: forward a receiver, deposit from a wallet,
 * find deposits for one's receivers, execute a proven withdrawal. Uses the same viem-shaped
 * L1Clients as the Fee Juice bridge (lib/aztec/fee-juice.ts).
 */
import { portalLogs, type L1Clients } from '../aztec/fee-juice';
import type { PortalAsset, PortalConfig } from './config';
import type { PendingDeposit } from './receivers';

const ZERO = '0x0000000000000000000000000000000000000000' as const;
const hex = (s: string) => s as `0x${string}`;
const b32 = (s: string) => hex('0x' + s.replace(/^0x/, '').toLowerCase().padStart(64, '0'));

export const FACTORY_ABI = [
  {
    type: 'function',
    name: 'forward',
    stateMutability: 'nonpayable',
    inputs: [
      { name: 'secretHash', type: 'bytes32' },
      { name: 'rescueSigner', type: 'address' },
      { name: 'token', type: 'address' },
      { name: 'amount', type: 'uint256' },
    ],
    outputs: [
      { name: 'key', type: 'bytes32' },
      { name: 'index', type: 'uint256' },
    ],
  },
  {
    type: 'function',
    name: 'predict',
    stateMutability: 'view',
    inputs: [
      { name: 'secretHash', type: 'bytes32' },
      { name: 'rescueSigner', type: 'address' },
    ],
    outputs: [{ name: '', type: 'address' }],
  },
] as const;

export const PORTAL_ABI = [
  {
    type: 'function',
    name: 'depositToAztecPrivate',
    stateMutability: 'nonpayable',
    inputs: [
      { name: 'token', type: 'address' },
      { name: 'amount', type: 'uint256' },
      { name: 'secretHash', type: 'bytes32' },
    ],
    outputs: [
      { name: 'key', type: 'bytes32' },
      { name: 'index', type: 'uint256' },
    ],
  },
  {
    type: 'function',
    name: 'depositEthToAztecPrivate',
    stateMutability: 'payable',
    inputs: [{ name: 'secretHash', type: 'bytes32' }],
    outputs: [
      { name: 'key', type: 'bytes32' },
      { name: 'index', type: 'uint256' },
    ],
  },
  {
    type: 'function',
    name: 'withdraw',
    stateMutability: 'nonpayable',
    inputs: [
      { name: 'token', type: 'address' },
      { name: 'recipient', type: 'address' },
      { name: 'amount', type: 'uint256' },
      { name: 'withCaller', type: 'bool' },
      { name: 'unwrap', type: 'bool' },
      {
        name: 'proof',
        type: 'tuple',
        components: [
          { name: 'epoch', type: 'uint256' },
          { name: 'numCheckpointsInEpoch', type: 'uint256' },
          { name: 'leafIndex', type: 'uint256' },
          { name: 'path', type: 'bytes32[]' },
        ],
      },
    ],
    outputs: [],
  },
  {
    type: 'function',
    name: 'remainingToday',
    stateMutability: 'view',
    inputs: [
      { name: 'token', type: 'address' },
      { name: 'sender', type: 'address' },
    ],
    outputs: [{ name: '', type: 'uint256' }],
  },
  {
    type: 'event',
    name: 'DepositToAztecPrivate',
    inputs: [
      { name: 'token', type: 'address', indexed: true },
      { name: 'sender', type: 'address', indexed: true },
      { name: 'amount', type: 'uint256', indexed: false },
      { name: 'secretHash', type: 'bytes32', indexed: true },
      { name: 'key', type: 'bytes32', indexed: false },
      { name: 'index', type: 'uint256', indexed: false },
    ],
  },
] as const;

const ERC20_ALLOWANCE = [
  {
    type: 'function',
    name: 'allowance',
    stateMutability: 'view',
    inputs: [
      { name: 'owner', type: 'address' },
      { name: 'spender', type: 'address' },
    ],
    outputs: [{ type: 'uint256' }],
  },
] as const;

const ERC20_APPROVE = [
  {
    type: 'function',
    name: 'approve',
    stateMutability: 'nonpayable',
    inputs: [
      { name: 'spender', type: 'address' },
      { name: 'value', type: 'uint256' },
    ],
    outputs: [{ name: '', type: 'bool' }],
  },
] as const;

function assertChain(l1: L1Clients, c: PortalConfig) {
  if (l1.chainId !== c.l1ChainId) throw new Error(c.l1ChainId === 1 ? 'Switch your wallet to Ethereum.' : 'Switch your wallet to Sepolia.');
}

/**
 * Forwards what a receiver holds into the portal. Anyone may send this transaction; the person's
 * own Ethereum address sending it links that address to the receiver (on Ethereum only), so the
 * wallet suggests leaving it to the payer or to a relayer (docs/RECEIVER_ADDRESSES.md §5).
 */
export async function forwardReceiver(
  l1: L1Clients,
  c: PortalConfig,
  r: { secretHash: string; rescueSigner: string },
  asset: PortalAsset,
  amount: bigint,
): Promise<string> {
  assertChain(l1, c);
  if (amount <= 0n) throw new Error('Enter an amount.');
  const hash = await l1.writeContract({
    address: hex(c.factory),
    abi: FACTORY_ABI,
    functionName: 'forward',
    args: [b32(r.secretHash), hex(r.rescueSigner), asset.native ? ZERO : hex(asset.l1), amount],
  });
  const rc = await l1.waitForTransactionReceipt({ hash });
  if (rc.status !== 'success') throw new Error('The forward transaction failed on Ethereum.');
  return rc.transactionHash;
}

/** Deposits straight from the connected Ethereum wallet into one's own receiver secret. */
export async function depositFromWallet(
  l1: L1Clients,
  c: PortalConfig,
  secretHash: string,
  asset: PortalAsset,
  amount: bigint,
): Promise<string> {
  assertChain(l1, c);
  if (amount <= 0n) throw new Error('Enter an amount.');
  let hash: `0x${string}`;
  if (asset.native) {
    hash = await l1.writeContract({ address: hex(c.portal), abi: PORTAL_ABI, functionName: 'depositEthToAztecPrivate', args: [b32(secretHash)], value: amount });
  } else {
    // Approve only what is missing. USDT refuses a new non-zero allowance over a non-zero one, so a
    // too-small leftover is reset to 0 first; an allowance already large enough costs no transaction.
    const current = BigInt(
      await l1.readContract({ address: hex(asset.l1), abi: ERC20_ALLOWANCE, functionName: 'allowance', args: [hex(l1.account), hex(c.portal)] }),
    );
    if (current < amount) {
      if (current > 0n) {
        const reset = await l1.writeContract({ address: hex(asset.l1), abi: ERC20_APPROVE, functionName: 'approve', args: [hex(c.portal), 0n] });
        const rr = await l1.waitForTransactionReceipt({ hash: reset });
        if (rr.status !== 'success') throw new Error('The approval failed on Ethereum.');
      }
      const approve = await l1.writeContract({ address: hex(asset.l1), abi: ERC20_APPROVE, functionName: 'approve', args: [hex(c.portal), amount] });
      const ar = await l1.waitForTransactionReceipt({ hash: approve });
      if (ar.status !== 'success') throw new Error('The approval failed on Ethereum.');
    }
    hash = await l1.writeContract({
      address: hex(c.portal),
      abi: PORTAL_ABI,
      functionName: 'depositToAztecPrivate',
      args: [hex(asset.l1), amount, b32(secretHash)],
    });
  }
  const rc = await l1.waitForTransactionReceipt({ hash });
  if (rc.status !== 'success') throw new Error('The deposit failed on Ethereum.');
  return rc.transactionHash;
}

/**
 * Deposits made to these secret hashes, from the portal's events (secretHash is an indexed topic,
 * so the query names only the person's own secret hashes, never their Aztec address).
 */
export async function findDeposits(l1: L1Clients, c: PortalConfig, secretHashes: string[]): Promise<PendingDeposit[]> {
  if (!l1.getLogs || !secretHashes.length) return [];
  const event = PORTAL_ABI.find((x) => x.type === 'event')!;
  // One request, or block windows when the RPC refuses the range (as for Fee Juice claims).
  const logs = await portalLogs(
    { getLogs: (q) => l1.getLogs!(q), getBlockNumber: l1.getBlockNumber ? () => l1.getBlockNumber!() : undefined },
    {
    address: hex(c.portal),
    event,
    args: { secretHash: secretHashes.map(b32) },
    fromBlock: c.deployBlock,
    },
  );
  const out: PendingDeposit[] = [];
  for (const log of logs) {
    const a = log.args ?? {};
    out.push({
      index: BigInt(a.index),
      amount: BigInt(a.amount),
      token: String(a.token).toLowerCase(),
      secretHash: String(a.secretHash).toLowerCase(),
      // Logs carry no time unless the RPC adds blockTimestamp. The caller (ReceiversCard) keeps the
      // first-seen time per deposit, so a rescan never restarts the claim delay.
      at: Number(log.blockTimestamp ?? 0) || Math.floor(Date.now() / 1000),
    });
  }
  return out;
}

export interface OutboxProof {
  epoch: bigint;
  numCheckpointsInEpoch: bigint;
  leafIndex: bigint;
  path: string[];
}

/** Executes a withdrawal on Ethereum once its epoch is proven (proof from the Aztec node). */
export async function executeWithdrawal(
  l1: L1Clients,
  c: PortalConfig,
  w: { asset: PortalAsset; recipient: string; amount: bigint; withCaller: boolean; unwrap: boolean; proof: OutboxProof },
): Promise<string> {
  assertChain(l1, c);
  const hash = await l1.writeContract({
    address: hex(c.portal),
    abi: PORTAL_ABI,
    functionName: 'withdraw',
    args: [
      hex(w.asset.l1),
      hex(w.recipient),
      w.amount,
      w.withCaller,
      w.unwrap && !!w.asset.native,
      { epoch: w.proof.epoch, numCheckpointsInEpoch: w.proof.numCheckpointsInEpoch, leafIndex: w.proof.leafIndex, path: w.proof.path.map(b32) },
    ],
  });
  const rc = await l1.waitForTransactionReceipt({ hash });
  if (rc.status !== 'success') throw new Error('The withdrawal failed on Ethereum.');
  return rc.transactionHash;
}
