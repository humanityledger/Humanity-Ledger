'use client';

import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { X, Lock, ArrowDownLeft, ArrowUpRight, AlertTriangle, CheckCircle, ExternalLink, Loader2 } from 'lucide-react';
import { useAccount, useBalance, useSendTransaction, useWriteContract, usePublicClient } from 'wagmi';
import { parseEther, parseUnits } from 'viem';
import { toast } from 'sonner';
import {
  getShieldedBalances,
  estimateShieldFee,
  estimateUnshieldFee,
  executeShieldDeposit,
  executeUnshield,
  ZkShieldedBalance,
  SupportedToken,
} from '@/lib/zk/zkMoney';

// ─── Contracts & Config ────────────────────────────────────────────────────────
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

// ─── Types ─────────────────────────────────────────────────────────────────────

interface ZkShieldModalProps {
  address: string;
  mode: 'shield' | 'unshield';
  onClose: () => void;
  onSuccess?: (result: { txHash: string; amount: string; token: SupportedToken }) => void;
}

// ─── Step Progress ─────────────────────────────────────────────────────────────

function StepRow({ label, pct, active, done }: { label: string; pct: number; active: boolean; done: boolean }) {
  return (
    <div className="flex items-center gap-3">
      <div className={`w-5 h-5 rounded-full flex items-center justify-center flex-shrink-0 transition-all duration-300 ${
        done   ? 'bg-[#1C1C1E]'  :
        active ? 'bg-black/5 border-2 border-[#1C1C1E]' :
        'bg-black/5'
      }`}>
        {done && <CheckCircle size={12} className="text-white" strokeWidth={3} />}
        {active && (
          <motion.div
            className="w-2 h-2 rounded-full bg-[#1C1C1E]"
            animate={{ scale: [1, 1.4, 1] }}
            transition={{ repeat: Infinity, duration: 0.8 }}
          />
        )}
      </div>
      <div className="flex-1">
        <div className={`text-[12px] font-medium transition-colors ${active ? 'text-gray-900' : done ? 'text-gray-500' : 'text-gray-300'}`}>
          {label}
        </div>
        {active && (
          <div className="mt-1 h-1 bg-black/5 rounded-full overflow-hidden">
            <motion.div
              className="h-full bg-[#1C1C1E] rounded-full"
              animate={{ width: ['10%', '90%'] }}
              transition={{ duration: 1.5, ease: 'easeInOut', repeat: Infinity, repeatType: 'reverse' }}
            />
          </div>
        )}
      </div>
    </div>
  );
}

// ─── Main Component ────────────────────────────────────────────────────────────

export function ZkShieldModal({ address, mode, onClose, onSuccess }: ZkShieldModalProps) {
  const isShield = mode === 'shield';

  const [token,       setToken]       = useState<SupportedToken>('DAI');
  const [amount,      setAmount]      = useState('');
  const [destination, setDestination] = useState('');
  const [step,        setStep]        = useState<'form' | 'progress' | 'success' | 'error'>('form');
  const [progressLabel, setProgressLabel] = useState('');
  const [progressPct,   setProgressPct]   = useState(0);
  const [result,      setResult]      = useState<{ txHash: string; amount: string; token: SupportedToken } | null>(null);
  const [error,       setError]       = useState('');

  const { address: connectedAddress, isConnected } = useAccount();
  const activeAddress = (connectedAddress || address || '').toLowerCase();

  const { sendTransactionAsync } = useSendTransaction();
  const { writeContractAsync } = useWriteContract();
  const publicClient = usePublicClient();

  const { data: ethBalanceData } = useBalance({
    address: (activeAddress && /^0x[0-9a-fA-F]{40}$/.test(activeAddress)) ? (activeAddress as `0x${string}`) : undefined,
  });

  const balance = getShieldedBalances(activeAddress);
  const tokenKey = token.toLowerCase() as 'dai' | 'usdc' | 'eth';
  const shieldedBalance = balance[tokenKey] || '0.00';

  const fee = isShield
    ? estimateShieldFee(amount || '0', token)
    : estimateUnshieldFee(amount || '0');

  const [l1Balances, setL1Balances] = useState<Record<SupportedToken, string>>({
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
            } else if (Array.isArray(data.tokens)) {
              for (const t of data.tokens) {
                if (t.symbol === 'ETH' && !ethBalanceData) eth = parseFloat(t.balanceNumeric || 0).toFixed(4);
                if (t.symbol === 'USDC') usdc = parseFloat(t.balanceNumeric || 0).toFixed(2);
                if (t.symbol === 'DAI') dai = parseFloat(t.balanceNumeric || 0).toFixed(2);
              }
            }
            setL1Balances({ DAI: dai, USDC: usdc, ETH: eth });
          }
        })
        .catch(() => {});
    }
    return () => { mounted = false; };
  }, [activeAddress, ethBalanceData]);

  const SHIELD_STEPS  = ['Awaiting wallet confirmation…', 'Broadcasting on-chain deposit…', 'Aztec Sequencer note commitment…'];
  const UNSHIELD_STEPS = ['Generating unshield proof…', 'Nullifying Aztec note…', 'L1 withdrawal initiated…'];
  const steps = isShield ? SHIELD_STEPS : UNSHIELD_STEPS;

  const [currentStep, setCurrentStep] = useState(-1);

  // Strict on-chain balance checks
  const numAmount = parseFloat(amount.replace(/,/g, '')) || 0;
  const availableL1 = parseFloat(l1Balances[token].replace(/,/g, '')) || 0;
  const availableShielded = parseFloat(shieldedBalance.replace(/,/g, '')) || 0;

  const isInsufficientL1 = isShield && numAmount > availableL1;
  const isInsufficientShielded = !isShield && numAmount > availableShielded;
  const hasZeroL1 = isShield && availableL1 <= 0;
  const hasZeroShielded = !isShield && availableShielded <= 0;

  const isSubmitDisabled = !amount || numAmount <= 0 || isInsufficientL1 || isInsufficientShielded || (!isShield && !destination) || (!isConnected && isShield);

  let submitButtonText = '';
  if (isShield) {
    if (!isConnected) {
      submitButtonText = 'Connect Web3 Wallet to Shield';
    } else if (hasZeroL1) {
      submitButtonText = `0.00 ${token} on L1 — Insufficient Balance`;
    } else if (isInsufficientL1) {
      submitButtonText = `Insufficient ${token} Balance (Max: ${l1Balances[token]})`;
    } else if (numAmount <= 0) {
      submitButtonText = `Enter ${token} Amount`;
    } else {
      submitButtonText = `Shield ${amount} ${token} on Ethereum L1`;
    }
  } else {
    if (hasZeroShielded) {
      submitButtonText = `0.00 ${token} Shielded — No Funds`;
    } else if (isInsufficientShielded) {
      submitButtonText = `Insufficient Shielded Balance (Max: ${shieldedBalance})`;
    } else if (!destination) {
      submitButtonText = 'Enter Destination L1 Address';
    } else {
      submitButtonText = `Unshield ${amount} ${token} to L1`;
    }
  }

  const handleSubmit = async () => {
    if (isSubmitDisabled) return;

    setStep('progress');
    setCurrentStep(0);

    try {
      if (isShield) {
        // Authenticated Web3 on-chain execution mandate
        setProgressLabel('Requesting on-chain signature in your Web3 wallet…');
        setProgressPct(20);
        setCurrentStep(0);

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

        setProgressLabel(`L1 deposit broadcasted (${l1TxHash.slice(0, 10)}…). Waiting for confirmation…`);
        setProgressPct(50);
        setCurrentStep(1);

        if (publicClient) {
          try {
            await publicClient.waitForTransactionReceipt({ hash: l1TxHash });
          } catch (receiptErr) {
            console.warn('Wait for receipt notice:', receiptErr);
          }
        }

        setProgressLabel('Aztec Sequencer indexing note commitment…');
        setProgressPct(85);
        setCurrentStep(2);

        const res = await executeShieldDeposit(
          { publicAddress: activeAddress, amount, token, l1TxHash },
          (label, pct) => {
            setProgressLabel(label);
            setProgressPct(pct);
          }
        );

        setCurrentStep(steps.length);
        setResult({ txHash: res.txHash, amount, token });
        setStep('success');
      } else {
        if (!destination) { setStep('form'); return; }
        const res = await executeUnshield(
          { zkHandle: `zk:${activeAddress.slice(2, 6)}`, amount, token, destinationAddress: destination },
          (label, pct) => {
            setProgressLabel(label);
            setProgressPct(pct);
            const stepIdx = UNSHIELD_STEPS.findIndex(s => s === label);
            if (stepIdx !== -1) setCurrentStep(stepIdx);
          }
        );
        setCurrentStep(steps.length);
        setResult({ txHash: res.l1TxHash, amount, token });
        setStep('success');
      }
    } catch (e: any) {
      console.error('Shield error:', e);
      setError(e?.shortMessage || e?.message || 'Transaction rejected in wallet');
      setStep('error');
    }
  };

  // Close on Escape
  useEffect(() => {
    const handler = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [onClose]);

  const TOKENS: SupportedToken[] = ['DAI', 'USDC', 'ETH'];

  if (process.env.NEXT_PUBLIC_ZK_MODE !== 'demo') {
    return (
      <div className="flex flex-col items-center justify-center p-8 gap-4 text-center">
        <div className="w-12 h-12 rounded-full bg-[#F2F2F7] flex items-center justify-center">
          <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="#1C7AFF" strokeWidth="2"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/></svg>
        </div>
        <h3 className="text-[17px] font-bold text-[#1C1C1E]">Aztec Testnet Required</h3>
        <p className="text-[14px] text-[#1C1C1E]/60 max-w-xs">Shielded payments will be available once Aztec testnet integration is complete. All privacy proofs use UltraHonk.</p>
      </div>
    );
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-end sm:items-center justify-center"
      style={{ backdropFilter: 'blur(8px)', background: 'rgba(0,0,0,0.45)' }}
      onClick={onClose}
    >
      <motion.div
        initial={{ opacity: 0, y: 48, scale: 0.96 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        exit={{ opacity: 0, y: 48, scale: 0.96 }}
        transition={{ type: 'spring', stiffness: 340, damping: 30 }}
        className="bg-white w-full max-w-md rounded-t-3xl sm:rounded-3xl overflow-hidden shadow-2xl"
        onClick={e => e.stopPropagation()}
        style={{ maxHeight: '92vh', overflowY: 'auto' }}
      >
        {/* Header */}
        <div className="flex items-center gap-3 px-5 py-5 border-b border-black/[0.06]">
          <div className="w-10 h-10 rounded-full flex items-center justify-center bg-[#1C1C1E] text-white">
            {isShield
              ? <ArrowDownLeft size={18} className="text-white" />
              : <ArrowUpRight size={18} className="text-white" />
            }
          </div>
          <div>
            <h2 className="font-bold text-gray-900 text-[17px]">
              {isShield ? 'Shield to Aztec' : 'Unshield to L1'}
            </h2>
            <p className="text-[11px] text-gray-400">
              {isShield ? 'Deposit verified on-chain funds into Aztec' : 'Withdraw from shielded Aztec note'}
            </p>
          </div>
          <button onClick={onClose} className="ml-auto w-8 h-8 flex items-center justify-center rounded-full bg-black/5 hover:bg-black/10 transition-colors">
            <X size={16} className="text-gray-600" />
          </button>
        </div>

        {/* ── Form ── */}
        <AnimatePresence mode="wait">
          {step === 'form' && (
            <motion.div key="form" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="px-5 py-5 space-y-4">
              {/* Token selector */}
              <div>
                <label className="text-[11px] font-semibold text-gray-500 uppercase tracking-wide mb-2 block">Token</label>
                <div className="flex gap-2">
                  {TOKENS.map(t => (
                    <button
                      key={t}
                      onClick={() => { setToken(t); setAmount(''); }}
                      className="flex-1 py-2.5 rounded-2xl text-[13px] font-semibold transition-all"
                      style={{
                        background: token === t ? '#1C1C1E' : '#f0f2f5',
                        color: token === t ? '#fff' : '#374151',
                      }}
                    >
                      {t}
                    </button>
                  ))}
                </div>
              </div>

              {/* Balance display */}
              <div className="bg-[#f0f2f5] rounded-2xl px-4 py-3 flex items-center justify-between">
                <span className="text-[12px] text-gray-500 font-medium">
                  {isShield ? 'Verified L1 Balance' : 'Shielded Balance'}
                </span>
                <span className="text-[13px] font-bold text-gray-900 font-mono">
                  {isShield ? l1Balances[token] : shieldedBalance} {token}
                </span>
              </div>

              {/* Zero Balance Notice */}
              {isShield && hasZeroL1 && (
                <div className="bg-black/[0.03] border border-black/[0.08] rounded-2xl p-3 flex items-start gap-2.5">
                  <Lock size={14} className="text-[#1C1C1E] mt-0.5 shrink-0" />
                  <p className="text-[11px] text-black/60 leading-relaxed">
                    <strong>Zero-Mock On-Chain Rule:</strong> Connected wallet holds <strong>0.00 {token}</strong> on Ethereum L1. Authentic on-chain funds are required before shielding into Aztec.
                  </p>
                </div>
              )}

              {/* Amount input */}
              <div>
                <label className="text-[11px] font-semibold text-gray-500 uppercase tracking-wide mb-2 block">Amount</label>
                <div className="flex gap-2">
                  <input
                    type="number"
                    min="0"
                    step="any"
                    placeholder="0.00"
                    value={amount}
                    onChange={e => setAmount(e.target.value)}
                    disabled={hasZeroL1 && isShield}
                    className="flex-1 bg-[#f0f2f5] rounded-2xl px-4 py-3 text-[15px] font-bold text-gray-900 outline-none border-2 border-transparent focus:border-black/30 transition-colors disabled:opacity-50"
                  />
                  <button
                    onClick={() => {
                      const maxVal = isShield ? l1Balances[token].replace(/,/g, '') : shieldedBalance.replace(/,/g, '');
                      setAmount(parseFloat(maxVal) > 0 ? maxVal : '');
                    }}
                    disabled={hasZeroL1 && isShield}
                    className="px-4 py-3 bg-black/5 hover:bg-black/10 text-[#1C1C1E] font-bold text-[12px] rounded-2xl transition-colors disabled:opacity-40"
                  >
                    MAX
                  </button>
                </div>
              </div>

              {/* Destination (unshield only) */}
              {!isShield && (
                <div>
                  <label className="text-[11px] font-semibold text-gray-500 uppercase tracking-wide mb-2 block">
                    Destination L1 Address
                  </label>
                  <input
                    type="text"
                    placeholder="0x…"
                    value={destination}
                    onChange={e => setDestination(e.target.value)}
                    className="w-full bg-[#f0f2f5] rounded-2xl px-4 py-3 text-[13px] text-gray-900 outline-none border-2 border-transparent focus:border-black/30 transition-colors font-mono"
                  />
                </div>
              )}

              {/* Fee estimate */}
              {numAmount > 0 && (
                <div className="bg-[#f0f2f5] rounded-2xl px-4 py-3 space-y-1.5">
                  <div className="flex justify-between text-[12px]">
                    <span className="text-gray-500">L1 Gas</span>
                    <span className="font-semibold text-gray-700">{fee.l1Gas}</span>
                  </div>
                  <div className="flex justify-between text-[12px]">
                    <span className="text-gray-500">Aztec Fee</span>
                    <span className="font-semibold text-gray-700">{fee.aztecFee}</span>
                  </div>
                  <div className="border-t border-black/[0.06] pt-1.5 flex justify-between text-[13px]">
                    <span className="text-gray-700 font-semibold">Total Fee</span>
                    <span className="font-bold text-gray-900">{fee.totalUSD}</span>
                  </div>
                </div>
              )}

              {/* Privacy warning for unshield */}
              {!isShield && (
                <div className="flex items-start gap-2.5 bg-gray-50 border border-black/10 rounded-2xl px-3 py-3">
                  <AlertTriangle size={14} className="text-black/60 flex-shrink-0 mt-0.5" />
                  <p className="text-[11px] text-gray-600 font-medium leading-relaxed">
                    Once unshielded, the transaction amount and destination will be <strong>publicly visible on Ethereum L1</strong>.
                  </p>
                </div>
              )}

              {/* Submit */}
              <button
                onClick={handleSubmit}
                disabled={isSubmitDisabled}
                className="w-full py-4 rounded-2xl font-bold text-[15px] text-white bg-[#1C1C1E] hover:bg-black transition-all disabled:opacity-40 disabled:cursor-not-allowed shadow-sm"
              >
                {submitButtonText}
              </button>
            </motion.div>
          )}

          {/* ── Progress ── */}
          {step === 'progress' && (
            <motion.div key="progress" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="px-5 py-6 space-y-4">
              <div className="text-center mb-4">
                <motion.div
                  className="w-16 h-16 rounded-full mx-auto flex items-center justify-center mb-3 bg-[#1C1C1E]"
                  animate={{ rotate: 360 }}
                  transition={{ duration: 2, repeat: Infinity, ease: 'linear' }}
                >
                  <Lock size={24} className="text-white" />
                </motion.div>
                <p className="text-[13px] font-medium text-gray-600">{progressLabel}</p>
              </div>

              <div className="space-y-3">
                {steps.map((s, i) => (
                  <StepRow
                    key={s}
                    label={s}
                    pct={progressPct}
                    active={i === currentStep}
                    done={i < currentStep}
                  />
                ))}
              </div>
            </motion.div>
          )}

          {/* ── Success ── */}
          {step === 'success' && result && (
            <motion.div key="success" initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0 }} className="px-5 py-8 text-center space-y-4">
              <motion.div
                initial={{ scale: 0 }}
                animate={{ scale: 1 }}
                transition={{ type: 'spring', stiffness: 500, damping: 25 }}
                className="w-16 h-16 rounded-full bg-[#1C1C1E] flex items-center justify-center mx-auto text-white"
              >
                <CheckCircle size={32} className="text-white" strokeWidth={2.5} />
              </motion.div>

              <div>
                <h3 className="text-[20px] font-bold text-gray-900">
                  {isShield ? 'Shielded on Aztec!' : 'Unshielded to L1!'}
                </h3>
                <p className="text-[13px] text-gray-500 mt-1">
                  {result.amount} {result.token} {isShield ? 'confirmed in Aztec shielded wallet' : 'withdrawn to Ethereum L1'}
                </p>
              </div>

              <div className="bg-[#f0f2f5] rounded-2xl px-4 py-3 text-left space-y-1.5">
                <div className="flex justify-between text-[11px]">
                  <span className="text-gray-400">Tx Hash</span>
                  <span className="font-mono text-gray-700 text-[10px]">{result.txHash.slice(0, 10)}…{result.txHash.slice(-6)}</span>
                </div>
                <div className="flex justify-between text-[11px]">
                  <span className="text-gray-400">On-Chain Status</span>
                  <span className="text-black/80 font-bold">{isShield ? 'Confirmed (Rollup Bridge)' : 'Initiated'}</span>
                </div>
              </div>

              <a
                href={`https://etherscan.io/tx/${result.txHash}`}
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center justify-center gap-1.5 text-[12px] text-black/70 hover:text-black font-semibold"
              >
                <ExternalLink size={12} /> View on Etherscan
              </a>

              <button
                onClick={() => { onSuccess?.(result); onClose(); }}
                className="w-full py-4 rounded-2xl font-bold text-[15px] text-white bg-[#1C1C1E] hover:bg-black transition-all"
              >
                Done
              </button>
            </motion.div>
          )}

          {/* ── Error ── */}
          {step === 'error' && (
            <motion.div key="error" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="px-5 py-8 text-center space-y-4">
              <div className="w-16 h-16 rounded-full bg-red-100 flex items-center justify-center mx-auto">
                <AlertTriangle size={28} className="text-red-500" />
              </div>
              <h3 className="text-[18px] font-bold text-gray-900">Transaction Failed</h3>
              <p className="text-[12px] text-gray-500">{error || 'Unknown error occurred'}</p>
              <button
                onClick={() => { setStep('form'); setError(''); }}
                className="w-full py-4 rounded-2xl font-bold text-[14px] bg-[#f0f2f5] text-gray-700 hover:bg-[#e4e6eb] transition-colors"
              >
                Try Again
              </button>
            </motion.div>
          )}
        </AnimatePresence>
      </motion.div>
    </div>
  );
}
