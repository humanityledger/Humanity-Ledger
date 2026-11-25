'use client';

/**
 * components/dashboard/parts.tsx — the small pieces every dashboard view uses. Text only: no icons,
 * no colour, nothing that moves (components/dashboard/dashboard.module.css).
 */
import React, { useEffect, useState } from 'react';
import s from './dashboard.module.css';
import { useT } from '@/lib/i18n/client';
import { formatUnits } from '@/lib/aztec/wallet/amounts';
import type { DashEvent, Provenance } from '@/lib/dashboard/model';

/** What each kind of record is called. */
export const KIND: Record<string, string> = {
  send: 'Sent', receive: 'Received', shield: 'Made private', unshield: 'Made public',
  faucet: 'Test tokens', issue: 'Issued', deploy: 'Account created', operator: 'Operator',
};
export const STATUS: Record<string, string> = { settled: 'Settled', pending: 'Pending', proving: 'Proving', failed: 'Failed' };

/** Where a value comes from, as a quiet label beside a heading. */
export const SOURCE: Record<Provenance, string> = { local: 'this device', proof: 'private node', public: 'public chain' };

export function short(v?: string, n = 6): string {
  if (!v) return '';
  return v.length > 2 * n + 3 ? `${v.slice(0, n + 2)}…${v.slice(-n)}` : v;
}

export function amountText(e: Pick<DashEvent, 'amount' | 'decimals' | 'symbol'>, hidden: boolean): string {
  if (e.amount === undefined || e.decimals === undefined) return '';
  return hidden ? `•••• ${e.symbol ?? ''}` : `${formatUnits(e.amount, e.decimals)} ${e.symbol ?? ''}`;
}

export function Src({ list }: { list: Provenance[] }) {
  const t = useT();
  return <span className={s.src}>{list.map((p) => t(SOURCE[p])).join(' · ')}</span>;
}

export function H2({ children, src, aside, id }: { children: React.ReactNode; src?: Provenance[]; aside?: React.ReactNode; id?: string }) {
  return (
    <h2 className={s.h2} id={id}>
      {children}
      {src ? <Src list={src} /> : null}
      {aside ? <span className={s.aside}>{aside}</span> : null}
    </h2>
  );
}

/** Copies a value; `text` names what it copies when the value is not right beside it. */
export function CopyButton({ value, label, text }: { value: string; label: string; text?: string }) {
  const t = useT();
  const [done, setDone] = useState(false);
  useEffect(() => {
    if (!done) return;
    const id = setTimeout(() => setDone(false), 1600);
    return () => clearTimeout(id);
  }, [done]);
  return (
    <button
      type="button"
      className={s.textBtn}
      aria-label={label}
      onClick={() => {
        navigator.clipboard?.writeText(value).then(
          () => setDone(true),
          () => undefined,
        );
      }}
    >
      {done ? t('Copied') : (text ?? t('Copy'))}
    </button>
  );
}

/** An empty or waiting state inside a section: one plain sentence, sometimes a title. */
export function Empty({ title, children }: { title?: string; children?: React.ReactNode }) {
  return (
    <div className={s.empty}>
      {title ? <strong>{title}</strong> : null}
      {children}
    </div>
  );
}

/** A full-page state: the way in, opening, errors. */
export function State({ title, text, children, live }: { title: string; text?: React.ReactNode; children?: React.ReactNode; live?: boolean }) {
  return (
    <section className={s.state} role={live ? 'status' : undefined} aria-live={live ? 'polite' : undefined}>
      <h1 className={s.stateTitle}>{title}</h1>
      {text ? <p className={s.stateText}>{text}</p> : null}
      {children}
    </section>
  );
}

/** The clock, for ages and countdowns: ticks only while the tab is visible. */
export function useNow(everyMs: number): number {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    let id: ReturnType<typeof setInterval> | null = null;
    const run = () => {
      if (id) clearInterval(id);
      id = null;
      if (document.visibilityState !== 'visible') return;
      setNow(Date.now());
      id = setInterval(() => setNow(Date.now()), everyMs);
    };
    run();
    document.addEventListener('visibilitychange', run);
    return () => {
      if (id) clearInterval(id);
      document.removeEventListener('visibilitychange', run);
    };
  }, [everyMs]);
  return now;
}

/** Shows a waiting state only after a short delay, so a fast answer never flashes one. */
export function useAfter(active: boolean, ms = 400): boolean {
  const [shown, setShown] = useState(false);
  useEffect(() => {
    if (!active) {
      setShown(false);
      return;
    }
    const id = setTimeout(() => setShown(true), ms);
    return () => clearTimeout(id);
  }, [active, ms]);
  return active && shown;
}
