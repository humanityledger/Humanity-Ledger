'use client';
/**
 * Shared Media of a community: Media, Files, Links, Voice, GIFs, Polls, Music.
 * Built on this device from posts it already decrypted (lib/communities/media-index.ts); thumbnails
 * and downloads go through the same encrypted-attachment loader as the private chats. Full screen on
 * a phone (safe areas respected), a side sheet on a computer. Esc closes; arrows move in the viewer.
 */
import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { ArrowLeft, BarChart3, ChevronLeft, ChevronRight, Download, ExternalLink, FileText, Image as ImageIcon, Link2, Mic, Music2, Play, Search, Sticker, X } from 'lucide-react';
import { useT } from '@/lib/i18n/client';
import { MEDIA_TABS, buildMediaIndex, searchMedia, tallyVotes, type IndexInput, type MediaItem, type MediaTab } from '@/lib/communities/media-index';
import { RemoteAttachmentBubble, loadAttachment } from '@/components/chat/RemoteAttachmentBubble';
import type { AttachmentMessage } from '@/lib/chat/remote-attachment';

const TAB_META: Record<MediaTab, { label: string; icon: React.ComponentType<{ size?: number; strokeWidth?: number }> }> = {
  media: { label: 'Media', icon: ImageIcon },
  files: { label: 'Files', icon: FileText },
  links: { label: 'Links', icon: Link2 },
  voice: { label: 'Voice', icon: Mic },
  gifs: { label: 'GIFs', icon: Sticker },
  polls: { label: 'Polls', icon: BarChart3 },
  music: { label: 'Music', icon: Music2 },
};

const size = (n?: number) => (n === undefined ? '' : n < 1024 ? `${n} B` : n < 1024 ** 2 ? `${Math.round(n / 1024)} KB` : `${(n / 1024 ** 2).toFixed(1)} MB`);
const day = (ms: number) => (ms ? new Date(ms).toLocaleDateString([], { day: 'numeric', month: 'short', year: new Date(ms).getFullYear() === new Date().getFullYear() ? undefined : 'numeric' }) : '');

async function download(att: AttachmentMessage) {
  const d = await loadAttachment(att);
  const a = document.createElement('a');
  a.href = d.url; a.download = att.filename; a.rel = 'noopener';
  document.body.appendChild(a); a.click(); a.remove();
}

/** A photo or video tile: decrypted only when it scrolls into view. */
function Tile({ att, video, onOpen }: { att: AttachmentMessage; video: boolean; onOpen: () => void }) {
  const ref = useRef<HTMLButtonElement>(null);
  const [url, setUrl] = useState<string | null>(null);
  const [failed, setFailed] = useState(false);
  useEffect(() => {
    const el = ref.current;
    if (!el || video) return;
    let alive = true;
    const io = new IntersectionObserver(([e]) => {
      if (!e.isIntersecting) return;
      io.disconnect();
      loadAttachment(att).then((d) => { if (alive && d.inline) setUrl(d.url); else if (alive) setFailed(true); }).catch(() => alive && setFailed(true));
    }, { rootMargin: '200px' });
    io.observe(el);
    return () => { alive = false; io.disconnect(); };
  }, [att, video]);
  return (
    <button ref={ref} type="button" onClick={onOpen} className="relative aspect-square bg-[#eef0f3] overflow-hidden focus-visible:outline focus-visible:outline-2 focus-visible:outline-[#15171c] focus-visible:-outline-offset-2" aria-label={att.filename}>
      {url && <img src={url} alt="" className="absolute inset-0 w-full h-full object-cover" draggable={false} />}
      {(video || failed) && <span className="absolute inset-0 grid place-items-center text-[#4a505c]">{video ? <Play size={26} strokeWidth={1.8} /> : <ImageIcon size={22} strokeWidth={1.6} />}</span>}
    </button>
  );
}

function Viewer({ items, start, onClose }: { items: Extract<MediaItem, { tab: 'media' }>[]; start: number; onClose: () => void }) {
  const t = useT();
  const [i, setI] = useState(start);
  const [url, setUrl] = useState<string | null>(null);
  const it = items[i];
  useEffect(() => {
    let alive = true; setUrl(null);
    loadAttachment(it.att).then((d) => alive && d.inline && setUrl(d.url)).catch(() => {});
    return () => { alive = false; };
  }, [it]);
  useEffect(() => {
    const k = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
      if (e.key === 'ArrowRight') setI((x) => Math.min(items.length - 1, x + 1));
      if (e.key === 'ArrowLeft') setI((x) => Math.max(0, x - 1));
    };
    window.addEventListener('keydown', k);
    return () => window.removeEventListener('keydown', k);
  }, [items.length, onClose]);
  return (
    <div className="fixed inset-0 z-[260] bg-black/95 flex flex-col" role="dialog" aria-modal="true" aria-label={t('Media viewer')}>
      <div className="flex items-center gap-2 px-3 pt-[max(10px,env(safe-area-inset-top))] pb-2 text-white">
        <button type="button" onClick={onClose} className="w-11 h-11 grid place-items-center rounded-full hover:bg-white/10" aria-label={t('Close')}><X size={22} /></button>
        <span className="text-[14px] text-white/70 tabular-nums">{i + 1} / {items.length}</span>
        <button type="button" onClick={() => void download(it.att)} className="ml-auto w-11 h-11 grid place-items-center rounded-full hover:bg-white/10" aria-label={t('Download')}><Download size={20} /></button>
      </div>
      <div className="relative flex-1 min-h-0 grid place-items-center px-2 pb-[max(12px,env(safe-area-inset-bottom))]">
        {it.video
          ? <div className="w-full max-w-[720px]"><RemoteAttachmentBubble att={it.att} isMe={false} onOpenLightbox={() => {}} /></div>
          : url ? <img src={url} alt="" className="max-w-full max-h-full object-contain select-none" draggable={false} /> : <span className="text-white/60 text-[14px]">{t('Decrypting…')}</span>}
        {i > 0 && <button type="button" onClick={() => setI(i - 1)} className="absolute left-2 top-1/2 -translate-y-1/2 w-11 h-11 grid place-items-center rounded-full bg-white/10 text-white" aria-label={t('Previous')}><ChevronLeft size={22} /></button>}
        {i < items.length - 1 && <button type="button" onClick={() => setI(i + 1)} className="absolute right-2 top-1/2 -translate-y-1/2 w-11 h-11 grid place-items-center rounded-full bg-white/10 text-white" aria-label={t('Next')}><ChevronRight size={22} /></button>}
      </div>
    </div>
  );
}

export function CommunityMediaSheet({ posts, messages, title, onClose, initialTab = 'media' }: {
  /** Visible posts (text, attachments, polls…). */
  posts: IndexInput[];
  /** Every message of the group, votes included, to count poll results. */
  messages?: IndexInput[];
  title: string;
  onClose: () => void;
  initialTab?: MediaTab;
}) {
  const t = useT();
  const index = useMemo(() => buildMediaIndex(posts), [posts]);
  const [tab, setTab] = useState<MediaTab>(initialTab);
  const [q, setQ] = useState('');
  const [viewer, setViewer] = useState<number | null>(null);
  const items = useMemo(() => searchMedia(index[tab], q), [index, tab, q]);
  const close = useCallback(() => { if (viewer !== null) setViewer(null); else onClose(); }, [viewer, onClose]);
  useEffect(() => {
    const k = (e: KeyboardEvent) => { if (e.key === 'Escape' && viewer === null) onClose(); };
    window.addEventListener('keydown', k);
    return () => window.removeEventListener('keydown', k);
  }, [viewer, onClose]);

  const media = items as Extract<MediaItem, { tab: 'media' }>[];
  return (
    <div className="fixed inset-0 z-[240] flex justify-end bg-black/30 sm:bg-black/20" role="dialog" aria-modal="true" aria-label={t('Shared media')} onClick={onClose}>
      <div className="w-full sm:max-w-[520px] h-[100dvh] bg-[#f4f5f7] flex flex-col shadow-[0_12px_40px_rgba(16,24,40,0.14)]" onClick={(e) => e.stopPropagation()}>
        <header className="bg-white border-b border-[#e6e8ec] pt-[max(8px,env(safe-area-inset-top))]">
          <div className="flex items-center gap-1 px-2 h-14">
            <button type="button" onClick={close} className="w-11 h-11 grid place-items-center rounded-full hover:bg-[#f2f3f5]" aria-label={t('Back')}><ArrowLeft size={20} /></button>
            <div className="min-w-0">
              <p className="text-[16px] font-semibold text-[#15171c] truncate">{t('Shared media')}</p>
              <p className="text-[12.5px] text-[#727a88] truncate">{title}</p>
            </div>
          </div>
          <div className="flex gap-1.5 overflow-x-auto px-3 pb-2.5 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden" role="tablist">
            {MEDIA_TABS.map((k) => {
              const M = TAB_META[k]; const Icon = M.icon; const n = index[k].length; const on = tab === k;
              return (
                <button key={k} type="button" role="tab" aria-selected={on} onClick={() => { setTab(k); setViewer(null); }}
                  className={`shrink-0 inline-flex items-center gap-1.5 h-9 px-3 rounded-full text-[13.5px] font-medium transition-colors ${on ? 'bg-[#15171c] text-white' : 'bg-[#f2f3f5] text-[#3d424b] hover:bg-[#e8eaee]'}`}>
                  <Icon size={15} strokeWidth={1.9} /> {t(M.label)}{n ? <span className={`tabular-nums ${on ? 'text-white/70' : 'text-[#8a919c]'}`}>{n}</span> : null}
                </button>
              );
            })}
          </div>
          <label className="flex items-center gap-2 mx-3 mb-3 h-10 px-3 rounded-xl bg-[#f2f3f5] text-[#727a88]">
            <Search size={16} aria-hidden="true" />
            <input value={q} onChange={(e) => setQ(e.target.value)} placeholder={t('Search')} className="flex-1 min-w-0 bg-transparent outline-none text-[15px] text-[#15171c] placeholder:text-[#8a919c]" />
          </label>
        </header>

        <div className="flex-1 min-h-0 overflow-y-auto overscroll-contain pb-[env(safe-area-inset-bottom)]">
          {items.length === 0 ? (
            <div className="px-8 py-16 text-center">
              <p className="text-[15.5px] font-medium text-[#15171c]">{q ? t('Nothing matches your search.') : t('Nothing shared here yet.')}</p>
              <p className="text-[13.5px] text-[#727a88] mt-1">{t('Everything is found on this device, from messages only members can read.')}</p>
            </div>
          ) : tab === 'media' ? (
            <div className="grid grid-cols-3 gap-0.5 p-0.5">
              {media.map((it, i) => <Tile key={it.id} att={it.att} video={it.video} onOpen={() => setViewer(i)} />)}
            </div>
          ) : tab === 'gifs' ? (
            <div className="grid grid-cols-3 gap-0.5 p-0.5">
              {(items as Extract<MediaItem, { tab: 'gifs' }>[]).map((it) => (
                <span key={it.id} className="relative aspect-square bg-[#eef0f3] overflow-hidden"><img src={it.url} alt="" loading="lazy" referrerPolicy="no-referrer" className="absolute inset-0 w-full h-full object-cover" /></span>
              ))}
            </div>
          ) : (
            <ul className="list-none m-0 p-3 space-y-2">
              {items.map((it) => (
                <li key={`${it.tab}:${it.id}:${'url' in it ? it.url : ''}`} className="bg-white rounded-2xl border border-[#e6e8ec] p-3">
                  {it.tab === 'files' && (
                    <div className="flex items-center gap-3">
                      <span className="w-11 h-11 rounded-xl bg-[#eff1f4] grid place-items-center text-[#15171c] shrink-0"><FileText size={20} strokeWidth={1.7} /></span>
                      <div className="min-w-0 flex-1">
                        <p className="text-[14.5px] font-medium text-[#15171c] truncate">{it.name}</p>
                        <p className="text-[12.5px] text-[#727a88]">{[size(it.size), day(it.at)].filter(Boolean).join(' · ')}</p>
                      </div>
                      {it.att && <button type="button" onClick={() => void download(it.att!)} className="w-11 h-11 grid place-items-center rounded-full hover:bg-[#f2f3f5]" aria-label={t('Download')}><Download size={19} /></button>}
                    </div>
                  )}
                  {it.tab === 'links' && (
                    <a href={it.url} target="_blank" rel="noopener noreferrer nofollow" className="flex items-center gap-3 min-h-[44px]">
                      <span className="w-11 h-11 rounded-xl bg-[#eff1f4] grid place-items-center text-[#15171c] shrink-0 text-[15px] font-semibold uppercase">{it.host.slice(0, 1)}</span>
                      <span className="min-w-0 flex-1">
                        <span className="block text-[14.5px] font-medium text-[#15171c] truncate">{it.host}</span>
                        <span className="block text-[12.5px] text-[#1f5fd6] truncate">{it.url}</span>
                      </span>
                      <ExternalLink size={16} className="text-[#8a919c] shrink-0" aria-hidden="true" />
                    </a>
                  )}
                  {(it.tab === 'voice' || it.tab === 'music') && (
                    <div>
                      {it.tab === 'music' && <p className="text-[14px] font-medium text-[#15171c] truncate mb-2">{it.name}</p>}
                      {it.att ? <RemoteAttachmentBubble att={it.att} isMe={false} onOpenLightbox={() => {}} />
                        : it.tab === 'voice' && it.inline ? <audio src={it.inline} controls preload="none" className="w-full" /> : null}
                      <p className="text-[12px] text-[#8a919c] mt-1.5">{day(it.at)}</p>
                    </div>
                  )}
                  {it.tab === 'polls' && (() => {
                    const { counts } = tallyVotes(messages ?? posts, it.pollId, it.options.length);
                    const total = counts.reduce((a, b) => a + b, 0);
                    return (
                      <div>
                        <p className="text-[15px] font-semibold text-[#15171c] mb-2">{it.question}</p>
                        {it.options.map((o, k) => {
                          const pct = total ? Math.round((counts[k] / total) * 100) : 0;
                          return (
                            <div key={k} className="relative h-9 rounded-lg bg-[#f2f3f5] overflow-hidden mb-1.5">
                              <span className="absolute inset-y-0 left-0 bg-[#dfe7ff]" style={{ width: `${pct}%` }} />
                              <span className="relative flex items-center justify-between h-full px-3 text-[13.5px] text-[#15171c]"><span className="truncate">{o}</span><span className="tabular-nums font-semibold">{pct}%</span></span>
                            </div>
                          );
                        })}
                        <p className="text-[12px] text-[#727a88]">{t('{count} votes', { count: total })} · {day(it.at)}</p>
                      </div>
                    );
                  })()}
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>
      {viewer !== null && media[viewer] && <Viewer items={media} start={viewer} onClose={() => setViewer(null)} />}
    </div>
  );
}
