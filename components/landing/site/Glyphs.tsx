/** Ledger Chat's own line icons for the site: 24 px grid, 1.7 px stroke, round joins. No third-party set. */
import React from 'react';
import type { Glyph } from '@/lib/landing/chapters';

const P: Record<Glyph | 'device' | 'network' | 'people', React.ReactNode> = {
  lock: <><rect x="5" y="10.5" width="14" height="10" rx="2.5" /><path d="M8 10.5V8a4 4 0 0 1 8 0v2.5M12 14.5v2" /></>,
  id: <><circle cx="12" cy="9" r="3.5" /><path d="M5.5 19.5c1.2-3.2 3.7-4.8 6.5-4.8s5.3 1.6 6.5 4.8" /><path d="M3.5 4.5l17 15" /></>,
  coin: <><rect x="3.5" y="6" width="17" height="12" rx="3" /><path d="M3.5 10h17M7.5 14.5h3" /></>,
  code: <><path d="M8.5 7.5L4 12l4.5 4.5M15.5 7.5L20 12l-4.5 4.5M13.5 5l-3 14" /></>,
  devices: <><rect x="3" y="5" width="13" height="10" rx="2" /><path d="M6.5 19h6" /><rect x="17" y="9" width="4.5" height="10" rx="1.2" /></>,
  eye: <><path d="M2.5 12s3.5-6.5 9.5-6.5 9.5 6.5 9.5 6.5-3.5 6.5-9.5 6.5S2.5 12 2.5 12z" /><circle cx="12" cy="12" r="3" /></>,
  device: <><rect x="6.5" y="2.5" width="11" height="19" rx="2.5" /><path d="M10 6.5h4M9.5 14l2 2 3.5-4" /></>,
  network: <><circle cx="5.5" cy="12" r="2" /><circle cx="18.5" cy="6" r="2" /><circle cx="18.5" cy="18" r="2" /><path d="M7.3 11.1l9.4-4.2M7.3 12.9l9.4 4.2M18.5 8v8" /></>,
  people: <><circle cx="8.5" cy="9" r="3" /><circle cx="16" cy="9.5" r="2.5" /><path d="M3 19c.9-3 3-4.5 5.5-4.5S13.1 16 14 19M14.5 15c2.4-.5 4.7.8 6 3.5" /></>,
};

export function GlyphIcon({ name, size = 24 }: { name: keyof typeof P; size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      {P[name]}
    </svg>
  );
}
