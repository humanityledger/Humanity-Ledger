'use client';

/**
 * lib/layout/mobileViewport.ts
 *
 * One answer to "is this a phone?", taken from the physical screen rather than from the CSS
 * viewport. Safari (desktop-site mode, a page that overflowed) and some wallet browsers can lay a
 * phone page out 800–980 px wide; Tailwind's md:/lg: breakpoints then switch on the tablet or
 * desktop layout and the rail, the list, the chat and Contact info end up side by side in tiny
 * type. The inline script in app/layout.tsx sets html[data-hl-device] before the first paint and
 * keeps it current; components read it here and app/glassmorphism.css enforces the one-pane rule.
 */

import { useSyncExternalStore } from 'react';

export type HlDevice = 'phone' | 'tablet' | 'desktop';

/** Same rule as the inline script in app/layout.tsx (keep them in step). */
export function classifyDevice(input: {
  screenWidth: number;
  screenHeight: number;
  coarse: boolean;
  touchUa: boolean;
}): HlDevice {
  const shortSide = Math.min(input.screenWidth, input.screenHeight);
  const touch = input.coarse || input.touchUa;
  if ((touch && shortSide < 768) || (input.coarse && input.screenWidth < 1024)) return 'phone';
  return touch ? 'tablet' : 'desktop';
}

export function detectDevice(): HlDevice {
  if (typeof window === 'undefined') return 'desktop';
  const attr = document.documentElement.getAttribute('data-hl-device');
  if (attr === 'phone' || attr === 'tablet' || attr === 'desktop') return attr;
  const ua = navigator.userAgent || '';
  return classifyDevice({
    screenWidth: window.screen?.width ?? window.innerWidth,
    screenHeight: window.screen?.height ?? window.innerHeight,
    coarse: !!window.matchMedia?.('(pointer: coarse)').matches,
    touchUa: /iPhone|iPad|iPod|Android/i.test(ua) || (/Macintosh/.test(ua) && navigator.maxTouchPoints > 1),
  });
}

function subscribe(onChange: () => void): () => void {
  if (typeof window === 'undefined') return () => {};
  const mo = new MutationObserver(onChange);
  mo.observe(document.documentElement, { attributes: true, attributeFilter: ['data-hl-device'] });
  window.addEventListener('resize', onChange, { passive: true });
  return () => {
    mo.disconnect();
    window.removeEventListener('resize', onChange);
  };
}

export function useHlDevice(): HlDevice {
  return useSyncExternalStore(subscribe, detectDevice, () => 'desktop');
}

/** True on phones, and on any screen narrower than 1024 px where side panels cannot fit. */
export function useCompactLayout(): boolean {
  const device = useHlDevice();
  const narrow = useSyncExternalStore(
    subscribe,
    () => (typeof window !== 'undefined' ? window.innerWidth < 1024 : false),
    () => false,
  );
  return device === 'phone' || narrow;
}

/**
 * After a field loses focus with the keyboard gone, put a bounded page back at its origin.
 * iOS leaves window.scrollY > 0 after the keyboard bounce; with body fixed (ios-scroll-lock-strict)
 * the header and the back button then sit above the screen until a reload.
 */
export function resetBoundedScroll(): void {
  if (typeof window === 'undefined') return;
  const vv = window.visualViewport;
  const keyboardGone = !vv || vv.height >= window.innerHeight - 60;
  if (!keyboardGone) return;
  // Only pages that never scroll as a document (chat, dashboard): a landing page keeps its place.
  const bounded = document.body.classList.contains('ios-scroll-lock-strict') || !!document.querySelector('[data-chat-root]');
  if (!bounded) return;
  if (window.scrollY > 0 || window.scrollX > 0) window.scrollTo(0, 0);
  document.documentElement.classList.remove('hl-kb-open');
}
