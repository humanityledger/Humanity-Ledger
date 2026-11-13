'use client';

/**
 * AlphaNetworkBanner — shown when NEXT_PUBLIC_AZTEC_NETWORK=alpha.
 *
 * This component is intentionally only rendered by components that import it
 * directly. It never renders on the test network (ALPHA constant is false
 * at build time), so the bundle impact is zero in the default build.
 *
 * Purpose: inform users clearly that:
 *  - private payments use real ETH (Aztec Alpha on Ethereum mainnet)
 *  - the protocol has not been externally audited yet (G8 open)
 *  - value caps are in effect per NEXT_PUBLIC_AZTEC_AGREEMENT_CAPS
 *
 * Design: compact, dismissible per session, never blocks interaction.
 */

import React, { useState } from 'react';
import { AlertTriangle, X, ExternalLink } from 'lucide-react';
import { AZTEC_WALLET_CONFIG, networkLabel } from '@/lib/aztec/wallet/config';

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
 * On Aztec Alpha: shows a persistent "real funds, unaudited" banner once per session.
 */
export function AlphaNetworkBanner({ className = '', variant = 'strip' }: AlphaNetworkBannerProps) {
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
              Aztec Alpha — real funds, unaudited
            </p>
            <p className="mt-1 text-[12px] text-[#92400E] leading-relaxed">
              Private payments run on {networkLabel()} (Ethereum mainnet). This software has not been
              externally audited. Use small amounts only. Transactions cannot be reversed.
            </p>
            <div className="mt-2 flex items-center gap-3">
              <a
                href="https://docs.aztec.network/aztec/concepts/aztec_network_vs_ethereum"
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-1 text-[11.5px] font-medium text-[#9A3412] underline underline-offset-2 hover:no-underline"
              >
                Learn more <ExternalLink size={11} />
              </a>
            </div>
          </div>
          <button
            type="button"
            onClick={handleDismiss}
            aria-label="Dismiss alpha warning"
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
          <strong className="font-semibold">Aztec Alpha</strong> · Real ETH · Unaudited · Keep amounts small
        </span>
      </div>
      <div className="flex items-center gap-2 shrink-0">
        <a
          href="https://docs.aztec.network/aztec/concepts/aztec_network_vs_ethereum"
          target="_blank"
          rel="noopener noreferrer"
          className="hidden sm:inline-flex items-center gap-1 text-[11.5px] font-medium underline underline-offset-2 hover:no-underline"
        >
          Info <ExternalLink size={10} />
        </a>
        <button
          type="button"
          onClick={handleDismiss}
          aria-label="Dismiss"
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
      {ALPHA ? 'Aztec Alpha · Ethereum mainnet' : 'Aztec test network'}
    </span>
  );
}

/**
 * Alpha gate info box — rendered inside the ZkWalletPanel when Alpha is active,
 * explaining Fee Juice and audit status at a glance.
 */
export function AlphaInfoBox({ className = '' }: { className?: string }) {
  if (!ALPHA) return null;
  return (
    <div className={`rounded-xl border border-[#E4E7EC] bg-[#F7F8FA] px-4 py-3.5 ${className}`}>
      <p className="text-[13px] font-semibold text-[#15171C] leading-snug">
        Aztec Alpha · Ethereum mainnet
      </p>
      <ul className="mt-2 space-y-1.5 text-[12.5px] text-[#475467] leading-relaxed list-none">
        <li>Fees paid in Fee Juice (bridged AZTEC from L1)</li>
        <li>Private transfers are proven on your device</li>
        <li className="text-[#92400E] font-medium">Protocol not yet externally audited — keep amounts small</li>
        <li>Transactions are irreversible on Ethereum mainnet</li>
      </ul>
    </div>
  );
}
