'use client';
import React, { useCallback, useEffect, useState } from 'react';
import { CircleDot, Plus, Trash2, Info } from 'lucide-react';
import { toast } from 'sonner';
import { PeerAvatar, SectionLabel, EmptyState, PrimaryButton, SecondaryButton, IconButton, Sheet, shortAddr } from './ui/kit';

/*
 * Updates: short text statuses that last 24 hours.
 *
 * Server rules live in app/api/chat/stories/route.ts: you see your own
 * statuses and those of people who saved you as a contact. Statuses are
 * stored as plain text on our server, so the composer says they are not end
 * to end encrypted.
 */

interface Story {
  id: string;
  authorAddress: string;
  contentUrl: string;
  mediaType: string;
  createdAt: string | number;
  expiresAt: string | number;
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

  const nameOf = (addr: string) => contacts.find(c => c.peerAddress.toLowerCase() === addr.toLowerCase())?.name || shortAddr(addr);

  const load = useCallback(async () => {
    if (!myAddress) return;
    setLoading(true);
    try {
      const res = await fetch('/api/chat/stories', { credentials: 'include', cache: 'no-store' });
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

  const post = async () => {
    const text = draft.trim();
    if (!text || posting) return;
    setPosting(true);
    try {
      const res = await fetch('/api/chat/stories', {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ contentUrl: text, mediaType: 'text' }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data?.error || 'Could not post');
      setMine(prev => [data.story, ...prev]);
      setDraft('');
      setComposer(false);
      toast.success('Status posted');
    } catch (e: any) {
      toast.error(e?.message === 'Too many active statuses' ? 'You have 30 active statuses. Delete one first.' : 'Could not post your status. Try again.');
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
              <Plus size={12} strokeWidth={2.4} />
            </button>
          </span>
          <button type="button" onClick={() => setComposer(true)} className="flex-1 min-w-0 text-left">
            <span className="block text-[15.5px] font-medium text-[#15171c]">My status</span>
            <span className="block text-[13.5px] text-[#727a88]">
              {mine.length === 0 ? 'Share a short update for 24 hours' : `${mine.length} active ${mine.length === 1 ? 'update' : 'updates'}`}
            </span>
          </button>
        </div>
        {mine.length > 0 && (
          <ul className="pl-[68px] pr-2 pb-1">
            {mine.map(s => (
              <li key={s.id} className="flex items-start gap-2 py-2 border-t border-[#eceef2] first:border-t-0">
                <span className="flex-1 min-w-0">
                  <span className="block text-[14.5px] text-[#15171c] whitespace-pre-wrap break-words">{s.contentUrl}</span>
                  <span className="block text-[12.5px] text-[#a3a9b4] mt-0.5">{ago(s.createdAt)}</span>
                </span>
                <IconButton label="Delete status" onClick={() => remove(s.id)} className="text-[#727a88] hover:text-[#d93036]">
                  <Trash2 size={16} strokeWidth={1.8} />
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
          icon={<CircleDot size={20} strokeWidth={1.8} />}
          title="No updates yet"
          text="When people who saved you as a contact share a status, it shows up here for 24 hours."
        />
      ) : (
        <ul className="px-2">
          {Object.entries(byAuthor).map(([author, list]) => (
            <li key={author}>
              <button
                type="button"
                onClick={() => onOpenChat(author)}
                className="w-full flex items-start gap-3 px-2 py-2.5 rounded-xl hover:bg-[#f7f8fa] text-left transition-colors"
              >
                <span className="rounded-full p-[2px] ring-2 ring-[#15171c] shrink-0">
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
        open={composer}
        onClose={() => setComposer(false)}
        title="New status"
        subtitle="Visible for 24 hours"
        footer={
          <div className="flex items-center justify-end gap-2">
            <SecondaryButton onClick={() => setComposer(false)}>Cancel</SecondaryButton>
            <PrimaryButton onClick={post} disabled={!draft.trim() || posting}>{posting ? 'Posting' : 'Post'}</PrimaryButton>
          </div>
        }
      >
        <div className="px-5 pb-4">
          <textarea
            autoFocus
            value={draft}
            onChange={e => setDraft(e.target.value.slice(0, MAX))}
            placeholder="What would you like to share?"
            rows={5}
            className="w-full text-[15.5px] text-[#15171c] placeholder:text-[#a3a9b4] resize-none outline-none border border-[#d9dde3] rounded-xl p-3 focus:border-[#15171c] focus:ring-2 focus:ring-[#15171c]/10"
          />
          <p className="text-[12.5px] text-[#a3a9b4] text-right tabular-nums mt-1">{draft.length} / {MAX}</p>
          <p className="mt-3 flex items-start gap-2 text-[13.5px] text-[#4a505c] leading-relaxed">
            <Info size={15} strokeWidth={1.9} className="mt-[2px] shrink-0 text-[#727a88]" aria-hidden="true" />
            People who saved you as a contact can see it. Statuses are stored on our server and are not end to end encrypted.
          </p>
        </div>
      </Sheet>
    </div>
  );
};
