import { toBytes, type Address, type TypedDataDomain } from 'viem';
import crypto from 'crypto';

export const AZTEC_DOMAIN: TypedDataDomain = {
  name: 'Humanity Ledger',
  version: '1',
  chainId: 2151908, // Aztec L1 Sepolia
};

export const EIP712_STATEMENT = {
  DeriveAccount: [
    { name: 'action', type: 'string' },
    { name: 'warning', type: 'string' },
    { name: 'nonce', type: 'uint256' }
  ]
} as const;

/**
 * Deterministically derives an Aztec Secret Key from an EIP-712 signature.
 * This replaces the custodial sha256(address + JWT_SECRET) implementation.
 */
export function deriveAztecSecretKey(signatureHex: string): string {
  const signatureBytes = toBytes(signatureHex);
  const info = new TextEncoder().encode('aztec-hl-secret-key-v1');
  
  // Derive 32 bytes of entropy using Node.js native crypto
  const derivedKey = crypto.hkdfSync('sha256', signatureBytes, '', info, 32);
  
  // Anti-Lazarus: Immediately wipe signature bytes from heap
  signatureBytes.fill(0);

  const hex = Buffer.from(derivedKey).toString('hex');
  
  // Wipe derivedKey buffer
  if (Buffer.isBuffer(derivedKey)) {
    derivedKey.fill(0);
  } else if (derivedKey instanceof Uint8Array) {
    (derivedKey as Uint8Array).fill(0);
  }
  
  // Ensure it fits cleanly in Fr by clearing the top bits
  const padded = '00' + hex.slice(2);
  return '0x' + padded;
}


