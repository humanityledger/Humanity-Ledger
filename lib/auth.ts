import { prisma } from "@/lib/prisma";
import { headers } from "next/headers";
import bcrypt from "bcryptjs";
import { NextAuthOptions } from "next-auth";
import GoogleProvider from "next-auth/providers/google";

/**
 * Cryptographic AUTH UTILITIES
 */

export function isValidEmail(email: string): boolean {
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  return emailRegex.test(email);
}

export function isValidPassword(password: string): { valid: boolean; error?: string } {
  // Sovereign requirement: min 8 chars, 1 uppercase, 1 number
  if (password.length < 8) return { valid: false, error: 'Password must be at least 8 characters' };
  if (!/[A-Z]/.test(password)) return { valid: false, error: 'Password must contain at least one uppercase letter' };
  if (!/[0-9]/.test(password)) return { valid: false, error: 'Password must contain at least one number' };
  return { valid: true };
}

export async function hashPassword(password: string): Promise<string> {
  return bcrypt.hash(password, 12);
}

export async function verifyPassword(password: string, hash: string): Promise<boolean> {
  if (!password || !hash) return false;
  return bcrypt.compare(password, hash);
}

export function generateVerificationCode(): string {
  // Secure 6-digit numeric pin
  const { randomInt } = require('crypto');
  return randomInt(100000, 1000000).toString();
}

/**
 * Cryptographic AUTH CONFIGURATION (High Pro 3.1)
 * 
 * PURGED: Google, Email, and Password providers.
 * Only SIWE and QR Handshake identities are supported to ensure 
 * 100% non-custodial systemty.
 */
export const authOptions: NextAuthOptions = {
  providers: [
    // Providers are managed manually via SIWE and QR-Sync endpoints
    // to maintain absolute decoupling from third-party identity silos.
    // RESTORED: Google Provider strictly for the Status/Subscriptions portal
    GoogleProvider({
      clientId: process.env.GOOGLE_CLIENT_ID || "",
      clientSecret: process.env.GOOGLE_CLIENT_SECRET || "",
      authorization: {
        params: {
          // Request only email and profile (minimum scopes needed)
          scope: 'openid email profile',
          // Force account picker every time (security best practice)
          prompt: 'select_account',
        }
      }
    }),
  ],
  // Custom pages: use /connect as the sign-in page so Google OAuth
  // users land on our branded connect page, not NextAuth's default UI.
  pages: {
    signIn: '/connect',
    error: '/connect',  // Redirect auth errors to connect page
  },
  session: {
    strategy: "jwt",
    maxAge: 7 * 24 * 60 * 60, // 7 days
    updateAge: 24 * 60 * 60,  // Refresh session every 24 hours
  },
  cookies: {
    sessionToken: {
      name: 'human.session-token',
      options: {
        httpOnly: true,
        sameSite: 'strict',
        secure: process.env.NODE_ENV === 'production',
        maxAge: 7 * 24 * 60 * 60,
        path: '/',
      }
    }
  },
  callbacks: {
    async redirect({ url, baseUrl }) {
      // Security: Prevents Open Redirects (SSRF).
      // Only allow redirects to the same origin (baseUrl).
      if (url.startsWith("/")) return `${baseUrl}${url}`;
      else if (new URL(url).origin === baseUrl) return url;
      return baseUrl;
    },
    async jwt({ token, user, account, trigger }) {
      // On initial sign in
      if (trigger === 'signIn' || (user && account)) {
        try {
          const sessionId = crypto.randomUUID();
          token.sessionId = sessionId;

          const headersList = await headers();
          const ip = headersList.get('x-forwarded-for')?.split(',')[0] || '127.0.0.1';

          // Link to AuthUser if it exists (provisioned via SIWE or QR Sync)
          const authUser = await prisma.authUser.findFirst({
            where: { 
               OR: [
                 { email: token.email || 'REDACTED' },
                 { walletAddress: (token as any).address || '0x' }
               ]
            }
          });

          if (authUser) {
             await prisma.session.create({
               data: {
                 sessionToken: sessionId,
                 userId: authUser.id,
                 expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
                 ipAddress: ip,
               }
             });
          }
        } catch (error) {
          console.error("Error creating session record:", error);
        }
      }
      return token;
    },
    async session({ session, token }) {
      if (token.sessionId) {
        // @ts-ignore
        session.sessionId = token.sessionId;

        try {
          const dbSession = await prisma.session.findUnique({
            where: { sessionToken: token.sessionId as string },
          });

          if (!dbSession) {
            return {} as any;
          }

          // Use address from token/session if available
          session.user = {
            ...session.user,
            address: (token as any).address || (session as any).address,
          } as any;
        } catch (e) {
          console.error("Session verification failed", e);
        }
      }
      return session;
    },
  },
};

export async function verifyAdminSession(req: any): Promise<boolean> {
  try {
    const adminList = (process.env.ADMIN_ADDRESSES || process.env.ADMIN_WALLET_ADDRESS || process.env.OWNER_WALLET || '')
      .toLowerCase()
      .split(',')
      .map(a => a.trim())
      .filter(Boolean);
    if (adminList.length === 0) return false;
    const { getSession } = await import('@/lib/session');
    const session = await getSession();
    if (!session || !session.userId) return false;
    return adminList.includes(session.userId.toLowerCase());
  } catch {
    return false;
  }
}
