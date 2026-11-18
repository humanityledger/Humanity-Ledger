"use client";

/**
 * The Appearance studio: colour theme, wallpaper and bubble style, with a live preview drawn by
 * the same classes, variables and wallpaper styles the conversation uses
 * (lib/chat/themes.ts, lib/chat/wallpapers.ts, lib/chat/bubbleStyles.ts,
 * app/ledger-chat-settings.css), so what you pick here is exactly what the chat shows.
 *
 * Opened from Settings → Chat appearance (all chats) and from a conversation (where the wallpaper
 * can be set for that chat only). A centred dialog on desktop, a bottom sheet on phones. Every
 * choice applies at once.
 */

import React, { useCallback, useEffect, useId, useMemo, useRef, useState } from "react";
import { motion, AnimatePresence, MotionConfig } from "framer-motion";
import { Check, CheckCheck, X } from "lucide-react";
import { CHAT_THEMES, CHAT_THEME_GROUPS, chatThemeVars, findChatTheme, type ChatTheme } from "@/lib/chat/themes";
import { BUBBLE_STYLES, bubbleClasses } from "@/lib/chat/bubbleStyles";
import { WALLPAPERS, WALLPAPER_GROUPS, canvasCss, resolveWallpaper, type Wallpaper } from "@/lib/chat/wallpapers";

export type AppearanceTab = "theme" | "wallpaper" | "bubbles";

export interface ThemePickerSheetProps {
  open: boolean;
  initialTab?: AppearanceTab;
  currentThemeId: string;
  currentBubbleStyle: string;
  /** Stored wallpaper (id, or CSS from an older build). Absent: the wallpaper tab is hidden. */
  currentWallpaper?: string | null;
  onSelectTheme: (theme: ChatTheme) => void;
  onSelectBubbleStyle: (styleId: string) => void;
  onSelectWallpaper?: (wallpaper: Wallpaper) => void;
  /** Says where a wallpaper applies, e.g. "All chats" or "Chat with Ana". */
  wallpaperScope?: string;
  onClose: () => void;
}

/** The variables a theme sets, as an inline style. */
export function chatThemeStyle(theme: ChatTheme): React.CSSProperties {
  return chatThemeVars(theme) as unknown as React.CSSProperties;
}

/** The canvas style for a theme and a wallpaper: the wallpaper wins unless it is "Theme". */
export function canvasStyle(theme: ChatTheme, wallpaper: Wallpaper | null): React.CSSProperties {
  return canvasCss(wallpaper, theme.canvas);
}

export function canvasTone(theme: ChatTheme, wallpaper: Wallpaper | null): "light" | "dark" {
  return wallpaper && wallpaper.id !== "default" ? wallpaper.tone : theme.dark ? "dark" : "light";
}

/** Arrow keys move the selection inside a radio group, as the ARIA pattern expects. */
function useRadioKeys<T extends { id: string }>(items: readonly T[], current: string, select: (item: T) => void, columns: number) {
  return useCallback((e: React.KeyboardEvent<HTMLDivElement>) => {
    const i = Math.max(0, items.findIndex(x => x.id === current));
    const step: Record<string, number> = { ArrowRight: 1, ArrowLeft: -1, ArrowDown: columns, ArrowUp: -columns };
    let next: number | null = null;
    if (e.key in step) next = (i + step[e.key] + items.length) % items.length;
    else if (e.key === "Home") next = 0;
    else if (e.key === "End") next = items.length - 1;
    if (next === null) return;
    e.preventDefault();
    select(items[next]);
    const el = e.currentTarget.querySelectorAll<HTMLElement>('[role="radio"]')[next];
    el?.focus();
    el?.scrollIntoView({ block: "nearest" });
  }, [items, current, select, columns]);
}

/* ── Preview ────────────────────────────────────────────────────────────── */

function Preview({ theme, bubbleStyle, wallpaper }: { theme: ChatTheme; bubbleStyle: string; wallpaper: Wallpaper | null }) {
  const sent = bubbleClasses(bubbleStyle, true);
  const recv = bubbleClasses(bubbleStyle, false);
  const pad = "px-3.5 py-2";
  const tone = canvasTone(theme, wallpaper);
  return (
    <div
      data-chat-theme={theme.id}
      data-wallpaper-tone={tone}
      style={{ ...chatThemeStyle(theme), ...canvasStyle(theme, wallpaper) }}
      className="relative h-full w-full overflow-hidden flex flex-col justify-end gap-1 px-4 py-5 md:px-6 md:py-6 transition-[background] duration-300"
      aria-hidden="true"
    >
      <div className="flex justify-center mb-3">
        <span className={`px-3 py-1 rounded-full text-[12px] font-medium ${tone === "dark" ? "bg-black/35 text-white/85 backdrop-blur-sm" : "bg-white/85 border border-[#e6e8ec] text-[#727a88] backdrop-blur-sm"}`}>Today</span>
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
          <p className="text-[14.5px] leading-[1.45]">Perfect, see you tonight 🎉</p>
        </div>
        <div className="msg-meta flex items-center gap-1.5 mt-1 px-1">
          <span className="msg-time text-[12px] tabular-nums text-[#a3a9b4]">09:43</span>
        </div>
      </div>
    </div>
  );
}

/* ── Tiles ──────────────────────────────────────────────────────────────── */

const RING_ON = "shadow-[0_0_0_2px_#15171c]";
const RING_OFF = "shadow-[0_0_0_1px_#e4e7ec] hover:shadow-[0_0_0_1px_#c2c7d0]";
const FOCUS = "focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#15171c]";

function SelectedDot() {
  return (
    <span className="absolute top-1.5 right-1.5 w-[18px] h-[18px] rounded-full bg-[#15171c] ring-2 ring-white flex items-center justify-center" aria-hidden="true">
      <Check size={10} strokeWidth={3.2} className="text-white" />
    </span>
  );
}

function ThemeTile({ theme, selected, onSelect }: { theme: ChatTheme; selected: boolean; onSelect: () => void }) {
  return (
    <button
      type="button"
      role="radio"
      aria-checked={selected}
      aria-label={theme.label}
      tabIndex={selected ? 0 : -1}
      onClick={onSelect}
      className={`group relative rounded-[14px] p-1.5 text-left bg-white transition-shadow ${selected ? RING_ON : RING_OFF} ${FOCUS}`}
    >
      <span
        className="relative block w-full aspect-[4/3] rounded-[10px] overflow-hidden"
        style={{ backgroundColor: theme.canvas, boxShadow: `inset 0 0 0 1px ${theme.dark ? "rgba(255,255,255,0.06)" : "rgba(16,24,40,0.06)"}` }}
        aria-hidden="true"
      >
        <span className="absolute left-[9%] top-[16%] h-[18%] w-[52%] rounded-full" style={{ backgroundColor: theme.received, boxShadow: `inset 0 0 0 1px ${theme.border}` }} />
        <span className="absolute left-[9%] top-[40%] h-[18%] w-[34%] rounded-full" style={{ backgroundColor: theme.received, boxShadow: `inset 0 0 0 1px ${theme.border}` }} />
        <span className="absolute right-[9%] bottom-[14%] h-[20%] w-[48%] rounded-full transition-transform duration-200 group-hover:-translate-y-0.5" style={{ backgroundColor: theme.accent }} />
        {selected && <SelectedDot />}
      </span>
      <span className="block mt-1.5 px-0.5 text-[12.5px] font-medium text-[#15171c] truncate">{theme.label}</span>
    </button>
  );
}

function WallpaperTile({ wallpaper, theme, selected, onSelect }: { wallpaper: Wallpaper; theme: ChatTheme; selected: boolean; onSelect: () => void }) {
  const isTheme = wallpaper.id === "default";
  return (
    <button
      type="button"
      role="radio"
      aria-checked={selected}
      aria-label={isTheme ? `Theme background (${theme.label})` : wallpaper.label}
      tabIndex={selected ? 0 : -1}
      onClick={onSelect}
      className={`group relative rounded-[14px] p-1.5 text-left bg-white transition-shadow ${selected ? RING_ON : RING_OFF} ${FOCUS}`}
    >
      <span className="relative block w-full aspect-[3/4] rounded-[10px] overflow-hidden" style={canvasStyle(theme, isTheme ? null : wallpaper)} aria-hidden="true">
        <span className="absolute left-[10%] top-[22%] h-[9%] w-[54%] rounded-full shadow-sm" style={{ backgroundColor: theme.received }} />
        <span className="absolute right-[10%] top-[38%] h-[9%] w-[46%] rounded-full shadow-sm" style={{ backgroundColor: theme.accent }} />
        <span className="absolute left-[10%] top-[54%] h-[9%] w-[38%] rounded-full shadow-sm" style={{ backgroundColor: theme.received }} />
        {selected && <SelectedDot />}
      </span>
      <span className="block mt-1.5 px-0.5 text-[12.5px] font-medium text-[#15171c] truncate">{isTheme ? "Theme" : wallpaper.label}</span>
    </button>
  );
}

function BubbleTile({ id, label, description, theme, wallpaper, selected, onSelect }: {
  id: string; label: string; description: string; theme: ChatTheme; wallpaper: Wallpaper | null; selected: boolean; onSelect: () => void;
}) {
  return (
    <button
      type="button"
      role="radio"
      aria-checked={selected}
      tabIndex={selected ? 0 : -1}
      onClick={onSelect}
      className={`relative rounded-[14px] p-1.5 text-left bg-white transition-shadow ${selected ? RING_ON : RING_OFF} ${FOCUS}`}
    >
      <span
        data-chat-theme={theme.id}
        data-wallpaper-tone={canvasTone(theme, wallpaper)}
        className="relative flex flex-col gap-1.5 w-full rounded-[10px] overflow-hidden px-3 py-3"
        style={{ ...chatThemeStyle(theme), ...canvasStyle(theme, wallpaper) }}
        aria-hidden="true"
      >
        <span className={`${bubbleClasses(id, false)} self-start px-2.5 py-1 text-[11.5px] leading-tight`}>Hey there</span>
        <span className={`${bubbleClasses(id, true)} self-end px-2.5 py-1 text-[11.5px] leading-tight`}>Hi! 👋</span>
        {selected && <SelectedDot />}
      </span>
      <span className="block mt-1.5 px-0.5 text-[12.5px] font-semibold text-[#15171c] truncate">{label}</span>
      <span className="block px-0.5 text-[11.5px] text-[#727a88] leading-snug line-clamp-2">{description}</span>
    </button>
  );
}

function SectionTitle({ id, children, count }: { id: string; children: React.ReactNode; count?: number }) {
  return (
    <h3 id={id} className="flex items-baseline gap-2 text-[12px] font-semibold uppercase tracking-[0.08em] text-[#727a88] mb-2.5">
      {children}
      {typeof count === "number" && <span className="font-medium normal-case tracking-normal text-[#a3a9b4]">{count}</span>}
    </h3>
  );
}

/* ── Studio ─────────────────────────────────────────────────────────────── */

export function ThemePickerSheet({
  open,
  initialTab = "theme",
  currentThemeId,
  currentBubbleStyle,
  currentWallpaper,
  onSelectTheme,
  onSelectBubbleStyle,
  onSelectWallpaper,
  wallpaperScope,
  onClose,
}: ThemePickerSheetProps) {
  const theme = findChatTheme(currentThemeId);
  const style = BUBBLE_STYLES.some(s => s.id === currentBubbleStyle) ? currentBubbleStyle : "default";
  const wallpaper = resolveWallpaper(currentWallpaper ?? "default") ?? WALLPAPERS[0];
  const showWallpaper = typeof onSelectWallpaper === "function";
  const titleId = useId();
  const dialogRef = useRef<HTMLDivElement>(null);
  const returnFocusRef = useRef<HTMLElement | null>(null);
  const onCloseRef = useRef(onClose);
  onCloseRef.current = onClose;

  const [tab, setTab] = useState<AppearanceTab>(initialTab);
  useEffect(() => { if (open) setTab(initialTab === "wallpaper" && !showWallpaper ? "theme" : initialTab); }, [open, initialTab, showWallpaper]);

  const onThemeKeys = useRadioKeys(CHAT_THEMES, theme.id, onSelectTheme, 3);
  const onWallKeys = useRadioKeys(WALLPAPERS, wallpaper.id, (w) => onSelectWallpaper?.(w), 3);
  const onStyleKeys = useRadioKeys(BUBBLE_STYLES, style, (s) => onSelectBubbleStyle(s.id), 2);

  const themesByGroup = useMemo(() => CHAT_THEME_GROUPS.map(g => [g, CHAT_THEMES.filter(t => t.group === g)] as const), []);
  const wallsByGroup = useMemo(() => WALLPAPER_GROUPS.map(g => [g, WALLPAPERS.filter(w => w.group === g)] as const), []);

  // Escape closes; focus goes into the dialog and back to where it came from.
  useEffect(() => {
    if (!open) return;
    returnFocusRef.current = (document.activeElement as HTMLElement) ?? null;
    const t = window.setTimeout(() => {
      dialogRef.current?.querySelector<HTMLElement>('[role="tab"][aria-selected="true"]')?.focus();
    }, 30);
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") { e.stopPropagation(); onCloseRef.current(); }
      if (e.key === "Tab" && dialogRef.current) {
        const f = Array.from(dialogRef.current.querySelectorAll<HTMLElement>('button:not([disabled]):not([tabindex="-1"]), [role="radio"][tabindex="0"]'));
        if (f.length === 0) return;
        const first = f[0], last = f[f.length - 1];
        if (e.shiftKey && document.activeElement === first) { e.preventDefault(); last.focus(); }
        else if (!e.shiftKey && document.activeElement === last) { e.preventDefault(); first.focus(); }
      }
    };
    window.addEventListener("keydown", onKey, true);
    return () => {
      window.clearTimeout(t);
      window.removeEventListener("keydown", onKey, true);
      returnFocusRef.current?.focus?.();
    };
  }, [open]);

  const tabs: { id: AppearanceTab; label: string; count: number }[] = [
    { id: "theme", label: "Theme", count: CHAT_THEMES.length },
    ...(showWallpaper ? [{ id: "wallpaper" as const, label: "Wallpaper", count: WALLPAPERS.length - 1 }] : []),
    { id: "bubbles", label: "Bubbles", count: BUBBLE_STYLES.length },
  ];

  return (
    <MotionConfig reducedMotion="user">
      <AnimatePresence>
        {open && (
          <div className="fixed inset-0 z-[600] flex items-end md:items-center justify-center md:p-6">
            <motion.div
              className="absolute inset-0 bg-[rgba(16,24,40,0.42)] backdrop-blur-[2px]"
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
              className="relative w-full md:w-[min(1040px,100%)] h-[min(94dvh,820px)] md:h-[min(720px,calc(100dvh-48px))] bg-white rounded-t-[26px] md:rounded-[26px] shadow-[0_40px_80px_-20px_rgba(16,24,40,0.35)] overflow-hidden flex flex-col md:grid md:grid-cols-[minmax(0,1fr)_minmax(420px,480px)]"
              initial={{ y: 28, opacity: 0 }}
              animate={{ y: 0, opacity: 1 }}
              exit={{ y: 28, opacity: 0 }}
              transition={{ type: "spring", stiffness: 420, damping: 36 }}
              style={{ paddingBottom: "env(safe-area-inset-bottom, 0px)" }}
            >
              {/* Preview: top on phones, left on desktop */}
              <div className="h-[34%] min-h-[190px] md:h-auto md:min-h-0 border-b md:border-b-0 md:border-r border-[#eceef2] shrink-0">
                <Preview theme={theme} bubbleStyle={style} wallpaper={wallpaper} />
              </div>

              <div className="flex-1 min-h-0 flex flex-col">
                <div className="flex items-center justify-between gap-3 px-5 pt-4 pb-3">
                  <div className="min-w-0">
                    <h2 id={titleId} className="text-[18px] font-semibold text-[#15171c] leading-tight">Appearance</h2>
                    <p className="text-[12.5px] text-[#727a88] mt-0.5 truncate">
                      {tab === "wallpaper" && wallpaperScope ? `Wallpaper for: ${wallpaperScope}` : "Changes apply right away."}
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={onClose}
                    className={`w-9 h-9 rounded-full bg-[#f2f4f7] flex items-center justify-center text-[#475061] hover:bg-[#e4e7ec] transition-colors ${FOCUS}`}
                    aria-label="Close"
                  >
                    <X size={17} strokeWidth={2} />
                  </button>
                </div>

                <div className="px-5 pb-3">
                  {/* Layout by inline style: when the utility classes were missing the three tabs ran
                      together ("Theme 40Wallpaper 59Bubbles 14", 18 November 2026). */}
                  <div role="tablist" aria-label="Appearance" className="rounded-full bg-[#f2f4f7]" style={{ display: 'grid', gridTemplateColumns: `repeat(${tabs.length}, minmax(0, 1fr))`, gap: 6, padding: 4, borderRadius: 999 }}>
                    {tabs.map(t => (
                      <button
                        key={t.id}
                        type="button"
                        role="tab"
                        aria-selected={tab === t.id}
                        onClick={() => setTab(t.id)}
                        className={`relative rounded-full text-[13.5px] font-medium transition-colors ${FOCUS} ${tab === t.id ? "text-[#15171c]" : "text-[#5b6271] hover:text-[#15171c]"}`}
                        style={{ height: 38, minWidth: 0, borderRadius: 999, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '0 10px' }}
                      >
                        {tab === t.id && <motion.span layoutId="appearance-tab" className="absolute inset-0 rounded-full bg-white shadow-[0_1px_3px_rgba(16,24,40,0.14)]" transition={{ type: "spring", stiffness: 500, damping: 38 }} />}
                        <span className="relative" style={{ display: 'inline-flex', alignItems: 'center', gap: 6, whiteSpace: 'nowrap' }}>
                          <span>{t.label}</span>
                          <span aria-label={`${t.count} options`} style={{ fontSize: 11.5, fontWeight: 600, lineHeight: '18px', minWidth: 22, padding: '0 6px', borderRadius: 999, background: tab === t.id ? '#eef0f3' : 'rgba(255,255,255,0.7)', color: '#727a88', fontVariantNumeric: 'tabular-nums', textAlign: 'center' }}>{t.count}</span>
                        </span>
                      </button>
                    ))}
                  </div>
                </div>

                <div className="flex-1 min-h-0 overflow-y-auto px-5 pt-1 pb-6 overscroll-contain">
                  {tab === "theme" && (
                    <div role="radiogroup" aria-label="Colour theme" onKeyDown={onThemeKeys} className="flex flex-col gap-6">
                      {themesByGroup.map(([group, items]) => (
                        <section key={group} aria-labelledby={`${titleId}-t-${group}`}>
                          <SectionTitle id={`${titleId}-t-${group}`} count={items.length}>{group}</SectionTitle>
                          <div className="grid grid-cols-3 gap-2.5">
                            {items.map(t => <ThemeTile key={t.id} theme={t} selected={t.id === theme.id} onSelect={() => onSelectTheme(t)} />)}
                          </div>
                        </section>
                      ))}
                    </div>
                  )}

                  {tab === "wallpaper" && showWallpaper && (
                    <div role="radiogroup" aria-label="Wallpaper" onKeyDown={onWallKeys} className="flex flex-col gap-6">
                      {wallsByGroup.map(([group, items]) => (
                        <section key={group} aria-labelledby={`${titleId}-w-${group}`}>
                          <SectionTitle id={`${titleId}-w-${group}`} count={items.length}>{group}</SectionTitle>
                          <div className="grid grid-cols-3 gap-2.5">
                            {items.map(w => <WallpaperTile key={w.id} wallpaper={w} theme={theme} selected={w.id === wallpaper.id} onSelect={() => onSelectWallpaper?.(w)} />)}
                          </div>
                        </section>
                      ))}
                      <p className="text-[12px] text-[#727a88] leading-relaxed">
                        Drawn on your device; nothing is downloaded. On dark wallpapers the time under each message turns light so it stays readable.
                      </p>
                    </div>
                  )}

                  {tab === "bubbles" && (
                    <div role="radiogroup" aria-label="Bubble style" onKeyDown={onStyleKeys} className="grid grid-cols-2 gap-2.5">
                      {BUBBLE_STYLES.map(b => (
                        <BubbleTile key={b.id} id={b.id} label={b.label} description={b.description} theme={theme} wallpaper={wallpaper} selected={b.id === style} onSelect={() => onSelectBubbleStyle(b.id)} />
                      ))}
                    </div>
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
