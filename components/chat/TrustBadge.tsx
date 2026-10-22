'use client';

import React from 'react';

/**
 * components/chat/TrustBadge.tsx
 *
 * The one piece of UI a privacy messenger owes its user: a straight answer to
 * "who can read this?"
 *
 * Ledger Chat currently has no way to say it. A message that travelled over
 * XMTP MLS and a message that POSTed its body to /api/chat/direct — where it
 * lands readable in PostgreSQL (F2-02) — look identical on screen. The user
 * has no way to tell, and the interface implies the stronger of the two.
 *
 * This component states the weaker one plainly. That is the point: it is not
 * a reassurance badge, it is an honesty badge, and it must be willing to say
 * that a message was stored in the clear.
 *
 * Pair it with `isSealedEnvelope()` from lib/security/messageEnvelope.ts so
 * the badge reflects what was actually persisted rather than what was
 * intended.
 */

export type TrustState =
  /** Body left the device encrypted; the server never held readable text. */
  | 'sealed'
  /** Counterparty identity or settlement confirmed on-chain. */
  | 'verified'
  /** Stored in a form an operator can read. The F2-02 state. */
  | 'unsealed'
  /** Proof failed, signature refused, delivery dropped. */
  | 'broken'
  /** Figure or state produced by a simulation, not by a live node. */
  | 'simulated'
  /** Delivery or verification still in flight. */
  | 'pending';

interface TrustMeta {
  label: string;
  /** Plain-language sentence shown on hover and read by screen readers. */
  detail: string;
  fg: string;
  bg: string;
}

const META: Record<TrustState, TrustMeta> = {
  sealed: {
    label: 'Sealed',
    detail: 'Encrypted on your device. Our servers never held a readable copy.',
    fg: 'var(--ledger-sealed)',
    bg: 'var(--ledger-sealed-dim)',
  },
  verified: {
    label: 'Verified',
    detail: 'Identity confirmed on-chain.',
    fg: 'var(--ledger-verified)',
    bg: 'var(--ledger-verified-dim)',
  },
  unsealed: {
    label: 'Readable on server',
    detail:
      'This message was stored unencrypted. Anyone with database access can read it. Avoid sending anything sensitive until sealed delivery is on.',
    fg: 'var(--ledger-unsealed)',
    bg: 'var(--ledger-unsealed-dim)',
  },
  simulated: {
    label: 'Simulated',
    detail: 'Not a live on-chain figure. Shown for development only.',
    fg: 'var(--ledger-unsealed)',
    bg: 'var(--ledger-unsealed-dim)',
  },
  broken: {
    label: 'Failed',
    detail: 'Verification did not pass. Treat this as untrusted.',
    fg: 'var(--ledger-broken)',
    bg: 'var(--ledger-broken-dim)',
  },
  pending: {
    label: 'Sending',
    detail: 'Delivery in progress.',
    fg: 'var(--ledger-fg-muted)',
    bg: 'var(--ledger-glass)',
  },
};

/** 12px glyphs, drawn rather than imported, so the badge carries no icon dependency. */
function Glyph({ state }: { state: TrustState }) {
  const common = {
    width: 12,
    height: 12,
    viewBox: '0 0 12 12',
    fill: 'none',
    stroke: 'currentColor',
    strokeWidth: 1.4,
    strokeLinecap: 'round' as const,
    strokeLinejoin: 'round' as const,
    'aria-hidden': true,
  };

  switch (state) {
    case 'sealed':
      return (
        <svg {...common}>
          <rect x="2.25" y="5.25" width="7.5" height="5.25" rx="1.2" />
          <path d="M4 5.25V3.6a2 2 0 0 1 4 0v1.65" />
        </svg>
      );
    case 'verified':
      return (
        <svg {...common}>
          <path d="M6 1.25 10 3v3.1c0 2.2-1.6 3.8-4 4.65-2.4-.85-4-2.45-4-4.65V3z" />
          <path d="M4.3 5.9 5.6 7.2l2.2-2.5" />
        </svg>
      );
    case 'unsealed':
      return (
        <svg {...common}>
          <rect x="2.25" y="5.25" width="7.5" height="5.25" rx="1.2" />
          <path d="M4 5.25V3.6a2 2 0 0 1 3.8-.9" />
        </svg>
      );
    case 'simulated':
      return (
        <svg {...common}>
          <circle cx="6" cy="6" r="4.4" strokeDasharray="1.6 1.7" />
          <path d="M6 3.9v2.4" />
          <circle cx="6" cy="8.3" r=".55" fill="currentColor" stroke="none" />
        </svg>
      );
    case 'broken':
      return (
        <svg {...common}>
          <circle cx="6" cy="6" r="4.4" />
          <path d="M4.4 4.4 7.6 7.6M7.6 4.4 4.4 7.6" />
        </svg>
      );
    case 'pending':
      return (
        <svg {...common}>
          <circle cx="6" cy="6" r="4.4" strokeDasharray="18" strokeDashoffset="6">
            <animateTransform
              attributeName="transform"
              type="rotate"
              from="0 6 6"
              to="360 6 6"
              dur="900ms"
              repeatCount="indefinite"
            />
          </circle>
        </svg>
      );
  }
}

export interface TrustBadgeProps {
  state: TrustState;
  /** `inline` sits in a message footer; `standalone` sits in a header or banner. */
  variant?: 'inline' | 'standalone';
  /** Hide the word and keep the glyph. The detail still reaches screen readers. */
  iconOnly?: boolean;
  className?: string;
}

export function TrustBadge({
  state,
  variant = 'inline',
  iconOnly = false,
  className = '',
}: TrustBadgeProps) {
  const meta = META[state];
  const standalone = variant === 'standalone';

  return (
    <span
      className={className}
      role="status"
      title={meta.detail}
      aria-label={`${meta.label}. ${meta.detail}`}
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        gap: 'var(--ledger-space-1)',
        color: meta.fg,
        background: standalone ? meta.bg : 'transparent',
        border: standalone ? `1px solid ${meta.fg}33` : 'none',
        borderRadius: 'var(--ledger-radius-full)',
        padding: standalone ? '3px 9px 3px 7px' : '0',
        fontSize: 'var(--ledger-text-xs)',
        fontWeight: 500,
        letterSpacing: 'var(--ledger-tracking-label)',
        lineHeight: 1,
        whiteSpace: 'nowrap',
        transition: `color var(--ledger-dur-fast) var(--ledger-ease)`,
      }}
    >
      <Glyph state={state} />
      {!iconOnly && <span>{meta.label}</span>}
    </span>
  );
}

/**
 * Derive the badge state from what was actually persisted.
 *
 * Deliberately pessimistic: anything this function cannot positively confirm
 * as sealed is reported as unsealed. A badge that guesses in the user's
 * favour is worse than no badge.
 */
export function trustStateForMessage(input: {
  /** The body exactly as stored. */
  storedBody?: unknown;
  deliveredOverMls?: boolean;
  delivered?: boolean;
  verificationFailed?: boolean;
}): TrustState {
  if (input.verificationFailed) return 'broken';
  if (input.delivered === false) return 'pending';
  if (input.deliveredOverMls) return 'sealed';

  const body = input.storedBody;
  const looksSealed = typeof body === 'string' && body.startsWith('hlv1.');
  return looksSealed ? 'sealed' : 'unsealed';
}

export default TrustBadge;
