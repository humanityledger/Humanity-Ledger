/**
 * lib/auth/session-check.ts
 *
 * One answer to "is this browser signed in?", shared by /connect and the chat gate.
 *
 * Before 11 November 2026, /connect redirected to /chat whenever localStorage held an
 * unexpired `system_session_v2` (7 days) or a `system_handshake` cookie, without asking the
 * server. The chat gate (components/auth/TuringShieldGate.tsx) asks the server
 * (/api/auth/enclave-pin, which reads the httpOnly `hl_session` through lib/session) and sends
 * the user back to /connect when there is no session. With a server session that had expired,
 * been revoked, or never been stored (an in-app wallet browser), while the local marker was
 * still alive, the two pages bounced the user between them forever.
 *
 * Now /connect only redirects when the server confirms the same session the chat will check,
 * stale local markers are cleared when it does not, and a loop breaker stops automatic
 * redirects if they happen too often anyway.
 */

/** Local hints written at sign-in; never proof of a session on their own. */
const LOCAL_KEYS = ['system_session_v2', 'system_wallet_addr'];

/** True when the server holds the session the chat gate checks (same endpoint, same cookie). */
export async function hasServerSession(fetchImpl: typeof fetch = fetch): Promise<boolean> {
  try {
    const r = await fetchImpl('/api/auth/enclave-pin', { credentials: 'include', cache: 'no-store' });
    if (r.status === 401) return false;
    if (!r.ok) return false;
    const d = await r.json().catch(() => ({}));
    return !(d as { noSession?: boolean })?.noSession;
  } catch {
    return false;
  }
}

/** Removes the local sign-in hints so they cannot send the user to the chat without a session. */
export function clearLocalSessionMarkers(): void {
  try {
    for (const k of LOCAL_KEYS) {
      localStorage.removeItem(k);
      sessionStorage.removeItem(k);
    }
    document.cookie = 'system_handshake=; path=/; max-age=0; SameSite=Lax';
  } catch {
    /* storage unavailable */
  }
}

const LOOP_KEY = 'hl.auth.redirects';
const LOOP_WINDOW_MS = 60_000;
const LOOP_MAX = 3;

/**
 * Records an automatic /connect → app redirect and says whether it may happen. More than
 * LOOP_MAX within LOOP_WINDOW_MS means the two sides disagree about the session: stop
 * redirecting, clear the local hints and let the user sign in again.
 */
export function allowAutoRedirect(now: number = Date.now(), store: Pick<Storage, 'getItem' | 'setItem'> = sessionStorage): boolean {
  try {
    const raw = store.getItem(LOOP_KEY);
    const recent = (raw ? (JSON.parse(raw) as number[]) : []).filter((t) => typeof t === 'number' && now - t < LOOP_WINDOW_MS);
    if (recent.length >= LOOP_MAX) {
      store.setItem(LOOP_KEY, JSON.stringify(recent));
      return false;
    }
    recent.push(now);
    store.setItem(LOOP_KEY, JSON.stringify(recent));
    return true;
  } catch {
    return true;
  }
}
