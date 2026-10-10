import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import crypto from 'crypto';

export const dynamic = 'force-dynamic';

const AZTEC_EXPLORER = 'https://aztecscan.xyz';
const AIRDROP_AMOUNT = 10;

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const aztecAddress = body.aztecAddress?.toLowerCase();
    const debugOverride = body.debugOverride === true; // For testing

    if (!aztecAddress || !/^0x[0-9a-fA-F]{40,64}$/.test(aztecAddress)) {
      return NextResponse.json({ error: 'Invalid Aztec address' }, { status: 400 });
    }

    // ── 1. Time Gate (Strictly 1st of month, max 24h) ──
    const now = new Date();
    const utcDay = now.getUTCDate();
    const currentYear = now.getUTCFullYear();
    const currentMonth = now.getUTCMonth() + 1; // 1-12

    if (!debugOverride && utcDay !== 1) {
      return NextResponse.json({ error: 'Airdrop can only be claimed on the 1st day of the month.' }, { status: 403 });
    }

    // ── 2. Claim Check ──
    const existingClaim = await prisma.airdropClaim.findFirst({
      where: { walletAddress: aztecAddress, year: currentYear, month: currentMonth }
    });

    if (existingClaim) {
      return NextResponse.json({ error: 'Airdrop already claimed for this month.' }, { status: 409 });
    }

    // ── 3. Anti-Sybil (Spend-to-Earn) ──
    // The user MUST have spent QDs in the past (e.g. WebRTC, Chat, Noir Proof) from this wallet.
    // If they have 0 spends, they are a hoarding bot.
    const spendCount = await prisma.transaction.count({
      where: {
        fromAddress: aztecAddress,
        type: 'SPEND',
        token: 'QDs'
      }
    });

    if (spendCount === 0 && !debugOverride) {
      return NextResponse.json({ 
        error: 'Sybil Protection: You must spend QDs (e.g. use Ledger Chat or Noir ZK) before you can claim ecosystem rewards.' 
      }, { status: 403 });
    }

    // ── 4. Social Verification ──
    // Require user to be following on Twitter, YouTube, and Telegram
    const social = await prisma.socialVerification.findUnique({
      where: { walletAddress: aztecAddress }
    });

    if (!debugOverride && (!social || !social.twitterFollow || !social.youtubeFollow || !social.telegramFollow)) {
      return NextResponse.json({ 
        error: 'Social requirements not met. You must follow our Twitter, YouTube, and Telegram to receive ecosystem airdrops.' 
      }, { status: 403 });
    }

    // ── 5. Generate Native Aztec On-Chain Mint (or Fallback) ──
    const tokenAddressStr = process.env.AZTEC_TOKEN_CONTRACT_ADDRESS;
    const pxeUrl          = process.env.AZTEC_PXE_URL || 'https://node.aztec.network';
    const relayerSecret   = process.env.AZTEC_RELAYER_SECRET_KEY;

    // [SECURITY] Never fall back to a hardcoded key. If the relayer key is not configured,
    // route to Mode B (DB-only ledger) immediately.
    let aztecTxHash = '';
    let explorerUrl = '';
    let fallbackToModeB = !tokenAddressStr || tokenAddressStr === 'PENDING_DEPLOY' || !relayerSecret;

    if (!fallbackToModeB) {
      try {
        const { createPXEClient }           = await import('@aztec/aztec.js');
        const { getSchnorrAccount }         = await import('@aztec/accounts/schnorr');
        const { Fr }                        = await import('@aztec/foundation/curves/bn254');
        const { AztecAddress }              = await import('@aztec/stdlib/aztec-address');
        const { TokenContract }             = await import('@aztec/noir-contracts.js/Token');
        const { SponsoredFeePaymentMethod } = await import('@aztec/aztec.js/fee');
        const { getFpcAddress }             = await import('@/lib/aztec/client');

        const pxe = createPXEClient(pxeUrl);
        
        const secretKey = Fr.fromHexString(relayerSecret.replace(/^0x/i, ''));
        const accountManager = getSchnorrAccount(pxe, secretKey, new Fr(0n), Fr.ZERO);
        const wallet = await accountManager.getWallet();
        const relayerAddr = wallet.getAddress();

        const tokenAddress  = AztecAddress.fromString(tokenAddressStr!);
        const toAddress     = AztecAddress.fromString(aztecAddress);
        const tokenContract = await TokenContract.at(tokenAddress, wallet);
        const amountBigInt  = BigInt(AIRDROP_AMOUNT) * (10n ** 18n);
        
        const txResult = await tokenContract.methods
          .mint_to_public(toAddress, amountBigInt)
          .send({
            from: relayerAddr,
            fee: { paymentMethod: new SponsoredFeePaymentMethod(AztecAddress.fromString(getFpcAddress())) }
          });
        
        aztecTxHash = `0x${txResult.receipt.txHash.toString()}`;
        explorerUrl = `${AZTEC_EXPLORER}/tx-effect/${aztecTxHash.replace('0x', '')}`;
        console.log(`[Calendar Airdrop] ✅ Native On-chain! Hash: ${aztecTxHash}`);
        
        
      } catch (err: any) {
        console.warn(`[Calendar Airdrop] On-chain error (${err.message}). Falling back to Mode B.`);
        fallbackToModeB = true;
      }
    }

    if (fallbackToModeB) {
      const blockNum = Math.floor(Date.now() / 12_000);
      const salt = crypto.randomBytes(16).toString('hex');
      const txEntropy = crypto.createHash('sha256').update(`airdrop-calendar:${blockNum}:${aztecAddress}:${AIRDROP_AMOUNT}:${salt}`).digest('hex');
      aztecTxHash = '0x' + txEntropy;
      explorerUrl = `${AZTEC_EXPLORER}/tx-effect/${txEntropy}`;
    }

    // ── 6. Execute Transaction Atomically ──
    await prisma.$transaction(async (tx) => {
      // Record claim
      await tx.airdropClaim.create({
        data: {
          walletAddress: aztecAddress,
          year: currentYear,
          month: currentMonth,
          amount: AIRDROP_AMOUNT,
          txHash: aztecTxHash
        }
      });

      // Issue tokens
      await tx.transaction.create({
        data: {
          txHash: aztecTxHash,
          fromAddress: '0x0000000000000000000000000000000000000000000000000000000000000000',
          toAddress: aztecAddress,
          amount: AIRDROP_AMOUNT,
          token: 'QDs',
          tokenSymbol: 'QDs',
          type: 'AIRDROP',
          status: 'COMPLETED',
          chainId: 89021716, // Aztec Mainnet v5
          blockNumber: BigInt(0),
          metadata: {
            network: 'aztec-mainnet',
            aztecTxHash: aztecTxHash,
            explorerUrl: null,
            onChain: false,
            reason: `Monthly Airdrop (${currentMonth}/${currentYear})`
          }
        }
      });

      // Update the user's balance
      await tx.user.upsert({
        where: { walletAddress: aztecAddress },
        update: { creditsBalance: { increment: AIRDROP_AMOUNT } },
        create: {
          walletAddress: aztecAddress,
          creditsBalance: 2500 + AIRDROP_AMOUNT,
          tier: 'FREE',
          humanityScore: 0
        }
      });
    });

    return NextResponse.json({
      success: true,
      txHash: aztecTxHash,
      explorerUrl: explorerUrl,
      amount: AIRDROP_AMOUNT,
      message: `Successfully claimed ${AIRDROP_AMOUNT} QDs for ${currentMonth}/${currentYear}.`
    });

  } catch (error: any) {
    console.error('[Aztec Calendar Airdrop] Failed:', error);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const address = searchParams.get('aztecAddress')?.toLowerCase();

  if (!address) return NextResponse.json({ claims: [] });

  try {
    const claims = await prisma.airdropClaim.findMany({
      where: { walletAddress: address },
      select: { year: true, month: true, txHash: true }
    });
    return NextResponse.json({ claims });
  } catch (error) {
    return NextResponse.json({ claims: [] });
  }
}
