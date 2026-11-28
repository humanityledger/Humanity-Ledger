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
import { resetBoundedScroll } from '@/lib/layout/mobileViewport';

const KEYBOARD_MIN = 120; // px of screen taken away before it counts as a keyboard

export function KeyboardViewport() {
  useEffect(() => {
    const vv = typeof window !== 'undefined' ? window.visualViewport : null;
    if (!vv) return;
    const root = document.documentElement;
    let frame = 0;
    let wasOpen = false;
    let settle = 0;
    const update = () => {
      cancelAnimationFrame(frame);
      frame = requestAnimationFrame(() => {
        const open = window.innerHeight - vv.height > KEYBOARD_MIN;
        // Keyboard just closed: iOS often leaves the page scrolled (and --hl-vv-top stale) after the
        // bounce, which pushed the header and Back off screen. Put the bounded page back once it settles.
        if (wasOpen && !open) {
          window.clearTimeout(settle);
          settle = window.setTimeout(resetBoundedScroll, 180);
        }
        wasOpen = open;
        root.style.setProperty('--hl-vv-h', `${Math.round(vv.height)}px`);
        root.style.setProperty('--hl-vv-top', `${Math.round(vv.offsetTop)}px`);
        root.classList.toggle('hl-kb-open', open);
      });
    };
    update();
    // A field removed while focused (a sheet closing on Send) never reports the keyboard closing
    // on some WebViews: check again shortly after focus leaves any field.
    const onFocusOut = () => {
      window.clearTimeout(settle);
      settle = window.setTimeout(() => {
        const a = document.activeElement as HTMLElement | null;
        const editing = !!a && (a.tagName === 'INPUT' || a.tagName === 'TEXTAREA' || a.isContentEditable);
        if (!editing) { update(); resetBoundedScroll(); }
      }, 320);
    };
    vv.addEventListener('resize', update);
    vv.addEventListener('scroll', update);
    window.addEventListener('orientationchange', update);
    document.addEventListener('focusout', onFocusOut, true);
    return () => {
      cancelAnimationFrame(frame);
      window.clearTimeout(settle);
      document.removeEventListener('focusout', onFocusOut, true);
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
