import { prisma } from '@/lib/prisma';
import { deriveAztecAddress } from '@/lib/aztec/zk-identity';

/**
 * identity-gate.ts — Humanity Ledger Supply Gate
 * ─────────────────────────────────────────────
 * Enforces the hard cap of 200 unique identities on the Aztec Mainnet.
 *
 * Only wallets that have CLAIMED one of the 200 genesis airdrops are
 * considered "verified identities" and are granted full domain access.
 *
 * Attack surface closed (as described by Axel Maisonneuve):
 *  - Proxy flooding: creating thousands of wallets to spam pages
 *    → No airdrop claim = no identity = zero access to protected routes.
 *  - Rate-limit bypass via IP rotation:
 *    → The DB check is against SIGNED transactions, not IPs.
 *    → A signed airdrop claim is cryptographically tied to the wallet.
 *  - Page flooding across tabs:
 *    → Every sensitive API call verifies identity server-side.
 *    → No client-side state can fake a verified identity.
 *
 * This is enforced at TWO levels:
 *  1. API route level (via isVerifiedIdentity / assertVerifiedIdentity)
 *  2. The 200-supply airdrop route itself (already gated in /api/aztec/airdrop)
 *
 * Public routes (/, /sign-in, /api/auth/*) remain accessible to everyone.
 * Protected routes (/portfolio, /qds, /chat, etc.) require a verified identity.
 */

export const IDENTITY_SUPPLY_CAP = Number(process.env.IDENTITY_CAP ?? 200);

/**
 * Core check: returns true if the given aztec OR evm address has ever
 * received a completed AIRDROP — meaning they signed and are one of the
 * 200 unique identities.
 *
 * Both the Aztec-derived address (0x + sha256×2) and the raw EVM address
 * are checked because the airdrop can be stored against either format.
 *
 * Timing: single indexed DB query (~1-2ms on Railway Postgres).
 */
export async function isVerifiedIdentity(walletAddress: string): Promise<boolean> {
  if (!walletAddress) return false;
  const addr = walletAddress.toLowerCase().trim();

  // Compute the canonical Aztec-derived address for this EVM address
  // (same 2-round SHA-256 algorithm as /api/aztec/derive-address)
  const derivedAztec = deriveAztecAddress(addr);

  const claim = await prisma.transaction.findFirst({
    where: {
      token: 'QDs',
      type: 'AIRDROP',
      status: 'COMPLETED',
      OR: [
        { toAddress: addr },
        { toAddress: derivedAztec },
      ],
    },
    select: { id: true },
  });

  return !!claim;
}

/**
 * Returns a rich identity status object for a wallet.
 * Used in UI components and the /api/aztec/identity-status endpoint.
 */
export async function getIdentityStatus(walletAddress: string): Promise<{
  verified: boolean;
  aztecAddress?: string;
  claimTxHash?: string;
  claimedAt?: Date;
  totalClaimed: number;
  remaining: number;
  capReached: boolean;
}> {
  const totalClaimed = await prisma.transaction.count({
    where: { token: 'QDs', type: 'AIRDROP', status: 'COMPLETED' },
  });

  const remaining = Math.max(0, IDENTITY_SUPPLY_CAP - totalClaimed);
  const capReached = totalClaimed >= IDENTITY_SUPPLY_CAP;

  if (!walletAddress) {
    return { verified: false, totalClaimed, remaining, capReached };
  }

  const addr = walletAddress.toLowerCase().trim();
  const derivedAztec = deriveAztecAddress(addr);

  const claim = await prisma.transaction.findFirst({
    where: {
      token: 'QDs',
      type: 'AIRDROP',
      status: 'COMPLETED',
      OR: [
        { toAddress: addr },
        { toAddress: derivedAztec },
      ],
    },
    select: { id: true, toAddress: true, txHash: true, timestamp: true },
  });

  return {
    verified: !!claim,
    aztecAddress: claim?.toAddress ?? derivedAztec,
    claimTxHash: claim?.txHash ?? undefined,
    claimedAt: claim?.timestamp ?? undefined,
    totalClaimed,
    remaining,
    capReached,
  };
}

/**
 * Asserts that the wallet is a verified identity.
 * Throws a typed Error (to be caught by the API route handler) if not.
 * Use this at the top of ALL sensitive API routes.
 *
 * @example
 *   const session = await getSession();
 *   await assertVerifiedIdentity(session?.userId);
 */
export async function assertVerifiedIdentity(walletAddress: string | undefined): Promise<void> {
  if (!walletAddress) {
    throw Object.assign(
      new Error('Authentication required: No session found.'),
      { statusCode: 401 }
    );
  }
  const verified = await isVerifiedIdentity(walletAddress);
  if (!verified) {
    throw Object.assign(
      new Error(
        'Access denied: You are not a verified Humanity Ledger identity. '
        + 'Claim your genesis airdrop to gain access (limited to 200 global identities).'
      ),
      { statusCode: 403, code: 'NOT_VERIFIED_IDENTITY' }
    );
  }
}
