'use client';

/**
 * hooks/useCommunityWelcomer.ts — while Ledger Chat is open, this device welcomes members who are
 * waiting for the encrypted channel of a community it belongs to (lib/communities/welcome-queue.ts).
 *
 * Every 12 s (visible tab, online), and at once when the tab comes back: ask the server whether
 * anyone is waiting in one of my communities. If so, run the MLS membership sync immediately
 * (adds the wallet, welcomes new devices of existing members, republishes) and send a history
 * capsule to those channels, so the newcomer can post and read the past within seconds.
 */

import { useEffect } from 'react';
import { syncCommunitiesMlsMembership } from '@/lib/communities/mls';

const EVERY_MS = 12_000;

export function useCommunityWelcomer(client: unknown, address: string | null | undefined): void {
  useEffect(() => {
    if (!client || !address) return;
    let stopped = false;
    let busy = false;
    const tick = async () => {
      if (stopped || busy) return;
      if (typeof document !== 'undefined' && document.visibilityState !== 'visible') return;
      if (typeof navigator !== 'undefined' && navigator.onLine === false) return;
      busy = true;
      try {
        const res = await fetch('/api/chat/communities/welcome-queue', { credentials: 'include', cache: 'no-store' });
        if (!res.ok) return;
        const d = await res.json().catch(() => ({}));
        const ids: string[] = Array.isArray(d?.pending) ? d.pending.map((p: { communityId?: unknown }) => String(p?.communityId ?? '')).filter(Boolean) : [];
        if (!ids.length || stopped) return;
        await syncCommunitiesMlsMembership(client, address, fetch, 0, true, new Set(ids)).catch(() => null);
      } catch {
        /* next tick */
      } finally {
        busy = false;
      }
    };
    const timer = setInterval(() => { void tick(); }, EVERY_MS);
    const onWake = () => { void tick(); };
    document.addEventListener('visibilitychange', onWake);
    window.addEventListener('online', onWake);
    void tick();
    return () => {
      stopped = true;
      clearInterval(timer);
      document.removeEventListener('visibilitychange', onWake);
      window.removeEventListener('online', onWake);
    };
  }, [client, address]);
}
