/**
 * Wallet transaction events, reported to /api/wallet/payment-report so payment reliability can
 * be read in the server log (package 3), in the same shape as the chat delivery reports: one log
 * line, signed-in accounts only, rate limited, nothing stored. The report holds the stage, the
 * kind of transaction, the network, a reason code on failure and the time since the attempt.
 * Never an amount, an address, a transaction hash, a key or the error text.
 *
 * Stages: attempted (the user confirmed), sent (proved on this device and accepted by the node:
 * the SDK proves inside send(), so proving and sending are one observable step), mined (included
 * in a block), unconfirmed (sent, not seen in a block within the wait), failed (with a reason).
 */
export const PAYMENT_STAGES = ['attempted', 'sent', 'mined', 'unconfirmed', 'failed'] as const;
export type PaymentStage = (typeof PAYMENT_STAGES)[number];

export const PAYMENT_REASONS = ['fee', 'claim_consumed', 'declined', 'reverted', 'network', 'busy', 'other'] as const;
export type PaymentReason = (typeof PAYMENT_REASONS)[number];

/** A short reason code for a failed transaction, from the error only. */
export function paymentReason(err: unknown): PaymentReason {
  const e = err as { message?: unknown; shortMessage?: unknown } | null;
  const msg = String(e?.shortMessage || e?.message || err || '');
  if (/No non-nullified L1 to L2 message/i.test(msg)) return 'claim_consumed';
  if (/user (rejected|denied)|rejected the request|declined/i.test(msg)) return 'declined';
  if (/fee juice|insufficient fee|not enough fee|fee payer|balance too low to pay/i.test(msg)) return 'fee';
  if (/assert|revert|simulat|app logic|failed to prove|circuit/i.test(msg)) return 'reverted';
  if (/already open in another|SqlitePoolBusy|busy/i.test(msg)) return 'busy';
  if (/fetch|network|ECONN|ETIMEDOUT|socket|502|503|504/i.test(msg)) return 'network';
  return 'other';
}

export function reportPayment(stage: PaymentStage, info: { kind: string; network: string; reason?: PaymentReason; ms?: number }): void {
  if (typeof window === 'undefined' || typeof fetch !== 'function') return;
  try {
    fetch('/api/wallet/payment-report', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      keepalive: true,
      body: JSON.stringify({ stage, kind: info.kind, network: info.network, reason: info.reason, ms: info.ms === undefined ? undefined : Math.round(info.ms) }),
    }).catch(() => {});
  } catch { /* never let reporting break a payment */ }
}
