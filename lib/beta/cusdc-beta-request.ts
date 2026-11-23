/**
 * lib/beta/cusdc-beta-request.ts: requests for a place in the closed cUSDC beta, sent from /beta by
 * a signed-in wallet that has no invitation code.
 *
 * A request holds the wallet address and dates, nothing else: no name, email or handle. The
 * operator reviews it (scripts/beta/cusdc-invites.mjs requests), runs the same checks as for any
 * invitation (EU sanctions list, 18 or older) and approves it by reserving one invitation for that
 * wallet (approve-request). The wallet then joins on /beta without typing a code; the 100-member
 * limit, the notice and every payment check stay the same.
 */

export type RequestState = 'none' | 'pending' | 'approved' | 'declined';

export type RequestRow = { walletAddress: string; requestedAt: Date; approvedAt: Date | null; declinedAt: Date | null };

export interface RequestStore {
  find(wallet: string): Promise<RequestRow | null>;
  /** Creates the request once; a second call keeps the first date. */
  create(wallet: string, at: Date): Promise<RequestRow>;
}

export function requestState(row: RequestRow | null): RequestState {
  if (!row) return 'none';
  if (row.approvedAt) return 'approved';
  if (row.declinedAt) return 'declined';
  return 'pending';
}

export const REQUEST_SENT = 'Request sent. If a place is approved for this wallet, open ledgerchat.org/beta with it again: you will join without a code.';

export type RequestAnswer = { status: 200; body: { request: RequestState; requestedAt: string } } | { status: 403 | 409 | 503; body: { error: string } };

/**
 * One request per wallet, only while the beta is on and has places, and never for a member. A
 * declined wallet is not asked again from the page.
 */
export async function requestPlace(
  store: RequestStore,
  input: { wallet: string; open: boolean; remaining: number | null; isMember: boolean; now: Date },
): Promise<RequestAnswer> {
  if (!input.open) return { status: 503, body: { error: 'The cUSDC beta is not open.' } };
  if (input.isMember) return { status: 409, body: { error: 'This wallet is already in the beta.' } };
  const existing = await store.find(input.wallet);
  if (existing) return { status: 200, body: { request: requestState(existing), requestedAt: existing.requestedAt.toISOString() } };
  if (input.remaining === 0) return { status: 409, body: { error: 'The cUSDC beta is full: all 100 places are taken.' } };
  const row = await store.create(input.wallet, input.now);
  return { status: 200, body: { request: requestState(row), requestedAt: row.requestedAt.toISOString() } };
}
