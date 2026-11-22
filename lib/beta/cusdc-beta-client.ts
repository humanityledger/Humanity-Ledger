/**
 * lib/beta/cusdc-beta-client.ts: the wallet's side of the closed cUSDC beta.
 *
 * refreshCusdcBeta reads GET /api/beta/cusdc/status and sets the wallet's cUSDC visibility
 * (lib/aztec/wallet/config.ts setCusdcBetaVisibility): send, exits or hidden. It is called on every
 * wallet refresh, at most once a minute. assertCusdcBetaAllows runs before every new cUSDC payment
 * and asks the server again, uncached: only an answer of `send` lets the payment go ahead.
 *
 * Fail-closed. No answer, an error or a malformed body never grants `send`; a wallet that already
 * listed cUSDC keeps it listed as `exits`, so a network hiccup never hides someone's balance.
 * When CUSDC_GATES are all met (cusdcReady), cUSDC is public and the beta is not consulted.
 */
import { AZTEC_WALLET_CONFIG, BETA_TOKENS, getCusdcBetaVisibility, setCusdcBetaVisibility, type TokenKey } from '@/lib/aztec/wallet/config';
import { cusdcReady } from '@/lib/payments/assets';
import type { BetaVisibility } from './cusdc-beta';

const STATUS_URL = '/api/beta/cusdc/status';
const TTL_MS = 60_000;
let fetchedAt = -Infinity;

export const BETA_SEND_REFUSED = 'cUSDC payments are open only to members of the closed beta right now. Nothing was sent.';

/** What the wallet shows after an answer: the server's word, or on no answer what it showed, never send. */
export function visibilityAfter(current: BetaVisibility, answer: BetaVisibility | null): BetaVisibility {
  if (answer !== null) return answer;
  return current === 'hidden' ? 'hidden' : 'exits';
}

export function parseVisibility(body: unknown): BetaVisibility | null {
  const v = (body as { visibility?: unknown } | null)?.visibility;
  return v === 'send' || v === 'exits' || v === 'hidden' ? v : null;
}

async function askServer(fetchImpl: typeof fetch): Promise<BetaVisibility | null> {
  try {
    const res = await fetchImpl(STATUS_URL, { credentials: 'include', cache: 'no-store' });
    if (!res.ok) return null;
    return parseVisibility(await res.json().catch(() => null));
  } catch {
    return null;
  }
}

/** True when this build has a cUSDC slot that only the beta can show. */
export function betaApplies(): boolean {
  return AZTEC_WALLET_CONFIG.network === 'mainnet' && BETA_TOKENS.length > 0 && !cusdcReady();
}

export async function refreshCusdcBeta(fetchImpl: typeof fetch = fetch, now: number = Date.now(), applies: () => boolean = betaApplies): Promise<BetaVisibility> {
  if (!applies()) return setCusdcBetaVisibility('hidden');
  if (now - fetchedAt < TTL_MS) return getCusdcBetaVisibility();
  fetchedAt = now;
  return setCusdcBetaVisibility(visibilityAfter(getCusdcBetaVisibility(), await askServer(fetchImpl)));
}

/** Before every new cUSDC payment or shield: the server must answer `send` now. Exits never call this. */
export async function assertCusdcBetaAllows(key: TokenKey, fetchImpl: typeof fetch = fetch, applies: () => boolean = betaApplies): Promise<void> {
  if (key !== 'CUSDC' || !applies()) return;
  const answer = await askServer(fetchImpl);
  fetchedAt = Date.now();
  setCusdcBetaVisibility(visibilityAfter(getCusdcBetaVisibility(), answer));
  if (answer !== 'send') throw new Error(BETA_SEND_REFUSED);
}

/** Tests only. */
export function __resetCusdcBetaClient(): void {
  fetchedAt = -Infinity;
  setCusdcBetaVisibility('hidden');
}
