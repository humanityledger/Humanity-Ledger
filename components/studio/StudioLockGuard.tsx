'use client';

/**
 * Ledger Studio is closed to the public. Entry points stay in the chat shell
 * (that file is not edited here). This guard refuses the click, the tap and
 * the keyboard, and marks the control with a red lock while the pointer is over it.
 * /studio itself renders a lock and does not load the studio.
 */

import { useEffect } from 'react';

const LOCK =
  "data:image/svg+xml," +
  encodeURIComponent(
    '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="#e5484d" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><rect x="5" y="11" width="14" height="9" rx="2"/><path d="M8 11V8a4 4 0 0 1 8 0v3"/></svg>',
  );

function studioEntry(target: EventTarget | null): HTMLElement | null {
  if (!(target instanceof Element)) return null;
  const el = target.closest('a, button, [role="button"], [role="menuitem"], [role="option"]');
  if (!(el instanceof HTMLElement)) return null;
  if (el instanceof HTMLAnchorElement) {
    const path = el.pathname || '';
    if (path === '/studio' || path.startsWith('/studio/')) return el;
  }
  const blob = `${el.getAttribute('aria-label') || ''} ${el.getAttribute('title') || ''} ${(el.textContent || '').slice(0, 80)}`;
  if (/ledger studio/i.test(blob)) return el;
  return null;
}

function mark(el: HTMLElement) {
  el.dataset.hlStudioLocked = '1';
  el.setAttribute('aria-disabled', 'true');
  el.style.cursor = 'not-allowed';
}

export function StudioLockGuard() {
  useEffect(() => {
    const style = document.createElement('style');
    style.textContent = `[data-hl-studio-locked="1"]{cursor:not-allowed !important;position:relative}[data-hl-studio-locked="1"]::after{content:"";position:absolute;right:2px;top:2px;width:14px;height:14px;pointer-events:none;background:center/14px 14px no-repeat url("${LOCK}")}`;
    document.head.appendChild(style);

    const block = (e: Event) => {
      const el = studioEntry(e.target);
      if (!el) return;
      mark(el);
      e.preventDefault();
      e.stopPropagation();
    };
    const over = (e: Event) => {
      const el = studioEntry(e.target);
      if (el) mark(el);
    };
    const key = (e: KeyboardEvent) => {
      if (e.key !== 'Enter' && e.key !== ' ') return;
      const el = studioEntry(document.activeElement);
      if (!el) return;
      mark(el);
      e.preventDefault();
      e.stopPropagation();
    };

    document.addEventListener('click', block, true);
    document.addEventListener('pointerdown', block, true);
    document.addEventListener('pointerover', over, true);
    document.addEventListener('keydown', key, true);
    return () => {
      style.remove();
      document.removeEventListener('click', block, true);
      document.removeEventListener('pointerdown', block, true);
      document.removeEventListener('pointerover', over, true);
      document.removeEventListener('keydown', key, true);
    };
  }, []);
  return null;
}
