'use client';

/**
 * Private Notes — the pinned chat with yourself (lib/chat/private-notes.ts).
 * Notes, checklist items, photos, voice and files, encrypted on this device only. No network.
 */

import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { ArrowLeft, Check, Copy, Download, ListChecks, MoreHorizontal, Paperclip, Pin, Search, Square, Star, Trash2, X } from 'lucide-react';
import { toast } from 'sonner';
import { useT } from '@/lib/i18n/client';
import {
  PRIVATE_NOTES_NAME, PrivateNotesStore, formatExport, indexedDbNotesBackend, linkify, memoryNotesBackend, searchNotes, sortNotes,
  type ExportFormat, type Note,
} from '@/lib/chat/private-notes';
import { PrivateNotesAvatar, VerifiedBlueCheckBadge } from './PrivateNotesIcons';
import { CameraIcon, MicIcon, PlusIcon, SendArrowIcon, StickerIcon } from './ComposerIcons';
import { BodyPortal } from './ui/BodyPortal';

const stores = new Map<string, PrivateNotesStore>();
function storeFor(wallet: string): PrivateNotesStore {
  const k = wallet.toLowerCase();
  let s = stores.get(k);
  if (!s) {
    const ok = typeof indexedDB !== 'undefined' && typeof crypto !== 'undefined' && !!crypto.subtle;
    s = new PrivateNotesStore(ok ? indexedDbNotesBackend(k) : memoryNotesBackend());
    stores.set(k, s);
  }
  return s;
}

const fmtTime = (t: number) => new Date(t).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
const fmtSize = (n?: number) => (!n ? '' : n < 1024 ? `${n} B` : n < 1048576 ? `${(n / 1024).toFixed(0)} KB` : `${(n / 1048576).toFixed(1)} MB`);

/** Object URLs for attachment notes, revoked when the note leaves or the view closes. */
function useBlobUrls(notes: Note[]): Map<string, string> {
  const urls = useRef(new Map<string, string>());
  const [, bump] = useState(0);
  useEffect(() => {
    const live = new Set(notes.filter((n) => n.blob).map((n) => n.id));
    let changed = false;
    for (const [id, u] of urls.current) if (!live.has(id)) { URL.revokeObjectURL(u); urls.current.delete(id); changed = true; }
    for (const n of notes) if (n.blob && !urls.current.has(n.id)) { urls.current.set(n.id, URL.createObjectURL(n.blob)); changed = true; }
    if (changed) bump((x) => x + 1);
  }, [notes]);
  useEffect(() => () => { for (const u of urls.current.values()) URL.revokeObjectURL(u); urls.current.clear(); }, []);
  return urls.current;
}

export interface PrivateNotesViewProps {
  wallet: string;
  onClose: () => void;
  /** Inactivity lock / app lock active: content is hidden. */
  locked?: boolean;
  /** 'screen' covers the whole screen (phones), 'pane' fills the conversation pane (wide screens). */
  variant?: 'screen' | 'pane';
}

export function PrivateNotesView({ wallet, onClose, locked = false, variant = 'screen' }: PrivateNotesViewProps) {
  const tr = useT();
  const store = useMemo(() => storeFor(wallet), [wallet]);
  const [notes, setNotes] = useState<Note[]>([]);
  const [loaded, setLoaded] = useState(false);
  const [draft, setDraft] = useState('');
  const [checkMode, setCheckMode] = useState(false);
  const [query, setQuery] = useState('');
  const [searching, setSearching] = useState(false);
  const [menu, setMenu] = useState(false);
  const [drawer, setDrawer] = useState(false);
  const [confirmClear, setConfirmClear] = useState(false);
  const [hiddenTab, setHiddenTab] = useState(false);
  const [rec, setRec] = useState<{ r: MediaRecorder; started: number } | null>(null);
  const [recSecs, setRecSecs] = useState(0);
  const listRef = useRef<HTMLDivElement>(null);
  const field = useRef<HTMLTextAreaElement>(null);
  const filePick = useRef<HTMLInputElement>(null);
  const camPick = useRef<HTMLInputElement>(null);
  const urls = useBlobUrls(notes);

  useEffect(() => {
    let live = true;
    store.list().then((n) => { if (live) { setNotes(n); setLoaded(true); } }).catch(() => setLoaded(true));
    return () => { live = false; };
  }, [store]);

  // Hidden from the app switcher's snapshot and while the tab is in the background.
  useEffect(() => {
    const on = () => setHiddenTab(document.visibilityState !== 'visible');
    document.addEventListener('visibilitychange', on);
    return () => document.removeEventListener('visibilitychange', on);
  }, []);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape' && !menu && !drawer) onClose(); };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose, menu, drawer]);

  const scrollEnd = useCallback(() => {
    requestAnimationFrame(() => { const el = listRef.current; if (el) el.scrollTop = el.scrollHeight; });
  }, []);
  useEffect(() => { if (loaded) scrollEnd(); }, [loaded, scrollEnd]);

  const add = useCallback(async (input: Parameters<PrivateNotesStore['add']>[0]) => {
    try {
      const n = await store.add(input);
      setNotes((prev) => sortNotes([...prev, n]));
      scrollEnd();
    } catch {
      toast.error(tr('The note was not saved. Try again.'));
    }
  }, [store, scrollEnd, tr]);

  const send = useCallback(() => {
    const text = draft.trim();
    if (!text) return;
    setDraft('');
    void add({ kind: checkMode ? 'check' : 'text', text });
    field.current?.focus();
  }, [draft, checkMode, add]);

  const patch = useCallback(async (n: Note, p: Partial<Pick<Note, 'pinned' | 'starred' | 'done'>>) => {
    const next = await store.update(n, p).catch(() => null);
    if (next) setNotes((prev) => sortNotes(prev.map((x) => (x.id === n.id ? { ...next, blob: x.blob } : x))));
  }, [store]);

  const remove = useCallback(async (n: Note) => {
    await store.remove(n.id).catch(() => {});
    setNotes((prev) => prev.filter((x) => x.id !== n.id));
  }, [store]);

  const exportAs = useCallback((format: ExportFormat) => {
    setMenu(false);
    const body = formatExport(notes, format);
    const blob = new Blob([body], { type: format === 'json' ? 'application/json' : format === 'md' ? 'text/markdown' : 'text/plain' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `private-notes.${format}`;
    document.body.appendChild(a);
    a.click();
    a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 1_000);
  }, [notes]);

  const attach = useCallback(async (files: File[]) => {
    for (const f of files) {
      if (f.size > 50 * 1024 * 1024) { toast.error(tr('Files up to 50 MB can be kept in notes.')); continue; }
      await add({ blob: f, name: f.name });
    }
  }, [add, tr]);

  const startVoice = useCallback(async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const chunks: BlobPart[] = [];
      const r = new MediaRecorder(stream);
      r.ondataavailable = (e) => { if (e.data.size) chunks.push(e.data); };
      r.onstop = () => {
        stream.getTracks().forEach((t) => t.stop());
        const blob = new Blob(chunks, { type: r.mimeType || 'audio/webm' });
        if (blob.size) void add({ blob, name: tr('Voice note') });
      };
      r.start();
      setRec({ r, started: Date.now() });
    } catch {
      toast.error(tr('Microphone access is needed to record a voice note.'));
    }
  }, [add, tr]);
  const stopVoice = useCallback((save: boolean) => {
    if (!rec) return;
    if (!save) rec.r.ondataavailable = null;
    if (!save) rec.r.onstop = () => rec.r.stream.getTracks().forEach((t) => t.stop());
    rec.r.stop();
    setRec(null);
  }, [rec]);
  useEffect(() => {
    if (!rec) { setRecSecs(0); return; }
    const t = setInterval(() => setRecSecs(Math.floor((Date.now() - rec.started) / 1000)), 250);
    return () => clearInterval(t);
  }, [rec]);

  const shown = useMemo(() => searchNotes(notes, query), [notes, query]);
  const veiled = locked || hiddenTab;
  const hasText = draft.trim().length > 0;

  const shell = (
    <div
      role="region"
      aria-label={tr(PRIVATE_NOTES_NAME)}
      data-private-notes=""
      className={variant === 'screen'
        ? 'lg-canvas fixed inset-0 z-[240000] flex flex-col'
        : 'lg-canvas absolute inset-0 z-[40] flex flex-col'}
      style={variant === 'screen' ? { height: '100dvh' } : undefined}
    >
      {/* Header */}
      <header className="lg-bar sticky top-0 z-10 shrink-0 pt-[max(8px,env(safe-area-inset-top))]">
        <div className="h-[60px] flex items-center gap-2 px-2">
          <button type="button" onClick={onClose} aria-label={tr('Back')} className="w-11 h-11 min-w-[44px] rounded-full flex items-center justify-center text-[#15171c] hover:bg-black/[0.05] active:scale-95 transition">
            <ArrowLeft size={22} strokeWidth={1.8} />
          </button>
          <PrivateNotesAvatar size={40} />
          <div className="flex-1 min-w-0">
            <p className="flex items-center gap-1.5 text-[16px] font-semibold text-[#15171c] leading-tight">
              <span className="truncate">{tr(PRIVATE_NOTES_NAME)}</span>
              <VerifiedBlueCheckBadge size={16} title={tr('Verified')} />
            </p>
            <p className="text-[12.5px] text-[#5b606b] truncate">{tr('Encrypted on this device · Only you can see it')}</p>
          </div>
          <button type="button" onClick={() => { setSearching((s) => !s); setQuery(''); }} aria-label={tr('Search notes')} aria-pressed={searching}
            className="w-11 h-11 rounded-full flex items-center justify-center text-[#15171c] hover:bg-black/[0.05]">
            <Search size={20} strokeWidth={1.8} />
          </button>
          <div className="relative">
            <button type="button" onClick={() => setMenu((m) => !m)} aria-label={tr('More')} aria-expanded={menu}
              className="w-11 h-11 rounded-full flex items-center justify-center text-[#15171c] hover:bg-black/[0.05]">
              <MoreHorizontal size={20} strokeWidth={1.8} />
            </button>
            <AnimatePresence>
              {menu && (
                <motion.div role="menu" initial={{ opacity: 0, scale: 0.96, y: -4 }} animate={{ opacity: 1, scale: 1, y: 0 }} exit={{ opacity: 0, scale: 0.96, y: -4 }}
                  transition={{ type: 'spring', damping: 30, stiffness: 420 }}
                  className="lg-sheet absolute right-0 top-12 w-[230px] rounded-[20px] p-1.5 z-20 origin-top-right">
                  {(['md', 'txt', 'json'] as ExportFormat[]).map((f) => (
                    <button key={f} role="menuitem" type="button" onClick={() => exportAs(f)} className="w-full flex items-center gap-3 px-3 py-2.5 rounded-[14px] text-[14.5px] text-[#15171c] hover:bg-black/[0.05]">
                      <Download size={17} strokeWidth={1.8} /> {tr('Export as .{ext}', { ext: f })}
                    </button>
                  ))}
                  <button role="menuitem" type="button" onClick={() => { setMenu(false); setConfirmClear(true); }} className="w-full flex items-center gap-3 px-3 py-2.5 rounded-[14px] text-[14.5px] text-[#b42318] hover:bg-[#b42318]/[0.06]">
                    <Trash2 size={17} strokeWidth={1.8} /> {tr('Clear notes')}
                  </button>
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        </div>
        {searching && (
          <div className="px-3 pb-2.5">
            <label className="lg-recessed flex items-center gap-2 h-11 rounded-full px-4">
              <Search size={17} strokeWidth={1.8} className="text-[#5b606b]" aria-hidden="true" />
              <input autoFocus value={query} onChange={(e) => setQuery(e.target.value)} placeholder={tr('Search notes')}
                className="flex-1 min-w-0 bg-transparent outline-none text-[16px] text-[#15171c] placeholder:text-[#7a7e87]" />
              {query && <button type="button" onClick={() => setQuery('')} aria-label={tr('Clear search')}><X size={16} className="text-[#5b606b]" /></button>}
            </label>
          </div>
        )}
      </header>

      {/* Notes */}
      <div ref={listRef} data-hl-scroll className={`flex-1 min-h-0 overflow-y-auto overscroll-contain px-3 sm:px-6 py-4 ${veiled ? 'blur-xl select-none pointer-events-none' : ''}`}>
        <div className="lg-card mx-auto mb-4 max-w-[420px] rounded-[20px] px-4 py-3 text-center">
          <p className="text-[13px] leading-relaxed text-[#4a505c]">{tr('Notes here stay encrypted on this device and are never sent anywhere. Other devices and other accounts do not see them.')}</p>
        </div>
        {loaded && notes.length === 0 && (
          <div className="flex flex-col items-center text-center pt-10 pb-6">
            <PrivateNotesAvatar size={84} />
            <p className="mt-4 text-[17px] font-semibold text-[#15171c]">{tr('Your private space')}</p>
            <p className="mt-1 max-w-[290px] text-[14.5px] leading-relaxed text-[#4a505c]">{tr('Write reminders, keep links, photos and voice notes, or make a checklist. Only you can see them.')}</p>
          </div>
        )}
        {query && shown.length === 0 && <p className="text-center text-[14px] text-[#5b606b] py-8">{tr('No notes match your search.')}</p>}
        <ul className="flex flex-col gap-2 max-w-[760px] mx-auto">
          {shown.map((n) => (
            <li key={n.id} className="flex justify-end">
              <div className="group relative max-w-[86%] sm:max-w-[72%]">
                <div className="lg-bubble-out rounded-[20px] rounded-br-[6px] px-3.5 py-2.5">
                  {(n.pinned || n.starred) && (
                    <p className="mb-1 flex items-center gap-1.5 text-[11.5px] font-semibold text-[#5b606b]">
                      {n.pinned && <><Pin size={12} /> {tr('Pinned')}</>}
                      {n.starred && <><Star size={12} className="fill-current" /> {tr('Starred')}</>}
                    </p>
                  )}
                  {n.kind === 'check' ? (
                    <button type="button" onClick={() => void patch(n, { done: !n.done })} className="flex items-start gap-2.5 text-left" aria-pressed={!!n.done}>
                      <span className={`mt-[2px] w-[19px] h-[19px] rounded-[6px] flex items-center justify-center shrink-0 ${n.done ? 'bg-[#15171c] text-white' : 'border-[1.5px] border-[#15171c]/60'}`}>
                        {n.done ? <Check size={13} strokeWidth={3} /> : null}
                      </span>
                      <span className={`text-[15.5px] leading-relaxed whitespace-pre-wrap break-words ${n.done ? 'line-through text-[#5b606b]' : 'text-[#15171c]'}`}>{n.text}</span>
                    </button>
                  ) : n.kind === 'image' && urls.get(n.id) ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={urls.get(n.id)} alt={n.name || tr('Photo')} className="rounded-[14px] max-h-[320px] w-auto object-contain" />
                  ) : n.kind === 'audio' && urls.get(n.id) ? (
                    <audio controls src={urls.get(n.id)} className="w-[240px] max-w-full" />
                  ) : n.kind === 'file' && urls.get(n.id) ? (
                    <a href={urls.get(n.id)} download={n.name || 'file'} className="flex items-center gap-2 text-[14.5px] text-[#15171c] underline-offset-2 hover:underline">
                      <Paperclip size={16} /> <span className="break-all">{n.name || tr('File')}</span> <span className="text-[#5b606b] no-underline">{fmtSize(n.size)}</span>
                    </a>
                  ) : (
                    <p className="text-[15.5px] leading-relaxed text-[#15171c] whitespace-pre-wrap break-words">
                      {linkify(n.text).map((part, i) => part.href
                        ? <a key={i} href={part.href} target="_blank" rel="noopener noreferrer" className="underline underline-offset-2 break-all">{part.text}</a>
                        : <React.Fragment key={i}>{part.text}</React.Fragment>)}
                    </p>
                  )}
                  <p className="mt-1 text-right text-[11px] tabular-nums text-[#5b606b]">{fmtTime(n.createdAt)}</p>
                </div>
                <div className="lg-pill mt-1 ml-auto w-max flex items-center gap-0.5 rounded-full p-0.5 opacity-100 sm:opacity-0 sm:group-hover:opacity-100 focus-within:opacity-100 transition-opacity">
                  <button type="button" onClick={() => void patch(n, { pinned: !n.pinned })} aria-label={n.pinned ? tr('Unpin') : tr('Pin')} className="w-8 h-8 rounded-full flex items-center justify-center text-[#4a505c] hover:bg-black/[0.06]"><Pin size={14} /></button>
                  <button type="button" onClick={() => void patch(n, { starred: !n.starred })} aria-label={n.starred ? tr('Remove star') : tr('Star')} className="w-8 h-8 rounded-full flex items-center justify-center text-[#4a505c] hover:bg-black/[0.06]"><Star size={14} className={n.starred ? 'fill-current' : ''} /></button>
                  {n.text && <button type="button" onClick={() => { void navigator.clipboard?.writeText(n.text); toast.success(tr('Copied')); }} aria-label={tr('Copy')} className="w-8 h-8 rounded-full flex items-center justify-center text-[#4a505c] hover:bg-black/[0.06]"><Copy size={14} /></button>}
                  <button type="button" onClick={() => void remove(n)} aria-label={tr('Delete note')} className="w-8 h-8 rounded-full flex items-center justify-center text-[#b42318] hover:bg-[#b42318]/[0.07]"><Trash2 size={14} /></button>
                </div>
              </div>
            </li>
          ))}
        </ul>
      </div>

      {/* Composer: + circle and the message pill (Liquid Porcelain Glass) */}
      <div className="shrink-0 px-3 sm:px-6 pt-2 pb-[max(10px,env(safe-area-inset-bottom))]">
        <AnimatePresence>
          {drawer && (
            <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: 8 }} transition={{ type: 'spring', damping: 30, stiffness: 420 }}
              className="lg-sheet max-w-[760px] mx-auto mb-2 rounded-[22px] p-1.5 grid grid-cols-3 gap-1">
              <button type="button" onClick={() => { setDrawer(false); filePick.current?.click(); }} className="flex flex-col items-center gap-1 py-2.5 rounded-[16px] text-[13px] text-[#15171c] hover:bg-black/[0.05]"><Paperclip size={20} strokeWidth={1.8} />{tr('File')}</button>
              <button type="button" onClick={() => { setDrawer(false); camPick.current?.click(); }} className="flex flex-col items-center gap-1 py-2.5 rounded-[16px] text-[13px] text-[#15171c] hover:bg-black/[0.05]"><CameraIcon size={20} strokeWidth={1.8} />{tr('Photo')}</button>
              <button type="button" onClick={() => { setDrawer(false); setCheckMode((c) => !c); field.current?.focus(); }} aria-pressed={checkMode} className={`flex flex-col items-center gap-1 py-2.5 rounded-[16px] text-[13px] text-[#15171c] ${checkMode ? 'lg-active-capsule' : 'hover:bg-black/[0.05]'}`}><ListChecks size={20} strokeWidth={1.8} />{tr('Checklist')}</button>
            </motion.div>
          )}
        </AnimatePresence>
        <input ref={filePick} type="file" multiple className="hidden" onChange={(e) => { const fs = Array.from(e.target.files ?? []); e.target.value = ''; void attach(fs); }} />
        <input ref={camPick} type="file" accept="image/*" capture="environment" className="hidden" onChange={(e) => { const fs = Array.from(e.target.files ?? []); e.target.value = ''; void attach(fs); }} />
        <form className="max-w-[760px] mx-auto flex items-end gap-2.5" onSubmit={(e) => { e.preventDefault(); send(); }}>
          <button type="button" onClick={() => setDrawer((d) => !d)} aria-label={drawer ? tr('Close') : tr('Attach')} aria-expanded={drawer}
            className="lg-orb w-[46px] h-[46px] shrink-0 rounded-full flex items-center justify-center text-[#15171c] active:scale-95 transition">
            <motion.span animate={{ rotate: drawer ? 45 : 0 }} transition={{ type: 'spring', damping: 22, stiffness: 380 }} className="flex"><PlusIcon size={24} strokeWidth={1.75} /></motion.span>
          </button>
          {rec ? (
            <div className="lg-composer flex-1 min-w-0 h-[46px] rounded-full flex items-center gap-3 pl-4 pr-1.5">
              <span className="lg-rec-dot" aria-hidden="true" />
              <span className="tabular-nums text-[15px] text-[#15171c]">{Math.floor(recSecs / 60)}:{String(recSecs % 60).padStart(2, '0')}</span>
              <span className="flex-1 text-[14px] text-[#5b606b] truncate">{tr('Recording…')}</span>
              <button type="button" onClick={() => stopVoice(false)} aria-label={tr('Cancel')} className="w-9 h-9 rounded-full flex items-center justify-center text-[#4a505c] hover:bg-black/[0.05]"><X size={18} /></button>
              <button type="button" onClick={() => stopVoice(true)} aria-label={tr('Save voice note')} className="lg-ink w-9 h-9 rounded-full flex items-center justify-center text-white"><Square size={14} className="fill-current" /></button>
            </div>
          ) : (
            <div className={`lg-composer flex-1 min-w-0 flex items-end gap-1 pl-4 pr-1.5 py-[5px] ${draft.includes('\n') || draft.length > 38 ? 'rounded-[24px]' : 'rounded-full'}`}>
              {checkMode && <span className="self-center mr-0.5 w-[17px] h-[17px] rounded-[5px] border-[1.5px] border-[#15171c]/60 shrink-0" aria-hidden="true" />}
              <textarea
                ref={field}
                value={draft}
                onChange={(e) => setDraft(e.target.value)}
                onKeyDown={(e) => { if (e.key === 'Enter' && !e.shiftKey && !('ontouchstart' in window)) { e.preventDefault(); send(); } }}
                rows={1}
                placeholder={checkMode ? tr('Checklist item') : tr('Note')}
                aria-label={tr('Write a note')}
                className="flex-1 min-w-0 max-h-[140px] bg-transparent outline-none resize-none py-[7px] text-[16px] leading-[22px] text-[#15171c] placeholder:text-[#7a7e87]"
                style={{ fieldSizing: 'content' } as React.CSSProperties}
              />
              <AnimatePresence initial={false} mode="popLayout">
                {hasText ? (
                  <motion.button key="send" type="submit" initial={{ scale: 0.6, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} exit={{ scale: 0.6, opacity: 0 }}
                    transition={{ type: 'spring', damping: 24, stiffness: 460 }} aria-label={tr('Save note')}
                    className="lg-ink w-9 h-9 mb-[1px] rounded-full flex items-center justify-center text-white shrink-0">
                    <SendArrowIcon size={18} />
                  </motion.button>
                ) : (
                  <motion.div key="tools" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="flex items-center text-[#111318] shrink-0">
                    <button type="button" onClick={() => setCheckMode((c) => !c)} aria-label={tr('Checklist item')} aria-pressed={checkMode} className="w-9 h-9 rounded-full flex items-center justify-center hover:bg-black/[0.05]"><StickerIcon size={22} /></button>
                    <button type="button" onClick={() => camPick.current?.click()} aria-label={tr('Photo')} className="w-9 h-9 rounded-full flex items-center justify-center hover:bg-black/[0.05]"><CameraIcon size={22} /></button>
                    <button type="button" onClick={() => void startVoice()} aria-label={tr('Record a voice note')} className="w-9 h-9 rounded-full flex items-center justify-center hover:bg-black/[0.05]"><MicIcon size={22} /></button>
                  </motion.div>
                )}
              </AnimatePresence>
            </div>
          )}
        </form>
      </div>

      {confirmClear && (
        <div className="lg-scrim fixed inset-0 z-[260000] flex items-center justify-center p-3" onClick={() => setConfirmClear(false)}>
          <div role="alertdialog" aria-modal="true" aria-label={tr('Clear notes')} onClick={(e) => e.stopPropagation()} className="lg-sheet w-[min(calc(100vw-24px),360px)] rounded-[26px] p-5">
            <p className="text-[17px] font-semibold text-[#15171c]">{tr('Clear all notes?')}</p>
            <p className="mt-1.5 text-[14.5px] leading-relaxed text-[#4a505c]">{tr('Every note on this device is deleted. This cannot be undone.')}</p>
            <div className="mt-4 flex justify-end gap-2">
              <button type="button" onClick={() => setConfirmClear(false)} className="lg-pill h-11 px-4 rounded-full text-[14.5px] font-semibold text-[#15171c]">{tr('Cancel')}</button>
              <button type="button" onClick={async () => { await store.clear().catch(() => {}); setNotes([]); setConfirmClear(false); }} className="h-11 px-4 rounded-full bg-[#b42318] text-white text-[14.5px] font-semibold">{tr('Clear notes')}</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );

  return variant === 'screen' ? <BodyPortal>{shell}</BodyPortal> : shell;
}

/** The pinned row at the top of Chats. */
export function PrivateNotesRow({ active, onOpen, preview }: { active: boolean; onOpen: () => void; preview?: string }) {
  const tr = useT();
  return (
    <button type="button" onClick={onOpen} data-private-notes-row="" aria-label={tr('Open Private Notes')}
      className={`lg-row-card w-full md:w-[calc(100%-20px)] md:mx-2.5 text-left px-4 py-3 md:px-3 md:py-2.5 rounded-none md:rounded-2xl flex items-center gap-3 transition-colors ${active ? 'lg-active-capsule' : ''}`}>
      <PrivateNotesAvatar size={48} />
      <span className="flex-1 min-w-0">
        <span className="flex items-center gap-1.5">
          <span className="text-[15.5px] font-semibold text-[#15171c] truncate">{tr(PRIVATE_NOTES_NAME)}</span>
          <VerifiedBlueCheckBadge size={15} title={tr('Verified')} />
        </span>
        <span className="block text-[13.5px] text-[#5b606b] truncate">{preview || tr('Encrypted on this device · Only you')}</span>
      </span>
      <Pin size={14} className="text-[#8a8f99] shrink-0" aria-label={tr('Pinned')} />
    </button>
  );
}
