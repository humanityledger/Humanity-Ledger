'use client';

import React, { useRef, useState } from 'react';
import { X, Heart } from 'lucide-react';
import { useAccount, useSendTransaction, useWriteContract } from 'wagmi';
import { isAddress, parseEther, parseUnits, type Address } from 'viem';
import { mainnet } from 'viem/chains';
import { toast } from 'sonner';

/**
 * Public tip in ETH or USDC on Ethereum mainnet, sent from the user's own wallet.
 *
 * Both tokens are pinned to chain 1: the USDC address below is the Ethereum mainnet contract,
 * and on another chain the same address is not USDC (and "ETH" would be another chain's coin).
 * wagmi refuses the transaction when the wallet is on another chain (chainId below), so a tip
 * can never go to the wrong contract. Amounts are parsed to bigint base units; nothing is
 * rounded through floating point.
 */

interface SendTipModalProps {
  open: boolean;
  onClose: () => void;
  recipientAddress: string;
  recipientName?: string;
  onTipSent: (tipData: { amount: string; token: string; txHash: string; to: string }) => void;
}

type TipToken = 'USDC' | 'ETH';

const PRESETS: Record<TipToken, readonly string[]> = {
  USDC: ['1', '5', '10', '25'],
  ETH: ['0.001', '0.005', '0.01', '0.025'],
};

/** USDC on Ethereum mainnet (chain 1) only. */
const USDC_MAINNET: Address = '0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48';
const ERC20_TRANSFER_ABI = [
  {
    name: 'transfer',
    type: 'function',
    stateMutability: 'nonpayable',
    inputs: [
      { name: 'recipient', type: 'address' },
      { name: 'amount', type: 'uint256' },
    ],
    outputs: [{ name: '', type: 'bool' }],
  },
] as const;

/** Base units of the amount typed, or null when it is not a positive amount. */
function toUnits(token: TipToken, amount: string): bigint | null {
  const clean = amount.trim();
  if (!/^\d+(\.\d+)?$/.test(clean)) return null;
  try {
    const units = token === 'ETH' ? parseEther(clean) : parseUnits(clean, 6);
    return units > 0n ? units : null;
  } catch {
    return null;
  }
}

export function SendTipModal({ open, onClose, recipientAddress, recipientName, onTipSent }: SendTipModalProps) {
  const [token, setToken] = useState<TipToken>('USDC');
  const [amount, setAmount] = useState('5');
  const [isSending, setIsSending] = useState(false);
  const inFlight = useRef(false);

  const { isConnected, chainId } = useAccount();
  const { sendTransactionAsync } = useSendTransaction();
  const { writeContractAsync } = useWriteContract();

  if (!open) return null;

  const recipientOk = isAddress(recipientAddress);
  const units = toUnits(token, amount);

  const handleSendTip = async () => {
    if (inFlight.current) return;
    if (!isConnected) {
      toast.error('Connect your wallet first.');
      return;
    }
    if (!recipientOk) {
      toast.error('This recipient has no valid Ethereum address.');
      return;
    }
    if (units === null) {
      toast.error('Enter an amount greater than zero.');
      return;
    }
    if (chainId !== mainnet.id) {
      toast.error('Switch your wallet to Ethereum mainnet to send a tip.');
      return;
    }

    inFlight.current = true;
    setIsSending(true);
    try {
      const to = recipientAddress as Address;
      const txHash =
        token === 'ETH'
          ? await sendTransactionAsync({ to, value: units, chainId: mainnet.id })
          : await writeContractAsync({
              address: USDC_MAINNET,
              abi: ERC20_TRANSFER_ABI,
              functionName: 'transfer',
              args: [to, units],
              chainId: mainnet.id,
            });

      toast.success(`Tip of ${amount} ${token} submitted.`);
      onTipSent({ amount, token, txHash, to: recipientAddress });
      onClose();
    } catch (err: unknown) {
      console.error('[SendTipModal]', err);
      const e = err as { shortMessage?: string; message?: string };
      toast.error(e?.shortMessage || e?.message || 'The tip was not sent.');
    } finally {
      inFlight.current = false;
      setIsSending(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/40 flex items-center justify-center p-4" role="dialog" aria-modal="true" aria-labelledby="tip-title">
      <div className="bg-white rounded-2xl max-w-sm w-full p-6 border border-[#E4E7EC] space-y-5">
        <div className="flex items-center justify-between">
          <h2 id="tip-title" className="text-[15px] font-semibold text-[#15171C]">
            Send a tip
          </h2>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close"
            className="w-11 h-11 -mr-2 rounded-xl flex items-center justify-center text-[#475467] hover:bg-[#F7F8FA] transition-colors duration-150 ease-out"
          >
            <X size={18} strokeWidth={1.75} />
          </button>
        </div>

        <div className="flex items-center gap-3 p-3 bg-[#F7F8FA] border border-[#E4E7EC] rounded-xl">
          <div className="w-10 h-10 rounded-full bg-[#15171C] flex items-center justify-center text-white font-semibold text-[13px] shrink-0">
            {recipientName ? recipientName.slice(0, 2).toUpperCase() : 'W'}
          </div>
          <div className="min-w-0 flex-1">
            <p className="text-[14px] font-semibold text-[#15171C] truncate">{recipientName || 'Recipient'}</p>
            <p className="text-[12.5px] tabular-nums text-[#475467] truncate">{recipientAddress}</p>
          </div>
        </div>

        <p className="text-[12.5px] leading-relaxed text-[#475467]">
          A public transfer on Ethereum mainnet from your wallet. It is not private and cannot be undone.
        </p>

        <div className="grid grid-cols-2 gap-2" role="radiogroup" aria-label="Token">
          {(['USDC', 'ETH'] as const).map((t) => (
            <button
              key={t}
              type="button"
              role="radio"
              aria-checked={token === t}
              onClick={() => {
                setToken(t);
                setAmount(PRESETS[t][1]);
              }}
              className={`min-h-[44px] rounded-xl text-[13px] font-semibold border transition-colors duration-150 ease-out ${
                token === t ? 'bg-white text-[#15171C] border-[#15171C]' : 'bg-[#F7F8FA] text-[#475467] border-[#E4E7EC] hover:bg-white'
              }`}
            >
              {t}
            </button>
          ))}
        </div>

        <div className="grid grid-cols-4 gap-2">
          {PRESETS[token].map((p) => (
            <button
              key={p}
              type="button"
              onClick={() => setAmount(p)}
              className={`min-h-[44px] rounded-xl text-[12.5px] font-semibold tabular-nums transition-colors duration-150 ease-out ${
                amount === p ? 'bg-[#15171C] text-white' : 'bg-[#F7F8FA] text-[#475467] hover:bg-[#EFF1F4]'
              }`}
            >
              {p}
            </button>
          ))}
        </div>

        <div>
          <label htmlFor="tip-amount" className="text-[12.5px] font-semibold text-[#475467] block mb-1">
            Amount in {token}
          </label>
          <input
            id="tip-amount"
            type="text"
            inputMode="decimal"
            autoComplete="off"
            value={amount}
            onChange={(e) => setAmount(e.target.value)}
            placeholder={PRESETS[token][0]}
            className="w-full min-h-[44px] px-4 bg-white border border-[#E4E7EC] rounded-xl outline-none text-[16px] font-semibold tabular-nums text-[#15171C] focus:border-[#15171C]"
          />
          {amount.trim() !== '' && units === null && (
            <p className="mt-1.5 text-[12.5px] text-[#B42318]" role="alert">
              Enter an amount greater than zero, with a dot for decimals.
            </p>
          )}
        </div>

        <button
          type="button"
          onClick={handleSendTip}
          disabled={isSending || units === null || !recipientOk}
          className="w-full min-h-[48px] bg-[#15171C] text-white font-semibold rounded-xl text-[14px] flex items-center justify-center gap-2 disabled:opacity-50 transition-colors duration-150 ease-out"
        >
          {isSending ? (
            'Confirm in your wallet…'
          ) : (
            <>
              <Heart size={16} strokeWidth={1.75} /> Send {amount || '0'} {token}
            </>
          )}
        </button>
      </div>
    </div>
  );
}
