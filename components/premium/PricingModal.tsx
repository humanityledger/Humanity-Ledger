"use client";

import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Crown, Zap, Check, Lock, Sparkles, TrendingUp } from 'lucide-react';

interface PricingModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSubscribe: (tier: 'monthly' | 'yearly') => void;
}

export default function PricingModal({ isOpen, onClose, onSubscribe }: PricingModalProps) {
  const [selectedTier, setSelectedTier] = useState<'monthly' | 'yearly'>('monthly');

  const features = [
    'Unlimited Watch Wallets',
    'Real-time Humanity Ledgers',
    'Smart Money Tracking',
    'Wallet Comparison Tool',
    'Copy Attesting Alerts',
    'Batch CSV Import',
    'Advanced Labeling',
    'Priority Notifications',
    'Historical Analytics',
    'API Access'
  ];

  const handleSubscribe = () => {
    onSubscribe(selectedTier);
    onClose();
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
      <motion.div
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        exit={{ opacity: 0, scale: 0.95 }}
        className="relative w-full max-w-4xl bg-gradient-to-br from-[#EAEADF] to-white rounded-3xl shadow-2xl p-8 max-h-[90vh] overflow-y-auto"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Close Button */}
        <button
          onClick={onClose}
          className="absolute top-6 right-6 p-2 rounded-full hover:bg-[#1F1F1F]/10 transition-colors"
        >
          <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
          </svg>
        </button>

        {/* Header */}
        <div className="text-center mb-8">
          <div className="inline-flex items-center gap-2 px-4 py-2 bg-gradient-to-r from-purple-500 to-pink-500 rounded-full text-white font-bold mb-4">
            <Crown size={20} />
            VIP PREMIUM
          </div>
          <h2 className="text-4xl font-black text-[#1F1F1F] mb-2">
            Unlock Ledger Tracker Pro
          </h2>
          <p className="text-[#1F1F1F]/70 text-lg">
            Track unlimited wallets & get instant ledger movement alerts
          </p>
        </div>

        {/* Billing Toggle */}
        <div className="flex items-center justify-center gap-4 mb-8">
          <button
            onClick={() => setSelectedTier('monthly')}
            className={`px-6 py-3 rounded-xl font-bold transition-all ${
              selectedTier === 'monthly'
                ? 'bg-[#1F1F1F] text-white'
                : 'bg-white/50 text-[#1F1F1F]/70'
            }`}
          >
            Monthly
          </button>
          <button
            onClick={() => setSelectedTier('yearly')}
            className={`px-6 py-3 rounded-xl font-bold transition-all relative ${
              selectedTier === 'yearly'
                ? 'bg-[#1F1F1F] text-white'
                : 'bg-white/50 text-[#1F1F1F]/70'
            }`}
          >
            Yearly
            <span className="absolute -top-2 -right-2 px-2 py-0.5 bg-green-500 text-white text-xs rounded-full">
              Save 40%
            </span>
          </button>
        </div>

        {/* Pricing Cards */}
        <div className="grid md:grid-cols-2 gap-6 mb-8">
          {/* Free Tier */}
          <div className="p-6 bg-white/30 rounded-2xl border-2 border-[#1F1F1F]/10">
            <div className="mb-4">
              <h3 className="text-xl font-black text-[#1F1F1F] mb-2">Free</h3>
              <div className="text-3xl font-black text-[#1F1F1F]">
                $0
                <span className="text-sm font-normal text-[#1F1F1F]/70">/month</span>
              </div>
            </div>
            <ul className="space-y-2 mb-6">
              <li className="flex items-start gap-2 text-sm text-[#1F1F1F]/70">
                <Check size={16} className="mt-0.5 text-green-600" />
                Up to 3 watch wallets
              </li>
              <li className="flex items-start gap-2 text-sm text-[#1F1F1F]/70">
                <Check size={16} className="mt-0.5 text-green-600" />
                Basic activity tracking
              </li>
              <li className="flex items-start gap-2 text-sm text-[#1F1F1F]/30">
                <Lock size={16} className="mt-0.5" />
                Real-time alerts
              </li>
              <li className="flex items-start gap-2 text-sm text-[#1F1F1F]/30">
                <Lock size={16} className="mt-0.5" />
                Wallet comparison
              </li>
              <li className="flex items-start gap-2 text-sm text-[#1F1F1F]/30">
                <Lock size={16} className="mt-0.5" />
                Smart money tracking
              </li>
            </ul>
            <div className="text-center text-sm font-bold text-[#1F1F1F]/70">
              Current Plan
            </div>
          </div>

          {/* Pro Tier */}
          <div className="p-6 bg-gradient-to-br from-blue-600 to-blue-700 rounded-2xl border-2 border-[#25D366] relative overflow-hidden shadow-lg col-span-2 md:col-span-1">
            <div className="absolute top-0 right-0 w-32 h-32 bg-white/10 rounded-full blur-3xl" />
            <div className="absolute bottom-0 left-0 w-32 h-32 bg-white/10 rounded-full blur-3xl" />
            
            <div className="relative z-10">
              <div className="flex items-center gap-2 mb-4">
                <Sparkles size={20} className="text-white" />
                <h3 className="text-xl font-black text-white uppercase italic">System Access</h3>
                <span className="ml-auto px-2 py-1 bg-white/20 backdrop-blur-sm rounded-full text-[10px] font-black text-white">
                  LIFETIME VIP
                </span>
              </div>
              
              <div className="text-5xl font-black text-white mb-2 tracking-tighter">
                1.50 
                <span className="text-sm font-bold text-white/70 block lowercase">One-time lifetime payment</span>
              </div>

              <div className="bg-white/10 p-4 rounded-xl mb-6 border border-white/10">
                   <p className="text-xs text-white/90 font-medium leading-relaxed">
                       Unlimited access to Ledger Tracker, Smart Alerts, Wallet Comparison, and much more. No subscriptions.
                   </p>
              </div>

              <ul className="grid grid-cols-2 gap-2 mb-8">
                {features.map((feature, i) => (
                  <li key={i} className="flex items-start gap-2 text-[11px] font-bold text-white">
                    <Check size={14} className="mt-0.5 flex-shrink-0 text-blue-300" />
                    {feature}
                  </li>
                ))}
              </ul>

              <button
                onClick={handleSubscribe}
                className="w-full py-5 bg-white text-blue-600 rounded-2xl font-black text-xl hover:bg-white/90 transition-all flex items-center justify-center gap-3 shadow-xl shadow-blue-900/40 hover:scale-[1.02] active:scale-[0.98]"
              >
                <Zap size={24} />
                DESBLOQUEAR TODO EL PANEL
              </button>

              <div className="mt-4 text-center">
                  <span className="text-[10px] font-black text-white/50 uppercase tracking-[0.2em]">Instant Activation via Humanity Ledger ID</span>
              </div>
            </div>
          </div>
        </div>

        {/* Trust Indicators */}
        <div className="grid grid-cols-3 gap-4 pt-6 border-t border-[#1F1F1F]/10">
          <div className="text-center">
            <div className="text-2xl font-black text-[#1F1F1F] mb-1">10K+</div>
            <div className="text-xs text-[#1F1F1F]/70">Active Users</div>
          </div>
          <div className="text-center">
            <div className="text-2xl font-black text-[#1F1F1F] mb-1">$500M+</div>
            <div className="text-xs text-[#1F1F1F]/70">Tracked Volume</div>
          </div>
          <div className="text-center">
            <div className="text-2xl font-black text-[#1F1F1F] mb-1">24/7</div>
            <div className="text-xs text-[#1F1F1F]/70">Active Monitoring</div>
          </div>
        </div>

        {/* Footer */}
        <div className="mt-6 text-center text-xs text-[#1F1F1F]/60">
           Cancel anytime   Secure payment   7-day money-back guarantee
        </div>
      </motion.div>
    </div>
  );
}


