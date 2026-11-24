/**
 * lib/beta/landing.ts: where /connect sends someone right after they sign in.
 *
 * An explicit return path (?redirect=/settings, a deep link, /beta to join) wins; otherwise the
 * chat. The chat is open to everyone; the closed beta decides only who can use cUSDC.
 *
 * The session cookie is set by the sign-in response itself; the status is asked right after it,
 * and asked once more after a short pause if the first answer is 401, so a slow cookie write on a
 * phone returning from its wallet app never sends a signed-in person back to /connect.
 */
export type LandingStatus = { member: boolean; active?: boolean; open: boolean; remaining?: number | null; gate?: boolean };

export function landingAfterSignIn(explicit: string | null, status: LandingStatus | null): string {
  // The chat is open to everyone (24 Nov 2026): the beta only decides who can hold cUSDC.
  // An explicit return path wins, except /beta for someone who is already a member.
  if (explicit) {
    if (status?.member && (explicit === '/beta' || explicit.startsWith('/beta?'))) return '/chat';
    return explicit;
  }
  return '/chat';
}

export async function readLandingStatus(
  fetchImpl: typeof fetch = fetch,
  wait: (ms: number) => Promise<void> = (ms) => new Promise((r) => setTimeout(r, ms)),
): Promise<LandingStatus | null> {
  for (let attempt = 0; attempt < 2; attempt++) {
    try {
      const res = await fetchImpl('/api/beta/cusdc/status', { credentials: 'include', cache: 'no-store' });
      if (res.ok) {
        const b = (await res.json().catch(() => null)) as Partial<LandingStatus> | null;
        if (!b || typeof b.open !== 'boolean' || typeof b.member !== 'boolean') return null;
        return { member: b.member, active: b.active, open: b.open, remaining: typeof b.remaining === 'number' ? b.remaining : null, gate: b.gate === true };
      }
      if (res.status !== 401) return null;
    } catch {
      return null;
    }
    if (attempt === 0) await wait(450);
  }
  return null;
}
