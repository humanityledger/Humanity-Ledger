/**
 * lib/payments/disclosure.ts — what a private payment from a chat reveals, and what its network fee
 * can be, shown before the person confirms (components/chat/PaymentDisclosure.tsx).
 *
 * The sentences follow what the code does, nothing more:
 *   - the transfer is a private Token `transfer` proved on the device: amount, sender and recipient
 *     are in notes only the two parties can read;
 *   - the DM carries the transaction hash, never the amount (lib/payments/payment-message.ts);
 *   - on Aztec Alpha the account that pays the fee is public, and pays in Fee Juice from its own
 *     balance (no sponsorship); on the test network Aztec's sponsored fee contract pays.
 */

export interface FeeView {
  /** Fee Juice held by the account, base units (18 decimals). */
  balance: bigint;
  /** Fee Juice a transaction must be able to cover (its maximum fee); 0 when unknown. */
  minForTx: bigint;
  /** How the next transaction pays (lib/aztec/fee-juice.ts FeePlan kind). */
  plan?: string;
}

export interface Disclosure {
  /** Stays between the two people. */
  private: string[];
  /** Anyone can see. */
  public: string[];
  /** The network fee line. */
  fee: string;
  /** Set when the fee cannot be covered: the payment would fail after proving. */
  feeProblem?: string;
}

/** Fee Juice base units as AZTEC with up to 4 decimals, rounded up so the figure is never too low. */
export function formatFeeJuice(units: bigint): string {
  const scale = 10n ** 14n; // 18 - 4 decimals
  const ticks = (units + scale - 1n) / scale;
  const whole = ticks / 10_000n;
  const frac = (ticks % 10_000n).toString().padStart(4, '0').replace(/0+$/, '');
  return frac ? `${whole}.${frac}` : whole.toString();
}

export function paymentDisclosure(opts: { network: 'mainnet' | 'testnet' | string; peerName: string; fee?: FeeView }): Disclosure {
  const alpha = opts.network === 'mainnet';
  const who = opts.peerName || 'this person';
  const priv = [
    'The amount',
    `That ${who} is the recipient`,
    'Your private balance before and after',
  ];
  const pub = alpha
    ? ['That your Aztec account sent a transaction, and when', 'The network fee your account pays', 'The transaction hash, which the chat also shows to both of you']
    : ['That a transaction happened, and when', 'The transaction hash, which the chat also shows to both of you'];
  if (!alpha) {
    return { private: priv, public: pub, fee: "Network fee: paid by Aztec's sponsored fee contract on the test network." };
  }
  const f = opts.fee;
  if (f?.plan === 'bridge') {
    return { private: priv, public: pub, fee: 'Network fee: paid in Fee Juice from your account.', feeProblem: 'Your account has no Fee Juice yet. Add Fee Juice first, or ask a contact for a fee link.' };
  }
  if (!f || f.minForTx <= 0n) {
    return { private: priv, public: pub, fee: 'Network fee: paid in Fee Juice from your account. The maximum is shown once your wallet has read it from the network.' };
  }
  if (f.plan === 'claim') {
    return { private: priv, public: pub, fee: 'Network fee: paid in Fee Juice from the deposit you bridged, which this payment claims. Only the gas used is charged.' };
  }
  const fee = `Network fee: at most ${formatFeeJuice(f.minForTx)} Fee Juice, paid from your account (you hold ${formatFeeJuice(f.balance)}). Only the gas used is charged.`;
  if (f.plan === 'wait-claim') {
    return { private: priv, public: pub, fee, feeProblem: 'Your Fee Juice deposit has not reached Aztec yet. Wait until the wallet shows it ready, then pay.' };
  }
  if (f.balance < f.minForTx) {
    return { private: priv, public: pub, fee, feeProblem: 'Your Fee Juice does not cover this payment’s maximum fee. Add Fee Juice first, or ask a contact for a fee link.' };
  }
  return { private: priv, public: pub, fee };
}
