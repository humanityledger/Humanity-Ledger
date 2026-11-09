'use client';

import { useEffect } from 'react';

/**
 * Publishes the height of the on-screen keyboard as --keyboard-inset on <html>.
 *
 * iOS Safari keeps the layout viewport (and so 100vh and fixed boxes) the same
 * size when the keyboard opens and only shrinks the visual viewport, which
 * leaves a bottom input bar underneath the keyboard. innerHeight minus the
 * visual viewport height (and its scroll offset) is the covered strip. Where
 * the browser resizes the layout itself (Chrome Android) the value stays 0.
 */
export function useKeyboardInset(): void {
  useEffect(() => {
    const vv = window.visualViewport;
    if (!vv) return;
    const root = document.documentElement;
    let raf = 0;
    const update = () => {
      raf = 0;
      const inset = Math.max(0, Math.round(window.innerHeight - vv.height - vv.offsetTop));
      root.style.setProperty('--keyboard-inset', `${inset}px`);
    };
    const schedule = () => {
      if (!raf) raf = requestAnimationFrame(update);
    };
    update();
    vv.addEventListener('resize', schedule);
    vv.addEventListener('scroll', schedule);
    return () => {
      vv.removeEventListener('resize', schedule);
      vv.removeEventListener('scroll', schedule);
      if (raf) cancelAnimationFrame(raf);
      root.style.removeProperty('--keyboard-inset');
    };
  }, []);
}
