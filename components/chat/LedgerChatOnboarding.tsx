"use client";

import React, { useState, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Camera, ChevronRight, Check, MapPin, AtSign, User, Shield, Bell, Lock } from 'lucide-react';
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
        // Write the returned clearance token to sessionStorage so TuringShieldGate
        // recognises this session as already authenticated — prevents the PIN gate
        // appearing immediately after onboarding is completed.
        if (pinRes.ok) {
          const pinData = await pinRes.json().catch(() => ({}));
          if (pinData.clearanceToken && pinData.clearanceTs && typeof window !== 'undefined') {
            // Key names and fingerprint algorithm must match TuringShieldGate exactly.
            const token = pinData.clearanceToken as string;
            const ts = pinData.clearanceTs as number;
            // Replicate deriveFingerprint from TuringShieldGate:
            const combined = `${token}:${ts}:ledger_enclave`;
            let hash = 0;
            for (let i = 0; i < combined.length; i++) {
              hash = ((hash << 5) - hash + combined.charCodeAt(i)) | 0;
            }
            const fp = Math.abs(hash).toString(36);
            sessionStorage.setItem('__enclave_clearance_v2__', 'granted');
            sessionStorage.setItem('ledger_enclave_clearance', token);
            sessionStorage.setItem('ledger_enclave_ts', String(ts));
            sessionStorage.setItem('__enclave_fp__', fp);
          }
        }
      } catch {}
    }

    try {
      await fetch('/api/user/profile', {
        method: 'PUT',
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

  const renderProgressBar = () => (
    <div className="absolute top-0 left-0 w-full h-2 bg-[#f5f5f7]">
      <motion.div 
        className="h-full bg-[#1c7aff]"
        initial={{ width: 0 }}
        animate={{ width: `${(step / 5) * 100}%` }}
        transition={{ duration: 0.4 }}
      />
    </div>
  );

  return (
    <div className="fixed inset-0 z-[999999] bg-[#F6F7F9] overflow-y-auto font-sans">
      <div className="min-h-full flex flex-col items-center justify-center py-8 px-4 sm:px-6">
      <motion.div 
        initial={{ opacity: 0, y: 30 }}
        animate={{ opacity: 1, y: 0 }}
        className="w-full max-w-lg bg-white rounded-[32px] p-8 sm:p-10 shadow-2xl relative overflow-hidden"
      >
        {renderProgressBar()}

        <AnimatePresence mode="wait">
          {step === 1 && (
            <motion.div 
              key="step1"
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -20 }}
              className="flex flex-col items-center text-center"
            >
              <div className="w-20 h-20 bg-black text-white rounded-3xl flex items-center justify-center mb-6 shadow-xl">
                <Shield size={40} />
              </div>
              <h2 className="text-3xl font-black text-[#050505] mb-4 tracking-tight">Welcome to Ledger Chat</h2>
              <p className="text-[#050505]/70 text-[16px] leading-relaxed mb-8">
                The native Web3 social network. End-to-end encrypted, multi-party calls, and fully sovereign identity.
              </p>
              <button 
                onClick={handleNext}
                className="w-full py-4 bg-[#1c7aff] hover:bg-blue-600 rounded-2xl text-white font-black text-[16px] flex items-center justify-center gap-2 transition-all shadow-lg hover:shadow-xl hover:-translate-y-1"
              >
                Get Started <ChevronRight size={20} />
              </button>
            </motion.div>
          )}

          {step === 2 && (
            <motion.div 
              key="step2"
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -20 }}
              className="flex flex-col items-center"
            >
              <h2 className="text-2xl font-black text-[#050505] mb-1 text-center tracking-tight">Create your Identity</h2>
              <p className="text-[#050505]/50 text-[14px] font-medium text-center mb-5">
                Set up your profile to connect with others.
              </p>

              <div 
                className="w-24 h-24 rounded-full bg-[#f5f5f7] border-[3px] border-dashed border-black/10 flex items-center justify-center relative cursor-pointer hover:border-[#1c7aff] transition-colors mb-6 overflow-hidden shadow-sm"
                onClick={() => fileRef.current?.click()}
              >
                {avatar ? (
                  <img src={avatar} alt="Avatar" className="w-full h-full object-cover" />
                ) : (
                  <div className="flex flex-col items-center text-[#1c7aff]">
                    <Camera size={32} />
                    <span className="text-[12px] font-bold mt-2">Upload</span>
                  </div>
                )}
                <input type="file" ref={fileRef} accept="image/*" className="hidden" onChange={handleFileChange} />
              </div>

              <div className="w-full mb-4">
                <label className="block text-[13px] font-bold text-[#050505] mb-2">Full Name</label>
                <div className="relative">
                  <User size={18} className="absolute left-4 top-1/2 -translate-y-1/2 text-black/30" />
                  <input
                    type="text"
                    value={displayName}
                    onChange={(e) => setDisplayName(e.target.value)}
                    placeholder="Satoshi Nakamoto"
                    className="w-full bg-[#f5f5f7] border-2 border-transparent focus:border-[#1c7aff] focus:bg-white rounded-2xl py-4 pl-12 pr-4 text-[16px] font-bold text-black outline-none transition-all shadow-inner"
                  />
                </div>
              </div>

              <div className="w-full mb-6">
                <label className="block text-[13px] font-bold text-[#050505] mb-2">Nickname (e.g. @ledger)</label>
                <div className="relative">
                  <AtSign size={18} className="absolute left-4 top-1/2 -translate-y-1/2 text-black/30" />
                  <input
                    type="text"
                    value={username}
                    onChange={(e) => setUsername(e.target.value)}
                    placeholder="ledger"
                    className="w-full bg-[#f5f5f7] border-2 border-transparent focus:border-[#1c7aff] focus:bg-white rounded-2xl py-4 pl-12 pr-4 text-[16px] font-bold text-black outline-none transition-all shadow-inner"
                  />
                </div>
              </div>

              <button 
                onClick={handleNext}
                disabled={username.trim().length < 3}
                className="w-full py-4 bg-[#1c7aff] hover:bg-blue-600 disabled:opacity-50 disabled:hover:bg-[#1c7aff] rounded-2xl text-white font-black text-[16px] flex items-center justify-center gap-2 transition-all shadow-lg hover:shadow-xl hover:-translate-y-1"
              >
                Continue <ChevronRight size={20} />
              </button>
            </motion.div>
          )}

          {step === 3 && (
            <motion.div 
              key="step3"
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -20 }}
              className="flex flex-col items-center"
            >
              <h2 className="text-2xl font-black text-[#050505] mb-1 text-center tracking-tight">Location & Bio</h2>
              <p className="text-[#050505]/50 text-[14px] font-medium text-center mb-6">
                Let others know a bit more about you.
              </p>

              <div className="w-full mb-5">
                <label className="block text-[13px] font-bold text-[#050505] mb-2">Country / Region</label>
                <div className="relative">
                  <MapPin size={18} className="absolute left-4 top-1/2 -translate-y-1/2 text-black/30" />
                  <select 
                    value={country}
                    onChange={(e) => setCountry(e.target.value)}
                    className="w-full bg-[#f5f5f7] border-2 border-transparent focus:border-[#1c7aff] focus:bg-white rounded-2xl py-4 pl-12 pr-4 text-[16px] font-bold text-black outline-none transition-all appearance-none cursor-pointer shadow-inner"
                  >
                    {COUNTRIES.map(c => <option key={c} value={c}>{c}</option>)}
                  </select>
                </div>
              </div>

              <div className="w-full mb-8">
                <label className="block text-[13px] font-bold text-[#050505] mb-2">Short Bio</label>
                <textarea
                  value={bio}
                  onChange={(e) => setBio(e.target.value)}
                  placeholder="Exploring Web3..."
                  rows={3}
                  className="w-full bg-[#f5f5f7] border-2 border-transparent focus:border-[#1c7aff] focus:bg-white rounded-2xl p-4 text-[16px] font-medium text-black outline-none transition-all shadow-inner resize-none"
                />
              </div>

              <button 
                onClick={handleNext}
                className="w-full py-4 bg-[#1c7aff] hover:bg-blue-600 rounded-2xl text-white font-black text-[16px] flex items-center justify-center gap-2 transition-all shadow-lg hover:shadow-xl hover:-translate-y-1"
              >
                Continue <ChevronRight size={20} />
              </button>
            </motion.div>
          )}

          {step === 4 && (
             <motion.div 
               key="step4"
               initial={{ opacity: 0, x: 20 }}
               animate={{ opacity: 1, x: 0 }}
               exit={{ opacity: 0, x: -20 }}
               className="flex flex-col items-center"
             >
               <h2 className="text-2xl font-black text-[#050505] mb-2 text-center tracking-tight">Privacy & Security</h2>
               <p className="text-[#050505]/50 text-[14px] font-medium text-center mb-8">
                 Secure your vault and control who can see your activity.
               </p>
 
               <div className="w-full mb-6">
                 <label className="block text-[13px] font-bold text-[#050505] mb-2 flex items-center gap-2">
                   <Lock size={14} /> Vault PIN (6 digits)
                 </label>
                 <input
                   type="password"
                   value={pin}
                   onChange={(e) => setPin(e.target.value.replace(/[^0-9]/g, ''))}
                   placeholder="------"
                   maxLength={6}
                   className="w-full bg-[#f5f5f7] border-2 border-transparent focus:border-[#1c7aff] focus:bg-white rounded-2xl py-4 text-center text-3xl tracking-[0.5em] font-black text-black outline-none transition-all shadow-inner"
                 />
               </div>

               <div className="w-full mb-8">
                 <label className="block text-[13px] font-bold text-[#050505] mb-2">Who can see my online status?</label>
                 <select 
                   value={privacyLastSeen}
                   onChange={(e) => setPrivacyLastSeen(e.target.value as any)}
                   className="w-full bg-[#f5f5f7] border-2 border-transparent focus:border-[#1c7aff] focus:bg-white rounded-2xl py-4 px-4 text-[15px] font-semibold text-black outline-none transition-all appearance-none cursor-pointer"
                 >
                   <option value="everybody">Everybody</option>
                   <option value="contacts">My Contacts</option>
                   <option value="nobody">Nobody</option>
                 </select>
               </div>
 
               <button 
                 onClick={handleNext}
                 disabled={pin.length !== 6}
                 className="w-full py-4 bg-[#1c7aff] hover:bg-blue-600 disabled:opacity-50 disabled:hover:bg-[#1c7aff] rounded-2xl text-white font-black text-[16px] flex items-center justify-center gap-2 transition-all shadow-lg hover:shadow-xl hover:-translate-y-1"
               >
                 Continue <ChevronRight size={20} />
               </button>
             </motion.div>
          )}

          {step === 5 && (
            <motion.div 
              key="step5"
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              className="flex flex-col items-center text-center py-4"
            >
              <div className="w-24 h-24 rounded-full bg-[#30d158]/10 flex items-center justify-center mb-6">
                <div className="w-16 h-16 rounded-full bg-[#30d158] flex items-center justify-center shadow-[0_0_20px_#30d158]">
                  <Check size={32} className="text-white" />
                </div>
              </div>
              
              <h2 className="text-3xl font-black text-[#050505] mb-2 tracking-tight">All Set!</h2>
              <p className="text-[#050505]/60 text-[15px] mb-8 leading-relaxed">
                Your identity is secured. Welcome to the native Web3 social network.
              </p>

              <div className="w-full bg-[#f5f5f7] rounded-2xl p-4 flex items-center justify-between mb-8 text-left">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-full bg-white flex items-center justify-center shadow-sm">
                    <Bell size={18} className="text-[#050505]" />
                  </div>
                  <div>
                    <p className="text-[14px] font-bold text-black">Enable Notifications</p>
                    <p className="text-[12px] text-black/50">Get alerts for messages & calls</p>
                  </div>
                </div>
                <button 
                  onClick={() => setNotificationsEnabled(!notificationsEnabled)}
                  className={`w-12 h-6 rounded-full relative transition-colors ${notificationsEnabled ? 'bg-[#30d158]' : 'bg-black/20'}`}
                >
                  <div className={`w-5 h-5 rounded-full bg-white absolute top-0.5 transition-transform ${notificationsEnabled ? 'translate-x-6' : 'translate-x-0.5'}`} />
                </button>
              </div>

              <button 
                onClick={handleFinish}
                disabled={isSubmitting}
                className="w-full py-4 bg-[#F6F7F9] hover:bg-black/80 rounded-2xl text-white font-black text-[16px] flex items-center justify-center transition-all shadow-xl hover:shadow-2xl hover:-translate-y-1"
              >
                {isSubmitting ? 'Finalizing...' : 'Enter LedgerChat'}
              </button>
            </motion.div>
          )}
        </AnimatePresence>
      </motion.div>
      </div>
    </div>
  );
}

