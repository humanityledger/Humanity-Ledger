'use client';
/**
 * Member profile and member list of a community.
 * Tap any avatar or name in a community → MemberSheet: avatar, name, @username, role, joined date,
 * and Message / Pay / Add to contacts / Copy wallet / Report. Admin actions (change role, remove)
 * appear only to someone who outranks the member (lib/communities/roles.ts); the server checks again.
 */
import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { toast } from 'sonner';
import { ArrowLeft, Copy, Flag, MessageCircle, Search, ShieldCheck, UserMinus, UserPlus, Wallet, X } from 'lucide-react';
import { useT } from '@/lib/i18n/client';
import { BodyPortal } from '@/components/chat/ui/BodyPortal';
import { UserAvatar } from '@/components/chat/UserAvatar';
import { ROLE_LABEL, ROLE_RANK, assignableRoles, canActOn, roleOf, type CommunityRole } from '@/lib/communities/roles';
import { saveLocalContact } from '@/lib/wallet/localAddressBook';

export interface MemberRow { walletAddress: string; role?: string; joinedAt?: string | number; name?: string | null; /** Ledger Chat's verified flag (User.isZkVerified), from the members API. */ isZkVerified?: boolean }
export interface CommunityPeople { communityId: string; ownerAddress?: string | null; members: MemberRow[] }

const short = (a: string) => `${a.slice(0, 6)}…${a.slice(-4)}`;
const ROLE_TONE: Record<CommunityRole, string> = {
  OWNER: 'bg-[#15171c] text-white', ADMIN: 'bg-[#e8f1ff] text-[#1f5fd6]', MODERATOR: 'bg-[#f1ecff] text-[#6b3fd1]', MEMBER: 'bg-[#f2f3f5] text-[#4a505c]',
};

export function RoleBadge({ role }: { role: CommunityRole }) {
  const t = useT();
  return <span className={`icon-btn inline-flex items-center gap-1 h-6 px-2 rounded-full text-[11.5px] font-semibold ${ROLE_TONE[role]}`}>{role !== 'MEMBER' && <ShieldCheck size={12} aria-hidden="true" />}{t(ROLE_LABEL[role])}</span>;
}

/** Loads the member list (members only; the server answers 404 to anyone else). */
export function useCommunityMembers(communityId: string, refreshKey = 0) {
  const [members, setMembers] = useState<MemberRow[] | null>(null);
  useEffect(() => {
    let alive = true;
    fetch(`/api/chat/communities/${encodeURIComponent(communityId)}/members`, { credentials: 'include', cache: 'no-store' })
      .then((r) => (r.ok ? r.json() : null)).then((d) => { if (alive) setMembers(Array.isArray(d?.members) ? d.members : []); })
      .catch(() => alive && setMembers([]));
    return () => { alive = false; };
  }, [communityId, refreshKey]);
  return members;
}

export function MemberSheet({ people, address, me, nameFor, onClose, onMessage, onPay, onChanged }: {
  people: CommunityPeople;
  address: string;
  me: string;
  nameFor?: (a: string) => string | undefined;
  onClose: () => void;
  onMessage?: (a: string) => void;
  onPay?: (a: string) => void;
  onChanged?: () => void;
}) {
  const t = useT();
  const a = address.toLowerCase();
  const row = people.members.find((m) => m.walletAddress?.toLowerCase() === a);
  const role = roleOf(a, people);
  const myRole = roleOf(me, people);
  const name = nameFor?.(a)?.trim() || row?.name?.trim() || short(a);
  const isMe = a === me.toLowerCase();
  const [busy, setBusy] = useState(false);
  const joined = row?.joinedAt ? new Date(row.joinedAt) : null;

  useEffect(() => {
    const k = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    window.addEventListener('keydown', k);
    return () => window.removeEventListener('keydown', k);
  }, [onClose]);

  const call = async (method: 'PATCH' | 'DELETE', body: object, ok: string) => {
    setBusy(true);
    try {
      const r = await fetch(`/api/chat/communities/${encodeURIComponent(people.communityId)}/members`, { method, credentials: 'include', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
      const d = await r.json().catch(() => ({}));
      if (!r.ok) { toast.error(d?.error || t('That did not work. Try again.')); return; }
      toast.success(ok); onChanged?.(); if (method === 'DELETE') onClose();
    } catch { toast.error(t('Could not reach the server. Try again.')); } finally { setBusy(false); }
  };

  const report = async () => {
    try {
      const r = await fetch('/api/moderation/report', { method: 'POST', credentials: 'include', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ messageHash: `member:${people.communityId}:${a}`, reason: 'Community member', reportedAddress: a }) });
      if (r.ok || r.status === 409) toast.success(t('Report sent. Thank you.')); else toast.error(t('Could not send the report.'));
    } catch { toast.error(t('Could not reach the server. Try again.')); }
  };

  const btn = 'flex flex-col items-center justify-center gap-1 min-h-[64px] rounded-2xl bg-[#f2f3f5] hover:bg-[#e8eaee] text-[#15171c] text-[12.5px] font-medium transition-colors disabled:opacity-40';
  return (
    <BodyPortal>
    <div className="lg-scrim fixed inset-0 z-[260000] flex items-end sm:items-center justify-center" role="dialog" aria-modal="true" aria-label={name} onClick={onClose}>
      <div className="w-full sm:max-w-[420px] max-h-[92dvh] overflow-y-auto lg-sheet rounded-t-[28px] sm:rounded-[28px] pb-[max(16px,env(safe-area-inset-bottom))]" onClick={(e) => e.stopPropagation()}>
        <div className="flex justify-between items-center px-3 pt-3">
          <span className="w-10 h-1 rounded-full bg-[#d5d9e0] mx-auto sm:hidden" aria-hidden="true" />
          <button type="button" onClick={onClose} className="icon-btn absolute right-3 top-3 w-10 h-10 grid place-items-center rounded-full hover:bg-[#f2f3f5]" aria-label={t('Close')}><X size={20} /></button>
        </div>
        <div className="flex flex-col items-center px-6 pt-3 pb-5 text-center">
          <UserAvatar address={a} size={96} />
          <h2 className="mt-3 text-[21px] font-semibold text-[#15171c] leading-tight break-words max-w-full">{name}{isMe ? ` (${t('You')})` : ''}</h2>
          <p className="text-[13px] text-[#727a88] font-mono mt-0.5">{short(a)}</p>
          <div className="flex items-center gap-2 mt-2.5 flex-wrap justify-center">
            {role && <RoleBadge role={role} />}
            {row?.isZkVerified === true && (
              <span className="icon-btn inline-flex items-center gap-1 h-6 px-2 rounded-full border border-[#157347] text-[11.5px] font-semibold text-[#157347]" title={t('Verified in Ledger Chat')}>
                <ShieldCheck size={12} aria-hidden="true" />{t('ZK verified')}
              </span>
            )}
            {joined && !Number.isNaN(joined.getTime()) && <span className="text-[12.5px] text-[#727a88]">{t('Joined {date}', { date: joined.toLocaleDateString([], { day: 'numeric', month: 'long', year: 'numeric' }) })}</span>}
          </div>
        </div>
        {!isMe && (
          <div className="grid grid-cols-4 gap-2 px-5">
            <button type="button" className={btn} onClick={() => { onMessage?.(a); onClose(); }} disabled={!onMessage}><MessageCircle size={19} />{t('Message')}</button>
            <button type="button" className={btn} onClick={() => { (onPay ?? onMessage)?.(a); onClose(); }} disabled={!onPay && !onMessage}><Wallet size={19} />{t('Pay')}</button>
            <button type="button" className={btn} onClick={() => { saveLocalContact(me.toLowerCase(), { peerAddress: a, name }); toast.success(t('Saved to your contacts')); }}><UserPlus size={19} />{t('Add')}</button>
            <button type="button" className={btn} onClick={() => { navigator.clipboard?.writeText(a).then(() => toast.success(t('Wallet copied')), () => {}); }}><Copy size={19} />{t('Copy')}</button>
          </div>
        )}
        {!isMe && (canActOn(myRole, role, 'promote') || canActOn(myRole, role, 'removeMember')) && (
          <div className="mx-5 mt-4 rounded-2xl border border-[#e6e8ec] p-3">
            <p className="text-[12px] font-semibold text-[#727a88] mb-2">{t('Admin actions')}</p>
            {canActOn(myRole, role, 'promote') && (
              <div className="flex flex-wrap gap-1.5 mb-2">
                {assignableRoles(myRole).map((r) => (
                  <button key={r} type="button" disabled={busy || r === role} onClick={() => void call('PATCH', { walletAddress: a, role: r }, t('Role changed to {role}', { role: t(ROLE_LABEL[r]) }))}
                    className={`icon-btn h-9 px-3 rounded-full text-[13px] font-medium border ${r === role ? 'bg-[#15171c] lg-ink text-white border-[#15171c]' : 'border-[#d5d9e0] text-[#15171c] hover:bg-[#f2f3f5]'} disabled:opacity-60`}>{t(ROLE_LABEL[r])}</button>
                ))}
              </div>
            )}
            {canActOn(myRole, role, 'removeMember') && (
              <button type="button" disabled={busy} onClick={() => { if (window.confirm(t('Remove {name} from this community? They will not see new posts.', { name }))) void call('DELETE', { walletAddress: a }, t('Member removed')); }}
                className="w-full min-h-[44px] rounded-xl text-[14px] font-semibold text-[#d93036] bg-[#fdecec] inline-flex items-center justify-center gap-2 disabled:opacity-60"><UserMinus size={17} />{t('Remove from community')}</button>
            )}
          </div>
        )}
        {!isMe && (
          <button type="button" onClick={() => void report()} className="mx-5 mt-3 w-[calc(100%-40px)] min-h-[44px] rounded-xl text-[14px] font-medium text-[#727a88] hover:bg-black/[0.04] inline-flex items-center justify-center gap-2"><Flag size={16} />{t('Report')}</button>
        )}
      </div>
    </div>
    </BodyPortal>
  );
}

export function MembersPanel({ people, me, nameFor, onOpen, onClose }: {
  people: CommunityPeople;
  me: string;
  nameFor?: (a: string) => string | undefined;
  onOpen: (address: string) => void;
  onClose: () => void;
}) {
  const t = useT();
  const [q, setQ] = useState('');
  const [filter, setFilter] = useState<'ALL' | CommunityRole>('ALL');
  const rows = useMemo(() => {
    const s = q.trim().toLowerCase();
    return people.members
      .map((m) => ({ ...m, a: m.walletAddress.toLowerCase(), r: roleOf(m.walletAddress, people) ?? 'MEMBER' as CommunityRole }))
      .map((m) => ({ ...m, n: nameFor?.(m.a)?.trim() || m.name?.trim() || short(m.a) }))
      .filter((m) => (filter === 'ALL' || m.r === filter) && (!s || m.n.toLowerCase().includes(s) || m.a.includes(s)))
      .sort((x, y) => ROLE_RANK[y.r] - ROLE_RANK[x.r] || x.n.localeCompare(y.n));
  }, [people, q, filter, nameFor]);
  const onKey = useCallback((e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); }, [onClose]);
  useEffect(() => { window.addEventListener('keydown', onKey); return () => window.removeEventListener('keydown', onKey); }, [onKey]);
  return (
    <BodyPortal>
    <div className="lg-scrim fixed inset-0 z-[260000] flex justify-end" role="dialog" aria-modal="true" aria-label={t('Members')} onClick={onClose}>
      <div className="lg-drawer w-full sm:max-w-[440px] h-[100dvh] flex flex-col" onClick={(e) => e.stopPropagation()}>
        <header className="border-b border-[#e6e8ec] pt-[max(8px,env(safe-area-inset-top))]">
          <div className="flex items-center gap-1 px-2 h-14">
            <button type="button" onClick={onClose} className="w-11 h-11 grid place-items-center rounded-full hover:bg-[#f2f3f5]" aria-label={t('Back')}><ArrowLeft size={20} /></button>
            <p className="text-[16px] font-semibold text-[#15171c]">{t('Members')} <span className="text-[#727a88] font-normal tabular-nums">{people.members.length}</span></p>
          </div>
          <label className="flex items-center gap-2 mx-3 mb-2 h-10 px-3 rounded-xl bg-[#f2f3f5] text-[#727a88]">
            <Search size={16} aria-hidden="true" />
            <input value={q} onChange={(e) => setQ(e.target.value)} placeholder={t('Search members')} className="flex-1 min-w-0 bg-transparent outline-none text-[15px] text-[#15171c] placeholder:text-[#8a919c]" />
          </label>
          <div className="flex gap-1.5 overflow-x-auto px-3 pb-2.5 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
            {(['ALL', 'OWNER', 'ADMIN', 'MODERATOR', 'MEMBER'] as const).map((r) => (
              <button key={r} type="button" onClick={() => setFilter(r)} className={`icon-btn shrink-0 h-8 px-3 rounded-full text-[13px] font-medium ${filter === r ? 'bg-[#15171c] lg-ink text-white' : 'bg-[#f2f3f5] text-[#3d424b]'}`}>{r === 'ALL' ? t('All') : t(ROLE_LABEL[r])}</button>
            ))}
          </div>
        </header>
        <ul className="flex-1 min-h-0 overflow-y-auto overscroll-contain list-none m-0 p-0 pb-[env(safe-area-inset-bottom)]">
          {rows.map((m) => (
            <li key={m.a}>
              <button type="button" onClick={() => onOpen(m.a)} className="w-full flex items-center gap-3 px-4 py-2.5 min-h-[60px] text-left hover:bg-black/[0.04]">
                <UserAvatar address={m.a} size={42} />
                <span className="min-w-0 flex-1">
                  <span className="block text-[15px] font-medium text-[#15171c] truncate">{m.n}{m.a === me.toLowerCase() ? ` (${t('You')})` : ''}</span>
                  <span className="block text-[12.5px] text-[#727a88] font-mono">{short(m.a)}</span>
                </span>
                {m.r !== 'MEMBER' && <RoleBadge role={m.r} />}
              </button>
            </li>
          ))}
          {rows.length === 0 && <li className="px-6 py-12 text-center text-[14px] text-[#727a88]">{t('No members match.')}</li>}
        </ul>
      </div>
    </div>
    </BodyPortal>
  );
}
