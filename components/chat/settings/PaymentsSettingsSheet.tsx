'use client';

/**
 * components/chat/settings/PaymentsSettingsSheet.tsx — Settings → Payments.
 *
 * Receive-only and per-payment limits (lib/payments/personal-limits.ts), a 30-day summary and a CSV
 * export (lib/payments/activity-report.ts). Everything is computed and stored on this device; the
 * summary and the export read the private wallet's own activity record.
 */

import React, { useMemo, useState } from 'react';
import { toast } from 'sonner';
import { AZTEC_WALLET_CONFIG, networkLabel } from '@/lib/aztec/wallet/config';
import { formatUnits } from '@/lib/aztec/wallet/amounts';
import { getPrivateWallet } from '@/lib/aztec/wallet/client';
import { limitUnits, loadLimits, saveLimits, type PersonalLimits } from '@/lib/payments/personal-limits';
import { activityCsv, activityTotals } from '@/lib/payments/activity-report';
import { useT } from '@/lib/i18n/client';

const DAY = 86_400_000;
const LABEL = 'block text-[12px] font-semibold uppercase tracking-[0.1em] text-[#5b606b]';

export function PaymentsSettingsSheet({ onClose }: { onClose: () => void }) {
  const tr = useT();
  const tokens = AZTEC_WALLET_CONFIG.tokens;
  const [limits, setLimits] = useState<PersonalLimits>(() => loadLimits());
  const [drafts, setDrafts] = useState<Record<string, string>>(() =>
    Object.fromEntries(tokens.map((t) => [t.key, limits.perPayment[t.key] ? formatUnits(BigInt(limits.perPayment[t.key]), t.decimals, t.decimals).replace(/,/g, '') : ''])),
  );
  const [error, setError] = useState<string | null>(null);
  const activity = typeof window === 'undefined' ? [] : getPrivateWallet().state.activity ?? [];
  const totals = useMemo(() => activityTotals(activity, tokens, Date.now() - 30 * DAY), [activity, tokens]);

  const save = () => {
    try {
      const perPayment: Record<string, string> = {};
      for (const t of tokens) {
        const u = limitUnits(drafts[t.key] ?? '', t.decimals);
        if (u) perPayment[t.key] = u;
      }
      const next = { ...limits, perPayment };
      saveLimits(next);
      setLimits(next);
      toast.success(tr("Payment settings saved on this device"));
      onClose();
    } catch (e) {
      setError(e instanceof Error ? e.message : tr("Check the limits."));
    }
  };

  const exportCsv = () => {
    const csv = activityCsv(activity, tokens, networkLabel());
    const a = document.createElement('a');
    a.href = URL.createObjectURL(new Blob([csv], { type: 'text/csv;charset=utf-8' }));
    a.download = `ledger-chat-payments-${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    setTimeout(() => URL.revokeObjectURL(a.href), 10_000);
  };

  return (
    <div className="px-6 pb-6" data-testid="payments-settings">
      <h3 className="text-[20px] font-semibold text-[#15171c] mb-1">{tr("Payments")}</h3>
      <p className="text-[14px] text-[#5b606b] leading-relaxed mb-4">{tr("Kept on this device only. They guard against mistakes on this device; anyone who controls it can change them.")}</p>

      <label className="flex items-center justify-between gap-4 rounded-xl border border-[#e4e7ec] px-4 py-3">
        <span>
          <span className="block text-[15px] font-semibold text-[#15171c]">{tr("Receive only")}</span>
          <span className="block text-[13px] text-[#5b606b]">{tr("This device cannot send private payments. Receiving and requests still work.")}</span>
        </span>
        <input type="checkbox" className="h-5 w-5 accent-[#15171c]" checked={limits.receiveOnly} onChange={(e) => setLimits({ ...limits, receiveOnly: e.target.checked })} />
      </label>

      <p className={`${LABEL} mt-5 mb-2`}>{tr("Limit per payment")}</p>
      <div className="grid gap-2">
        {tokens.map((t) => (
          <label key={t.key} className="flex items-center gap-3 rounded-xl border border-[#e4e7ec] px-4 h-12">
            <span className="w-16 text-[14px] font-semibold text-[#15171c]">{t.symbol}</span>
            <input inputMode="decimal" placeholder={tr("No limit")} value={drafts[t.key] ?? ''} onChange={(e) => setDrafts({ ...drafts, [t.key]: e.target.value })} className="flex-1 bg-transparent text-right text-[15px] tabular-nums text-[#15171c] outline-none" aria-label={tr("Limit per payment in {symbol}", { symbol: t.symbol })} />
          </label>
        ))}
      </div>
      {error && <p role="alert" className="mt-2 text-[13px] text-[#b42318]">{error}</p>}

      <p className={`${LABEL} mt-5 mb-2`}>{tr("Last 30 days")}</p>
      {totals.length ? (
        <dl className="rounded-xl border border-[#e4e7ec] px-4 py-2">
          {totals.map((t) => {
            const d = tokens.find((x) => x.key === t.token)?.decimals ?? 6;
            return (
              <div key={t.token} className="flex justify-between gap-3 py-1.5 text-[14px]">
                <dt className="text-[#5b606b]">{t.symbol}</dt>
                <dd className="m-0 tabular-nums text-[#15171c]">{tr("Sent {formatUnits}, received {formatUnits2}", { formatUnits: formatUnits(t.sent, d), formatUnits2: formatUnits(t.received, d) })}</dd>
              </div>
            );
          })}
        </dl>
      ) : (
        <p className="text-[13.5px] text-[#5b606b]">{tr("Nothing settled in the last 30 days{value}.", { value: getPrivateWallet().state.phase === 'ready' ? '' : tr(", or your private wallet is closed") })}</p>
      )}
      <button type="button" onClick={exportCsv} disabled={!activity.length} className="mt-3 w-full h-11 rounded-xl border border-[#d0d5dd] bg-white text-[#15171c] font-semibold text-[14.5px] disabled:opacity-50">{tr("Download report (CSV)")}</button>
      <p className="mt-2 text-[12.5px] text-[#5b606b]">{tr("Made on this device from your wallet’s record, for your own accounts or your adviser. Nothing is uploaded.")}</p>

      <div className="mt-5 grid gap-2">
        <button type="button" onClick={save} className="w-full h-12 rounded-xl bg-[#15171c] text-white font-semibold text-[15px]">{tr("Save")}</button>
        <button type="button" onClick={onClose} className="w-full h-11 text-[#5b606b] font-semibold text-[15px]">{tr("Cancel")}</button>
      </div>
    </div>
  );
}
