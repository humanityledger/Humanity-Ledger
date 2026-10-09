import { NextRequest, NextResponse } from 'next/server';

/**
 * GET /api/auth/verify-session
 *
 * [UNIVERSAL SESSION VERIFICATION]
 * Checks ALL valid session token types used across the system:
 *   - ledger_session   : JWT from system-verify (MetaMask/Rainbow/Wagmi connect)
 *   - human_session   : JWT from qr-hydrate or system-verify
 *   - humanity_session: JWT from SIWE flow (P2-C.1 Identity Adapter)
 *   - system_handshake: raw 0x address (QR mobile handshake, fast path)
 *   - human.session-token: NextAuth JWT (Google OAuth, Email OTP via NextAuth)
 *
 * Priority order:
 *   1. Verify ledger_session / human_session JWT cryptographically.
 *   2. If JWT valid → session authentic. Heal system_handshake if missing.
 *   3. If JWT invalid/missing → check NextAuth session (Google OAuth).
 *   4. If NextAuth valid → authenticated. Heal system_handshake with email_ prefix.
 *   5. Otherwise → 401 Unauthenticated.
 *
 * Also checks for humanity_session (SIWE P2-C.1) as supplementary identity context.
 */
export async function GET(request: NextRequest) {
    try {
        const ledgerSession = request.cookies.get('ledger_session')?.value;
        const humanSession = request.cookies.get('human_session')?.value;
        const humanitySession = request.cookies.get('humanity_session')?.value;
        const handshake    = request.cookies.get('system_handshake')?.value;
        const primaryJwt   = ledgerSession || humanSession || humanitySession;

        const isProd      = process.env.NODE_ENV === 'production';
        const appUrl      = process.env.NEXT_PUBLIC_APP_URL || '';
        const cookieDomain = (isProd && appUrl)
            ? (() => { try { return new URL(appUrl).hostname; } catch { return undefined; } })()
            : undefined;

        // ─── Priority 1: Cryptographic JWT verification ────────────────────────
        if (primaryJwt) {
            try {
                const { verifyJWT } = await import('@/lib/jwt');
                const payload = await verifyJWT(primaryJwt);
                const address = (payload.walletAddress || payload.address || payload.sub) as string;

                if (address) {
                    // JWT is cryptographically valid → session is authentic.
                    // Additionally, check for humanity_session (P2-C.1 Identity Adapter)
                    // to expose supplementary identity context to the client.
                    let humanityIdentity: { address: string; sessionId: string } | null = null;
                    const humanityCookie = request.cookies.get('humanity_session')?.value;
                    if (humanityCookie) {
                        try {
                            const humanityPayload = await verifyJWT(humanityCookie) as any;
                            if (humanityPayload.sub && humanityPayload.sid) {
                                humanityIdentity = {
                                    address: ((humanityPayload.walletAddress || humanityPayload.address || humanityPayload.sub) as string).toLowerCase(),
                                    sessionId: humanityPayload.sessionId || humanityPayload.sid || '',
                                };
                            }
                        } catch {
                            // humanity_session invalid/expired — not critical, legacy session is still valid
                        }
                    }

                    const res = NextResponse.json({
                        authenticated: true,
                        user: { address, tier: payload.tier ?? 'FREE' },
                        // Supplementary SIWE identity context (null if not on P2-C.1 SIWE flow)
                        humanityIdentity,
                    });

                    // [HEAL] If system_handshake was missing, restore it now so
                    // client-side guards (useSystemAccount, TitaniumGate, etc.)
                    // can read it from document.cookie on the next render.
                    if (!handshake || !handshake.startsWith('0x')) {
                        console.info('[verify-session] Valid JWT but missing handshake — healing cookie for:', address);
                        res.cookies.set('system_handshake', address.toLowerCase(), {
                            httpOnly: false,
                            secure: isProd,
                            sameSite: 'lax',
                            maxAge: 604800,
                            path: '/',
                            domain: cookieDomain,
                        });
                    }

                    return res;
                }
            } catch {
                // JWT is invalid or expired — fall through to purge stale cookies.
            }

            // JWT existed but failed verification → purge it (true zombie session).
            console.warn('[verify-session] Stale/invalid JWT detected. Purging cookies.');
            const res = NextResponse.json({ authenticated: false }, { status: 401 });
            const expiredDate = 'Thu, 01 Jan 1970 00:00:00 GMT';
            const secure = isProd ? '; Secure' : '';
            for (const name of ['ledger_session', 'human_session', 'humanity_session', 'siwe_session']) {
                res.headers.append('Set-Cookie', `${name}=; Path=/; Expires=${expiredDate}; HttpOnly${secure}; SameSite=Strict`);
                res.headers.append('Set-Cookie', `${name}=; Path=/; Expires=${expiredDate}; HttpOnly${secure}; SameSite=Lax`);
            }
            return res;
        }

        // ─── Priority 2: NextAuth Session (Google OAuth / Email OTP via NextAuth) ──
        // Handles users who signed in via Google OAuth.
        // The NextAuth HttpOnly token is verified by getServerSession() server-side.
        try {
            const { getServerSession } = await import('next-auth');
            const { authOptions } = await import('@/lib/auth');
            const nextAuthSession = await getServerSession(authOptions);

            if (nextAuthSession?.user?.email) {
                const email = nextAuthSession.user.email;
                const emailId = `email_${email.toLowerCase().replace(/[^a-z0-9@._-]/g, '')}`;

                const res = NextResponse.json({
                    authenticated: true,
                    user: { address: emailId, email, tier: 'FREE', authType: 'google_oauth' }
                });

                // Heal the JS-readable handshake cookie for client-side guards
                const needsHeal = !handshake || (!handshake.startsWith('0x') && !handshake.startsWith('email_'));
                if (needsHeal) {
                    res.cookies.set('system_handshake', emailId, {
                        httpOnly: false,
                        secure: isProd,
                        sameSite: 'lax',
                        maxAge: 7 * 24 * 60 * 60,
                        path: '/',
                        domain: cookieDomain,
                    });
                }

                return res;
            }
        } catch (nextAuthError) {
            // NextAuth not available or session invalid — continue to unauthenticated
            console.debug('[verify-session] NextAuth check skipped:', String(nextAuthError).substring(0, 80));
        }

        // ─── Priority 3: [REMOVED INSECURE FALLBACK] ─────────────
        // The system_handshake cookie alone is NOT trusted for auth bypass.
        // All sessions MUST be cryptographically verified via SIWE/JWT or NextAuth.

        return NextResponse.json(
            { authenticated: false },
            { status: 401 }
        );

    } catch (error) {
        console.error('[verify-session] Error:', error);
        return NextResponse.json(
            { authenticated: false },
            { status: 500 }
        );
    }
}
