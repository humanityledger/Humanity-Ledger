'use client';
import React, { useCallback, useEffect, useState } from 'react';
import { communityInviteUrl, countLabel } from '@/lib/ui/format';
import { Copy, Link2, MessageSquare, Settings2 } from 'lucide-react';
import { ContextMenu, useContextMenuTrigger, type MenuAt, type MenuItem } from './ui/ContextMenu';
import { toast } from 'sonner';
import { SectionLabel, EmptyState, PrimaryButton, SecondaryButton, SearchField, Sheet, tintFor } from './ui/kit';

interface Community {
  id: string;
  name: string;
  description: string;
  membersCount: number;
  isPrivate: boolean;
  createdAt: number;
  joinCode: string;
  myRole?: string;
}

interface LedgerCommunitiesTabProps {
  myAddress: string;
  onOpenCommunity: (id: string) => void;
  /** Opens the community straight on Manage (right click > Manage). */
  onManageCommunity?: (id: string) => void;
}

function CommunityMark({ c, size = 44 }: { c: Community; size?: number }) {
  const letters = c.name.trim().split(/\s+/).slice(0, 2).map(w => w[0]).join('').toUpperCase() || '#';
  return (
    <span
      className="rounded-[14px] flex items-center justify-center font-semibold shrink-0 select-none"
      style={{ width: size, height: size, fontSize: Math.round(size * 0.36), ...tintFor(Array.from(c.id).map(ch => ch.charCodeAt(0).toString(16)).join('').slice(0, 6)), color: '#15171c' }}
      aria-hidden="true"
    >
      {letters}
    </span>
  );
}

async function copyText(text: string, done: string) {
  try {
    await navigator.clipboard.writeText(text);
    toast.success(done);
  } catch {
    toast.error('Could not copy on this device.');
  }
}

/** Right click (long press on a phone) on a community: open it, manage it, copy its invite link or name. */
function rowMenu(c: Community, onOpen: () => void, onManage?: () => void): MenuItem[] {
  const items: MenuItem[] = [{ label: 'Open', icon: <MessageSquare size={16} strokeWidth={1.9} />, onSelect: onOpen }];
  if (onManage) items.push({ label: 'Manage', icon: <Settings2 size={16} strokeWidth={1.9} />, onSelect: onManage });
  const link = communityInviteUrl(c.joinCode);
  if (link) items.push({ label: 'Copy invite link', icon: <Link2 size={16} strokeWidth={1.9} />, onSelect: () => copyText(link, 'Invite link copied.') });
  items.push({ label: 'Copy name', icon: <Copy size={16} strokeWidth={1.9} />, onSelect: () => copyText(c.name, 'Name copied.') });
  return items;
}

function CommunityRow({ c, onOpen, onManage }: { c: Community; onOpen: () => void; onManage?: () => void }) {
  const members = c.membersCount || 1;
  const [menu, setMenu] = useState<MenuAt | null>(null);
  const { handlers, consumeLongPress } = useContextMenuTrigger(setMenu);
  return (
    <li>
      {menu && <ContextMenu at={menu} items={rowMenu(c, onOpen, onManage)} label={`${c.name} actions`} onClose={() => setMenu(null)} />}
      <button type="button" {...handlers} style={{ WebkitTouchCallout: 'none' }} onClick={() => { if (!consumeLongPress()) onOpen(); }} aria-label={`Open ${c.name}`} className="w-full min-h-[72px] flex items-center gap-3.5 px-3 py-3 rounded-2xl hover:bg-[#f2f4f7] focus:outline-none focus-visible:ring-4 focus-visible:ring-[#15171c]/20 transition-colors text-left">
        <CommunityMark c={c} size={48} />
        <span className="flex-1 min-w-0">
          <span className="block text-[18px] font-semibold text-[#15171c] truncate">{c.name}</span>
          <span className="block text-[16px] text-[#3d424b] mt-0.5 tabular-nums leading-snug">
            {countLabel(members, 'member', 'members')} · {c.isPrivate ? 'Private' : 'Public'}{c.myRole === 'ADMIN' ? ' · You manage it' : c.myRole === 'MODERATOR' ? ' · You moderate it' : ''}
          </span>
          {c.description && (
            <span className="block text-[16px] text-[#3d424b] truncate">{c.description}</span>
          )}
        </span>
        <span aria-hidden="true" className="text-[24px] text-[#3d424b] shrink-0">›</span>
      </button>
    </li>
  );
}

export const LedgerCommunitiesTab: React.FC<LedgerCommunitiesTabProps> = ({ myAddress, onOpenCommunity, onManageCommunity }) => {
  const [communities, setCommunities] = useState<Community[]>([]);
  const [view, setView] = useState<'mine' | 'discover'>('mine');
  const [showCreate, setShowCreate] = useState(false);
  const [showJoin, setShowJoin] = useState(false);
  const [newName, setNewName] = useState('');
  const [newDesc, setNewDesc] = useState('');
  const [isPrivate, setIsPrivate] = useState(true);
  const [joinLink, setJoinLink] = useState('');
  const [loading, setLoading] = useState(true);
  const [creating, setCreating] = useState(false);
  const [joining, setJoining] = useState(false);
  const [publicOnes, setPublicOnes] = useState<Community[]>([]);
  const [search, setSearch] = useState('');

  const fetchMine = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/chat/communities', { credentials: 'include', headers: { 'x-web3-address': myAddress } });
      if (res.ok) setCommunities((await res.json()).communities || []);
    } catch { /* empty state covers it */ }
    setLoading(false);
  }, [myAddress]);

  const fetchPublic = useCallback(async () => {
    try {
      const res = await fetch('/api/chat/communities?discover=true', { credentials: 'include', headers: { 'x-web3-address': myAddress } });
      if (res.ok) setPublicOnes((await res.json()).communities || []);
    } catch { /* empty state covers it */ }
  }, [myAddress]);

  useEffect(() => { fetchMine(); fetchPublic(); }, [fetchMine, fetchPublic]);

  const create = async () => {
    if (!newName.trim() || creating) return;
    setCreating(true);
    try {
      const res = await fetch('/api/chat/communities', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'x-web3-address': myAddress },
        credentials: 'include',
        body: JSON.stringify({ name: newName.trim(), description: newDesc.trim(), isPrivate }),
      });
      if (res.ok) {
        const d = await res.json().catch(() => ({}));
        const id: string | undefined = d?.community?.id;
        await fetchMine();
        if (!isPrivate) fetchPublic();
        setNewName(''); setNewDesc(''); setIsPrivate(true); setShowCreate(false);
        // Start one: name, private or not, then it opens.
        if (id) onOpenCommunity(id);
      } else {
        const d = await res.json().catch(() => ({}));
        toast.error(d.error || 'Could not create the community');
      }
    } catch {
      toast.error('Could not reach the server. Try again.');
    } finally {
      setCreating(false);
    }
  };

  const join = async () => {
    let code = joinLink.trim();
    const m = code.match(/\/join\/([A-Z0-9]+)/i);
    if (m) code = m[1].toUpperCase();
    if (!code || joining) return;
    setJoining(true);
    try {
      const res = await fetch('/api/chat/communities/join', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'x-web3-address': myAddress },
        credentials: 'include',
        body: JSON.stringify({ joinCode: code }),
      });
      if (res.ok) {
        const d = await res.json().catch(() => ({}));
        const id: string | undefined = d?.community?.id;
        await fetchMine();
        setJoinLink(''); setShowJoin(false);
        // Joining opens the community you joined.
        if (id) onOpenCommunity(id);
        else toast.success('You joined the community');
      } else {
        const d = await res.json().catch(() => ({}));
        toast.error(d.error || 'That invite did not work');
      }
    } catch {
      toast.error('Could not reach the server. Try again.');
    } finally {
      setJoining(false);
    }
  };

  const q = search.trim().toLowerCase();
  const visiblePublic = publicOnes.filter(c => !q || c.name.toLowerCase().includes(q) || c.description?.toLowerCase().includes(q));
  const field = 'w-full min-h-[52px] px-4 py-3 rounded-2xl bg-white border-2 border-[#9aa1ac] text-[18px] text-[#15171c] placeholder:text-[#4a505c] outline-none focus:border-[#15171c] focus:ring-2 focus:ring-[#15171c]/10';

  return (
    <div className="flex-1 overflow-y-auto flex flex-col bg-white">
      <div className="px-4 pt-3 pb-2 sticky top-0 bg-white z-10 border-b border-[#eceef2]">
        <div className="flex p-1 bg-[#f2f4f7] rounded-xl" role="tablist" aria-label="Communities">
          {([['mine', 'Your communities'], ['discover', 'Find one']] as const).map(([id, label]) => (
            <button
              key={id}
              type="button"
              role="tab"
              aria-selected={view === id}
              onClick={() => setView(id)}
              className={`flex-1 min-h-[48px] text-[17px] font-semibold rounded-lg transition-colors ${view === id ? 'bg-white text-[#15171c] shadow-sm' : 'text-[#3d424b] hover:text-[#15171c]'}`}
            >
              {label}
            </button>
          ))}
        </div>
        {view === 'mine' ? (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-1 gap-2 mt-3">
            <SecondaryButton onClick={() => setShowJoin(true)} className="flex-1 min-h-[48px] text-[17px]">
              Join with an invite
            </SecondaryButton>
            <SecondaryButton onClick={() => setShowCreate(true)} className="flex-1 min-h-[48px] text-[17px]">
              Start one
            </SecondaryButton>
          </div>
        ) : (
          <div className="mt-3"><SearchField value={search} onChange={setSearch} placeholder="Search public communities" /></div>
        )}
      </div>

      {view === 'mine' ? (
        loading ? (
          <p className="flex-1 px-5 py-8 text-[18px] text-[#3d424b]" role="status">Loading your communities…</p>
        ) : communities.length === 0 ? (
          <EmptyState
            title="You are not in a community yet"
            text="If someone sent you an invite, tap Join with an invite. You can also start one for a team, a project or friends."
            action={<PrimaryButton onClick={() => setShowJoin(true)} className="min-h-[48px] text-[17px]">Join with an invite</PrimaryButton>}
          />
        ) : (
          <ul className="px-2 py-2">
            {communities.map(c => <CommunityRow key={c.id} c={c} onOpen={() => onOpenCommunity(c.id)} onManage={onManageCommunity ? () => onManageCommunity(c.id) : undefined} />)}
          </ul>
        )
      ) : (
        <>
          <SectionLabel>{visiblePublic.length} public {visiblePublic.length === 1 ? 'community' : 'communities'}</SectionLabel>
          {visiblePublic.length === 0 ? (
            <EmptyState
              title={q ? 'No matches' : 'No public communities yet'}
              text={q ? 'Try another word.' : 'Public communities can be found and joined by anyone.'}
              action={!q ? <SecondaryButton onClick={() => { setIsPrivate(false); setShowCreate(true); }}>Create a public one</SecondaryButton> : undefined}
            />
          ) : (
            <ul className="px-2 pb-3">
              {visiblePublic.map(c => <CommunityRow key={c.id} c={c} onOpen={() => onOpenCommunity(c.id)} />)}
            </ul>
          )}
        </>
      )}

      <Sheet
        open={showCreate}
        onClose={() => setShowCreate(false)}
        title="New community"
        subtitle="A name, and who can join. Everything else is in Manage."
        footer={
          <div className="flex justify-end gap-2">
            <SecondaryButton onClick={() => setShowCreate(false)} className="min-h-[48px] text-[18px] px-5">Cancel</SecondaryButton>
            <PrimaryButton onClick={create} disabled={!newName.trim() || creating} className="min-h-[48px] text-[18px] px-5">{creating ? "Starting" : "Start it"}</PrimaryButton>
          </div>
        }
      >
        <div className="px-5 pb-4 flex flex-col gap-4">
          <label className="flex flex-col gap-1.5">
            <span className="text-[18px] font-semibold text-[#15171c]">Name</span>
            <input value={newName} onChange={e => setNewName(e.target.value)} onKeyDown={e => { if (e.key === 'Enter') create(); }} placeholder="Design team" maxLength={64} autoFocus className={field} />
          </label>
          <fieldset className="flex flex-col gap-2">
            <legend className="text-[18px] font-semibold text-[#15171c] mb-1.5">Is it private?</legend>
            {([
              [true, 'Private', 'Only people with an invite can join'],
              [false, 'Public', 'Anyone can find it and join'],
            ] as const).map(([priv, title, text]) => (
              <button
                key={title}
                type="button"
                role="radio"
                aria-checked={isPrivate === priv}
                onClick={() => setIsPrivate(priv)}
                className={`min-h-[56px] flex items-center gap-3 p-3 rounded-2xl border-2 text-left transition-colors ${isPrivate === priv ? 'border-[#15171c] bg-white' : 'border-[#d4d8de] hover:bg-[#f7f8fa]'}`}
              >
                <span className="flex-1">
                  <span className="block text-[18px] font-semibold text-[#15171c]">{title}</span>
                  <span className="block text-[16px] text-[#3d424b]">{text}</span>
                </span>
                <span className={`text-[16px] font-semibold ${isPrivate === priv ? 'text-[#15171c]' : 'text-[#3d424b]'}`}>{isPrivate === priv ? 'Selected' : 'Choose'}</span>
              </button>
            ))}
          </fieldset>
          <p className="text-[16px] text-[#3d424b] leading-relaxed">People in a community can read what is written there, and the posts are stored on our server. It is not a private conversation.</p>
        </div>
      </Sheet>

      <Sheet
        open={showJoin}
        onClose={() => setShowJoin(false)}
        title="Join a community"
        subtitle="Paste the invite link or code you were sent"
        footer={
          <div className="flex justify-end gap-2">
            <SecondaryButton onClick={() => setShowJoin(false)} className="min-h-[48px] text-[18px] px-5">Cancel</SecondaryButton>
            <PrimaryButton onClick={join} disabled={!joinLink.trim() || joining} className="min-h-[48px] text-[18px] px-5">{joining ? "Joining" : "Join"}</PrimaryButton>
          </div>
        }
      >
        <div className="px-5 pb-4">
          <input
            value={joinLink}
            onChange={e => setJoinLink(e.target.value)}
            onKeyDown={e => { if (e.key === 'Enter') join(); }}
            placeholder="Invite link or code"
            aria-label="Invite link or code"
            autoFocus
            className={field}
          />
        </div>
      </Sheet>
    </div>
  );
};
