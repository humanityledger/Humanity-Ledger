'use client';

/**
 * Nemi, a private exchange listed in Aztec's ecosystem directory, from the wallet's side.
 *
 * Community apps cannot embed it (their frame allows no network and no frames, by design:
 * lib/community-apps/framePolicy.ts), so this is a host-side card: it shows the real private
 * balances this wallet holds, lets the person copy their Aztec address to receive the swap, links
 * out (noopener noreferrer), and reads the balances again when they come back. Ledger Chat is not
 * affiliated with Nemi and does not see the swap.
 */

import React, { useState } from 'react';
import { ArrowUpRight, Copy, RefreshCw } from 'lucide-react';
import { toast } from 'sonner';
import { useT } from '@/lib/i18n/client';
import { formatUnits } from '@/lib/aztec/wallet/amounts';
import type { TokenBalance } from '@/lib/aztec/wallet/client';

/** Where "Open" goes: the operator's configured Nemi URL, else Aztec's directory entry. */
export const NEMI_URL: string = process.env.NEXT_PUBLIC_NEMI_URL?.trim() || 'https://aztec.network/projects';

export interface NemiDexPanelProps {
  aztecAddress?: string | null;
  balances?: ReadonlyArray<TokenBalance>;
  /** Reads balances again (after coming back from a swap). */
  onRefresh?: () => Promise<unknown>;
}

export function NemiDexPanel({ aztecAddress, balances = [], onRefresh }: NemiDexPanelProps) {
  const t = useT();
  const [busy, setBusy] = useState(false);
  const configured = !!process.env.NEXT_PUBLIC_NEMI_URL?.trim();
  const refresh = async () => {
    if (!onRefresh) return;
    setBusy(true);
    try { await onRefresh(); toast.success(t('Balances updated.')); } catch { toast.error(t('The balances could not be read. Try again.')); } finally { setBusy(false); }
  };
  return (
    <section className="rounded-2xl border border-[#e4e7ec] bg-white p-4 flex flex-col gap-3" aria-label={t('Private swap with Nemi')}>
      <div>
        <h3 className="text-[15px] font-semibold text-[#15171c]">{t('Private swap with Nemi')}</h3>
        <p className="text-[13px] leading-snug text-[#475061] mt-0.5">
          {t('Nemi is an exchange on Aztec that keeps the trader private. It is a separate service: Ledger Chat is not part of the swap and does not see it.')}
        </p>
      </div>
      {balances.length > 0 && (
        <ul className="flex flex-col divide-y divide-[#f2f4f7] rounded-xl border border-[#e4e7ec]">
          {balances.map((b) => (
            <li key={b.key} className="flex items-center justify-between px-3 py-2 text-[13.5px]">
              <span className="text-[#15171c] font-medium">{b.symbol}</span>
              <span className="tabular-nums text-[#475061]">{t('{amount} private', { amount: formatUnits(b.privateUnits, b.decimals, 2) })}</span>
            </li>
          ))}
        </ul>
      )}
      <div className="flex flex-wrap gap-2">
        {aztecAddress && (
          <button type="button" className="inline-flex items-center gap-1.5 min-h-[44px] px-3.5 rounded-xl border border-[#d0d5dd] text-[13.5px] font-medium text-[#15171c] hover:bg-[#f2f4f7]"
            onClick={() => navigator.clipboard?.writeText(aztecAddress).then(() => toast.success(t('Aztec address copied.')), () => toast.error(t('Not copied.')))}>
            <Copy size={15} aria-hidden="true" />{t('Copy my Aztec address')}
          </button>
        )}
        <a href={NEMI_URL} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1.5 min-h-[44px] px-3.5 rounded-xl bg-[#15171c] text-white text-[13.5px] font-medium hover:bg-[#2a2d34]">
          {configured ? t('Open Nemi') : t('Find Nemi in the Aztec directory')}<ArrowUpRight size={15} aria-hidden="true" />
        </a>
        {onRefresh && (
          <button type="button" disabled={busy} onClick={refresh} className="inline-flex items-center gap-1.5 min-h-[44px] px-3.5 rounded-xl border border-[#d0d5dd] text-[13.5px] font-medium text-[#15171c] hover:bg-[#f2f4f7] disabled:opacity-50">
            <RefreshCw size={15} aria-hidden="true" />{busy ? t('Reading…') : t('I am back: read balances')}
          </button>
        )}
      </div>
      <p className="text-[12px] text-[#727a88]">{t('Check the address in the other app before you confirm a swap.')}</p>
    </section>
  );
}
