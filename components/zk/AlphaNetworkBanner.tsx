'use client';

/**
 * AlphaNetworkBanner — shown when NEXT_PUBLIC_AZTEC_NETWORK=alpha.
 *
 * This component is intentionally only rendered by components that import it
 * directly. It never renders on the test network (ALPHA constant is false
 * at build time), so the bundle impact is zero in the default build.
 *
 * Purpose: inform users clearly that:
 *  - payments in the closed alpha use HLC, a test token with no monetary value (PA-1),
 *    on Aztec Alpha (Ethereum mainnet); network fees are paid in Fee Juice, which has value
 *  - the protocol has not been externally audited yet (G8 open)
 *  - value caps are in effect per NEXT_PUBLIC_AZTEC_AGREEMENT_CAPS
 *
 * Design: compact, dismissible per session, never blocks interaction.
 */

import { PRIVATE_ASSET } from '@/lib/payments/private-asset';
import React, { useState } from 'react';
import { AlertTriangle, X, ExternalLink, Coins, Cpu, Fuel, ShieldAlert, Undo2 } from 'lucide-react';
import { AZTEC_WALLET_CONFIG, networkLabel } from '@/lib/aztec/wallet/config';
import { useT } from '@/lib/i18n/client';

/** True at build time when Alpha is active. Zero cost when false. */
const ALPHA = AZTEC_WALLET_CONFIG.network === 'mainnet';

/** Session key — banner stays dismissed until page reload. */
const DISMISSED_KEY = 'hl_alpha_banner_dismissed_v1';

function wasDismissed(): boolean {
  if (typeof sessionStorage === 'undefined') return false;
  return sessionStorage.getItem(DISMISSED_KEY) === '1';
}

function dismiss() {
  try { sessionStorage.setItem(DISMISSED_KEY, '1'); } catch { /* storage blocked */ }
}

interface AlphaNetworkBannerProps {
  /** Additional Tailwind classes. */
  className?: string;
  /** Render as a slim inline strip (default) or a full card. */
  variant?: 'strip' | 'card';
}

/**
 * Renders nothing on the test network.
 * On Aztec Alpha: shows a persistent "test token, no external audit" banner once per session.
 */
export function AlphaNetworkBanner({ className = '', variant = 'strip' }: AlphaNetworkBannerProps) {
  const t = useT();
  const [dismissed, setDismissed] = useState(() => wasDismissed());

  if (!ALPHA || dismissed) return null;

  const handleDismiss = () => {
    dismiss();
    setDismissed(true);
  };

  if (variant === 'card') {
    return (
      <div
        role="status"
        aria-live="polite"
        className={`rounded-2xl border border-[#F97316]/30 bg-[#FFF7ED] px-4 py-3.5 ${className}`}
      >
        <div className="flex items-start gap-3">
          <span className="mt-0.5 shrink-0 text-[#C2410C]">
            <AlertTriangle size={16} strokeWidth={2} />
          </span>
          <div className="min-w-0 flex-1">
            <p className="text-[13px] font-semibold text-[#9A3412] leading-snug">
              {PRIVATE_ASSET.test ? t("Aztec Alpha: HLC is a test token with no monetary value") : t("Aztec Alpha: payments in cUSDC move real value")}
            </p>
            <p className="mt-1 text-[12px] text-[#92400E] leading-relaxed">{t("Private payments run on {networkLabel} (Ethereum mainnet) with {phrase}. Network fees are paid in Fee Juice, which does have value. This software has had an internal security review, not an external audit. Every payment has a cap. Transactions cannot be reversed.", { networkLabel: t(networkLabel()), phrase: t(PRIVATE_ASSET.phrase) })}</p>
            <div className="mt-2 flex items-center gap-3">
              <a
                href="https://docs.aztec.network/aztec/concepts/aztec_network_vs_ethereum"
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-1 text-[11.5px] font-medium text-[#9A3412] underline underline-offset-2 hover:no-underline"
              >
                {t("Learn more")}{" "}<ExternalLink size={11} />
              </a>
            </div>
          </div>
          <button
            type="button"
            onClick={handleDismiss}
            aria-label={t("Dismiss alpha warning")}
            className="shrink-0 mt-0.5 w-6 h-6 flex items-center justify-center rounded-full text-[#9A3412]/60 hover:bg-[#FED7AA] hover:text-[#9A3412] transition-colors"
          >
            <X size={12} strokeWidth={2.5} />
          </button>
        </div>
      </div>
    );
  }

  // Strip variant — compact, dismissible
  return (
    <div
      role="status"
      aria-live="polite"
      className={`flex items-center justify-between gap-2 px-4 h-9 bg-[#FFF7ED] border-b border-[#FED7AA] text-[12.5px] text-[#92400E] ${className}`}
    >
      <div className="flex items-center gap-2 min-w-0">
        <AlertTriangle size={13} strokeWidth={2} className="shrink-0" aria-hidden="true" />
        <span className="truncate">
          {t("{0} · {value} · Fees in Fee Juice · No external audit", { 0: <strong className="font-semibold">{t("Aztec Alpha")}</strong>, value: PRIVATE_ASSET.test ? t("HLC test token, no value") : t("cUSDC, real value, capped") })}</span>
      </div>
      <div className="flex items-center gap-2 shrink-0">
        <a
          href="https://docs.aztec.network/aztec/concepts/aztec_network_vs_ethereum"
          target="_blank"
          rel="noopener noreferrer"
          className="hidden sm:inline-flex items-center gap-1 text-[11.5px] font-medium underline underline-offset-2 hover:no-underline"
        >
          {t("Info")}{" "}<ExternalLink size={10} />
        </a>
        <button
          type="button"
          onClick={handleDismiss}
          aria-label={t("Dismiss")}
          className="w-5 h-5 flex items-center justify-center rounded-full hover:bg-[#FED7AA] transition-colors"
        >
          <X size={12} strokeWidth={2.5} />
        </button>
      </div>
    </div>
  );
}

/**
 * Inline network status pill — used in settings panels and footers.
 * Shows "Aztec Alpha · mainnet" or "Aztec test network" with an appropriate dot.
 */
export function NetworkStatusPill({ className = '' }: { className?: string }) {
  const t = useT();
  return (
    <span
      className={`inline-flex items-center gap-1.5 text-[11.5px] font-medium px-2.5 py-1 rounded-full border ${
        ALPHA
          ? 'bg-[#FFF7ED] border-[#FED7AA] text-[#9A3412]'
          : 'bg-[#F0FDF4] border-[#BBF7D0] text-[#166534]'
      } ${className}`}
    >
      <span
        className={`w-1.5 h-1.5 rounded-full ${ALPHA ? 'bg-[#F97316]' : 'bg-[#22C55E]'}`}
        aria-hidden="true"
      />
      {ALPHA ? t("Aztec Alpha · Ethereum mainnet") : t("Aztec test network")}
    </span>
  );
}

/**
 * How the private wallet works on Aztec Alpha, in five plain lines: rendered inside the
 * ZkWalletPanel overview. The token line follows the build (cUSDC for beta members, or for everyone).
 */
export function AlphaInfoBox({ className = '' }: { className?: string }) {
  const t = useT();
  if (!ALPHA) return null;
  const rows: { icon: React.ReactNode; text: string; warn?: boolean }[] = [
    { icon: <Coins size={15} strokeWidth={1.9} />, text: `Private payments in ${PRIVATE_ASSET.phrase}` },
    { icon: <Cpu size={15} strokeWidth={1.9} />, text: t("Every transfer is proven on this device; amount and recipient stay private") },
    { icon: <Fuel size={15} strokeWidth={1.9} />, text: t("Network fees in Fee Juice, bridged from Ethereum, paid by your own account") },
    { icon: <ShieldAlert size={15} strokeWidth={1.9} />, text: t("No external audit yet. Each payment has a cap; keep amounts small"), warn: true },
    { icon: <Undo2 size={15} strokeWidth={1.9} />, text: t("Transactions cannot be reversed") },
  ];
  return (
    <section className={`rounded-2xl border border-[#E4E7EC] bg-white ${className}`} aria-label={t("How the private wallet works")}>
      <div className="flex items-center justify-between gap-3 px-4 pt-3.5 pb-2.5">
        <p className="text-[14px] font-semibold text-[#15171C]">{t("How it works")}</p>
        <span className="rounded-full bg-[#F7F8FA] border border-[#E4E7EC] px-2.5 py-0.5 text-[11.5px] font-medium text-[#475467]">{t("Aztec Alpha")}</span>
      </div>
      <ul className="divide-y divide-[#F2F4F7] border-t border-[#F2F4F7]">
        {rows.map((r) => (
          <li key={r.text} className="flex items-start gap-3 px-4 py-2.5">
            <span className={`mt-[1px] shrink-0 ${r.warn ? 'text-[#C2410C]' : 'text-[#5200FF]'}`} aria-hidden="true">{r.icon}</span>
            <span className={`text-[13px] leading-snug ${r.warn ? 'text-[#9A3412] font-medium' : 'text-[#344054]'}`}>{r.text}</span>
          </li>
        ))}
      </ul>
    </section>
  );
}
