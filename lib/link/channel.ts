/**
 * lib/link/channel.ts — the end-to-end channel between the phone and a linked computer (browser).
 *
 * During the QR handshake the phone generates a random 256-bit key and sends it to the
 * computer encrypted to the computer's ephemeral key (ECDH + HKDF, lib/web-crypto.ts). Both
 * keep it on the device. From then on, when the computer needs a wallet signature it encrypts
 * the request under that key and relays it through /api/auth/link; the phone decrypts it, shows
 * what is being signed, signs only on approval, and answers encrypted. The server relays
 * ciphertext and never holds the key. AES-256-GCM with a fresh 96-bit IV per message, and the
 * request id and kind bound in as additional data, so an answer cannot be replayed onto
 * another request.
 *
 * What a computer may ask for is fixed (SignKind): registering its own XMTP installation
 * (chat), and the typed-data signature that opens the private Aztec wallet. Nothing that moves
 * money: a payment is always confirmed in the private wallet on the device that makes it.
 */

export type SignKind = 'xmtp' | 'aztec';

export type SignPayload =
  | { kind: 'xmtp'; message: string }
  | { kind: 'aztec'; typedData: { domain: unknown; types: unknown; primaryType: string; message: unknown } };

/** What the phone shows before signing; never the raw bytes alone. */
export const SIGN_PURPOSE: Record<SignKind, { title: string; body: string }> = {
  xmtp: {
    title: 'Turn on chats on your computer',
    body: 'Your computer asks to register itself with the encrypted messaging network (XMTP) so your chats work there. Signing gives it no access to your funds.',
  },
  aztec: {
    title: 'Open your private wallet on your computer',
    body: 'Your computer asks for the signature that opens your private wallet there. It will be able to see your private balance and make payments that you confirm on it. Approve only if this is your computer.',
  },
};

const SELF_KEY = 'hl.link.self.v1';
const PEERS_KEY = 'hl.link.devices.v1';

export interface SelfLink { deviceId: string; key: string; wallet: string }
export interface PeerLink { key: string; label: string; linkedAt: number }

const b64 = (u: Uint8Array) => btoa(String.fromCharCode(...u)).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
const unb64 = (s: string) => {
  const t = s.replace(/-/g, '+').replace(/_/g, '/');
  const bin = atob(t + '==='.slice((t.length + 3) % 4));
  return Uint8Array.from(bin, c => c.charCodeAt(0));
};

function read<T>(k: string): T | null {
  try { const v = localStorage.getItem(k); return v ? (JSON.parse(v) as T) : null; } catch { return null; }
}
function write(k: string, v: unknown) {
  try { localStorage.setItem(k, JSON.stringify(v)); } catch { /* storage unavailable */ }
}

export function newChannelKey(): string {
  return b64(crypto.getRandomValues(new Uint8Array(32)));
}

export function newDeviceId(): string {
  return `dev_${Array.from(crypto.getRandomValues(new Uint8Array(12)), b => b.toString(16).padStart(2, '0')).join('')}`;
}

/* ── this computer (linked device) ── */
export function getSelfLink(wallet?: string | null): SelfLink | null {
  const s = read<SelfLink>(SELF_KEY);
  if (!s || !/^dev_[0-9a-f]{24}$/.test(s.deviceId) || typeof s.key !== 'string') return null;
  if (wallet && s.wallet !== wallet.toLowerCase()) return null;
  return s;
}
export function setSelfLink(s: SelfLink) { write(SELF_KEY, { ...s, wallet: s.wallet.toLowerCase() }); }
export function clearSelfLink() { try { localStorage.removeItem(SELF_KEY); } catch { /* */ } }

/* ── the phone: keys of the computers it linked ── */
export function getPeers(): Record<string, PeerLink> {
  const p = read<Record<string, PeerLink>>(PEERS_KEY);
  return p && typeof p === 'object' ? p : {};
}
export function addPeer(deviceId: string, peer: PeerLink) { write(PEERS_KEY, { ...getPeers(), [deviceId]: peer }); }
export function removePeer(deviceId: string) {
  const p = getPeers();
  delete p[deviceId];
  write(PEERS_KEY, p);
}
export const hasPeers = () => Object.keys(getPeers()).length > 0;

/* ── AES-256-GCM with the request bound in ── */
async function aesKey(keyB64: string, use: KeyUsage[]) {
  return crypto.subtle.importKey('raw', unb64(keyB64), { name: 'AES-GCM' }, false, use);
}
const aad = (bind: string) => new TextEncoder().encode(`ledger-link-v1|${bind}`);

export async function seal(keyB64: string, bind: string, data: unknown): Promise<{ ciphertext: string; iv: string }> {
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const ct = await crypto.subtle.encrypt({ name: 'AES-GCM', iv, additionalData: aad(bind) }, await aesKey(keyB64, ['encrypt']), new TextEncoder().encode(JSON.stringify(data)));
  return { ciphertext: b64(new Uint8Array(ct)), iv: b64(iv) };
}

export async function open<T>(keyB64: string, bind: string, ciphertext: string, iv: string): Promise<T> {
  const pt = await crypto.subtle.decrypt({ name: 'AES-GCM', iv: unb64(iv), additionalData: aad(bind) }, await aesKey(keyB64, ['decrypt']), unb64(ciphertext));
  return JSON.parse(new TextDecoder().decode(pt)) as T;
}

/* ── the computer asks the phone ── */
export class RemoteSignError extends Error {
  constructor(public readonly code: 'NOT_LINKED' | 'DECLINED' | 'TIMEOUT' | 'UNLINKED' | 'FAILED', message: string) {
    super(message);
    this.name = 'RemoteSignError';
  }
}

/**
 * Asks the phone to sign and waits for the answer (up to `timeoutMs`). The request is sealed
 * with the kind as associated data; the answer is sealed with the request id, so the phone's
 * signature for one request cannot be accepted for another.
 */
export async function remoteSign(payload: SignPayload, opts: { wallet: string; timeoutMs?: number; signal?: AbortSignal; onWaiting?: () => void } ): Promise<string> {
  const self = getSelfLink(opts.wallet);
  if (!self) throw new RemoteSignError('NOT_LINKED', 'This computer is not linked to your phone. Sign in again by scanning the QR code with Ledger Chat on your phone.');
  const sealed = await seal(self.key, `req|${self.deviceId}|${payload.kind}`, payload);
  const res = await fetch('/api/auth/link', {
    method: 'POST', credentials: 'include', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ action: 'request', kind: payload.kind, ...sealed }),
  });
  if (res.status === 401) { clearSelfLink(); throw new RemoteSignError('UNLINKED', 'This computer was unlinked from your phone. Scan the QR code again to sign in.'); }
  const j = await res.json().catch(() => ({}));
  if (!res.ok || !j.id) throw new RemoteSignError('FAILED', j.error || 'Your phone could not be reached. Try again.');
  opts.onWaiting?.();

  const deadline = Date.now() + (opts.timeoutMs ?? 170_000);
  while (Date.now() < deadline) {
    if (opts.signal?.aborted) throw new RemoteSignError('FAILED', 'Cancelled.');
    await new Promise(r => setTimeout(r, 1_500));
    const p = await fetch(`/api/auth/link?request=${encodeURIComponent(j.id)}`, { credentials: 'include', cache: 'no-store' }).catch(() => null);
    if (!p) continue;
    if (p.status === 404) break;
    const a = await p.json().catch(() => ({}));
    if (a.status === 'declined') throw new RemoteSignError('DECLINED', 'You declined the request on your phone.');
    if (a.status === 'answered') {
      const out = await open<{ signature?: string }>(self.key, `ans|${j.id}|${payload.kind}`, a.ciphertext, a.iv);
      if (typeof out.signature === 'string' && /^0x[0-9a-fA-F]+$/.test(out.signature)) return out.signature;
      throw new RemoteSignError('FAILED', 'Your phone sent an answer this computer could not use.');
    }
  }
  throw new RemoteSignError('TIMEOUT', 'Your phone did not answer in time. Open Ledger Chat on your phone and try again.');
}
