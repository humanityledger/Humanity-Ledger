'use client';

import React from 'react';
import s from './PadlockLoader.module.css';

/**
 * PadlockLoader: the screen Ledger Chat shows before the encrypted channel is
 * open. The name is kept so LedgerChatV2 does not change; the padlock is gone.
 *
 * The emblem is the company mark (the world map disc, see HLLogo) inside a
 * fine dial. While the channel is being set up, a single arc sweeps the dial
 * and a thin bar runs under the status line. Nothing else moves.
 *
 * Copy rules: the status names what is actually happening, never a made up
 * stage, and nothing here claims more than the product does. "End to end
 * encrypted" alone would overstate it while the fallback path exists, so the
 * idle text says where encryption happens instead.
 */

interface PadlockLoaderProps {
  isInitializing: boolean;
  isWaitingForSignature: boolean;
  initError: string;
  onActivate: () => void;
  onClearAndRetry: () => void;
  onReconnect: () => void;
  onRefreshSession: () => void;
  onClearError: () => void;
}

const R = 56;
const TICKS = [0, 90, 180, 270];

function Emblem({ state }: { state: 'idle' | 'working' | 'error' }) {
  const cls = [s.emblem, state === 'working' ? s.breathing : '', state === 'error' ? s.error : ''].join(' ');
  return (
    <div className={cls} aria-hidden="true">
      <svg className={s.dial} viewBox="0 0 120 120">
        <circle className={s.track} cx="60" cy="60" r={R} />
        {TICKS.map((deg) => {
          const rad = (deg * Math.PI) / 180;
          const x1 = 60 + Math.cos(rad) * (R - 5);
          const y1 = 60 + Math.sin(rad) * (R - 5);
          const x2 = 60 + Math.cos(rad) * (R - 2);
          const y2 = 60 + Math.sin(rad) * (R - 2);
          return <line key={deg} className={s.tick} x1={x1} y1={y1} x2={x2} y2={y2} />;
        })}
        {state === 'working' && <circle className={s.arc} cx="60" cy="60" r={R} />}
      </svg>
      <span className={s.mark}>
        <img src="/worldmap.png" alt="" draggable={false} />
      </span>
    </div>
  );
}

export function PadlockLoader({
  isInitializing,
  isWaitingForSignature,
  initError,
  onActivate,
  onClearAndRetry,
  onReconnect,
  onRefreshSession,
  onClearError,
}: PadlockLoaderProps) {
  const lower = initError.toLowerCase();
  const isLimitError = lower.includes('limit') || lower.includes('10/10');
  const isWalletError =
    initError.includes('wallet connection lost') ||
    initError.includes('Connect your wallet') ||
    lower.includes('unknown signer');

  const state: 'idle' | 'working' | 'error' = initError ? 'error' : isInitializing ? 'working' : 'idle';

  return (
    <div className={s.root}>
      <Emblem state={state} />

      <div className={s.content}>
        {state === 'error' && (
          <div key="error" className={s.fade} role="alert">
            <p className={s.title}>We could not open your channel</p>
            <p className={s.errorText}>{initError}</p>
            <div className={s.actions}>
              {isLimitError ? (
                <>
                  <button type="button" className={s.primary} onClick={onClearAndRetry}>
                    Clear this device and retry
                  </button>
                  <button
                    type="button"
                    className={s.secondary}
                    onClick={() => {
                      onClearError();
                      onActivate();
                    }}
                  >
                    Retry without clearing
                  </button>
                </>
              ) : isWalletError ? (
                <>
                  <button type="button" className={s.primary} onClick={onReconnect}>
                    Reconnect wallet
                  </button>
                  <button type="button" className={s.secondary} onClick={onRefreshSession}>
                    Refresh session
                  </button>
                </>
              ) : (
                <button
                  type="button"
                  className={s.primary}
                  onClick={() => {
                    onClearError();
                    onActivate();
                  }}
                >
                  Try again
                </button>
              )}
            </div>
          </div>
        )}

        {state === 'working' && (
          <div key={isWaitingForSignature ? 'sign' : 'work'} className={s.fade} aria-live="polite" aria-busy="true">
            <p className={s.title}>Ledger Chat</p>
            {isWaitingForSignature ? (
              <>
                <p className={s.status}>Waiting for your wallet</p>
                <p className={s.hint}>
                  Approve the signature request in your wallet. It is free and sends no transaction.
                </p>
              </>
            ) : (
              <p className={s.status}>Securing your channel</p>
            )}
            <div className={s.bar} role="progressbar" aria-label="Securing your channel" />
          </div>
        )}

        {state === 'idle' && (
          <div key="idle" className={s.fade}>
            <p className={s.title}>Ledger Chat</p>
            <p className={s.lede}>Direct messages are encrypted on your device before they are sent.</p>
            <div className={s.actions}>
              <button type="button" className={s.primary} onClick={onActivate}>
                Enter Ledger Chat
              </button>
            </div>
            <p className={s.foot}>Non-custodial. Early access.</p>
          </div>
        )}
      </div>
    </div>
  );
}

export default PadlockLoader;
