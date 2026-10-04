"use client";

import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { HLLogo } from '@/components/shared/HLLogo';
import { Shield, Zap, Users, Bell } from 'lucide-react';

export function OnboardingFlow({
  walletAddress,
  onComplete
}: {
  walletAddress: string;
  onComplete: () => void;
}) {
  const [step, setStep] = useState(1);
  const [displayName, setDisplayName] = useState('');

  const finish = () => {
    if (displayName) {
      localStorage.setItem('ledger_displayName', displayName);
    }
    localStorage.setItem(`ledger_onboarded_${walletAddress}`, 'true');
    onComplete();
  };

  const handleNotifications = async () => {
    try {
      if ('Notification' in window) {
        await Notification.requestPermission();
      }
    } catch (e) {}
    finish();
  };

  const variants = {
    initial: { opacity: 0, x: 20 },
    animate: { opacity: 1, x: 0 },
    exit: { opacity: 0, x: -20 }
  };

  return (
    <div className="fixed inset-0 z-[99999] bg-white flex flex-col items-center justify-center font-sans">
      <div className="w-full max-w-[480px] p-6 flex flex-col items-center h-full max-h-[800px] justify-between">
        
        {/* Progress dots */}
        <div className="w-full flex justify-center gap-2 pt-8">
          {[1, 2, 3, 4].map(i => (
            <div 
              key={i} 
              className={`h-1.5 rounded-full transition-all duration-300 ${i === step ? 'w-8 bg-[#25D366]' : 'w-2 bg-black/10'}`} 
            />
          ))}
        </div>

        <div className="flex-1 w-full flex flex-col justify-center relative overflow-hidden my-8">
          <AnimatePresence mode="wait">
            
            {step === 1 && (
              <motion.div 
                key="step1" variants={variants} initial="initial" animate="animate" exit="exit" transition={{ duration: 0.3 }}
                className="w-full flex flex-col items-center text-center px-4 absolute top-1/2 -translate-y-1/2"
              >
                <div className="mb-8 p-4 bg-black/5 rounded-[32px]">
                  <HLLogo size={64} />
                </div>
                <h1 className="text-2xl font-black text-black mb-4 tracking-tighter">Private messaging for the next generation</h1>
                <p className="text-[14px] text-black/60 font-mono leading-relaxed max-w-sm">
                  Chat freely. No phone number required. No surveillance. Your wallet is your identity.
                </p>
              </motion.div>
            )}

            {step === 2 && (
              <motion.div 
                key="step2" variants={variants} initial="initial" animate="animate" exit="exit" transition={{ duration: 0.3 }}
                className="w-full flex flex-col px-4 absolute top-1/2 -translate-y-1/2"
              >
                <h1 className="text-2xl font-black text-black mb-4 tracking-tighter text-center">Your identity</h1>
                <p className="text-[13px] text-black/60 font-mono leading-relaxed text-center mb-8">
                  No username or password needed. Your Ethereum wallet signs in automatically and secures your messages.
                </p>
                
                <div className="bg-black/5 rounded-2xl p-4 flex items-center justify-center mb-8">
                  <code className="text-black/50 text-[12px] font-mono tracking-widest">{walletAddress.slice(0, 8)}...{walletAddress.slice(-6)}</code>
                </div>

                <div className="flex flex-col gap-2">
                  <label className="text-[11px] font-black uppercase tracking-widest text-black">Display Name (Optional)</label>
                  <input 
                    type="text" 
                    value={displayName}
                    onChange={(e) => setDisplayName(e.target.value)}
                    placeholder="How should others see you?"
                    className="w-full bg-white border border-black/10 rounded-xl px-4 py-3 text-[14px] text-black focus:border-[#25D366] focus:outline-none transition-colors"
                  />
                </div>
              </motion.div>
            )}

            {step === 3 && (
              <motion.div 
                key="step3" variants={variants} initial="initial" animate="animate" exit="exit" transition={{ duration: 0.3 }}
                className="w-full flex flex-col px-4 absolute top-1/2 -translate-y-1/2"
              >
                <h1 className="text-2xl font-black text-black mb-8 tracking-tighter text-center">How it works</h1>
                
                <div className="flex flex-col gap-6">
                  <div className="flex items-start gap-4">
                    <div className="w-10 h-10 rounded-full bg-[#25D366]/10 flex items-center justify-center shrink-0">
                      <Shield className="text-[#25D366]" size={20} />
                    </div>
                    <div>
                      <h3 className="text-[14px] font-bold text-black mb-1">End-to-End Encrypted</h3>
                      <p className="text-[12px] text-black/60 leading-relaxed font-mono">Only you and your contact can read your messages. Not even us.</p>
                    </div>
                  </div>
                  
                  <div className="flex items-start gap-4">
                    <div className="w-10 h-10 rounded-full bg-[#25D366]/10 flex items-center justify-center shrink-0">
                      <Zap className="text-[#25D366]" size={20} />
                    </div>
                    <div>
                      <h3 className="text-[14px] font-bold text-black mb-1">Instant & Free</h3>
                      <p className="text-[12px] text-black/60 leading-relaxed font-mono">Send messages instantly without blockchain gas fees.</p>
                    </div>
                  </div>

                  <div className="flex items-start gap-4">
                    <div className="w-10 h-10 rounded-full bg-[#25D366]/10 flex items-center justify-center shrink-0">
                      <Users className="text-[#25D366]" size={20} />
                    </div>
                    <div>
                      <h3 className="text-[14px] font-bold text-black mb-1">Communities</h3>
                      <p className="text-[12px] text-black/60 leading-relaxed font-mono">Join groups with free public spaces and premium access channels.</p>
                    </div>
                  </div>
                </div>
              </motion.div>
            )}

            {step === 4 && (
              <motion.div 
                key="step4" variants={variants} initial="initial" animate="animate" exit="exit" transition={{ duration: 0.3 }}
                className="w-full flex flex-col items-center text-center px-4 absolute top-1/2 -translate-y-1/2"
              >
                <div className="mb-8 w-20 h-20 rounded-full bg-blue-500/10 flex items-center justify-center">
                  <Bell className="text-blue-500" size={32} />
                </div>
                <h1 className="text-2xl font-black text-black mb-4 tracking-tighter">Stay connected</h1>
                <p className="text-[14px] text-black/60 font-mono leading-relaxed max-w-sm mb-2">
                  Enable notifications to receive messages even when the app is in the background.
                </p>
                <p className="text-[11px] text-black/40 font-mono">
                  You can change this anytime in Settings.
                </p>
              </motion.div>
            )}

          </AnimatePresence>
        </div>

        <div className="w-full flex flex-col gap-3 pb-8">
          {step < 4 ? (
            <button 
              onClick={() => setStep(s => s + 1)}
              className="w-full py-4 rounded-2xl bg-black text-white text-[13px] font-black uppercase tracking-widest hover:bg-black/80 transition-colors active:scale-[0.98]"
            >
              {step === 1 ? 'Get Started' : 'Continue'}
            </button>
          ) : (
            <>
              <button 
                onClick={handleNotifications}
                className="w-full py-4 rounded-2xl bg-[#25D366] text-white text-[13px] font-black uppercase tracking-widest hover:bg-[#20bd5a] transition-colors active:scale-[0.98]"
              >
                Enable Notifications
              </button>
              <button 
                onClick={finish}
                className="w-full py-4 rounded-2xl bg-transparent text-black/40 text-[11px] font-black uppercase tracking-widest hover:text-black transition-colors"
              >
                Skip for now
              </button>
            </>
          )}
        </div>

      </div>
    </div>
  );
}
