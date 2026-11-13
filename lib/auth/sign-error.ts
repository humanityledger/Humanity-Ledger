/**
 * Classifies a failed wallet signature request on /connect.
 *
 * - "declined": the user rejected it (EIP-1193 code 4001, or "rejected"/"denied"/"cancel" text).
 *   Never retried.
 * - "expired": withSignTimeout gave up, or WalletConnect reports the request expired. Not retried;
 *   the user taps "Try again" and gets a fresh nonce.
 * - "lost": any other failure (relay drop, tab suspended while in the wallet app).
 */
export type SignFailure = 'declined' | 'expired' | 'lost';

export const SIGN_MESSAGES: Record<SignFailure, string> = {
  declined: 'You declined the signature in your wallet. Nothing was charged and nothing was sent.',
  expired: 'The signature request expired. Open your wallet, approve, then tap Try again.',
  lost: 'The wallet did not return the signature. Open your wallet, approve, then tap Try again.',
};

export function classifySignError(e: unknown): SignFailure {
  const err = e as { code?: unknown; cause?: { code?: unknown; message?: unknown }; message?: unknown } | null;
  const code = err?.code ?? err?.cause?.code;
  const text = `${typeof err?.message === 'string' ? err.message : ''} ${
    typeof err?.cause?.message === 'string' ? err.cause.message : ''
  }`.toLowerCase();

  if (code === 4001 || code === '4001' || /rejected|denied|cancel/.test(text)) return 'declined';
  if (/timed out|timeout|expired/.test(text)) return 'expired';
  return 'lost';
}
