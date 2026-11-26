/**
 * Level 0 · Invite Capability (`hl-invite-v1`). The recipient signs a single-use,
 * expiring pass; whoever opens the link is admitted without any credential.
 * Signed with EIP-191 by the recipient's account key (wallet or passkey-derived);
 * single use is enforced by the redeeming server (Redis SET NX on `jti`).
 */
import { recoverMessageAddress } from 'viem';
import { G8_INVITE_VERSION } from '@/lib/g8/constants';

export interface InvitePayload { v: typeof G8_INVITE_VERSION; issuer: string; jti: string; exp: number; note?: string }
export interface SignedInvite { payload: InvitePayload; sig: `0x${string}` }

const b64u = (s: string) => btoa(unescape(encodeURIComponent(s))).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
const unb64u = (s: string) => decodeURIComponent(escape(atob(s.replace(/-/g, '+').replace(/_/g, '/'))));

export function inviteMessage(p: InvitePayload): string {
  return `Ledger Chat invite\n${p.v}\nissuer:${p.issuer.toLowerCase()}\njti:${p.jti}\nexp:${p.exp}`;
}

export function newInvitePayload(issuer: string, ttlSeconds: number, now = Date.now()): InvitePayload {
  const r = crypto.getRandomValues(new Uint8Array(16));
  return { v: G8_INVITE_VERSION, issuer: issuer.toLowerCase(), jti: [...r].map(b => b.toString(16).padStart(2, '0')).join(''), exp: Math.floor(now / 1000) + Math.max(60, Math.min(ttlSeconds, 30 * 86400)) };
}

export const encodeInvite = (i: SignedInvite) => b64u(JSON.stringify(i));
export function decodeInvite(token: string): SignedInvite | null {
  try {
    const v = JSON.parse(unb64u(token));
    if (v?.payload?.v !== G8_INVITE_VERSION || !/^0x[0-9a-f]{40}$/.test(v.payload.issuer) || !/^[0-9a-f]{32}$/.test(v.payload.jti)) return null;
    if (!Number.isInteger(v.payload.exp) || typeof v.sig !== 'string' || !/^0x[0-9a-fA-F]{130}$/.test(v.sig)) return null;
    return v as SignedInvite;
  } catch { return null; }
}

/** Signature + expiry. Single use is the server's job (see app/api/g8/invite). */
export async function verifyInvite(i: SignedInvite, now = Date.now()): Promise<{ ok: true } | { ok: false; reason: 'expired' | 'signature' }> {
  if (i.payload.exp * 1000 < now) return { ok: false, reason: 'expired' };
  try {
    const signer = await recoverMessageAddress({ message: inviteMessage(i.payload), signature: i.sig });
    return signer.toLowerCase() === i.payload.issuer ? { ok: true } : { ok: false, reason: 'signature' };
  } catch { return { ok: false, reason: 'signature' }; }
}
