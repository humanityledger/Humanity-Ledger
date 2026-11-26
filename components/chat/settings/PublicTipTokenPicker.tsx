'use client';
/**
 * Settings → Payments → Public tip token.
 *
 * A real choice with visible results: the selected row is marked, the user's
 * own balance of each coin on Ethereum mainnet is shown (read from their
 * connected wallet, nothing invented), and saving confirms which coin the
 * Tip / Payment sheet will now open on. The value lives in the `default_token`
 * setting, which syncs to the user's other devices (lib/settings/schema.ts).
 */
import React, { useCallback, useRef } from 'react';
import { Check } from 'lucide-react';
import { toast } from 'sonner';
import { useAccount, useBalance, useReadContracts } from 'wagmi';
import { formatUnits } from 'viem';
import { useT } from '@/lib/i18n/client';
import {
  PUBLIC_TIP_CHAIN_ID,
  PUBLIC_TIP_TOKENS,
  resolveTipToken,
  type PublicTipSymbol,
} from '@/lib/payments/publicTipTokens';

const BALANCE_OF_ABI = [{
  name: 'balanceOf', type: 'function', stateMutability: 'view',
  inputs: [{ name: 'a', type: 'address' }], outputs: [{ name: '', type: 'uint256' }],
}] as const;

function short(raw: bigint, decimals: number): string {
  const n = Number(formatUnits(raw, decimals));
  if (n === 0) return '0';
  if (n < 0.0001) return '<0.0001';
  return n.toLocaleString(undefined, { maximumFractionDigits: n >= 100 ? 2 : 4 });
}

export function PublicTipTokenPicker({
  value,
  paymentsEnabled,
  onChange,
}: {
  value: unknown;
  paymentsEnabled: boolean;
  onChange: (symbol: PublicTipSymbol) => void | Promise<void>;
}) {
  const tr = useT();
  const selected = resolveTipToken(value).symbol;
  const { address } = useAccount();
  const rows = useRef<Array<HTMLButtonElement | null>>([]);

  const enabled = !!address;
  const { data: eth } = useBalance({ address, chainId: PUBLIC_TIP_CHAIN_ID, query: { enabled, staleTime: 60_000 } });
  const erc20 = PUBLIC_TIP_TOKENS.filter(t => t.address);
  const { data: tokenBals } = useReadContracts({
    contracts: erc20.map(t => ({
      address: t.address!, abi: BALANCE_OF_ABI, functionName: 'balanceOf' as const,
      args: [address!] as const, chainId: PUBLIC_TIP_CHAIN_ID,
    })),
    query: { enabled, staleTime: 60_000 },
  });

  const balanceOf = (symbol: PublicTipSymbol): string | null => {
    if (!enabled) return null;
    const t = PUBLIC_TIP_TOKENS.find(x => x.symbol === symbol)!;
    if (!t.address) return eth ? short(eth.value, eth.decimals) : null;
    const i = erc20.findIndex(x => x.symbol === symbol);
    const r = tokenBals?.[i];
    return r && r.status === 'success' ? short(r.result as bigint, t.decimals) : null;
  };

  const choose = useCallback(async (symbol: PublicTipSymbol) => {
    if (symbol === selected) {
      toast(tr("Public tips already open in {symbol}", { symbol }));
      return;
    }
    try { navigator.vibrate?.(10); } catch {}
    try {
      await onChange(symbol);
      toast.success(tr("Public tips will open in {symbol}", { symbol }), {
        description: tr("Saved on this device and synced to your other devices."),
      });
    } catch {
      toast.error(tr("Could not save. Try again."));
    }
  }, [selected, onChange, tr]);

  // Arrow keys move between options, as in a native radio group.
  const onKeyDown = (e: React.KeyboardEvent, i: number) => {
    const n = PUBLIC_TIP_TOKENS.length;
    const next = e.key === 'ArrowDown' || e.key === 'ArrowRight' ? (i + 1) % n
      : e.key === 'ArrowUp' || e.key === 'ArrowLeft' ? (i - 1 + n) % n : -1;
    if (next < 0) return;
    e.preventDefault();
    rows.current[next]?.focus();
    void choose(PUBLIC_TIP_TOKENS[next].symbol);
  };

  return (
    <div>
      {!paymentsEnabled && (
        <p className="text-[12.5px] text-[#9a6700] bg-[#fff8e6] rounded-xl px-3 py-2 mt-3">
          {tr("Payments in chats are off, so Tip and /pay are hidden. Your choice is kept for when you turn them on.")}
        </p>
      )}
      <div role="radiogroup" aria-label={tr("Public tip token")} className="py-1">
        {PUBLIC_TIP_TOKENS.map((t, i) => {
          const on = t.symbol === selected;
          const bal = balanceOf(t.symbol);
          return (
            <button
              key={t.symbol}
              ref={el => { rows.current[i] = el; }}
              type="button"
              role="radio"
              aria-checked={on}
              tabIndex={on ? 0 : -1}
              onClick={() => void choose(t.symbol)}
              onKeyDown={e => onKeyDown(e, i)}
              className={`w-full min-h-[52px] flex items-center gap-3 px-2 -mx-2 my-0.5 rounded-xl text-left transition-colors outline-none focus-visible:ring-2 focus-visible:ring-[#15171c]/30 ${
                on ? 'bg-[#f2f4f7]' : 'hover:bg-[#f7f8fa] active:bg-[#eef0f3]'
              }`}
            >
              <span
                aria-hidden="true"
                className="w-8 h-8 rounded-full flex items-center justify-center text-white text-[14px] font-semibold shrink-0"
                style={{ backgroundColor: t.color }}
              >
                {t.glyph}
              </span>
              <span className="flex-1 min-w-0">
                <span className="block text-[15px] font-semibold text-[#15171c] leading-tight">{t.symbol}</span>
                <span className="block text-[12.5px] text-[#727a88] leading-tight mt-0.5">
                  {t.name}{bal !== null ? ` · ${tr("Balance {value}", { value: bal })}` : ''}
                </span>
              </span>
              <span
                aria-hidden="true"
                className={`w-6 h-6 rounded-full flex items-center justify-center shrink-0 transition-all ${
                  on ? 'bg-[#15171c] scale-100' : 'border-2 border-[#d0d5dd] scale-90'
                }`}
              >
                {on && <Check size={14} className="text-white" strokeWidth={3} />}
              </span>
            </button>
          );
        })}
      </div>
      <p className="text-[12.5px] text-[#475467] pb-3 pt-1" aria-live="polite">
        {tr("Tip and /pay open in {symbol}. You can still switch coin in the sheet.", { symbol: selected })}
      </p>
    </div>
  );
}
