'use client';

import React, { useState, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Camera, ChevronRight, Check, MapPin, AtSign, User, Shield, Bell, Lock, Fingerprint } from 'lucide-react';
import { useLedgerSettings } from '@/components/terminal/LedgerChatSettings';

interface OnboardingProps {
  address: string;
  onComplete: () => void;
}

const COUNTRIES = [
  "Global (Earth)", "United States", "United Kingdom", "Spain", "Mexico",
  "Argentina", "Colombia", "Brazil", "France", "Germany", "Japan", "South Korea",
  "Canada", "Australia", "India", "China", "Italy", "Netherlands", "Switzerland",
  "Sweden", "Norway", "Denmark", "Finland", "Russia", "South Africa", "Nigeria",
  "Egypt", "Kenya", "Saudi Arabia", "United Arab Emirates", "Turkey", "Israel",
  "Singapore", "Malaysia", "Indonesia", "Vietnam", "Thailand", "Philippines",
  "New Zealand", "Chile", "Peru", "Venezuela", "Ecuador", "Bolivia", "Paraguay",
  "Uruguay", "Poland", "Ukraine", "Romania", "Greece", "Portugal", "Ireland"
];

export function LedgerChatOnboarding({ address, onComplete }: OnboardingProps) {
  const { updateBatch, isLoaded } = useLedgerSettings(address);
  const [step, setStep] = useState(1);
  const [displayName, setDisplayName] = useState('');
  const [username, setUsername] = useState('');
  const [avatar, setAvatar] = useState('');
  const [country, setCountry] = useState('Global (Earth)');
  const [bio, setBio] = useState('');
  const [pin, setPin] = useState('');
  const [notificationsEnabled, setNotificationsEnabled] = useState(false);
  const [privacyLastSeen, setPrivacyLastSeen] = useState<'everybody' | 'contacts' | 'nobody'>('everybody');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  if (!isLoaded) return null;

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onload = (ev) => {
        if (ev.target?.result) setAvatar(ev.target.result as string);
      };
      reader.readAsDataURL(file);
    }
  };

  const handleNext = () => {
    if (step === 1) {
      setStep(2);
    } else if (step === 2 && username.trim().length >= 3) {
      let finalUsername = username.trim();
      if (!finalUsername.startsWith('@')) {
        finalUsername = '@' + finalUsername;
      }
      setUsername(finalUsername);
      setStep(3);
    } else if (step === 3) {
      setStep(4);
    } else if (step === 4 && pin.length === 6) {
      setStep(5);
    }
  };

  const handleFinish = async () => {
    setIsSubmitting(true);
    let finalUsername = username.trim();
    if (!finalUsername.startsWith('@')) finalUsername = '@' + finalUsername;

    await updateBatch({
      displayName: displayName.trim() || finalUsername,
      username: finalUsername,
      avatar_url: avatar,
      bio: bio.trim() || `From ${country}`,
      privacy_last_seen: privacyLastSeen,
      notification_sound: notificationsEnabled,
    });

    if (pin.length === 6) {
      try {
        const pinRes = await fetch('/api/auth/enclave-pin', {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ newPin: pin }),
          credentials: 'include',
        });
        if (pinRes.ok) {
          const pinData = await pinRes.json().catch(() => ({}));
          if (pinData.clearanceToken && pinData.clearanceTs && typeof window !== 'undefined') {
            const token = pinData.clearanceToken as string;
            const ts = pinData.clearanceTs as number;
            const combined = `${token}:${ts}:ledger_enclave`;
            const enc = new TextEncoder();
            const hashBuf = await crypto.subtle.digest('SHA-256', enc.encode(combined));
            const hashArr = Array.from(new Uint8Array(hashBuf));
            const fingerprint = hashArr.map(b => b.toString(16).padStart(2, '0')).join('');
            sessionStorage.setItem('enclave_clearance_token', token);
            sessionStorage.setItem('enclave_clearance_ts', String(ts));
            sessionStorage.setItem('enclave_clearance_fp', fingerprint);
          }
        }
      } catch {}
    }

    try {
      await fetch('/api/users/register', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          walletAddress: address,
          displayName: displayName.trim(),
          chatName: finalUsername.replace('@', ''),
          bio: bio.trim() || `From ${country}`,
        }),
      });
    } catch {}

    if (typeof window !== 'undefined') {
      localStorage.setItem(`ledger_onboarded_${address}`, 'true');
    }

    setIsSubmitting(false);
    onComplete();
  };

  const totalSteps = 5;

  return (
    <div className="fixed inset-0 z-[999999] bg-white overflow-y-auto font-sans">
      <div className="min-h-full flex flex-col items-center justify-center py-8 px-4 sm:px-6">

        {/* Progress dots */}
        <div className="flex items-center gap-2 mb-8">
          {Array.from({ length: totalSteps }).map((_, i) => (
            <div
              key={i}
              className={`rounded-full transition-all duration-500 ${
                i + 1 === step
                  ? 'w-6 h-2 bg-black'
                  : i + 1 < step
                  ? 'w-2 h-2 bg-black/40'
                  : 'w-2 h-2 bg-black/10'
              }`}
            />
          ))}
        </div>

        <motion.div
          initial={{ opacity: 0, y: 24 }}
          animate={{ opacity: 1, y: 0 }}
          className="w-full max-w-md bg-white relative"
        >
          <AnimatePresence mode="wait">

            {/* STEP 1 — Welcome */}
            {step === 1 && (
              <motion.div
                key="step1"
                initial={{ opacity: 0, x: 20 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -20 }}
                className="flex flex-col items-center text-center"
              >
                <div className="w-16 h-16 bg-black rounded-2xl flex items-center justify-center mb-8">
                  <Shield size={28} className="text-white" />
                </div>
                <h2 className="text-[32px] font-black text-black mb-3 tracking-tight leading-tight">
                  Welcome to<br />Ledger Chat
                </h2>
                <p className="text-[15px] text-black/50 font-medium leading-relaxed mb-10 max-w-xs">
                  End-to-end encrypted messaging, built on the Aztec Protocol. Your keys. Your identity. Your data.
                </p>
                <button
                  onClick={handleNext}
                  className="w-full py-4 bg-black hover:bg-black/80 rounded-2xl text-white font-bold text-[15px] flex items-center justify-center gap-2 transition-all"
                >
                  Get Started <ChevronRight size={18} />
                </button>
                <p className="text-[12px] text-black/30 mt-6">
                  Available on the web now. Mobile apps coming soon.
                </p>
              </motion.div>
            )}

            {/* STEP 2 — Identity */}
            {step === 2 && (
              <motion.div
                key="step2"
                initial={{ opacity: 0, x: 20 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -20 }}
                className="flex flex-col items-center"
              >
                <p className="text-[11px] font-bold text-black/30 uppercase tracking-[0.2em] mb-2 self-start">Step 2 of 5</p>
                <h2 className="text-[28px] font-black text-black mb-1 self-start tracking-tight">Create your identity</h2>
                <p className="text-[14px] text-black/40 font-medium self-start mb-8">
                  Set up your profile to connect with others.
                </p>

                {/* Avatar */}
                <div
                  className="w-20 h-20 rounded-full bg-black/5 border border-black/10 flex items-center justify-center relative cursor-pointer hover:border-black/30 transition-all mb-8 overflow-hidden"
                  onClick={() => fileRef.current?.click()}
                >
                  {avatar ? (
                    <img src={avatar} alt="Avatar" className="w-full h-full object-cover" />
                  ) : (
                    <div className="flex flex-col items-center text-black/30">
                      <Camera size={24} />
                      <span className="text-[11px] font-bold mt-1">Photo</span>
                    </div>
                  )}
                  <input type="file" ref={fileRef} accept="image/*" className="hidden" onChange={handleFileChange} />
                </div>

                <div className="w-full mb-4">
                  <label className="block text-[12px] font-bold text-black/50 mb-2 uppercase tracking-[0.1em]">Full Name</label>
                  <div className="relative">
                    <User size={16} className="absolute left-4 top-1/2 -translate-y-1/2 text-black/25" />
                    <input
                      type="text"
                      value={displayName}
                      onChange={(e) => setDisplayName(e.target.value)}
                      placeholder="Satoshi Nakamoto"
                      className="w-full bg-black/[0.04] border border-transparent focus:border-black/20 focus:bg-white rounded-xl py-3.5 pl-11 pr-4 text-[15px] font-semibold text-black outline-none transition-all placeholder:text-black/25"
                    />
                  </div>
                </div>

                <div className="w-full mb-8">
                  <label className="block text-[12px] font-bold text-black/50 mb-2 uppercase tracking-[0.1em]">Username</label>
                  <div className="relative">
                    <AtSign size={16} className="absolute left-4 top-1/2 -translate-y-1/2 text-black/25" />
                    <input
                      type="text"
                      value={username}
                      onChange={(e) => setUsername(e.target.value)}
                      placeholder="ledger"
                      className="w-full bg-black/[0.04] border border-transparent focus:border-black/20 focus:bg-white rounded-xl py-3.5 pl-11 pr-4 text-[15px] font-semibold text-black outline-none transition-all placeholder:text-black/25"
                    />
                  </div>
                  {username.trim().length > 0 && username.trim().length < 3 && (
                    <p className="text-[12px] text-red-500 mt-1.5">Minimum 3 characters required.</p>
                  )}
                </div>

                <button
                  onClick={handleNext}
                  disabled={username.trim().length < 3}
                  className="w-full py-4 bg-black hover:bg-black/80 disabled:opacity-30 disabled:cursor-not-allowed rounded-2xl text-white font-bold text-[15px] flex items-center justify-center gap-2 transition-all"
                >
                  Continue <ChevronRight size={18} />
                </button>
              </motion.div>
            )}

            {/* STEP 3 — Location & Bio */}
            {step === 3 && (
              <motion.div
                key="step3"
                initial={{ opacity: 0, x: 20 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -20 }}
                className="flex flex-col items-center"
              >
                <p className="text-[11px] font-bold text-black/30 uppercase tracking-[0.2em] mb-2 self-start">Step 3 of 5</p>
                <h2 className="text-[28px] font-black text-black mb-1 self-start tracking-tight">Location &amp; Bio</h2>
                <p className="text-[14px] text-black/40 font-medium self-start mb-8">
                  Let others know a bit more about you.
                </p>

                <div className="w-full mb-4">
                  <label className="block text-[12px] font-bold text-black/50 mb-2 uppercase tracking-[0.1em]">Country / Region</label>
                  <div className="relative">
                    <MapPin size={16} className="absolute left-4 top-1/2 -translate-y-1/2 text-black/25" />
                    <select
                      value={country}
                      onChange={(e) => setCountry(e.target.value)}
                      className="w-full bg-black/[0.04] border border-transparent focus:border-black/20 focus:bg-white rounded-xl py-3.5 pl-11 pr-4 text-[15px] font-semibold text-black outline-none transition-all appearance-none cursor-pointer"
                    >
                      {COUNTRIES.map(c => <option key={c} value={c}>{c}</option>)}
                    </select>
                  </div>
                </div>

                <div className="w-full mb-8">
                  <label className="block text-[12px] font-bold text-black/50 mb-2 uppercase tracking-[0.1em]">Short Bio</label>
                  <textarea
                    value={bio}
                    onChange={(e) => setBio(e.target.value)}
                    placeholder="Exploring the frontier of encrypted communications..."
                    rows={3}
                    className="w-full bg-black/[0.04] border border-transparent focus:border-black/20 focus:bg-white rounded-xl p-4 text-[15px] font-medium text-black outline-none transition-all resize-none placeholder:text-black/25"
                  />
                </div>

                <button
                  onClick={handleNext}
                  className="w-full py-4 bg-black hover:bg-black/80 rounded-2xl text-white font-bold text-[15px] flex items-center justify-center gap-2 transition-all"
                >
                  Continue <ChevronRight size={18} />
                </button>
              </motion.div>
            )}

            {/* STEP 4 — Security Enclave */}
            {step === 4 && (
              <motion.div
                key="step4"
                initial={{ opacity: 0, x: 20 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -20 }}
                className="flex flex-col items-center"
              >
                <p className="text-[11px] font-bold text-black/30 uppercase tracking-[0.2em] mb-2 self-start">Step 4 of 5</p>
                <h2 className="text-[28px] font-black text-black mb-1 self-start tracking-tight">Secure your account</h2>
                <p className="text-[14px] text-black/40 font-medium self-start mb-8">
                  Set a 6-digit PIN to protect your encrypted vault.
                </p>

                <div className="w-full mb-6">
                  <label className="block text-[12px] font-bold text-black/50 mb-2 uppercase tracking-[0.1em]">
                    Vault PIN
                  </label>
                  {/* PIN dots */}
                  <div className="flex justify-center gap-4 mb-4">
                    {Array.from({ length: 6 }).map((_, i) => (
                      <div
                        key={i}
                        className={`w-4 h-4 rounded-full border-2 transition-all ${
                          pin.length > i ? 'bg-black border-black' : 'border-black/20 bg-transparent'
                        }`}
                      />
                    ))}
                  </div>
                  <input
                    type="password"
                    inputMode="numeric"
                    value={pin}
                    onChange={(e) => setPin(e.target.value.replace(/[^0-9]/g, ''))}
                    maxLength={6}
                    className="w-full bg-black/[0.04] border border-transparent focus:border-black/20 focus:bg-white rounded-xl py-3.5 text-center text-2xl tracking-[0.8em] font-black text-black outline-none transition-all"
                    autoFocus
                  />
                </div>

                <div className="w-full mb-8">
                  <label className="block text-[12px] font-bold text-black/50 mb-2 uppercase tracking-[0.1em]">Online status visibility</label>
                  <select
                    value={privacyLastSeen}
                    onChange={(e) => setPrivacyLastSeen(e.target.value as any)}
                    className="w-full bg-black/[0.04] border border-transparent focus:border-black/20 focus:bg-white rounded-xl py-3.5 px-4 text-[15px] font-semibold text-black outline-none transition-all appearance-none cursor-pointer"
                  >
                    <option value="everybody">Everybody</option>
                    <option value="contacts">My Contacts Only</option>
                    <option value="nobody">Nobody</option>
                  </select>
                </div>

                <button
                  onClick={handleNext}
                  disabled={pin.length !== 6}
                  className="w-full py-4 bg-black hover:bg-black/80 disabled:opacity-30 disabled:cursor-not-allowed rounded-2xl text-white font-bold text-[15px] flex items-center justify-center gap-2 transition-all"
                >
                  Continue <ChevronRight size={18} />
                </button>
              </motion.div>
            )}

            {/* STEP 5 — Done */}
            {step === 5 && (
              <motion.div
                key="step5"
                initial={{ opacity: 0, scale: 0.96 }}
                animate={{ opacity: 1, scale: 1 }}
                className="flex flex-col items-center text-center py-4"
              >
                <motion.div
                  initial={{ scale: 0 }}
                  animate={{ scale: 1 }}
                  transition={{ type: 'spring', stiffness: 400, damping: 25, delay: 0.1 }}
                  className="w-16 h-16 rounded-full bg-black flex items-center justify-center mb-8"
                >
                  <Check size={28} className="text-white" strokeWidth={3} />
                </motion.div>

                <h2 className="text-[32px] font-black text-black mb-3 tracking-tight">You are in.</h2>
                <p className="text-[15px] text-black/50 font-medium leading-relaxed mb-6 max-w-xs">
                  Your encrypted identity has been secured. Welcome to Ledger Chat.
                </p>

                <div className="text-center py-4 mb-6">
                  <p className="text-[13px] text-black/50 mb-1">Your welcome gift</p>
                  <p className="text-[32px] font-black text-[#1C1C1E]">50,000 QD</p>
                  <p className="text-[12px] text-black/40">Quantum Dots — your starting balance</p>
                </div>

                <div className="w-full border border-black/8 rounded-2xl p-4 flex items-center justify-between mb-8 text-left">
                  <div className="flex items-center gap-3">
                    <div className="w-9 h-9 rounded-full bg-black/5 flex items-center justify-center">
                      <Bell size={16} className="text-black/50" />
                    </div>
                    <div>
                      <p className="text-[14px] font-bold text-black">Enable Notifications</p>
                      <p className="text-[12px] text-black/40">Get alerts for messages &amp; calls</p>
                    </div>
                  </div>
                  <button
                    onClick={() => setNotificationsEnabled(!notificationsEnabled)}
                    className={`w-11 h-6 rounded-full relative transition-colors ${notificationsEnabled ? 'bg-black' : 'bg-black/15'}`}
                  >
                    <div className={`w-4 h-4 rounded-full bg-white absolute top-1 transition-transform shadow ${notificationsEnabled ? 'translate-x-6' : 'translate-x-1'}`} />
                  </button>
                </div>

                <button
                  onClick={handleFinish}
                  disabled={isSubmitting}
                  className="w-full py-4 bg-black hover:bg-black/80 disabled:opacity-50 rounded-2xl text-white font-bold text-[15px] flex items-center justify-center transition-all"
                >
                  {isSubmitting ? 'Finalizing...' : 'Enter Ledger Chat'}
                </button>
              </motion.div>
            )}

          </AnimatePresence>
        </motion.div>
      </div>
    </div>
  );
}
