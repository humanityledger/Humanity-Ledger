/**
 * Server side of LedgerSponsor (contracts/aztec/sponsor): signs one-use vouchers so a signed-in user
 * with no Fee Juice gets a few transactions paid (account creation first). Server only.
 *
 * The digest must match contracts/aztec/sponsor/src/voucher.nr byte for byte:
 *   sha256("HL-SPONSOR-V1" + 3 zero bytes || voucher id, 32 bytes BE || expiry, u64 BE)
 * signed with ECDSA secp256k1, low-s, 64 bytes r || s.
 *
 * The key: AZTEC_SPONSOR_SIGNER_KEY (32-byte hex). On the test network only, it may be derived from
 * JWT_SECRET with HMAC-SHA256 under its own label; on Alpha the explicit key is required. Its public half is
 * what the contract is deployed with; rotating it means deploying a new sponsor.
 */
import 'server-only';
import crypto from 'node:crypto';

const N = BigInt('0xfffffffffffffffffffffffffffffffebaaedce6af48a03bbfd25e8cd0364141');
const TAG = Buffer.from('HL-SPONSOR-V1\0\0\0', 'latin1');
/** Field modulus of BN254: voucher ids must be below it. 31 random bytes always are. */
const VOUCHER_BYTES = 31;
export const VOUCHER_TTL_S = 15 * 60;

export interface SponsorPublicKey { x: string; y: string; xHi: string; xLo: string; yHi: string; yLo: string }
export interface Voucher { voucherId: string; expiresAt: number; signerX: number[]; signerY: number[]; signature: number[] }

function signerPrivateKey(): Buffer | null {
  const explicit = (process.env.AZTEC_SPONSOR_SIGNER_KEY || '').trim().replace(/^0x/, '');
  if (/^[0-9a-fA-F]{64}$/.test(explicit)) return Buffer.from(explicit, 'hex');
  // On Aztec Alpha (real funds) the key must be its own secret. Derived from JWT_SECRET it would let
  // anyone holding the session secret mint vouchers, and rotating that secret would silently change
  // the signer (every voucher then fails as "unknown signer"). The voucher digest does not name the
  // contract instance (finding SP-5, docs/security/AUDIT_2026-11-13.md), so a key must also never be
  // shared between a test deployment and a mainnet one.
  if (process.env.NEXT_PUBLIC_AZTEC_NETWORK === 'alpha') return null;
  const secret = process.env.JWT_SECRET;
  if (!secret || secret.length < 16) return null;
  // Reduce into [1, n-1]: a 32-byte HMAC is almost always below n already.
  const h = BigInt('0x' + crypto.createHmac('sha256', secret).update('hl/aztec-sponsor-signer/v1').digest('hex'));
  const k = (h % (N - 1n)) + 1n;
  return Buffer.from(k.toString(16).padStart(64, '0'), 'hex');
}

function keyObjects(priv: Buffer) {
  const ecdh = crypto.createECDH('secp256k1');
  ecdh.setPrivateKey(priv);
  const pub = ecdh.getPublicKey();
  const sec1 = Buffer.concat([Buffer.from('302e0201010420', 'hex'), priv, Buffer.from('a00706052b8104000a', 'hex')]);
  return { key: crypto.createPrivateKey({ key: sec1, format: 'der', type: 'sec1' }), x: pub.subarray(1, 33), y: pub.subarray(33, 65) };
}

const hex = (b: Buffer) => '0x' + b.toString('hex');

export function sponsorPublicKey(): SponsorPublicKey | null {
  const priv = signerPrivateKey();
  if (!priv) return null;
  const { x, y } = keyObjects(priv);
  return { x: hex(x), y: hex(y), xHi: hex(x.subarray(0, 16)), xLo: hex(x.subarray(16)), yHi: hex(y.subarray(0, 16)), yLo: hex(y.subarray(16)) };
}

export function voucherDigestBytes(voucherId: bigint, expiresAt: number): Buffer {
  const id = Buffer.from(voucherId.toString(16).padStart(64, '0'), 'hex');
  const exp = Buffer.alloc(8);
  exp.writeBigUInt64BE(BigInt(expiresAt));
  return Buffer.concat([TAG, id, exp]);
}

/** Signs a fresh voucher, or null when no key is available. */
export function signVoucher(nowS = Math.floor(Date.now() / 1000), voucherId?: bigint): Voucher | null {
  const priv = signerPrivateKey();
  if (!priv) return null;
  const { key, x, y } = keyObjects(priv);
  const id = voucherId ?? BigInt('0x' + crypto.randomBytes(VOUCHER_BYTES).toString('hex'));
  const expiresAt = nowS + VOUCHER_TTL_S;
  const raw = crypto.sign('sha256', voucherDigestBytes(id, expiresAt), { key, dsaEncoding: 'ieee-p1363' });
  const r = raw.subarray(0, 32);
  let s = BigInt('0x' + raw.subarray(32).toString('hex'));
  if (s > N / 2n) s = N - s; // Noir accepts low-s signatures only
  const sig = Buffer.concat([r, Buffer.from(s.toString(16).padStart(64, '0'), 'hex')]);
  return { voucherId: '0x' + id.toString(16), expiresAt, signerX: [...x], signerY: [...y], signature: [...sig] };
}

/** Limits: sponsored transactions per wallet (lifetime) and for everyone per day. */
export function sponsorLimits() {
  const n = (v: string | undefined, d: number) => { const x = Number(v); return Number.isFinite(x) && x >= 0 ? Math.floor(x) : d; };
  return { perWallet: n(process.env.AZTEC_SPONSOR_PER_WALLET, 3), perDay: n(process.env.AZTEC_SPONSOR_PER_DAY, 200) };
}
