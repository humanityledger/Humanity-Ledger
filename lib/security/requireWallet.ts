import { NextRequest, NextResponse } from 'next/server';
import { getSession } from '@/lib/session';
import { prisma } from '@/lib/prisma';

const ETH_ADDR_REGEX = /^0x[a-fA-F0-9]{40}$/;

export interface RequireWalletSuccess {
  walletAddress: string;
  userId: string;
  isEmailUser: boolean;
  errorResponse?: never;
}

export interface RequireWalletFailure {
  walletAddress?: never;
  userId?: never;
  isEmailUser?: never;
  errorResponse: NextResponse;
}

export type RequireWalletResult = RequireWalletSuccess | RequireWalletFailure;

/**
 * requireWallet
 * 
 * Strict cryptographic identity resolution from session only.
 * 
 * Rules:
 * 1. Checks session via getSession(). If no valid session -> returns 401 Unauthorized.
 * 2. If session.userId is an Ethereum address -> returns normalized lowercase address.
 * 3. If session.userId is a UUID (email account) -> resolves linked walletAddress from prisma.authUser.
 *    - If linked walletAddress is found -> returns normalized lowercase address.
 *    - If no linked walletAddress -> returns 403 Forbidden ("Wallet connection required").
 * 4. Never trusts client-injected headers (x-web3-address, x-wallet-address, etc.) or query params.
 */
export async function requireWallet(req?: NextRequest | Request): Promise<RequireWalletResult> {
  const session = await getSession();

  if (!session || !session.userId) {
    return {
      errorResponse: NextResponse.json(
        { error: 'Unauthorized: Valid session required' },
        { status: 401 }
      ),
    };
  }

  const rawUserId = session.userId.trim();

  // Case 1: SIWE / Direct Wallet Address
  if (ETH_ADDR_REGEX.test(rawUserId)) {
    return {
      walletAddress: rawUserId.toLowerCase(),
      userId: rawUserId.toLowerCase(),
      isEmailUser: false,
    };
  }

  // Case 2: UUID / Email User
  if (rawUserId.includes('-') && rawUserId.length > 30) {
    try {
      const authUser = await prisma.authUser.findUnique({
        where: { id: rawUserId },
        select: { walletAddress: true, email: true },
      });

      if (authUser?.walletAddress && ETH_ADDR_REGEX.test(authUser.walletAddress)) {
        return {
          walletAddress: authUser.walletAddress.toLowerCase(),
          userId: rawUserId,
          isEmailUser: true,
        };
      }
    } catch (dbError) {
      console.error('[requireWallet] Database error resolving authUser:', dbError);
    }

    // Email user without connected wallet
    return {
      errorResponse: NextResponse.json(
        { error: 'Forbidden: A connected Web3 wallet is required for this action' },
        { status: 403 }
      ),
    };
  }

  // Any other non-standard identity that isn't an Ethereum wallet
  return {
    errorResponse: NextResponse.json(
      { error: 'Forbidden: Invalid or unsupported wallet identity' },
      { status: 403 }
    ),
  };
}
