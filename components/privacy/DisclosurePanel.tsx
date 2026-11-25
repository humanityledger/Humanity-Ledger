'use client';

/**
 * components/privacy/DisclosurePanel.tsx — "Stays private / The network sees", for one action.
 *
 * Every sentence comes from lib/privacy/disclosure.ts, chosen by the network the wallet is on
 * (Aztec Alpha pays its own Fee Juice, the test network is sponsored). Two shapes:
 *  - the full panel, two columns, for the send review and shield/unshield;
 *  - `compact`, a native <details> line for cards in a conversation: closed by default, opens
 *    with the keyboard, no JavaScript state.
 */

import React from 'react';
import { ChevronDown, Eye, Lock } from 'lucide-react';
import { AZTEC_WALLET_CONFIG } from '@/lib/aztec/wallet/config';
import { disclosureFor, feeModeFor, type DisclosureAction } from '@/lib/privacy/disclosure';
import { useT } from '@/lib/i18n/client';

const EYEBROW = 'flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-[0.12em] text-[#5b606b]';

function Column({ title, icon, items, muted }: { title: string; icon: React.ReactNode; items: readonly string[]; muted?: boolean }) {
  const tr = useT();
  return (
    <div className={`px-4 py-3.5 ${muted ? 'bg-[#f7f8fa]' : 'bg-white'}`}>
      <p className={EYEBROW}>
        {icon}
        {title}
      </p>
      <ul className="mt-2 space-y-1.5">
        {items.map((item) => (
          <li key={item} className="text-[13.5px] leading-snug text-[#3d424b]">
            {tr(item)}
          </li>
        ))}
      </ul>
    </div>
  );
}

export function DisclosurePanel({ action, compact = false, network = AZTEC_WALLET_CONFIG.network }: { action: DisclosureAction; compact?: boolean; network?: string }) {
  const t = useT();
  const d = disclosureFor(action, feeModeFor(network));

  if (compact) {
    return (
      <details className="group mt-3 border-t border-[#eef0f3] pt-2.5" data-testid="disclosure-compact">
        <summary className="flex cursor-pointer list-none items-center justify-between gap-2 text-[12.5px] font-medium text-[#3d424b] [&::-webkit-details-marker]:hidden">
          <span className="inline-flex items-center gap-1.5">
            <Lock className="h-3.5 w-3.5" aria-hidden />
            {t("What stays private")}
          </span>
          <ChevronDown className="h-3.5 w-3.5 transition-transform group-open:rotate-180 motion-reduce:transition-none" aria-hidden />
        </summary>
        <p className="mt-2 text-[12.5px] leading-snug text-[#5b606b]">{t(d.summary)}</p>
      </details>
    );
  }

  return (
    <section aria-label={t("What this action reveals")} className="overflow-hidden rounded-2xl border border-[#e4e7ec]" data-testid="disclosure-panel">
      <div className="grid grid-cols-1 divide-y divide-[#eef0f3] sm:grid-cols-2 sm:divide-x sm:divide-y-0">
        <Column title={t("Stays private")} icon={<Lock className="h-3.5 w-3.5" aria-hidden />} items={d.private} />
        <Column title={t("The network sees")} icon={<Eye className="h-3.5 w-3.5" aria-hidden />} items={d.public} muted />
      </div>
    </section>
  );
}
