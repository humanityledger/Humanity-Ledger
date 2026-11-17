'use client';

/**
 * components/layout/KeyboardViewport.tsx
 *
 * Keeps the chat exactly in the part of the screen the keyboard leaves free, on iPhone and iPad.
 *
 * iOS does not shrink the page when the keyboard opens: it covers the bottom of the page and
 * scrolls the view, so the conversation's header slid away, the message field moved, and Send
 * could end up under the keyboard. Here the chat's root (ClientLayout, [data-chat-root]) is given
 * the visible height and follows the visible top while the keyboard is open, so the field sits
 * right above the keyboard and Send is one tap away. Chrome on Android already resizes the page
 * (interactive-widget=resizes-content), so nothing changes there.
 */

import { useEffect } from 'react';

const KEYBOARD_MIN = 120; // px of screen taken away before it counts as a keyboard

export function KeyboardViewport() {
  useEffect(() => {
    const vv = typeof window !== 'undefined' ? window.visualViewport : null;
    if (!vv) return;
    const root = document.documentElement;
    let frame = 0;
    const update = () => {
      cancelAnimationFrame(frame);
      frame = requestAnimationFrame(() => {
        const open = window.innerHeight - vv.height > KEYBOARD_MIN;
        root.style.setProperty('--hl-vv-h', `${Math.round(vv.height)}px`);
        root.style.setProperty('--hl-vv-top', `${Math.round(vv.offsetTop)}px`);
        root.classList.toggle('hl-kb-open', open);
      });
    };
    update();
    vv.addEventListener('resize', update);
    vv.addEventListener('scroll', update);
    window.addEventListener('orientationchange', update);
    return () => {
      cancelAnimationFrame(frame);
      vv.removeEventListener('resize', update);
      vv.removeEventListener('scroll', update);
      window.removeEventListener('orientationchange', update);
      root.classList.remove('hl-kb-open');
      root.style.removeProperty('--hl-vv-h');
      root.style.removeProperty('--hl-vv-top');
    };
  }, []);
  return null;
}
