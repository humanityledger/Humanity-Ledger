'use client';

import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { CheckCircle, ArrowRight, Wallet, Lock, Zap, X } from 'lucide-react';
import {
  validateZkHandle, formatZkTag, registerIdentity,
  getShieldedBalances, executeShieldDeposit, SupportedToken,
} from '@/lib/zk/zkMoney';
import { createIdentity } from '@/lib/zk/zkIdentity';

// ─── Props ─────────────────────────────────────────────────────────────────────

interface ZkOnboardingProps {
  address: string;
  onComplete: (handle: string) => void;
  onSkip?: () => void;
}

// ─── Steps ─────────────────────────────────────────────────────────────────────

type OnboardingStep = 'welcome' | 'handle' | 'fund' | 'privacy' | 'done';

const STEPS: OnboardingStep[] = ['welcome', 'handle', 'fund', 'privacy', 'done'];

function StepDots({ current }: { current: number }) {
  return (
    <div className="flex items-center gap-1.5 justify-center">
      {STEPS.map((_, i) => (
        <div
          key={i}
          className="rounded-full transition-all duration-300"
          style={{
            width:  i === current ? 20 : 6,
            height: 6,
            background: i <= current ? '#1C1C1E' : '#EBE5DC',
          }}
        />
      ))}
    </div>
  );
}

// ─── Main Component ────────────────────────────────────────────────────────────

export function ZkOnboarding({ address, onComplete, onSkip }: ZkOnboardingProps) {
  const [stepIdx,    setStepIdx]    = useState(0);
  const [handle,     setHandle]     = useState('');
  const [handleErr,  setHandleErr]  = useState('');
  const [fundToken,  setFundToken]  = useState<SupportedToken>('DAI');
  const [fundAmount, setFundAmount] = useState('100');
  const [shielding,  setShielding]  = useState(false);
  const [shieldDone, setShieldDone] = useState(false);
  const [shieldStep, setShieldStep] = useState('');

  const step = STEPS[stepIdx];

  const handleValidate = () => {
    const fullHandle = handle.startsWith('zk:') ? handle : `zk:${handle}`;
    const { valid, error } = validateZkHandle(fullHandle);
    if (!valid) { setHandleErr(error ?? 'Invalid handle'); return; }
    setHandleErr('');

    try {
      createIdentity(address, handle, { displayName: handle });
      registerIdentity(address, handle);
    } catch {}
    setStepIdx(2);
  };

  const handleShield = async () => {
    setShielding(true);
    try {
      await executeShieldDeposit(
        { publicAddress: address, amount: fundAmount, token: fundToken },
        (label, _pct) => setShieldStep(label)
      );
      setShieldDone(true);
    } catch {}
    setShielding(false);
  };

  const slides: Record<OnboardingStep, React.ReactNode> = {
    welcome: (
      <div className="flex flex-col items-center text-center gap-6 py-4">
        <motion.div
          animate={{ rotate: [0, 5, -5, 0], scale: [1, 1.05, 1] }}
          transition={{ duration: 2, repeat: Infinity, repeatDelay: 3 }}
          className="w-24 h-24 rounded-3xl flex items-center justify-center shadow-lg"
          style={{ background: '#1C1C1E' }}
        >
          <Lock size={44} className="text-white" strokeWidth={1.5} />
        </motion.div>

        <div>
          <h2 className="text-[24px] font-bold text-gray-900">Welcome to zk.money</h2>
          <p className="text-[14px] text-gray-500 mt-2 leading-relaxed max-w-[280px] mx-auto">
            Private, shielded payments directly inside Ledger Chat.
            Powered by <strong>Aztec Network</strong>.
          </p>
        </div>

        <div className="w-full space-y-2.5 text-left">
          {[
            { icon: Lock,   text: 'Zero on-chain exposure — amounts stay private' },
            { icon: Zap,    text: 'Instant UltraPlonk proof generation in browser' },
            { icon: Wallet, text: 'Send DAI, USDC, ETH to any zk:handle' },
          ].map(({ icon: Icon, text }) => (
            <div key={text} className="flex items-start gap-3 bg-[#f0f2f5] rounded-2xl px-4 py-3">
              <Icon size={15} className="text-[#1C1C1E] flex-shrink-0 mt-0.5" strokeWidth={2} />
              <span className="text-[13px] text-gray-700 font-medium">{text}</span>
            </div>
          ))}
        </div>

        <button
          onClick={() => setStepIdx(1)}
          className="w-full py-4 rounded-2xl font-bold text-[15px] text-white"
          style={{ background: '#1C1C1E' }}
        >
          Get Started <ArrowRight className="inline ml-1" size={16} />
        </button>
      </div>
    ),

    handle: (
      <div className="flex flex-col gap-5 py-4">
        <div className="text-center">
          <h2 className="text-[22px] font-bold text-gray-900">Choose Your Handle</h2>
          <p className="text-[13px] text-gray-500 mt-1">
            Your public zk.money identity — memorable and private
          </p>
        </div>

        <div>
          <div className="flex items-center bg-[#f0f2f5] rounded-2xl overflow-hidden border-2 border-transparent focus-within:border-[#1C1C1E] transition-colors">
            <span className="pl-4 pr-1 text-[15px] font-bold text-[#1C1C1E]">zk:</span>
            <input
              type="text"
              autoFocus
              placeholder="yourname"
              value={handle.startsWith('zk:') ? handle.slice(3) : handle}
              onChange={e => {
                setHandle(e.target.value.toLowerCase().replace(/[^a-z0-9_.-]/g, ''));
                setHandleErr('');
              }}
              className="flex-1 bg-transparent py-3 pr-4 text-[15px] font-bold text-gray-900 outline-none"
              maxLength={32}
            />
          </div>
          {handleErr && (
            <p className="text-[11px] text-red-500 mt-1.5 ml-1">{handleErr}</p>
          )}
          {handle && !handleErr && (
            <p className="text-[11px] text-[#1C1C1E] mt-1.5 ml-1 flex items-center gap-1">
              <CheckCircle size={10} />
              Your handle: zk:{handle.startsWith('zk:') ? handle.slice(3) : handle}
            </p>
          )}
        </div>

        <p className="text-[11px] text-gray-400 bg-[#f0f2f5] rounded-xl px-3 py-2.5">
          3–32 characters. Lowercase letters, digits, underscores, dots, hyphens only.
          Cannot be changed once registered.
        </p>

        <div className="flex gap-2">
          <button onClick={() => setStepIdx(0)}
            className="flex-1 py-3.5 rounded-2xl font-semibold text-[14px] bg-[#f0f2f5] text-gray-600">
            Back
          </button>
          <button
            onClick={handleValidate}
            disabled={!handle || handle.length < 3}
            className="flex-1 py-3.5 rounded-2xl font-bold text-[14px] text-white disabled:opacity-50"
            style={{ background: '#1C1C1E' }}
          >
            Reserve Handle
          </button>
        </div>
      </div>
    ),

    fund: (
      <div className="flex flex-col gap-5 py-4">
        <div className="text-center">
          <h2 className="text-[22px] font-bold text-gray-900">Fund Your Shield</h2>
          <p className="text-[13px] text-gray-500 mt-1">
            Deposit authentic funds from Ethereum L1 into your Aztec notes
          </p>
        </div>

        <div className="bg-[#f0f2f5] rounded-2xl p-4 text-left space-y-2">
          <div className="flex items-center gap-2">
            <Lock size={16} className="text-[#1C1C1E]" />
            <span className="text-[13px] font-bold text-[#1C1C1E]">Zero-Mock On-Chain Standard</span>
          </div>
          <p className="text-[12px] text-gray-600 leading-relaxed">
            Your initial shielded balance is strictly <strong>0.00</strong>. Simulated or mock credits are completely disabled.
          </p>
          <p className="text-[11px] text-gray-500 leading-relaxed">
            You can deposit real ETH, DAI, or USDC from your connected Web3 wallet anytime via Settings → Payments, or receive private payments from peers using your sovereign handle.
          </p>
        </div>

        <button
          onClick={() => setStepIdx(3)}
          className="w-full py-3.5 rounded-2xl font-bold text-[14px] text-white flex items-center justify-center gap-2 shadow-sm"
          style={{ background: '#1C1C1E' }}
        >
          Continue to Privacy Architecture <ArrowRight size={15} />
        </button>
      </div>
    ),

    privacy: (
      <div className="flex flex-col gap-5 py-4">
        <div className="text-center">
          <h2 className="text-[22px] font-bold text-gray-900">Privacy Tutorial</h2>
          <p className="text-[13px] text-gray-500 mt-1">How your privacy works on Aztec</p>
        </div>

        <div className="space-y-3">
          {[
            {
              title: 'Anonymity Set',
              body: 'Your transactions mix with other Aztec users. The larger the set, the stronger your privacy.',
              icon: '🌐',
            },
            {
              title: 'Note Maturity',
              body: 'Waiting 2+ blocks before spending dramatically increases your anonymity score.',
              icon: '⏳',
            },
            {
              title: 'Private Memos',
              body: 'Payment memos are encrypted and only visible to sender and recipient — never on-chain.',
              icon: '🔐',
            },
            {
              title: 'zk Handle Hygiene',
              body: 'Avoid reusing the same handle for different financial counterparties to maximize privacy.',
              icon: '🎭',
            },
          ].map(({ title, body, icon }) => (
            <div key={title} className="flex items-start gap-3 bg-[#f0f2f5] rounded-2xl px-4 py-3">
              <span className="text-xl flex-shrink-0">{icon}</span>
              <div>
                <div className="font-bold text-gray-900 text-[13px]">{title}</div>
                <div className="text-[11px] text-gray-500 mt-0.5 leading-relaxed">{body}</div>
              </div>
            </div>
          ))}
        </div>

        <button
          onClick={() => setStepIdx(4)}
          className="w-full py-4 rounded-2xl font-bold text-[15px] text-white"
          style={{ background: '#1C1C1E' }}
        >
          I Understand — Let's Go!
        </button>
      </div>
    ),

    done: (
      <div className="flex flex-col items-center text-center gap-6 py-6">
        <motion.div
          initial={{ scale: 0 }}
          animate={{ scale: 1 }}
          transition={{ type: 'spring', stiffness: 500, damping: 20 }}
          className="w-24 h-24 rounded-3xl flex items-center justify-center shadow-lg"
          style={{ background: '#1C1C1E' }}
        >
          <CheckCircle size={44} className="text-white" strokeWidth={1.5} />
        </motion.div>

        <div>
          <h2 className="text-[24px] font-bold text-gray-900">You're All Set!</h2>
          <p className="text-[14px] text-gray-500 mt-2 leading-relaxed max-w-[260px] mx-auto">
            Your zk.money identity <strong className="text-[#1C1C1E]">zk:{handle}</strong> is ready.
            Start sending private payments from any conversation.
          </p>
        </div>

        <div className="w-full bg-[#f0f2f5] rounded-2xl px-4 py-4 text-left space-y-1.5">
          <div className="text-[10px] font-semibold text-gray-400 uppercase tracking-wide mb-2">Your Identity</div>
          <div className="flex justify-between text-[12px]">
            <span className="text-gray-500">zk Handle</span>
            <span className="font-bold text-[#1C1C1E]">zk:{handle.startsWith('zk:') ? handle.slice(3) : handle}</span>
          </div>
          <div className="flex justify-between text-[12px]">
            <span className="text-gray-500">Network</span>
            <span className="font-semibold text-gray-800">Aztec Mainnet</span>
          </div>
          <div className="flex justify-between text-[12px]">
            <span className="text-gray-500">Privacy</span>
            <span className="font-semibold text-[#1C1C1E]">Maximum (UltraPlonk)</span>
          </div>
        </div>

        <button
          onClick={() => onComplete(handle.startsWith('zk:') ? handle : `zk:${handle}`)}
          className="w-full py-4 rounded-2xl font-bold text-[15px] text-white"
          style={{ background: '#1C1C1E' }}
        >
          Open Shielded Wallet
        </button>
      </div>
    ),
  };

  return (
    <div
      className="flex flex-col gap-5 bg-white rounded-3xl p-5 w-full max-w-sm mx-auto"
      style={{ fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif' }}
    >
      {/* Skip button */}
      {onSkip && step !== 'done' && (
        <div className="flex justify-end">
          <button onClick={onSkip} className="text-[11px] text-gray-400 flex items-center gap-1">
            Skip <X size={11} />
          </button>
        </div>
      )}

      {/* Step dots */}
      <StepDots current={stepIdx} />

      {/* Slide */}
      <AnimatePresence mode="wait">
        <motion.div
          key={step}
          initial={{ opacity: 0, x: 30 }}
          animate={{ opacity: 1, x: 0 }}
          exit={{ opacity: 0, x: -30 }}
          transition={{ duration: 0.2 }}
        >
          {slides[step]}
        </motion.div>
      </AnimatePresence>
    </div>
  );
}
