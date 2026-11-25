'use client';

/**
 * components/zk/WalletCreation.tsx
 *
 * Opening the private wallet, in the same visual system as sending HLC: the
 * sheet's type and buttons, and the status rows of PaymentProgress (the same
 * CSS module). One action at a time: one sentence for where it is, one list of
 * steps that moves with the wallet's real phase, one button when there is
 * something to press. Nothing reads as done before the account exists.
 *
 * Phases come from lib/aztec/wallet/client.ts:
 *   idle → signing → starting → (Alpha, first time) needs-fee-juice → deploying → ready
 *   error at any step.
 * The unaudited warning stays above this card (AlphaInfoBox in ZkWalletPanel).
 */

import React, { useRef } from 'react';
import { AlertTriangle, Check } from 'lucide-react';

import { AT, creationSteps, stepStates, type CreationPhase, type StepKey } from './walletCreationSteps';
import { useT } from '@/lib/i18n/client';

const INK = '#15171c';

export type { CreationPhase };
export { creationSteps, stepStates };

export interface WalletCreationProps {
  phase: CreationPhase;
  /** The wallet's own sentence for what it is doing now. */
  step?: string;
  error?: string;
  errorDetail?: string;
  /** Why the wallet cannot be opened from here, in one sentence; null when it can. */
  blocked: string | null;
  alpha: boolean;
  networkName: string;
  /** A computer linked by QR: the phone approves the signature. */
  linkedComputer?: boolean;
  onOpen: () => void;
  onCopyDetails?: (detail: string) => void;
  /** Shown under the steps while the account waits for Fee Juice (the bridge). */
  children?: React.ReactNode;
}

export function WalletCreation(p: WalletCreationProps) {
  const t = useT();
  const steps = creationSteps(p.alpha, p.networkName, p.linkedComputer);
  // Where an error stopped it: the last step that was running.
  const last = useRef<StepKey | undefined>(undefined);
  if (AT[p.phase]) last.current = AT[p.phase];
  const failed = p.phase === 'error';
  const working = p.phase === 'signing' || p.phase === 'starting' || p.phase === 'deploying' || p.phase === 'needs-fee-juice';
  const states = stepStates(p.phase, steps, last.current);

  const title = failed ? 'Your private wallet did not open' : p.phase === 'needs-fee-juice' ? 'Add Fee Juice to create your account' : working ? 'Opening your private wallet' : 'Open your private wallet';

  let sentence: string;
  if (p.blocked) sentence = p.blocked;
  else if (failed) sentence = p.error || 'Something stopped the wallet. Nothing was sent.';
  else if (p.phase === 'needs-fee-juice') sentence = `Every transaction on ${p.networkName} pays its network fee in Fee Juice, including the one that creates your account. Bridge it below; the account is created when it arrives.`;
  else if (working) sentence = p.step || 'Working…';
  else if (p.linkedComputer) sentence = 'Your phone receives a request. Open Ledger Chat on your phone and tap Approve.';
  else sentence = 'Your wallet asks you to sign a message. It is free and sends no transaction. Some wallets label it “simulation failed”; that is expected for a signature.';

  const doneCount = states.filter((x) => x === 'done').length;
  const progress = steps.length ? Math.round((doneCount / steps.length) * 100) : 0;
  const idle = !failed && !working;

  return (
    <div className="rounded-[24px] border border-[#eef0f3] bg-white px-5 pt-6 pb-5" aria-live="polite">
      <h2 className="text-[22px] font-semibold tracking-[-0.025em] leading-tight" style={{ color: INK }}>{t(title)}</h2>
      <p className={`mt-2 text-[14.5px] leading-relaxed break-words ${failed ? 'text-[#b42318]' : 'text-[#5b606b]'}`} role={failed ? 'alert' : undefined}>
        {failed && <AlertTriangle size={15} className="inline -mt-0.5 mr-1.5" aria-hidden />}
        {t(sentence)}
      </p>
      {failed && p.errorDetail && (
        <button type="button" className="mt-1.5 text-[13.5px] font-medium underline underline-offset-2" style={{ color: INK }} onClick={() => p.onCopyDetails?.(p.errorDetail!)}>
          {t("Copy details")}
        </button>
      )}

      {idle && !p.blocked && (
        <p className="mt-4 flex flex-wrap items-center gap-x-2 gap-y-1 text-[13px] font-medium" style={{ color: INK }} aria-label={t("Before you start")}>
          <span>{t("Free to sign")}</span>
          <span className="text-[#c3c8d0]" aria-hidden="true">·</span>
          <span>{t("Keys stay on this device")}</span>
          <span className="text-[#c3c8d0]" aria-hidden="true">·</span>
          <span>{t("About a minute")}</span>
        </p>
      )}

      {!idle && !p.blocked && (
        <div className="mt-5 h-[3px] rounded-full bg-[#eef0f3] overflow-hidden" role="progressbar" aria-label={t("Opening progress")} aria-valuemin={0} aria-valuemax={100} aria-valuenow={progress}>
          <div
            className={`h-full rounded-full transition-[width] duration-500 ease-out motion-reduce:transition-none ${failed ? 'bg-[#d92d20]' : 'bg-[#0d0f14]'}`}
            style={{ width: `${Math.max(progress, 4)}%` }}
          />
        </div>
      )}

      {!p.blocked && (
        <ol className="mt-5" aria-label={t("Steps")}>
          {steps.map((st, i) => {
            const state = states[i];
            return (
              <li
                key={st.key}
                className="grid grid-cols-[28px_1fr] gap-3.5 py-3.5 border-t border-[#f0f1f4] first:border-t-0 first:pt-1"
                aria-current={state === 'active' || state === 'bad' ? 'step' : undefined}
              >
                <StepMark state={state} n={i + 1} />
                <span className="min-w-0">
                  <span className="block text-[15px] font-semibold tracking-[-0.01em]" style={{ color: state === 'todo' ? '#8a909c' : INK }}>{t(st.label)}</span>
                  <span className={`block mt-0.5 text-[13px] leading-snug ${state === 'bad' ? 'text-[#b42318]' : 'text-[#8a909c]'}`}>{state === 'bad' ? t("Stopped here") : t(st.note)}</span>
                </span>
              </li>
            );
          })}
        </ol>
      )}

      {p.children}

      {!working && !p.blocked && (
        <button
          type="button"
          onClick={p.onOpen}
          className="mt-4 w-full h-14 rounded-[18px] bg-[#0d0f14] hover:bg-[#2a2d34] text-white text-[16px] font-semibold tracking-[-0.01em] active:scale-[0.99] transition-[background-color,transform] focus:outline-none focus-visible:ring-[3px] focus-visible:ring-[#0d0f14]/25 focus-visible:ring-offset-1"
        >
          {failed ? t("Try again") : t("Open private wallet")}
        </button>
      )}
    </div>
  );
}

/** A step's mark: its number while waiting, a turning ring while running, a check when done, red when it stopped. */
function StepMark({ state, n }: { state: 'done' | 'active' | 'bad' | 'todo'; n: number }) {
  if (state === 'done') {
    return (
      <span className="w-7 h-7 rounded-full bg-[#0d0f14] text-white flex items-center justify-center" aria-hidden="true">
        <Check size={14} strokeWidth={2.6} />
      </span>
    );
  }
  if (state === 'active') {
    return <span className="w-7 h-7 rounded-full border-2 border-[#e6e8ec] border-t-[#0d0f14] animate-spin motion-reduce:animate-none" aria-hidden="true" />;
  }
  if (state === 'bad') {
    return (
      <span className="w-7 h-7 rounded-full bg-[#d92d20] text-white flex items-center justify-center text-[14px] font-bold" aria-hidden="true">!</span>
    );
  }
  return (
    <span className="w-7 h-7 rounded-full border border-[#e6e8ec] flex items-center justify-center text-[12.5px] font-semibold tabular-nums text-[#8a909c]" aria-hidden="true">
      {n}
    </span>
  );
}
