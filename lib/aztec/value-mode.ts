/**
 * Exits-only mode: the incident lever between "everything on" and "wallet off".
 *
 *   open        new payments, shielding and new agreements allowed (subject to every other gate)
 *   exits-only  nothing new goes in; claim, refund, cancel, withdraw, accepting an invitation already
 *               received and moving your own private balance to your own public balance still work
 *
 * Two sources, the stricter wins:
 *   - NEXT_PUBLIC_AZTEC_VALUE_MODE, inlined at build time (a build can only ever be stricter)
 *   - AZTEC_VALUE_MODE on the server, read at every new value action through GET /api/aztec/value-mode,
 *     so the operator can stop new value without a code change and tabs already open obey it.
 * The server can only restrict, never authorise: it is not a new trust point for funds.
 * Fail-closed: an unknown value, an unreachable server or a malformed answer means exits-only.
 */
export type ValueMode = 'open' | 'exits-only';

export const EXITS_ONLY_MESSAGE =
  'New private payments and agreements are paused. You can still claim, refund, cancel or withdraw open agreements.';
export const VALUE_MODE_UNCONFIRMED_MESSAGE =
  'Could not confirm that new private payments are allowed right now, so nothing was sent. Check your connection and try again.';

/** Unset or "open" is open; "exits-only" is exits-only; anything else is exits-only. */
export function parseValueMode(raw: unknown): ValueMode {
  if (raw === undefined || raw === null || raw === '' || raw === 'open') return 'open';
  return 'exits-only';
}

const BUILD_MODE: ValueMode = parseValueMode(process.env.NEXT_PUBLIC_AZTEC_VALUE_MODE);

export interface ValueModeResult {
  mode: ValueMode;
  /** Set when the server's answer could not be obtained (and the mode is exits-only because of it). */
  unconfirmed?: boolean;
}

export async function currentValueMode(
  fetchImpl: typeof fetch = globalThis.fetch,
  buildMode: ValueMode = BUILD_MODE,
  timeoutMs = 5000,
): Promise<ValueModeResult> {
  if (buildMode !== 'open') return { mode: 'exits-only' };
  const ctrl = typeof AbortController !== 'undefined' ? new AbortController() : undefined;
  const timer = ctrl ? setTimeout(() => ctrl.abort(), timeoutMs) : undefined;
  try {
    const res = await fetchImpl('/api/aztec/value-mode', { cache: 'no-store', signal: ctrl?.signal });
    if (!res.ok) return { mode: 'exits-only', unconfirmed: true };
    const body: unknown = await res.json();
    const mode = body && typeof body === 'object' ? (body as { mode?: unknown }).mode : undefined;
    if (mode !== 'open' && mode !== 'exits-only') return { mode: 'exits-only', unconfirmed: true };
    return { mode };
  } catch {
    return { mode: 'exits-only', unconfirmed: true };
  } finally {
    if (timer) clearTimeout(timer);
  }
}

/** Throws unless new value may enter right now. Call immediately before the action, never cache the answer. */
export async function assertNewValueAllowed(fetchImpl?: typeof fetch, buildMode?: ValueMode): Promise<void> {
  const r = await currentValueMode(fetchImpl, buildMode);
  if (r.mode === 'open') return;
  throw new ValuePausedError(r.unconfirmed ? VALUE_MODE_UNCONFIRMED_MESSAGE : EXITS_ONLY_MESSAGE);
}

export class ValuePausedError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'ValuePausedError';
  }
}
