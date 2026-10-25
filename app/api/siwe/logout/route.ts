import { NextResponse } from 'next/server';

function terminateSessionResponse() {
  const res = NextResponse.json({ ok: true, message: 'System session terminated.' });

  const isProd = process.env.NODE_ENV === 'production';
  const expiredDate = 'Thu, 01 Jan 1970 00:00:00 GMT';
  const secure = isProd ? '; Secure' : '';

  // Comprehensive session cookie purging across all protocol variants
  const cookiesToClear = [
    'hl_session',          // Primary B-007 session
    'hl_refresh',          // Refresh token
    'ledger_session',      // Legacy SIWE / QR token
    'human_session',       // Compatibility session
    'humanity_session',    // Identity adapter token
    'siwe-nonce',          // Active nonce challenge
    'human.session-token', // NextAuth session
    'human.access-token',
    'human.refresh-token',
    'wallet-auth',         // Client address
    'system_handshake',    // Client handshake
  ];

  for (const name of cookiesToClear) {
    // Delete with SameSite=Strict
    res.headers.append('Set-Cookie', `${name}=; Path=/; Expires=${expiredDate}; HttpOnly${secure}; SameSite=Strict`);
    // Delete with SameSite=Lax
    res.headers.append('Set-Cookie', `${name}=; Path=/; Expires=${expiredDate}; HttpOnly${secure}; SameSite=Lax`);
    // Delete non-httpOnly variant (for system_handshake, wallet-auth)
    res.headers.append('Set-Cookie', `${name}=; Path=/; Expires=${expiredDate}${secure}; SameSite=Lax`);
    res.headers.append('Set-Cookie', `${name}=; Path=/; Expires=${expiredDate}${secure}; SameSite=Strict`);
  }

  return res;
}

export async function GET() {
  return terminateSessionResponse();
}

export async function POST() {
  return terminateSessionResponse();
}
