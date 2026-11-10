/**
 * lib/aztec/wallet/keys.ts
 *
 * Derives the keys of a person's Aztec account from a signature by their own
 * Ethereum wallet. Runs in the browser only; nothing here is ever sent to our
 * server.
 *
 *   signature  = EIP-712 signature over WALLET_TYPED_DATA, by the user's wallet
 *   secret     = HKDF-SHA256(signature, info = "hl/aztec/v1/secret")    mod Fr
 *   salt       = HKDF-SHA256(signature, info = "hl/aztec/v1/salt")      mod Fr
 *   signingKey = HKDF-SHA256(signature, info = "hl/aztec/v1/signing")   mod Fq
 *
 * Standard wallets sign deterministically (RFC 6979), so the same Ethereum
 * account always recovers the same Aztec account on any device. The typed
 * data names the website and warns the user, because anyone who obtains this
 * signature can spend from the private wallet. That is why the warning is
 * part of the signed message itself.
 *
 * This replaces two earlier designs that were unsafe: deriving the Aztec key
 * from the public Ethereum address, and deriving it on the server.
 *
 * Aztec Alpha (mainnet) uses its own typed data (WALLET_TYPED_DATA_ALPHA), so
 * it derives a DIFFERENT account from the test network: a signature given on
 * the test network flow can never spend on Alpha, and the user sees which
 * network they are opening in the message they sign.
 *
 * Fee Juice claim secrets (lib/aztec/fee-juice.ts) are derived from the same
 * signature, so a deposit bridged from L1 can be claimed from any device:
 *   claimSecret[i] = HKDF-SHA256(signature, info = "hl/aztec/v1/fee-juice-claim/<i>") mod Fr
 */

/** Shape shared by the test network and Alpha typed data. */
export interface WalletTypedData {
  domain: { name: string; version: string };
  types: { PrivateWallet: readonly { name: string; type: string }[] };
  primaryType: 'PrivateWallet';
  message: { purpose: string; network: string; warning: string };
}

export const WALLET_TYPED_DATA = {
  domain: {
    name: 'Humanity Ledger',
    version: '1',
  },
  types: {
    PrivateWallet: [
      { name: 'purpose', type: 'string' },
      { name: 'network', type: 'string' },
      { name: 'warning', type: 'string' },
    ],
  },
  primaryType: 'PrivateWallet',
  message: {
    purpose: 'Open my private payments wallet in Ledger Chat',
    network: 'Aztec test network',
    warning: 'Only sign this on ledgerchat.org or on your own copy of Ledger Chat. Anyone who has this signature can spend from your private wallet.',
  },
} as const;

/** Aztec Alpha: real value. Different message, so a different account and different keys. */
export const WALLET_TYPED_DATA_ALPHA = {
  domain: WALLET_TYPED_DATA.domain,
  types: WALLET_TYPED_DATA.types,
  primaryType: 'PrivateWallet',
  message: {
    purpose: 'Open my private payments wallet in Ledger Chat',
    network: 'Aztec Alpha (Ethereum mainnet). Real funds.',
    warning: 'Only sign this on ledgerchat.org or on your own copy of Ledger Chat. Anyone who has this signature can spend from your private wallet.',
  },
} as const;

const enc = new TextEncoder();

function hexToBytes(hex: string): Uint8Array {
  const clean = hex.startsWith('0x') ? hex.slice(2) : hex;
  if (!/^[0-9a-fA-F]+$/.test(clean) || clean.length % 2 !== 0) throw new Error('Invalid signature.');
  const out = new Uint8Array(clean.length / 2);
  for (let i = 0; i < out.length; i++) out[i] = parseInt(clean.slice(i * 2, i * 2 + 2), 16);
  return out;
}

function bytesToBigInt(bytes: Uint8Array): bigint {
  let x = 0n;
  for (const b of bytes) x = (x << 8n) | BigInt(b);
  return x;
}

async function hkdf(ikm: Uint8Array, info: string, length: number): Promise<Uint8Array> {
  const key = await crypto.subtle.importKey('raw', ikm, 'HKDF', false, ['deriveBits']);
  const bits = await crypto.subtle.deriveBits(
    { name: 'HKDF', hash: 'SHA-256', salt: enc.encode('humanity-ledger/aztec-wallet'), info: enc.encode(info) },
    key,
    length * 8,
  );
  return new Uint8Array(bits);
}

/**
 * 48 bytes reduced modulo a ~254 bit prime: the bias is below 2^-128, which
 * is negligible.
 */
async function fieldElement(ikm: Uint8Array, info: string, modulus: bigint): Promise<bigint> {
  const x = bytesToBigInt(await hkdf(ikm, info, 48)) % modulus;
  if (x === 0n) throw new Error('Derived a zero key. Sign again.');
  return x;
}

export interface DerivedKeys {
  secret: bigint;
  salt: bigint;
  signingKey: bigint;
}

export async function deriveAccountKeys(signatureHex: string, frModulus: bigint, fqModulus: bigint): Promise<DerivedKeys> {
  const sig = hexToBytes(signatureHex);
  if (sig.length < 64) throw new Error('Invalid signature.');
  const [secret, salt, signingKey] = await Promise.all([
    fieldElement(sig, 'hl/aztec/v1/secret', frModulus),
    fieldElement(sig, 'hl/aztec/v1/salt', frModulus),
    fieldElement(sig, 'hl/aztec/v1/signing', fqModulus),
  ]);
  sig.fill(0);
  return { secret, salt, signingKey };
}

/**
 * Claim secrets for Fee Juice deposits, indexes [0, count). Deterministic, so
 * a deposit's secret can be recovered on any device from the same signature.
 */
export async function deriveFeeJuiceClaimSecrets(signatureHex: string, count: number, frModulus: bigint): Promise<bigint[]> {
  const sig = hexToBytes(signatureHex);
  if (sig.length < 64) throw new Error('Invalid signature.');
  const out: bigint[] = [];
  for (let i = 0; i < count; i++) out.push(await fieldElement(sig, `hl/aztec/v1/fee-juice-claim/${i}`, frModulus));
  sig.fill(0);
  return out;
}

/**
 * 32-byte store encryption key for the embedded wallet's OPFS SQLite stores
 * (PXE data and wallet data). Derived via HKDF with info 'hl/aztec/v1/store'.
 * Keys in memory are zeroized after derivation to prevent lingering key copies.
 */
export async function deriveStoreEncryptionKey(signatureHex: string): Promise<Uint8Array> {
  const sig = hexToBytes(signatureHex);
  if (sig.length < 64) throw new Error('Invalid signature.');
  const key = await hkdf(sig, 'hl/aztec/v1/store', 32);
  sig.fill(0);
  return key;
}
