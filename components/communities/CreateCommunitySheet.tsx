'use client';
/**
 * Create a community in three steps: Basics → Who can join → Invite.
 * The creator's device makes the community's encrypted XMTP group first (our server stores only its
 * id and never the posts), then the server stores name, description and membership. If encrypted
 * messaging is still starting on this device, the sheet waits for it (up to 30 s) with a visible
 * status instead of failing. An optional welcome message is posted as the first encrypted post.
 * The last step shows the invite link and its QR code, ready to copy or share.
 */
import React, { useEffect, useMemo, useState } from 'react';
import { toast } from 'sonner';
import { ArrowLeft, Check, Copy, Globe, Lock, Share2, X } from 'lucide-react';
import { useT } from '@/lib/i18n/client';
import { WalletGlyph } from '@/components/chat/WalletGlyph';
import { BrandedQr } from '@/components/chat/profile/BrandedQr';
import { communityInviteUrl } from '@/lib/ui/format';

const MAX_NAME = 60;
const MAX_DESC = 280;
const MAX_WELCOME = 500;

/** A stable 10 × 10 mosaic for a community before it has an id: derived from its name. */
export function glyphSeedForName(name: string): string {
  let h1 = 0x811c9dc5, h2 = 0x01000193;
  for (const ch of name.trim().toLowerCase()) { const c = ch.codePointAt(0)!; h1 = Math.imul(h1 ^ c, 0x01000193) >>> 0; h2 = Math.imul(h2 ^ c, 0x5bd1e995) >>> 0; }
  return '0x' + (h1.toString(16).padStart(8, '0') + h2.toString(16).padStart(8, '0')).repeat(3).slice(0, 40);
}

/** Waits for a live XMTP client: present now, or within `timeoutMs`. */
export async function waitForClient(get: () => any, timeoutMs = 30_000, stepMs = 400): Promise<any | null> {
  const end = Date.now() + timeoutMs;
  for (;;) {
    const c = get();
    if (c?.conversations) return c;
    if (Date.now() >= end) return null;
    await new Promise((r) => setTimeout(r, stepMs));
  }
}

type Step = 'basics' | 'privacy' | 'creating' | 'done';

export function CreateCommunitySheet({ getClient, defaultPublic = false, onClose, onCreated, onOpen }: {
  /** The signed-in XMTP client, read each time (it may still be starting). */
  getClient: () => any;
  defaultPublic?: boolean;
  onClose: () => void;
  /** After the server stored it (refresh lists). */
  onCreated?: (id: string, isPrivate: boolean) => void;
  onOpen: (id: string) => void;
}) {
  const t = useT();
  const [step, setStep] = useState<Step>('basics');
  const [name, setName] = useState('');
  const [desc, setDesc] = useState('');
  const [isPrivate, setIsPrivate] = useState(!defaultPublic);
  const [welcome, setWelcome] = useState('');
  const [status, setStatus] = useState('');
  const [error, setError] = useState('');
  const [created, setCreated] = useState<{ id: string; joinCode?: string } | null>(null);
  const seed = useMemo(() => glyphSeedForName(name || 'community'), [name]);
  const link = created?.joinCode ? communityInviteUrl(created.joinCode) : null;

  useEffect(() => {
    const k = (e: KeyboardEvent) => { if (e.key === 'Escape' && step !== 'creating') onClose(); };
    window.addEventListener('keydown', k);
    return () => window.removeEventListener('keydown', k);
  }, [step, onClose]);

  const create = async () => {
    setStep('creating'); setError('');
    try {
      setStatus(t('Starting end-to-end encryption on this device…'));
      const client = await waitForClient(getClient);
      if (!client) throw new Error(t('Encrypted messaging did not start on this device. Check your connection and try again.'));
      setStatus(t('Creating the encrypted group…'));
      const { createCommunityGroup, postToGroup, invalidateCommunityMlsCache } = await import('@/lib/communities/mls');
      const groupId = await createCommunityGroup(client, name.trim());
      setStatus(t('Saving the community…'));
      const r = await fetch('/api/chat/communities', {
        method: 'POST', credentials: 'include', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: name.trim(), description: desc.trim(), isPrivate, mls: true, xmtpGroupId: groupId }),
      });
      const d = await r.json().catch(() => ({}));
      if (!r.ok || !d?.community?.id) throw new Error(d?.error || t('Could not create the community'));
      if (welcome.trim()) await postToGroup(client, groupId, welcome.trim()).catch(() => {});
      invalidateCommunityMlsCache();
      setCreated({ id: d.community.id, joinCode: d.community.joinCode });
      onCreated?.(d.community.id, isPrivate);
      setStep('done');
    } catch (e) {
      setError(e instanceof Error && e.message && !e.message.startsWith('[') ? t(e.message) : t('Could not create the community'));
      setStep('privacy');
    }
  };

  const share = async () => {
    if (!link) return;
    if (typeof navigator.share === 'function') { await navigator.share({ title: name, text: t('Join {name} on Ledger Chat', { name }), url: link }).catch(() => {}); return; }
    await navigator.clipboard?.writeText(link).then(() => toast.success(t('Invite link copied')), () => {});
  };

  const field = 'w-full px-4 py-3 rounded-2xl bg-[#f4f5f7] border border-transparent text-[16px] text-[#15171c] placeholder:text-[#8a919c] outline-none focus:bg-white focus:border-[#15171c] transition-colors';
  const primary = 'w-full min-h-[52px] rounded-2xl bg-[#15171c] text-white text-[16px] font-semibold disabled:opacity-40';
  const dots = ['basics', 'privacy', 'done'] as const;
  const at = step === 'creating' ? 1 : dots.indexOf(step as (typeof dots)[number]);

  return (
    <div className="fixed inset-0 z-[250] flex items-end sm:items-center justify-center bg-black/35" role="dialog" aria-modal="true" aria-label={t('New community')} onClick={() => step !== 'creating' && onClose()}>
      <div className="w-full sm:max-w-[460px] max-h-[94dvh] overflow-y-auto bg-white rounded-t-[28px] sm:rounded-[28px] shadow-[0_12px_40px_rgba(16,24,40,0.14)] pb-[max(18px,env(safe-area-inset-bottom))]" onClick={(e) => e.stopPropagation()}>
        <div className="sticky top-0 bg-white flex items-center gap-1 px-2 h-14 z-10">
          {step === 'privacy' ? <button type="button" onClick={() => setStep('basics')} className="w-11 h-11 grid place-items-center rounded-full hover:bg-[#f2f3f5]" aria-label={t('Back')}><ArrowLeft size={20} /></button> : <span className="w-11" />}
          <div className="flex-1 flex justify-center gap-1.5" aria-hidden="true">
            {dots.map((d, i) => <span key={d} className={`h-1.5 rounded-full transition-all ${i <= at ? 'w-6 bg-[#15171c]' : 'w-1.5 bg-[#d5d9e0]'}`} />)}
          </div>
          {step !== 'creating' ? <button type="button" onClick={onClose} className="w-11 h-11 grid place-items-center rounded-full hover:bg-[#f2f3f5]" aria-label={t('Close')}><X size={20} /></button> : <span className="w-11" />}
        </div>

        {step === 'basics' && (
          <div className="px-6 pb-2">
            <div className="flex flex-col items-center pt-1 pb-5">
              <WalletGlyph address={seed} size={84} />
              <h2 className="mt-3 text-[22px] font-semibold text-[#15171c]">{t('New community')}</h2>
              <p className="text-[14px] text-[#727a88] text-center mt-1 max-w-[320px]">{t('Posts are end-to-end encrypted. Only members can read them; our server never stores them.')}</p>
            </div>
            <label className="block text-[13px] font-semibold text-[#3d424b] mb-1.5" htmlFor="cc-name">{t('Name')}</label>
            <input id="cc-name" autoFocus value={name} maxLength={MAX_NAME} onChange={(e) => setName(e.target.value)} placeholder={t('e.g. Madrid builders')} className={field} />
            <p className="text-right text-[12px] text-[#8a919c] mt-1 tabular-nums">{name.length}/{MAX_NAME}</p>
            <label className="block text-[13px] font-semibold text-[#3d424b] mb-1.5" htmlFor="cc-desc">{t('Description')} <span className="font-normal text-[#8a919c]">({t('optional')})</span></label>
            <textarea id="cc-desc" value={desc} maxLength={MAX_DESC} rows={3} onChange={(e) => setDesc(e.target.value)} placeholder={t('What is this community about?')} className={`${field} resize-none`} />
            <button type="button" disabled={!name.trim()} onClick={() => setStep('privacy')} className={`${primary} mt-5`}>{t('Continue')}</button>
          </div>
        )}

        {(step === 'privacy' || step === 'creating') && (
          <div className="px-6 pb-2">
            <h2 className="text-[20px] font-semibold text-[#15171c] mb-3">{t('Who can join?')}</h2>
            {([
              { v: false, icon: Globe, title: t('Public'), body: t('Listed in Discover. Anyone with the link can join and read new posts.') },
              { v: true, icon: Lock, title: t('Private'), body: t('Not listed. Only people with your invite link can join.') },
            ] as const).map((o) => (
              <button key={String(o.v)} type="button" disabled={step === 'creating'} onClick={() => setIsPrivate(o.v)}
                className={`w-full flex items-start gap-3 text-left p-4 rounded-2xl border-2 mb-2.5 transition-colors ${isPrivate === o.v ? 'border-[#15171c] bg-[#fafafb]' : 'border-[#e6e8ec] hover:border-[#c9ced6]'}`}>
                <span className="w-10 h-10 rounded-xl bg-[#eff1f4] grid place-items-center shrink-0"><o.icon size={19} /></span>
                <span className="flex-1 min-w-0"><span className="block text-[15.5px] font-semibold text-[#15171c]">{o.title}</span><span className="block text-[13.5px] text-[#5b6270] leading-snug mt-0.5">{o.body}</span></span>
                <span className={`w-6 h-6 rounded-full border-2 grid place-items-center shrink-0 mt-2 ${isPrivate === o.v ? 'border-[#15171c] bg-[#15171c] text-white' : 'border-[#c9ced6]'}`}>{isPrivate === o.v && <Check size={14} strokeWidth={3} />}</span>
              </button>
            ))}
            <label className="block text-[13px] font-semibold text-[#3d424b] mt-3 mb-1.5" htmlFor="cc-welcome">{t('Welcome message')} <span className="font-normal text-[#8a919c]">({t('optional')})</span></label>
            <textarea id="cc-welcome" value={welcome} maxLength={MAX_WELCOME} rows={2} disabled={step === 'creating'} onChange={(e) => setWelcome(e.target.value)} placeholder={t('The first post new members will see')} className={`${field} resize-none`} />
            {error && <p className="mt-3 text-[13.5px] text-[#b42318]" role="alert">{error}</p>}
            {step === 'creating'
              ? <p className="mt-5 min-h-[52px] rounded-2xl bg-[#f4f5f7] flex items-center justify-center gap-2 text-[14.5px] text-[#15171c]" role="status" aria-live="polite">{status}</p>
              : <button type="button" onClick={() => void create()} className={`${primary} mt-5`}>{t('Create community')}</button>}
          </div>
        )}

        {step === 'done' && created && (
          <div className="px-6 pb-2 flex flex-col items-center text-center">
            <span className="w-14 h-14 rounded-full bg-[#e6f6ec] text-[#15803d] grid place-items-center mb-3"><Check size={28} strokeWidth={2.4} /></span>
            <h2 className="text-[22px] font-semibold text-[#15171c]">{t('{name} is ready', { name })}</h2>
            <p className="text-[14px] text-[#727a88] mt-1 mb-4">{t('Invite people with this link or QR code. You are the owner.')}</p>
            {link && (
              <>
                <div className="p-3 rounded-3xl bg-white border border-[#e6e8ec] shadow-sm"><BrandedQr value={link} title={t('Invite QR code')} style={{ width: 188, height: 188 }} /></div>
                <button type="button" onClick={() => navigator.clipboard?.writeText(link).then(() => toast.success(t('Invite link copied')), () => {})} className="mt-3 w-full flex items-center gap-2 rounded-2xl bg-[#f4f5f7] px-4 min-h-[48px] text-left">
                  <span className="flex-1 min-w-0 truncate font-mono text-[13px] text-[#3d424b]">{link}</span><Copy size={16} aria-hidden="true" />
                </button>
                <button type="button" onClick={() => void share()} className="mt-2 w-full min-h-[48px] rounded-2xl border border-[#d5d9e0] text-[15px] font-semibold text-[#15171c] inline-flex items-center justify-center gap-2"><Share2 size={17} />{t('Share invite')}</button>
              </>
            )}
            <button type="button" onClick={() => { onOpen(created.id); onClose(); }} className={`${primary} mt-3`}>{t('Open community')}</button>
          </div>
        )}
      </div>
    </div>
  );
}
