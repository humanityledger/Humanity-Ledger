/**
 * lib/beta/landing.ts: where /connect sends someone right after they sign in.
 *
 * An explicit return path (?redirect=/settings, a deep link) wins, except /beta itself. Otherwise
 * the beta status decides: a member goes straight to /chat; someone who can still join goes to
 * /beta to enter their code; when the beta is closed or full, or the status cannot be read, the
 * chat opens (messages never wait on the payments beta).
 *
 * The session cookie is set by the sign-in response itself; the status is asked right after it,
 * and asked once more after a short pause if the first answer is 401, so a slow cookie write on a
 * phone returning from its wallet app never sends a signed-in person back to /connect.
 */
export type LandingStatus = { member: boolean; active?: boolean; open: boolean; remaining?: number | null };

export function landingAfterSignIn(explicit: string | null, status: LandingStatus | null): string {
  if (explicit && explicit !== '/beta' && !explicit.startsWith('/beta?')) return explicit;
  if (!status) return '/chat';
  if (status.member && status.active !== false) return '/chat';
  if (status.member) return '/beta'; // revoked: /beta explains what still works
  if (status.open && status.remaining !== 0) return '/beta';
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
        return { member: b.member, active: b.active, open: b.open, remaining: typeof b.remaining === 'number' ? b.remaining : null };
      }
      if (res.status !== 401) return null;
    } catch {
      return null;
    }
    if (attempt === 0) await wait(450);
  }
  return null;
}
