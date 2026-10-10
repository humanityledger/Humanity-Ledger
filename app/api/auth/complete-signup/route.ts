import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { hashPassword, isValidPassword } from '@/lib/auth';
import { cookies } from 'next/headers';
import { ethers } from 'ethers';

export const dynamic = 'force-dynamic';

export async function POST(request: NextRequest) {
  let body: any;
  try {
    body = await request.json();
    const { email, password, name, username, walletAddress, encryptedMnemonic, walletSalt } = body;

    if (!email || !password || !username) {
      return NextResponse.json(
        { error: 'Email, username and password are required' },
        { status: 400 }
      );
    }

    // Validate password
    const isValid = isValidPassword(password);
    if (!isValid) {
      return NextResponse.json(
        { error: 'Password does not meet requirements' },
        { status: 400 }
      );
    }

    // Hash password
    const passwordHash = await hashPassword(password);

    // [QUANTUM AEGIS] Zero-Trust Session Validation 
    // Prevent Account Takeover: Callers cannot pass an arbitrary email in the body.
    // They must have an active session for the email they are completing signup for.
    const { getSession } = await import('@/lib/session');
    const session = await getSession();
    
    if (!session || !session.email) {
      return NextResponse.json(
        { error: 'UNAUTHORIZED: Cryptographic session required to complete signup.' },
        { status: 401 }
      );
    }
    
    if (session.email !== email) {
      return NextResponse.json(
        { error: 'FORBIDDEN: You cannot complete signup for an email you do not own.' },
        { status: 403 }
      );
    }

    // Update user with password and marked as verified
    // Also store the generated wallet if provided
    const user = await (prisma.authUser as any).update({
      where: { email },
      data: {
        passwordHash,
        name: name || null,
        username: username, // [NEW] Elite Username
        verified: true,
        walletAddress: walletAddress || null,
        encryptedMnemonic: encryptedMnemonic || null,
        walletSalt: walletSalt || null
      }
    });

    // Create the associated User profile if it doesn't exist
    if (walletAddress) {
        try {
            await (prisma.user as any).upsert({
                where: { walletAddress },
                update: {
                    email,
                    name: name || null,
                    username: username, // [NEW] Synced Username
                },
                create: {
                    walletAddress,
                    email,
                    name: name || null,
                    username: username, // [NEW] Synced Username
                    tier: 'HUMAN', // Default to HUMAN for registered users
                }
            });
        } catch (e) {
            console.error('[Auth] Failed to create User profile:', e);
            // We don't fail the whole signup if just the user profile creation fails, 
            // but in production we'd want this to be atomic (transactional)
        }
    }

    // Generate access and refresh tokens
    const userAgent = request.headers.get('user-agent') || '';
    const ip = request.headers.get('x-forwarded-for') || request.headers.get('x-real-ip') || 'unknown';
    
    const { createAccessToken, createRefreshToken, setSessionCookies, generateFingerprint } = await import('@/lib/session');
    const fingerprint = generateFingerprint(userAgent, ip);
    
    const accessToken = await createAccessToken(user.id, user.email, fingerprint);
    const refreshToken = await createRefreshToken(user.id, user.email, fingerprint);

    // Set secure httpOnly cookies
    await setSessionCookies(accessToken, refreshToken);

    // Generate Airdrop Signature for CoreDots (500 QDs)
    let airdropSignature = null;
    if (walletAddress && process.env.AIRDROP_PRIVATE_KEY) {
        try {
            const adminWallet = new ethers.Wallet(process.env.AIRDROP_PRIVATE_KEY);
            const domain = {
                name: 'CoreAirdrop',
                version: '1',
                chainId: parseInt(process.env.NEXT_PUBLIC_CHAIN_ID || '137'), // Polygon Amoy/Mainnet default
                verifyingContract: process.env.NEXT_PUBLIC_AIRDROP_CONTRACT_ADDRESS || ethers.ZeroAddress
            };
            const types = {
                Claim: [
                    { name: 'wallet', type: 'address' },
                    { name: 'amount', type: 'uint256' }
                ]
            };
            const value = {
                wallet: walletAddress,
                amount: ethers.parseEther("500")
            };
            airdropSignature = await adminWallet.signTypedData(domain, types, value);
        } catch (err) {
            console.error('[Auth] Failed to generate airdrop signature:', err);
        }
    }

    return NextResponse.json({
      success: true,
      token: accessToken,
      user: {
        id: user.id,
        email: user.email,
        name: user.name
      },
      airdropSignature
    });

  } catch (error) {
    console.error('[Auth] Complete signup error:', error);
    console.error('[Auth] Error details:', {
      email: body?.email,
      errorMessage: 'Internal Server Error',
      stack: error instanceof Error ? error.stack : undefined
    });
    return NextResponse.json(
      { error: 'Failed to complete signup' },
      { status: 500 }
    );
  }
}

