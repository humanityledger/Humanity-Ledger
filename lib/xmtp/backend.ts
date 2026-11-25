/**
 * lib/xmtp/backend.ts: which XMTP network this build talks to.
 *
 * Today: the network run by XMTP Labs (browser SDK 5.2.0, env "production"). XMTP announced on
 * 22 Oct 2026 that this network shuts down in early 2027 and that apps run their own backend
 * (ghcr.io/xmtp/backend, SDK 8). docs/xmtp/SELF_HOSTED_MIGRATION.md is the plan.
 *
 * The two networks do not interoperate: everyone in a conversation must be on the same one. So the
 * switch is per build, never per person, and the self-hosted backend is chosen only when the
 * operator sets both variables below. Nothing in the client reads this yet; the SDK 8 client
 * (phase M3 of the plan) does.
 */

export type XmtpNetwork =
  | { kind: 'labs'; env: 'production' | 'dev' | 'local' }
  | { kind: 'self-hosted'; url: string };

export class XmtpBackendConfigError extends Error {}

const LOCAL_HOSTS = new Set(['localhost', '127.0.0.1', '[::1]']);

/** A backend URL the client may use: https, or http on this machine only; no credentials, path or query. */
export function parseBackendUrl(raw: string): string {
  let u: URL;
  try {
    u = new URL(raw.trim());
  } catch {
    throw new XmtpBackendConfigError('NEXT_PUBLIC_XMTP_BACKEND_URL is not a URL.');
  }
  const local = LOCAL_HOSTS.has(u.hostname);
  if (u.protocol !== 'https:' && !(u.protocol === 'http:' && local)) {
    throw new XmtpBackendConfigError('NEXT_PUBLIC_XMTP_BACKEND_URL must use https (http only on localhost).');
  }
  if (u.username || u.password) throw new XmtpBackendConfigError('NEXT_PUBLIC_XMTP_BACKEND_URL must not carry credentials.');
  if ((u.pathname && u.pathname !== '/') || u.search || u.hash) {
    throw new XmtpBackendConfigError('NEXT_PUBLIC_XMTP_BACKEND_URL must be an origin, without path or query.');
  }
  return u.origin;
}

export function xmtpNetwork(env: Record<string, string | undefined> = {
  NEXT_PUBLIC_XMTP_SELF_HOSTED: process.env.NEXT_PUBLIC_XMTP_SELF_HOSTED,
  NEXT_PUBLIC_XMTP_BACKEND_URL: process.env.NEXT_PUBLIC_XMTP_BACKEND_URL,
  NEXT_PUBLIC_XMTP_ENV: process.env.NEXT_PUBLIC_XMTP_ENV,
}): XmtpNetwork {
  if (env.NEXT_PUBLIC_XMTP_SELF_HOSTED === 'true') {
    if (!env.NEXT_PUBLIC_XMTP_BACKEND_URL) {
      throw new XmtpBackendConfigError('NEXT_PUBLIC_XMTP_SELF_HOSTED is on but NEXT_PUBLIC_XMTP_BACKEND_URL is empty.');
    }
    return { kind: 'self-hosted', url: parseBackendUrl(env.NEXT_PUBLIC_XMTP_BACKEND_URL) };
  }
  const e = env.NEXT_PUBLIC_XMTP_ENV;
  return { kind: 'labs', env: e === 'dev' || e === 'local' ? e : 'production' };
}
