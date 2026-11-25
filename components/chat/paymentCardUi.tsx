'use client';

/**
 * components/chat/paymentCardUi.tsx — the frame shared by every value card in a conversation
 * (PaymentCard, PaymentRequestCard).
 *
 * It speaks the private wallet's visual language (components/zk/wallet/WalletUI.tsx): ink on
 * white, hairlines, tabular figures, small uppercase labels, and colour only where it carries
 * meaning (settled, failed). Pieces only: the cards decide every word and every state.
 */

import React from 'react';
import { useT } from '@/lib/i18n/client';

export type CardTone = 'ok' | 'wait' | 'bad' | 'neutral';

const PILL: Record<CardTone, string> = {
  ok: 'bg-[#e8f6f0] text-[#0a7a55]',
  bad: 'bg-[#fdecea] text-[#b42318]',
  wait: 'bg-[#f2f4f7] text-[#15171c]',
  neutral: 'bg-[#f2f4f7] text-[#3d424b]',
};

export function StatusPill({ tone, children }: { tone: CardTone; children: React.ReactNode }) {
  return (
    <span className={`inline-flex h-[22px] shrink-0 items-center gap-1.5 whitespace-nowrap rounded-full px-2 text-[11.5px] font-semibold ${PILL[tone]}`}>
      <span
        aria-hidden
        className={`h-1.5 w-1.5 rounded-full ${tone === 'ok' ? 'bg-[#0a7a55]' : tone === 'bad' ? 'bg-[#b42318]' : 'bg-[#15171c]'} ${tone === 'wait' ? 'animate-pulse motion-reduce:animate-none' : ''}`}
      />
      {children}
    </span>
  );
}

/** An amount with its symbol set smaller, tabular so figures line up across cards. */
export function CardAmount({ value, symbol }: { value?: string; symbol: string }) {
  return (
    <p className="mt-2 text-[26px] font-semibold leading-none tracking-[-0.03em] tabular-nums text-[#15171c]">
      {value ?? ''}
      <span className={`${value ? 'ml-1.5' : ''} text-[15px] font-medium tracking-normal text-[#3d424b]`}>{symbol}</span>
    </p>
  );
}

/** A label/value row in the card's specification list. */
export function SpecRow({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex items-center justify-between gap-3 py-1.5">
      <dt className="text-[10.5px] font-semibold uppercase tracking-[0.12em] text-[#5b606b]">{label}</dt>
      <dd className="m-0 min-w-0 truncate text-right text-[12.5px] font-medium text-[#15171c]">{children}</dd>
    </div>
  );
}

export function PaymentCardFrame({
  eyebrow,
  status,
  testId,
  state,
  children,
}: {
  eyebrow: string;
  status: { tone: CardTone; label: string };
  testId: string;
  state: string;
  children: React.ReactNode;
}) {
  const t = useT();
  return (
    <div
      className="w-[300px] max-w-full rounded-[18px] border border-[#e4e7ec] bg-white p-4 shadow-[0_1px_2px_rgba(16,24,40,0.04),0_10px_24px_-16px_rgba(16,24,40,0.18)]"
      data-testid={testId}
      data-state={state}
    >
      <div className="flex items-center justify-between gap-2">
        <span className="truncate text-[10.5px] font-semibold uppercase tracking-[0.12em] text-[#5b606b]">{eyebrow}</span>
        <StatusPill tone={status.tone}>{t(status.label)}</StatusPill>
      </div>
      {children}
    </div>
  );
}
