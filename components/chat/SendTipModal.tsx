// @ts-nocheck
'use client';

import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { X, Heart, Sparkles, Loader2, CheckCircle2, ArrowRight } from 'lucide-react';
import { useSendTransaction, useWriteContract, useAccount } from 'wagmi';
import { parseEther, parseUnits } from 'viem';
import { toast } from 'sonner';

interface SendTipModalProps {
  open: boolean;
  onClose: () => void;
  recipientAddress: string;
  recipientName?: string;
  onTipSent: (tipData: { amount: string; token: string; txHash: string; to: string }) => void;
}

const PRESETS = ['1', '5', '10', '25'];

// USDC contract on Ethereum / Base / Polygon
const USDC_ADDRESS = '0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48';
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

export function SendTipModal({
  open,
  onClose,
  recipientAddress,
  recipientName,
  onTipSent,
}: SendTipModalProps) {
  const [token, setToken] = useState<'USDC' | 'ETH'>('USDC');
  const [amount, setAmount] = useState('5');
  const [isSending, setIsSending] = useState(false);

  const { isConnected } = useAccount();
  const { sendTransactionAsync } = useSendTransaction();
  const { writeContractAsync } = useWriteContract();

  if (!open) return null;

  const handleSendTip = async () => {
    if (!isConnected) {
      toast.error('Connect your wallet first');
      return;
    }
    if (!amount || parseFloat(amount) <= 0) {
      toast.error('Enter a valid tip amount');
      return;
    }

    try {
      setIsSending(true);
      let txHash = '';

      if (token === 'ETH') {
        const val = parseEther(amount);
        const tx = await sendTransactionAsync({
          to: recipientAddress as `0x${string}`,
          value: val,
        });
        txHash = tx;
      } else {
        // USDC (6 decimals)
        const units = parseUnits(amount, 6);
        const tx = await writeContractAsync({
          address: USDC_ADDRESS,
          abi: ERC20_TRANSFER_ABI,
          functionName: 'transfer',
          args: [recipientAddress as `0x${string}`, units],
        });
        txHash = tx;
      }

      toast.success(`Sent ${amount} ${token} tip!`);
      onTipSent({
        amount,
        token,
        txHash,
        to: recipientAddress,
      });
      onClose();
    } catch (err: any) {
      console.error('[SendTipModal]', err);
      toast.error(err?.shortMessage || err?.message || 'Tip failed');
    } finally {
      setIsSending(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/40 backdrop-blur-sm flex items-center justify-center p-4">
      <motion.div
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        exit={{ opacity: 0, scale: 0.95 }}
        className="bg-white rounded-3xl max-w-sm w-full p-6 shadow-2xl border border-black/10 space-y-5"
      >
        {/* Header */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2 text-[#15171c]">
            <Sparkles size={18} />
            <span className="text-xs font-semibold">Creator Tip</span>
          </div>
          <button
            onClick={onClose}
            className="p-1 rounded-full hover:bg-black/5 text-black/40 transition-colors"
          >
            <X size={18} />
          </button>
        </div>

        {/* Recipient Profile */}
        <div className="flex items-center gap-3 p-3 bg-[#f2f4f7] rounded-2xl">
          <div className="w-10 h-10 rounded-full bg-gradient-to-tr from-[#15171c] to-emerald-400 flex items-center justify-center text-white font-semibold text-sm">
            {recipientName ? recipientName.slice(0, 2).toUpperCase() : 'W'}
          </div>
          <div className="min-w-0 flex-1">
            <p className="text-sm font-semibold text-[#15171c] truncate">
              {recipientName || 'Creator'}
            </p>
            <p className="text-[12.5px] tabular-nums text-black/40 truncate">
              {recipientAddress}
            </p>
          </div>
        </div>

        {/* Token Selector */}
        <div className="grid grid-cols-2 gap-2">
          <button
            type="button"
            onClick={() => setToken('USDC')}
            className={`py-2.5 rounded-xl text-xs font-semibold transition-all border ${
              token === 'USDC'
                ? 'bg-[#eff1f4] text-[#15171c] border-[#15171c]'
                : 'bg-[#f2f4f7] text-black/60 border-transparent hover:bg-black/5'
            }`}
          >
            USDC (Stable)
          </button>
          <button
            type="button"
            onClick={() => setToken('ETH')}
            className={`py-2.5 rounded-xl text-xs font-semibold transition-all border ${
              token === 'ETH'
                ? 'bg-[#eff1f4] text-[#15171c] border-[#15171c]'
                : 'bg-[#f2f4f7] text-black/60 border-transparent hover:bg-black/5'
            }`}
          >
            ETH (Native)
          </button>
        </div>

        {/* Presets */}
        <div className="grid grid-cols-4 gap-2">
          {PRESETS.map((p) => (
            <button
              key={p}
              type="button"
              onClick={() => setAmount(p)}
              className={`py-2 rounded-xl text-xs font-semibold transition-all ${
                amount === p
                  ? 'bg-black text-white'
                  : 'bg-[#f2f4f7] text-black/60 hover:bg-black/5'
              }`}
            >
              ${p}
            </button>
          ))}
        </div>

        {/* Amount Input */}
        <div>
          <label className="text-[12.5px] font-semibold text-black/40 block mb-1">
            Custom Amount ({token})
          </label>
          <input
            type="number"
            step="any"
            value={amount}
            onChange={(e) => setAmount(e.target.value)}
            placeholder="0.00"
            className="w-full px-4 py-3 bg-[#f2f4f7] rounded-xl outline-none text-base font-semibold text-[#15171c] focus:ring-2 focus:ring-[#15171c]/15"
          />
        </div>

        {/* Submit Button */}
        <button
          type="button"
          onClick={handleSendTip}
          disabled={isSending}
          className="w-full py-3.5 bg-[#15171c] hover:bg-[#15171c] text-white font-semibold rounded-2xl text-sm transition-transform active:scale-95 flex items-center justify-center gap-2 shadow-lg shadow-black/5 disabled:opacity-50"
        >
          {isSending ? (
            <>
              <Loader2 size={16} className="animate-spin" /> Confirming...
            </>
          ) : (
            <>
              <Heart size={16} fill="currentColor" /> Send {amount} {token} Tip
            </>
          )}
        </button>
      </motion.div>
    </div>
  );
}
