'use client';

/**
 * hooks/useMobileBackStack.ts
 *
 * Swipe-back on iPhone, the Back button on Android and the browser's Back key close the top layer
 * of Ledger Chat (a sheet, then a panel, then the conversation) instead of leaving /chat.
 *
 * Each open layer owns one history entry on the same URL, marked with its depth (hlDepth). One
 * reconcile step keeps the number of entries equal to the number of open layers:
 *   - a layer opens          → push an entry;
 *   - a layer closes in UI   → go back over its entry (the popstate that follows is ignored);
 *   - the user goes back     → close every layer above the depth of the entry now shown.
 * Next.js App Router patches history.pushState and copies its own state (__NA, tree) into every
 * entry, so its popstate handler restores the same page instead of reloading. A layer that is
 * still open when the page has moved to another route (ChatKeepAlive keeps the chat mounted) is
 * never reconciled there, so leaving /chat with a link never bounces back.
 */

import { useEffect, useRef } from 'react';

type Layer = { id: number; path: string; close: () => void };

const stack: Layer[] = [];
let nextId = 1;
let pendingBack = false;
let installed = false;
let scheduled = false;

function currentDepth(): number {
  const st = typeof window !== 'undefined' ? (window.history.state as { hlDepth?: unknown } | null) : null;
  return typeof st?.hlDepth === 'number' ? st.hlDepth : 0;
}

function reconcile(): void {
  scheduled = false;
  if (typeof window === 'undefined' || pendingBack) return;
  const path = window.location.pathname;
  const live = stack.filter((l) => l.path === path);
  const want = live.length;
  const have = currentDepth();
  if (have > want) {
    pendingBack = true;
    window.history.go(want - have);
  } else if (have < want) {
    for (let d = have + 1; d <= want; d++) {
      const prev = (window.history.state as Record<string, unknown> | null) ?? {};
      window.history.pushState({ ...prev, hlDepth: d }, '');
    }
  }
}

function schedule(): void {
  if (scheduled) return;
  scheduled = true;
  queueMicrotask(reconcile);
}

function onPopState(): void {
  if (pendingBack) {
    pendingBack = false;
    schedule();
    return;
  }
  const path = window.location.pathname;
  const depth = currentDepth();
  // Close from the top until the open layers on this page match the entry the user went back to.
  for (;;) {
    const live = stack.filter((l) => l.path === path);
    if (live.length <= depth) break;
    const top = live[live.length - 1];
    stack.splice(stack.indexOf(top), 1);
    try {
      top.close();
    } catch {
      /* a layer's close must never break the others */
    }
  }
}

function install(): void {
  if (installed || typeof window === 'undefined') return;
  installed = true;
  window.addEventListener('popstate', onPopState);
}

/** Number of layers currently registered (tests and diagnostics). */
export function backStackDepth(): number {
  return stack.length;
}

/**
 * Register a layer while `open` is true. `onClose` must only update state (it runs when the user
 * goes back); closing from the UI is detected automatically when `open` turns false.
 */
export function useBackLayer(open: boolean, onClose: () => void, enabled = true): void {
  const closeRef = useRef(onClose);
  closeRef.current = onClose;

  useEffect(() => {
    if (!open || !enabled || typeof window === 'undefined') return;
    install();
    const layer: Layer = { id: nextId++, path: window.location.pathname, close: () => closeRef.current() };
    stack.push(layer);
    schedule();
    return () => {
      const i = stack.indexOf(layer);
      if (i >= 0) {
        stack.splice(i, 1);
        schedule();
      }
    };
  }, [open, enabled]);
}
