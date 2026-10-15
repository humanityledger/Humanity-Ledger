'use client';

import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Lock,
  ArrowRight,
  ArrowDownUp,
  ExternalLink,
  Layers,
  Fuel,
  Clock,
  CheckCircle2,
  AlertCircle,
  X,
  RefreshCw,
  Coins
} from 'lucide-react';
import { estimateShieldFee, estimateTransferFee, executeShieldDeposit, executeUnshield } from '@/lib/zk/zkMoney';

interface ZkBridgePortalProps {
  userAddress: string;
  onClose?: () => void;
  className?: string;
}

export function ZkBridgePortal({ userAddress, onClose, className = '' }: ZkBridgePortalProps) {
  const [tab, setTab] = useState<'deposit' | 'withdraw'>('deposit');
  const [token, setToken] = useState<'DAI' | 'USDC' | 'ETH'>('DAI');
  const [amount, setAmount] = useState('100');
  const [destination, setDestination] = useState(userAddress);
  const [isProcessing, setIsProcessing] = useState(false);
  const [currentStep, setCurrentStep] = useState('');
  const [stepProgress, setStepProgress] = useState(0);
  const [completedTx, setCompletedTx] = useState<{ txHash: string; noteId?: string } | null>(null);

  const [gasSavings, setGasSavings] = useState({
    l1GasUSD: '14.50',
    aztecFeeUSD: '0.05',
    savedPercentage: '99.6%',
  });

  useEffect(() => {
    const fee = estimateShieldFee(amount || '10', token);
    const l1 = parseFloat(fee.l1Gas);
    const az = parseFloat(fee.aztecFee);
    const pct = l1 > 0 ? (((l1 - az) / l1) * 100).toFixed(1) + '%' : '99.6%';
    setGasSavings({
      l1GasUSD: fee.l1Gas,
      aztecFeeUSD: fee.aztecFee,
      savedPercentage: pct,
    });
  }, [amount, token]);

  const handleExecuteBridge = async () => {
    if (!amount || parseFloat(amount) <= 0) return;
    setIsProcessing(true);
    setCompletedTx(null);

    try {
      if (tab === 'deposit') {
        const res = await executeShieldDeposit(
          { publicAddress: userAddress, amount, token },
          (step, pct) => {
            setCurrentStep(step);
            setStepProgress(pct);
          }
        );
        setCompletedTx({ txHash: res.txHash, noteId: res.noteId });
      } else {
        const res = await executeUnshield(
          { zkHandle: `zk:${userAddress.slice(2, 8)}`, amount, token, destinationAddress: destination },
          (step, pct) => {
            setCurrentStep(step);
            setStepProgress(pct);
          }
        );
        setCompletedTx({ txHash: res.l1TxHash });
      }
    } catch (err) {
      console.error(err);
    } finally {
      setIsProcessing(false);
    }
  };

  return (
    <div className={`bg-white rounded-3xl border border-black/[0.08] shadow-xl overflow-hidden flex flex-col ${className}`}>
      {/* Header */}
      <div className="bg-[#f0f2f5] px-6 py-4 flex items-center justify-between border-b border-black/[0.06]">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-2xl bg-[#1C1C1E]/10 flex items-center justify-center text-[#1C1C1E]">
            <Layers size={18} strokeWidth={2.5} />
          </div>
          <div>
            <h2 className="text-[15px] font-bold text-gray-900 leading-tight">Aztec Rollup Bridge Portal</h2>
            <p className="text-[11px] text-gray-500">Ethereum L1 ↔ Aztec Shielded Layer-2</p>
          </div>
        </div>
        {onClose && (
          <button
            onClick={onClose}
            className="w-8 h-8 rounded-full flex items-center justify-center hover:bg-black/5 text-gray-400 hover:text-gray-700 transition"
          >
            <X size={18} />
          </button>
        )}
      </div>

      {/* Tabs */}
      <div className="p-6 space-y-6">
        <div className="flex rounded-2xl bg-[#f0f2f5] p-1 gap-1">
          <button
            onClick={() => setTab('deposit')}
            className={`flex-1 py-2 text-[13px] font-bold rounded-xl transition ${
              tab === 'deposit'
                ? 'bg-white text-gray-900 shadow-sm'
                : 'text-gray-500 hover:text-gray-900'
            }`}
          >
            Deposit & Shield (L1 → Aztec)
          </button>
          <button
            onClick={() => setTab('withdraw')}
            className={`flex-1 py-2 text-[13px] font-bold rounded-xl transition ${
              tab === 'withdraw'
                ? 'bg-white text-gray-900 shadow-sm'
                : 'text-gray-500 hover:text-gray-900'
            }`}
          >
            Unshield & Withdraw (Aztec → L1)
          </button>
        </div>

        {/* Route Visualizer */}
        <div className="flex items-center justify-between bg-[#FAFAFA] border border-black/[0.05] rounded-2xl p-4">
          <div className="flex flex-col items-center gap-1">
            <span className="text-[10px] font-semibold text-gray-400 uppercase tracking-wider">Origin</span>
            <div className="flex items-center gap-1.5 px-3 py-1.5 bg-white rounded-xl border border-black/[0.06] shadow-2xs">
              <span className="w-2 h-2 rounded-full bg-blue-500" />
              <span className="text-[12px] font-bold text-gray-800">
                {tab === 'deposit' ? 'Ethereum L1' : 'Aztec Private L2'}
              </span>
            </div>
          </div>

          <div className="flex flex-col items-center gap-1">
            <div className="w-8 h-8 rounded-full bg-[#1C1C1E]/10 flex items-center justify-center text-[#1C1C1E]">
              <ArrowRight size={16} strokeWidth={2.5} />
            </div>
            <span className="text-[9px] font-semibold text-[#1C1C1E]">Encrypted Portal</span>
          </div>

          <div className="flex flex-col items-center gap-1">
            <span className="text-[10px] font-semibold text-gray-400 uppercase tracking-wider">Destination</span>
            <div className="flex items-center gap-1.5 px-3 py-1.5 bg-white rounded-xl border border-black/[0.06] shadow-2xs">
              <span className="w-2 h-2 rounded-full bg-[#1C1C1E]" />
              <span className="text-[12px] font-bold text-gray-800">
                {tab === 'deposit' ? 'Aztec Private L2' : 'Ethereum L1'}
              </span>
            </div>
          </div>
        </div>

        {/* Token Selector & Input */}
        <div className="space-y-2">
          <div className="flex items-center justify-between text-[12px] font-semibold text-gray-600">
            <span>Amount to Bridge</span>
            <div className="flex gap-1.5">
              {(['DAI', 'USDC', 'ETH'] as const).map(t => (
                <button
                  key={t}
                  onClick={() => setToken(t)}
                  className={`px-2.5 py-0.5 rounded-lg text-[11px] font-bold transition ${
                    token === t
                      ? 'bg-[#1C1C1E] text-white shadow-xs'
                      : 'bg-black/5 text-gray-600 hover:bg-black/10'
                  }`}
                >
                  {t}
                </button>
              ))}
            </div>
          </div>
          <div className="relative">
            <input
              type="number"
              value={amount}
              onChange={e => setAmount(e.target.value)}
              placeholder="0.00"
              className="w-full bg-[#f0f2f5] border border-black/[0.06] rounded-2xl px-4 py-3 text-[18px] font-bold text-gray-900 outline-none focus:border-[#1C1C1E] transition"
            />
            <span className="absolute right-4 top-1/2 -translate-y-1/2 text-[13px] font-bold text-gray-400">
              {token}
            </span>
          </div>
        </div>

        {tab === 'withdraw' && (
          <div className="space-y-2">
            <span className="text-[12px] font-semibold text-gray-600">Destination L1 Address</span>
            <input
              type="text"
              value={destination}
              onChange={e => setDestination(e.target.value)}
              placeholder="0x..."
              className="w-full bg-[#f0f2f5] border border-black/[0.06] rounded-2xl px-4 py-2.5 text-[12px] font-mono text-gray-800 outline-none focus:border-[#1C1C1E] transition"
            />
          </div>
        )}

        {/* Gas & Rollup Amortization Stats */}
        <div className="grid grid-cols-3 gap-2 bg-[#FAFAFA] border border-black/[0.06] rounded-2xl p-3">
          <div className="flex flex-col">
            <span className="text-[10px] text-gray-400 font-semibold flex items-center gap-1">
              <Fuel size={11} /> L1 Standard
            </span>
            <span className="text-[12px] font-bold text-gray-700 strike-through line-through">
              ${gasSavings.l1GasUSD}
            </span>
          </div>
          <div className="flex flex-col">
            <span className="text-[10px] text-[#1C1C1E] font-semibold flex items-center gap-1">
              <Shield size={11} /> Aztec Batch
            </span>
            <span className="text-[12px] font-bold text-[#1C1C1E]">
              ${gasSavings.aztecFeeUSD}
            </span>
          </div>
          <div className="flex flex-col">
            <span className="text-[10px] text-gray-400 font-semibold flex items-center gap-1">
              <Clock size={11} /> Est. Blocks
            </span>
            <span className="text-[12px] font-bold text-gray-700">~2 Rollup Blocks</span>
          </div>
        </div>

        {/* Execution / Progress */}
        {isProcessing && (
          <div className="bg-[#f0f2f5] rounded-2xl p-4 space-y-2">
            <div className="flex items-center justify-between text-[12px]">
              <span className="font-semibold text-gray-800 flex items-center gap-2">
                <RefreshCw size={13} className="animate-spin text-[#1C1C1E]" />
                {currentStep}
              </span>
              <span className="font-mono text-[#1C1C1E] font-bold">{stepProgress}%</span>
            </div>
            <div className="w-full bg-black/10 rounded-full h-1.5 overflow-hidden">
              <div
                className="bg-[#1C1C1E] h-full transition-all duration-300"
                style={{ width: `${stepProgress}%` }}
              />
            </div>
          </div>
        )}

        {completedTx && (
          <div className="bg-[#1C1C1E]/10 border border-[#1C1C1E]/20 rounded-2xl p-4 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <CheckCircle2 size={18} className="text-[#1C1C1E]" />
              <div>
                <span className="text-[12px] font-bold text-gray-900 block">Bridge Request Executed</span>
                <span className="text-[10px] text-gray-500 font-mono">
                  {completedTx.txHash.slice(0, 18)}...
                </span>
              </div>
            </div>
            <a
              href={`https://aztecscan.xyz/tx-effect/${completedTx.txHash.slice(2)}`}
              target="_blank"
              rel="noopener noreferrer"
              className="text-[11px] font-bold text-[#1C1C1E] flex items-center gap-1 hover:underline"
            >
              AztecScan <ExternalLink size={11} />
            </a>
          </div>
        )}

        {/* Action Button */}
        <button
          onClick={handleExecuteBridge}
          disabled={isProcessing || !amount || parseFloat(amount) <= 0}
          className={`w-full py-3.5 rounded-2xl text-[14px] font-bold transition flex items-center justify-center gap-2 shadow-sm ${
            isProcessing || !amount || parseFloat(amount) <= 0
              ? 'bg-gray-200 text-gray-400 cursor-not-allowed'
              : 'bg-[#1C1C1E] text-white hover:bg-[#000000]'
          }`}
        >
          <Shield size={16} />
          {isProcessing
            ? 'Generating UltraPlonk Proof...'
            : tab === 'deposit'
            ? `Shield ${amount || '0'} ${token} into Aztec`
            : `Unshield ${amount || '0'} ${token} to L1`}
        </button>
      </div>
    </div>
  );
}
