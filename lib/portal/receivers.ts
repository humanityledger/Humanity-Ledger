/**
 * lib/portal/receivers.ts — receiver addresses and portal messages, client side.
 *
 * Everything here runs in the browser (or a test) and is pure: the cryptographic primitives that
 * need the Aztec SDK (poseidon2 secret hash) or an Ethereum library (secp256k1 address) are
 * injected, so the derivation is tested without either.
 *
 * DERIVATION (docs/RECEIVER_ADDRESSES.md §2), from the account root R (the wallet signature that
 * every Aztec key of the account comes from, lib/aztec/wallet/keys.ts):
 *
 *   P             = HKDF-SHA256(R, salt "humanity-ledger/portal", info "hl/portal/v1/master", 64 bytes)
 *                   (derived when the wallet opens, kept in memory like the other derived keys)
 *   seed_i        = HKDF-SHA256(P, salt "humanity-ledger/portal", info "hl/portal/v1/receiver/<i>", 96 bytes)
 *   secret_i      = seed_i[0..48)  mod Fr                    claims deposits on Aztec (never leaves the device)
 *   secretHash_i  = poseidon2([secret_i], DOM_SEP__SECRET_HASH)   written on Ethereum, in the receiver
 *   rescueKey_i   = seed_i[48..96) mod n(secp256k1), != 0     signs rescues only
 *   rescueSigner_i= address(rescueKey_i)                       written on Ethereum, in the receiver
 *   receiver_i    = CREATE2(factory, keccak256(abi.encode(secretHash_i, rescueSigner_i)), EIP-1167(impl))
 *
 * HKDF is one-way and the labels differ per index: knowing receiver_i, secretHash_i and
 * rescueSigner_i says nothing about R, about the account's Aztec address, or about receiver_j.
 */

export const FR_MODULUS = 21888242871839275222246405745257275088548364400416034343698204186575808495617n;
export const SECP256K1_N = 0xfffffffffffffffffffffffffffffffebaaedce6af48a03bbfd25e8cd0364141n;

const enc = new TextEncoder();

export interface ReceiverCrypto {
  /** poseidon2 secret hash as Aztec computes it (aztec.js computeSecretHash), 0x-hex Field. */
  secretHash(secret: bigint): Promise<string>;
  /** Ethereum address (checksummed or lowercase) of a secp256k1 private key. */
  addressOf(privateKey: bigint): string;
  /** keccak256 of bytes, 0x-hex. */
  keccak256(data: Uint8Array): string;
}

export interface ReceiverMaterial {
  index: number;
  /** Private: claims the deposits. */
  secret: bigint;
  /** Private: signs rescues. */
  rescueKey: bigint;
  secretHash: string;
  rescueSigner: string;
}

function hexToBytes(hex: string): Uint8Array {
  const h = hex.startsWith('0x') ? hex.slice(2) : hex;
  if (h.length % 2 || !/^[0-9a-fA-F]*$/.test(h)) throw new Error('Invalid hex.');
  const out = new Uint8Array(h.length / 2);
  for (let i = 0; i < out.length; i++) out[i] = parseInt(h.slice(2 * i, 2 * i + 2), 16);
  return out;
}
export function bytesToHex(b: Uint8Array): string {
  return '0x' + Array.from(b, (x) => x.toString(16).padStart(2, '0')).join('');
}
function toBigInt(b: Uint8Array): bigint {
  let x = 0n;
  for (const v of b) x = (x << 8n) | BigInt(v);
  return x;
}
const toBuf = (u: Uint8Array): ArrayBuffer => u.buffer.slice(u.byteOffset, u.byteOffset + u.byteLength) as ArrayBuffer;

async function hkdf(ikm: Uint8Array, info: string, length: number): Promise<Uint8Array> {
  const key = await crypto.subtle.importKey('raw', toBuf(ikm), 'HKDF', false, ['deriveBits']);
  const bits = await crypto.subtle.deriveBits(
    { name: 'HKDF', hash: 'SHA-256', salt: toBuf(enc.encode('humanity-ledger/portal')), info: toBuf(enc.encode(info)) },
    key,
    length * 8,
  );
  return new Uint8Array(bits);
}

export const MAX_RECEIVERS = 64;

/** The portal master secret P of an account root (64 bytes, hex). */
export async function derivePortalMaster(rootHex: string): Promise<string> {
  const root = hexToBytes(rootHex);
  if (root.length < 64) throw new Error('The account root is too short.');
  const p = await hkdf(root, 'hl/portal/v1/master', 64);
  root.fill(0);
  const hex = bytesToHex(p);
  p.fill(0);
  return hex;
}

/** The receiver material of index `index` (0-based), from the portal master secret. */
export async function deriveReceiver(masterHex: string, index: number, c: ReceiverCrypto): Promise<ReceiverMaterial> {
  if (!Number.isInteger(index) || index < 0 || index >= MAX_RECEIVERS) throw new Error('Receiver index out of range.');
  const master = hexToBytes(masterHex);
  if (master.length !== 64) throw new Error('Invalid portal master secret.');
  // 96 bytes: two disjoint 48-byte halves, so the claim secret and the rescue key share no input
  // bits (48 bytes per key keeps the modular bias below 2^-128).
  const seed = await hkdf(master, `hl/portal/v1/receiver/${index}`, 96);
  master.fill(0);
  const secret = toBigInt(seed.slice(0, 48)) % FR_MODULUS;
  const rescueKey = toBigInt(seed.slice(48, 96)) % SECP256K1_N;
  seed.fill(0);
  if (secret === 0n || rescueKey === 0n) throw new Error('Derived a zero key.');
  const secretHash = await c.secretHash(secret);
  if (BigInt(secretHash) === 0n || BigInt(secretHash) >= FR_MODULUS) throw new Error('Secret hash out of the field.');
  return { index, secret, rescueKey, secretHash: pad32(secretHash), rescueSigner: c.addressOf(rescueKey).toLowerCase() };
}

function pad32(hex: string): string {
  return '0x' + BigInt(hex).toString(16).padStart(64, '0');
}

/* ------------------------------------------------------------- addresses */

/** EIP-1167 creation code of a clone of `implementation` (OpenZeppelin Clones, v5). */
export function cloneInitCode(implementation: string): Uint8Array {
  const impl = implementation.toLowerCase().replace(/^0x/, '');
  if (!/^[0-9a-f]{40}$/.test(impl)) throw new Error('Invalid implementation address.');
  return hexToBytes('3d602d80600a3d3981f3363d3d373d3d3d363d73' + impl + '5af43d82803e903d91602b57fd5bf3');
}

/** keccak256(abi.encode(bytes32 secretHash, address rescueSigner)), as HLReceiverFactory.saltOf. */
export function receiverSalt(secretHash: string, rescueSigner: string, c: Pick<ReceiverCrypto, 'keccak256'>): string {
  const sh = hexToBytes(pad32(secretHash));
  const addr = hexToBytes(rescueSigner.toLowerCase().replace(/^0x/, '').padStart(64, '0'));
  const buf = new Uint8Array(64);
  buf.set(sh, 0);
  buf.set(addr, 32);
  return c.keccak256(buf);
}

/** The receiver's address: CREATE2 by the factory, as HLReceiverFactory.predict. */
export function predictReceiver(
  factory: string,
  implementation: string,
  secretHash: string,
  rescueSigner: string,
  c: Pick<ReceiverCrypto, 'keccak256'>,
): string {
  const salt = hexToBytes(receiverSalt(secretHash, rescueSigner, c));
  const codeHash = hexToBytes(c.keccak256(cloneInitCode(implementation)));
  const f = hexToBytes(factory.toLowerCase().replace(/^0x/, ''));
  if (f.length !== 20) throw new Error('Invalid factory address.');
  const buf = new Uint8Array(1 + 20 + 32 + 32);
  buf[0] = 0xff;
  buf.set(f, 1);
  buf.set(salt, 21);
  buf.set(codeHash, 53);
  return '0x' + c.keccak256(buf).slice(-40);
}

/* -------------------------------------------------------------- messages */

/** Aztec's sha256ToField: sha256 with its last byte dropped, as a 32-byte value with a zero first byte. */
export async function sha256ToField(data: Uint8Array): Promise<string> {
  const d = new Uint8Array(await crypto.subtle.digest('SHA-256', toBuf(data)));
  const out = new Uint8Array(32);
  out.set(d.slice(0, 31), 1);
  return bytesToHex(out);
}

const SEL_MINT_TO_PRIVATE = hexToBytes('8b3af5e8'); // mint_to_private(uint256)
const SEL_WITHDRAW = hexToBytes('69328dec'); // withdraw(address,uint256,address)

function u256(x: bigint): Uint8Array {
  if (x < 0n || x >= 1n << 256n) throw new Error('Out of uint256 range.');
  return hexToBytes(x.toString(16).padStart(64, '0'));
}
function addr32(a: string): Uint8Array {
  const h = a.toLowerCase().replace(/^0x/, '');
  if (!/^[0-9a-f]{40}$/.test(h)) throw new Error('Invalid Ethereum address.');
  return hexToBytes(h.padStart(64, '0'));
}

/** Content of a private deposit message: depends on the amount only (no sender, no recipient). */
export async function mintToPrivateContent(amount: bigint): Promise<string> {
  const b = new Uint8Array(36);
  b.set(SEL_MINT_TO_PRIVATE, 0);
  b.set(u256(amount), 4);
  return sha256ToField(b);
}

/** Content of a withdrawal message (L2 -> L1). `callerOnL1` = zero address lets anyone execute it. */
export async function withdrawContent(recipient: string, amount: bigint, callerOnL1 = '0x' + '0'.repeat(40)): Promise<string> {
  const b = new Uint8Array(100);
  b.set(SEL_WITHDRAW, 0);
  b.set(addr32(recipient), 4);
  b.set(u256(amount), 36);
  b.set(addr32(callerOnL1), 68);
  return sha256ToField(b);
}

/* ------------------------------------------------------- claim planning */

export interface PendingDeposit {
  /** Inbox leaf index (event DepositToAztecPrivate.index). */
  index: bigint;
  amount: bigint;
  token: string;
  secretHash: string;
  /** L1 block timestamp (seconds) of the deposit. */
  at: number;
}

/**
 * Which deposits to claim now, and which receiver secret claims each. Deposits are matched by
 * secret hash only (the L1 event carries no recipient). A claim waits a random time after its
 * deposit (minDelaySec..maxDelaySec, drawn once per deposit from `rand`) so the claim does not
 * follow the deposit at a predictable moment (docs/RECEIVER_ADDRESSES.md §5).
 */
export function claimPlan(
  deposits: PendingDeposit[],
  receivers: Pick<ReceiverMaterial, 'index' | 'secretHash'>[],
  now: number,
  opts: { minDelaySec: number; maxDelaySec: number; rand: (key: string) => number; claimed: Set<string> },
): { ready: Array<PendingDeposit & { receiverIndex: number }>; waiting: Array<PendingDeposit & { readyAt: number }> } {
  const byHash = new Map(receivers.map((r) => [pad32(r.secretHash), r.index]));
  const ready: Array<PendingDeposit & { receiverIndex: number }> = [];
  const waiting: Array<PendingDeposit & { readyAt: number }> = [];
  for (const d of deposits) {
    const key = `${d.token.toLowerCase()}:${d.index}`;
    if (opts.claimed.has(key)) continue;
    const ri = byHash.get(pad32(d.secretHash));
    if (ri === undefined) continue;
    const r = Math.min(1, Math.max(0, opts.rand(key)));
    const readyAt = d.at + Math.floor(opts.minDelaySec + r * (opts.maxDelaySec - opts.minDelaySec));
    if (now >= readyAt) ready.push({ ...d, receiverIndex: ri });
    else waiting.push({ ...d, readyAt });
  }
  return { ready, waiting };
}
