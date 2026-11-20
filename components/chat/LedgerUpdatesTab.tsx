'use client';
import React, { useCallback, useEffect, useRef, useState } from 'react';
import { toast } from 'sonner';
import { PeerAvatar, SectionLabel, EmptyState, PrimaryButton, SecondaryButton, IconButton, Sheet, shortAddr } from './ui/kit';
import { loadStatusMedia, parseStatusMedia, STATUS_VIDEO_MAX_SECONDS, StatusMediaError, uploadStatusMedia } from '@/lib/chat/status-media';

/*
 * Status: a short text, a photo or a video of up to 30 seconds, for 24 hours.
 *
 * Server rules live in app/api/chat/stories/route.ts: you see your own
 * statuses and those of people who saved you as a contact, narrowed to the
 * contacts the author picked. Statuses are stored on our server; photos and
 * videos are encrypted at rest with a key kept in the status record, so the
 * server can read them. The composer says Status is not end-to-end encrypted.
 */

/* In-house glyphs (no icon library). */
const G = {
  plus: <svg width="12" height="12" viewBox="0 0 12 12" fill="none" aria-hidden="true"><path d="M6 2v8M2 6h8" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" /></svg>,
  trash: <svg width="16" height="16" viewBox="0 0 16 16" fill="none" aria-hidden="true"><path d="M3 4.5h10M6.5 4.5V3h3v1.5M4.5 4.5l.6 8.5h5.8l.6-8.5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" /></svg>,
  info: <svg width="15" height="15" viewBox="0 0 16 16" fill="none" aria-hidden="true"><circle cx="8" cy="8" r="6.25" stroke="currentColor" strokeWidth="1.4" /><path d="M8 7.2v4M8 4.9v.1" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" /></svg>,
  ring: <svg width="20" height="20" viewBox="0 0 20 20" fill="none" aria-hidden="true"><circle cx="10" cy="10" r="7.5" stroke="currentColor" strokeWidth="1.6" strokeDasharray="3 2.4" /><circle cx="10" cy="10" r="2.5" fill="currentColor" /></svg>,
};

type Mode = 'text' | 'image' | 'video';

/** Decrypts and shows one photo or video status; text otherwise. */
function StatusBody({ story, compact = false }: { story: Story; compact?: boolean }) {
  const [src, setSrc] = useState<string | null>(null);
  const [failed, setFailed] = useState(false);
  const media = story.mediaType === 'text' ? null : parseStatusMedia(story.contentUrl);
  useEffect(() => {
    if (!media) return;
    let url: string | null = null;
    let live = true;
    loadStatusMedia(media).then(u => { url = u; if (live) setSrc(u); else URL.revokeObjectURL(u); }).catch(() => live && setFailed(true));
    return () => { live = false; if (url) URL.revokeObjectURL(url); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [story.contentUrl]);
  if (story.mediaType === 'text') return <span className="block text-[14.5px] text-[#15171c] whitespace-pre-wrap break-words">{story.contentUrl}</span>;
  if (!media || failed) return <span className="block text-[13.5px] text-[#727a88]">This {story.mediaType === 'video' ? 'video' : 'photo'} is not available.</span>;
  if (!src) return <span className={`block rounded-xl border border-[#e4e7ec] bg-white ${compact ? 'h-24 w-24' : 'h-48 w-full'}`} aria-label="Loading" />;
  const cls = `block rounded-xl border border-[#e4e7ec] bg-white object-cover ${compact ? 'h-24 w-24' : 'max-h-[60vh] w-full object-contain'}`;
  return story.mediaType === 'video'
    ? <video src={src} className={cls} controls={!compact} muted playsInline preload="metadata" />
    : <img src={src} alt="Status photo" className={cls} />;
}

interface Story {
  id: string;
  authorAddress: string;
  contentUrl: string;
  mediaType: string;
  createdAt: string | number;
  expiresAt: string | number;
  /** Own statuses only: how many contacts were picked (0 = all contacts). */
  audienceSize?: number;
}

interface LedgerUpdatesTabProps {
  myAddress: string;
  myName: string;
  contacts: Array<{ peerAddress: string; name?: string }>;
  onOpenChat: (address: string) => void;
}

const MAX = 700;

const ago = (ts: string | number) => {
  const diff = Date.now() - new Date(ts).getTime();
  if (diff < 60_000) return 'Just now';
  if (diff < 3_600_000) return `${Math.floor(diff / 60_000)} min ago`;
  return `${Math.floor(diff / 3_600_000)} h ago`;
};

export const LedgerUpdatesTab: React.FC<LedgerUpdatesTabProps> = ({ myAddress, myName, contacts, onOpenChat }) => {
  const [mine, setMine] = useState<Story[]>([]);
  const [others, setOthers] = useState<Story[]>([]);
  const [loading, setLoading] = useState(true);
  const [composer, setComposer] = useState(false);
  const [draft, setDraft] = useState('');
  const [posting, setPosting] = useState(false);
  const [mode, setMode] = useState<Mode>('text');
  const [file, setFile] = useState<File | null>(null);
  const [preview, setPreview] = useState<string | null>(null);
  const [picked, setPicked] = useState<Set<string> | null>(null); // null = all contacts
  const [viewing, setViewing] = useState<string | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  useEffect(() => () => { if (preview) URL.revokeObjectURL(preview); }, [preview]);

  const resetComposer = () => {
    setComposer(false); setDraft(''); setMode('text'); setFile(null); setPreview(null); setPicked(null);
  };

  const pickFile = (f: File | undefined) => {
    if (!f) return;
    setFile(f);
    setPreview(URL.createObjectURL(f));
  };

  const nameOf = (addr: string) => contacts.find(c => c.peerAddress.toLowerCase() === addr.toLowerCase())?.name || shortAddr(addr);

  const load = useCallback(async () => {
    if (!myAddress) return;
    setLoading(true);
    try {
      const res = await fetch('/api/chat/stories', {
        credentials: 'include',
        cache: 'no-store',
        headers: { ...(myAddress ? { 'x-web3-address': myAddress } : {}) },
      });
      if (res.ok) {
        const { stories } = await res.json();
        const me = myAddress.toLowerCase();
        setMine((stories || []).filter((s: Story) => s.authorAddress?.toLowerCase() === me));
        setOthers((stories || []).filter((s: Story) => s.authorAddress?.toLowerCase() !== me));
      }
    } catch {
      /* the empty state covers it */
    }
    setLoading(false);
  }, [myAddress]);

  useEffect(() => { load(); }, [load]);

  const canPost = mode === 'text' ? Boolean(draft.trim()) : Boolean(file);
  const post = async () => {
    if (!canPost || posting) return;
    if (picked && picked.size === 0) { toast.error('Pick at least one contact, or choose All my contacts.'); return; }
    setPosting(true);
    try {
      let contentUrl = draft.trim();
      let mediaType: Mode = 'text';
      if (mode !== 'text' && file) {
        const up = await uploadStatusMedia(file);
        contentUrl = up.url;
        mediaType = up.kind;
      }
      const res = await fetch('/api/chat/stories', {
        method: 'POST',
        credentials: 'include',
        headers: {
          'Content-Type': 'application/json',
          ...(myAddress ? { 'x-web3-address': myAddress } : {}),
        },
        body: JSON.stringify({ contentUrl, mediaType, audience: picked ? Array.from(picked) : [] }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        throw new StatusMediaError(
          res.status === 401 ? 'Your session has expired. Sign in again to post.'
          : data?.error === 'Too many active statuses' ? 'You have 30 active statuses. Delete one first.'
          : typeof data?.error === 'string' && /characters|Ledger Chat attachment/.test(data.error) ? data.error
          : 'Could not post your status. Try again.');
      }
      setMine(prev => [data.story, ...prev]);
      resetComposer();
      toast.success('Status posted');
    } catch (e: any) {
      // Say what went wrong (size, length, type, session, storage), not only "try again".
      toast.error(e instanceof StatusMediaError ? e.message : 'Could not post your status. Check your connection and try again.');
    }
    setPosting(false);
  };

  const remove = async (id: string) => {
    const before = mine;
    setMine(prev => prev.filter(s => s.id !== id));
    try {
      const res = await fetch(`/api/chat/stories?id=${encodeURIComponent(id)}`, { method: 'DELETE', credentials: 'include' });
      if (!res.ok) throw new Error();
    } catch {
      setMine(before);
      toast.error('Could not delete the status');
    }
  };

  // Group other people's statuses by author, newest first.
  const byAuthor = others.reduce<Record<string, Story[]>>((acc, s) => {
    const k = s.authorAddress.toLowerCase();
    (acc[k] ||= []).push(s);
    return acc;
  }, {});

  return (
    <div className="flex-1 overflow-y-auto flex flex-col bg-white">
      <div className="px-2 pt-3">
        <div className="flex items-center gap-3 px-2 py-2 rounded-xl">
          <span className="relative">
            <PeerAvatar address={myAddress} name={myName} size={48} />
            <button
              type="button"
              onClick={() => setComposer(true)}
              aria-label="New status"
              className="absolute -bottom-0.5 -right-0.5 w-5 h-5 rounded-full bg-[#15171c] text-white ring-2 ring-white flex items-center justify-center"
            >
              {G.plus}
            </button>
          </span>
          <button type="button" onClick={() => setComposer(true)} className="flex-1 min-w-0 text-left">
            <span className="block text-[15.5px] font-medium text-[#15171c]">My status</span>
            <span className="block text-[13.5px] text-[#727a88]">
              {mine.length === 0 ? 'Share a text, photo or short video for 24 hours' : `${mine.length} active ${mine.length === 1 ? 'status' : 'statuses'}`}
            </span>
          </button>
        </div>
        {mine.length > 0 && (
          <ul className="pl-[68px] pr-2 pb-1">
            {mine.map(s => (
              <li key={s.id} className="flex items-start gap-2 py-2 border-t border-[#eceef2] first:border-t-0">
                <span className="flex-1 min-w-0">
                  <StatusBody story={s} compact />
                  <span className="block text-[12.5px] text-[#a3a9b4] mt-0.5">
                    {ago(s.createdAt)} · {s.audienceSize ? `${s.audienceSize} ${s.audienceSize === 1 ? 'contact' : 'contacts'}` : 'All my contacts'}
                  </span>
                </span>
                <IconButton label="Delete status" onClick={() => remove(s.id)} className="text-[#727a88] hover:text-[#FF3B30]">
                  {G.trash}
                </IconButton>
              </li>
            ))}
          </ul>
        )}
      </div>

      <SectionLabel>Recent</SectionLabel>
      {loading ? (
        <p className="px-4 py-6 text-[14px] text-[#a3a9b4]">Loading</p>
      ) : Object.keys(byAuthor).length === 0 ? (
        <EmptyState
          icon={G.ring}
          title="No updates yet"
          text="When people who saved you as a contact share a status, it shows up here for 24 hours."
        />
      ) : (
        <ul className="px-2">
          {Object.entries(byAuthor).map(([author, list]) => (
            <li key={author}>
              <button
                type="button"
                onClick={() => setViewing(author)}
                className="w-full flex items-start gap-3 px-2 py-2.5 rounded-xl hover:bg-[#f7f8fa] text-left transition-colors"
              >
                <span className="rounded-full p-[2px] ring-2 ring-[#5200FF] shrink-0">
                  <PeerAvatar address={author} name={nameOf(author)} size={42} />
                </span>
                <span className="flex-1 min-w-0">
                  <span className="flex items-baseline justify-between gap-2">
                    <span className="text-[15.5px] font-medium text-[#15171c] truncate">{nameOf(author)}</span>
                    <span className="text-[12.5px] text-[#a3a9b4] shrink-0">{ago(list[0].createdAt)}</span>
                  </span>
                  <span className="block text-[14px] text-[#4a505c] mt-0.5 line-clamp-2">
                    {list[0].mediaType === 'text' ? list[0].contentUrl : list[0].mediaType === 'video' ? 'Video' : 'Photo'}
                  </span>
                  {list.length > 1 && <span className="block text-[12.5px] text-[#a3a9b4] mt-0.5">and {list.length - 1} more</span>}
                </span>
              </button>
            </li>
          ))}
        </ul>
      )}

      <Sheet
        open={viewing !== null}
        onClose={() => setViewing(null)}
        title={viewing ? nameOf(viewing) : ''}
        subtitle="Status, for 24 hours"
        footer={
          <div className="flex items-center justify-end gap-2">
            <SecondaryButton onClick={() => setViewing(null)}>Close</SecondaryButton>
            <PrimaryButton onClick={() => { const a = viewing; setViewing(null); if (a) onOpenChat(a); }}>Reply in chat</PrimaryButton>
          </div>
        }
      >
        <ul className="px-5 pb-4 space-y-4">
          {(viewing ? byAuthor[viewing] || [] : []).map(s => (
            <li key={s.id}>
              <StatusBody story={s} />
              <span className="block text-[12.5px] text-[#a3a9b4] mt-1">{ago(s.createdAt)}</span>
            </li>
          ))}
        </ul>
      </Sheet>

      <Sheet
        open={composer}
        onClose={resetComposer}
        title="New status"
        subtitle="Visible for 24 hours"
        footer={
          <div className="flex items-center justify-end gap-2">
            <SecondaryButton onClick={resetComposer}>Cancel</SecondaryButton>
            <PrimaryButton onClick={post} disabled={!canPost || posting}>{posting ? 'Posting' : 'Post'}</PrimaryButton>
          </div>
        }
      >
        <div className="px-5 pb-4">
          <div role="tablist" aria-label="Status type" className="flex gap-2 mb-3">
            {([['text', 'Text'], ['image', 'Photo'], ['video', 'Video']] as const).map(([id, label]) => (
              <button
                key={id}
                type="button"
                role="tab"
                aria-selected={mode === id}
                onClick={() => { setMode(id); setFile(null); setPreview(null); }}
                className={`h-8 px-3 rounded-full text-[13px] font-medium border transition-colors ${mode === id ? 'bg-[#15171c] border-[#15171c] text-white' : 'bg-white border-[#e4e7ec] text-[#15171c]'}`}
              >
                {label}
              </button>
            ))}
          </div>
          {mode !== 'text' ? (
            <>
              <input
                ref={fileRef}
                type="file"
                className="hidden"
                accept={mode === 'image' ? 'image/jpeg,image/png,image/webp,image/gif,image/avif' : 'video/mp4,video/webm,video/quicktime'}
                onChange={e => pickFile(e.target.files?.[0])}
              />
              {preview ? (
                mode === 'video'
                  ? <video src={preview} className="w-full max-h-64 rounded-xl border border-[#e4e7ec] object-contain" controls muted playsInline />
                  : <img src={preview} alt="Selected photo" className="w-full max-h-64 rounded-xl border border-[#e4e7ec] object-contain" />
              ) : null}
              <button type="button" onClick={() => fileRef.current?.click()} className="mt-2 h-10 w-full rounded-xl border border-[#e4e7ec] bg-white text-[14px] font-medium text-[#15171c]">
                {file ? 'Choose another' : mode === 'image' ? 'Choose a photo' : `Choose a video (up to ${STATUS_VIDEO_MAX_SECONDS} s)`}
              </button>
              <p className="text-[12.5px] text-[#a3a9b4] mt-1">Up to 20 MB.</p>
            </>
          ) : (<>
          <textarea
            autoFocus
            value={draft}
            onChange={e => setDraft(e.target.value.slice(0, MAX))}
            placeholder="What would you like to share?"
            rows={5}
            className="w-full text-[15.5px] text-[#15171c] placeholder:text-[#a3a9b4] resize-none outline-none border border-[#d9dde3] rounded-xl p-3 focus:border-[#15171c] focus:ring-2 focus:ring-[#15171c]/10"
          />
          <p className="text-[12.5px] text-[#a3a9b4] text-right tabular-nums mt-1">{draft.length} / {MAX}</p>
          </>)}

          <fieldset className="mt-4">
            <legend className="text-[13px] font-semibold text-[#15171c] mb-2">Who can see it</legend>
            <label className="flex items-center gap-2 py-1 text-[14px] text-[#15171c]">
              <input type="radio" name="status-audience" checked={picked === null} onChange={() => setPicked(null)} />
              All my contacts who saved me
            </label>
            <label className="flex items-center gap-2 py-1 text-[14px] text-[#15171c]">
              <input type="radio" name="status-audience" checked={picked !== null} onChange={() => setPicked(new Set())} disabled={contacts.length === 0} />
              Only some contacts
            </label>
            {picked !== null && (
              <ul className="mt-1 max-h-40 overflow-y-auto rounded-xl border border-[#e4e7ec]">
                {contacts.map(c => {
                  const a = c.peerAddress.toLowerCase();
                  return (
                    <li key={a}>
                      <label className="flex items-center gap-2 px-3 py-2 text-[14px] text-[#15171c]">
                        <input
                          type="checkbox"
                          checked={picked.has(a)}
                          onChange={e => setPicked(prev => { const n = new Set(prev || []); if (e.target.checked) n.add(a); else n.delete(a); return n; })}
                        />
                        <span className="truncate">{c.name || shortAddr(c.peerAddress)}</span>
                      </label>
                    </li>
                  );
                })}
              </ul>
            )}
            <p className="text-[12.5px] text-[#a3a9b4] mt-1">Only people who saved you as a contact can ever see your status.</p>
          </fieldset>

          <p className="mt-3 flex items-start gap-2 text-[13.5px] text-[#4a505c] leading-relaxed">
            <span className="mt-[2px] shrink-0 text-[#727a88]">{G.info}</span>
            Status is stored on our server and is not end-to-end encrypted. Photos and videos are encrypted at rest, but the server holds their key.
          </p>
        </div>
      </Sheet>
    </div>
  );
};
