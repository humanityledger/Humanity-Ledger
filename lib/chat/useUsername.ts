'use client';

/**
 * lib/chat/useUsername.ts — the signed-in account's username and profile link, from
 * /api/chat/username. One shared copy per page: every screen that shows the username (settings,
 * profile, the QR sheet) sees the same value right after a change.
 */
import { useCallback, useEffect, useSyncExternalStore } from 'react';
import { canonicalUsername, LINK_TOKEN_RE, profileLink } from './usernames';

export interface UsernameState {
  loaded: boolean;
  username: string | null;
  linkToken: string | null;
  /** Why the last load failed (shown with a Try again button), or null. */
  error: string | null;
}

let state: UsernameState = { loaded: false, username: null, linkToken: null, error: null };
let loading: Promise<void> | null = null;
const listeners = new Set<() => void>();
const set = (next: UsernameState) => {
  state = next;
  listeners.forEach((l) => l());
};

export class UsernameError extends Error {
  constructor(message: string, readonly problem?: string, readonly suggestions: string[] = []) {
    super(message);
    this.name = 'UsernameError';
  }
}

async function call(method: 'GET' | 'PUT' | 'POST' | 'DELETE', body?: unknown) {
  const res = await fetch('/api/chat/username', {
    method,
    headers: body ? { 'Content-Type': 'application/json' } : undefined,
    body: body ? JSON.stringify(body) : undefined,
    cache: 'no-store',
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new UsernameError(data.error || (method === 'GET' ? 'Could not load your username. Check your connection and try again.' : 'Could not save. Try again.'), data.problem, Array.isArray(data.suggestions) ? data.suggestions : []);
  return { username: (data.username as string | null) ?? null, linkToken: (data.linkToken as string | null) ?? null };
}

function load(force = false) {
  if (loading && !force) return loading;
  loading = call('GET')
    .then((d) => set({ loaded: true, error: null, ...d }))
    .catch((e) => set({ ...state, loaded: true, error: e instanceof Error ? e.message : 'Could not load your username. Try again.' }))
    .finally(() => {
      loading = null;
    });
  return loading;
}

export function useUsername(enabled = true) {
  const snap = useSyncExternalStore(
    (l) => {
      listeners.add(l);
      return () => listeners.delete(l);
    },
    () => state,
    () => state,
  );
  useEffect(() => {
    if (enabled && !state.loaded) void load();
  }, [enabled]);

  const save = useCallback(async (name: string) => set({ loaded: true, error: null, ...(await call('PUT', { username: canonicalUsername(name) })) }), []);
  const resetLink = useCallback(async () => set({ loaded: true, error: null, ...(await call('POST', { action: 'reset-link' })) }), []);
  const remove = useCallback(async () => set({ loaded: true, error: null, ...(await call('DELETE')) }), []);

  const link = snap.linkToken && LINK_TOKEN_RE.test(snap.linkToken) && typeof window !== 'undefined' ? profileLink(window.location.origin, snap.linkToken) : null;
  return { ...snap, link, save, resetLink, remove, reload: () => load(true) };
}

/** Is this username free right now? null while unknown (offline, rate limited). */
export async function usernameAvailable(name: string, mine: string | null): Promise<boolean | null> {
  const u = canonicalUsername(name);
  if (mine && u === mine) return true;
  try {
    const res = await fetch(`/api/chat/username/lookup?u=${encodeURIComponent(u)}`, { cache: 'no-store' });
    if (res.status === 404) return true;
    if (res.ok) return false;
    // 503: the store is down, so availability is unknown (Save will say why).
    return null;
  } catch {
    return null;
  }
}

/** The account behind an exact username, or null. */
export async function lookupUsername(name: string): Promise<{ address: string; username: string; name: string | null } | null> {
  const res = await fetch(`/api/chat/username/lookup?u=${encodeURIComponent(canonicalUsername(name))}`, { cache: 'no-store' });
  if (res.status === 404) return null;
  if (!res.ok) throw new Error(res.status === 429 ? 'Too many searches. Wait a minute.' : 'Search is unavailable right now.');
  const d = await res.json();
  return d?.found ? { address: String(d.address).toLowerCase(), username: d.username, name: d.name ?? null } : null;
}

/** The account behind a profile link token, or null when the link was reset or never existed. */
export async function openProfileLink(token: string): Promise<{ address: string; username: string } | null> {
  const res = await fetch('/api/chat/username/link', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ token }), cache: 'no-store' });
  if (res.status === 404) return null;
  if (!res.ok) throw new Error(res.status === 429 ? 'Too many requests. Wait a minute.' : 'This link could not be opened right now.');
  const d = await res.json();
  return d?.found ? { address: String(d.address).toLowerCase(), username: d.username } : null;
}
