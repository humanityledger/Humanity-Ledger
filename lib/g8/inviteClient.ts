/** Client side of G8 invites: create (signed by the account), share, redeem after sign-in. */
import { encodeInvite, inviteMessage, newInvitePayload } from '@/lib/g8/invite';
import { isPasskeySession, signWithPasskey } from '@/lib/g8/passkeyAccount';

const PENDING = 'hl.g8.pending-invite';
const TOKEN = /^[A-Za-z0-9_-]{40,2000}$/;

async function signAsAccount(address: string, message: string): Promise<`0x${string}`> {
  if (isPasskeySession(address)) return (await signWithPasskey(address, message)) as `0x${string}`;
  const [{ signMessage, getAccount }, { config }] = await Promise.all([import('@wagmi/core'), import('@/config/appkit')]);
  const acct = getAccount(config);
  if (!acct.address || acct.address.toLowerCase() !== address.toLowerCase()) throw new Error('Connect the wallet of this account to sign the invite.');
  return signMessage(config, { message });
}

/** A single-use link valid for `ttlSec` (default 7 days). */
export async function createInviteLink(address: string, origin: string, ttlSec = 7 * 86_400): Promise<string> {
  const payload = newInvitePayload(address, ttlSec, Date.now());
  const signature = await signAsAccount(address, inviteMessage(payload));
  return `${origin}/connect?invite=${encodeInvite({ payload, sig: signature })}`;
}

/** /connect keeps ?invite= until the person is signed in. */
export function rememberInviteFromUrl(search: string, s: Storage | undefined = typeof window !== 'undefined' ? window.sessionStorage : undefined): void {
  const t = new URLSearchParams(search).get('invite');
  if (t && TOKEN.test(t)) { try { s?.setItem(PENDING, t); } catch {} }
}

/** Called once the chat is open: redeems a remembered invite (server enforces single use). */
export async function redeemPendingInvite(f: typeof fetch = fetch, s: Storage | undefined = typeof window !== 'undefined' ? window.sessionStorage : undefined): Promise<{ ok: boolean; issuer?: string; error?: string } | null> {
  let token: string | null = null;
  try { token = s?.getItem(PENDING) ?? null; s?.removeItem(PENDING); } catch {}
  if (!token) return null;
  const r = await f('/api/g8/invite', { method: 'POST', credentials: 'include', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ token }) });
  const j = await r.json().catch(() => ({}));
  return r.ok ? { ok: true, issuer: j.issuer } : { ok: false, error: j.error };
}
