'use client';

/**
 * Counts this browser once per UTC day for the live map (POST /api/stats/visit). Sends only the
 * time zone the browser reports and a random id kept in this browser; the server stores neither
 * the id nor the IP address. Calls `onCounted` when the visit was counted, so the map can refresh.
 */
import { useEffect } from 'react';

const ID_KEY = 'hl.visit.id';
const DAY_KEY = 'hl.visit.day';

function randomId(): string {
  const bytes = new Uint8Array(16);
  crypto.getRandomValues(bytes);
  let bin = '';
  bytes.forEach((b) => { bin += String.fromCharCode(b); });
  return btoa(bin).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

export function useVisitBeacon(onCounted?: () => void) {
  useEffect(() => {
    let today: string;
    let vid: string;
    try {
      today = new Date().toISOString().slice(0, 10);
      if (localStorage.getItem(DAY_KEY) === today) return;
      vid = localStorage.getItem(ID_KEY) || randomId();
      localStorage.setItem(ID_KEY, vid);
    } catch {
      return; // storage blocked: do not count a browser we cannot recognise tomorrow
    }
    let tz = 'unknown';
    try { tz = Intl.DateTimeFormat().resolvedOptions().timeZone || 'unknown'; } catch { /* unknown */ }
    fetch('/api/stats/visit', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ tz, vid }),
      keepalive: true,
    })
      .then(async (r) => {
        if (!r.ok) return;
        try { localStorage.setItem(DAY_KEY, today); } catch { /* counted anyway */ }
        const d = await r.json().catch(() => null);
        if (d?.counted) onCounted?.();
      })
      .catch(() => {});
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
}
