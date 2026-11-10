/**
 * lib/aztec/stream-terms.ts — the terms a chat stream is opened with (gap 2.5).
 *
 * PaymentStream asserts start <= anchor timestamp (SEC-S7), and the anchor is
 * a block that is already in the past when the transaction is proven, which
 * can take minutes. So a stream starts STREAM_START_SLACK seconds before now,
 * and that much accrual is available to the recipient right away. It cannot
 * be removed without a contract change (accrual from a future start), so it
 * is bounded and shown: streams last at least MIN_STREAM_SECONDS, which caps
 * the slack part at 120 / 3600 ≈ 3.3 % of the total, and the composer shows
 * it before anything is proven. The start is fixed when the invitation is
 * posted, so the time to prove and include the funding adds to it: `upfront`
 * is the least the recipient can withdraw at once.
 */
export const STREAM_START_SLACK = 120;
export const MIN_STREAM_SECONDS = 3600;
export const MAX_STREAM_SECONDS = 365 * 24 * 3600;

export interface StreamTerms {
  rate: bigint;
  /** Start for a stream opened at `nowSeconds`; chat-agreements re-derives it right before posting (streamStart). */
  start: number;
  /** Base units the recipient can withdraw as soon as the stream lands. */
  upfront: bigint;
}

/** Start for a stream whose invitation is posted now. */
export const streamStart = (nowSeconds: number): number => nowSeconds - STREAM_START_SLACK;

/** Throws on a duration outside [MIN_STREAM_SECONDS, MAX_STREAM_SECONDS] or a non-positive total. */
export function streamTerms(total: bigint, durationSeconds: number, nowSeconds: number): StreamTerms {
  if (total <= 0n) throw new Error('Enter an amount above zero.');
  if (!Number.isInteger(durationSeconds) || durationSeconds < MIN_STREAM_SECONDS || durationSeconds > MAX_STREAM_SECONDS) {
    throw new Error('Choose a stream duration between one hour and one year.');
  }
  const rate = total / BigInt(durationSeconds);
  // Fewer base units than seconds: the old rate=1 fallback ended the stream early (and all of it was upfront for tiny totals).
  if (rate === 0n) throw new Error('This amount is too small to stream over that duration.');
  const slackAccrual = rate * BigInt(STREAM_START_SLACK);
  return { rate, start: streamStart(nowSeconds), upfront: slackAccrual < total ? slackAccrual : total };
}
