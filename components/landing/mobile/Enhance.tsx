'use client';
/**
 * The phone landing's second island, for what needs JavaScript but not the scroll:
 *  - copy buttons ([data-copy]) put a hash on the clipboard; the hash is also selectable text;
 *  - the live numbers ([data-live]) are filled once, when the page is idle, from GET /api/stats/live
 *    (lib/stats/live.ts): text only, in boxes whose size never changes, so nothing moves.
 * No React state: nothing re-renders, ever.
 */
import { useEffect } from 'react';

type Live = { accounts: number; usernames: number; visitors: number; visitorsToday: number; aztecBlock: number | null };
const fmt = (n: number) => n.toLocaleString('en-US');

export function Enhance() {
  useEffect(() => {
    const onClick = (ev: MouseEvent) => {
      const b = (ev.target as Element | null)?.closest<HTMLButtonElement>('button[data-copy]');
      if (!b) return;
      navigator.clipboard?.writeText(b.dataset.copy ?? '').then(() => {
        const label = b.textContent;
        b.textContent = 'Copied';
        setTimeout(() => { b.textContent = label; }, 1600);
      }).catch(() => undefined);
    };
    document.addEventListener('click', onClick);
    const load = () => fetch('/api/stats/live', { cache: 'no-store' })
      .then((r) => (r.ok ? (r.json() as Promise<Live>) : null))
      .then((d) => {
        if (!d) return;
        const set = (k: string, v: string) => { const el = document.querySelector(`[data-live="${k}"]`); if (el) el.textContent = v; };
        set('accounts', fmt(d.accounts));
        set('usernames', fmt(d.usernames));
        set('visitors', fmt(d.visitors));
        set('today', `${fmt(d.visitorsToday)} today`);
        if (d.aztecBlock != null) set('block', fmt(d.aztecBlock));
      })
      .catch(() => undefined);
    const idle = (window as Window & { requestIdleCallback?: (cb: () => void, o?: { timeout: number }) => number }).requestIdleCallback;
    if (idle) idle(load, { timeout: 4000 }); else setTimeout(load, 1500);
    return () => document.removeEventListener('click', onClick);
  }, []);
  return null;
}
