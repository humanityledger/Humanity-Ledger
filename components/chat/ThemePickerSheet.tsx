"use client";

/**
 * Appearance: the conversation's colour theme and bubble style, with a live
 * preview drawn by the same classes and theme rules the conversation uses
 * (lib/chat/bubbleStyles.ts, lib/chat/themes.ts, app/ledger-chat-settings.css),
 * so what you pick here is what the chat shows.
 *
 * A centred dialog on desktop, a bottom sheet on phones. Changes apply at
 * once and are saved as the `chat_theme` and `bubble_style` settings.
 */

import React, { useCallback, useEffect, useId, useRef } from "react";
import { motion, AnimatePresence, MotionConfig } from "framer-motion";
import { Check, CheckCheck, Image as ImageIcon, X } from "lucide-react";
import { CHAT_THEMES, chatThemeVars, findChatTheme, type ChatTheme } from "@/lib/chat/themes";
import { BUBBLE_STYLES, bubbleClasses } from "@/lib/chat/bubbleStyles";

export interface ThemePickerSheetProps {
  open: boolean;
  currentThemeId: string;
  currentBubbleStyle: string;
  onSelectTheme: (theme: ChatTheme) => void;
  onSelectBubbleStyle: (styleId: string) => void;
  onClose: () => void;
  /** Shown only while a chat is open: wallpaper is set per chat. */
  onOpenWallpaper?: () => void;
}

/** The variables a theme sets, as an inline style. */
export function chatThemeStyle(theme: ChatTheme): React.CSSProperties {
  return chatThemeVars(theme) as unknown as React.CSSProperties;
}

/** Arrow keys move the selection inside a radio group, as the ARIA pattern expects. */
function useRadioKeys<T extends { id: string }>(items: readonly T[], current: string, select: (item: T) => void, columns: number) {
  return useCallback((e: React.KeyboardEvent<HTMLDivElement>) => {
    const i = Math.max(0, items.findIndex(x => x.id === current));
    const step: Record<string, number> = { ArrowRight: 1, ArrowLeft: -1, ArrowDown: columns, ArrowUp: -columns };
    let next: number | null = null;
    if (e.key in step) next = (i + step[e.key] + items.length) % items.length;
    else if (e.key === 'Home') next = 0;
    else if (e.key === 'End') next = items.length - 1;
    if (next === null) return;
    e.preventDefault();
    select(items[next]);
    const el = e.currentTarget.querySelectorAll<HTMLElement>('[role="radio"]')[next];
    el?.focus();
  }, [items, current, select, columns]);
}

function Preview({ theme, bubbleStyle }: { theme: ChatTheme; bubbleStyle: string }) {
  const sent = bubbleClasses(bubbleStyle, true);
  const recv = bubbleClasses(bubbleStyle, false);
  const pad = 'px-3.5 py-2';
  return (
    <div
      data-chat-theme={theme.id}
      style={{ ...chatThemeStyle(theme), backgroundColor: theme.canvas }}
      className="relative h-full w-full overflow-hidden flex flex-col justify-end gap-1 px-4 py-5 md:px-6 md:py-6"
      aria-hidden="true"
    >
      <div className="flex justify-center mb-3">
        <span className="px-3 py-1 bg-white border border-[#e6e8ec] rounded-full text-[12px] font-medium text-[#727a88]">Today</span>
      </div>
      <div className="flex flex-col items-start max-w-[78%]">
        <div className={`${recv} ${pad}`}>
          <p className="text-[14.5px] leading-[1.45]">Did the transfer land?</p>
        </div>
        <div className="msg-meta flex items-center gap-1.5 mt-1 px-1">
          <span className="msg-time text-[12px] tabular-nums text-[#a3a9b4]">09:41</span>
        </div>
      </div>
      <div className="flex flex-col items-end self-end max-w-[78%] mt-1">
        <div className={`${sent} ${pad}`}>
          <p className="text-[14.5px] leading-[1.45]">Yes, a minute ago. Thank you!</p>
        </div>
        <div className="msg-meta flex items-center gap-1.5 mt-1 px-1">
          <span className="msg-time text-[12px] tabular-nums text-[#a3a9b4]">09:42</span>
          <span className="msg-read text-[#15171c]"><CheckCheck size={14} strokeWidth={2} /></span>
        </div>
      </div>
      <div className="hidden md:flex flex-col items-start max-w-[78%] mt-1">
        <div className={`${recv} ${pad}`}>
          <button type="button" tabIndex={-1} className="flex items-stretch gap-2 mb-1.5 -mx-1 px-2 py-1.5 rounded-xl text-left bg-[#f2f4f7]">
            <span className="w-[3px] rounded-full shrink-0 bg-[#15171c]" />
            <span className="flex flex-col min-w-0">
              <span className="text-[12.5px] font-medium text-[#15171c]">Reply</span>
              <span className="text-[13px] truncate text-[#727a88]">Yes, a minute ago. Thank you!</span>
            </span>
          </button>
          <p className="text-[14.5px] leading-[1.45]">Perfect, see you later.</p>
        </div>
        <div className="msg-meta flex items-center gap-1.5 mt-1 px-1">
          <span className="msg-time text-[12px] tabular-nums text-[#a3a9b4]">09:43</span>
        </div>
      </div>
    </div>
  );
}

function ThemeSwatch({ theme }: { theme: ChatTheme }) {
  return (
    <span className="block w-full h-12 rounded-lg overflow-hidden relative" style={{ backgroundColor: theme.canvas, boxShadow: `inset 0 0 0 1px ${theme.dark ? 'rgba(255,255,255,0.08)' : 'rgba(16,24,40,0.08)'}` }} aria-hidden="true">
      <span className="absolute left-2 top-2 h-3.5 w-[46%] rounded-full" style={{ backgroundColor: theme.received, boxShadow: `inset 0 0 0 1px ${theme.border}` }} />
      <span className="absolute right-2 bottom-2 h-3.5 w-[40%] rounded-full" style={{ backgroundColor: theme.accent }} />
    </span>
  );
}

export function ThemePickerSheet({
  open,
  currentThemeId,
  currentBubbleStyle,
  onSelectTheme,
  onSelectBubbleStyle,
  onClose,
  onOpenWallpaper,
}: ThemePickerSheetProps) {
  const theme = findChatTheme(currentThemeId);
  const style = BUBBLE_STYLES.some(s => s.id === currentBubbleStyle) ? currentBubbleStyle : 'default';
  const titleId = useId();
  const dialogRef = useRef<HTMLDivElement>(null);
  const returnFocusRef = useRef<HTMLElement | null>(null);
  // Held in a ref so a new onClose each render does not re-run the focus effect.
  const onCloseRef = useRef(onClose);
  onCloseRef.current = onClose;

  const onThemeKeys = useRadioKeys(CHAT_THEMES, theme.id, onSelectTheme, 2);
  const onStyleKeys = useRadioKeys(BUBBLE_STYLES, style, (s) => onSelectBubbleStyle(s.id), 2);

  // Escape closes; focus goes into the dialog and back to where it came from.
  useEffect(() => {
    if (!open) return;
    returnFocusRef.current = (document.activeElement as HTMLElement) ?? null;
    const t = window.setTimeout(() => {
      dialogRef.current?.querySelector<HTMLElement>('[role="radio"][aria-checked="true"]')?.focus();
    }, 30);
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') { e.stopPropagation(); onCloseRef.current(); }
      if (e.key === 'Tab' && dialogRef.current) {
        const f = Array.from(dialogRef.current.querySelectorAll<HTMLElement>('button:not([disabled]):not([tabindex="-1"]), [role="radio"][tabindex="0"]'));
        if (f.length === 0) return;
        const first = f[0], last = f[f.length - 1];
        if (e.shiftKey && document.activeElement === first) { e.preventDefault(); last.focus(); }
        else if (!e.shiftKey && document.activeElement === last) { e.preventDefault(); first.focus(); }
      }
    };
    window.addEventListener('keydown', onKey, true);
    return () => {
      window.clearTimeout(t);
      window.removeEventListener('keydown', onKey, true);
      returnFocusRef.current?.focus?.();
    };
  }, [open]);

  return (
    <MotionConfig reducedMotion="user">
      <AnimatePresence>
        {open && (
          <div className="fixed inset-0 z-[70] flex items-end md:items-center justify-center md:p-6">
            <motion.div
              className="absolute inset-0 bg-[rgba(16,24,40,0.36)]"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.16 }}
              onClick={onClose}
              aria-hidden="true"
            />
            <motion.div
              ref={dialogRef}
              role="dialog"
              aria-modal="true"
              aria-labelledby={titleId}
              className="relative w-full md:w-[min(880px,100%)] h-[min(92dvh,760px)] md:h-[min(600px,calc(100dvh-48px))] bg-white rounded-t-[24px] md:rounded-[24px] shadow-[0_32px_64px_-16px_rgba(16,24,40,0.28)] overflow-hidden flex flex-col md:grid md:grid-cols-[minmax(0,1fr)_360px]"
              initial={{ y: 24, opacity: 0 }}
              animate={{ y: 0, opacity: 1 }}
              exit={{ y: 24, opacity: 0 }}
              transition={{ type: 'spring', stiffness: 420, damping: 36 }}
              style={{ paddingBottom: 'env(safe-area-inset-bottom, 0px)' }}
            >
              {/* Preview: top on phones, left on desktop */}
              <div className="h-[38%] min-h-[200px] md:h-auto md:min-h-0 border-b md:border-b-0 md:border-r border-[#eceef2] shrink-0">
                <Preview theme={theme} bubbleStyle={style} />
              </div>

              {/* Controls */}
              <div className="flex-1 min-h-0 flex flex-col">
                <div className="flex items-center justify-between gap-3 px-5 pt-4 pb-3 border-b border-[#f2f4f7]">
                  <div className="min-w-0">
                    <h2 id={titleId} className="text-[17px] font-semibold text-[#15171c] leading-tight">Appearance</h2>
                    <p className="text-[12.5px] text-[#727a88] mt-0.5">Changes apply right away.</p>
                  </div>
                  <button
                    type="button"
                    onClick={onClose}
                    className="w-9 h-9 rounded-full bg-[#f2f4f7] flex items-center justify-center text-[#475061] hover:bg-[#e4e7ec] transition-colors focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#15171c]"
                    aria-label="Close"
                  >
                    <X size={17} strokeWidth={2} />
                  </button>
                </div>

                <div className="flex-1 min-h-0 overflow-y-auto px-5 py-4 flex flex-col gap-6">
                  <section aria-labelledby={`${titleId}-theme`}>
                    <h3 id={`${titleId}-theme`} className="text-[12px] font-medium uppercase tracking-[0.08em] text-[#727a88] mb-2.5">Theme</h3>
                    <div role="radiogroup" aria-labelledby={`${titleId}-theme`} className="grid grid-cols-2 gap-2.5" onKeyDown={onThemeKeys}>
                      {CHAT_THEMES.map(t => {
                        const selected = t.id === theme.id;
                        return (
                          <button
                            key={t.id}
                            type="button"
                            role="radio"
                            aria-checked={selected}
                            tabIndex={selected ? 0 : -1}
                            onClick={() => onSelectTheme(t)}
                            className={`group relative rounded-xl p-2 text-left transition-[box-shadow,background-color] duration-150 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#15171c] ${selected ? 'bg-[#f7f8fa] shadow-[inset_0_0_0_2px_#15171c]' : 'bg-white shadow-[inset_0_0_0_1px_#e4e7ec] hover:shadow-[inset_0_0_0_1px_#c9ced6]'}`}
                          >
                            <ThemeSwatch theme={t} />
                            <span className="mt-2 flex items-center justify-between gap-2 px-0.5">
                              <span className="text-[13px] font-medium text-[#15171c] truncate">{t.label}</span>
                              {selected && (
                                <span className="w-4 h-4 rounded-full bg-[#15171c] flex items-center justify-center shrink-0" aria-hidden="true">
                                  <Check size={10} strokeWidth={3} className="text-white" />
                                </span>
                              )}
                            </span>
                          </button>
                        );
                      })}
                    </div>
                  </section>

                  <section aria-labelledby={`${titleId}-bubbles`}>
                    <h3 id={`${titleId}-bubbles`} className="text-[12px] font-medium uppercase tracking-[0.08em] text-[#727a88] mb-2.5">Bubbles</h3>
                    <div role="radiogroup" aria-labelledby={`${titleId}-bubbles`} className="grid grid-cols-2 gap-2" onKeyDown={onStyleKeys}>
                      {BUBBLE_STYLES.map(b => {
                        const selected = b.id === style;
                        return (
                          <button
                            key={b.id}
                            type="button"
                            role="radio"
                            aria-checked={selected}
                            tabIndex={selected ? 0 : -1}
                            onClick={() => onSelectBubbleStyle(b.id)}
                            className={`h-10 px-3 rounded-xl text-[13.5px] font-medium flex items-center justify-between gap-2 transition-colors focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#15171c] ${selected ? 'bg-[#15171c] text-white' : 'bg-[#f2f4f7] text-[#15171c] hover:bg-[#e9ecf0]'}`}
                          >
                            <span className="truncate">{b.label}</span>
                            {selected && <Check size={14} strokeWidth={2.5} aria-hidden="true" />}
                          </button>
                        );
                      })}
                    </div>
                  </section>

                  {onOpenWallpaper && (
                    <section>
                      <button
                        type="button"
                        onClick={() => { onClose(); onOpenWallpaper(); }}
                        className="w-full h-11 px-3.5 rounded-xl bg-white shadow-[inset_0_0_0_1px_#e4e7ec] hover:shadow-[inset_0_0_0_1px_#c9ced6] flex items-center gap-3 text-left transition-shadow focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#15171c]"
                      >
                        <ImageIcon size={16} strokeWidth={1.75} className="text-[#475061]" aria-hidden="true" />
                        <span className="flex-1 text-[14px] text-[#15171c]">Wallpaper for this chat</span>
                      </button>
                      <p className="mt-1.5 text-[12px] text-[#727a88] px-0.5">A chat wallpaper replaces the theme background in that chat.</p>
                    </section>
                  )}
                </div>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </MotionConfig>
  );
}
