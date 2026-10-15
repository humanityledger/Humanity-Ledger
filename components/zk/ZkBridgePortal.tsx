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
import { useAccount, useBalance, useSendTransaction, useWriteContract, usePublicClient } from 'wagmi';
import { parseEther, parseUnits } from 'viem';
import { toast } from 'sonner';
import {
  estimateShieldFee,
  estimateTransferFee,
  executeShieldDeposit,
  executeUnshield,
  getShieldedBalances
} from '@/lib/zk/zkMoney';

const AZTEC_ROLLUP_BRIDGE = '0x737901bea3eeb88459df9ef1BE8fF3Ae1B42A2ba' as const;
const DAI_ADDRESS = '0x6B175474E89094C44Da98b954EedeAC495271d0F' as const;
const USDC_ADDRESS = '0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48' as const;

const ERC20_ABI = [
  {
    name: 'transfer',
    type: 'function',
    inputs: [
      { name: 'to', type: 'address' },
      { name: 'amount', type: 'uint256' },
    ],
    outputs: [{ name: '', type: 'bool' }],
    stateMutability: 'nonpayable',
  },
] as const;

interface ZkBridgePortalProps {
  userAddress: string;
  onClose?: () => void;
  className?: string;
}

export function ZkBridgePortal({ userAddress, onClose, className = '' }: ZkBridgePortalProps) {
  const [tab, setTab] = useState<'deposit' | 'withdraw'>('deposit');
  const [token, setToken] = useState<'DAI' | 'USDC' | 'ETH'>('DAI');
  const [amount, setAmount] = useState('0');
  const [destination, setDestination] = useState(userAddress);
  const [isProcessing, setIsProcessing] = useState(false);
  const [currentStep, setCurrentStep] = useState('');
  const [stepProgress, setStepProgress] = useState(0);
  const [completedTx, setCompletedTx] = useState<{ txHash: string; noteId?: string } | null>(null);

  const { address: connectedAddress, isConnected } = useAccount();
  const activeAddress = (connectedAddress || userAddress || '').toLowerCase();

  const { sendTransactionAsync } = useSendTransaction();
  const { writeContractAsync } = useWriteContract();
  const publicClient = usePublicClient();

  const { data: ethBalanceData } = useBalance({
    address: (activeAddress && /^0x[0-9a-fA-F]{40}$/.test(activeAddress)) ? (activeAddress as `0x${string}`) : undefined,
  });

  const [l1Balances, setL1Balances] = useState<Record<string, string>>({
    DAI: '0.00', USDC: '0.00', ETH: '0.000',
  });

  useEffect(() => {
    let mounted = true;
    if (activeAddress && /^0x[0-9a-fA-F]{40}$/.test(activeAddress)) {
      fetch(`/api/wallet/onchain-balances?address=${activeAddress}`)
        .then(r => r.ok ? r.json() : null)
        .then(data => {
          if (mounted && data) {
            let eth = ethBalanceData ? parseFloat(ethBalanceData.formatted).toFixed(4) : '0.000';
            let usdc = '0.00';
            let dai = '0.00';
            if (data.balances) {
              dai = data.balances.DAI ? parseFloat(data.balances.DAI).toFixed(2) : '0.00';
              usdc = data.balances.USDC ? parseFloat(data.balances.USDC).toFixed(2) : '0.00';
              if (!ethBalanceData && data.balances.ETH) eth = parseFloat(data.balances.ETH).toFixed(4);
            }
            setL1Balances({ DAI: dai, USDC: usdc, ETH: eth });
          }
        })
        .catch(() => {});
    }
    return () => { mounted = false; };
  }, [activeAddress, ethBalanceData]);

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

  const numAmount = parseFloat(amount.replace(/,/g, '')) || 0;
  const availableL1 = parseFloat((l1Balances[token] || '0').replace(/,/g, '')) || 0;
  const shieldedBalance = getShieldedBalances(activeAddress);
  const tokenKey = token.toLowerCase() as 'dai' | 'usdc' | 'eth';
  const availableShielded = parseFloat((shieldedBalance[tokenKey] || '0').replace(/,/g, '')) || 0;

  const isDepositDisabled = tab === 'deposit' && (numAmount <= 0 || numAmount > availableL1 || availableL1 <= 0 || !isConnected);
  const isWithdrawDisabled = tab === 'withdraw' && (numAmount <= 0 || numAmount > availableShielded || availableShielded <= 0 || !destination);
  const isActionDisabled = isProcessing || isDepositDisabled || isWithdrawDisabled;

  const handleExecuteBridge = async () => {
    if (isActionDisabled) return;
    setIsProcessing(true);
    setCompletedTx(null);

    try {
      if (tab === 'deposit') {
        setCurrentStep('Confirming on-chain deposit in your Web3 wallet…');
        setStepProgress(20);

        let l1TxHash: `0x${string}`;

        if (token === 'ETH') {
          l1TxHash = await sendTransactionAsync({
            to: AZTEC_ROLLUP_BRIDGE,
            value: parseEther(amount),
          });
        } else {
          const tokenAddr = token === 'DAI' ? DAI_ADDRESS : USDC_ADDRESS;
          const decimals = token === 'DAI' ? 18 : 6;
          l1TxHash = await writeContractAsync({
            address: tokenAddr,
            abi: ERC20_ABI,
            functionName: 'transfer',
            args: [AZTEC_ROLLUP_BRIDGE, parseUnits(amount, decimals)],
          });
        }

        setCurrentStep(`Deposit broadcasted (${l1TxHash.slice(0, 10)}…). Waiting for confirmation…`);
        setStepProgress(50);

        if (publicClient) {
          try {
            await publicClient.waitForTransactionReceipt({ hash: l1TxHash });
          } catch (e) {
            console.warn(e);
          }
        }

        setCurrentStep('Aztec Sequencer registering shielded note…');
        setStepProgress(85);

        const res = await executeShieldDeposit(
          { publicAddress: activeAddress, amount, token, l1TxHash },
          (step, pct) => {
            setCurrentStep(step);
            setStepProgress(pct);
          }
        );
        setCompletedTx({ txHash: res.txHash, noteId: res.noteId });
        toast.success(`Successfully shielded ${amount} ${token} on Aztec`);
      } else {
        const res = await executeUnshield(
          { zkHandle: `zk:${activeAddress.slice(2, 8)}`, amount, token, destinationAddress: destination },
          (step, pct) => {
            setCurrentStep(step);
            setStepProgress(pct);
          }
        );
        setCompletedTx({ txHash: res.l1TxHash });
        toast.success(`Withdrawal of ${amount} ${token} initiated to L1`);
      }
    } catch (err: any) {
      console.error(err);
      toast.error(err?.shortMessage || err?.message || 'Transaction rejected in wallet');
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
            onClick={() => { setTab('deposit'); setAmount('0'); }}
            className={`flex-1 py-2 text-[13px] font-bold rounded-xl transition ${
              tab === 'deposit'
                ? 'bg-white text-gray-900 shadow-sm'
                : 'text-gray-500 hover:text-gray-900'
            }`}
          >
            Deposit & Shield (L1 → Aztec)
          </button>
          <button
            onClick={() => { setTab('withdraw'); setAmount('0'); }}
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
            <div className="flex items-center gap-1.5 px-3 py-1.5 bg-white rounded-xl border border-black/[0.06]">
              <span className="w-2 h-2 rounded-full bg-blue-500" />
              <span className="text-[12px] font-bold text-gray-800">
                {tab === 'deposit' ? 'Ethereum L1' : 'Aztec Rollup'}
              </span>
            </div>
            <span className="text-[10px] text-gray-400 font-mono">
              {tab === 'deposit' ? `${l1Balances[token]} ${token}` : `${shieldedBalance[tokenKey]} ${token}`}
            </span>
          </div>

          <div className="flex flex-col items-center gap-1 px-4">
            <div className="w-8 h-8 rounded-full bg-[#1C1C1E] text-white flex items-center justify-center">
              <ArrowRight size={14} />
            </div>
            <span className="text-[9px] font-mono text-[#1C1C1E] font-bold">UltraPlonk</span>
          </div>

          <div className="flex flex-col items-center gap-1">
            <span className="text-[10px] font-semibold text-gray-400 uppercase tracking-wider">Destination</span>
            <div className="flex items-center gap-1.5 px-3 py-1.5 bg-white rounded-xl border border-black/[0.06]">
              <span className="w-2 h-2 rounded-full bg-[#1C1C1E]" />
              <span className="text-[12px] font-bold text-gray-800">
                {tab === 'deposit' ? 'Aztec Rollup' : 'Ethereum L1'}
              </span>
            </div>
            <span className="text-[10px] text-gray-400 font-mono">Shielded Private</span>
          </div>
        </div>

        {/* Zero Balance Alert */}
        {tab === 'deposit' && availableL1 <= 0 && (
          <div className="bg-black/[0.03] border border-black/[0.08] rounded-2xl p-3 flex items-start gap-2.5">
            <Lock size={14} className="text-[#1C1C1E] mt-0.5 shrink-0" />
            <p className="text-[11px] text-black/60 leading-relaxed">
              <strong>Zero-Mock On-Chain Rule:</strong> Connected wallet holds <strong>0.00 {token}</strong> on Ethereum L1. Real tokens must be held in your wallet before bridging to Aztec.
            </p>
          </div>
        )}

        {/* Amount Input */}
        <div>
          <div className="flex items-center justify-between mb-2">
            <label className="text-[11px] font-semibold text-gray-500 uppercase tracking-wide">Amount</label>
            <div className="flex gap-1.5">
              {(['DAI', 'USDC', 'ETH'] as const).map(t => (
                <button
                  key={t}
                  onClick={() => { setToken(t); setAmount('0'); }}
                  className={`px-2 py-0.5 rounded-lg text-[10px] font-bold transition ${
                    token === t ? 'bg-[#1C1C1E] text-white' : 'bg-[#f0f2f5] text-gray-600'
                  }`}
                >
                  {t}
                </button>
              ))}
            </div>
          </div>
          <div className="flex gap-2">
            <input
              type="number"
              min="0"
              step="any"
              placeholder="0.00"
              value={amount}
              onChange={e => setAmount(e.target.value)}
              disabled={tab === 'deposit' && availableL1 <= 0}
              className="flex-1 bg-[#f0f2f5] rounded-2xl px-4 py-3 text-[15px] font-bold text-gray-900 outline-none border-2 border-transparent focus:border-black/30 font-mono disabled:opacity-50"
            />
            <button
              onClick={() => {
                const maxVal = tab === 'deposit' ? l1Balances[token].replace(/,/g, '') : shieldedBalance[tokenKey].replace(/,/g, '');
                setAmount(parseFloat(maxVal) > 0 ? maxVal : '0');
              }}
              disabled={tab === 'deposit' && availableL1 <= 0}
              className="px-4 py-3 bg-black/5 hover:bg-black/10 text-[#1C1C1E] font-bold text-[12px] rounded-2xl transition disabled:opacity-40"
            >
              MAX
            </button>
          </div>
        </div>

        {/* Progress Bar */}
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
          <div className="bg-black/5 border border-black/10 rounded-2xl p-4 flex items-center justify-between">
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
              href={`https://etherscan.io/tx/${completedTx.txHash}`}
              target="_blank"
              rel="noopener noreferrer"
              className="text-[11px] font-bold text-[#1C1C1E] flex items-center gap-1 hover:underline"
            >
              Etherscan <ExternalLink size={11} />
            </a>
          </div>
        )}

        {/* Action Button */}
        <button
          onClick={handleExecuteBridge}
          disabled={isActionDisabled}
          className={`w-full py-3.5 rounded-2xl text-[14px] font-bold transition flex items-center justify-center gap-2 shadow-sm ${
            isActionDisabled
              ? 'bg-gray-200 text-gray-400 cursor-not-allowed'
              : 'bg-[#1C1C1E] text-white hover:bg-[#000000]'
          }`}
        >
          <Lock size={16} />
          {isProcessing
            ? 'Confirming in Wallet...'
            : tab === 'deposit'
            ? !isConnected
              ? 'Connect Web3 Wallet'
              : availableL1 <= 0
              ? `0.00 ${token} on L1 — Insufficient Balance`
              : numAmount > availableL1
              ? `Insufficient Balance (Max: ${availableL1} ${token})`
              : `Shield ${amount || '0'} ${token} into Aztec`
            : availableShielded <= 0
            ? `0.00 ${token} Shielded — No Funds`
            : numAmount > availableShielded
            ? `Insufficient Shielded Balance (Max: ${availableShielded})`
            : `Unshield ${amount || '0'} ${token} to L1`}
        </button>
      </div>
    </div>
  );
}
