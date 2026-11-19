'use client';

/**
 * PaymentProgress: what a private payment is doing, from the tap to the block.
 *
 * One white card. A green ring fills as the payment moves through its real stages, read from the
 * wallet's own activity record (lib/aztec/wallet/history.ts), never simulated:
 *
 *   preparing  fee check and gas estimate (no activity entry yet)
 *   proving    the proof is being made on this device       (status 'proving')
 *   sending    the network has the transaction, waiting for a block (status 'pending', txHash)
 *   settled    included in an L2 block                     (status 'settled', blockNumber)
 *   failed     nothing was sent, or the network refused it  (status 'failed')
 *
 * The ring's fill is a fixed share per stage, with a slow creep inside a stage so it never looks
 * frozen; it reaches 100% only on 'settled'. Motion is transform, opacity and stroke-dashoffset
 * only, and stops under prefers-reduced-motion.
 */

import { FEE_PRIVACY } from '@/lib/landing/content';
import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Check, Copy, ExternalLink, X } from 'lucide-react';
import s from './PaymentProgress.module.css';

export type PaymentStage = 'preparing' | 'proving' | 'sending' | 'settled' | 'failed';

export interface PaymentProgressProps {
  stage: PaymentStage;
  amount: string;
  symbol: string;
  recipient: string;
  network: string;
  startedAt: number;
  txHash?: string;
  blockNumber?: number;
  error?: string;
  explorerUrl?: string;
  onDone: () => void;
  onRetry?: () => void;
}

const STAGES: { key: Exclude<PaymentStage, 'failed'>; label: string; note: string }[] = [
  { key: 'preparing', label: 'Checking the fee', note: 'Your Fee Juice and the gas this payment needs' },
  { key: 'proving', label: 'Making the proof on this device', note: 'Your keys and the amount never leave it' },
  { key: 'sending', label: 'Sent to Aztec', note: 'Waiting for the network to include it in a block' },
  { key: 'settled', label: 'Settled', note: 'Final on Aztec, secured by Ethereum' },
];

/** Share of the ring at the start and end of each stage. */
const SPAN: Record<Exclude<PaymentStage, 'failed'>, [number, number]> = {
  preparing: [0.04, 0.14],
  proving: [0.14, 0.7],
  sending: [0.7, 0.94],
  settled: [1, 1],
};
/** Typical seconds per stage, used only to pace the creep inside a stage. */
const TYPICAL: Record<Exclude<PaymentStage, 'failed'>, number> = { preparing: 6, proving: 40, sending: 30, settled: 1 };

/** Actionable copy when the node refused the payment for lack of Fee Juice. */
export function feeJuiceGuidance(error?: string): string | null {
  if (!error) return null;
  if (/fee juice|insufficient fee|fee payer/i.test(error)) {
    return 'This account needs more Fee Juice. Add it in the wallet — your Ethereum wallet bridges AZTEC — then try again. Nothing was sent.';
  }
  return null;
}

function short(addr: string) {
  return addr.length > 14 ? `${addr.slice(0, 8)}…${addr.slice(-6)}` : addr;
}

function elapsedLabel(ms: number) {
  const sec = Math.max(0, Math.floor(ms / 1000));
  return sec < 60 ? `${sec}s` : `${Math.floor(sec / 60)}m ${String(sec % 60).padStart(2, '0')}s`;
}

export function PaymentProgress(p: PaymentProgressProps) {
  const [now, setNow] = useState(() => Date.now());
  const [stageStart, setStageStart] = useState(() => Date.now());
  const [copied, setCopied] = useState(false);
  const liveStage = useRef<Exclude<PaymentStage, 'failed'>>('preparing');
  if (p.stage !== 'failed') liveStage.current = p.stage;

  useEffect(() => setStageStart(Date.now()), [p.stage]);
  useEffect(() => {
    if (p.stage === 'settled' || p.stage === 'failed') return;
    const t = setInterval(() => setNow(Date.now()), 250);
    return () => clearInterval(t);
  }, [p.stage]);

  const progress = useMemo(() => {
    if (p.stage === 'failed') return SPAN[liveStage.current][0];
    const [a, b] = SPAN[p.stage];
    if (a === b) return a;
    // Eases toward 90% of the stage's span; never reaches the next stage by time alone.
    const t = (now - stageStart) / 1000 / TYPICAL[p.stage];
    return a + (b - a) * 0.9 * (1 - Math.exp(-t));
  }, [p.stage, now, stageStart]);

  const R = 52;
  const C = 2 * Math.PI * R;
  const done = p.stage === 'settled';
  const failed = p.stage === 'failed';
  const activeIndex = STAGES.findIndex((x) => x.key === (failed ? liveStage.current : p.stage));
  const feeHint = failed ? feeJuiceGuidance(p.error) : null;

  const copy = async () => {
    if (!p.txHash) return;
    try {
      await navigator.clipboard.writeText(p.txHash);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {
      /* clipboard unavailable */
    }
  };

  const title = failed ? 'Payment not sent' : done ? 'Payment settled' : p.stage === 'sending' ? 'On its way' : 'Sending privately';

  return (
    <div className={`${s.card} ${failed ? s.cardFailed : ''}`} role="status" aria-live="polite">
      <div className={`${s.ringWrap} ${done ? s.done : ''} ${failed ? s.failed : ''}`}>
        <svg className={s.ring} viewBox="0 0 120 120" aria-hidden="true">
          <circle className={s.track} cx="60" cy="60" r={R} />
          <circle
            className={s.fill}
            cx="60"
            cy="60"
            r={R}
            strokeDasharray={C}
            strokeDashoffset={C * (1 - progress)}
          />
          {!done && !failed && <circle className={s.comet} cx="60" cy="60" r={R} strokeDasharray={`${C * 0.08} ${C}`} />}
        </svg>
        <span className={s.center}>
          {done ? (
            <svg className={s.check} viewBox="0 0 40 40" aria-hidden="true">
              <path d="M11 20.5l6.2 6.2L29.5 14" />
            </svg>
          ) : failed ? (
            <X size={30} strokeWidth={2.4} aria-hidden="true" />
          ) : (
            <span className={s.percent}>{Math.round(progress * 100)}%</span>
          )}
        </span>
        {done && <span className={s.burst} aria-hidden="true" />}
      </div>

      <p className={s.title}>{title}</p>
      <p className={s.amount}>
        {p.amount} <span>{p.symbol}</span>
      </p>
      <p className={s.sub}>
        {failed
          ? (feeHint || p.error || 'Nothing left your wallet.')
          : done
            ? `Included in L2 block ${p.blockNumber?.toLocaleString('en') ?? '…'}`
            : `${elapsedLabel(now - p.startedAt)} · keep this page open`}
      </p>
      {failed && feeHint && p.error && <p className={s.rawError}>{p.error}</p>}

      <ol className={s.steps}>
        {STAGES.map((st, i) => {
          const state = failed
            ? i < activeIndex
              ? 'done'
              : i === activeIndex
                ? 'bad'
                : 'todo'
            : done || i < activeIndex
              ? 'done'
              : i === activeIndex
                ? 'active'
                : 'todo';
          return (
            <li key={st.key} className={`${s.step} ${s[state]}`} aria-current={state === 'active' || state === 'bad' ? 'step' : undefined}>
              <span className={s.dot} aria-hidden="true">{state === 'done' && <Check size={12} strokeWidth={3} />}</span>
              <span className={s.stepText}>
                <span className={s.stepLabel}>{st.label}</span>
                <span className={s.stepNote}>{state === 'bad' ? 'Stopped here' : st.note}</span>
              </span>
            </li>
          );
        })}
      </ol>

      <dl className={s.facts}>
        <div><dt>To</dt><dd className={s.mono}>{short(p.recipient)}</dd></div>
        <div><dt>Network</dt><dd>{p.network}</dd></div>
        <div><dt>Visible on chain</dt><dd>{FEE_PRIVACY.onChain}</dd></div>
        <div><dt>Fee</dt><dd>Paid in Fee Juice; only the gas used is charged</dd></div>
        {p.txHash && (
          <div>
            <dt>Transaction</dt>
            <dd className={s.hashRow}>
              <span className={s.mono}>{short(p.txHash)}</span>
              <button type="button" onClick={copy} className={s.iconBtn} aria-label="Copy transaction hash">
                {copied ? <Check size={14} /> : <Copy size={14} />}
              </button>
              {p.explorerUrl && (
                <a href={p.explorerUrl} target="_blank" rel="noopener noreferrer" className={s.iconBtn} aria-label="Open in the explorer">
                  <ExternalLink size={14} />
                </a>
              )}
            </dd>
          </div>
        )}
      </dl>

      {(done || failed) && (
        <div className={s.actions}>
          {failed && p.onRetry && (
            <button type="button" className={s.secondary} onClick={p.onRetry}>Try again</button>
          )}
          <button type="button" className={s.primary} onClick={p.onDone}>Done</button>
        </div>
      )}
    </div>
  );
}

export default PaymentProgress;
