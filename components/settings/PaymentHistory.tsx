'use client';
/**
 * Settings > Payments > Transaction history: the private wallet's activity on this device, newest
 * first, with a CSV export of all of it (lib/payments/history-csv.ts). There is no server history:
 * with the wallet closed, the list says how to open it.
 */
import React, { useEffect, useState } from 'react';
import { ArrowDownLeft, ArrowUpRight, Download, Lock, LockOpen } from 'lucide-react';
import { getPrivateWallet, type WalletSnapshot } from '@/lib/aztec/wallet/client';
import { activityAmount } from '@/components/zk/wallet/walletLogic';
import { historyCsv, kindLabel } from '@/lib/payments/history-csv';
import { toast } from 'sonner';
import { useT } from '@/lib/i18n/client';

const ICON: Record<string, React.ReactNode> = {
  send: <ArrowUpRight size={16} />, receive: <ArrowDownLeft size={16} />, shield: <Lock size={15} />, unshield: <LockOpen size={15} />,
};
const STATUS: Record<string, { text: string; cls: string }> = {
  settled: { text: 'Settled', cls: 'text-[#047857]' },
  pending: { text: 'Pending', cls: 'text-[#B54708]' },
  proving: { text: 'Proving', cls: 'text-[#B54708]' },
  failed: { text: 'Failed', cls: 'text-[#B42318]' },
};

export function PaymentHistory() {
  const t = useT();
  const [w, setW] = useState<WalletSnapshot | null>(() => (typeof window === 'undefined' ? null : getPrivateWallet().state));
  useEffect(() => getPrivateWallet().subscribe(setW), []);
  const items = (w?.activity ?? []).filter((a) => a.kind !== 'deploy').slice().sort((a, b) => b.createdAt - a.createdAt);
  const open = w?.phase === 'ready';

  const exportCsv = () => {
    if (!items.length) { toast.info(t("No private payments on this device yet.")); return; }
    const csv = historyCsv(items.map((a) => ({ createdAt: a.createdAt, kind: a.kind, amount: activityAmount(a), status: a.status, txHash: a.txHash })));
    const url = URL.createObjectURL(new Blob([csv], { type: 'text/csv;charset=utf-8' }));
    const link = document.createElement('a');
    link.href = url;
    link.download = `ledger-chat-private-payments-${new Date().toISOString().slice(0, 10)}.csv`;
    link.click();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
    toast.success(t("Exported {length} {value}.", { length: items.length, value: items.length === 1 ? 'entry' : 'entries' }));
  };

  return (
    <div className="mb-6" data-testid="payment-history">
      <div className="flex items-center justify-between px-1 mb-1.5">
        <p className="text-[13px] font-medium text-[#727a88]">{t("Transaction history")}</p>
        <button type="button" onClick={exportCsv} className="inline-flex items-center gap-1.5 text-[12.5px] font-semibold text-[#5200FF] hover:underline disabled:opacity-40" disabled={!items.length}>
          <Download size={13} />{" "}{t("Export CSV")}
        </button>
      </div>
      <div className="bg-white rounded-2xl border border-[#e6e8ec] overflow-hidden">
        {!items.length ? (
          <p className="px-4 py-4 text-[13px] leading-snug text-[#727a88]">
            {open ? t("No private payments on this device yet.") : t("Open your private wallet in a chat to see the payments made on this device. There is no server copy.")}
          </p>
        ) : (
          <ul className="divide-y divide-black/[0.04]">
            {items.slice(0, 12).map((a) => {
              const st = STATUS[a.status] ?? { text: a.status, cls: 'text-[#727a88]' };
              return (
                <li key={a.id} className="flex items-center gap-3 px-4 py-3">
                  <span className="grid h-8 w-8 shrink-0 place-items-center rounded-full bg-[#F7F8FA] text-[#15171c]" aria-hidden>{t(ICON[a.kind]) ?? <ArrowUpRight size={16} />}</span>
                  <span className="min-w-0 flex-1">
                    <span className="block text-[14px] font-medium text-[#15171c]">{t(kindLabel(a.kind))}</span>
                    <span className="block text-[12px] text-[#727a88]">{new Date(a.createdAt).toLocaleString(undefined, { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })}</span>
                  </span>
                  <span className="text-right">
                    <span className="block text-[14px] font-semibold tabular-nums text-[#15171c]">{activityAmount(a) || ' '}</span>
                    <span className={`block text-[12px] font-medium ${st.cls}`}>{t(st.text)}</span>
                  </span>
                </li>
              );
            })}
          </ul>
        )}
      </div>
      {items.length > 12 && <p className="text-[12.5px] text-[#727a88] px-1 mt-2">{t("Showing the 12 most recent of {length}. The CSV has all of them.", { length: items.length })}</p>}
    </div>
  );
}
