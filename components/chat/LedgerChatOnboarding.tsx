'use client';

import React, { useState, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Camera, ChevronRight, Check, MapPin, AtSign, User, Shield, Bell, Lock, Fingerprint, Sparkles, Globe, Key } from 'lucide-react';
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
        if (ev.target?.result) {
          const img = new Image();
          img.onload = () => {
            const canvas = document.createElement('canvas');
            const MAX_SIZE = 256;
            let width = img.width;
            let height = img.height;

            if (width > height) {
              if (width > MAX_SIZE) {
                height *= MAX_SIZE / width;
                width = MAX_SIZE;
              }
            } else {
              if (height > MAX_SIZE) {
                width *= MAX_SIZE / height;
                height = MAX_SIZE;
              }
            }
            canvas.width = width;
            canvas.height = height;
            const ctx = canvas.getContext('2d');
            ctx?.drawImage(img, 0, 0, width, height);
            setAvatar(canvas.toDataURL('image/jpeg', 0.8));
          };
          img.src = ev.target.result as string;
        }
      };
      reader.readAsDataURL(file);
    }
  };

  const handleNext = () => {
    if (step === 1) {
      setStep(2);
    } else if (step === 2 && username.trim().length >= 3) {
      let finalUsername = username.trim();
      if (!finalUsername.startsWith('@')) finalUsername = '@' + finalUsername;
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
      await fetch('/api/user/register', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({
          walletAddress: address,
          displayName: displayName.trim(),
          chatName: finalUsername.replace('@', ''),
          bio: bio.trim() || `From ${country}`,
          avatarUrl: avatar || undefined,
        }),
      });
    } catch {}

    // Persist avatar so it shows immediately everywhere in the app
    if (typeof window !== 'undefined') {
      if (avatar) {
        try { localStorage.setItem('ledger_avatar', avatar); } catch {}
        // Notify the app that avatar changed
        window.dispatchEvent(new CustomEvent('ledger_settings_update', { detail: { avatarUrl: avatar } }));
      }
      localStorage.setItem(`ledger_onboarded_${address}`, 'true');
    }

    // Request notification permission if the user opted in
    if (notificationsEnabled && typeof window !== 'undefined' && 'Notification' in window) {
      try { await Notification.requestPermission(); } catch {}
    }

    setIsSubmitting(false);
    onComplete();
  };

  const totalSteps = 5;

  const fadeVariants = {
    initial: { opacity: 0, filter: 'blur(10px)', y: 20 },
    animate: { opacity: 1, filter: 'blur(0px)', y: 0, transition: { duration: 0.5, ease: [0.16, 1, 0.3, 1] } },
    exit: { opacity: 0, filter: 'blur(10px)', y: -20, transition: { duration: 0.3, ease: [0.7, 0, 0.84, 0] } }
  };

  return (
    <div className="fixed inset-0 z-[999999] bg-[#FAFAFA] text-[#1C1C1E] overflow-y-auto font-sans flex flex-col selection:bg-[#25D366]/20">
      <div className="flex-1 w-full max-w-2xl mx-auto flex flex-col relative px-6 py-12 md:px-12 md:py-20 justify-center">
        
        {/* Progress Bar */}
        <div className="absolute top-8 left-6 right-6 md:left-12 md:right-12 flex items-center justify-between gap-3">
          {Array.from({ length: totalSteps }).map((_, i) => (
            <div key={i} className="flex-1 h-1 bg-black/5 rounded-full overflow-hidden">
              <motion.div
                initial={false}
                animate={{ width: i + 1 <= step ? '100%' : '0%' }}
                transition={{ duration: 0.5, ease: "easeInOut" }}
                className={`h-full ${i + 1 === step ? 'bg-[#25D366]' : 'bg-black/80'}`}
              />
            </div>
          ))}
        </div>

        <div className="relative w-full h-full flex items-center justify-center min-h-[500px]">
          <AnimatePresence mode="wait">
            
            {/* STEP 1 — Welcome */}
            {step === 1 && (
              <motion.div
                key="step1"
                variants={fadeVariants}
                initial="initial"
                animate="animate"
                exit="exit"
                className="w-full flex flex-col items-center text-center"
              >
                <motion.div 
                  initial={{ scale: 0.8, rotate: -10 }} 
                  animate={{ scale: 1, rotate: 0 }} 
                  transition={{ type: 'spring', damping: 20, stiffness: 200 }}
                  className="w-24 h-24 bg-gradient-to-tr from-black to-gray-800 rounded-3xl flex items-center justify-center mb-8 shadow-2xl shadow-black/10"
                >
                  <Shield size={40} className="text-[#25D366]" />
                </motion.div>
                
                <h1 className="text-4xl md:text-5xl font-black mb-4 tracking-tighter bg-clip-text text-transparent bg-gradient-to-br from-black to-gray-600">
                  Welcome to Ledger
                </h1>
                <p className="text-[16px] text-black/60 font-medium leading-relaxed mb-12 max-w-md mx-auto">
                  A sovereign identity in a truly private network. End-to-end encrypted messaging powered by zero-knowledge architecture.
                </p>
                
                <button
                  onClick={handleNext}
                  className="w-full max-w-sm py-4 bg-black hover:bg-black/90 active:scale-95 rounded-2xl text-white font-bold text-[16px] flex items-center justify-center gap-2 transition-all shadow-xl shadow-black/10 group"
                >
                  Begin Setup 
                  <ChevronRight size={20} className="group-hover:translate-x-1 transition-transform" />
                </button>
              </motion.div>
            )}

            {/* STEP 2 — Identity */}
            {step === 2 && (
              <motion.div
                key="step2"
                variants={fadeVariants}
                initial="initial"
                animate="animate"
                exit="exit"
                className="w-full max-w-sm mx-auto flex flex-col"
              >
                <div className="mb-8 text-center">
                  <div className="inline-flex items-center justify-center p-3 bg-[#25D366]/10 rounded-2xl mb-4 text-[#25D366]">
                    <User size={24} />
                  </div>
                  <h2 className="text-3xl font-black tracking-tight mb-2">Your Identity</h2>
                  <p className="text-[15px] text-black/50 font-medium">How should the network recognize you?</p>
                </div>

                <div className="flex flex-col items-center mb-8">
                  <div
                    className="w-24 h-24 rounded-full bg-black/5 border-2 border-dashed border-black/20 flex flex-col items-center justify-center relative cursor-pointer hover:border-[#25D366] hover:bg-[#25D366]/5 transition-all overflow-hidden group"
                    onClick={() => fileRef.current?.click()}
                  >
                    {avatar ? (
                      <img src={avatar} alt="Avatar" className="w-full h-full object-cover" />
                    ) : (
                      <>
                        <Camera size={28} className="text-black/30 group-hover:text-[#25D366] transition-colors mb-1" />
                        <span className="text-[11px] font-bold text-black/40 group-hover:text-[#25D366]">Upload</span>
                      </>
                    )}
                    <input type="file" ref={fileRef} accept="image/*" className="hidden" onChange={handleFileChange} />
                  </div>
                </div>

                <div className="space-y-4 mb-8">
                  <div>
                    <label className="block text-[12px] font-bold text-black/40 mb-1.5 uppercase tracking-wider pl-1">Display Name</label>
                    <input
                      type="text"
                      value={displayName}
                      onChange={(e) => setDisplayName(e.target.value)}
                      placeholder="Satoshi Nakamoto"
                      className="w-full bg-white border border-black/10 focus:border-[#25D366] focus:ring-4 focus:ring-[#25D366]/10 rounded-xl py-3.5 px-4 text-[16px] font-medium text-black outline-none transition-all placeholder:text-black/25 shadow-sm"
                    />
                  </div>
                  <div>
                    <label className="block text-[12px] font-bold text-black/40 mb-1.5 uppercase tracking-wider pl-1">Username</label>
                    <div className="relative">
                      <AtSign size={18} className="absolute left-4 top-1/2 -translate-y-1/2 text-black/30" />
                      <input
                        type="text"
                        value={username}
                        onChange={(e) => setUsername(e.target.value)}
                        placeholder="satoshi"
                        className="w-full bg-white border border-black/10 focus:border-[#25D366] focus:ring-4 focus:ring-[#25D366]/10 rounded-xl py-3.5 pl-11 pr-4 text-[16px] font-medium text-black outline-none transition-all placeholder:text-black/25 shadow-sm"
                      />
                    </div>
                  </div>
                </div>

                <button
                  onClick={handleNext}
                  disabled={username.trim().length < 3}
                  className="w-full py-4 bg-[#25D366] hover:bg-[#20bd5a] disabled:bg-black/10 disabled:text-black/40 active:scale-95 rounded-2xl text-white font-bold text-[16px] flex items-center justify-center gap-2 transition-all shadow-lg shadow-[#25D366]/20 disabled:shadow-none"
                >
                  Continue <ChevronRight size={20} />
                </button>
              </motion.div>
            )}

            {/* STEP 3 — Location & Bio */}
            {step === 3 && (
              <motion.div
                key="step3"
                variants={fadeVariants}
                initial="initial"
                animate="animate"
                exit="exit"
                className="w-full max-w-sm mx-auto flex flex-col"
              >
                <div className="mb-8 text-center">
                  <div className="inline-flex items-center justify-center p-3 bg-[#25D366]/10 rounded-2xl mb-4 text-[#25D366]">
                    <Globe size={24} />
                  </div>
                  <h2 className="text-3xl font-black tracking-tight mb-2">About You</h2>
                  <p className="text-[15px] text-black/50 font-medium">Add some context to your profile.</p>
                </div>

                <div className="space-y-6 mb-8">
                  <div>
                    <label className="block text-[12px] font-bold text-black/40 mb-1.5 uppercase tracking-wider pl-1">Region</label>
                    <div className="relative">
                      <MapPin size={18} className="absolute left-4 top-1/2 -translate-y-1/2 text-black/30" />
                      <select
                        value={country}
                        onChange={(e) => setCountry(e.target.value)}
                        className="w-full bg-white border border-black/10 focus:border-[#25D366] focus:ring-4 focus:ring-[#25D366]/10 rounded-xl py-3.5 pl-11 pr-10 text-[16px] font-medium text-black outline-none transition-all appearance-none cursor-pointer shadow-sm"
                      >
                        {COUNTRIES.map(c => <option key={c} value={c}>{c}</option>)}
                      </select>
                      <ChevronRight size={16} className="absolute right-4 top-1/2 -translate-y-1/2 text-black/30 rotate-90 pointer-events-none" />
                    </div>
                  </div>

                  <div>
                    <label className="block text-[12px] font-bold text-black/40 mb-1.5 uppercase tracking-wider pl-1">Bio</label>
                    <textarea
                      value={bio}
                      onChange={(e) => setBio(e.target.value)}
                      placeholder="Building the future of finance..."
                      rows={4}
                      className="w-full bg-white border border-black/10 focus:border-[#25D366] focus:ring-4 focus:ring-[#25D366]/10 rounded-xl p-4 text-[16px] font-medium text-black outline-none transition-all resize-none placeholder:text-black/25 shadow-sm"
                    />
                  </div>
                </div>

                <button
                  onClick={handleNext}
                  className="w-full py-4 bg-black hover:bg-black/90 active:scale-95 rounded-2xl text-white font-bold text-[16px] flex items-center justify-center gap-2 transition-all shadow-xl shadow-black/10"
                >
                  Continue <ChevronRight size={20} />
                </button>
              </motion.div>
            )}

            {/* STEP 4 — Security Enclave */}
            {step === 4 && (
              <motion.div
                key="step4"
                variants={fadeVariants}
                initial="initial"
                animate="animate"
                exit="exit"
                className="w-full max-w-sm mx-auto flex flex-col"
              >
                <div className="mb-8 text-center">
                  <div className="inline-flex items-center justify-center p-3 bg-[#25D366]/10 rounded-2xl mb-4 text-[#25D366]">
                    <Key size={24} />
                  </div>
                  <h2 className="text-3xl font-black tracking-tight mb-2">Vault Security</h2>
                  <p className="text-[15px] text-black/50 font-medium">Protect your keys with an enclave PIN.</p>
                </div>

                <div className="bg-white border border-black/5 rounded-3xl p-6 shadow-sm mb-8">
                  <label className="block text-center text-[12px] font-bold text-black/40 mb-6 uppercase tracking-wider">
                    Create 6-Digit PIN
                  </label>
                  
                  <div className="flex justify-center gap-3 mb-6 relative">
                    {Array.from({ length: 6 }).map((_, i) => (
                      <div
                        key={i}
                        className={`w-12 h-14 rounded-xl flex items-center justify-center text-2xl font-black transition-all ${
                          pin.length > i ? 'bg-[#25D366] text-white shadow-lg shadow-[#25D366]/30 scale-105' : 'bg-black/5 text-transparent'
                        }`}
                      >
                        {pin.length > i ? '•' : ''}
                      </div>
                    ))}
                    <input
                      type="password"
                      inputMode="numeric"
                      value={pin}
                      onChange={(e) => setPin(e.target.value.replace(/[^0-9]/g, ''))}
                      maxLength={6}
                      className="absolute inset-0 w-full h-full opacity-0 cursor-text z-10"
                      autoFocus
                    />
                  </div>
                  
                  <p className="text-center text-[13px] text-black/40 font-medium">
                    This PIN locks your local encrypted database.
                  </p>
                </div>

                <div className="space-y-4 mb-8">
                  <div>
                    <label className="block text-[12px] font-bold text-black/40 mb-1.5 uppercase tracking-wider pl-1">Last Seen Privacy</label>
                    <div className="relative">
                      <select
                        value={privacyLastSeen}
                        onChange={(e) => setPrivacyLastSeen(e.target.value as any)}
                        className="w-full bg-white border border-black/10 focus:border-[#25D366] focus:ring-4 focus:ring-[#25D366]/10 rounded-xl py-3.5 pl-4 pr-10 text-[16px] font-medium text-black outline-none transition-all appearance-none cursor-pointer shadow-sm"
                      >
                        <option value="everybody">Visible to Everybody</option>
                        <option value="contacts">My Contacts Only</option>
                        <option value="nobody">Nobody</option>
                      </select>
                      <ChevronRight size={16} className="absolute right-4 top-1/2 -translate-y-1/2 text-black/30 rotate-90 pointer-events-none" />
                    </div>
                  </div>
                </div>

                <button
                  onClick={handleNext}
                  disabled={pin.length !== 6}
                  className="w-full py-4 bg-[#25D366] hover:bg-[#128C7E] disabled:bg-black/10 disabled:text-black/40 active:scale-95 rounded-2xl text-white font-bold text-[16px] flex items-center justify-center gap-2 transition-all shadow-lg shadow-[#25D366]/30 disabled:shadow-none"
                >
                  Secure Account <ChevronRight size={20} />
                </button>
              </motion.div>
            )}

            {/* STEP 5 — Done */}
            {step === 5 && (
              <motion.div
                key="step5"
                variants={fadeVariants}
                initial="initial"
                animate="animate"
                exit="exit"
                className="w-full max-w-sm mx-auto flex flex-col items-center text-center"
              >
                <motion.div
                  initial={{ scale: 0, rotate: -45 }}
                  animate={{ scale: 1, rotate: 0 }}
                  transition={{ type: 'spring', damping: 15, stiffness: 200, delay: 0.1 }}
                  className="w-24 h-24 rounded-full bg-gradient-to-tr from-[#25D366] to-[#20bd5a] flex items-center justify-center mb-6 shadow-2xl shadow-[#25D366]/30"
                >
                  <Check size={40} className="text-white" strokeWidth={3} />
                </motion.div>

                <h2 className="text-4xl font-black text-black mb-3 tracking-tighter">You're in.</h2>
                <p className="text-[16px] text-black/50 font-medium leading-relaxed mb-10">
                  Your encrypted identity is secured and ready for the sovereign network.
                </p>

                <div className="w-full bg-white border border-black/10 rounded-2xl p-5 flex items-center justify-between mb-10 shadow-sm">
                  <div className="flex items-center gap-4">
                    <div className="w-10 h-10 rounded-full bg-black/5 flex items-center justify-center">
                      <Bell size={18} className="text-black/60" />
                    </div>
                    <div className="text-left">
                      <p className="text-[15px] font-bold text-black leading-tight">Enable Notifications</p>
                      <p className="text-[13px] text-black/50 mt-0.5">Alerts for messages & calls</p>
                    </div>
                  </div>
                  <button
                    onClick={() => setNotificationsEnabled(!notificationsEnabled)}
                    className={`w-14 h-8 rounded-full relative transition-colors duration-300 ${notificationsEnabled ? 'bg-[#25D366]' : 'bg-black/15'}`}
                  >
                    <div className={`w-6 h-6 rounded-full bg-white absolute top-1 transition-transform duration-300 shadow-sm ${notificationsEnabled ? 'translate-x-7' : 'translate-x-1'}`} />
                  </button>
                </div>

                <button
                  onClick={handleFinish}
                  disabled={isSubmitting}
                  className="w-full py-4 bg-black hover:bg-black/90 disabled:opacity-50 active:scale-95 rounded-2xl text-white font-bold text-[16px] flex items-center justify-center gap-2 transition-all shadow-xl shadow-black/10"
                >
                  {isSubmitting ? (
                    <motion.div animate={{ rotate: 360 }} transition={{ repeat: Infinity, duration: 1, ease: "linear" }}>
                      <Sparkles size={20} />
                    </motion.div>
                  ) : (
                    'Enter Ledger Chat'
                  )}
                </button>
              </motion.div>
            )}

          </AnimatePresence>
        </div>
      </div>
    </div>
  );
}


