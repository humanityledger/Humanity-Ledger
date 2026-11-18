'use client';

import React from 'react';
import s from './PadlockLoader.module.css';
import { detectConnectedMobileWallet, openMobileWalletApp, isMobileDevice } from '@/lib/wallet/mobileWallet';
import { safeNativeWalletLink } from '@/lib/auth/wallet-links';
import type { WalletOpenLink } from '@/lib/auth/wc-sign-request';

/** Opens the wallet on this exact request, from the tap. An app scheme or https only. */
function openSignLink(link: WalletOpenLink | null | undefined): boolean {
  if (!link || typeof window === 'undefined') return false;
  if (link.target === '_self' && safeNativeWalletLink(link.href)) {
    window.location.href = link.href;
    return true;
  }
  if (link.target === '_blank' && /^https:\/\/[^\s"'<>`]+$/.test(link.href)) {
    window.open(link.href, '_blank', 'noopener,noreferrer');
    return true;
  }
  return false;
}

/**
 * PadlockLoader: the screen Ledger Chat shows before the encrypted channel is
 * open. The name is kept so LedgerChatV2 does not change; the padlock is gone.
 *
 * The emblem is the company mark (the world map disc, see HLLogo) with one thin
 * arc that turns while the channel opens; three real steps show where it is
 * (wallet, the unlock signature, the inbox). Pure CSS motion, stopped under
 * prefers-reduced-motion.
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
  /** Ends the app session and the wallet connector, then lands on /connect. */
  onSignOut: () => void;
  connectorName?: string;
  /** Phone over WalletConnect: the link to this request once the relay has it (null: not yet). */
  signLink?: WalletOpenLink | null;
}

/** The app session exists but no usable wallet signer: offer reconnect or sign out, never a local wipe. */
export function isWalletInitError(initError: string): boolean {
  const lower = initError.toLowerCase();
  return (
    initError.includes('wallet connection lost') ||
    initError.includes('Connect your wallet') ||
    lower.includes('unknown signer') ||
    lower.includes('synchronized from desktop') ||
    lower.includes('handshake') ||
    lower.includes('not yet synchronized') ||
    lower.includes('no active wallet') ||
    lower.includes('connector')
  );
}

/**
 * The emblem: the company mark in a plain white disc. While the channel opens, one thin arc turns
 * around it; on an error the ring turns red. Nothing else moves.
 */
function Emblem({ state }: { state: 'idle' | 'working' | 'error' }) {
  return (
    <div className={`${s.emblem} ${s[state] ?? ""}`} aria-hidden="true">
      <span className={s.arc} />
      <span className={s.mark}>
        <img src="/boot-mark.webp" alt="" width={72} height={72} draggable={false} />
      </span>
    </div>
  );
}

type Step = 'done' | 'active' | 'todo';

function Steps({ items }: { items: { label: string; note: string; state: Step }[] }) {
  return (
    <ol className={s.steps}>
      {items.map((it) => (
        <li key={it.label} className={`${s.step} ${s[it.state]}`} aria-current={it.state === 'active' ? 'step' : undefined}>
          <span className={s.dot} aria-hidden="true">
            {it.state === 'done' ? (
              <svg viewBox="0 0 16 16" width="12" height="12"><path d="M3.5 8.4l2.9 2.9 6.1-6.6" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" /></svg>
            ) : null}
          </span>
          <span className={s.stepText}>
            <span className={s.stepLabel}>{it.label}</span>
            <span className={s.stepNote}>{it.note}</span>
          </span>
        </li>
      ))}
    </ol>
  );
}

const PROMISES = ['Free, no transaction', 'Encrypted on this device', 'MLS over XMTP'];

export function PadlockLoader({
  isInitializing,
  isWaitingForSignature,
  initError,
  onActivate,
  onClearAndRetry,
  onReconnect,
  onRefreshSession,
  onClearError,
  onSignOut,
  connectorName,
  signLink,
}: PadlockLoaderProps) {
  const walletInfo = detectConnectedMobileWallet(connectorName);

  // No automatic open: switching to the wallet before the request reaches the relay leaves the wallet
  // with nothing to show (iPhone suspends the tab mid-publish), and Android Chrome blocks an open that
  // is not a tap. The person taps the button below once the request has been sent.
  // If the relay never confirms (old wallet, slow network), the button opens the wallet anyway after 8 s.
  const [waitedLong, setWaitedLong] = React.useState(false);
  React.useEffect(() => {
    setWaitedLong(false);
    if (signLink !== null) return;
    const t = setTimeout(() => setWaitedLong(true), 8000);
    return () => clearTimeout(t);
  }, [signLink]);
  const preparing = signLink === null && !waitedLong;
  const walletName = walletInfo.name && !/^wallet( app)?$/i.test(walletInfo.name) ? walletInfo.name : 'your wallet';

  const lower = initError.toLowerCase();
  // Also the device's database key being unusable (lib/xmtp/client.ts): the same remedy.
  const isLimitError = lower.includes('limit') || lower.includes('10/10') || lower.includes('clear this device');
  const isWalletError = isWalletInitError(initError);

  const state: 'idle' | 'working' | 'error' = initError ? 'error' : isInitializing ? 'working' : 'idle';

  // One signature request per tap: a double tap must not open two wallet prompts (a second prompt
  // races the first and is the classic way this flow gets stuck). Re-armed whenever we return to idle.
  const armed = React.useRef(true);
  React.useEffect(() => {
    if (state === 'idle') armed.current = true;
  }, [state]);
  const activate = React.useCallback(() => {
    if (!armed.current) return;
    armed.current = false;
    onActivate();
  }, [onActivate]);

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
                  {/* Was "Sign in with new wallet", which wiped this device's message database instead. */}
                  <button type="button" className={s.secondary} style={{ marginTop: '8px' }} onClick={onSignOut}>
                    Sign out and connect again
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
          <div key="work" className={s.fade} aria-live="polite" aria-busy="true">
            <p className={s.kicker}>Opening your channel</p>
            <p className={s.title}>Ledger Chat</p>
            <Steps
              items={[
                { label: 'Wallet connected', note: walletInfo.name && walletInfo.name !== 'Wallet App' ? walletInfo.name : 'Your account', state: 'done' },
                {
                  label: 'Unlock this device',
                  note: isWaitingForSignature ? 'Approve the signature in your wallet. It is free and sends no transaction.' : 'Signed',
                  state: isWaitingForSignature ? 'active' : 'done',
                },
                { label: 'Open your encrypted inbox', note: 'Messages are decrypted here, on your device', state: isWaitingForSignature ? 'todo' : 'active' },
              ]}
            />
            {isWaitingForSignature && isMobileDevice() && (
              <button
                type="button"
                className={`${s.primary} ${s.wide}`}
                disabled={preparing}
                aria-busy={preparing}
                onClick={() => { if (!openSignLink(signLink)) openMobileWalletApp(connectorName); }}
              >
                {preparing ? 'Sending the request to your wallet…' : `Open ${walletName} to approve`}
              </button>
            )}
            {isWaitingForSignature && (
              <p className={s.guard}>
                Your wallet should name <strong>ledgerchat.org</strong>. Never sign this message on any other site.
              </p>
            )}
            <div className={s.bar} role="progressbar" aria-label={isWaitingForSignature ? 'Waiting for your wallet' : 'Opening your encrypted inbox'} />
          </div>
        )}

        {state === 'idle' && (
          <div key="idle" className={s.fade}>
            <p className={s.kicker}>Private by design</p>
            <p className={`${s.title} ${s.titleLg}`}>Ledger Chat</p>
            <p className={s.lede}>Messages encrypted on your device. Private payments in the same conversation.</p>
            <div className={s.actions}>
              <button type="button" className={`${s.primary} ${s.cta}`} onClick={activate}>
                Enter Ledger Chat
                <svg viewBox="0 0 20 20" width="18" height="18" aria-hidden="true"><path d="M4 10h11M11 5.5 15.5 10 11 14.5" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" /></svg>
              </button>
            </div>
            <ul className={s.promises}>
              {PROMISES.map((p) => <li key={p}>{p}</li>)}
            </ul>
            <p className={s.foot}>Non-custodial. Early access.</p>
          </div>
        )}
      </div>
    </div>
  );
}

export default PadlockLoader;
