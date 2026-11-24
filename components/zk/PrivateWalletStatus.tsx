'use client';

/**
 * Settings → Payments: the real private wallet, read from this device only.
 * Balances and Fee Juice come from the local PXE through getPrivateWallet();
 * nothing here is sent to our servers. Removing local data deletes the OPFS
 * stores (pxe_data…, wallet_data…) after the wallet is stopped, and refuses
 * while anything is being proven or sent (fail-closed).
 */
import React, { useCallback, useEffect, useState } from 'react';
import { Lock, RefreshCw, Fuel, HardDrive, AlertTriangle } from 'lucide-react';
import { useAztecWallet } from '@/lib/aztec/wallet/useAztecWallet';
import { getPrivateWallet, humanError } from '@/lib/aztec/wallet/client';
import { AZTEC_WALLET_CONFIG, isWalletConfigured, networkLabel } from '@/lib/aztec/wallet/config';
import { formatUnits } from '@/lib/aztec/wallet/amounts';
import { countLocalAztecStores, wipeLocalAztecStores } from '@/lib/aztec/wallet/wipe';
import { useValueMode } from '@/lib/aztec/useValueMode';
import { EXITS_ONLY_MESSAGE } from '@/lib/aztec/value-mode';
import { useT } from '@/lib/i18n/client';

const PLAN_TEXT: Record<string, string> = {
  balance: 'Fees are paid from your Fee Juice balance.',
  claim: 'A bridged deposit is ready; the next transaction claims it and pays the fee.',
  'wait-claim': 'Your Fee Juice is still arriving from Ethereum. Transactions wait until it lands.',
  bridge: 'No Fee Juice. Bridge AZTEC from Ethereum before sending anything.',
  'top-up': 'Your Fee Juice does not cover a transaction’s maximum fee yet. Add more in one deposit.',
};

export function PrivateWalletStatus({ address }: { address: string }) {
  const t = useT();
  const { state, open } = useAztecWallet(address);
  const alpha = AZTEC_WALLET_CONFIG.network === 'mainnet';
  const ready = state.phase === 'ready';
  const valueMode = useValueMode();
  const [stores, setStores] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [working, setWorking] = useState<'open' | 'refresh' | 'wipe' | null>(null);
  const [confirmWipe, setConfirmWipe] = useState(false);
  const [wipeResult, setWipeResult] = useState<string | null>(null);

  const readStores = useCallback(() => { countLocalAztecStores().then(setStores); }, []);
  useEffect(readStores, [readStores, state.phase]);

  const run = async (kind: 'open' | 'refresh', fn: () => Promise<unknown>) => {
    if (working) return;
    setWorking(kind);
    setError(null);
    try { await fn(); } catch (e) { setError(t(humanError(e))); } finally { setWorking(null); }
  };

  const wipe = async () => {
    if (working) return;
    const w = getPrivateWallet();
    if (w.transacting) {
      setError(t("A private transaction is still running on this device. Wait for it to finish, then try again."));
      return;
    }
    setWorking('wipe');
    setError(null);
    try {
      // An open store cannot be deleted: stop the wallet first.
      await Promise.race([w.disconnect(), new Promise((r) => setTimeout(r, 2000))]);
      const res = await wipeLocalAztecStores();
      setWipeResult(
        res.failed.length
          ? `${res.failed.length} store(s) could not be removed. Close other Ledger Chat tabs and try again.`
          : 'Private wallet data removed from this device.',
      );
    } finally {
      setConfirmWipe(false);
      setWorking(null);
      readStores();
    }
  };

  if (!isWalletConfigured()) {
    return (
      <div className="bg-white rounded-2xl p-5 border border-[#e6e8ec] text-[13px] text-[#4a505c]">
        {t("Private payments are switched off on this build of Ledger Chat.")}
      </div>
    );
  }

  return (
    <div className="bg-white rounded-2xl p-5 border border-[#e6e8ec] space-y-4">
      <div className="flex items-start justify-between gap-3">
        <div className="flex items-center gap-2.5">
          <div className="w-9 h-9 rounded-xl bg-black/5 flex items-center justify-center text-[#15171c]"><Lock size={18} /></div>
          <div>
            <p className="font-semibold text-[16px] text-[#15171c]">{t("Private wallet")}</p>
            <p className="text-[12px] text-[#727a88]">
              {t(networkLabel())}{alpha ? t(", real funds, not audited") : t(", test tokens only")}
            </p>
          </div>
        </div>
        {ready ? (
          <button type="button" disabled={!!working || state.busy} onClick={() => run('refresh', async () => {
            const w = getPrivateWallet();
            await w.refresh();
            if (alpha) await w.refreshFeeJuice();
          })} className="text-[12.5px] font-semibold text-[#15171c] flex items-center gap-1.5 disabled:opacity-40">
            <RefreshCw size={14} className={working === 'refresh' ? 'animate-spin' : ''} />{" "}{t("Refresh")}
          </button>
        ) : (
          <button type="button" disabled={!!working} onClick={() => run('open', open)}
            className="px-3 py-1.5 rounded-xl bg-[#15171c] text-white text-[12.5px] font-semibold disabled:opacity-40">
            {working === 'open' || state.phase === 'signing' || state.phase === 'starting' ? t("Opening…") : t("Open wallet")}
          </button>
        )}
      </div>

      {state.step && !ready && <p className="text-[12.5px] text-[#727a88]">{state.step}</p>}

      {ready && (
        <div className="grid grid-cols-3 gap-2.5 pt-3 border-t border-black/[0.04]">
          {state.balances.map((b) => (
            <div key={b.key} className="p-3 rounded-xl bg-[#f2f4f7] min-w-0">
              <p className="text-[12px] font-semibold text-[#727a88]">{b.symbol}</p>
              <p className="text-[15px] font-semibold tabular-nums text-[#15171c] mt-0.5 truncate">{formatUnits(b.privateUnits, b.decimals)}</p>
              {b.publicUnits > 0n && <p className="text-[11px] text-[#727a88] truncate">{t("{formatUnits} public", { formatUnits: formatUnits(b.publicUnits, b.decimals) })}</p>}
            </div>
          ))}
        </div>
      )}

      {valueMode?.mode === 'exits-only' && !valueMode.unconfirmed && (
        <p role="status" className="rounded-xl bg-[#fdf3f2] border border-[#f3d4d0] px-3 py-2 text-[13px] text-[#7a2d24]">{EXITS_ONLY_MESSAGE}</p>
      )}

      {alpha && ready && (
        <div className="pt-3 border-t border-black/[0.04] flex gap-2.5">
          <Fuel size={16} className="text-[#15171c] shrink-0 mt-0.5" aria-hidden="true" />
          <div className="text-[13px] text-[#4a505c] space-y-0.5">
            <p className="font-semibold text-[#15171c]">{t("Fee Juice: {value}{value2}", { value: state.feeJuice ? formatUnits(state.feeJuice.balance, 18, 4) : '…', value2: state.feeJuice && state.feeJuice.claims.length > 0 && t(" · {length} deposit(s) pending", { length: state.feeJuice.claims.length }) })}
            </p>
            {state.feeJuice && <p>{t(PLAN_TEXT[state.feeJuice.plan]) ?? ''}</p>}
            <p className="text-[12px] text-[#727a88]">{t("Fees on Alpha are paid publicly from your account; amounts and recipients stay private.")}</p>
          </div>
        </div>
      )}

      <div className="pt-3 border-t border-black/[0.04] flex gap-2.5">
        <HardDrive size={16} className="text-[#15171c] shrink-0 mt-0.5" aria-hidden="true" />
        <div className="flex-1 text-[13px] text-[#4a505c] space-y-1.5">
          <p className="font-semibold text-[#15171c]">{t("On this device")}</p>
          <p>
            {stores === null
              ? t("This browser could not report its wallet storage.")
              : stores === 0
                ? t("No private wallet data is stored in this browser.")
                : t("Keys, notes and contacts for your private wallet are stored in this browser only. They are never sent to our servers.")}
          </p>
          {wipeResult && <p className="text-[#15171c]">{wipeResult}</p>}
          {stores !== 0 && !confirmWipe && (
            <button type="button" disabled={!!working} onClick={() => { setWipeResult(null); setConfirmWipe(true); }}
              className="text-[13px] font-semibold text-[#c0392b] disabled:opacity-40">
              {t("Remove private wallet data from this device")}
            </button>
          )}
          {confirmWipe && (
            <div className="rounded-xl bg-[#fdf3f2] border border-[#f3d4d0] p-3 space-y-2">
              <p className="flex gap-2 text-[12.5px] text-[#7a2d24]">
                <AlertTriangle size={14} className="shrink-0 mt-0.5" aria-hidden="true" />
                {t("Nothing on Aztec is lost: keys come back from your wallet signature and notes resync. Agreements are found again from their chat invitations, and payments from a sender appear once you exchange addresses with them again.")}
              </p>
              <div className="flex gap-2">
                <button type="button" onClick={() => setConfirmWipe(false)} className="px-3 py-1.5 rounded-xl text-[12px] font-semibold bg-white border border-black/[0.08]">{t("Cancel")}</button>
                <button type="button" disabled={!!working} onClick={wipe} className="px-3 py-1.5 rounded-xl text-[12px] font-semibold bg-[#c0392b] text-white disabled:opacity-40">
                  {working === 'wipe' ? t("Removing…") : t("Remove")}
                </button>
              </div>
            </div>
          )}
        </div>
      </div>

      {error && <p role="alert" className="text-[12.5px] text-[#c0392b]">{error}</p>}
    </div>
  );
}
