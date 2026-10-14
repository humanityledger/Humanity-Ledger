'use client';

import React, { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { X, Lock, ArrowDownLeft, ArrowUpRight, AlertTriangle, CheckCircle, ExternalLink } from 'lucide-react';
import {
  getShieldedBalances,
  estimateShieldFee,
  estimateUnshieldFee,
  executeShieldDeposit,
  executeUnshield,
  ZkShieldedBalance,
  SupportedToken,
} from '@/lib/zk/zkMoney';

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
        done   ? 'bg-[#25D366]'  :
        active ? 'bg-[#EBE5DC] border-2 border-[#25D366]' :
        'bg-[#EBE5DC]'
      }`}>
        {done && <CheckCircle size={12} className="text-white" strokeWidth={3} />}
        {active && (
          <motion.div
            className="w-2 h-2 rounded-full bg-[#25D366]"
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
          <div className="mt-1 h-1 bg-[#EBE5DC] rounded-full overflow-hidden">
            <motion.div
              className="h-full bg-[#25D366] rounded-full"
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

  const balance = getShieldedBalances(address);
  const tokenKey = token.toLowerCase() as 'dai' | 'usdc' | 'eth';
  const shieldedBalance = balance[tokenKey];

  const fee = isShield
    ? estimateShieldFee(amount || '0', token)
    : estimateUnshieldFee(amount || '0');

  const [l1Balances, setL1Balances] = useState<Record<SupportedToken, string>>({
    DAI: '0.00', USDC: '0.00', ETH: '0.000',
  });

  useEffect(() => {
    let mounted = true;
    if (address && /^0x[0-9a-fA-F]{40}$/.test(address)) {
      fetch(`/api/wallet/onchain-balances?address=${address}`)
        .then(r => r.ok ? r.json() : null)
        .then(data => {
          if (mounted && data) {
            let eth = '0.000';
            let usdc = '0.00';
            let dai = '0.00';
            if (data.balances) {
              dai = data.balances.DAI ? parseFloat(data.balances.DAI).toFixed(2) : '0.00';
              usdc = data.balances.USDC ? parseFloat(data.balances.USDC).toFixed(2) : '0.00';
              eth = data.balances.ETH ? parseFloat(data.balances.ETH).toFixed(4) : '0.000';
            } else if (Array.isArray(data.tokens)) {
              for (const t of data.tokens) {
                if (t.symbol === 'ETH') eth = parseFloat(t.balanceNumeric || 0).toFixed(4);
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
  }, [address]);

  const SHIELD_STEPS  = ['Approving ERC-20 allowance…', 'Generating deposit proof…', 'Broadcasting to L1…', 'Aztec Sequencer confirming…', 'Note committed to tree…'];
  const UNSHIELD_STEPS = ['Generating unshield proof…', 'Nullifying Aztec note…', 'Submitting to Sequencer…', 'L1 withdrawal initiated…'];
  const steps = isShield ? SHIELD_STEPS : UNSHIELD_STEPS;

  const [currentStep, setCurrentStep] = useState(-1);

  const handleSubmit = async () => {
    if (!amount || parseFloat(amount) <= 0) return;

    setStep('progress');
    setCurrentStep(0);

    try {
      if (isShield) {
        const res = await executeShieldDeposit(
          { publicAddress: address, amount, token },
          (label, pct) => {
            setProgressLabel(label);
            setProgressPct(pct);
            const stepIdx = SHIELD_STEPS.findIndex(s => s === label);
            if (stepIdx !== -1) setCurrentStep(stepIdx);
          }
        );
        setResult({ txHash: res.txHash, amount, token });
      } else {
        if (!destination) { setStep('form'); return; }
        const res = await executeUnshield(
          { zkHandle: `zk:${address.slice(2, 6)}`, amount, token, destinationAddress: destination },
          (label, pct) => {
            setProgressLabel(label);
            setProgressPct(pct);
            const stepIdx = UNSHIELD_STEPS.findIndex(s => s === label);
            if (stepIdx !== -1) setCurrentStep(stepIdx);
          }
        );
        setResult({ txHash: res.l1TxHash, amount, token });
      }
      setCurrentStep(steps.length);
      setStep('success');
    } catch (e: any) {
      setError(e?.message ?? 'Unknown error');
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
          <div className="w-10 h-10 rounded-full flex items-center justify-center"
            style={{ background: isShield ? '#25D366' : '#00a884' }}>
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
              {isShield ? 'Move funds into Aztec privacy layer' : 'Withdraw from shielded Aztec note'}
            </p>
          </div>
          <button onClick={onClose} className="ml-auto w-8 h-8 flex items-center justify-center rounded-full bg-black/5">
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
                      onClick={() => setToken(t)}
                      className="flex-1 py-2.5 rounded-2xl text-[13px] font-semibold transition-all"
                      style={{
                        background: token === t ? '#25D366' : '#f0f2f5',
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
                  {isShield ? 'L1 Balance' : 'Shielded Balance'}
                </span>
                <span className="text-[13px] font-bold text-gray-800">
                  {isShield ? l1Balances[token] : shieldedBalance} {token}
                </span>
              </div>

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
                    className="flex-1 bg-[#f0f2f5] rounded-2xl px-4 py-3 text-[15px] font-bold text-gray-900 outline-none border-2 border-transparent focus:border-[#25D366] transition-colors"
                  />
                  <button
                    onClick={() => setAmount(isShield ? l1Balances[token].replace(/,/g, '') : shieldedBalance.replace(/,/g, ''))}
                    className="px-4 py-3 bg-[#25D366]/10 text-[#25D366] font-semibold text-[12px] rounded-2xl"
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
                    className="w-full bg-[#f0f2f5] rounded-2xl px-4 py-3 text-[13px] text-gray-900 outline-none border-2 border-transparent focus:border-[#25D366] transition-colors font-mono"
                  />
                </div>
              )}

              {/* Fee estimate */}
              {amount && parseFloat(amount) > 0 && (
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
                <div className="flex items-start gap-2.5 bg-orange-50 border border-orange-200 rounded-2xl px-3 py-3">
                  <AlertTriangle size={14} className="text-orange-500 flex-shrink-0 mt-0.5" />
                  <p className="text-[11px] text-orange-700 font-medium leading-relaxed">
                    Once unshielded, the transaction amount and destination will be <strong>publicly visible on Ethereum L1</strong>.
                  </p>
                </div>
              )}

              {/* Submit */}
              <button
                onClick={handleSubmit}
                disabled={!amount || parseFloat(amount) <= 0 || (!isShield && !destination)}
                className="w-full py-4 rounded-2xl font-bold text-[15px] text-white transition-all disabled:opacity-50 disabled:cursor-not-allowed"
                style={{ background: 'linear-gradient(135deg, #25D366, #00a884)' }}
              >
                {isShield ? `Shield ${amount || '0'} ${token} Privately` : `Unshield ${amount || '0'} ${token} to L1`}
              </button>
            </motion.div>
          )}

          {/* ── Progress ── */}
          {step === 'progress' && (
            <motion.div key="progress" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="px-5 py-6 space-y-4">
              <div className="text-center mb-4">
                <motion.div
                  className="w-16 h-16 rounded-full mx-auto flex items-center justify-center mb-3"
                  style={{ background: 'linear-gradient(135deg, #25D366, #00a884)' }}
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
                className="w-20 h-20 rounded-full bg-[#25D366] flex items-center justify-center mx-auto"
              >
                <CheckCircle size={36} className="text-white" strokeWidth={2} />
              </motion.div>

              <div>
                <h3 className="text-[20px] font-bold text-gray-900">
                  {isShield ? 'Shielded!' : 'Unshielded!'}
                </h3>
                <p className="text-[13px] text-gray-500 mt-1">
                  {result.amount} {result.token} {isShield ? 'is now in your Aztec shielded wallet' : 'is being withdrawn to L1'}
                </p>
              </div>

              <div className="bg-[#f0f2f5] rounded-2xl px-4 py-3 text-left space-y-1.5">
                <div className="flex justify-between text-[11px]">
                  <span className="text-gray-400">Tx Hash</span>
                  <span className="font-mono text-gray-700 text-[10px]">{result.txHash.slice(0, 10)}…{result.txHash.slice(-6)}</span>
                </div>
                <div className="flex justify-between text-[11px]">
                  <span className="text-gray-400">Status</span>
                  <span className="text-[#25D366] font-semibold">{isShield ? 'Shielded' : 'Initiated'}</span>
                </div>
              </div>

              <a
                href={`https://aztecscan.xyz/tx-effect/${result.txHash.slice(2)}`}
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center justify-center gap-1.5 text-[12px] text-[#25D366] font-semibold"
              >
                <ExternalLink size={12} /> View on AztecScan
              </a>

              <button
                onClick={() => { onSuccess?.(result); onClose(); }}
                className="w-full py-4 rounded-2xl font-bold text-[15px] text-white"
                style={{ background: 'linear-gradient(135deg, #25D366, #00a884)' }}
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
                className="w-full py-4 rounded-2xl font-bold text-[14px] bg-[#f0f2f5] text-gray-700"
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
