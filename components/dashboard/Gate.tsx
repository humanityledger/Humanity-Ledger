'use client';

/**
 * components/dashboard/Gate.tsx — the way into the dashboard, one screen per situation:
 *
 *   no session            → sign in with the Ledger Chat account, then come back here;
 *   session, no wallet    → connect the wallet of that account (named in full);
 *   session, other wallet → this wallet is not that account: switch;
 *   right wallet          → open the private wallet (one signature), or straight in if it is open;
 *   opening / error       → where it is, or why it stopped and how to try again.
 *
 * Only the wallet of the signed-in account gets past this (useAztecWallet().sameAccount): the
 * private keys are derived from its signature, so any other wallet would be another account.
 */
import React from 'react';
import Link from 'next/link';
import s from './dashboard.module.css';
import { useT } from '@/lib/i18n/client';
import { CopyButton, State, useAfter } from './parts';

export const SIGN_IN_HREF = '/connect?redirect=/dashboard';
/** A plain link, not next/link: the page reads ?example=1 once when it loads, so it must reload. */
export const EXAMPLE_HREF = '/dashboard?example=1';

export function GateChecking() {
  const t = useT();
  // A session check usually answers at once: say nothing for the first moment, then say what it is.
  const shown = useAfter(true);
  if (!shown) return <div className={s.state} aria-hidden="true" />;
  return <State title={t('Checking your session')} live />;
}

export function GateSignIn() {
  const t = useT();
  return (
    <State
      title={t('Sign in to open your dashboard')}
      text={t('Your balances, payments and contacts, read on this device from your own private wallet. Sign in with your Ledger Chat account and you come straight back here.')}
    >
      <div className={s.actions}>
        <Link className={s.btn} href={SIGN_IN_HREF}>
          {t('Sign in')}
        </Link>
        <a href={EXAMPLE_HREF}>{t('View an example with made-up data')}</a>
      </div>
    </State>
  );
}

function AccountFacts({ account, connected, linked }: { account: string; connected?: string; linked?: boolean }) {
  const t = useT();
  return (
    <dl className={s.kv}>
      <dt>{t('Ledger Chat account')}</dt>
      <dd>
        <code className={s.mono}>{account}</code> <CopyButton value={account} label={t('Copy account address')} />
      </dd>
      <dt>{t('Connected wallet')}</dt>
      <dd>
        {linked ? t('Connected, and linked to this account') : connected ? <code className={s.mono}>{connected}</code> : t('None')}
      </dd>
    </dl>
  );
}

export function GateWallet({ account, connected, onConnect }: { account: string; connected?: string; onConnect: () => void }) {
  const t = useT();
  const wrong = !!connected;
  return (
    <State
      title={wrong ? t('This wallet is not linked to your account') : t('Connect the wallet of your account')}
      text={
        wrong
          ? t('Only the wallet of your Ledger Chat account can open this dashboard. Switch to it in your wallet app, or connect it here.')
          : t('Only the wallet of your Ledger Chat account can open this dashboard.')
      }
    >
      <AccountFacts account={account} connected={connected} />
      <div className={s.actions}>
        <button type="button" className={s.btn} onClick={onConnect}>
          {wrong ? t('Switch wallet') : t('Connect wallet')}
        </button>
        <a href={EXAMPLE_HREF}>{t('View an example with made-up data')}</a>
      </div>
    </State>
  );
}

export function GateOpen({ account, otherAccountOpen, onOpen, opening, error }: { account: string; otherAccountOpen: boolean; onOpen: () => void; opening: boolean; error?: string | null }) {
  const t = useT();
  return (
    <State title={t('Open your private wallet')} text={t('Your wallet signs one message. The keys derived from it, your notes and your activity stay in this browser.')}>
      <AccountFacts account={account} linked />
      {otherAccountOpen ? <p className={s.note}>{t('The private wallet in this tab was open for another account. Opening it for this account closes that one.')}</p> : null}
      <div className={s.actions}>
        <button type="button" className={s.btn} onClick={onOpen} disabled={opening}>
          {opening ? t('Waiting for your wallet') : t('Open private wallet')}
        </button>
      </div>
      {error ? (
        <p className={s.note} role="alert">
          {t(error)}
        </p>
      ) : null}
    </State>
  );
}

const STEPS = ['signing', 'starting', 'deploying', 'ready'] as const;
const STEP_TEXT: Record<(typeof STEPS)[number], string> = {
  signing: 'Your wallet signs the message that derives your private keys',
  starting: 'The private node starts in this browser and syncs your notes',
  deploying: 'Your Aztec account is being set up',
  ready: 'Ready',
};

export function GateOpening({ phase, step }: { phase: string; step?: string }) {
  const t = useT();
  const at = STEPS.indexOf(phase as (typeof STEPS)[number]);
  return (
    <State title={t('Opening your private wallet')} text={step ? t(step) : t('This happens on this device. Nothing private leaves it.')} live>
      <ol className={s.steps}>
        {STEPS.map((p, i) => (
          <li key={p} data-at={i < at ? 'done' : i === at ? 'now' : 'next'}>
            <span className={s.stepMark}>{i < at ? t('Done') : String(i + 1)}</span>
            <span>
              {t(STEP_TEXT[p])}
              {i === at ? <span className={s.srOnly}> {t('(in progress)')}</span> : null}
            </span>
          </li>
        ))}
      </ol>
    </State>
  );
}

export function GateError({ message, detail, onRetry }: { message?: string; detail?: string; onRetry: () => void }) {
  const t = useT();
  return (
    <State title={t('The private wallet did not open')} text={message ? t(message) : t('Something failed while starting the wallet.')}>
      <div className={s.actions}>
        <button type="button" className={s.btn} onClick={onRetry}>
          {t('Try again')}
        </button>
        {detail ? <CopyButton value={detail} label={t('Copy details')} /> : null}
      </div>
    </State>
  );
}
