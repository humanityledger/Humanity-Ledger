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
import { AlertTriangle, Check, KeyRound, Lock, ShieldCheck, Timer } from 'lucide-react';
import s from './PaymentProgress.module.css';
import { NoteField, VAULT_BG } from './wallet/WalletUI';

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

  const doneCount = states.filter((x) => x === 'done').length;
  const progress = steps.length ? Math.round((doneCount / steps.length) * 100) : 0;
  const mood: 'idle' | 'working' | 'failed' = failed ? 'failed' : working ? 'working' : 'idle';

  return (
    <div className="rounded-[24px] overflow-hidden border border-[#E4E7EC] bg-white shadow-[0_1px_2px_rgba(16,24,40,0.04),0_24px_48px_-32px_rgba(16,24,40,0.45)]" aria-live="polite">
      {/* The vault: what is happening, in one title and one sentence, on the wallet's dark surface. */}
      <div className="relative px-5 pt-6 pb-5 text-white overflow-hidden" style={{ background: VAULT_BG }}>
        <NoteField at="100% 0%" opacity={0.14} />
        <div
          className="pointer-events-none absolute inset-0"
          style={{ background: failed ? 'radial-gradient(90% 70% at 100% 0%, rgba(229,72,77,0.35), rgba(229,72,77,0) 60%)' : 'radial-gradient(90% 70% at 100% 0%, rgba(98,64,255,0.42), rgba(98,64,255,0) 60%)' }}
          aria-hidden="true"
        />
        <div className="pointer-events-none absolute inset-x-6 top-0 h-px bg-gradient-to-r from-white/0 via-white/40 to-white/0" aria-hidden="true" />
        <div className="relative flex items-start gap-4">
          <VaultGlyph mood={mood} />
          <div className="min-w-0 flex-1">
            <div className="text-[19px] font-semibold tracking-[-0.015em] leading-snug">{title}</div>
            <p className={`mt-1.5 text-[13.5px] leading-relaxed break-words ${failed ? 'text-[#ffc9c4]' : 'text-white/[0.72]'}`} role={failed ? 'alert' : undefined}>
              {failed && <AlertTriangle size={14} className="inline -mt-0.5 mr-1.5" aria-hidden />}
              {sentence}
            </p>
          </div>
        </div>
        {mood === 'idle' && !p.blocked && (
          <ul className="relative mt-4 flex flex-wrap gap-1.5" aria-label="Before you start">
            <Fact icon={<Lock size={12} strokeWidth={2.2} />}>Free to sign</Fact>
            <Fact icon={<KeyRound size={12} strokeWidth={2.2} />}>Keys stay on this device</Fact>
            <Fact icon={<Timer size={12} strokeWidth={2.2} />}>About a minute</Fact>
          </ul>
        )}
        {mood !== 'idle' && !p.blocked && (
          <div className="relative mt-4 h-1 rounded-full bg-white/10 overflow-hidden" role="progressbar" aria-label="Opening progress" aria-valuemin={0} aria-valuemax={100} aria-valuenow={progress}>
            <div
              className={`h-full rounded-full transition-[width] duration-500 ease-out motion-reduce:transition-none ${failed ? 'bg-[#ff8a80]' : 'bg-gradient-to-r from-[#8b7bff] to-[#34d399]'}`}
              style={{ width: `${Math.max(progress, 6)}%` }}
            />
          </div>
        )}
      </div>

      <div className="px-5 pt-4 pb-5">
        {failed && p.errorDetail && (
          <button type="button" className="mb-2 text-[13px] font-medium underline underline-offset-2" style={{ color: INK }} onClick={() => p.onCopyDetails?.(p.errorDetail!)}>
            Copy details
          </button>
        )}

        {!p.blocked && (
          <ol className={s.steps} aria-label="Steps">
            {steps.map((st, i) => {
              const state = states[i];
              return (
                <li key={st.key} className={`${s.step} ${s[state]}`} aria-current={state === 'active' || state === 'bad' ? 'step' : undefined}>
                  <span className={s.dot} aria-hidden="true">
                    {state === 'done' ? <Check size={12} strokeWidth={3} /> : state === 'todo' ? i + 1 : null}
                  </span>
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
            className="mt-4 w-full h-[52px] rounded-2xl text-white text-[15px] font-semibold tracking-[-0.01em] flex items-center justify-center gap-2 bg-gradient-to-b from-[#2b2f3a] to-[#121419] hover:from-[#343947] hover:to-[#181b22] shadow-[inset_0_1px_0_rgba(255,255,255,0.12),0_12px_26px_-14px_rgba(21,23,28,0.8)] active:scale-[0.99] transition-transform focus:outline-none focus-visible:ring-[3px] focus-visible:ring-[#15171c]/25 focus-visible:ring-offset-1"
          >
            <ShieldCheck size={18} strokeWidth={2} aria-hidden="true" />
            {failed ? 'Try again' : 'Open private wallet'}
          </button>
        )}
      </div>
    </div>
  );
}

/** One short fact on the vault: what opening costs and where the keys live. */
function Fact({ icon, children }: { icon: React.ReactNode; children: React.ReactNode }) {
  return (
    <li className="inline-flex items-center gap-1.5 h-7 px-2.5 rounded-full bg-white/[0.08] border border-white/[0.12] text-[12px] font-medium text-white/[0.86]">
      <span aria-hidden="true">{icon}</span>
      {children}
    </li>
  );
}

/**
 * The vault mark: a shield inside two rings. The outer ring turns while the wallet works, the
 * shield turns red when it stopped. Transform only, and still with reduced motion.
 */
function VaultGlyph({ mood }: { mood: 'idle' | 'working' | 'failed' }) {
  const tone = mood === 'failed' ? '#ff8a80' : '#ffffff';
  return (
    <span className="relative w-14 h-14 shrink-0" aria-hidden="true">
      <svg viewBox="0 0 56 56" className={`absolute inset-0 w-full h-full ${mood === 'working' ? 'animate-[spin_2.4s_linear_infinite] motion-reduce:animate-none' : ''}`}>
        <circle cx="28" cy="28" r="26" fill="none" stroke="rgba(255,255,255,0.14)" strokeWidth="1.5" />
        <circle cx="28" cy="28" r="26" fill="none" stroke={mood === 'working' ? '#8b7bff' : 'rgba(255,255,255,0.32)'} strokeWidth="1.5" strokeLinecap="round" strokeDasharray={mood === 'working' ? '40 124' : '3 6'} />
      </svg>
      <span className="absolute inset-[7px] rounded-full flex items-center justify-center bg-white/[0.08] border border-white/[0.14] shadow-[inset_0_1px_0_rgba(255,255,255,0.12)]">
        <svg width="22" height="22" viewBox="0 0 24 24" fill="none">
          <path d="M12 2.8 4.5 5.6v5.9c0 4.7 3.1 8.4 7.5 9.7 4.4-1.3 7.5-5 7.5-9.7V5.6L12 2.8Z" stroke={tone} strokeWidth="1.7" strokeLinejoin="round" />
          {mood === 'failed' ? (
            <path d="M12 8v4.4M12 15.6h.01" stroke={tone} strokeWidth="1.9" strokeLinecap="round" />
          ) : (
            <>
              <circle cx="12" cy="10.6" r="1.9" stroke={tone} strokeWidth="1.6" />
              <path d="M12 12.5v3.4" stroke={tone} strokeWidth="1.6" strokeLinecap="round" />
            </>
          )}
        </svg>
      </span>
    </span>
  );
}
