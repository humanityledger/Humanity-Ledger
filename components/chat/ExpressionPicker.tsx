'use client';

/**
 * The composer's expression panel: Emojis, Stickers and GIFs, in one rounded sheet.
 *
 * - Emojis: emoji-picker-react with the system's own emoji font (on iPhone and Mac that is
 *   Apple's set), recent emojis first; picking one adds it to the message being written.
 * - Stickers: Ledger Chat's own packs (lib/chat/stickers.ts), one tab per pack; one tap sends it,
 *   and most stickers play a full-chat moment when they land (components/chat/StickerSceneHost.tsx).
 * - GIFs: GIPHY through /api/gifs (trending, then search as you type), two-column masonry,
 *   with the "Powered by GIPHY" attribution GIPHY requires; one tap sends it.
 */

import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import dynamic from 'next/dynamic';
import { Loader2, Search } from 'lucide-react';
// Types only: importing the enums would pull the whole picker (and its emoji data) into the chat
// bundle; it is loaded with next/dynamic when the picker opens.
import type { EmojiClickData, EmojiStyle, Theme } from 'emoji-picker-react';
import { STICKER_PACKS, stickerFile, stickerMessage } from '@/lib/chat/stickers';
import { supportedEmojiVersion } from '@/lib/chat/emojiSupport';

const EmojiPicker = dynamic(() => import('emoji-picker-react'), { ssr: false, loading: () => <Spinner /> });

export type ExpressionTab = 'emoji' | 'sticker' | 'gif';

interface Gif { id: string; url: string; preview: string; width: number; height: number; title: string }

function Spinner() {
  return <div className="flex-1 flex items-center justify-center py-10"><Loader2 size={20} className="animate-spin text-[#a3a9b4]" /></div>;
}

export function ExpressionPicker({
  initialTab = 'emoji',
  onEmoji,
  onSend,
  onClose,
}: {
  initialTab?: ExpressionTab;
  onEmoji: (emoji: string) => void;
  /** Sends a sticker or GIF message as is. */
  onSend: (content: string) => void;
  onClose: () => void;
}) {
  const [tab, setTabState] = useState<ExpressionTab>(initialTab);
  // Panes stay mounted once opened: going back to Emojis keeps its scroll and does not load the
  // picker again (it used to remount, with a spinner, on every switch).
  const [mounted, setMounted] = useState<Set<ExpressionTab>>(() => new Set([initialTab]));
  const ref = useRef<HTMLDivElement>(null);
  const viewport = useRef<HTMLDivElement>(null);
  const index = TABS.findIndex(([id]) => id === tab);
  // The finger's offset while a swipe is under way (px), or null.
  const [drag, setDrag] = useState<number | null>(null);
  const closeRef = useRef(onClose);
  closeRef.current = onClose;

  const setTab = useCallback((next: ExpressionTab) => {
    setTabState(next);
    setMounted((m) => (m.has(next) ? m : new Set(m).add(next)));
  }, []);

  // A toggle in the composer for another tab, while the panel is open, goes to it.
  useEffect(() => { setTab(initialTab); }, [initialTab, setTab]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') closeRef.current(); };
    const onDown = (e: PointerEvent) => {
      const t = e.target as HTMLElement;
      if (ref.current && !ref.current.contains(t) && !t.closest('[data-expression-toggle]')) closeRef.current();
    };
    window.addEventListener('keydown', onKey);
    window.addEventListener('pointerdown', onDown);
    return () => { window.removeEventListener('keydown', onKey); window.removeEventListener('pointerdown', onDown); };
  }, []);

  // ── Swipe between tabs ────────────────────────────────────────────────────
  // A horizontal swipe with a finger (or pen) moves the panes with it; letting go past a fifth
  // of the width, or with a quick flick, lands on the next tab. Vertical scrolling stays native
  // (touch-action: pan-y). A trackpad's sideways two-finger swipe does the same on a computer.
  const g = useRef<{ id: number; x: number; y: number; t: number; on: boolean; dead: boolean; dx: number } | null>(null);
  const suppressClick = useRef(false);
  const widthOf = () => viewport.current?.clientWidth || 1;
  const settle = (dx: number, dt: number) => {
    const w = widthOf();
    const fast = Math.abs(dx) / Math.max(dt, 1) > 0.45 && Math.abs(dx) > 30;
    let next = index;
    if (dx < 0 && (dx < -w * 0.2 || fast)) next = Math.min(TABS.length - 1, index + 1);
    if (dx > 0 && (dx > w * 0.2 || fast)) next = Math.max(0, index - 1);
    setDrag(null);
    if (next !== index) setTab(TABS[next][0]);
  };
  const onPointerDown = (e: React.PointerEvent) => {
    if (e.pointerType === 'mouse') return;
    const t = e.target as HTMLElement;
    // Rows that scroll sideways themselves (sticker packs), and text fields, keep their gesture.
    if (t.closest('[data-no-swipe], input, textarea')) return;
    g.current = { id: e.pointerId, x: e.clientX, y: e.clientY, t: performance.now(), on: false, dead: false, dx: 0 };
  };
  const onPointerMove = (e: React.PointerEvent) => {
    const s0 = g.current;
    if (!s0 || s0.id !== e.pointerId || s0.dead) return;
    const dx = e.clientX - s0.x;
    const dy = e.clientY - s0.y;
    s0.dx = dx;
    if (!s0.on) {
      if (Math.abs(dy) > 10 && Math.abs(dy) > Math.abs(dx)) { s0.dead = true; return; } // a scroll
      if (Math.abs(dx) < 10 || Math.abs(dx) < Math.abs(dy) * 1.3) return;
      s0.on = true;
      try { (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId); } catch { /* ignore */ }
      // The neighbours are ready before they slide in.
      setMounted((m) => {
        const n = new Set(m);
        if (TABS[index - 1]) n.add(TABS[index - 1][0]);
        if (TABS[index + 1]) n.add(TABS[index + 1][0]);
        return n;
      });
    }
    // At the first and last tab the panes resist, like a rubber band.
    const atEdge = (dx > 0 && index === 0) || (dx < 0 && index === TABS.length - 1);
    setDrag(atEdge ? dx / 3 : dx);
  };
  const onPointerEnd = (e: React.PointerEvent) => {
    const s0 = g.current;
    g.current = null;
    if (!s0 || s0.id !== e.pointerId || !s0.on) return;
    suppressClick.current = true;
    setTimeout(() => { suppressClick.current = false; }, 50);
    // The last move decides, not the release point: some browsers report 0,0 on release, and a
    // cancelled gesture (the browser took it over) springs back where it was.
    if (e.type === 'pointercancel') { setDrag(null); return; }
    settle(s0.dx, performance.now() - s0.t);
  };
  // A trackpad's sideways swipe: one tab per gesture. A native, non-passive listener, so the
  // gesture is kept from the browser (Chrome and Safari read it as "back" / "forward" otherwise).
  const wheel = useRef({ sum: 0, at: 0, lock: 0 });
  const indexRef = useRef(index);
  indexRef.current = index;
  useEffect(() => {
    const el = viewport.current;
    if (!el) return;
    const onWheel = (e: WheelEvent) => {
      if (Math.abs(e.deltaX) <= Math.abs(e.deltaY) * 1.5) return; // vertical scrolling: the browser's
      e.preventDefault();
      const now = performance.now();
      const w = wheel.current;
      if (now < w.lock) return;
      if (now - w.at > 250) w.sum = 0;
      w.at = now;
      w.sum += e.deltaX;
      if (Math.abs(w.sum) > 70) {
        const i = indexRef.current;
        const next = Math.max(0, Math.min(TABS.length - 1, i + (w.sum > 0 ? 1 : -1)));
        w.sum = 0;
        w.lock = now + 450; // one tab per swipe, whatever the trackpad's momentum
        if (next !== i) setTab(TABS[next][0]);
      }
    };
    el.addEventListener('wheel', onWheel, { passive: false });
    return () => el.removeEventListener('wheel', onWheel);
  }, [setTab]);

  const progress = drag === null ? index : index - drag / widthOf();
  // The indicator follows the real buttons, measured, instead of a percentage formula: when the
  // three tabs did not lay out as three equal columns the white pill sat on the wrong word and
  // the tabs looked broken (18 November 2026). Each tab now has a third of the bar, by inline grid.
  const tabsRef = useRef<HTMLDivElement>(null);
  const [slots, setSlots] = useState<Array<{ left: number; width: number }>>([]);
  useEffect(() => {
    const bar = tabsRef.current;
    if (!bar) return;
    const measure = () => {
      const buttons = Array.from(bar.querySelectorAll<HTMLElement>('[data-tab]'));
      setSlots(buttons.map((b) => ({ left: b.offsetLeft, width: b.offsetWidth })));
    };
    measure();
    const ro = typeof ResizeObserver !== 'undefined' ? new ResizeObserver(measure) : null;
    ro?.observe(bar);
    return () => ro?.disconnect();
  }, []);
  const pill = (() => {
    if (slots.length !== TABS.length) return null;
    const p = Math.max(0, Math.min(TABS.length - 1, progress));
    const i = Math.floor(p), f = p - i;
    const a = slots[i], b = slots[Math.min(TABS.length - 1, i + 1)];
    return { left: a.left + (b.left - a.left) * f, width: a.width + (b.width - a.width) * f };
  })();

  return (
    <div
      ref={ref}
      role="dialog"
      aria-label="Emojis, stickers and GIFs"
      className="absolute bottom-[68px] left-2 z-50 w-[min(392px,calc(100vw-16px))] h-[min(480px,62vh)] flex flex-col bg-white rounded-[28px] border border-[#e4e7ec] shadow-[0_28px_60px_-18px_rgba(16,24,40,0.30)] overflow-hidden animate-in fade-in slide-in-from-bottom-2 duration-150"
    >
      <div className="px-3.5 pt-3.5 pb-3 shrink-0">
        {/* Segmented tabs: 8 px between tabs, one white indicator that follows the finger. */}
        <div
          ref={tabsRef}
          className="relative p-1.5 rounded-full bg-[#f2f4f7]"
          style={{ display: 'grid', gridTemplateColumns: 'repeat(3, minmax(0, 1fr))', columnGap: 8 }}
          role="tablist"
          aria-label="Emojis, stickers and GIFs"
          onKeyDown={(e) => {
            if (e.key !== 'ArrowRight' && e.key !== 'ArrowLeft') return;
            e.preventDefault();
            const next = TABS[(index + (e.key === 'ArrowRight' ? 1 : TABS.length - 1)) % TABS.length][0];
            setTab(next);
            (e.currentTarget.querySelector(`[data-tab="${next}"]`) as HTMLElement | null)?.focus();
          }}
        >
          <span
            aria-hidden="true"
            className={`absolute top-1.5 bottom-1.5 left-0 rounded-full bg-white shadow-[0_1px_3px_rgba(16,24,40,0.12)] motion-reduce:transition-none ${drag === null ? 'transition-[transform,width] duration-[260ms] ease-[cubic-bezier(0.22,0.8,0.24,1)]' : ''}`}
            style={pill ? { width: pill.width, transform: `translateX(${pill.left}px)` } : { opacity: 0 }}
          />
          {TABS.map(([id, label]) => (
            <button
              key={id}
              id={`expr-tab-${id}`}
              data-tab={id}
              type="button"
              role="tab"
              aria-selected={tab === id}
              aria-controls={`expr-pane-${id}`}
              tabIndex={tab === id ? 0 : -1}
              onClick={() => setTab(id)}
              className={`relative z-[1] w-full min-w-0 h-10 rounded-full text-center text-[14px] font-medium transition-colors duration-150 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-[#15171c] ${tab === id ? 'text-[#15171c]' : 'text-[#475061] hover:text-[#15171c]'}`}
            >
              {label}
            </button>
          ))}
        </div>
      </div>
      <div
        ref={viewport}
        // Every scroller inside (the emoji list, the sticker grid, the GIF wall) says pan-y too: a
        // browser takes the gesture away (pointercancel) when the element touched allows a sideways pan.
        className="relative flex-1 min-h-0 overflow-hidden [&_*]:[touch-action:pan-y]"
        // pan-y: vertical scrolling stays the browser's; the sideways gesture is ours, and never
        // reaches the page (Chrome reads a sideways overscroll as "go back").
        style={{ touchAction: 'pan-y', overscrollBehaviorX: 'none' }}
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={onPointerEnd}
        onPointerCancel={onPointerEnd}
        onClickCapture={(e) => { if (suppressClick.current) { e.preventDefault(); e.stopPropagation(); } }}
        // Focus moving into a pane must never scroll the sliding track sideways.
        onScroll={(e) => { if (e.currentTarget.scrollLeft) e.currentTarget.scrollLeft = 0; }}
      >
        <div
          className={`absolute inset-0 flex will-change-transform motion-reduce:transition-none ${drag === null ? 'transition-transform duration-[320ms] ease-[cubic-bezier(0.22,0.8,0.24,1)]' : ''}`}
          style={{ transform: `translate3d(calc(${-index * 100}% + ${drag ?? 0}px), 0, 0)` }}
        >
          {TABS.map(([id]) => {
            const active = id === tab;
            return (
              <div
                key={id}
                id={`expr-pane-${id}`}
                role="tabpanel"
                aria-labelledby={`expr-tab-${id}`}
                aria-hidden={!active}
                inert={!active || undefined}
                className="relative w-full h-full shrink-0 flex flex-col min-h-0"
              >
                {mounted.has(id) && id === 'emoji' && <EmojiTab onEmoji={onEmoji} />}
                {mounted.has(id) && id === 'sticker' && <StickerTab onSend={(c) => { onSend(c); onClose(); }} />}
                {mounted.has(id) && id === 'gif' && <GifTab onSend={(c) => { onSend(c); onClose(); }} />}
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}

const TABS = [['emoji', 'Emojis'], ['sticker', 'Stickers'], ['gif', 'GIF']] as const;

function EmojiTab({ onEmoji }: { onEmoji: (e: string) => void }) {
  // Only emojis this device can draw: newer ones showed as empty boxes (lib/chat/emojiSupport).
  const emojiVersion = useMemo(() => supportedEmojiVersion(), []);
  return (
    <div className="ledger-emoji flex-1 min-h-0 px-2.5 pb-2.5">
      <EmojiPicker
        onEmojiClick={(d: EmojiClickData) => onEmoji(d.emoji)}
        emojiStyle={'native' as unknown as EmojiStyle}
        theme={'light' as unknown as Theme}
        width="100%"
        height="100%"
        lazyLoadEmojis
        emojiVersion={emojiVersion}
        // No keyboard popping up over the panel on a phone the moment it opens.
        autoFocusSearch={false}
        searchPlaceholder="Search emojis"
        previewConfig={{ showPreview: false }}
        skinTonesDisabled={false}
        style={{
          border: 'none',
          borderRadius: 0,
          ['--epr-bg-color' as string]: '#ffffff',
          ['--epr-category-label-bg-color' as string]: 'rgba(255,255,255,0.96)',
          ['--epr-category-label-text-color' as string]: '#475061',
          ['--epr-emoji-size' as string]: '30px',
          ['--epr-emoji-padding' as string]: '8px',
          ['--epr-category-padding' as string]: '0 6px',
          ['--epr-horizontal-padding' as string]: '8px',
          ['--epr-search-input-bg-color' as string]: '#f2f4f7',
          ['--epr-search-input-bg-color-active' as string]: '#ffffff',
          ['--epr-search-input-border-radius' as string]: '999px',
          ['--epr-search-input-height' as string]: '40px',
          ['--epr-hover-bg-color' as string]: '#f2f4f7',
          ['--epr-focus-bg-color' as string]: '#eceef2',
          ['--epr-highlight-color' as string]: '#15171c',
          ['--epr-category-icon-active-color' as string]: '#15171c',
          ['--epr-text-color' as string]: '#15171c',
          ['--epr-picker-border-color' as string]: 'transparent',
        } as React.CSSProperties}
      />
    </div>
  );
}

const LAST_PACK_KEY = 'ledger_sticker_pack';

function StickerTab({ onSend }: { onSend: (c: string) => void }) {
  const [packId, setPackId] = useState<string>(() => {
    try {
      const v = localStorage.getItem(LAST_PACK_KEY);
      if (v && STICKER_PACKS.some(p => p.id === v)) return v;
    } catch { /* ignore */ }
    return STICKER_PACKS[0].id;
  });
  const pack = STICKER_PACKS.find(p => p.id === packId) ?? STICKER_PACKS[0];
  const choose = (id: string) => {
    setPackId(id);
    try { localStorage.setItem(LAST_PACK_KEY, id); } catch { /* ignore */ }
  };
  return (
    <div className="flex-1 min-h-0 flex flex-col">
      <div data-no-swipe className={`${STICKER_PACKS.length < 2 ? 'hidden' : 'flex'} gap-2.5 px-3.5 pb-3 shrink-0 overflow-x-auto overscroll-x-contain [scrollbar-width:none] [&::-webkit-scrollbar]:hidden`} style={{ touchAction: 'pan-x' }} role="tablist" aria-label="Sticker packs">
        {STICKER_PACKS.map(p => {
          const on = p.id === pack.id;
          return (
            <button
              key={p.id}
              type="button"
              role="tab"
              aria-selected={on}
              title={p.name}
              onClick={() => choose(p.id)}
              // The chosen pack is scrolled into its own row only (scrollIntoView would also move the
              // sliding panes around it).
              ref={on ? (el) => {
                const row = el?.parentElement;
                if (!el || !row) return;
                const l = el.offsetLeft - 14, r = el.offsetLeft + el.offsetWidth + 14;
                if (l < row.scrollLeft) row.scrollLeft = l;
                else if (r > row.scrollLeft + row.clientWidth) row.scrollLeft = r - row.clientWidth;
              } : undefined}
              className={`shrink-0 w-11 h-11 rounded-2xl flex items-center justify-center transition-[background-color,box-shadow] duration-150 ${on ? 'bg-[#f2f4f7] shadow-[inset_0_0_0_2px_#15171c]' : 'hover:bg-[#f2f4f7]'}`}
            >
              <img src={stickerFile(p.id, p.cover)} alt={p.name} className="w-9 h-9 object-contain" draggable={false} />
            </button>
          );
        })}
      </div>
      <div key={pack.id} className="flex-1 min-h-0 overflow-y-auto overscroll-contain px-3.5 pb-3.5">
        <div className="px-1 pt-0.5 pb-3">
          <p className="text-[13.5px] font-semibold text-[#15171c] flex items-center gap-1.5">
            <span className="w-2 h-2 rounded-full" style={{ backgroundColor: pack.accent }} aria-hidden="true" />
            {pack.name}
          </p>
          <p className="text-[12px] text-[#727a88] leading-snug mt-0.5">{pack.description}</p>
        </div>
        <div className="grid grid-cols-4 gap-3">
          {pack.stickers.map((s) => (
            <button
              key={s.id}
              type="button"
              onClick={() => onSend(stickerMessage(pack.id, s.id))}
              title={s.scene ? `${s.label} · plays an effect` : s.label}
              aria-label={`Send sticker: ${s.label}`}
              className="group relative aspect-square rounded-2xl hover:bg-[#f2f4f7] active:scale-95 transition-transform flex items-center justify-center p-1.5"
            >
              <img src={stickerFile(pack.id, s.id)} alt="" className="w-full h-full object-contain transition-transform duration-200 group-hover:scale-[1.06]" draggable={false} loading="lazy" />
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}

function GifTab({ onSend }: { onSend: (c: string) => void }) {
  const [q, setQ] = useState('');
  const [items, setItems] = useState<Gif[]>([]);
  const [state, setState] = useState<'loading' | 'ready' | 'empty' | 'off' | 'error'>('loading');
  const [next, setNext] = useState(0);
  const reqId = useRef(0);

  const load = useCallback(async (query: string, offset: number) => {
    const id = ++reqId.current;
    if (offset === 0) setState('loading');
    try {
      const r = await fetch(`/api/gifs?q=${encodeURIComponent(query)}&offset=${offset}`, { credentials: 'include' });
      const j = await r.json().catch(() => ({}));
      if (id !== reqId.current) return;
      if (r.status === 503) { setState('off'); return; }
      if (!r.ok) { setState('error'); return; }
      const got: Gif[] = j.results ?? [];
      setItems((prev) => (offset === 0 ? got : [...prev, ...got]));
      setNext(j.next ?? offset + 24);
      setState(offset === 0 && got.length === 0 ? 'empty' : 'ready');
    } catch {
      if (id === reqId.current) setState('error');
    }
  }, []);

  useEffect(() => {
    const t = setTimeout(() => load(q, 0), q ? 300 : 0);
    return () => clearTimeout(t);
  }, [q, load]);

  // Two balanced columns, like a masonry wall.
  const cols = useMemo(() => {
    const c: [Gif[], Gif[]] = [[], []];
    const h = [0, 0];
    for (const g of items) {
      const i = h[0] <= h[1] ? 0 : 1;
      c[i].push(g);
      h[i] += g.height / Math.max(1, g.width);
    }
    return c;
  }, [items]);

  return (
    <>
      <div className="px-3.5 pb-3 shrink-0">
        <div className="relative">
          <Search size={16} strokeWidth={1.9} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-[#a3a9b4]" aria-hidden="true" />
          <input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Search GIPHY"
            aria-label="Search GIFs"
            className="w-full h-10 rounded-full bg-[#f2f4f7] pl-10 pr-4 text-[15px] text-[#15171c] outline-none placeholder:text-[#a3a9b4] focus:bg-white focus:ring-2 focus:ring-[#15171c]/10"
          />
        </div>
      </div>
      <div
        className="relative flex-1 min-h-0 overflow-y-auto overscroll-contain px-3.5 pb-10"
        onScroll={(e) => {
          const el = e.currentTarget;
          if ((state === 'ready' || (state === 'error' && items.length > 0)) && el.scrollTop + el.clientHeight > el.scrollHeight - 200) { setState('loading'); load(q, next); }
        }}
      >
        {state === 'off' && <p className="text-center text-[13.5px] text-[#727a88] py-10 px-6">GIFs are not switched on for this server yet.</p>}
        {state === 'error' && items.length === 0 && (
          <div className="flex flex-col items-center gap-3 py-10">
            <p className="text-center text-[13.5px] text-[#727a88]">GIFs could not be loaded.</p>
            <button type="button" onClick={() => load(q, 0)} className="h-9 px-4 rounded-full border border-[#e4e7ec] text-[13.5px] font-medium text-[#15171c] hover:bg-[#f7f8fa]">Try again</button>
          </div>
        )}
        {state === 'empty' && <p className="text-center text-[13.5px] text-[#727a88] py-10">No GIFs for “{q}”.</p>}
        {items.length > 0 && (
          <div className="grid grid-cols-2 gap-2.5 items-start">
            {cols.map((col, ci) => (
              <div key={ci} className="flex flex-col gap-2.5">
                {col.map((g) => (
                  <button
                    key={g.id}
                    type="button"
                    onClick={() => onSend(`[GIF]${g.url}`)}
                    aria-label={g.title ? `Send GIF: ${g.title}` : 'Send GIF'}
                    title={g.title || undefined}
                    className="block w-full rounded-2xl overflow-hidden bg-[#eff1f4] active:scale-[0.98] transition-transform focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#15171c]"
                    style={{ aspectRatio: `${g.width} / ${g.height}` }}
                  >
                    <img src={g.preview} alt="" loading="lazy" className="w-full h-full object-cover" draggable={false} />
                  </button>
                ))}
              </div>
            ))}
          </div>
        )}
        {state === 'loading' && <Spinner />}
      </div>
      <div className="pointer-events-none absolute bottom-3 left-1/2 -translate-x-1/2 px-3 h-6 rounded-full bg-[#15171c]/85 text-white text-[10.5px] font-semibold tracking-[0.06em] flex items-center">
        POWERED BY GIPHY
      </div>
    </>
  );
}
