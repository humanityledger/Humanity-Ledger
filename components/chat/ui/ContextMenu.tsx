'use client';

/**
 * components/chat/ui/ContextMenu.tsx
 *
 * A menu opened by a right click (or a long press on a touch screen) at the pointer. The app
 * blocks the browser's own context menu outside chats (components/ui/ClientFortress.tsx), so every
 * surface that needs one opens this instead.
 *
 * Closes on Escape, on a click or right click outside it, on scroll and on resize. Arrow keys move
 * between items; the first item takes focus when it opens.
 */

import React, { useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';

export interface MenuItem {
  label: string;
  onSelect: () => void;
  icon?: React.ReactNode;
  danger?: boolean;
  disabled?: boolean;
}

export interface MenuAt {
  x: number;
  y: number;
}

export function ContextMenu({ at, items, label, onClose }: { at: MenuAt; items: MenuItem[]; label: string; onClose: () => void }) {
  const ref = useRef<HTMLDivElement>(null);
  const [pos, setPos] = useState<{ top: number; left: number }>({ top: at.y, left: at.x });

  // Keep the whole menu on screen: it opens left of or above the pointer when there is no room.
  useLayoutEffect(() => {
    const el = ref.current;
    if (!el) return;
    const { width, height } = el.getBoundingClientRect();
    const vw = window.innerWidth;
    const vh = window.innerHeight;
    const left = at.x + width + 8 > vw ? Math.max(8, at.x - width) : at.x;
    const top = at.y + height + 8 > vh ? Math.max(8, at.y - height) : at.y;
    setPos({ top, left });
    el.querySelector<HTMLButtonElement>('button:not([disabled])')?.focus({ preventScroll: true });
  }, [at.x, at.y]);

  useEffect(() => {
    const close = () => onClose();
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.preventDefault();
        onClose();
        return;
      }
      if (e.key !== 'ArrowDown' && e.key !== 'ArrowUp') return;
      const buttons = Array.from(ref.current?.querySelectorAll<HTMLButtonElement>('button:not([disabled])') ?? []);
      if (!buttons.length) return;
      e.preventDefault();
      const i = buttons.indexOf(document.activeElement as HTMLButtonElement);
      const next = e.key === 'ArrowDown' ? (i + 1) % buttons.length : (i - 1 + buttons.length) % buttons.length;
      buttons[next].focus();
    };
    window.addEventListener('keydown', onKey);
    window.addEventListener('resize', close);
    window.addEventListener('scroll', close, true);
    return () => {
      window.removeEventListener('keydown', onKey);
      window.removeEventListener('resize', close);
      window.removeEventListener('scroll', close, true);
    };
  }, [onClose]);

  if (typeof document === 'undefined') return null;
  return createPortal(
    <div
      className="fixed inset-0 z-[300]"
      onClick={onClose}
      onContextMenu={(e) => {
        e.preventDefault();
        onClose();
      }}
    >
      <div
        ref={ref}
        role="menu"
        aria-label={label}
        className="absolute min-w-[220px] max-w-[300px] rounded-2xl border border-[#d4d8de] bg-white p-1.5 shadow-[0_16px_40px_-12px_rgba(16,24,40,0.28)] flex flex-col"
        style={{ top: pos.top, left: pos.left }}
        onClick={(e) => e.stopPropagation()}
      >
        {items.map((it) => (
          <button
            key={it.label}
            role="menuitem"
            type="button"
            disabled={it.disabled}
            onClick={() => {
              onClose();
              it.onSelect();
            }}
            className={`min-h-[44px] flex items-center gap-3 px-3 py-2 rounded-xl text-left text-[16px] outline-none hover:bg-[#f2f4f7] focus-visible:bg-[#eff1f4] disabled:opacity-40 ${it.danger ? 'text-[#9b1c16]' : 'text-[#15171c]'}`}
          >
            {it.icon ? <span className="w-5 flex justify-center shrink-0 text-[#3d424b]" aria-hidden="true">{it.icon}</span> : null}
            <span className="truncate">{it.label}</span>
          </button>
        ))}
      </div>
    </div>,
    document.body,
  );
}

/**
 * Right click and long press (touch, 500 ms without moving) both open the menu at the pointer.
 * Returns the handlers to spread on the element, and whether the last press opened the menu, so
 * the element can ignore the click that ends a long press.
 */
export function useContextMenuTrigger(open: (at: MenuAt) => void) {
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const start = useRef<{ x: number; y: number } | null>(null);
  const fired = useRef(false);

  const cancel = useCallback(() => {
    if (timer.current) clearTimeout(timer.current);
    timer.current = null;
    start.current = null;
  }, []);

  useEffect(() => cancel, [cancel]);

  const handlers = {
    onContextMenu: (e: React.MouseEvent) => {
      e.preventDefault();
      cancel();
      fired.current = false;
      open({ x: e.clientX, y: e.clientY });
    },
    onPointerDown: (e: React.PointerEvent) => {
      fired.current = false;
      if (e.pointerType !== 'touch') return;
      start.current = { x: e.clientX, y: e.clientY };
      timer.current = setTimeout(() => {
        fired.current = true;
        const at = start.current;
        cancel();
        if (at) {
          navigator.vibrate?.(10);
          open(at);
        }
      }, 500);
    },
    onPointerMove: (e: React.PointerEvent) => {
      const s = start.current;
      if (s && Math.hypot(e.clientX - s.x, e.clientY - s.y) > 10) cancel();
    },
    onPointerUp: cancel,
    onPointerCancel: cancel,
  };

  /** True once, right after a long press opened the menu: the click that follows is not a tap. */
  const consumeLongPress = () => {
    const f = fired.current;
    fired.current = false;
    return f;
  };

  return { handlers, consumeLongPress };
}
