/**
 * lib/chat/peerProfiles.ts — the public profile (name and photo) of the people you talk to.
 *
 * Why this exists (21 November 2026): a photo you set was saved on the server, but the people you
 * chat with rarely saw it. Every avatar on screen ran its own search request; a failed or
 * rate-limited answer cleared the cached photo, and a photo changed later was never fetched again
 * once a name was known. Now one cache serves every avatar:
 *   - avatars ask for an address and subscribe; requests made within 60 ms go out as one batch
 *     (POST /api/user/profiles, up to 100 addresses);
 *   - an answer older than five minutes is refreshed when the avatar is shown again, and every
 *     shown profile is refreshed when the tab becomes visible, so a new photo appears without a
 *     reload;
 *   - only a successful answer changes what is shown: an error keeps the photo already cached.
 * The last known photo is kept in localStorage (`peer_avatar_<address>`, the key older builds
 * read), so it shows at once on the next visit.
 */

export interface PeerProfile {
  avatarUrl: string;
  displayName: string;
  /** When the server last answered for this address (ms); 0 when only the local copy is known. */
  at: number;
}

const FRESH_MS = 5 * 60_000;
const BATCH_MS = 60;
const MAX_BATCH = 100;
const ADDRESS = /^0x[0-9a-f]{40}$/;

const cache = new Map<string, PeerProfile>();
const listeners = new Map<string, Set<() => void>>();
const queued = new Set<string>();
const inFlight = new Set<string>();
let timer: ReturnType<typeof setTimeout> | null = null;
let visibilityHooked = false;

function key(address: string | null | undefined): string {
  return (address || '').trim().toLowerCase();
}

function storage(): Storage | null {
  try {
    return typeof window !== 'undefined' ? window.localStorage : null;
  } catch {
    return null;
  }
}

function notify(addr: string) {
  listeners.get(addr)?.forEach((fn) => {
    try { fn(); } catch { /* a listener's error stays with it */ }
  });
}

/** The profile known for `address`: from this session, else from the copy kept on this device. */
export function getPeerProfile(address: string | null | undefined): PeerProfile | undefined {
  const a = key(address);
  if (!a) return undefined;
  const hit = cache.get(a);
  if (hit) return hit;
  const s = storage();
  const avatarUrl = s?.getItem(`peer_avatar_${a}`) || '';
  if (!avatarUrl) return undefined;
  const seeded: PeerProfile = { avatarUrl, displayName: '', at: 0 };
  cache.set(a, seeded);
  return seeded;
}

/** Applies a server answer: what avatars show, and the copy kept on this device. */
export function setPeerProfile(address: string, profile: { avatarUrl?: string | null; displayName?: string | null }, at = Date.now()) {
  const a = key(address);
  if (!a) return;
  const next: PeerProfile = { avatarUrl: profile.avatarUrl || '', displayName: profile.displayName || '', at };
  const prev = cache.get(a);
  cache.set(a, next);
  const s = storage();
  try {
    if (next.avatarUrl) s?.setItem(`peer_avatar_${a}`, next.avatarUrl);
    else s?.removeItem(`peer_avatar_${a}`);
  } catch { /* storage full: the photo still shows this session */ }
  if (!prev || prev.avatarUrl !== next.avatarUrl || prev.displayName !== next.displayName) notify(a);
}

async function flush() {
  timer = null;
  const batch = [...queued].slice(0, MAX_BATCH);
  batch.forEach((a) => { queued.delete(a); inFlight.add(a); });
  if (queued.size) schedule();
  if (!batch.length) return;
  try {
    const res = await fetch('/api/user/profiles', {
      method: 'POST',
      credentials: 'include',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ addresses: batch }),
    });
    if (!res.ok) return; // keep what is shown; the next view asks again
    const body = (await res.json().catch(() => null)) as { profiles?: Record<string, { avatarUrl?: string | null; displayName?: string | null }> } | null;
    if (!body || typeof body.profiles !== 'object' || body.profiles === null) return;
    const now = Date.now();
    for (const a of batch) setPeerProfile(a, body.profiles[a] || {}, now);
  } catch {
    // offline: keep what is shown
  } finally {
    batch.forEach((a) => inFlight.delete(a));
  }
}

function schedule() {
  if (timer || typeof window === 'undefined') return;
  timer = setTimeout(() => { void flush(); }, BATCH_MS);
}

function hookVisibility() {
  if (visibilityHooked || typeof document === 'undefined') return;
  visibilityHooked = true;
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState !== 'visible') return;
    // Everyone on screen is checked again: a photo may have changed while the tab was hidden.
    for (const a of listeners.keys()) requestPeerProfile(a, true);
  });
}

/** Asks the server for this address's profile, unless a fresh answer is already known. */
export function requestPeerProfile(address: string | null | undefined, force = false) {
  const a = key(address);
  if (!ADDRESS.test(a) || queued.has(a) || inFlight.has(a)) return;
  const hit = cache.get(a);
  if (!force && hit && hit.at && Date.now() - hit.at < FRESH_MS) return;
  queued.add(a);
  hookVisibility();
  schedule();
}

/** Calls `fn` whenever the profile of `address` changes. Returns the unsubscribe function. */
export function subscribePeerProfile(address: string | null | undefined, fn: () => void): () => void {
  const a = key(address);
  if (!a) return () => {};
  let set = listeners.get(a);
  if (!set) listeners.set(a, (set = new Set()));
  set.add(fn);
  return () => {
    set!.delete(fn);
    if (!set!.size) listeners.delete(a);
  };
}

/** For tests. */
export function __resetPeerProfiles() {
  cache.clear();
  listeners.clear();
  queued.clear();
  inFlight.clear();
  if (timer) clearTimeout(timer);
  timer = null;
}
