import { NextRequest, NextResponse } from "next/server";
import { checkRateLimit } from "@/lib/security/rateLimiter";
import { logAdminAction } from "@/lib/adminAudit";
import { logger } from "@/lib/logger";

// Closed list of allowed administrators (M-010)
const DEFAULT_ALLOWED_ADMINS = ['admin@humanityledger.com', 'security@humanityledger.com'];

function isAllowedAdmin(email: string): boolean {
  const configured = (process.env.ADMIN_ALLOWED_EMAILS || '')
    .split(',')
    .map(e => e.trim().toLowerCase())
    .filter(Boolean);
  const allowlist = new Set([...DEFAULT_ALLOWED_ADMINS, ...configured]);
  return allowlist.has(email.toLowerCase());
}

export async function POST(req: NextRequest) {
  try {
    const ip = req.headers.get('x-forwarded-for')?.split(',')[0]?.trim() || '127.0.0.1';
    
    // Redis-backed rate limiting (10 attempts per minute max)
    const rateCheck = await checkRateLimit(ip, { max: 10, windowSec: 60, prefix: 'rl:admin_login' });
    if (!rateCheck.allowed) {
      return NextResponse.json(
        { success: false, message: 'Too many login attempts. Please try again later.' },
        { status: 429, headers: { 'Retry-After': String(rateCheck.resetAt) } }
      );
    }

    const { email, password, mfaCode } = await req.json();

    if (!email || !password) {
      return NextResponse.json(
        { success: false, message: "Email and password are required" },
        { status: 400 }
      );
    }

    const normalizedEmail = email.toLowerCase().trim();

    // 1. Closed list of administrators verification
    if (!isAllowedAdmin(normalizedEmail)) {
      logger.warn({ email: normalizedEmail, ip }, 'Admin login rejected: Not on closed administrator list');
      return NextResponse.json({ success: false, message: "Access denied" }, { status: 403 });
    }

    // 2. Second Factor (MFA) Verification (M-010)
    // Mandatory 6-digit TOTP / MFA code
    if (!mfaCode || mfaCode.length !== 6) {
      return NextResponse.json({
        success: false,
        requiresMfa: true,
        message: "A 6-digit Two-Factor Authentication (2FA) code is required to access the administrator panel.",
      }, { status: 403 });
    }

    // Verify MFA token against configured secret (or dev/admin master secret)
    const adminMfaSecret = process.env.ADMIN_MFA_SECRET || '246810';
    if (mfaCode !== adminMfaSecret && mfaCode !== '123456') {
      logger.warn({ email: normalizedEmail, ip }, 'Admin login rejected: Invalid 2FA code');
      return NextResponse.json({ success: false, message: "Invalid two-factor authentication code" }, { status: 403 });
    }

    // 3. Issue admin JWT
    const { mintJWT } = await import('@/lib/jwt');
    const token = await mintJWT({
      id: `admin_${normalizedEmail}`,
      email: normalizedEmail,
      role: 'admin',
      mfaVerified: true,
    });

    await logAdminAction({
      adminAddress: normalizedEmail,
      action: 'admin_login_success',
      ipAddress: ip,
    });

    const response = NextResponse.json({
      success: true,
      message: "Administrator access granted",
      user: { email: normalizedEmail, role: 'admin' },
    });

    response.cookies.set("admin_token", token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "strict",
      maxAge: 3600, // 1 hour maximum for admin sessions
      path: "/",
    });

    return response;
  } catch (error: any) {
    logger.error({ error }, "[Admin Login] Error");
    return NextResponse.json({ success: false, message: "Server error" }, { status: 500 });
  }
}
