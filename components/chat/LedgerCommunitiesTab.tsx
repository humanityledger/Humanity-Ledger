'use client';
import React, { useCallback, useEffect, useState } from 'react';
import { communityInviteUrl, countLabel } from '@/lib/ui/format';
import { Copy, Link2, LogOut, MessageSquare, Settings2, Trash2 } from 'lucide-react';
import { ContextMenu, useContextMenuTrigger, type MenuAt, type MenuItem } from './ui/ContextMenu';
import { toast } from 'sonner';
import { SectionLabel, EmptyState, PrimaryButton, SecondaryButton, SearchField, Sheet, tintFor } from './ui/kit';
import { t, useT } from '@/lib/i18n/client';
import { CreateCommunitySheet } from '@/components/communities/CreateCommunitySheet';
import { getOpenXmtpClient } from '@/lib/xmtp/client';

interface Community {
  id: string;
  name: string;
  description: string;
  membersCount: number;
  isPrivate: boolean;
  createdAt: number;
  joinCode: string;
  myRole?: string;
  /** Legacy community, read-only (lib/communities/legacy.ts). */
  postsReadOnly?: boolean;
}

interface LedgerCommunitiesTabProps {
  myAddress: string;
  /** The XMTP client: with it a new community starts on MLS (its posts never reach our server). */
  xmtpClient?: any;
  onOpenCommunity: (id: string) => void;
  /** Opens the community straight on Manage (right click > Manage). */
  onManageCommunity?: (id: string) => void;
  /** Called after a community is deleted or left so the caller can clean up group-chat entries. */
  onCommunityRemoved?: (id: string) => void;
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
    toast.success(t(done));
  } catch {
    toast.error(t("Could not copy on this device."));
  }
}

/** Right click (long press on a phone) on a community: open it, manage it, copy its invite link or name. */
function rowMenu(c: Community, onOpen: () => void, onManage?: () => void, onLeave?: () => void, onDelete?: () => void): MenuItem[] {
  const items: MenuItem[] = [{ label: 'Open', icon: <MessageSquare size={16} strokeWidth={1.9} />, onSelect: onOpen }];
  if (onManage) items.push({ label: 'Manage', icon: <Settings2 size={16} strokeWidth={1.9} />, onSelect: onManage });
  const link = communityInviteUrl(c.joinCode);
  if (link) items.push({ label: 'Copy invite link', icon: <Link2 size={16} strokeWidth={1.9} />, onSelect: () => copyText(link, 'Invite link copied.') });
  items.push({ label: 'Copy name', icon: <Copy size={16} strokeWidth={1.9} />, onSelect: () => copyText(c.name, 'Name copied.') });
  // ── Danger zone ─────────────────────────────────────────────────────────────
  if (onLeave) items.push({ label: 'Leave community', icon: <LogOut size={16} strokeWidth={1.9} />, danger: true, onSelect: onLeave });
  if (onDelete) items.push({ label: 'Delete community', icon: <Trash2 size={16} strokeWidth={1.9} />, danger: true, onSelect: onDelete });
  return items;
}

function CommunityRow({ c, onOpen, onManage, onLeave, onDelete }: { c: Community; onOpen: () => void; onManage?: () => void; onLeave?: () => void; onDelete?: () => void }) {
  const t = useT();
  const members = c.membersCount || 1;
  const [menu, setMenu] = useState<MenuAt | null>(null);
  const { handlers, consumeLongPress } = useContextMenuTrigger(setMenu);
  return (
    <li>
      {menu && <ContextMenu at={menu} items={rowMenu(c, onOpen, onManage, onLeave, onDelete)} label={t("{name} actions", { name: c.name })} onClose={() => setMenu(null)} />}
      <button type="button" {...handlers} style={{ WebkitTouchCallout: 'none' }} onClick={() => { if (!consumeLongPress()) onOpen(); }} aria-label={t("Open {name}", { name: c.name })} className="w-full min-h-[72px] flex items-center gap-3.5 px-3 py-3 rounded-2xl hover:bg-[#f2f4f7] focus:outline-none focus-visible:ring-4 focus-visible:ring-[#15171c]/20 transition-colors text-left">
        <CommunityMark c={c} size={48} />
        <span className="flex-1 min-w-0">
          <span className="block text-[18px] font-semibold text-[#15171c] truncate">{c.name}</span>
          <span className="block text-[16px] text-[#3d424b] mt-0.5 tabular-nums leading-snug">
            {t(countLabel(members, 'member', 'members'))} · {c.isPrivate ? t("Private") : t("Public")}{c.myRole === 'ADMIN' ? t(" · You manage it") : c.myRole === 'MODERATOR' ? t(" · You moderate it") : ''}{c.postsReadOnly ? t(" · Read-only") : ''}
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

export const LedgerCommunitiesTab: React.FC<LedgerCommunitiesTabProps> = ({ myAddress, xmtpClient, onOpenCommunity, onManageCommunity, onCommunityRemoved }) => {
  const t = useT();
  const [communities, setCommunities] = useState<Community[]>([]);
  const [view, setView] = useState<'mine' | 'discover'>('mine');
  const [showCreate, setShowCreate] = useState(false);
  const [showJoin, setShowJoin] = useState(false);
  const [isPrivate, setIsPrivate] = useState(true);
  const [joinLink, setJoinLink] = useState('');
  const [loading, setLoading] = useState(true);
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

  /** Leave a community (member flow): DELETE /api/chat/communities/:id/members then also leave the XMTP group if present. */
  const handleLeave = useCallback(async (communityId: string) => {
    try {
      const res = await fetch(`/api/chat/communities/${communityId}/members`, {
        method: 'DELETE',
        credentials: 'include',
        headers: { 'x-web3-address': myAddress },
      });
      if (!res.ok) {
        const d = await res.json().catch(() => ({}));
        toast.error(d?.error || t("Could not leave. Try again."));
        return;
      }
      // Also leave the XMTP MLS group if the client is open.
      try {
        const client = xmtpClient ?? getOpenXmtpClient(myAddress);
        if (client) {
          const groups: any[] = await (client.conversations as any).listGroups?.() ?? [];
          const group: any = groups.find((g: any) => g.id === communityId || g.topic === communityId);
          if (group?.leave) await (group as any).leave();
        }
      } catch { /* XMTP leave is best-effort */ }
      toast.success(t("You left the community."));
      setCommunities(prev => prev.filter(c => c.id !== communityId));
      onCommunityRemoved?.(communityId);
    } catch {
      toast.error(t("Could not reach the server. Try again."));
    }
  }, [myAddress, xmtpClient, t, onCommunityRemoved]);

  /** Delete a community (owner/admin flow): DELETE /api/chat/communities/:id. */
  const handleDelete = useCallback(async (communityId: string) => {
    try {
      const res = await fetch(`/api/chat/communities/${communityId}`, {
        method: 'DELETE',
        credentials: 'include',
        headers: { 'x-web3-address': myAddress },
      });
      if (!res.ok) {
        const d = await res.json().catch(() => ({}));
        toast.error(d?.error || t("Could not delete. Try again."));
        return;
      }
      toast.success(t("Community deleted."));
      setCommunities(prev => prev.filter(c => c.id !== communityId));
      onCommunityRemoved?.(communityId);
    } catch {
      toast.error(t("Could not reach the server. Try again."));
    }
  }, [myAddress, t, onCommunityRemoved]);

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
        if (d?.status === 'PENDING_APPROVAL') {
          setJoinLink(''); setShowJoin(false);
          toast.success(t("Request sent to {name}. You can open it once an admin approves you.", { name: d?.community?.name ?? '' }));
          return;
        }
        const id: string | undefined = d?.community?.id;
        await fetchMine();
        setJoinLink(''); setShowJoin(false);
        // Joining opens the community you joined.
        if (id) onOpenCommunity(id);
        else toast.success(t("You joined the community"));
      } else {
        const d = await res.json().catch(() => ({}));
        toast.error(d.error || t("That invite did not work"));
      }
    } catch {
      toast.error(t("Could not reach the server. Try again."));
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
        <div className="flex p-1 bg-[#f2f4f7] rounded-xl" role="tablist" aria-label={t("Communities")}>
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
              {t("Join with an invite")}
            </SecondaryButton>
            <SecondaryButton onClick={() => setShowCreate(true)} className="flex-1 min-h-[48px] text-[17px]">
              {t("Start one")}
            </SecondaryButton>
          </div>
        ) : (
          <div className="mt-3"><SearchField value={search} onChange={setSearch} placeholder={t("Search public communities")} /></div>
        )}
      </div>

      {view === 'mine' ? (
        loading ? (
          <p className="flex-1 px-5 py-8 text-[18px] text-[#3d424b]" role="status">{t("Loading your communities…")}</p>
        ) : communities.length === 0 ? (
          <EmptyState
            title={t("You are not in a community yet")}
            text={t("If someone sent you an invite, tap Join with an invite. You can also start one for a team, a project or friends.")}
            action={<PrimaryButton onClick={() => setShowJoin(true)} className="min-h-[48px] text-[17px]">{t("Join with an invite")}</PrimaryButton>}
          />
        ) : (
          <ul className="px-2 py-2">
            {communities.map(c => {
              const isOwnerOrAdmin = c.myRole === 'ADMIN' || !c.myRole;
              return (
                <CommunityRow
                  key={c.id}
                  c={c}
                  onOpen={() => onOpenCommunity(c.id)}
                  onManage={onManageCommunity ? () => onManageCommunity(c.id) : undefined}
                  onLeave={!isOwnerOrAdmin ? () => handleLeave(c.id) : undefined}
                  onDelete={isOwnerOrAdmin ? () => handleDelete(c.id) : undefined}
                />
              );
            })}
          </ul>
        )
      ) : (
        <>
          <SectionLabel>{t("{length} public {value}", { length: visiblePublic.length, value: visiblePublic.length === 1 ? 'community' : 'communities' })}</SectionLabel>
          {visiblePublic.length === 0 ? (
            <EmptyState
              title={q ? t("No matches") : t("No public communities yet")}
              text={q ? t("Try another word.") : t("Public communities can be found and joined by anyone.")}
              action={!q ? <SecondaryButton onClick={() => { setIsPrivate(false); setShowCreate(true); }}>{t("Create a public one")}</SecondaryButton> : undefined}
            />
          ) : (
            <ul className="px-2 pb-3">
              {visiblePublic.map(c => <CommunityRow key={c.id} c={c} onOpen={() => onOpenCommunity(c.id)} />)}
            </ul>
          )}
        </>
      )}

      {showCreate && (
        <CreateCommunitySheet
          // The client is read each time: encrypted messaging may still be starting (the sheet waits).
          getClient={() => xmtpClient ?? getOpenXmtpClient(myAddress)}
          defaultPublic={!isPrivate}
          onClose={() => { setShowCreate(false); setIsPrivate(true); }}
          onCreated={(_id, priv) => { void fetchMine(); if (!priv) void fetchPublic(); }}
          onOpen={(id) => onOpenCommunity(id)}
        />
      )}

      <Sheet
        open={showJoin}
        onClose={() => setShowJoin(false)}
        title={t("Join a community")}
        subtitle={t("Paste the invite link or code you were sent")}
        footer={
          <div className="flex justify-end gap-2">
            <SecondaryButton onClick={() => setShowJoin(false)} className="min-h-[48px] text-[18px] px-5">{t("Cancel")}</SecondaryButton>
            <PrimaryButton onClick={join} disabled={!joinLink.trim() || joining} className="min-h-[48px] text-[18px] px-5">{joining ? t("Joining") : t("Join")}</PrimaryButton>
          </div>
        }
      >
        <div className="px-5 pb-4">
          <input
            value={joinLink}
            onChange={e => setJoinLink(e.target.value)}
            onKeyDown={e => { if (e.key === 'Enter') join(); }}
            placeholder={t("Invite link or code")}
            aria-label={t("Invite link or code")}
            autoFocus
            className={field}
          />
        </div>
      </Sheet>
    </div>
  );
};
