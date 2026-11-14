/**
 * lib/errors/chunk-recovery.ts — recover from a JavaScript chunk that failed to load.
 *
 * A chunk fails to load in two ordinary cases: a deploy replaced the build the page was loaded with,
 * or iOS cut the page's network while the person was in another app (MetaMask, to sign) and a chunk was
 * being fetched at that moment. Both are fixed by loading the page again once it is in front.
 *
 * Before, each error boundary kept a one-shot flag in sessionStorage that was never cleared after a good
 * load: the first chunk error of a tab reloaded, the second one (minutes later, after the next deploy)
 * showed the full error screen with a stack trace. Now a reload is allowed whenever the last one was more
 * than RELOAD_GAP_MS ago, which still stops a loop, and it waits until the page is visible.
 *
 * The key is shared with the inline recovery script in app/layout.tsx, so the two never reload in turn.
 */

export const CHUNK_RELOAD_KEY = 'chunk_reload_ts';
export const RELOAD_GAP_MS = 15_000;

export function isChunkLoadError(error: unknown): boolean {
  const e = error as { name?: unknown; message?: unknown } | null | undefined;
  if (!e) return false;
  if (e.name === 'ChunkLoadError') return true;
  const msg = typeof e.message === 'string' ? e.message.toLowerCase() : '';
  return (
    msg.includes('loading chunk') ||
    msg.includes('loading css chunk') ||
    msg.includes('failed to fetch dynamically imported module') ||
    msg.includes('importing a module script failed') ||
    msg.includes('error loading dynamically imported module')
  );
}

/** True when no automatic reload happened in the last RELOAD_GAP_MS. */
export function reloadAllowed(lastReloadAt: number | null, now: number): boolean {
  if (lastReloadAt === null || !Number.isFinite(lastReloadAt)) return true;
  return now - lastReloadAt > RELOAD_GAP_MS || now < lastReloadAt;
}

interface StorageLike {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
}

/**
 * Reload the page for fresh chunks if allowed. Returns true when a reload was scheduled; false when the
 * caller should show its error screen (a reload just happened, or storage is unavailable, which would
 * leave nothing to stop a loop).
 */
export function reloadForFreshChunks(
  storage: StorageLike | null = typeof window !== 'undefined' ? safeSessionStorage() : null,
  now: number = Date.now(),
): boolean {
  if (!storage || typeof window === 'undefined') return false;
  try {
    const raw = storage.getItem(CHUNK_RELOAD_KEY);
    const last = raw === null ? null : parseInt(raw, 10);
    if (!reloadAllowed(last, now)) return false;
    storage.setItem(CHUNK_RELOAD_KEY, String(now));
  } catch {
    return false;
  }
  const reload = () => window.location.reload();
  if (typeof document !== 'undefined' && document.visibilityState === 'hidden') {
    const onVisible = () => {
      if (document.visibilityState !== 'visible') return;
      document.removeEventListener('visibilitychange', onVisible);
      reload();
    };
    document.addEventListener('visibilitychange', onVisible);
  } else {
    reload();
  }
  return true;
}

function safeSessionStorage(): StorageLike | null {
  try {
    return window.sessionStorage;
  } catch {
    return null;
  }
}
