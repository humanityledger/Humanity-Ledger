/**
 * lib/relay/client.ts
 *
 * What the app asks a Ledger Relay for (protocol ledger-relay/0, relay/README.md): TURN
 * credentials, encrypted file storage and opaque push wake-ups. Every function takes the relay
 * and fetch explicitly, so it is testable and never reaches a relay the user did not configure.
 *
 * Files must already be encrypted on the device (AES-256-GCM) before uploadCiphertext; the key
 * travels only inside the MLS message that references the file.
 */
import type { Relay } from './relays';
import { candidateRelays, healthyRelays, organisationRelays, pinnedToOrganisation, relayEnabled, userRelays } from './relays';

async function sha256Hex(bytes: Uint8Array): Promise<string> {
  const digest = await crypto.subtle.digest('SHA-256', bytes);
  return Array.from(new Uint8Array(digest), (b) => b.toString(16).padStart(2, '0')).join('');
}

const auth = (token?: string): Record<string, string> => (token ? { Authorization: `Bearer ${token}` } : {});

/** Short-lived TURN credentials from one relay, or null. */
export async function relayTurn(relay: Relay, fetchImpl: typeof fetch = fetch, token?: string): Promise<{ iceServers: RTCIceServer[]; ttl: number } | null> {
  try {
    const res = await fetchImpl(`${relay.url}/v0/turn`, { cache: 'no-store', credentials: 'omit', headers: auth(token) });
    if (!res.ok) return null;
    const data = (await res.json()) as { iceServers?: RTCIceServer[]; ttl?: number };
    const servers = Array.isArray(data.iceServers) ? data.iceServers.filter((s) => s && s.urls && s.username && s.credential) : [];
    return servers.length ? { iceServers: servers, ttl: Number(data.ttl) || 3600 } : null;
  } catch {
    return null;
  }
}

/**
 * ICE servers from the first healthy relay that offers TURN, when relays are enabled; null
 * otherwise, and the caller keeps its own path (/api/calls/ice, then STUN only).
 */
export async function iceFromRelays(fetchImpl: typeof fetch = fetch): Promise<{ iceServers: RTCIceServer[]; ttl: number } | null> {
  if (!relayEnabled()) return null;
  const candidates = candidateRelays({ organisation: organisationRelays(), user: userRelays(), pinned: pinnedToOrganisation() });
  if (!candidates.length) return null;
  for (const relay of await healthyRelays(candidates, 'turn', fetchImpl)) {
    const got = await relayTurn(relay, fetchImpl);
    if (got) return got;
  }
  return null;
}

/** Stores ciphertext on a relay. Returns its address, expiry and delete token. */
export async function uploadCiphertext(
  relay: Relay,
  ciphertext: Uint8Array,
  opts: { ttlSeconds?: number; token?: string; fetchImpl?: typeof fetch } = {},
): Promise<{ hash: string; url: string; expiresAt: string; deleteToken?: string }> {
  const hash = await sha256Hex(ciphertext);
  const res = await (opts.fetchImpl ?? fetch)(`${relay.url}/v0/blobs/${hash}`, {
    method: 'PUT',
    body: ciphertext as BodyInit,
    credentials: 'omit',
    headers: { 'Content-Type': 'application/octet-stream', ...(opts.ttlSeconds ? { 'X-Relay-TTL': String(opts.ttlSeconds) } : {}), ...auth(opts.token) },
  });
  const body = (await res.json().catch(() => ({}))) as { expiresAt?: string; deleteToken?: string; error?: string };
  if (!res.ok) throw new Error(body.error || `Upload refused (${res.status})`);
  return { hash, url: `${relay.url}/v0/blobs/${hash}`, expiresAt: body.expiresAt ?? '', deleteToken: body.deleteToken };
}

/** Reads ciphertext back and checks it is the file that was referenced. */
export async function downloadCiphertext(url: string, expectedHash: string, fetchImpl: typeof fetch = fetch): Promise<Uint8Array> {
  const res = await fetchImpl(url, { cache: 'no-store', credentials: 'omit' });
  if (!res.ok) throw new Error(res.status === 404 ? 'The file has expired or was deleted.' : `Download failed (${res.status})`);
  const bytes = new Uint8Array(await res.arrayBuffer());
  if ((await sha256Hex(bytes)) !== expectedHash.toLowerCase()) throw new Error('The file does not match its address.');
  return bytes;
}

/** Registers this device's Web Push subscription; the token is shared only inside MLS messages. */
export async function registerWakeups(relay: Relay, subscription: PushSubscriptionJSON, fetchImpl: typeof fetch = fetch, token?: string): Promise<string> {
  const res = await fetchImpl(`${relay.url}/v0/push/register`, {
    method: 'POST',
    credentials: 'omit',
    headers: { 'Content-Type': 'application/json', ...auth(token) },
    body: JSON.stringify({ subscription: { endpoint: subscription.endpoint } }),
  });
  const body = (await res.json().catch(() => ({}))) as { token?: string; error?: string };
  if (!res.ok || !body.token) throw new Error(body.error || `Registration refused (${res.status})`);
  return body.token;
}

/** Wakes a contact's device. Carries the token only: no sender, no content. */
export async function wake(relayUrl: string, token: string, fetchImpl: typeof fetch = fetch): Promise<boolean> {
  try {
    const res = await fetchImpl(`${relayUrl}/v0/push/wake`, { method: 'POST', credentials: 'omit', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ token }) });
    return res.status === 202;
  } catch {
    return false;
  }
}
