/**
 * lib/payments/rails.ts — pure checks that decide whether a payment may be
 * sent, so funds are never sent where they cannot arrive.
 *
 * Two rails:
 *  - private: an Aztec private transfer from the in-browser wallet to the
 *    payee's Aztec address (lib/aztec/wallet/client.ts);
 *  - public: a plain Ethereum mainnet transfer from the user's own wallet to
 *    the payee's Ethereum address (NativeCryptoSendModal).
 *
 * A failed Aztec transaction changes nothing on chain, so "falling back"
 * never means retrying a half-done payment: it means offering the other rail
 * when the first one is not available or did not go through.
 */

export type RailCheck = { ok: true } | { ok: false; reason: string };

// ─── Public rail (Ethereum) ─────────────────────────────────────────────────

/** Gas is reserved with a 25% margin over the estimate. */
export const GAS_RESERVE_NUM = 125n;
export const GAS_RESERVE_DEN = 100n;

export function gasReserve(gasLimit: bigint, maxFeePerGas: bigint): bigint {
  return (gasLimit * maxFeePerGas * GAS_RESERVE_NUM + GAS_RESERVE_DEN - 1n) / GAS_RESERVE_DEN;
}

export interface EvmSendInput {
  kind: 'native' | 'erc20';
  /** Base units being sent. */
  amount: bigint;
  /** Wallet's ETH balance on the target chain, in wei. */
  ethBalance: bigint;
  /** Token balance in base units (erc20 only). */
  tokenBalance?: bigint;
  /** Estimated gas for the transfer. */
  gasLimit: bigint;
  /** Current max fee per gas, in wei. */
  maxFeePerGas: bigint;
  /** Chain the wallet is on, and the chain the token lives on. */
  walletChainId: number;
  targetChainId: number;
  recipient: string;
  sender?: string;
}

const EVM_ADDRESS = /^0x[0-9a-fA-F]{40}$/;

/** Every condition for a public transfer. `maxNative` is the largest ETH amount that still leaves the gas reserve. */
export function checkEvmSend(i: EvmSendInput): RailCheck & { maxNative?: bigint } {
  if (!EVM_ADDRESS.test(i.recipient) || /^0x0{40}$/i.test(i.recipient)) return { ok: false, reason: 'The recipient is not a valid Ethereum address.' };
  if (i.sender && i.sender.toLowerCase() === i.recipient.toLowerCase()) return { ok: false, reason: 'That is your own address.' };
  if (i.walletChainId !== i.targetChainId) return { ok: false, reason: 'Your wallet is on another network. Switch to Ethereum mainnet first.' };
  if (i.amount <= 0n) return { ok: false, reason: 'Enter an amount.' };
  const reserve = gasReserve(i.gasLimit, i.maxFeePerGas);
  if (i.kind === 'native') {
    const maxNative = i.ethBalance > reserve ? i.ethBalance - reserve : 0n;
    if (i.amount > maxNative) {
      return { ok: false, reason: 'Not enough ETH for this amount plus Ethereum gas.', maxNative };
    }
    return { ok: true, maxNative };
  }
  if ((i.tokenBalance ?? 0n) < i.amount) return { ok: false, reason: 'Your wallet does not hold enough of this token.' };
  if (i.ethBalance < reserve) return { ok: false, reason: 'Not enough ETH to pay Ethereum gas for this transfer.' };
  return { ok: true };
}

/** Parses a decimal amount into base units; null when malformed. Never throws (no exponent, no sign). */
export function parseAmount(text: string, decimals: number): bigint | null {
  const t = text.trim();
  const m = /^(\d+)(?:\.(\d*))?$/.exec(t);
  if (!m) return null;
  const frac = m[2] ?? '';
  if (frac.length > decimals) return null;
  const units = BigInt(m[1] + frac.padEnd(decimals, '0'));
  return units;
}

// ─── Private rail (Aztec) ───────────────────────────────────────────────────

export interface PrivateRailInput {
  walletPhase: string;
  /** Payee's pinned Aztec address, if they shared one in this DM. */
  payeeAztec?: string;
  /** Whether that address has a verified G7 binding (peer-binding.ts). */
  payeeVerified?: boolean;
  /** Our own Aztec address. */
  selfAztec?: string;
  tokenConfigured: boolean;
  /** Alpha only: how the next fee would be paid (fee-juice.ts FeePlan kind). */
  feePlan?: string;
  network: 'testnet' | 'mainnet';
}

export function checkPrivateRail(i: PrivateRailInput): RailCheck {
  if (i.walletPhase !== 'ready') return { ok: false, reason: 'Open your private wallet to pay privately.' };
  if (!i.payeeAztec) return { ok: false, reason: 'The issuer has not shared an Aztec address in this chat.' };
  if (i.selfAztec && i.selfAztec.toLowerCase() === i.payeeAztec.toLowerCase()) return { ok: false, reason: 'That is your own Aztec address.' };
  // On Alpha real funds move: only to an address the payee proved they control.
  if (i.network === 'mainnet' && !i.payeeVerified) {
    return { ok: false, reason: "The issuer's Aztec address is not verified. Ask them to share it again from an up-to-date Ledger Chat." };
  }
  if (!i.tokenConfigured) return { ok: false, reason: 'This token is not available in your private wallet.' };
  if (i.network === 'mainnet' && (i.feePlan === 'bridge' || i.feePlan === 'wait-claim')) {
    return { ok: false, reason: i.feePlan === 'bridge' ? 'Add Fee Juice to pay the Aztec network fee.' : 'Your Fee Juice is still arriving on Aztec.' };
  }
  return { ok: true };
}

/** Who an invoice is paid to: its issuer. Refuses an invoice issued by the payer. */
export function invoicePayee(invoice: { senderAddress?: string }, me: string): RailCheck & { payee?: string } {
  const payee = (invoice.senderAddress || '').toLowerCase();
  if (!EVM_ADDRESS.test(payee)) return { ok: false, reason: 'This invoice has no valid issuer address.' };
  if (me && payee === me.toLowerCase()) return { ok: false, reason: 'You issued this invoice.' };
  return { ok: true, payee };
}
