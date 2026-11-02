/**
 * lib/security/cronAuth.ts — one check for scheduler-only endpoints.
 *
 * The cron routes each had their own comparison, and several failed open:
 *  - `authHeader !== \`Bearer ${process.env.CRON_SECRET}\`` with the secret
 *    unset compares against "Bearer undefined", which anyone can send;
 *  - "if it does not match, refuse only when NODE_ENV is production AND the
 *    secret is set": with the secret missing, everyone was let through.
 *
 * Here a missing or short secret refuses every request, and the comparison is
 * constant-time. Accepts `Authorization: Bearer <secret>` or `x-cron-secret`.
 */
import { createHash, timingSafeEqual } from 'crypto';

const MIN_SECRET_LENGTH = 16;

function digest(s: string): Buffer {
  return createHash('sha256').update(s).digest();
}

export function isCronAuthorized(req: Request, envName = 'CRON_SECRET'): boolean {
  const secret = process.env[envName];
  if (!secret || secret.length < MIN_SECRET_LENGTH) return false;
  const auth = req.headers.get('authorization') ?? '';
  const provided = auth.startsWith('Bearer ') ? auth.slice(7) : (req.headers.get('x-cron-secret') ?? '');
  if (!provided) return false;
  // Hash both sides so the comparison length never depends on the input.
  return timingSafeEqual(digest(provided), digest(secret));
}
