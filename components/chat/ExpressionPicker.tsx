'use client';

/**
 * The composer's expression panel: Emojis, Stickers and GIFs, in one rounded sheet.
 *
 * - Emojis: emoji-picker-react with the system's own emoji font (on iPhone and Mac that is
 *   Apple's set), recent emojis first; picking one adds it to the message being written.
 * - Stickers: Ledger Chat's own pack (lib/chat/stickers.ts); one tap sends it.
 * - GIFs: GIPHY through /api/gifs (trending, then search as you type), two-column masonry,
 *   with the "Powered by GIPHY" attribution GIPHY requires; one tap sends it.
 */

import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import dynamic from 'next/dynamic';
import { Loader2, Search } from 'lucide-react';
// Types only: importing the enums would pull the whole picker (and its emoji data) into the chat
// bundle; it is loaded with next/dynamic when the picker opens.
import type { EmojiClickData, EmojiStyle, Theme } from 'emoji-picker-react';
import { LEDGER_STICKERS, stickerMessage } from '@/lib/chat/stickers';

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
  const [tab, setTab] = useState<ExpressionTab>(initialTab);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    const onDown = (e: PointerEvent) => {
      const t = e.target as HTMLElement;
      if (ref.current && !ref.current.contains(t) && !t.closest('[data-expression-toggle]')) onClose();
    };
    window.addEventListener('keydown', onKey);
    window.addEventListener('pointerdown', onDown);
    return () => { window.removeEventListener('keydown', onKey); window.removeEventListener('pointerdown', onDown); };
  }, [onClose]);

  return (
    <div
      ref={ref}
      role="dialog"
      aria-label="Emojis, stickers and GIFs"
      className="absolute bottom-[68px] left-2 z-50 w-[min(372px,calc(100vw-16px))] h-[min(470px,62vh)] flex flex-col bg-white rounded-[28px] border border-[#e4e7ec] shadow-[0_28px_60px_-18px_rgba(16,24,40,0.30)] overflow-hidden animate-in fade-in slide-in-from-bottom-2 duration-150"
    >
      <div className="p-2.5 pb-1.5">
        <div className="grid grid-cols-3 p-1 rounded-full bg-[#f2f4f7]" role="tablist">
          {([['emoji', 'Emojis'], ['sticker', 'Stickers'], ['gif', 'GIF']] as const).map(([id, label]) => (
            <button
              key={id}
              type="button"
              role="tab"
              aria-selected={tab === id}
              onClick={() => setTab(id)}
              className={`h-9 rounded-full text-[14px] font-medium transition-colors ${tab === id ? 'bg-white text-[#15171c] shadow-[0_1px_3px_rgba(16,24,40,0.12)]' : 'text-[#475061] hover:text-[#15171c]'}`}
            >
              {label}
            </button>
          ))}
        </div>
      </div>
      <div className="flex-1 min-h-0 flex flex-col">
        {tab === 'emoji' && <EmojiTab onEmoji={onEmoji} />}
        {tab === 'sticker' && <StickerTab onSend={(c) => { onSend(c); onClose(); }} />}
        {tab === 'gif' && <GifTab onSend={(c) => { onSend(c); onClose(); }} />}
      </div>
    </div>
  );
}

function EmojiTab({ onEmoji }: { onEmoji: (e: string) => void }) {
  return (
    <div className="ledger-emoji flex-1 min-h-0 px-1.5 pb-1.5">
      <EmojiPicker
        onEmojiClick={(d: EmojiClickData) => onEmoji(d.emoji)}
        emojiStyle={'native' as unknown as EmojiStyle}
        theme={'light' as unknown as Theme}
        width="100%"
        height="100%"
        lazyLoadEmojis
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
          ['--epr-emoji-padding' as string]: '6px',
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

function StickerTab({ onSend }: { onSend: (c: string) => void }) {
  return (
    <div className="flex-1 min-h-0 overflow-y-auto px-3 pb-3">
      <p className="px-1 pt-1 pb-2 text-[12.5px] font-medium text-[#727a88]">Ledger</p>
      <div className="grid grid-cols-4 gap-1.5">
        {LEDGER_STICKERS.map((s) => (
          <button
            key={s.id}
            type="button"
            onClick={() => onSend(stickerMessage('ledger', s.id))}
            title={s.label}
            aria-label={`Send sticker: ${s.label}`}
            className="aspect-square rounded-2xl hover:bg-[#f2f4f7] active:scale-95 transition-transform flex items-center justify-center p-1"
          >
            <img src={`/stickers/ledger/${s.id}.svg`} alt="" className="w-full h-full object-contain" draggable={false} />
          </button>
        ))}
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
      <div className="px-3 pb-2">
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
        className="relative flex-1 min-h-0 overflow-y-auto px-3 pb-10"
        onScroll={(e) => {
          const el = e.currentTarget;
          if (state === 'ready' && el.scrollTop + el.clientHeight > el.scrollHeight - 200) { setState('loading'); load(q, next); }
        }}
      >
        {state === 'off' && <p className="text-center text-[13.5px] text-[#727a88] py-10 px-6">GIFs are not switched on for this server yet.</p>}
        {state === 'error' && <p className="text-center text-[13.5px] text-[#727a88] py-10">GIFs could not be loaded. Try again.</p>}
        {state === 'empty' && <p className="text-center text-[13.5px] text-[#727a88] py-10">No GIFs for “{q}”.</p>}
        {items.length > 0 && (
          <div className="grid grid-cols-2 gap-1.5 items-start">
            {cols.map((col, ci) => (
              <div key={ci} className="flex flex-col gap-1.5">
                {col.map((g) => (
                  <button
                    key={g.id}
                    type="button"
                    onClick={() => onSend(`[GIF]${g.url}`)}
                    aria-label={g.title ? `Send GIF: ${g.title}` : 'Send GIF'}
                    className="block w-full rounded-2xl overflow-hidden bg-[#eff1f4] active:scale-[0.98] transition-transform"
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
