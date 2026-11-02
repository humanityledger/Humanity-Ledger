'use client';
import React, { useCallback, useEffect, useState } from 'react';
import { Plus, Link2, Users, Globe, Lock, ChevronRight, LoaderCircle } from 'lucide-react';
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
}

function CommunityMark({ c, size = 44 }: { c: Community; size?: number }) {
  const letters = c.name.trim().split(/\s+/).slice(0, 2).map(w => w[0]).join('').toUpperCase() || '#';
  return (
    <span
      className="rounded-[14px] flex items-center justify-center font-semibold shrink-0 select-none"
      style={{ width: size, height: size, fontSize: Math.round(size * 0.36), ...tintFor(Array.from(c.id).map(ch => ch.charCodeAt(0).toString(16)).join('').slice(0, 6)) }}
      aria-hidden="true"
    >
      {letters}
    </span>
  );
}

function CommunityRow({ c, onOpen }: { c: Community; onOpen: () => void }) {
  const members = c.membersCount || 1;
  return (
    <li>
      <button type="button" onClick={onOpen} className="w-full flex items-center gap-3 px-2 py-2.5 rounded-xl hover:bg-[#f7f8fa] transition-colors text-left">
        <CommunityMark c={c} />
        <span className="flex-1 min-w-0">
          <span className="flex items-center gap-1.5 min-w-0">
            <span className="text-[15.5px] font-medium text-[#15171c] truncate">{c.name}</span>
            {c.isPrivate
              ? <Lock size={12} strokeWidth={2} className="text-[#a3a9b4] shrink-0" aria-label="Private" />
              : <Globe size={12} strokeWidth={2} className="text-[#a3a9b4] shrink-0" aria-label="Public" />}
          </span>
          <span className="block text-[13.5px] text-[#727a88] truncate mt-0.5">
            {members} {members === 1 ? 'member' : 'members'}{c.myRole === 'ADMIN' ? ', you are an admin' : ''}{c.description ? `. ${c.description}` : ''}
          </span>
        </span>
        <ChevronRight size={16} strokeWidth={1.8} className="text-[#c9ced6] shrink-0" aria-hidden="true" />
      </button>
    </li>
  );
}

export const LedgerCommunitiesTab: React.FC<LedgerCommunitiesTabProps> = ({ myAddress, onOpenCommunity }) => {
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
        await fetchMine();
        if (!isPrivate) fetchPublic();
        setNewName(''); setNewDesc(''); setIsPrivate(true); setShowCreate(false);
        toast.success('Community created');
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
        await fetchMine();
        setJoinLink(''); setShowJoin(false);
        toast.success('You joined the community');
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
  const field = 'w-full px-3.5 py-2.5 rounded-xl bg-white border border-[#d9dde3] text-[15px] text-[#15171c] placeholder:text-[#a3a9b4] outline-none focus:border-[#15171c] focus:ring-2 focus:ring-[#15171c]/10';

  return (
    <div className="flex-1 overflow-y-auto flex flex-col bg-white">
      <div className="px-4 pt-3 pb-2 sticky top-0 bg-white z-10 border-b border-[#eceef2]">
        <div className="flex p-1 bg-[#f2f4f7] rounded-xl" role="tablist" aria-label="Communities">
          {([['mine', 'Yours'], ['discover', 'Public']] as const).map(([id, label]) => (
            <button
              key={id}
              type="button"
              role="tab"
              aria-selected={view === id}
              onClick={() => setView(id)}
              className={`flex-1 h-8 text-[14px] font-medium rounded-lg transition-colors ${view === id ? 'bg-white text-[#15171c] shadow-[0_1px_2px_rgba(16,24,40,0.08)]' : 'text-[#727a88] hover:text-[#15171c]'}`}
            >
              {label}
            </button>
          ))}
        </div>
        {view === 'mine' ? (
          <div className="flex gap-2 mt-3">
            <PrimaryButton onClick={() => setShowCreate(true)} className="flex-1 h-10 text-[14.5px]">
              <Plus size={17} strokeWidth={2} /> New community
            </PrimaryButton>
            <SecondaryButton onClick={() => setShowJoin(true)} className="h-10 text-[14.5px]">
              <Link2 size={17} strokeWidth={1.9} /> Join
            </SecondaryButton>
          </div>
        ) : (
          <div className="mt-3"><SearchField value={search} onChange={setSearch} placeholder="Search public communities" /></div>
        )}
      </div>

      {view === 'mine' ? (
        loading ? (
          <div className="flex-1 flex items-center justify-center py-16 text-[#a3a9b4]" role="status" aria-label="Loading">
            <LoaderCircle size={22} strokeWidth={1.8} className="animate-spin" />
          </div>
        ) : communities.length === 0 ? (
          <EmptyState
            icon={<Users size={20} strokeWidth={1.8} />}
            title="No communities yet"
            text="Create a space for a team, a project or friends, then invite people with a link."
            action={<PrimaryButton onClick={() => setShowCreate(true)}>New community</PrimaryButton>}
          />
        ) : (
          <ul className="px-2 py-2">
            {communities.map(c => <CommunityRow key={c.id} c={c} onOpen={() => onOpenCommunity(c.id)} />)}
          </ul>
        )
      ) : (
        <>
          <SectionLabel>{visiblePublic.length} public {visiblePublic.length === 1 ? 'community' : 'communities'}</SectionLabel>
          {visiblePublic.length === 0 ? (
            <EmptyState
              icon={<Globe size={20} strokeWidth={1.8} />}
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
        subtitle="You can change all of this later"
        footer={
          <div className="flex justify-end gap-2">
            <SecondaryButton onClick={() => setShowCreate(false)}>Cancel</SecondaryButton>
            <PrimaryButton onClick={create} disabled={!newName.trim() || creating}>{creating ? 'Creating' : 'Create'}</PrimaryButton>
          </div>
        }
      >
        <div className="px-5 pb-4 flex flex-col gap-4">
          <label className="flex flex-col gap-1.5">
            <span className="text-[13px] font-medium text-[#4a505c]">Name</span>
            <input value={newName} onChange={e => setNewName(e.target.value)} onKeyDown={e => { if (e.key === 'Enter') create(); }} placeholder="Design team" maxLength={64} autoFocus className={field} />
          </label>
          <label className="flex flex-col gap-1.5">
            <span className="text-[13px] font-medium text-[#4a505c]">Description <span className="text-[#a3a9b4] font-normal">(optional)</span></span>
            <textarea value={newDesc} onChange={e => setNewDesc(e.target.value)} placeholder="What is this community for?" maxLength={256} rows={3} className={`${field} resize-none`} />
          </label>
          <fieldset className="flex flex-col gap-2">
            <legend className="text-[13px] font-medium text-[#4a505c] mb-1.5">Who can join</legend>
            {([
              [true, Lock, 'Private', 'Only people with an invite link'],
              [false, Globe, 'Public', 'Anyone can find it and join'],
            ] as const).map(([priv, Icon, title, text]) => (
              <button
                key={title}
                type="button"
                role="radio"
                aria-checked={isPrivate === priv}
                onClick={() => setIsPrivate(priv)}
                className={`flex items-center gap-3 p-3 rounded-xl border text-left transition-colors ${isPrivate === priv ? 'border-[#15171c] bg-white' : 'border-[#e4e7ec] hover:bg-[#f7f8fa]'}`}
              >
                <span className="w-9 h-9 rounded-full bg-[#eff1f4] text-[#15171c] flex items-center justify-center shrink-0" aria-hidden="true"><Icon size={17} strokeWidth={1.8} /></span>
                <span className="flex-1">
                  <span className="block text-[15px] font-medium text-[#15171c]">{title}</span>
                  <span className="block text-[13px] text-[#727a88]">{text}</span>
                </span>
                <span className={`w-[18px] h-[18px] rounded-full border-2 ${isPrivate === priv ? 'border-[#15171c] bg-[radial-gradient(circle,#15171c_45%,transparent_50%)]' : 'border-[#c9ced6]'}`} aria-hidden="true" />
              </button>
            ))}
          </fieldset>
          <p className="text-[13px] text-[#727a88] leading-relaxed">Posts in communities are stored on our server so new members can read them. They are not end to end encrypted.</p>
        </div>
      </Sheet>

      <Sheet
        open={showJoin}
        onClose={() => setShowJoin(false)}
        title="Join a community"
        subtitle="Paste the invite link or code you were sent"
        footer={
          <div className="flex justify-end gap-2">
            <SecondaryButton onClick={() => setShowJoin(false)}>Cancel</SecondaryButton>
            <PrimaryButton onClick={join} disabled={!joinLink.trim() || joining}>{joining ? 'Joining' : 'Join'}</PrimaryButton>
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
