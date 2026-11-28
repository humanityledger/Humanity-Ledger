'use client';

/**
 * Renders its children straight into document.body.
 *
 * A position:fixed sheet rendered inside a transformed or clipping ancestor (the Contact info
 * drawer animates with transform; its body scrolls with overflow-y:auto) is positioned and clipped
 * by that ancestor on WebKit: on iPhone the "Chat background" and "Verify encryption" dialogs were
 * cut in half at the drawer's left edge. Every sheet and modal of the chat goes through here.
 *
 * Stacking order (z-index) for everything portalled:
 *   side panels 250000–250001 · sheets/modals 260000–260500 · nested sheets 265000 · calls stay above.
 */

import { useSyncExternalStore, type ReactNode } from 'react';
import { createPortal } from 'react-dom';

const noop = () => () => {};

export function useIsClient(): boolean {
  return useSyncExternalStore(noop, () => true, () => false);
}

export function BodyPortal({ children }: { children: ReactNode }) {
  const client = useIsClient();
  if (!client || typeof document === 'undefined') return null;
  return createPortal(children, document.body);
}
