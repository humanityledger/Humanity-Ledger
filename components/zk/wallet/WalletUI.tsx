'use client';

/**
 * components/zk/wallet/WalletUI.tsx — the visual language of the private wallet.
 *
 * Ink on white. One typeface, tabular figures for every amount, hairline borders,
 * 48 px targets, and colour only where it carries meaning (a settled payment, a
 * failure, the unaudited warning). Every text colour on white is at least 4.5:1
 * and body text at least 7:1:
 *
 *   INK      #15171C  17.9:1   amounts, titles, primary buttons
 *   INK_2    #3D424B  10.4:1   body text
 *   INK_3    #5B606B   6.4:1   labels and secondary lines (13 px and up)
 *   LINE     #E4E7EC           hairlines
 *   SURFACE  #F7F8FA           quiet fills
 *   OK       #0A7A55   5.9:1   settled
 *   BAD      #B42318   6.6:1   failed
 *
 * Nothing here reads the wallet. These are pieces; ZkWalletPanel and the sheets
 * put real numbers in them.
 */

import React, { useEffect, useId, useRef, useState } from 'react';
import { motion } from 'framer-motion';
import { Check, Copy, Eye, EyeOff, X } from 'lucide-react';
import { cleanAmount } from './walletLogic';
import { useT } from '@/lib/i18n/client';
import { UserAvatar } from '@/components/chat/UserAvatar';

export { cleanAmount };

export const INK = '#15171c';
export const INK_2 = '#3d424b';
export const INK_3 = '#5b606b';
export const LINE = '#e4e7ec';
export const SURFACE = '#f7f8fa';
export const OK = '#0a7a55';
export const BAD = '#b42318';

/** Ring shown on keyboard focus only. */
export const FOCUS = 'focus:outline-none focus-visible:ring-[3px] focus-visible:ring-[#15171c]/25 focus-visible:ring-offset-1';

/* ─── amounts ──────────────────────────────────────────────────────────────── */

const HIDE_KEY = 'hl.wallet.hide_amounts';

/**
 * Hide amounts on this device (someone looking over a shoulder). Stored in this
 * browser only; it changes what is drawn, never what the wallet does.
 */
export function useHiddenAmounts(): [boolean, () => void] {
  const [hidden, setHidden] = useState(false);
  useEffect(() => {
    try {
      setHidden(localStorage.getItem(HIDE_KEY) === '1');
    } catch {
      /* storage unavailable: amounts stay visible */
    }
  }, []);
  const toggle = () =>
    setHidden((h) => {
      const next = !h;
      try {
        localStorage.setItem(HIDE_KEY, next ? '1' : '0');
      } catch {
        /* the choice lasts for this page only */
      }
      return next;
    });
  return [hidden, toggle];
}

export const MASK = '••••';

/** "1,234.5678" → ["1,234", ".5678"]. */
export function splitAmount(text: string): [string, string] {
  const i = text.indexOf('.');
  return i < 0 ? [text, ''] : [text.slice(0, i), text.slice(i)];
}

/**
 * The large balance. The whole part in ink, the fraction one step lighter and
 * smaller, the symbol after it. With `hidden`, four dots of the same weight.
 */
export function BigAmount({ text, symbol, hidden, muted }: { text: string; symbol: string; hidden?: boolean; muted?: boolean }) {
  const tr = useT();
  const [whole, frac] = splitAmount(text);
  return (
    <span className="inline-flex items-baseline gap-2 min-w-0 max-w-full" aria-label={hidden ? tr("Balance hidden, {symbol}", { symbol }) : `${text} ${symbol}`}>
      <span
        className="font-semibold tracking-[-0.04em] tabular-nums leading-none truncate text-[44px] sm:text-[52px]"
        style={{ color: muted ? '#a3a9b4' : INK }}
        aria-hidden="true"
      >
        {hidden ? MASK : whole}
        {!hidden && frac && <span className="text-[28px] sm:text-[32px] tracking-[-0.03em]" style={{ color: INK_3 }}>{frac}</span>}
      </span>
      <span className="text-[17px] font-semibold tracking-[-0.01em] shrink-0" style={{ color: INK_2 }} aria-hidden="true">
        {symbol}
      </span>
    </span>
  );
}

/** An amount inside a row: tabular, never wraps, masked when hidden. */
export function Figure({ text, hidden, strong, className = '' }: { text: string; hidden?: boolean; strong?: boolean; className?: string }) {
  return (
    <span className={`tabular-nums whitespace-nowrap ${strong ? 'font-semibold' : 'font-medium'} ${className}`} style={{ color: INK }}>
      {hidden ? MASK : text}
    </span>
  );
}

/* ─── marks ────────────────────────────────────────────────────────────────── */

const TOKEN_TINT: Record<string, string> = {
  USD: '#3b6cf6',
  HLC: '#15171c',
  ETH: '#6b7bf2',
};

/**
 * A round mark for a token: one flat colour, a dollar sign for dollar tokens (cUSDC), the first
 * letter otherwise. Our own drawing, never an issuer's logo.
 */
export function TokenMark({ symbol, size = 28 }: { symbol: string; size?: number; shielded?: boolean }) {
  const sym = (symbol || '?').toUpperCase();
  const dollar = /USD/.test(sym);
  const bg = dollar ? TOKEN_TINT.USD : TOKEN_TINT[sym] ?? TOKEN_TINT.HLC;
  const glyph = dollar ? '$' : sym.replace(/^C(?=[A-Z]{2})/, '').slice(0, 1);
  return (
    <span
      aria-hidden="true"
      className="inline-flex items-center justify-center rounded-full shrink-0 text-white font-semibold select-none"
      style={{ width: size, height: size, fontSize: Math.round(size * 0.46), lineHeight: 1, background: bg }}
    >
      {glyph}
    </span>
  );
}

/**
 * A picture of an Aztec address: colours read from its first bytes, the same on every screen and
 * every device. Two different addresses almost never look alike, so a person can tell at a glance
 * that the recipient on the review is the one they scanned. It replaces nothing: the full
 * address is always shown next to it.
 */
export function AddressAvatar({ address, size = 40 }: { address: string; size?: number }) {
  // The same 10 × 10 mosaic as every avatar in Ledger Chat, read from the address's first bits.
  return <UserAvatar address={address} size={size} />;
}


/* ─── buttons ──────────────────────────────────────────────────────────────── */

export function IconButton({
  label,
  onClick,
  children,
  disabled,
  pressed,
  size = 44,
}: {
  label: string;
  onClick: () => void;
  children: React.ReactNode;
  disabled?: boolean;
  pressed?: boolean;
  size?: number;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      aria-label={label}
      title={label}
      aria-pressed={pressed}
      className={`shrink-0 rounded-full flex items-center justify-center transition-colors hover:bg-[#f2f4f7] active:bg-[#e9ecf0] disabled:opacity-40 ${FOCUS}`}
      style={{ width: size, height: size, color: INK }}
    >
      {children}
    </button>
  );
}

/** Eye toggle beside the balance. */
export function HideAmountsButton({ hidden, onToggle }: { hidden: boolean; onToggle: () => void }) {
  const tr = useT();
  return (
    <IconButton label={hidden ? tr("Show amounts") : tr("Hide amounts")} onClick={onToggle} pressed={hidden} size={40}>
      {hidden ? <EyeOff size={18} strokeWidth={1.9} /> : <Eye size={18} strokeWidth={1.9} />}
    </IconButton>
  );
}

/**
 * One action in the dock under the balance: an icon disc and a word. The primary
 * one is solid ink; the others are quiet tiles. All are 72 px tall.
 */
export function ActionTile({
  label,
  icon,
  onClick,
  primary,
  disabled,
}: {
  label: string;
  icon: React.ReactNode;
  onClick: () => void;
  primary?: boolean;
  disabled?: boolean;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      className={`group h-[76px] rounded-2xl flex flex-col items-center justify-center gap-1.5 transition-[background-color,transform] duration-150 active:scale-[0.97] disabled:opacity-40 disabled:active:scale-100 ${FOCUS} ${
        primary ? 'bg-[#15171c] text-white hover:bg-[#262932]' : 'bg-[#f7f8fa] text-[#15171c] hover:bg-[#eef0f3] border border-[#eceef2]'
      }`}
    >
      <span
        className={`w-9 h-9 rounded-full flex items-center justify-center ${primary ? 'bg-white/[0.12]' : 'bg-white border border-[#e4e7ec]'}`}
        aria-hidden="true"
      >
        {icon}
      </span>
      <span className="text-[13px] font-semibold tracking-[-0.005em] leading-none">{label}</span>
    </button>
  );
}

export function PrimaryButton({
  children,
  onClick,
  disabled,
  busy,
  type = 'button',
  tone = 'ink',
}: {
  children: React.ReactNode;
  onClick?: () => void;
  disabled?: boolean;
  busy?: boolean;
  type?: 'button' | 'submit';
  tone?: 'ink' | 'danger';
}) {
  return (
    <button
      type={type}
      onClick={onClick}
      disabled={disabled || busy}
      aria-busy={busy || undefined}
      className={`w-full min-h-[56px] px-5 rounded-[18px] text-[16px] font-semibold tracking-[-0.01em] flex items-center justify-center gap-2 transition-[background-color,transform] active:scale-[0.99] disabled:bg-[#f1f2f4] disabled:text-[#8a909c] disabled:active:scale-100 ${FOCUS} ${
        tone === 'danger' ? 'bg-[#b42318] hover:bg-[#962018] text-white' : 'bg-[#0d0f14] hover:bg-[#2a2d34] text-white'
      }`}
    >
      {busy && <Spinner />}
      {children}
    </button>
  );
}

export function SecondaryButton({ children, onClick, disabled }: { children: React.ReactNode; onClick: () => void; disabled?: boolean }) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      className={`w-full min-h-[56px] px-5 rounded-[18px] text-[16px] font-semibold bg-[#f4f5f7] hover:bg-[#eceef1] disabled:opacity-40 ${FOCUS}`}
      style={{ color: INK }}
    >
      {children}
    </button>
  );
}

/** Small text button inside a card header or a row ("Add", "Max", "Paste"). */
export function TextButton({ children, onClick, disabled, label }: { children: React.ReactNode; onClick: () => void; disabled?: boolean; label?: string }) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      aria-label={label}
      className={`min-h-[40px] px-3 -mr-2 rounded-full text-[14px] font-semibold hover:bg-[#f2f4f7] disabled:opacity-40 ${FOCUS}`}
      style={{ color: INK }}
    >
      {children}
    </button>
  );
}

export function Spinner({ size = 16 }: { size?: number }) {
  return (
    <span
      className="inline-block rounded-full border-2 border-current border-r-transparent animate-spin"
      style={{ width: size, height: size }}
      aria-hidden="true"
    />
  );
}

/* ─── chips and pills ──────────────────────────────────────────────────────── */

/** The network, with a live dot when the wallet is open. */
export function NetworkChip({ label, live }: { label: string; live: boolean }) {
  return (
    <span className="inline-flex items-center gap-1.5 h-7 pl-2 pr-2.5 rounded-full border border-[#e4e7ec] bg-white text-[12.5px] font-medium max-w-full" style={{ color: INK_2 }}>
      <span className="relative flex w-2 h-2 shrink-0" aria-hidden="true">
        {live && <span className="absolute inset-0 rounded-full bg-[#10b981] opacity-60 animate-ping motion-reduce:hidden" />}
        <span className={`relative w-2 h-2 rounded-full ${live ? 'bg-[#10b981]' : 'bg-[#c3c8d0]'}`} />
      </span>
      <span className="truncate">{label}</span>
    </span>
  );
}

export type PillTone = 'neutral' | 'ok' | 'bad' | 'wait';

export function Pill({ tone = 'neutral', children }: { tone?: PillTone; children: React.ReactNode }) {
  const style: Record<PillTone, string> = {
    neutral: 'bg-[#f2f4f7] text-[#3d424b]',
    ok: 'bg-[#e8f6f0] text-[#0a7a55]',
    bad: 'bg-[#fdecea] text-[#b42318]',
    wait: 'bg-[#f2f4f7] text-[#15171c]',
  };
  return (
    <span className={`inline-flex items-center gap-1 h-[22px] px-2 rounded-full text-[11.5px] font-semibold whitespace-nowrap ${style[tone]}`}>
      {tone === 'wait' && <span className="w-1.5 h-1.5 rounded-full bg-[#15171c] animate-pulse motion-reduce:animate-none" aria-hidden="true" />}
      {children}
    </span>
  );
}

/** A segmented control (tabs). Arrow keys move between segments. */
export function Segmented<T extends string>({
  value,
  options,
  onChange,
  label,
}: {
  value: T;
  options: ReadonlyArray<{ value: T; label: string; badge?: number }>;
  onChange: (v: T) => void;
  label: string;
}) {
  const tr = useT();
  const refs = useRef<Array<HTMLButtonElement | null>>([]);
  const move = (i: number) => {
    const n = (i + options.length) % options.length;
    onChange(options[n].value);
    refs.current[n]?.focus();
  };
  return (
    <div role="tablist" aria-label={label} className="flex p-1 rounded-[16px] bg-[#f4f5f7] gap-1">
      {options.map((o, i) => {
        const on = o.value === value;
        return (
          <button
            key={o.value}
            ref={(el) => {
              refs.current[i] = el;
            }}
            type="button"
            role="tab"
            aria-selected={on}
            tabIndex={on ? 0 : -1}
            onClick={() => onChange(o.value)}
            onKeyDown={(e) => {
              if (e.key === 'ArrowRight') move(i + 1);
              if (e.key === 'ArrowLeft') move(i - 1);
            }}
            className={`flex-1 min-w-0 min-h-[40px] px-1.5 sm:px-3 rounded-xl text-[13.5px] sm:text-[14px] font-semibold whitespace-nowrap tracking-[-0.005em] flex items-center justify-center gap-1.5 transition-[background-color,color,box-shadow] duration-150 ${FOCUS} ${
              on ? 'bg-white text-[#15171c] shadow-[0_1px_2px_rgba(16,24,40,0.08),0_0_0_1px_rgba(16,24,40,0.04)]' : 'text-[#5b606b] hover:text-[#15171c]'
            }`}
          >
            {tr(o.label)}
            {o.badge ? (
              <span className={`min-w-[20px] h-5 px-1.5 rounded-full text-[12px] font-semibold tabular-nums flex items-center justify-center ${on ? 'bg-[#15171c] text-white' : 'bg-white text-[#15171c]'}`}>
                {o.badge > 99 ? '99+' : o.badge}
              </span>
            ) : null}
          </button>
        );
      })}
    </div>
  );
}

/** Choice of token: a row of chips, one per configured token. */
export function TokenChips<T extends string>({
  tokens,
  value,
  onChange,
}: {
  tokens: ReadonlyArray<{ key: T; symbol: string }>;
  value: T;
  onChange: (k: T) => void;
}) {
  const tr = useT();
  if (tokens.length <= 1) return null;
  return (
    <div role="radiogroup" aria-label={tr("Token")} className="flex flex-wrap gap-2">
      {tokens.map((t) => {
        const on = t.key === value;
        return (
          <button
            key={t.key}
            type="button"
            role="radio"
            aria-checked={on}
            onClick={() => onChange(t.key)}
            className={`min-h-[44px] pl-1.5 pr-4 rounded-full text-[15px] font-semibold border inline-flex items-center gap-2 transition-[background-color,border-color] ${FOCUS} ${
              on ? 'bg-white border-[#0d0f14] text-[#0d0f14]' : 'bg-[#f4f5f7] border-transparent text-[#3d424b] hover:bg-[#eceef1]'
            }`}
          >
            <TokenMark symbol={t.symbol} size={28} />
            {t.symbol}
          </button>
        );
      })}
    </div>
  );
}

/* ─── cards and rows ───────────────────────────────────────────────────────── */

export function Card({ children, className = '', as: As = 'section', label }: { children: React.ReactNode; className?: string; as?: 'section' | 'div'; label?: string }) {
  return (
    <As aria-label={label} className={`bg-white rounded-[24px] border border-[#eef0f3] ${className}`}>
      {children}
    </As>
  );
}

/** Card header: a small title, an optional line under it, an optional action on the right. */
export function CardHead({ title, sub, action }: { title: string; sub?: string; action?: React.ReactNode }) {
  return (
    <div className="flex items-start justify-between gap-3 px-5 pt-4 pb-1">
      <div className="min-w-0">
        <h3 className="text-[16px] font-semibold tracking-[-0.01em]" style={{ color: INK }}>
          {title}
        </h3>
        {sub && (
          <p className="mt-1 text-[13px] leading-snug" style={{ color: INK_2 }}>
            {sub}
          </p>
        )}
      </div>
      {action}
    </div>
  );
}

/** A label and a value on one line; the value never pushes the label off screen. */
export function KV({ k, v, mono, hint }: { k: string; v: React.ReactNode; mono?: boolean; hint?: string }) {
  return (
    <div className="flex items-center justify-between gap-4 min-h-[52px] py-2.5 border-t border-[#eef0f3] first:border-t-0">
      <span className="min-w-0">
        <span className="block text-[15px]" style={{ color: INK_2 }}>
          {k}
        </span>
        {hint && (
          <span className="block text-[12.5px] leading-snug mt-0.5" style={{ color: INK_3 }}>
            {hint}
          </span>
        )}
      </span>
      <span
        className={`text-[15px] font-semibold text-right tabular-nums min-w-0 max-w-[62%] shrink-0 ${mono ? 'font-mono text-[13.5px] font-medium truncate' : 'break-words'}`}
        style={{ color: INK }}
      >
        {v}
      </span>
    </div>
  );
}

export const shortHex = (s?: string, n = 6) => (s && s.length > n * 2 + 4 ? `${s.slice(0, n + 2)}…${s.slice(-n)}` : s ?? '');

/** "0x1f49…24e5" groups of four, for reading an address aloud or comparing it. */
export function groupHex(s: string): string {
  if (!/^0x[0-9a-fA-F]+$/.test(s)) return s;
  return `0x ${s.slice(2).replace(/(.{4})/g, '$1 ').trim()}`;
}

async function copyText(text: string): Promise<boolean> {
  try {
    await navigator.clipboard.writeText(text);
    return true;
  } catch {
    return false;
  }
}

/** A row that copies its value. Says "Copied" for a moment, or "Not copied" when the browser refuses. */
export function CopyKV({ k, v, display }: { k: string; v: string; display?: string }) {
  const tr = useT();
  const [state, setState] = useState<'' | 'yes' | 'no'>('');
  useEffect(() => {
    if (!state) return;
    const t = setTimeout(() => setState(''), 1600);
    return () => clearTimeout(t);
  }, [state]);
  return (
    <button
      type="button"
      onClick={async () => setState((await copyText(v)) ? 'yes' : 'no')}
      className={`w-full flex items-center justify-between gap-4 min-h-[52px] py-2.5 border-t border-[#eef0f3] first:border-t-0 text-left rounded-lg ${FOCUS}`}
      aria-label={tr("Copy {k}", { k })}
    >
      <span className="text-[15px] shrink-0" style={{ color: INK_2 }}>
        {k}
      </span>
      <span className="flex items-center gap-2 min-w-0">
        <span className="font-mono text-[13.5px] truncate" style={{ color: state === 'no' ? BAD : INK }} role={state ? 'status' : undefined}>
          {state === 'yes' ? tr("Copied") : state === 'no' ? tr("Not copied") : display ?? shortHex(v)}
        </span>
        {state === 'yes' ? <Check size={15} strokeWidth={2.2} style={{ color: OK }} aria-hidden="true" /> : <Copy size={15} strokeWidth={1.9} style={{ color: INK_3 }} aria-hidden="true" />}
      </span>
    </button>
  );
}

/** A full address in a quiet box, grouped, with Copy. */
export function AddressBox({ label, value }: { label: string; value: string }) {
  const tr = useT();
  const [state, setState] = useState<'' | 'yes' | 'no'>('');
  useEffect(() => {
    if (!state) return;
    const t = setTimeout(() => setState(''), 1800);
    return () => clearTimeout(t);
  }, [state]);
  return (
    <div className="rounded-[20px] bg-[#f7f8fa] px-4 py-3">
      <div className="flex items-center justify-between gap-2">
        <span className="text-[14px] font-medium" style={{ color: INK_3 }}>
          {label}
        </span>
        <TextButton onClick={async () => setState((await copyText(value)) ? 'yes' : 'no')} label={tr("Copy {label}", { label })}>
          <span className="inline-flex items-center gap-1.5">
            {state === 'yes' ? <Check size={15} strokeWidth={2.2} aria-hidden="true" /> : <Copy size={15} strokeWidth={1.9} aria-hidden="true" />}
            {state === 'yes' ? tr("Copied") : state === 'no' ? tr("Not copied") : tr("Copy")}
          </span>
        </TextButton>
      </div>
      <p className="mt-1 font-mono text-[13.5px] leading-[1.6] break-all" style={{ color: INK }} data-testid="address-box">
        {groupHex(value)}
      </p>
    </div>
  );
}

/** A one-line notice. `warn` for something that needs attention, `bad` for a failure. */
export function Notice({ tone = 'info', children, action }: { tone?: 'info' | 'warn' | 'bad'; children: React.ReactNode; action?: React.ReactNode }) {
  const style = {
    info: 'bg-[#f7f8fa] border-[#e4e7ec] text-[#3d424b]',
    warn: 'bg-[#fff8eb] border-[#f2dcae] text-[#6b4a00]',
    bad: 'bg-[#fdf3f2] border-[#f3c9c4] text-[#b42318]',
  }[tone];
  return (
    <div role={tone === 'bad' ? 'alert' : 'status'} className={`rounded-2xl border px-4 py-3 text-[14px] leading-snug break-words ${style}`}>
      {children}
      {action && <div className="mt-2 flex flex-wrap gap-3">{action}</div>}
    </div>
  );
}

/* ─── amount input ─────────────────────────────────────────────────────────── */

/**
 * The amount panel: a soft grey field with the figure large on the left and the token on the right,
 * the available balance and Max under it. Red outline when the amount cannot be sent.
 */
export function AmountInput({
  value,
  onChange,
  symbol,
  decimals,
  available,
  availableLabel = 'Available',
  onMax,
  invalid,
  autoFocus,
}: {
  value: string;
  onChange: (v: string) => void;
  symbol: string;
  decimals: number;
  available: string;
  availableLabel?: string;
  onMax: () => void;
  invalid?: string | null;
  autoFocus?: boolean;
}) {
  const tr = useT();
  const id = useId();
  const ref = useRef<HTMLInputElement>(null);
  useEffect(() => {
    if (autoFocus) ref.current?.focus({ preventScroll: true });
  }, [autoFocus]);
  const size = value.length > 14 ? 28 : value.length > 9 ? 36 : 44;
  return (
    <div
      className={`rounded-[24px] border px-5 pt-4 pb-4 transition-colors ${
        invalid ? 'border-[#f3c9c4] bg-[#fffafa]' : 'border-transparent bg-[#f7f8fa] focus-within:bg-white focus-within:border-[#e4e7ec]'
      }`}
    >
      <label htmlFor={id} className="block text-[14px] font-medium" style={{ color: INK_3 }}>
        {tr("Amount")}
      </label>
      <div className="mt-1 flex items-center gap-3 min-w-0">
        <input
          ref={ref}
          id={id}
          inputMode="decimal"
          autoComplete="off"
          enterKeyHint="next"
          placeholder="0"
          value={value}
          onChange={(e) => onChange(cleanAmount(e.target.value, decimals))}
          aria-invalid={invalid ? true : undefined}
          aria-describedby={`${id}-help`}
          className="flex-1 min-w-0 bg-transparent font-medium tracking-[-0.035em] tabular-nums outline-none placeholder:text-[#c3c8d0] h-[56px]"
          style={{ color: INK, fontSize: size }}
        />
        <span className="inline-flex items-center gap-2 h-10 pl-1 pr-3.5 rounded-full bg-white border border-[#eef0f3] text-[15px] font-semibold shrink-0" style={{ color: INK }}>
          <TokenMark symbol={symbol} size={30} />
          {symbol}
        </span>
      </div>
      <div id={`${id}-help`} className="mt-1 flex items-center justify-between gap-2 text-[13px]">
        <span className="tabular-nums truncate" style={{ color: invalid ? BAD : INK_3 }} role={invalid ? 'alert' : undefined}>
          {invalid || `${availableLabel} ${available} ${symbol}`}
        </span>
        <button
          type="button"
          onClick={onMax}
          className={`min-h-[32px] px-3 rounded-full text-[13px] font-semibold hover:bg-[#eceef1] shrink-0 ${FOCUS}`}
          style={{ color: INK }}
        >
          {tr("Max")}
        </button>
      </div>
    </div>
  );
}

/* ─── sheet ────────────────────────────────────────────────────────────────── */

/**
 * The bottom sheet every wallet action opens in. A modal dialog: Escape and the
 * backdrop close it, focus moves into it, and the page behind does not scroll.
 */
export function Sheet({
  title,
  subtitle,
  onClose,
  onBack,
  children,
}: {
  title: string;
  subtitle?: string;
  onClose: () => void;
  onBack?: () => void;
  children: React.ReactNode;
}) {
  const tr = useT();
  const panel = useRef<HTMLDivElement>(null);
  const titleId = useId();
  useEffect(() => {
    const before = document.activeElement as HTMLElement | null;
    const first = panel.current?.querySelector<HTMLElement>('input, textarea, [data-autofocus]') ?? panel.current;
    first?.focus({ preventScroll: true });
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.stopPropagation();
        onClose();
      }
    };
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('keydown', onKey);
      before?.focus?.({ preventScroll: true });
    };
    // Focus once, when the sheet opens.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  return (
    <motion.div className="absolute inset-0 z-20 flex flex-col justify-end" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
      <button type="button" aria-label={tr("Close")} tabIndex={-1} className="absolute inset-0 bg-[#0d0f14]/20" onClick={onClose} />
      <motion.div
        ref={panel}
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        tabIndex={-1}
        initial={{ y: 48 }}
        animate={{ y: 0 }}
        exit={{ y: 48 }}
        transition={{ duration: 0.18, ease: [0.22, 0.8, 0.24, 1] }}
        className="relative max-h-[92%] flex flex-col rounded-t-[32px] bg-white shadow-[0_-8px_32px_rgba(16,24,40,0.08)] outline-none"
      >
        <div className="shrink-0 px-5 pt-3">
          <div className="mx-auto mb-2 h-1 w-10 rounded-full bg-[#d4d8de]" aria-hidden="true" />
          <div className="flex items-center gap-1 min-h-[48px]">
            {onBack && (
              <IconButton label={tr("Back")} onClick={onBack}>
                <span className="text-[22px] leading-none" aria-hidden="true">
                  ‹
                </span>
              </IconButton>
            )}
            <div className="flex-1 min-w-0">
              <h2 id={titleId} className="text-[19px] font-semibold tracking-[-0.015em] truncate" style={{ color: INK }}>
                {title}
              </h2>
              {subtitle && (
                <p className="text-[13px] leading-snug truncate" style={{ color: INK_3 }}>
                  {subtitle}
                </p>
              )}
            </div>
            <IconButton label={tr("Close")} onClick={onClose}>
              <X size={19} strokeWidth={2} />
            </IconButton>
          </div>
        </div>
        <div className="flex-1 min-h-0 overflow-y-auto overscroll-contain px-5 pt-2 pb-[max(24px,env(safe-area-inset-bottom))]">{children}</div>
      </motion.div>
    </motion.div>
  );
}

/* ─── steps ────────────────────────────────────────────────────────────────── */

/** "1 Details, 2 Review" at the top of a two-step sheet: a bar per step that fills as you go. */
export function StepDots({ steps, at }: { steps: string[]; at: number }) {
  const tr = useT();
  return (
    <ol className="grid gap-2 mb-4" style={{ gridTemplateColumns: `repeat(${steps.length}, minmax(0, 1fr))` }} aria-label={tr("Steps")}>
      {steps.map((s, i) => (
        <li key={s} className="min-w-0" aria-current={i === at ? 'step' : undefined}>
          <span className="block h-1 rounded-full overflow-hidden bg-[#eceef2]" aria-hidden="true">
            <span
              className="block h-full rounded-full bg-[#15171c] transition-[width] duration-300 ease-out motion-reduce:transition-none"
              style={{ width: i <= at ? '100%' : '0%' }}
            />
          </span>
          <span className="mt-1.5 flex items-center gap-1.5 text-[12.5px] font-semibold truncate" style={{ color: i <= at ? INK : INK_3 }}>
            {i < at ? <Check size={13} strokeWidth={2.6} aria-hidden="true" /> : <span className="tabular-nums" aria-hidden="true">{i + 1}</span>}
            {tr(s)}
          </span>
        </li>
      ))}
    </ol>
  );
}
