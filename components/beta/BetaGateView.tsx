'use client';
/**
 * /beta: joining the closed technical beta of private cUSDC payments (docs/beta/CUSDC_BETA.md).
 *
 * One card, three steps: the signed-in wallet, the invitation code (four blocks, paste anywhere),
 * the technical notice (one box, not ticked in advance), then "Unlock cUSDC Beta". On success the
 * cached beta answer is dropped (lib/beta/cusdc-beta-client.ts) so cUSDC appears at the next wallet
 * refresh, and the chat opens. A member who opens /beta goes straight to the chat; a member whose
 * notice changed confirms the new text here. The notice is not legal terms.
 *
 * The wallet shown is the signed session's (/api/beta/cusdc/status), the one the server admits.
 * Logic: lib/beta/gate.ts. Visual language (24 November 2026): the landing's corporate system in
 * glass: a frosted card over a cool wash with slow light fields, display serif for the title, ink for
 * the primary action, the corporate blue (#2754D6) for focus and links, green only for success.
 */
import React, { useCallback, useEffect, useRef, useState } from 'react';
import { allowAutoRedirect } from '@/lib/auth/session-check';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { HLLogo } from '@/components/shared/HLLogo';
import { invalidateCusdcBeta } from '@/lib/beta/cusdc-beta-client';
import {
  EMPTY_BLOCKS, applyBlockInput, blocksToCode, gateStage, isCompleteCode, redeemErrorView, shortAddress,
  type Blocks, type GateStatus,
} from '@/lib/beta/gate';
import s from './BetaGateView.module.css';
import { BetaRequestForm } from './BetaRequestForm';
import { useT } from '@/lib/i18n/client';

const CONNECT = '/connect?redirect=%2Fbeta';
const STATUS_URL = '/api/beta/cusdc/status';
type Step = 'wallet' | 'code' | 'notice' | 'done';
const STEPS: { key: Exclude<Step, 'done'>; label: string }[] = [
  { key: 'wallet', label: 'Wallet' },
  { key: 'code', label: 'Invitation' },
  { key: 'notice', label: 'Notice' },
];

const primary =
  'w-full h-[52px] rounded-[12px] bg-[linear-gradient(180deg,#24272f,#15171c)] text-white text-[15.5px] font-semibold tracking-[-0.01em] ' +
  'shadow-[0_1px_0_rgba(255,255,255,0.14)_inset,0_10px_24px_-12px_rgba(18,24,52,0.6)] transition-all duration-200 ' +
  'hover:-translate-y-[1px] hover:shadow-[0_1px_0_rgba(255,255,255,0.14)_inset,0_16px_32px_-14px_rgba(18,24,52,0.65)] ' +
  'active:translate-y-0 disabled:translate-y-0 disabled:bg-none disabled:bg-[#E4E7EC] disabled:text-[#98A2B3] disabled:shadow-none disabled:cursor-default ' +
  'focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-[#2754D6]/25';
const quiet = 'text-[13.5px] font-medium text-[#667085] hover:text-[#15171C] transition-colors';

export default function BetaGateView() {
  const t = useT();
  const router = useRouter();
  const [status, setStatus] = useState<GateStatus | null>(null);
  const [signedOut, setSignedOut] = useState(false);
  const [failed, setFailed] = useState(false);
  const [step, setStep] = useState<Step>('wallet');
  const [blocks, setBlocks] = useState<Blocks>(EMPTY_BLOCKS);
  const [agreed, setAgreed] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  // The request form for people without a code (components/beta/BetaRequestForm.tsx).
  const [asking, setAsking] = useState(false);
  const inputs = useRef<(HTMLInputElement | null)[]>([]);
  const heading = useRef<HTMLHeadingElement | null>(null);

  const load = useCallback(async () => {
    try {
      const r = await fetch(STATUS_URL, { credentials: 'include', cache: 'no-store' });
      if (r.status === 401) { setSignedOut(true); return; }
      if (!r.ok) { setFailed(true); return; }
      setFailed(false);
      setSignedOut(false);
      setStatus(await r.json());
    } catch {
      setFailed(true);
    }
  }, []);

  useEffect(() => { void load(); }, [load]);
  useEffect(() => { if (step !== 'wallet') heading.current?.focus(); }, [step]);
  useEffect(() => { if (step === 'code') inputs.current[blocks.findIndex((b) => b.length < 4) === -1 ? 3 : blocks.findIndex((b) => b.length < 4)]?.focus(); }, [step]); // eslint-disable-line react-hooks/exhaustive-deps

  const stage = gateStage(status, { signedOut, failed });

  // A member who opens /beta goes straight to the chat: nothing to do here.
  // Guarded by the shared loop breaker: if /chat keeps sending the member back here, show the
  // "Open Ledger Chat" button instead of bouncing between the two pages forever.
  useEffect(() => {
    if (stage !== 'member' || step === 'done') return;
    if (allowAutoRedirect()) router.replace('/chat');
    else setStep('done');
  }, [stage, step, router]);

  const finish = () => {
    invalidateCusdcBeta();
    setStep('done');
    window.setTimeout(() => router.push('/chat'), 2400);
  };

  // An invitation the operator reserved for this wallet joins without a code; otherwise a code is needed.
  const viaReserved = !!status?.reserved && !isCompleteCode(blocks);
  const canUnlock = viaReserved || isCompleteCode(blocks);

  const unlock = async () => {
    if (!status || busy || !agreed || !canUnlock) return;
    setBusy(true);
    setError(null);
    let res: Response | null = null;
    let body: unknown = null;
    try {
      res = await fetch('/api/beta/cusdc/redeem', {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(
          viaReserved
            ? { reserved: true, notice: true, noticeVersion: status.notice.version }
            : { code: blocksToCode(blocks), notice: true, noticeVersion: status.notice.version },
        ),
      });
      body = await res.json().catch(() => null);
    } catch {
      res = null;
    }
    setBusy(false);
    if (res?.ok) return finish();
    const view = redeemErrorView(res ? res.status : null, body);
    setError(t(view.text));
    if (view.step === 'wallet') setSignedOut(true);
    else if (view.step !== 'stay') setStep(view.step);
    if (res?.status === 409) void load();
  };

  const confirmNotice = async () => {
    if (!status || busy || !agreed) return;
    setBusy(true);
    setError(null);
    try {
      const r = await fetch(STATUS_URL, {
        method: 'POST', credentials: 'include', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ notice: true, noticeVersion: status.notice.version }),
      });
      const data = await r.json().catch(() => null);
      if (r.ok) { invalidateCusdcBeta(); setAgreed(false); await load(); }
      else setError(t(redeemErrorView(r.status, data).text));
    } catch {
      setError(t(redeemErrorView(null, null).text));
    } finally {
      setBusy(false);
    }
  };

  const onBlock = (i: number, value: string) => {
    const r = applyBlockInput(blocks, i, value);
    setBlocks(r.blocks);
    setError(null);
    inputs.current[r.focus]?.focus();
  };

  const onKey = (i: number, e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Backspace' && !blocks[i] && i > 0) { e.preventDefault(); inputs.current[i - 1]?.focus(); }
    if (e.key === 'ArrowLeft' && i > 0 && (e.currentTarget.selectionStart ?? 0) === 0) inputs.current[i - 1]?.focus();
    if (e.key === 'ArrowRight' && i < 3 && (e.currentTarget.selectionStart ?? 0) >= blocks[i].length) inputs.current[i + 1]?.focus();
    if (e.key === 'Enter' && isCompleteCode(blocks)) setStep('notice');
  };

  const capacity = status?.capacity ?? 100;
  const remaining = typeof status?.remaining === 'number' ? status.remaining : null;
  const joining = stage === 'join' && step !== 'done';
  const current = STEPS.findIndex((x) => x.key === step);

  let body: React.ReactNode;
  if (stage === 'loading' || (stage === 'member' && step !== 'done')) {
    body = <Skeleton label={stage === 'member' ? t("Opening Ledger Chat") : t("Checking your place in the beta")} />;
  } else if (step === 'done') {
    body = <Granted onOpen={() => router.push('/chat')} />;
  } else if (asking && (stage === 'signedOut' || stage === 'join')) {
    body = <BetaRequestForm wallet={status?.wallet} primaryClass={primary} quietClass={quiet} onBack={() => setAsking(false)} />;
  } else if (stage === 'signedOut') {
    body = (
      <Panel title={t("Connect your wallet")} text={t("The beta is tied to the Ethereum wallet you sign in with. Your invitation is not used until you unlock.")} headingRef={heading}>
        {error && <ErrorLine text={error} />}
        <Link href={CONNECT} className={`${primary} mt-7 flex items-center justify-center`}>{t("Connect wallet")}</Link>
        <button type="button" className={`${quiet} mt-5 block mx-auto`} onClick={() => setAsking(true)} data-testid="beta-ask">
          {t("I don't have a code yet")}
        </button>
      </Panel>
    );
  } else if (stage === 'unavailable') {
    body = (
      <Panel title={t("The beta is not reachable right now")} text={t("Nothing was changed. Check your connection and try again in a minute.")} headingRef={heading}>
        <button type="button" className={`${primary} mt-7`} onClick={() => { setFailed(false); void load(); }}>{t("Try again")}</button>
      </Panel>
    );
  } else if (stage === 'revoked') {
    body = <Panel title={t("Your access was revoked")} text={t("Your cUSDC balance stays visible and you can still move your own funds out. New cUSDC payments are off for this account.")} headingRef={heading} />;
  } else if (stage === 'waiting') {
    body = <Panel title={t("You are a member")} text={status!.accessReasons[0] ?? t("cUSDC payments are paused for now.")} headingRef={heading} />;
  } else if (stage === 'closed') {
    body = <Panel title={t("The beta is not open")} text={status!.reasons[0] ?? t("Invitations work once the beta opens.")} headingRef={heading} />;
  } else if (stage === 'full') {
    body = <Panel title={t("All places are taken")} text={t("The closed beta has reached its limit. Messages, calls and public tips keep working as before.")} headingRef={heading} />;
  } else if (stage === 'notice') {
    body = (
      <Panel title={t("The notice changed")} text={t("Read the new version and confirm it to keep using cUSDC.")} headingRef={heading}>
        <Notice status={status!} agreed={agreed} onAgree={setAgreed} />
        {error && <ErrorLine text={error} />}
        <button type="button" className={`${primary} mt-6`} disabled={!agreed || busy} onClick={confirmNotice}>{busy ? t("Saving") : t("Confirm the notice")}</button>
      </Panel>
    );
  } else if (step === 'wallet') {
    body = (
      <section>
        <div className="flex items-center gap-3.5 rounded-2xl border border-white/80 bg-white/60 backdrop-blur-md px-4 py-3.5" data-testid="beta-wallet">
          <span className="relative grid h-10 w-10 shrink-0 place-items-center rounded-full bg-white border border-slate-200/80" aria-hidden>
            <span className="h-4 w-4 rounded-full bg-gradient-to-br from-[#2754D6] to-[#8FA8F5]" />
          </span>
          <span className="min-w-0 flex-1">
            <span className="block text-[12px] font-medium text-[#667085]">{t("Signed in as")}</span>
            <span className="block font-mono text-[15px] tracking-[-0.01em] text-[#15171C]" title={status?.wallet}>{shortAddress(status?.wallet)}</span>
          </span>
          <span className="inline-flex items-center gap-1.5 rounded-full bg-[#ECFDF5] px-2.5 py-1 text-[12px] font-semibold text-[#047857]">
            {t("{0} Connected", { 0: <span className="h-1.5 w-1.5 rounded-full bg-[#10B981]" aria-hidden /> })}</span>
        </div>
        {status?.reserved && (
          <p className="mt-4 rounded-2xl border border-[#A7F3D0] bg-[#ECFDF5] px-4 py-3 text-[13.5px] text-[#065F46]" data-testid="beta-reserved">
            {t("A place is reserved for this wallet. You can join without a code.")}
          </p>
        )}
        <button type="button" className={`${primary} mt-6`} onClick={() => setStep(status?.reserved ? 'notice' : 'code')}>{t("Continue")}</button>
      </section>
    );
  } else if (step === 'code') {
    body = (
      <section>
        <h2 ref={heading} tabIndex={-1} className="text-[15px] font-semibold text-[#15171C] outline-none">{t("Your invitation code")}</h2>
        <p className="mt-1 text-[13.5px] text-[#667085]">{t("Sixteen characters. Paste it into any box.")}</p>
        <div className="mt-4 grid grid-cols-[1fr_auto_1fr_auto_1fr_auto_1fr] items-center gap-1.5 sm:gap-2" role="group" aria-label={t("Invitation code")}>
          {blocks.map((b, i) => (
            <React.Fragment key={i}>
              {i > 0 && <span className="h-px w-2 sm:w-2.5 bg-slate-300" aria-hidden />}
              <input
                ref={(el) => { inputs.current[i] = el; }}
                value={b}
                onChange={(e) => onBlock(i, e.target.value)}
                onPaste={(e) => { e.preventDefault(); onBlock(i, e.clipboardData.getData('text')); }}
                onKeyDown={(e) => onKey(i, e)}
                onFocus={(e) => e.currentTarget.select()}
                aria-label={t("Code, part {value} of 4", { value: i + 1 })}
                autoComplete="one-time-code"
                autoCapitalize="characters"
                autoCorrect="off"
                spellCheck={false}
                inputMode="text"
                maxLength={i === 0 ? 40 : 19}
                className="h-[58px] w-full min-w-0 rounded-[12px] border border-slate-200/90 bg-white/85 text-center font-mono text-[18px] sm:text-[20px] font-medium uppercase tracking-[0.14em] text-[#15171C] shadow-[0_1px_2px_rgba(15,23,42,0.04)] outline-none transition-[border-color,box-shadow] duration-150 placeholder:text-slate-300 focus:border-[#2754D6] focus:shadow-[0_0_0_4px_rgba(39,84,214,0.14)]"
                placeholder="····"
              />
            </React.Fragment>
          ))}
        </div>
        {error && <ErrorLine text={error} />}
        <button type="button" className={`${primary} mt-6`} disabled={!isCompleteCode(blocks)} onClick={() => { setError(null); setStep('notice'); }}>{t("Continue")}</button>
        <div className="mt-6 rounded-2xl border border-white/80 bg-white/60 backdrop-blur-md px-4 py-3.5" data-testid="beta-request">
          {status?.request === 'pending' ? (
            <p className="text-[13.5px] text-[#475467]">{requestNoteFor('pending')}</p>
          ) : (
            <>
              <p className="text-[14px] font-medium text-[#15171C]">{t("No code yet?")}</p>
              <p className="mt-0.5 text-[13.5px] text-[#667085]">{t("Ask for one and we will reply by email.")}</p>
              <button type="button" className={`${quiet} mt-2 !text-[#2754D6]`} onClick={() => setAsking(true)} data-testid="beta-ask">
                {t("Request an invitation")}
              </button>
            </>
          )}
        </div>
        <button type="button" className={`${quiet} mt-4 block mx-auto`} onClick={() => setStep('wallet')}>{t("Back")}</button>
      </section>
    );
  } else {
    body = (
      <section>
        <h2 ref={heading} tabIndex={-1} className="text-[15px] font-semibold text-[#15171C] outline-none">{t("Technical notice")}</h2>
        <p className="mt-1 text-[13.5px] text-[#667085]">{t("Real cUSDC, small caps, no independent audit yet.")}</p>
        <Notice status={status!} agreed={agreed} onAgree={setAgreed} />
        {error && <ErrorLine text={error} />}
        <button type="button" className={`${primary} mt-6`} disabled={!agreed || busy || !canUnlock} onClick={unlock}>
          {busy ? <span className="inline-flex items-center gap-2">{t("{0}Unlocking", { 0: <span className={s.spinner} aria-hidden /> })}</span> : t("Unlock cUSDC Beta")}
        </button>
        <button type="button" className={`${quiet} mt-4 block mx-auto`} disabled={busy} onClick={() => setStep(viaReserved ? 'wallet' : 'code')}>{t("Back")}</button>
      </section>
    );
  }

  return (
    <main className={`min-h-[100dvh] px-4 py-8 sm:py-16 text-[#15171C] antialiased ${s.stage}`} style={{ fontFamily: 'var(--font-inter), Inter, system-ui, -apple-system, sans-serif' }}>
      <span className={`${s.orb} ${s.orbA}`} aria-hidden />
      <span className={`${s.orb} ${s.orbB}`} aria-hidden />
      <span className={`${s.orb} ${s.orbC}`} aria-hidden />
      <div className="relative mx-auto flex w-full max-w-[480px] flex-col">
        <header className="flex items-center justify-between gap-3">
          <Link href="/chat" aria-label={t("Ledger Chat")} className="rounded-lg outline-none focus-visible:ring-4 focus-visible:ring-[#2754D6]/15">
            <HLLogo variant="full" theme="dark" size={24} label={t("Ledger Chat")} />
          </Link>
          <CapacityPill capacity={capacity} remaining={remaining} />
        </header>

        <div className={`mt-6 overflow-hidden ${s.glass}`}>
          {(joining || stage === 'signedOut') && (
            <div className="px-6 pt-7 sm:px-9 sm:pt-9">
              <p className={s.eyebrow}>{t("Private payments on Aztec Alpha")}</p>
              <h1 ref={joining && step === 'wallet' ? heading : undefined} tabIndex={-1} className={`mt-3 text-[38px] sm:text-[44px] leading-[1.02] outline-none ${s.display}`}>
                {t("Join the closed beta")}
              </h1>
              <p className="mt-2.5 text-[14.5px] leading-relaxed text-[#475467]">
                {t("Send and receive cUSDC privately in your chats. Every payment is proven on your device and settled on Aztec Alpha. Access is by invitation from the operator only.")}
              </p>
              {joining && !asking && <Stepper current={current} />}
            </div>
          )}
          <div key={`${stage}-${step}`} className={`px-6 pb-7 pt-6 sm:px-9 sm:pb-9 ${s.step}`}>{body}</div>
        </div>

        <footer className="mt-6 text-center text-[12.5px] text-[#667085]">
          {t("Ledger Chat · Aztec Alpha Privacy Layer")}
        </footer>
      </div>
    </main>
  );
}

function CapacityPill({ capacity, remaining }: { capacity: number; remaining: number | null }) {
  const t = useT();
  const taken = remaining === null ? null : Math.min(capacity, Math.max(0, capacity - remaining));
  return (
    <div
      className={`inline-flex h-8 shrink-0 items-center gap-2 whitespace-nowrap rounded-full pl-2.5 pr-3 ${s.glassSoft}`}
      data-testid="beta-capacity"
      aria-label={remaining === null ? t("Closed beta, {capacity} spots", { capacity }) : t("Closed beta, {remaining} of {capacity} spots left", { remaining, capacity })}
    >
      <span className={`relative h-1.5 w-1.5 shrink-0 rounded-full bg-[#10B981] ${s.pulse}`} aria-hidden />
      <span className="text-[12px] font-semibold tracking-[-0.005em] text-[#15171C]">{t("Closed Beta")}</span>
      <span className="h-3 w-px bg-slate-200" aria-hidden />
      <span className="text-[12px] tabular-nums text-[#667085]">
        {remaining === null ? t("{capacity} spots", { capacity }) : <>{t("{0} of {capacity} left", { 0: <span className="font-semibold text-[#15171C]">{remaining}</span>, capacity })}</>}
      </span>
      {taken !== null && (
        <span className="hidden h-1 w-10 overflow-hidden rounded-full bg-slate-100 sm:block" aria-hidden>
          <span className="block h-full rounded-full bg-[#2754D6]" style={{ width: `${Math.max(6, (taken / capacity) * 100)}%` }} />
        </span>
      )}
    </div>
  );
}

function Stepper({ current }: { current: number }) {
  const t = useT();
  return (
    <ol className="mt-6 grid grid-cols-3 gap-2" aria-label={t("Steps")}>
      {STEPS.map((x, i) => {
        const done = i < current;
        const active = i === current;
        return (
          <li key={x.key} aria-current={active ? 'step' : undefined}>
            <span className={`block h-[3px] rounded-full transition-colors duration-300 ${done ? 'bg-[#10B981]' : active ? 'bg-[#2754D6]' : 'bg-slate-200'}`} />
            <span className={`mt-2 block text-[12px] font-medium ${active ? 'text-[#15171C]' : done ? 'text-[#047857]' : 'text-[#98A2B3]'}`}>
              {i + 1}. {t(x.label)}
            </span>
          </li>
        );
      })}
    </ol>
  );
}

function Panel({ title, text, headingRef, children }: { title: string; text: string; headingRef: React.RefObject<HTMLHeadingElement | null>; children?: React.ReactNode }) {
  return (
    <section>
      <h2 ref={headingRef} tabIndex={-1} className={`text-[30px] leading-[1.08] outline-none ${s.display}`}>{title}</h2>
      <p className="mt-2 text-[14.5px] leading-relaxed text-[#475467]">{text}</p>
      {children}
    </section>
  );
}

function Notice({ status, agreed, onAgree }: { status: GateStatus; agreed: boolean; onAgree: (v: boolean) => void }) {
  const t = useT();
  return (
    <>
      <ul className="mt-4 max-h-[34vh] space-y-2 overflow-y-auto rounded-2xl border border-white/80 bg-white/60 backdrop-blur-md px-4 py-3.5 text-[13.5px] leading-relaxed text-[#344054]">
        {status.notice.text.map((line) => (
          <li key={line} className="flex gap-2.5"><span className="mt-[9px] h-1 w-1 shrink-0 rounded-full bg-[#98A2B3]" aria-hidden />{line}</li>
        ))}
      </ul>
      <p className="mt-2 text-[11.5px] text-[#98A2B3]">{t("Technical notice {version}. Not legal terms.", { version: status.notice.version })}</p>
      <label className="mt-4 flex cursor-pointer items-start gap-3 select-none">
        <input type="checkbox" checked={agreed} onChange={(e) => onAgree(e.target.checked)} className="peer sr-only" />
        <span
          className="mt-[1px] grid h-[20px] w-[20px] shrink-0 place-items-center rounded-[6px] border border-slate-300 bg-white transition-colors peer-checked:border-[#2754D6] peer-checked:bg-[#2754D6] peer-focus-visible:ring-4 peer-focus-visible:ring-[#2754D6]/20"
          aria-hidden
        >
          <svg width="12" height="12" viewBox="0 0 12 12" className={agreed ? 'opacity-100' : 'opacity-0'}>
            <path d="M2.5 6.2l2.3 2.3L9.5 3.8" fill="none" stroke="#fff" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        </span>
        <span className="text-[14px] leading-snug text-[#15171C]">{t("I have read the beta notice and I understand it.")}</span>
      </label>
    </>
  );
}

function ErrorLine({ text }: { text: string }) {
  return <p role="alert" className="mt-4 rounded-[14px] border border-[#FECDCA] bg-[#FFFBFA] px-4 py-3 text-[13.5px] leading-snug text-[#B42318]">{text}</p>;
}

function Skeleton({ label }: { label: string }) {
  return (
    <div className="py-6" role="status" aria-live="polite">
      <span className="sr-only">{label}</span>
      <div className={`h-5 w-2/3 rounded-md bg-slate-100 ${s.shimmer}`} />
      <div className={`mt-3 h-4 w-full rounded-md bg-slate-100 ${s.shimmer}`} />
      <div className={`mt-2 h-4 w-5/6 rounded-md bg-slate-100 ${s.shimmer}`} />
      <div className={`mt-7 h-[52px] w-full rounded-[14px] bg-slate-100 ${s.shimmer}`} />
    </div>
  );
}

function Granted({ onOpen }: { onOpen: () => void }) {
  const t = useT();
  return (
    <section className="flex flex-col items-center py-4 text-center" aria-live="polite">
      <div className={`relative grid h-[76px] w-[76px] place-items-center ${s.successRing}`}>
        <span className={`absolute inset-0 rounded-full bg-[#10B981]/15 ${s.halo}`} aria-hidden />
        <svg width="76" height="76" viewBox="0 0 76 76" aria-hidden>
          <circle cx="38" cy="38" r="30" fill="#10B981" />
          <path d="M26 39l8.5 8.5L51 31" fill="none" stroke="#fff" strokeWidth="4.5" strokeLinecap="round" strokeLinejoin="round" className={s.successCheck} />
        </svg>
      </div>
      <h1 className={`mt-5 text-[36px] leading-[1.05] ${s.display}`}>{t("Access granted")}</h1>
      <p className="mt-2 max-w-[340px] text-[14.5px] leading-relaxed text-[#475467]">
        {t("cUSDC is unlocked for this wallet. It appears in your private wallet at its next refresh.")}
      </p>
      <div className="mt-6 h-[3px] w-40 overflow-hidden rounded-full bg-slate-100" aria-hidden>
        <span className={`block h-full bg-[#2754D6] ${s.redirectBar}`} />
      </div>
      <button type="button" className={`${primary} mt-6`} onClick={onOpen}>{t("Open Ledger Chat")}</button>
    </section>
  );
}

/** What the page says about a request for a place, by its state. */
function requestNoteFor(state: string | undefined): string {
  if (state === 'approved') return 'Your request was approved. Go back and continue: you join without a code.';
  if (state === 'declined') return 'This request was not approved. You can still join with an invitation code.';
  return 'Request sent. If a place is approved for this wallet, open ledgerchat.org/beta with it again: you will join without a code.';
}
