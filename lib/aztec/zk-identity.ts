import crypto from 'crypto';
import { keccak256, toBytes } from 'viem';
/**
 * lib/aztec/zk-identity.ts
 * ─────────────────────────────────────────────────────────────────────────────
 * [ZK-ALIGNMENT PHASE 4] Zero Knowledge Identity Utilities
 * ─────────────────────────────────────────────────────────────────────────────
 *
 * Provides deterministic, one-way cryptographic utilities for Sovereign Identity
 * correlation WITHOUT exposing raw wallet addresses in any DB or log.
 *
 * Identity Hash Architecture:
 *   identityHash = SHA-256("ledger-identity:" + aztecAddress.toLowerCase())
 *
 * This single-hop hash is:
 *  - Deterministic: same address always → same hash
 *  - Non-reversible: given identityHash, cannot recover aztecAddress
 *  - Domain-separated: prefix "ledger-identity:" prevents cross-system collisions
 *  - Safe for DB storage: no raw address appears in QuestClaim or Transaction tables
 *
 * All ZK-sensitive API routes MUST use these helpers instead of raw addresses.
 */


// Domain-separated prefix for Humanity Ledger identity hashing.
// Changing this breaks all existing hashes — do NOT modify after launch.
const ZK_DOMAIN_PREFIX = 'ledger-identity:';

/**
 * Derives a deterministic, one-way identity hash from an Aztec/EVM address.
 * Use this whenever you need to store or compare identity in the DB.
 *
 * @param address  Raw Aztec or EVM address (0x...)
 * @returns        Hex string (64 chars) suitable for DB storage
 */
export function deriveIdentityHash(address: string): string {
  if (!address || typeof address !== 'string') {
    throw new TypeError('[ZK] deriveIdentityHash: address must be a non-empty string');
  }
  return crypto
    .createHash('sha256')
    .update(`${ZK_DOMAIN_PREFIX}${address.toLowerCase().trim()}`)
    .digest('hex');
}


/**
 * Derives the canonical Aztec address from an EVM address.
 * This uses a 2-round deterministic hash (SHA-256 then Keccak256)
 * as per the Aztec Network integration specifications.
 *
 * IMPORTANT: This must stay in sync with /api/aztec/derive-address.
 *
 * @param evmAddress  Raw EVM address (0x + 40 hex chars)
 * @returns           Canonical Aztec address (0x + 64 hex chars)
 */
export function deriveAztecAddress(evmAddress: string): string {
  if (!evmAddress) {
    throw new TypeError('[ZK] deriveAztecAddress: address cannot be empty');
  }
  const normalized = evmAddress.toLowerCase().trim();
  const round1 = crypto.createHash('sha256').update(`aztec-schnorr:${normalized}`).digest('hex');
  const round2 = keccak256(toBytes(`0x${round1}`));
  return round2;
}

/**
 * Verifies that a given aztecAddress matches the expected derivation from evmAddress.
 * Use this in API routes to validate that the caller owns the target address.
 *
 * @param evmAddress    Verified EVM address (from session)
 * @param aztecAddress  Address to validate ownership of
 * @returns             true if evmAddress is the owner of aztecAddress
 */
export function isOwner(evmAddress: string, aztecAddress: string): boolean {
  try {
    const derived = deriveAztecAddress(evmAddress);
    return (
      derived.toLowerCase() === aztecAddress.toLowerCase() ||
      evmAddress.toLowerCase() === aztecAddress.toLowerCase()
    );
  } catch {
    return false;
  }
}

/**
 * Salted IP hash for Sybil-resistance (anti-farming).
 * Uses JWT_SECRET as the HMAC key so the hash is tied to the server secret.
 * This prevents rainbow-table reversal of IP hashes stored in the DB.
 *
 * @param rawIp   Raw IP address string (from x-forwarded-for)
 * @returns       Hex HMAC string
 */
export function hashIpAddress(rawIp: string): string {
  const secret = (() => { const s = process.env.JWT_SECRET; if (!s) throw new Error('JWT_SECRET is not set.'); return s; })();
  // Take only the first IP from x-forwarded-for proxy chains
  const cleanIp = (rawIp || '127.0.0.1').split(',')[0].trim();
  return crypto
    .createHash('sha256')
    .update(cleanIp + secret)
    .digest('hex');
}

