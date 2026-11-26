/**
 * G8 passkey account (spec §7, Level 1): sign in to Ledger Chat with no
 * browser wallet. One discoverable passkey with the WebAuthn PRF extension
 * yields, on any device where that passkey syncs, the same:
 *   - EVM key  → signs SIWE (EIP-4361) and the XMTP identity, as an EOA
 *                (the server's existing viem verifyMessage accepts it; nothing changes there);
 *   - Aztec secret → root for the Aztec account, so the chat identity and the
 *                Aztec address come from one secret the user never sees;
 *   - s_human candidate → the secret G8 will commit to when a Level 2 issuer
 *                attests uniqueness (Level 2). Until then it proves nothing.
 *
 * Nothing secret is stored: keys are re-derived after each biometric check
 * and dropped. Honest limit: a passkey proves a device and a person present,
 * not a unique human — Level 2 uses Zero-Passport anchors (spec §4.1), never documents.
 * Behind NEXT_PUBLIC_PASSKEY_ACCOUNTS (default off). The MetaMask path is unchanged.
 */
import { privateKeyToAccount, type PrivateKeyAccount } from 'viem/accounts';
import { FR_MODULUS } from '@/lib/g8/constants';
import type { WebAuthnApi } from '@/lib/aztec/wallet/passkey';

export const PASSKEY_ACCOUNT_SCHEME = 'hl/g8/passkey-account/v1';
const SECP256K1_N = 0xfffffffffffffffffffffffffffffffebaaedce6af48a03bbfd25e8cd0364141n;
const enc = (t: string) => new TextEncoder().encode(t);
const buf = (u: Uint8Array) => u.buffer.slice(u.byteOffset, u.byteOffset + u.byteLength) as ArrayBuffer;
const toBig = (u: Uint8Array) => u.reduce((a, b) => (a << 8n) | BigInt(b), 0n);
const hex = (n: bigint) => ('0x' + n.toString(16).padStart(64, '0')) as `0x${string}`;

// Literal process.env access so Next.js inlines it in the client bundle.
export function passkeyAccountsEnabled(v: string | undefined = process.env.NEXT_PUBLIC_PASSKEY_ACCOUNTS): boolean {
  return v === '1' || v === 'true';
}

/** The PRF input: fixed per scheme, so the same passkey gives the same account everywhere. */
export async function prfSalt(): Promise<Uint8Array> {
  return new Uint8Array(await crypto.subtle.digest('SHA-256', buf(enc(PASSKEY_ACCOUNT_SCHEME))));
}

async function hkdf(prf: Uint8Array, info: string, bytes: number): Promise<Uint8Array> {
  if (prf.length < 32) throw new Error('NO_PRF');
  const ikm = await crypto.subtle.importKey('raw', buf(prf), 'HKDF', false, ['deriveBits']);
  return new Uint8Array(await crypto.subtle.deriveBits({ name: 'HKDF', hash: 'SHA-256', salt: buf(enc(PASSKEY_ACCOUNT_SCHEME)), info: buf(enc(info)) }, ikm, bytes * 8));
}

export interface AccountKeys { evmKey: `0x${string}`; aztecSecret: `0x${string}`; sHuman: bigint }

export async function deriveAccountKeys(prf: Uint8Array): Promise<AccountKeys> {
  let evm = 0n;
  for (let i = 0; i < 8 && (evm === 0n || evm >= SECP256K1_N); i++) evm = toBig(await hkdf(prf, `hl/g8/evm/v1/${i}`, 32));
  if (evm === 0n || evm >= SECP256K1_N) throw new Error('NO_KEY');
  const aztec = toBig(await hkdf(prf, 'hl/g8/aztec/v1', 64)) % FR_MODULUS;
  const human = toBig(await hkdf(prf, 'hl/g8/human/v1', 64)) % FR_MODULUS;
  return { evmKey: hex(evm), aztecSecret: hex(aztec), sHuman: human };
}

export async function accountFromPrf(prf: Uint8Array): Promise<PrivateKeyAccount> {
  return privateKeyToAccount((await deriveAccountKeys(prf)).evmKey);
}

function prfOf(cred: Credential | null): Uint8Array | undefined {
  const first = (cred as any)?.getClientExtensionResults?.()?.prf?.results?.first;
  return first ? new Uint8Array(first instanceof ArrayBuffer ? first : first.buffer ?? first) : undefined;
}

/** Creates the passkey (discoverable, user verification) and returns its PRF output. */
export async function createPasskeyAccount(api: WebAuthnApi, rpId: string, label: string): Promise<Uint8Array> {
  const salt = await prfSalt();
  const cred = await api.create({ publicKey: {
    rp: { id: rpId, name: 'Ledger Chat' },
    user: { id: buf(crypto.getRandomValues(new Uint8Array(16))), name: label, displayName: label },
    challenge: buf(crypto.getRandomValues(new Uint8Array(32))),
    pubKeyCredParams: [{ type: 'public-key', alg: -7 }, { type: 'public-key', alg: -257 }],
    authenticatorSelection: { residentKey: 'required', userVerification: 'required' },
    timeout: 120_000,
    extensions: { prf: { eval: { first: buf(salt) } } } as any,
  } });
  const now = prfOf(cred);
  if (now) return now;
  const raw = (cred as any)?.rawId as ArrayBuffer | undefined;
  if (!raw) throw new Error('CANCELLED');
  return unlockPasskeyAccount(api, rpId, [raw]);
}

/** Asks for any passkey of this site (discoverable) and returns its PRF output. */
export async function unlockPasskeyAccount(api: WebAuthnApi, rpId: string, only?: ArrayBuffer[]): Promise<Uint8Array> {
  const salt = await prfSalt();
  const cred = await api.get({ publicKey: {
    rpId, challenge: buf(crypto.getRandomValues(new Uint8Array(32))), userVerification: 'required', timeout: 120_000,
    ...(only ? { allowCredentials: only.map(id => ({ type: 'public-key' as const, id })) } : {}),
    extensions: { prf: { eval: { first: buf(salt) } } } as any,
  } });
  const prf = prfOf(cred);
  if (!prf) throw new Error('NO_PRF');
  return prf;
}

export interface SiweDeps {
  fetch: typeof fetch;
  domain: string;
  origin: string;
  /** Builds the EIP-4361 text; the page passes the siwe package (same as the wallet path). */
  buildMessage: (f: { domain: string; address: string; uri: string; nonce: string; issuedAt: string }) => string;
  now?: () => Date;
  /** Extra fields for /api/siwe/verify (e.g. humanGateRequired). */
  extraBody?: Record<string, unknown>;
}

/** Signs in with a passkey-derived account through the unchanged /api/siwe/* routes. */
export async function siweWithAccount(account: PrivateKeyAccount, d: SiweDeps): Promise<{ ok: true; address: string } | { ok: false; status: number; error?: string; detail?: string }> {
  const nr = await d.fetch('/api/siwe/nonce', { cache: 'no-store', credentials: 'include' });
  if (!nr.ok) return { ok: false, status: nr.status };
  const nonce = (await nr.text()).trim();
  const message = d.buildMessage({ domain: d.domain, address: account.address, uri: d.origin, nonce, issuedAt: (d.now?.() ?? new Date()).toISOString() });
  const signature = await account.signMessage({ message });
  const vr = await d.fetch('/api/siwe/verify', { method: 'POST', headers: { 'Content-Type': 'application/json' }, credentials: 'include', body: JSON.stringify({ message, signature, ...(d.extraBody ?? {}) }) });
  if (!vr.ok) { const j = await vr.json().catch(() => null); return { ok: false, status: vr.status, error: j?.error, detail: j?.detail }; }
  return { ok: true, address: account.address.toLowerCase() };
}

/** XMTP browser-sdk EOA signer from the same account (no wallet popup). */
export function xmtpSignerFor(account: PrivateKeyAccount) {
  return {
    type: 'EOA' as const,
    getIdentifier: async () => ({ identifier: account.address, identifierKind: 'Ethereum' as const }),
    signMessage: async (message: string) => {
      const sig = await account.signMessage({ message });
      return Uint8Array.from((sig.slice(2).match(/../g) ?? []).map(b => parseInt(b, 16)));
    },
  };
}

/* ── session marker: which wallet signs with a passkey (no key, only the address) ── */
const SESSION_KEY = 'hl.g8.passkey-session';
export function markPasskeySession(address: string | null, s: Storage | undefined = typeof window !== 'undefined' ? window.localStorage : undefined): void {
  try { if (address) s?.setItem(SESSION_KEY, address.toLowerCase()); else s?.removeItem(SESSION_KEY); } catch {}
}
export function isPasskeySession(address: string | null | undefined, s: Storage | undefined = typeof window !== 'undefined' ? window.localStorage : undefined): boolean {
  try { return !!address && s?.getItem(SESSION_KEY) === address.toLowerCase(); } catch { return false; }
}

/** Signs one message for a passkey session: one biometric check, key derived, used, dropped. */
export async function signWithPasskey(address: string, message: string | Uint8Array): Promise<string> {
  const { browserWebAuthn, passkeyRpId } = await import('@/lib/aztec/wallet/passkey');
  const api = browserWebAuthn();
  if (!api) throw new Error('This browser cannot use passkeys here.');
  const account = await accountFromPrf(await unlockPasskeyAccount(api, passkeyRpId(window.location.hostname)));
  if (account.address.toLowerCase() !== address.toLowerCase()) throw new Error('That passkey belongs to a different Ledger Chat account.');
  return account.signMessage({ message: typeof message === 'string' ? message : { raw: message } });
}
