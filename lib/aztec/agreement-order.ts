/**
 * lib/aztec/agreement-order.ts — 4.13: post the invitation before funding.
 *
 * An invitation carries the only copy of the claim secret and the contract
 * secret. If it is built after the deposit and the tab dies before it is
 * posted, the recipient can never claim and the sender waits for the deadline
 * to refund. So the order is deploy → post → fund:
 *   - post fails: nothing is deposited (only the deploy fee is spent);
 *   - the tab dies after posting: the invitation already sits in the sender's
 *     own XMTP history, and an unfunded one reads "not found" on both sides;
 *   - funding fails after posting: the posted invitation is left unfunded.
 * Funding is never retried with the same invitation. In PrivateEscrow the
 * settlement nullifier depends only on (escrow_id, sender, recipient), so a
 * second deposit under the same escrow_id could never be claimed or refunded.
 */

export class InvitationNotPostedError extends Error {
  constructor(cause?: unknown) {
    super('The invitation could not be posted in this chat. Nothing was deposited.');
    this.name = 'InvitationNotPostedError';
    (this as any).cause = cause;
  }
}

export class FundingAfterPostError extends Error {
  constructor(cause?: unknown) {
    const detail = cause instanceof Error && cause.message ? ` (${cause.message})` : '';
    super(`The invitation was posted but its deposit did not complete${detail}. Do not fund it again: open a new agreement. If the deposit landed after all, the card shows it.`);
    this.name = 'FundingAfterPostError';
    (this as any).cause = cause;
  }
}

/** Runs `post(raw)` then `fund()`. Without `post`, only funds (scripts and e2e runs). */
export async function postThenFund<T>(raw: string, post: ((raw: string) => Promise<void>) | undefined, fund: () => Promise<T>): Promise<T> {
  if (post) {
    try {
      await post(raw);
    } catch (e) {
      throw new InvitationNotPostedError(e);
    }
  }
  try {
    return await fund();
  } catch (e) {
    throw post ? new FundingAfterPostError(e) : e;
  }
}
