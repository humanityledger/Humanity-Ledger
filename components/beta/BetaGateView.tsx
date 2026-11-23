'use client';
/**
 * /beta: joining the closed technical beta of private cUSDC payments (docs/beta/CUSDC_BETA.md).
 *
 * One question at a time: the signed-in wallet, the invitation code (four blocks, paste anywhere),
 * the technical beta notice (one box, not ticked in advance), then "Unlock cUSDC Beta". On success
 * the cached beta answer is dropped (lib/beta/cusdc-beta-client.ts) so cUSDC appears at the next
 * wallet refresh, and the page opens the chat. A member whose notice is out of date confirms the
 * new text here. The notice is not legal terms; the legal texts of Ledger Chat are unchanged.
 *
 * The wallet shown is the signed session's (/api/beta/cusdc/status), the one the server admits.
 * Logic: lib/beta/gate.ts.
 */
import React, { useCallback, useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { HLLogo } from '@/components/shared/HLLogo';
import { invalidateCusdcBeta } from '@/lib/beta/cusdc-beta-client';
import {
  EMPTY_BLOCKS, applyBlockInput, blocksToCode, gateStage, isCompleteCode, redeemErrorView, shortAddress,
  type Blocks, type GateStatus,
} from '@/lib/beta/gate';
import { MAX_BETA_TESTERS } from '@/lib/beta/cusdc-beta';
import s from './BetaGateView.module.css';

const CONNECT = '/connect?redirect=%2Fbeta';
const STATUS_URL = '/api/beta/cusdc/status';
type Step = 'wallet' | 'code' | 'notice' | 'done';
const STEPS: Step[] = ['wallet', 'code', 'notice'];

const btn = 'w-full min-h-[52px] rounded-full text-[16px] font-semibold transition-colors disabled:cursor-default';
const primary = `${btn} bg-[#5200FF] text-white hover:bg-[#4300d1] disabled:bg-[#E4E7EC] disabled:text-[#667085]`;
const quiet = 'text-[14px] font-semibold text-[#5200FF] hover:underline';

function Check({ size = 20 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 20 20" aria-hidden>
      <circle cx="10" cy="10" r="10" fill="#10B981" />
      <path d="M5.5 10.5l3 3 6-6.5" fill="none" stroke="#fff" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

function CapacityBadge({ capacity, remaining }: { capacity?: number; remaining?: number | null }) {
  const total = capacity ?? MAX_BETA_TESTERS;
  const taken = typeof remaining === 'number' ? total - remaining : null;
  const pct = taken !== null ? Math.round((taken / total) * 100) : null;

  return (
    <div className="flex items-center gap-2.5 rounded-full border border-[#E4E7EC] bg-white pl-2.5 pr-3.5 py-1.5" data-testid="beta-capacity">
      {/* green pulse dot */}
      <span className="relative flex h-2 w-2 shrink-0">
        <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-[#10B981] opacity-60" />
        <span className="relative inline-flex rounded-full h-2 w-2 bg-[#10B981]" />
      </span>
      <span className="text-[12.5px] font-semibold text-[#15171C] whitespace-nowrap">
        Closed Beta
      </span>
      <span className="h-3.5 w-px bg-[#E4E7EC]" aria-hidden />
      <span className="text-[12px] text-[#667085] whitespace-nowrap tabular-nums">
        {total} spots
        {typeof remaining === 'number' && (
          <> &nbsp;·&nbsp; <span className="text-[#5200FF] font-medium">{remaining} left</span></>
        )}
      </span>
      {pct !== null && (
        <>
          <span className="h-3.5 w-px bg-[#E4E7EC]" aria-hidden />
          <span className="relative h-1.5 w-14 overflow-hidden rounded-full bg-[#F2F4F7]">
            <span
              className="absolute inset-y-0 left-0 rounded-full bg-[#5200FF] transition-all duration-700"
              style={{ width: `${pct}%` }}
            />
          </span>
        </>
      )}
    </div>
  );
}

export default function BetaGateView() {
  const router = useRouter();
  const [status, setStatus] = useState<GateStatus | null>(null);
  const [signedOut, setSignedOut] = useState(false);
  const [failed, setFailed] = useState(false);
  const [step, setStep] = useState<Step>('wallet');
  const [blocks, setBlocks] = useState<Blocks>(EMPTY_BLOCKS);
  const [agreed, setAgreed] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
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
  useEffect(() => { heading.current?.focus(); }, [step]);
  useEffect(() => { if (step === 'code') inputs.current[0]?.focus(); }, [step]);

  const stage = gateStage(status, { signedOut, failed });

  const finish = () => {
    invalidateCusdcBeta();
    setStep('done');
    window.setTimeout(() => router.push('/chat'), 2200);
  };

  const unlock = async () => {
    if (!status || busy || !agreed || !isCompleteCode(blocks)) return;
    setBusy(true);
    setError(null);
    let res: Response | null = null;
    let body: unknown = null;
    try {
      res = await fetch('/api/beta/cusdc/redeem', {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ code: blocksToCode(blocks), notice: true, noticeVersion: status.notice.version }),
      });
      body = await res.json().catch(() => null);
    } catch {
      res = null;
    }
    setBusy(false);
    if (res?.ok) return finish();
    const view = redeemErrorView(res ? res.status : null, body);
    setError(view.text);
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
      if (r.ok) { invalidateCusdcBeta(); await load(); setAgreed(false); }
      else setError(redeemErrorView(r.status, data).text);
    } catch {
      setError(redeemErrorView(null, null).text);
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
    if (e.key === 'Backspace' && !blocks[i] && i > 0) inputs.current[i - 1]?.focus();
    if (e.key === 'Enter' && isCompleteCode(blocks)) setStep('notice');
  };

  const progress = step === 'done' ? 1 : (STEPS.indexOf(step) + 1) / (STEPS.length + 1);

  let body: React.ReactNode;
  if (stage === 'loading') {
    body = <p className="text-[15px] text-[#475467]">Checking your access…</p>;
  } else if (stage === 'signedOut') {
    body = (
      <Question n={1} title="Connect your wallet" sub="To join the beta you need to sign in with the Ethereum wallet that will hold your invitation. Your code is not used until the final step." headingRef={heading}>
        {error && <ErrorLine text={error} />}
        <Link href={CONNECT} className={`${primary} mt-6 flex items-center justify-center`}>Connect wallet</Link>
      </Question>
    );
  } else if (stage === 'unavailable') {
    body = (
      <Question title="Temporarily unavailable" sub="Nothing was changed. Check your connection and try again in a moment." headingRef={heading}>
        <button type="button" className={`${primary} mt-6`} onClick={() => { setFailed(false); void load(); }}>Try again</button>
      </Question>
    );
  } else if (stage === 'member' || step === 'done') {
    body = <Done onOpen={() => router.push('/chat')} redirecting={step === 'done'} />;
  } else if (stage === 'revoked') {
    body = <Question title="Your access was revoked" sub="Your cUSDC balance stays visible and you can still move your own funds out. New payments are disabled for this account." headingRef={heading} />;
  } else if (stage === 'waiting') {
    body = <Question title="You are in the beta" sub={status!.accessReasons[0] ?? 'cUSDC payments are paused for now.'} headingRef={heading} />;
  } else if (stage === 'closed') {
    body = <Question title="The beta is not open yet" sub={status!.reasons[0] ?? 'Invitations work once the beta opens.'} headingRef={heading} />;
  } else if (stage === 'full') {
    body = <Question title="The beta is full" sub="All 100 spots have been taken. Private payments in HLC on Aztec Alpha remain open to you." headingRef={heading} />;
  } else if (stage === 'notice') {
    body = (
      <Question title="The beta notice changed" sub="Read the updated version below and confirm it to keep your access." headingRef={heading}>
        <Notice status={status!} agreed={agreed} onAgree={setAgreed} />
        {error && <ErrorLine text={error} />}
        <button type="button" className={`${primary} mt-6`} disabled={!agreed || busy} onClick={confirmNotice}>{busy ? 'Saving…' : 'Confirm and continue'}</button>
      </Question>
    );
  } else if (step === 'wallet') {
    body = (
      <Question n={1} title="Your wallet" sub="Confirm the wallet you want to join the beta with. Your invitation code will be linked to this address." headingRef={heading}>
        <div className="mt-6 flex items-center gap-3 rounded-2xl border border-[#E4E7EC] bg-[#F7F8FA] px-4 py-3.5" data-testid="beta-wallet">
          <Check />
          <span className="font-mono text-[15px] text-[#15171C]" title={status?.wallet}>{shortAddress(status?.wallet)}</span>
          <span className="ml-auto text-[13px] font-medium text-[#10B981]">Connected</span>
        </div>
        <button type="button" className={`${primary} mt-6`} onClick={() => setStep('code')}>Continue</button>
      </Question>
    );
  } else if (step === 'code') {
    body = (
      <Question n={2} title="Your invitation code" sub="Enter the 16-character code you received from the owner. You can paste it into any box." headingRef={heading}>
        <div className="mt-6 flex items-center justify-between gap-1.5 sm:gap-2" role="group" aria-label="Invitation code">
          {blocks.map((b, i) => (
            <React.Fragment key={i}>
              {i > 0 && <span className="text-[20px] text-[#98A2B3]" aria-hidden>-</span>}
              <input
                ref={(el) => { inputs.current[i] = el; }}
                value={b}
                onChange={(e) => onBlock(i, e.target.value)}
                onPaste={(e) => { e.preventDefault(); onBlock(i, e.clipboardData.getData('text')); }}
                onKeyDown={(e) => onKey(i, e)}
                aria-label={`Code, part ${i + 1} of 4`}
                autoComplete="off"
                autoCapitalize="characters"
                autoCorrect="off"
                spellCheck={false}
                inputMode="text"
                maxLength={i === 0 ? 40 : 19}
                className="w-0 flex-1 min-w-0 h-14 rounded-2xl border-2 border-[#E4E7EC] bg-white text-center font-mono text-[18px] sm:text-[20px] uppercase tracking-[0.12em] text-[#15171C] outline-none focus:border-[#5200FF]"
              />
            </React.Fragment>
          ))}
        </div>
        {error && <ErrorLine text={error} />}
        <button type="button" className={`${primary} mt-6`} disabled={!isCompleteCode(blocks)} onClick={() => { setError(null); setStep('notice'); }}>Continue</button>
        <button type="button" className={`${quiet} mt-4 block mx-auto`} onClick={() => setStep('wallet')}>Back</button>
      </Question>
    );
  } else {
    body = (
      <Question n={3} title="Beta notice" sub="Read the terms of this closed technical test before you unlock your access." headingRef={heading}>
        <Notice status={status!} agreed={agreed} onAgree={setAgreed} />
        {error && <ErrorLine text={error} />}
        <button type="button" className={`${primary} mt-6`} disabled={!agreed || busy || !isCompleteCode(blocks)} onClick={unlock}>
          {busy ? 'Unlocking…' : 'Unlock beta access'}
        </button>
        <button type="button" className={`${quiet} mt-4 block mx-auto`} disabled={busy} onClick={() => setStep('code')}>Back</button>
      </Question>
    );
  }

  return (
    <main className="min-h-[100dvh] bg-[#F7F8FA] px-3 py-8 sm:py-14 text-[#15171C]" style={{ fontFamily: 'Inter, system-ui, sans-serif' }}>
      <div className="mx-auto w-full max-w-[520px]">
        {/* Header: logo + capacity badge */}
        <div className="flex items-center justify-between gap-3">
          <Link href="/chat" aria-label="Ledger Chat" className="flex items-center gap-2">
            <HLLogo variant="mark" theme="dark" size={28} />
            <span className="text-[16px] font-semibold tracking-[-0.01em] text-[#15171C]">Ledger Chat</span>
          </Link>
          <CapacityBadge capacity={status?.capacity} remaining={status?.remaining} />
        </div>

        {/* Info strip — what the beta is */}
        <div className="mt-4 rounded-2xl border border-[#E4E7EC] bg-white px-4 py-3.5 flex gap-3 items-start">
          <span className="mt-0.5 text-[18px]" aria-hidden>🔒</span>
          <div>
            <p className="text-[13.5px] font-semibold text-[#15171C]">Private payments beta</p>
            <p className="mt-0.5 text-[13px] leading-relaxed text-[#667085]">
              You are joining an exclusive closed beta. Once inside, you get early access to private cUSDC payments on Aztec Alpha — available only to the 100 invited participants, before any public launch.
            </p>
          </div>
        </div>

        {/* Step card */}
        <div className="mt-3 overflow-hidden rounded-[28px] border border-[#E4E7EC] bg-white shadow-[0_1px_2px_rgba(16,24,40,0.04)]">
          {stage === 'join' && step !== 'done' && (
            <div className="h-1 bg-[#F2F4F7]" aria-hidden>
              <div className={`h-full bg-[#5200FF] ${s.progressFill}`} style={{ width: `${progress * 100}%` }} />
            </div>
          )}
          <div key={`${stage}-${step}`} className={`p-6 sm:p-9 ${s.step}`}>{body}</div>
        </div>

        {/* Footer */}
        <p className="mt-4 px-2 text-center text-[12px] leading-relaxed text-[#98A2B3]">
          Ledger Chat · Closed technical beta on Aztec Alpha · No external audit · Not legal terms
        </p>
      </div>
    </main>
  );
}

function Question({ n, title, sub, headingRef, children }: { n?: number; title: string; sub?: string; headingRef: React.RefObject<HTMLHeadingElement | null>; children?: React.ReactNode }) {
  return (
    <section>
      {n !== undefined && <p className="text-[13px] font-semibold text-[#5200FF]">{n} of 3</p>}
      <h1 ref={headingRef} tabIndex={-1} className="mt-1 text-[24px] sm:text-[28px] font-semibold tracking-[-0.02em] outline-none">{title}</h1>
      {sub && <p className="mt-2 text-[15px] leading-relaxed text-[#475467]">{sub}</p>}
      {children}
    </section>
  );
}

function Notice({ status, agreed, onAgree }: { status: GateStatus; agreed: boolean; onAgree: (v: boolean) => void }) {
  return (
    <>
      <ul className="mt-5 max-h-[38vh] overflow-y-auto rounded-2xl border border-[#E4E7EC] bg-[#F7F8FA] py-3 pl-8 pr-4 text-[14px] leading-relaxed list-disc">
        {status.notice.text.map((line) => <li key={line} className="mt-1">{line}</li>)}
      </ul>
      <p className="mt-2 text-[12px] text-[#667085]">Technical notice {status.notice.version}.</p>
      <label className="mt-4 flex cursor-pointer items-start gap-3 text-[14.5px]">
        <input type="checkbox" checked={agreed} onChange={(e) => onAgree(e.target.checked)} className="mt-0.5 h-5 w-5 accent-[#5200FF]" />
        I have read the beta notice and I understand it.
      </label>
    </>
  );
}

function ErrorLine({ text }: { text: string }) {
  return <p role="alert" className="mt-4 rounded-2xl border border-[#FFD5D2] bg-[#FFF4F3] px-4 py-3 text-[14px] text-[#B42318]">{text}</p>;
}

function Done({ onOpen, redirecting }: { onOpen: () => void; redirecting: boolean }) {
  return (
    <section className="flex flex-col items-center text-center" aria-live="polite">
      <svg width="72" height="72" viewBox="0 0 72 72" className={s.successRing} aria-hidden>
        <circle cx="36" cy="36" r="36" fill="#10B981" />
        <path d="M23 37l9 9 17-19" fill="none" stroke="#fff" strokeWidth="5" strokeLinecap="round" strokeLinejoin="round" className={s.successCheck} />
      </svg>
      <h1 className="mt-5 text-[26px] font-semibold tracking-[-0.02em]">You are in the beta</h1>
      <p className="mt-2 text-[15px] leading-relaxed text-[#475467]">
        Welcome to the Ledger Chat closed beta. Your wallet now has access to private cUSDC payments on Aztec Alpha. Payments and requests work between beta members within the per-payment cap.
      </p>
      <button type="button" className={`${primary} mt-7`} onClick={onOpen}>{redirecting ? 'Opening Ledger Chat…' : 'Open Ledger Chat'}</button>
    </section>
  );
}
