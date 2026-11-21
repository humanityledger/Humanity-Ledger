'use client';

import React from 'react';
import s from './PadlockLoader.module.css';
import { SignaturePreview } from '@/components/auth/SignaturePreview';
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
 * PadlockLoader: the screen Ledger Chat shows before the encrypted channel is open. The name is
 * kept so LedgerChatV2 does not change.
 *
 * Design (21 November 2026): a session panel, not a splash. The company mark sits small in a
 * lockup with the product name; under it a three-part rule shows how far the session has opened,
 * and a ledger of three rows names each real step (wallet, device key, inbox) with its state in
 * monospace. No spinning emblem, no illustration: the screen reads like the sign-in of a system a
 * security team would deploy. Motion is one sliding segment in the active part of the rule, off
 * under prefers-reduced-motion.
 *
 * Copy rules: the status names what is actually happening, never a made up stage, and nothing
 * here claims more than the product does. "End to end encrypted" alone would overstate it while
 * the fallback path exists, so the text says where decryption happens instead.
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
  /** The exact text the wallet is asked to sign, when it is readable; shown field by field. */
  signText?: string | null;
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

type Step = 'done' | 'active' | 'todo';

/** The lockup: the company mark, small, beside the product name. */
function Lockup() {
  return (
    <div className={s.lockup}>
      <span className={s.mark} aria-hidden="true">
        <img src="/boot-mark.webp" alt="" width={28} height={28} draggable={false} />
      </span>
      <span className={s.product}>Ledger Chat</span>
    </div>
  );
}

/** Three parts, one per step: filled when done, a sliding segment while active, a hairline before. */
function Rule({ steps, tone }: { steps: Step[]; tone?: 'error' }) {
  return (
    <div className={`${s.rule} ${tone === 'error' ? s.ruleError : ''}`} aria-hidden="true">
      {steps.map((st, i) => <span key={i} className={`${s.part} ${s[st]}`} />)}
    </div>
  );
}

function Ledger({ rows }: { rows: { label: string; value: string; state: Step }[] }) {
  return (
    <dl className={s.ledger}>
      {rows.map((r) => (
        <div key={r.label} className={`${s.row} ${s[r.state]}`} aria-current={r.state === 'active' ? 'step' : undefined}>
          <dt>{r.label}</dt>
          <dd>
            <span className={s.state} aria-hidden="true" />
            {r.value}
          </dd>
        </div>
      ))}
    </dl>
  );
}

const SPEC = [
  { label: 'Encryption', value: 'MLS (RFC 9420) over XMTP' },
  { label: 'Signature', value: 'Free, sends no transaction' },
  { label: 'Custody', value: 'Non-custodial' },
];


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
  signText,
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

  const signed = !isWaitingForSignature;
  const steps: Step[] = state === 'working'
    ? ['done', signed ? 'done' : 'active', signed ? 'active' : 'todo']
    : state === 'error' ? ['done', 'done', 'todo'] : ['todo', 'todo', 'todo'];

  return (
    <div className={s.root}>
      <section className={s.panel} aria-labelledby="hl-session-title">
        <Lockup />
        <Rule steps={steps} tone={state === 'error' ? 'error' : undefined} />

        {state === 'error' && (
          <div key="error" className={s.fade} role="alert">
            <p className={s.kicker}>Session not opened</p>
            <h1 id="hl-session-title" className={s.title}>We could not open your channel</h1>
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
                  <button type="button" className={s.quiet} onClick={onSignOut}>
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
            <p className={s.kicker}>{isWaitingForSignature ? 'Unlock this device' : 'Opening your channel'}</p>
            <h1 id="hl-session-title" className={s.title}>
              {isWaitingForSignature ? 'Approve the signature in your wallet' : 'Decrypting your inbox on this device'}
            </h1>
            <Ledger
              rows={[
                { label: 'Wallet', value: walletInfo.name && !/^wallet( app)?$/i.test(walletInfo.name) ? `${walletInfo.name}, connected` : 'Connected', state: 'done' },
                { label: 'Device key', value: isWaitingForSignature ? 'Signature requested' : 'Unlocked', state: isWaitingForSignature ? 'active' : 'done' },
                { label: 'Encrypted inbox', value: isWaitingForSignature ? 'Waiting' : 'Opening on this device', state: isWaitingForSignature ? 'todo' : 'active' },
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
            {isWaitingForSignature && signText ? <SignaturePreview text={signText} kind="unlock" /> : null}
            {isWaitingForSignature && (
              <p className={s.guard}>
                The request is free and sends no transaction. Your wallet should name <strong>ledgerchat.org</strong>; never sign this message on any other site.
              </p>
            )}
            <span className={s.srOnly} role="progressbar" aria-label={isWaitingForSignature ? 'Waiting for your wallet' : 'Opening your encrypted inbox'} />
          </div>
        )}

        {state === 'idle' && (
          <div key="idle" className={s.fade}>
            <p className={s.kicker}>Secure session</p>
            <h1 id="hl-session-title" className={s.title}>Your messages are decrypted only on this device</h1>
            <p className={s.lede}>Unlocking this device takes one signature from your wallet. Nothing is sent to the chain.</p>
            <div className={s.actions}>
              <button type="button" className={`${s.primary} ${s.cta}`} onClick={activate}>
                Enter Ledger Chat
                <svg viewBox="0 0 20 20" width="16" height="16" aria-hidden="true"><path d="M4 10h11M11 5.5 15.5 10 11 14.5" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" /></svg>
              </button>
            </div>
            <dl className={s.spec}>
              {SPEC.map((p) => (
                <div key={p.label}>
                  <dt>{p.label}</dt>
                  <dd>{p.value}</dd>
                </div>
              ))}
            </dl>
          </div>
        )}
      </section>
      <p className={s.domain}>
        <svg viewBox="0 0 16 16" width="12" height="12" aria-hidden="true"><path d="M4.5 7V5.2a3.5 3.5 0 0 1 7 0V7M3.5 7h9v6.5h-9z" fill="none" stroke="currentColor" strokeWidth="1.3" strokeLinejoin="round" /></svg>
        Check that the address bar reads ledgerchat.org
      </p>
    </div>
  );
}

export default PadlockLoader;
