/**
 * lib/security/key-hierarchy.ts
 *
 * Formally codifies the 4-level cryptographic key hierarchy of Humanity Ledger
 * and handles key rotation and revocation policies (Fortification Items 9, 10, 23, 40).
 *
 * Key Hierarchy:
 *   Level 1: Master Identity Key (Client-side Ed25519 / MLS Identity Key)
 *   Level 2: Aztec Account Spending Key (Schnorr field element over BN254 / Grumpkin)
 *   Level 3: Scoped Nullifier Derivation Keys (Poseidon2 / Pedersen deterministic fields)
 *   Level 4: Ephemeral Viewing & Messaging Session Keys (Ratchet keys, max 100 msgs or 24 hours)
 */

export interface KeyInventoryEntry {
  keyType: 'MASTER_IDENTITY' | 'AZTEC_SPENDING' | 'NULLIFIER_KEY' | 'SESSION_VIEWING';
  algorithm: string;
  lifetime: string;
  storageLocation: string;
  rotationPolicy: string;
}

export const CANONICAL_KEY_INVENTORY: KeyInventoryEntry[] = [
  {
    keyType: 'MASTER_IDENTITY',
    algorithm: 'Ed25519 (RFC 8032) / MLS RFC 9420',
    lifetime: 'Long-term (1 year recommended rotation or on device loss)',
    storageLocation: 'Hardware Secure Enclave / WebAuthn / Passphrase-encrypted IndexedDB',
    rotationPolicy: 'Explicit re-key via MLS KeyPackage and multi-device consensus',
  },
  {
    keyType: 'AZTEC_SPENDING',
    algorithm: 'Schnorr / BN254 Fr Field Scalar',
    lifetime: 'Client-side lifecycle (never persisted unencrypted)',
    storageLocation: 'Ephemeral memory during active session; zeroed on unmount',
    rotationPolicy: 'Note transfer to fresh Aztec Schnorr account address',
  },
  {
    keyType: 'NULLIFIER_KEY',
    algorithm: 'Pedersen / Poseidon2 Hash over BN254',
    lifetime: 'Per-action or per-epoch deterministic derivation',
    storageLocation: 'Derived strictly on-demand from spending secret + salt',
    rotationPolicy: 'Automatic per-nullifier epoch domain separation',
  },
  {
    keyType: 'SESSION_VIEWING',
    algorithm: 'X25519 / ChaCha20-Poly1305',
    lifetime: 'Maximum 100 messages or 24 hours (whichever comes first)',
    storageLocation: 'Ephemeral client memory (never saved to disk)',
    rotationPolicy: 'Automated TreeKEM ratchet advance upon message counter expiration',
  },
];

/**
 * Checks if a session key requires automated rotation based on message count or age.
 */
export function requiresKeyRotation(messageCount: number, createdAtTimestampMs: number, maxMessages = 100, maxAgeMs = 24 * 3600 * 1000): boolean {
  if (messageCount >= maxMessages) return true;
  if (Date.now() - createdAtTimestampMs >= maxAgeMs) return true;
  return false;
}
