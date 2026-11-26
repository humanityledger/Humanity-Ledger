'use client';
/**
 * G8 human verification center (Settings → Privacy). Shows, honestly, what
 * this account proves today and what it does not:
 *   L0 Invite        — someone you trust vouched for you (single-use link).
 *   L1 Device        — a passkey on real hardware, a person present.
 *   L2 Unique human  — Zero-Passport: community vouches + in-browser proof of a
 *                      long-lived account. No documents. Not live until the circuit is pinned.
 * Plus the privacy shield, the Requests list and the invite generator.
 */
import React, { useCallback, useEffect, useState } from 'react';
import { Check, Copy, Fingerprint, Link2, Lock, ShieldCheck, Ticket, UserCheck, UserX, Users } from 'lucide-react';
import { toast } from 'sonner';
import { useT } from '@/lib/i18n/client';
import { isPasskeySession } from '@/lib/g8/passkeyAccount';
import { acceptRequest, dismissRequest, listQuarantined, QUARANTINE_EVENT } from '@/lib/g8/quarantine';
import { createInviteLink } from '@/lib/g8/inviteClient';
import { G8Level } from '@/lib/g8/constants';

export function currentLevel(address: string | null | undefined): G8Level {
  return isPasskeySession(address) ? G8Level.Hardware : G8Level.Invite;
}

const short = (a: string) => `${a.slice(0, 6)}…${a.slice(-4)}`;

export function G8LevelBadge({ level, compact = false }: { level: G8Level; compact?: boolean }) {
  const t = useT();
  const label = [t('Invited'), t('Verified device'), t('Unique human')][level];
  const tone = ['bg-[#eff1f4] text-[#3b404a]', 'bg-[#e8f1ff] text-[#1f5fd6]', 'bg-[#e6f6ec] text-[#167a3e]'][level];
  return (
    <span className={`inline-flex items-center gap-1 rounded-full font-semibold ${compact ? 'px-1.5 py-0.5 text-[11px]' : 'px-2.5 py-1 text-[12px]'} ${tone}`} title={label}>
      {level === G8Level.UniqueHuman ? <ShieldCheck size={compact ? 11 : 13} aria-hidden="true" /> : level === G8Level.Hardware ? <Fingerprint size={compact ? 11 : 13} aria-hidden="true" /> : <Ticket size={compact ? 11 : 13} aria-hidden="true" />}
      {label}
    </span>
  );
}

function Step({ n, active, done, soon, icon, title, body, limit }: { n: number; active: boolean; done: boolean; soon?: boolean; icon: React.ReactNode; title: string; body: string; limit: string }) {
  const t = useT();
  return (
    <li className="relative flex gap-3.5 pb-5 last:pb-0">
      <span aria-hidden="true" className="absolute left-[19px] top-10 bottom-0 w-px bg-[#e6e8ec] last:hidden" />
      <span className={`relative z-10 w-10 h-10 rounded-2xl flex items-center justify-center shrink-0 transition-colors ${active ? 'bg-[#15171c] text-white shadow-[0_6px_18px_-6px_rgba(21,23,28,.55)]' : done ? 'bg-[#e6f6ec] text-[#167a3e]' : 'bg-[#f2f3f5] text-[#9aa1ad]'}`}>
        {done && !active ? <Check size={18} /> : icon}
      </span>
      <div className="min-w-0 flex-1 pt-0.5">
        <div className="flex items-center gap-2 flex-wrap">
          <p className="text-[15px] font-semibold text-[#15171c]">{t('Level {n}', { n })} · {title}</p>
          {active && <span className="text-[11px] font-semibold uppercase tracking-wide text-[#1f5fd6]">{t('You are here')}</span>}
          {soon && <span className="text-[11px] font-semibold rounded-full bg-[#fff4e5] text-[#a35a00] px-2 py-0.5">{t('Not available yet')}</span>}
        </div>
        <p className="text-[13px] text-[#4a505c] mt-1 leading-snug">{body}</p>
        <p className="text-[12px] text-[#8a919c] mt-1 leading-snug">{limit}</p>
      </div>
    </li>
  );
}

export function HumanVerificationCenter({ address, shieldOn, onShield }: { address: string | null; shieldOn: boolean; onShield: (on: boolean) => void }) {
  const t = useT();
  const level = currentLevel(address);
  const [requests, setRequests] = useState<string[]>([]);
  const [link, setLink] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const refresh = useCallback(() => setRequests(address ? listQuarantined(address) : []), [address]);
  useEffect(() => {
    refresh();
    window.addEventListener(QUARANTINE_EVENT, refresh);
    return () => window.removeEventListener(QUARANTINE_EVENT, refresh);
  }, [refresh]);

  const makeInvite = async () => {
    if (!address || busy) return;
    setBusy(true);
    try {
      const l = await createInviteLink(address, window.location.origin);
      setLink(l);
      if (typeof navigator.share === 'function' && window.matchMedia('(pointer: coarse)').matches) {
        await navigator.share({ title: 'Ledger Chat', text: t('Join me on Ledger Chat. This link works once.'), url: l }).catch(() => {});
      } else {
        await navigator.clipboard?.writeText(l).catch(() => {});
        toast.success(t('Invite link copied. It works once, for 7 days.'));
      }
    } catch (e) {
      toast.error((e as Error)?.message || t('The invite could not be signed.'));
    } finally { setBusy(false); }
  };

  return (
    <section aria-labelledby="g8-title" className="mb-6">
      <div className="relative overflow-hidden rounded-[22px] bg-[#0f1115] text-white p-5 mb-4">
        <svg aria-hidden="true" viewBox="0 0 200 200" className="absolute -right-10 -top-10 w-56 h-56 opacity-[.18]">
          {[90, 70, 50, 30].map((r, i) => <circle key={r} cx="100" cy="100" r={r} fill="none" stroke="white" strokeWidth={i === 3 ? 2 : 1} strokeDasharray={i % 2 ? '3 5' : undefined} />)}
        </svg>
        <div className="relative">
          <p className="text-[12px] font-semibold uppercase tracking-[.14em] text-white/60">{t('Protocol G8 · ZK-SP')}</p>
          <h2 id="g8-title" className="text-[21px] font-semibold mt-1 leading-tight">{t('One person, one voice')}</h2>
          <p className="text-[13.5px] text-white/75 mt-2 leading-snug max-w-[440px]">{t('Prove you are a real person without revealing who you are. Each app sees a different anonymous tag, so nobody can follow you across services. With Level 2, a blocked person cannot simply come back with a new account.')}</p>
          <div className="mt-3"><G8LevelBadge level={level} /></div>
        </div>
      </div>

      <div className="bg-white rounded-2xl border border-[#e6e8ec] p-5 mb-4">
        <ol className="list-none m-0 p-0">
          <Step n={0} active={level === 0} done={level > 0} icon={<Ticket size={18} />} title={t('Invited')} body={t('A person you know vouches for you with a one-time link.')} limit={t('Proves trust, not uniqueness.')} />
          <Step n={1} active={level === 1} done={false} icon={<Fingerprint size={18} />} title={t('Verified device')} body={t('Your account lives in a passkey on your phone or computer — Face ID, Touch ID or Windows Hello. No wallet, no seed phrase.')} limit={t('Proves a real device and a person present. One person can still hold several passkeys.')} />
          <Step n={2} active={false} done={false} soon icon={<ShieldCheck size={18} />} title={t('Unique human')} body={t('Built on vouches from people already in Ledger Chat and an in-browser cryptographic proof that you have had an account for years. No passport, no ID card, no documents.')} limit={t('Strong protection against bots and mass sign-ups, not a government-grade guarantee. It stays off until its circuit is published and reviewed. Nothing here is simulated.')} />
        </ol>
      </div>

      <div className="bg-white rounded-2xl border border-[#e6e8ec] px-4 mb-2">
        <div role="button" tabIndex={0} onClick={() => onShield(!shieldOn)} onKeyDown={e => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); onShield(!shieldOn); } }} className="flex items-center gap-3 py-3 cursor-pointer select-none">
          <span className="w-9 h-9 rounded-xl flex items-center justify-center bg-[#eff1f4] text-[#15171c] shrink-0" aria-hidden="true"><Lock size={17} /></span>
          <div className="flex-1 min-w-0">
            <p className="text-[15px] font-medium text-[#15171c] leading-tight">{t('Privacy shield')}</p>
            <p className="text-[13px] text-[#727a88] mt-0.5 leading-snug">{t('People you have never talked to wait in Requests: their calls do not ring and their messages do not alert you until you accept.')}</p>
          </div>
          <span role="switch" aria-checked={shieldOn} aria-label={t('Privacy shield')} className={`relative w-[46px] h-[28px] rounded-full transition-colors shrink-0 ${shieldOn ? 'bg-[#15171c]' : 'bg-[#d5d9e0]'}`}>
            <span className={`absolute top-[3px] left-[3px] w-[22px] h-[22px] bg-white rounded-full shadow-sm transition-transform ${shieldOn ? 'translate-x-[18px]' : ''}`} />
          </span>
        </div>
      </div>
      <p className="text-[12.5px] text-[#727a88] px-1 mb-4 leading-relaxed">{t('Your contacts and people who used your invite always reach you. Blocking stays separate and stronger.')}</p>

      <div className="bg-white rounded-2xl border border-[#e6e8ec] p-4 mb-4">
        <div className="flex items-center gap-2 mb-2">
          <Users size={16} aria-hidden="true" />
          <p className="text-[13px] font-semibold text-[#15171c]">{t('Requests')}</p>
          {requests.length > 0 && <span className="ml-auto bg-[#15171c] text-white text-[12px] font-semibold rounded-full px-2 py-0.5">{requests.length}</span>}
        </div>
        {requests.length === 0 ? (
          <p className="text-[13px] text-[#727a88]">{shieldOn ? t('No one is waiting.') : t('Turn on the privacy shield to hold first messages from strangers here.')}</p>
        ) : (
          <ul className="list-none m-0 p-0">
            {requests.map(p => (
              <li key={p} className="flex items-center gap-2 py-2 border-b border-[#f0f1f4] last:border-0">
                <span className="font-mono text-[13px] text-[#15171c] flex-1 truncate">{short(p)}</span>
                <button type="button" onClick={() => { acceptRequest(address!, p); toast.success(t('Accepted. Their calls and messages now reach you normally.')); }} className="min-h-[36px] px-3 rounded-lg bg-[#15171c] text-white text-[13px] font-semibold inline-flex items-center gap-1"><UserCheck size={14} />{t('Accept')}</button>
                <button type="button" onClick={() => dismissRequest(address!, p)} className="min-h-[36px] px-3 rounded-lg bg-[#f2f3f5] text-[#15171c] text-[13px] font-semibold inline-flex items-center gap-1"><UserX size={14} />{t('Dismiss')}</button>
              </li>
            ))}
          </ul>
        )}
      </div>

      <div className="bg-white rounded-2xl border border-[#e6e8ec] p-4">
        <div className="flex items-center gap-2 mb-1">
          <Link2 size={16} aria-hidden="true" />
          <p className="text-[13px] font-semibold text-[#15171c]">{t('Invite someone')}</p>
        </div>
        <p className="text-[13px] text-[#727a88] mb-3 leading-snug">{t('A signed link that works once, for 7 days. Whoever uses it reaches you even with the shield on.')}</p>
        <button type="button" onClick={makeInvite} disabled={!address || busy} className="w-full min-h-[44px] rounded-xl bg-[#15171c] text-white text-[14px] font-semibold disabled:opacity-50">
          {busy ? t('Waiting for your signature…') : t('Create a one-time invite')}
        </button>
        {link && (
          <button type="button" onClick={() => navigator.clipboard?.writeText(link).then(() => toast.success(t('Copied')), () => {})} className="mt-2 w-full flex items-center gap-2 rounded-xl border border-[#e6e8ec] px-3 py-2 text-left">
            <span className="font-mono text-[12px] text-[#4a505c] truncate flex-1">{link}</span>
            <Copy size={14} aria-hidden="true" />
          </button>
        )}
      </div>
    </section>
  );
}
