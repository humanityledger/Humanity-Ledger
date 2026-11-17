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
import s from './PaymentProgress.module.css';

import { AT, creationSteps, stepStates, type CreationPhase, type StepKey } from './walletCreationSteps';

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

  return (
    <div className="bg-white rounded-2xl border border-black/[0.06] px-5 pt-4 pb-5" aria-live="polite">
      <div className="text-[16px] font-semibold" style={{ color: INK }}>{title}</div>
      <p className={`mt-1.5 text-[13.5px] leading-relaxed break-words ${failed ? 'text-[#b42318]' : 'text-[#475061]'}`} role={failed ? 'alert' : undefined}>
        {failed && <AlertTriangle size={14} className="inline -mt-0.5 mr-1.5" aria-hidden />}
        {sentence}
      </p>
      {failed && p.errorDetail && (
        <button type="button" className="mt-1 text-[13px] font-medium underline" style={{ color: INK }} onClick={() => p.onCopyDetails?.(p.errorDetail!)}>
          Copy details
        </button>
      )}

      {!p.blocked && (
        <ol className={`${s.steps} mt-3`} aria-label="Steps">
          {steps.map((st, i) => {
            const state = states[i];
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
      )}

      {p.children}

      {!working && !p.blocked && (
        <button
          type="button"
          onClick={p.onOpen}
          className="mt-4 w-full h-12 rounded-xl text-white text-[14.5px] font-semibold flex items-center justify-center gap-2"
          style={{ background: INK }}
        >
          {failed ? 'Try again' : 'Open private wallet'}
        </button>
      )}
    </div>
  );
}
