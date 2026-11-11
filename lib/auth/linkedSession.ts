/**
 * lib/auth/linkedSession.ts — who is calling: the phone that holds the wallet, or a computer
 * linked to it by QR (lib/auth/linkedDevices.ts). Server only.
 *
 * Tokens minted for a linked computer carry `did` (its device id) and source
 * 'linked-device'. A wallet sign-in (SIWE) has no `did`: that device is the primary.
 */
import type { NextRequest } from 'next/server';
import { verifyJWT } from '@/lib/jwt';
import { isSessionTokenRevoked, tokenFingerprint } from '@/lib/security/sessionRevocation';
import { isSessionPayload } from '@/lib/security/sessionClaims';

const EVM = /^0x[0-9a-f]{40}$/;
const COOKIES = ['hl_session', 'ledger_session', 'human_session'];

export interface CallerSession {
  wallet: string;
  /** Set when the caller is a linked computer. */
  deviceId?: string;
  token: string;
  tokenFp: string;
  expiresAt: number;
}

export async function callerSession(req: NextRequest): Promise<CallerSession | null> {
  for (const name of COOKIES) {
    const token = req.cookies.get(name)?.value;
    if (!token) continue;
    try {
      const p: any = await verifyJWT(token);
      if (!isSessionPayload(p)) continue;
      if (await isSessionTokenRevoked(token)) continue;
      const wallet = String(p.walletAddress || p.address || p.sub || '').toLowerCase();
      if (!EVM.test(wallet)) continue;
      const deviceId = typeof p.did === 'string' && p.source === 'linked-device' ? p.did : undefined;
      return { wallet, deviceId, token, tokenFp: tokenFingerprint(token), expiresAt: typeof p.exp === 'number' ? p.exp * 1000 : Date.now() + 7 * 864e5 };
    } catch {
      /* try the next cookie */
    }
  }
  return null;
}
