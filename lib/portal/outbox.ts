/**
 * lib/portal/outbox.ts — finishing a withdrawal on Ethereum from the wallet.
 *
 * A withdrawal has two transactions (docs/PORTAL.md §3):
 *   1. On Aztec, PortalToken.withdraw_private burns the private balance and emits an L2->L1
 *      message. The wallet proves and sends it (PrivateWallet.portalWithdraw).
 *   2. On Ethereum, once Aztec has proven that epoch, HLPortal.withdraw consumes the message from
 *      Aztec's Outbox with a membership proof and pays the recipient.
 *
 * Step 2 used to need a script, so the withdraw form stayed off. Now the wallet keeps every
 * withdrawal it started on this device (`PendingWithdrawal`), asks the Aztec node for the
 * membership witness once the epoch's root is on the Outbox (PrivateWallet.portalOutboxProof,
 * built on stdlib's computeL2ToL1MembershipWitness), and sends step 2 from the connected
 * Ethereum wallet. Anyone may send step 2 (no caller is bound), so a lost device loses nothing:
 * the withdrawal stays executable from the same record exported or from another wallet.
 *
 * Leaf hash: Aztec's Hash.sha256ToField(L2ToL1Msg) (l1-contracts, v6):
 *   sha256ToField(abi.encodePacked(sender.actor bytes32, sender.version uint256,
 *                                  recipient.actor address, recipient.chainId uint256, content bytes32))
 */
import { hexToBytes, sha256ToField, withdrawContent } from './receivers';
import type { OutboxProof } from './l1';

export type { OutboxProof };

function u256(x: bigint): Uint8Array {
  if (x < 0n || x >= 1n << 256n) throw new Error('Out of uint256 range.');
  return hexToBytes(x.toString(16).padStart(64, '0'));
}
function b32(h: string): Uint8Array {
  const s = h.toLowerCase().replace(/^0x/, '');
  if (!/^[0-9a-f]{1,64}$/.test(s)) throw new Error('Invalid 32-byte value.');
  return hexToBytes(s.padStart(64, '0'));
}
function addr20(a: string): Uint8Array {
  const s = a.toLowerCase().replace(/^0x/, '');
  if (!/^[0-9a-f]{40}$/.test(s)) throw new Error('Invalid Ethereum address.');
  return hexToBytes(s);
}

/** The Outbox leaf of a message from `l2Token` (Aztec) to `portal` (Ethereum). */
export async function l2ToL1Leaf(m: { l2Token: string; rollupVersion: bigint; portal: string; chainId: bigint | number; content: string }): Promise<string> {
  const b = new Uint8Array(32 + 32 + 20 + 32 + 32);
  b.set(b32(m.l2Token), 0);
  b.set(u256(m.rollupVersion), 32);
  b.set(addr20(m.portal), 64);
  b.set(u256(BigInt(m.chainId)), 84);
  b.set(b32(m.content), 116);
  return sha256ToField(b);
}

/** Leaf id the Outbox marks as consumed (stdlib getL2ToL1MessageLeafId). */
export function outboxLeafId(p: Pick<OutboxProof, 'leafIndex' | 'path'>): bigint {
  return (1n << BigInt(p.path.length)) + p.leafIndex;
}

/* ---------------------------------------------------------- withdrawals in flight */

export interface PendingWithdrawal {
  /** Aztec transaction of step 1. */
  txHash: string;
  symbol: string;
  l1Token: string;
  l2Token: string;
  recipient: string;
  /** Decimal string (JSON has no bigint). */
  amount: string;
  unwrap: boolean;
  /** Outbox leaf (l2ToL1Leaf). */
  leaf: string;
  startedAt: number;
  /** Ethereum transaction of step 2, once sent. */
  paidTx?: string;
}

export type WithdrawalStage = 'proving' | 'ready' | 'paid';

const KEY = (aztec: string, network: string) => `hl_portal_withdrawals_${network}_${aztec.toLowerCase()}`;

export function loadWithdrawals(aztec: string, network: string): PendingWithdrawal[] {
  try {
    const v = JSON.parse(localStorage.getItem(KEY(aztec, network)) || '[]');
    return Array.isArray(v) ? v.filter((w) => w && typeof w.txHash === 'string' && typeof w.leaf === 'string') : [];
  } catch {
    return [];
  }
}

export function saveWithdrawals(aztec: string, network: string, list: PendingWithdrawal[]): void {
  try {
    localStorage.setItem(KEY(aztec, network), JSON.stringify(list.slice(-50)));
  } catch {
    /* private mode: the list lives for this page only */
  }
}

/** Builds the record of a withdrawal just sent on Aztec, with its Outbox leaf. */
export async function recordWithdrawal(p: {
  txHash: string;
  symbol: string;
  l1Token: string;
  l2Token: string;
  recipient: string;
  amount: bigint;
  unwrap: boolean;
  portal: string;
  chainId: number;
  rollupVersion: bigint;
}): Promise<PendingWithdrawal> {
  // The wallet never binds a caller: anyone can pay step 2 (zero address in the message).
  const content = await withdrawContent(p.recipient, p.amount);
  const leaf = await l2ToL1Leaf({ l2Token: p.l2Token, rollupVersion: p.rollupVersion, portal: p.portal, chainId: p.chainId, content });
  return {
    txHash: p.txHash,
    symbol: p.symbol,
    l1Token: p.l1Token,
    l2Token: p.l2Token,
    recipient: p.recipient,
    amount: p.amount.toString(),
    unwrap: p.unwrap,
    leaf,
    startedAt: Date.now(),
  };
}
