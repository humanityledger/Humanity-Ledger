'use client';

import React, { useEffect, useState, useRef, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { toast } from 'sonner';

// ─── Session clearance ────────────────────────────────────────────────────────
const CLEARANCE_KEY       = '__enclave_clearance_v2__';
const CLEARANCE_TOKEN_KEY = 'ledger_enclave_clearance';
const CLEARANCE_TS_KEY    = 'ledger_enclave_ts';
const CLEARANCE_FP_KEY    = '__enclave_fp__';
const CLEARANCE_TTL_MS    = 8 * 60 * 60 * 1000;

function deriveFingerprint(token: string, ts: number): string {
  const combined = `${token}:${ts}:ledger_enclave`;
  let hash = 0;
  for (let i = 0; i < combined.length; i++) {
    hash = ((hash << 5) - hash + combined.charCodeAt(i)) | 0;
  }
  return Math.abs(hash).toString(36);
}

function readClearance(): boolean {
  try {
    if (sessionStorage.getItem(CLEARANCE_KEY) !== 'granted') return false;
    const ts = parseInt(sessionStorage.getItem(CLEARANCE_TS_KEY) || '0', 10);
    if (Date.now() - ts > CLEARANCE_TTL_MS) {
      [CLEARANCE_KEY, CLEARANCE_TOKEN_KEY, CLEARANCE_TS_KEY, CLEARANCE_FP_KEY]
        .forEach(k => sessionStorage.removeItem(k));
      return false;
    }
    const token    = sessionStorage.getItem(CLEARANCE_TOKEN_KEY) || '';
    const storedFp = sessionStorage.getItem(CLEARANCE_FP_KEY) || '';
    if (!token || storedFp !== deriveFingerprint(token, ts)) {
      [CLEARANCE_KEY, CLEARANCE_TOKEN_KEY, CLEARANCE_TS_KEY, CLEARANCE_FP_KEY]
        .forEach(k => sessionStorage.removeItem(k));
      return false;
    }
    return true;
  } catch { return false; }
}

function writeClearance(token: string, ts: number) {
  try {
    sessionStorage.setItem(CLEARANCE_KEY,       'granted');
    sessionStorage.setItem(CLEARANCE_TOKEN_KEY,  token);
    sessionStorage.setItem(CLEARANCE_TS_KEY,     ts.toString());
    sessionStorage.setItem(CLEARANCE_FP_KEY,     deriveFingerprint(token, ts));
  } catch {}
}

// ─── Animated dots loader ─────────────────────────────────────────────────────
function VerifyingPulse() {
  return (
    <div className="flex items-center justify-center gap-1.5">
      {[0, 1, 2].map(i => (
        <motion.div
          key={i}
          className="w-2 h-2 rounded-full bg-[#25D366]"
          animate={{ scale: [1, 1.6, 1], opacity: [0.4, 1, 0.4] }}
          transition={{ duration: 1.2, repeat: Infinity, delay: i * 0.2, ease: 'easeInOut' }}
        />
      ))}
    </div>
  );
}

// ─── Ring progress ────────────────────────────────────────────────────────────
function RingProgress({ progress }: { progress: number }) {
  const r  = 28;
  const c  = 2 * Math.PI * r;
  const offset = c - (progress / 100) * c;
  return (
    <svg width="72" height="72" viewBox="0 0 72 72" className="absolute inset-0">
      <circle cx="36" cy="36" r={r} fill="none" stroke="#F2F2F7" strokeWidth="3" />
      <motion.circle
        cx="36" cy="36" r={r}
        fill="none"
        stroke="#25D366"
        strokeWidth="3"
        strokeLinecap="round"
        strokeDasharray={c}
        strokeDashoffset={offset}
        style={{ transformOrigin: '36px 36px', rotate: '-90deg' }}
        transition={{ duration: 0.4, ease: 'linear' }}
      />
    </svg>
  );
}

// ─── 6-Digit PIN input ────────────────────────────────────────────────────────
function PinInput({
  value, onChange, onComplete, disabled, error, label,
}: {
  value: string;
  onChange: (v: string) => void;
  onComplete?: (v: string) => void;
  disabled?: boolean;
  error?: boolean;
  label?: string;
}) {
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (!disabled) {
      const t = setTimeout(() => inputRef.current?.focus(), 100);
      return () => clearTimeout(t);
    }
  }, [disabled]);

  return (
    <div className="w-full">
      {label && (
        <p className="text-[11px] font-semibold uppercase tracking-[0.12em] text-black/35 mb-3 text-center">
          {label}
        </p>
      )}
      <div
        className="relative w-full flex justify-center cursor-text"
        onClick={() => inputRef.current?.focus()}
      >
        <input
          ref={inputRef}
          type="tel"
          inputMode="numeric"
          pattern="[0-9]*"
          autoComplete="one-time-code"
          maxLength={6}
          value={value}
          disabled={disabled}
          onChange={e => {
            const val = e.target.value.replace(/\D/g, '').slice(0, 6);
            onChange(val);
            if (val.length === 6 && onComplete) onComplete(val);
          }}
          className="absolute inset-0 w-full h-full opacity-0 cursor-text z-20"
          aria-label="6-digit PIN"
        />
        <div className="flex gap-2.5 justify-center w-full relative z-10 pointer-events-none">
          {Array.from({ length: 6 }).map((_, i) => {
            const filled   = i < value.length;
            const isActive = value.length === i;
            return (
              <motion.div
                key={i}
                animate={filled ? { scale: [1.08, 1] } : { scale: 1 }}
                transition={{ duration: 0.15 }}
                className={`relative flex items-center justify-center rounded-[14px] border-[1.5px] transition-all duration-150
                  ${error
                    ? 'bg-red-50 border-red-400'
                    : filled
                    ? 'bg-[#1C1C1E] border-[#1C1C1E]'
                    : isActive
                    ? 'bg-white border-[#25D366] shadow-[0_0_0_3px_rgba(37,211,102,0.15)]'
                    : 'bg-[#F2F2F7] border-transparent'
                  }
                `}
                style={{ width: 48, height: 56 }}
              >
                {filled && (
                  <motion.div
                    initial={{ scale: 0 }}
                    animate={{ scale: 1 }}
                    className={`w-2.5 h-2.5 rounded-full ${error ? 'bg-red-400' : 'bg-white'}`}
                  />
                )}
                {isActive && !filled && (
                  <motion.div
                    animate={{ opacity: [1, 0, 1] }}
                    transition={{ duration: 1, repeat: Infinity }}
                    className="w-[2px] h-5 bg-[#25D366] rounded-full"
                  />
                )}
              </motion.div>
            );
          })}
        </div>
      </div>
    </div>
  );
}

// ─── Info card for first-time setup ──────────────────────────────────────────
function InfoCard({ icon, title, body }: { icon: React.ReactNode; title: string; body: string }) {
  return (
    <div className="flex items-start gap-3 text-left">
      <div className="w-8 h-8 rounded-xl bg-[#25D366]/10 flex items-center justify-center shrink-0 mt-0.5">
        {icon}
      </div>
      <div>
        <p className="text-[13px] font-bold text-[#1C1C1E] mb-0.5">{title}</p>
        <p className="text-[12px] text-black/45 leading-relaxed">{body}</p>
      </div>
    </div>
  );
}

// ─── Main component ────────────────────────────────────────────────────────────
export function TuringShieldGate({
  children,
  onVerified,
}: {
  children: React.ReactNode;
  onVerified?: (enclaveId: string) => void;
}) {
  const [mounted,            setMounted]            = useState(false);
  const [cleared,            setCleared]            = useState(false);

  // Verify flow
  const [pin,                setPin]                = useState('');
  const [pinError,           setPinError]           = useState<string | null>(null);
  const [verifying,          setVerifying]          = useState(false);
  const [verifyProgress,     setVerifyProgress]     = useState(0);
  const [shake,              setShake]              = useState(false);
  const [attemptsRemaining,  setAttemptsRemaining]  = useState<number | null>(null);
  const [locked,             setLocked]             = useState(false);
  const [lockoutExpiresAt,   setLockoutExpiresAt]   = useState<number | null>(null);
  const [lockoutCountdown,   setLockoutCountdown]   = useState(0);

  // Set-PIN flow
  const [isFirstTime,        setIsFirstTime]        = useState(false);
  const [settingPin,         setSettingPin]         = useState(false);
  const [setupStep,          setSetupStep]          = useState<0 | 1 | 2 | 3>(0); // 0=intro, 1=new, 2=confirm, 3=success
  const [newPin,             setNewPin]             = useState('');
  const [confirmPin,         setConfirmPin]         = useState('');
  const [pinSetError,        setPinSetError]        = useState<string | null>(null);
  const [savingPin,          setSavingPin]          = useState(false);
  const [tempClearanceToken, setTempClearanceToken] = useState<string | null>(null);
  const [tempClearanceTs,    setTempClearanceTs]    = useState<number | null>(null);

  // Reset flow
  const [resetFlowState,    setResetFlowState]    = useState<'idle' | 'requesting' | 'awaiting_otp' | 'verifying_otp'>('idle');
  const [resetEmail,        setResetEmail]        = useState<string | null>(null);
  const [resetOtp,          setResetOtp]          = useState('');
  const [resetOtpError,     setResetOtpError]     = useState<string | null>(null);
  const [resetAttemptsLeft, setResetAttemptsLeft] = useState<number | null>(null);
  const [confirmReset,      setConfirmReset]      = useState(false);
  const [resetting,         setResetting]         = useState(false);
  const [showHelp,          setShowHelp]          = useState(false);

  // Verify animation progress
  useEffect(() => {
    if (!verifying) { setVerifyProgress(0); return; }
    let p = 0;
    const id = setInterval(() => {
      p += Math.random() * 18 + 4;
      if (p > 88) p = 88; // stall at 88% until server responds
      setVerifyProgress(Math.min(88, p));
    }, 120);
    return () => clearInterval(id);
  }, [verifying]);

  // Lockout countdown
  useEffect(() => {
    if (!lockoutExpiresAt) return;
    const id = setInterval(() => {
      const remaining = Math.max(0, Math.ceil((lockoutExpiresAt - Date.now()) / 1000));
      setLockoutCountdown(remaining);
      if (remaining === 0) {
        setLocked(false);
        setLockoutExpiresAt(null);
        setAttemptsRemaining(null);
        setPinError(null);
        setPin('');
      }
    }, 1000);
    return () => clearInterval(id);
  }, [lockoutExpiresAt]);

  // Mount + clearance check
  useEffect(() => {
    setMounted(true);
    if (readClearance()) { setCleared(true); return; }
    fetch('/api/auth/enclave-pin', { credentials: 'include' })
      .then(r => r.json())
      .then(data => {
        if (data?.hasPin === false) {
          if (data.clearanceToken && data.clearanceTs) {
            setTempClearanceToken(data.clearanceToken);
            setTempClearanceTs(data.clearanceTs);
          }
          setIsFirstTime(true);
          setSettingPin(true);
          setSetupStep(0); // show intro first
        }
      })
      .catch(() => {});
  }, []);

  const triggerShake = useCallback(() => {
    setShake(true);
    setTimeout(() => setShake(false), 500);
  }, []);

  // ─── Verify PIN ─────────────────────────────────────────────────────────────
  const handleSubmit = useCallback(async (code: string) => {
    if (code.length !== 6 || verifying || locked) return;
    setVerifying(true);
    setPinError(null);

    try {
      const res  = await fetch('/api/auth/enclave-pin', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ pin: code }),
        credentials: 'include',
      });
      const data = await res.json();

      if (res.status === 429) {
        setVerifyProgress(100);
        setTimeout(() => {
          setLocked(true);
          setLockoutExpiresAt(Date.now() + 15 * 60 * 1000);
          setLockoutCountdown(15 * 60);
          setPinError(data.error || 'Too many attempts. Please wait 15 minutes.');
          setPin('');
          triggerShake();
          setVerifying(false);
        }, 300);
        return;
      }

      if (!res.ok || !data.success) {
        setVerifyProgress(0);
        const remaining = data.attemptsRemaining ?? null;
        setAttemptsRemaining(remaining);
        if (remaining === 0) {
          setLocked(true);
          setLockoutExpiresAt(Date.now() + 15 * 60 * 1000);
          setLockoutCountdown(15 * 60);
          setPinError('Too many failed attempts. Access temporarily suspended.');
        } else if (data.error?.includes('expired')) {
          window.location.href = '/connect';
          return;
        } else {
          setPinError(
            remaining !== null
              ? `Incorrect PIN — ${remaining} attempt${remaining !== 1 ? 's' : ''} remaining`
              : 'Incorrect PIN.'
          );
        }
        setPin('');
        triggerShake();
        setVerifying(false);
        return;
      }

      // Success
      setVerifyProgress(100);
      await new Promise(r => setTimeout(r, 400));
      writeClearance(data.clearanceToken, data.clearanceTs);
      setVerifying(false);

      if (data.isFirstTimeUser) {
        setTempClearanceToken(data.clearanceToken);
        setTempClearanceTs(data.clearanceTs);
        setIsFirstTime(true);
        setSettingPin(true);
        setSetupStep(0);
        setCleared(true);
        if (onVerified) onVerified(data.clearanceToken);
      } else {
        setCleared(true);
        if (onVerified) onVerified(data.clearanceToken);
      }
    } catch {
      setVerifyProgress(0);
      setPinError('Connection error. Please check your network and try again.');
      triggerShake();
      setVerifying(false);
    }
  }, [verifying, locked, onVerified, triggerShake]);

  // ─── Set new PIN ──────────────────────────────────────────────────────────────
  const handleSetPin = useCallback(async (val?: string | React.MouseEvent) => {
    const stringVal = typeof val === 'string' ? val : undefined;
    const code = setupStep === 1 ? (stringVal ?? newPin) : newPin;
    const conf = setupStep === 2 ? (stringVal ?? confirmPin) : confirmPin;

    if (code.length !== 6) { setPinSetError('Enter all 6 digits.'); return; }

    if (setupStep === 1) {
      setSetupStep(2);
      setConfirmPin('');
      setPinSetError(null);
      return;
    }

    if (code !== conf) {
      setPinSetError('PINs do not match. Please start over.');
      setSetupStep(1);
      setNewPin('');
      setConfirmPin('');
      return;
    }

    setSavingPin(true);
    setPinSetError(null);
    try {
      const payload: any = { newPin: code };
      if (tempClearanceToken && tempClearanceTs) {
        payload.clearanceToken = tempClearanceToken;
        payload.clearanceTs    = tempClearanceTs;
      }
      const res  = await fetch('/api/auth/enclave-pin', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
        credentials: 'include',
      });
      const data = await res.json();
      if (res.ok) {
        if (data.clearanceToken && data.clearanceTs) {
          writeClearance(data.clearanceToken, data.clearanceTs);
          setCleared(true);
          if (onVerified) onVerified(data.clearanceToken);
        }
        setSetupStep(3);
      } else {
        if (data.error?.includes('expired')) { window.location.href = '/connect'; return; }
        setPinSetError(data.error || 'Could not save PIN. Please try again.');
        setSetupStep(1);
        setNewPin('');
        setConfirmPin('');
      }
    } catch {
      setPinSetError('Network error. Please try again.');
    } finally {
      setSavingPin(false);
    }
  }, [newPin, confirmPin, setupStep, onVerified, tempClearanceToken, tempClearanceTs]);

  // ─── Reset OTP ────────────────────────────────────────────────────────────────
  const handleRequestOtp = async () => {
    setResetFlowState('requesting');
    setResetOtpError(null);
    try {
      const res  = await fetch('/api/auth/enclave-pin-reset', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'request' }),
      });
      const data = await res.json();
      if (!res.ok) {
        if (data.error === 'no_email') { setResetFlowState('idle'); setConfirmReset(true); return; }
        throw new Error(data.error || 'Failed to send code');
      }
      setResetEmail(data.maskedEmail);
      setResetFlowState('awaiting_otp');
      setResetOtp('');
    } catch (err: any) {
      setResetFlowState('idle');
      setPinError(err.message);
      triggerShake();
    }
  };

  const handleVerifyOtp = async (code: string) => {
    if (code.length !== 6) return;
    setResetFlowState('verifying_otp');
    setResetOtpError(null);
    try {
      const res  = await fetch('/api/auth/enclave-pin-reset', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'verify', otp: code }),
      });
      const data = await res.json();
      if (!res.ok) {
        setResetAttemptsLeft(data.remaining ?? null);
        if (data.expired || data.invalidated) { setResetFlowState('idle'); setPinError(data.error); }
        else { setResetFlowState('awaiting_otp'); setResetOtpError(data.error || 'Invalid code'); setResetOtp(''); }
        triggerShake();
        return;
      }
      setTempClearanceToken(data.clearanceToken || null);
      setTempClearanceTs(data.clearanceTs || null);
      setResetFlowState('idle');
      setConfirmReset(false);
      setSettingPin(true);
      setIsFirstTime(false);
      setSetupStep(1);
      setNewPin('');
      setConfirmPin('');
      toast.success('Identity confirmed. Choose a new PIN.');
    } catch (err: any) {
      setResetFlowState('awaiting_otp');
      setResetOtpError(err.message);
      triggerShake();
    }
  };

  if (!mounted) return null;

  // ─── FIRST-TIME SETUP OVERLAY ─────────────────────────────────────────────────
  if (settingPin) {
    const stepProgress = setupStep === 0 ? 0 : setupStep === 1 ? 33 : setupStep === 2 ? 66 : 100;

    return (
      <>
        {cleared && children}

        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          className="fixed inset-0 z-[9999] bg-black/60 backdrop-blur-md flex items-center justify-center p-4 overflow-y-auto"
        >
          <motion.div
            initial={{ scale: 0.92, opacity: 0, y: 24 }}
            animate={{ scale: 1, opacity: 1, y: 0 }}
            transition={{ type: 'spring', stiffness: 260, damping: 24 }}
            className="w-full max-w-[400px] bg-white rounded-[32px] overflow-hidden shadow-2xl my-auto"
          >
            {/* Progress bar */}
            {setupStep < 3 && (
              <div className="h-1 bg-black/[0.05] w-full">
                <motion.div
                  className="h-full bg-[#25D366] rounded-full"
                  animate={{ width: `${stepProgress}%` }}
                  transition={{ duration: 0.5, ease: [0.22, 1, 0.36, 1] }}
                />
              </div>
            )}

            <div className="p-8">
              <AnimatePresence mode="wait">

                {/* STEP 0: Introduction */}
                {setupStep === 0 && (
                  <motion.div
                    key="step-intro"
                    initial={{ opacity: 0, x: 20 }}
                    animate={{ opacity: 1, x: 0 }}
                    exit={{ opacity: 0, x: -20 }}
                    transition={{ duration: 0.3 }}
                    className="flex flex-col items-center"
                  >
                    {/* Icon */}
                    <div className="relative w-20 h-20 mb-6">
                      <div className="absolute inset-0 bg-[#25D366]/10 rounded-full" />
                      <div className="absolute inset-0 flex items-center justify-center">
                        <svg width="36" height="36" viewBox="0 0 24 24" fill="none" stroke="#25D366" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                          <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/>
                        </svg>
                      </div>
                      {/* Animated ring */}
                      <motion.div
                        className="absolute inset-0 rounded-full border-2 border-[#25D366]/30"
                        animate={{ scale: [1, 1.15, 1], opacity: [0.6, 0, 0.6] }}
                        transition={{ duration: 2.5, repeat: Infinity, ease: 'easeInOut' }}
                      />
                    </div>

                    <h2 className="text-[22px] font-black text-[#1C1C1E] tracking-tight mb-2 text-center">
                      Welcome to Ledger Chat
                    </h2>
                    <p className="text-[13px] text-black/50 text-center leading-relaxed mb-7 px-2">
                      Before you start, you need to set up your{' '}
                      <span className="font-bold text-[#1C1C1E]">access PIN</span> — a 6-digit code
                      that protects your account every time you open the app.
                    </p>

                    {/* What is the PIN */}
                    <div className="w-full bg-[#F9F9F9] rounded-2xl p-5 space-y-4 mb-6">
                      <InfoCard
                        icon={
                          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#25D366" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                            <rect x="3" y="11" width="18" height="11" rx="2"/><path d="M7 11V7a5 5 0 0 1 10 0v4"/>
                          </svg>
                        }
                        title="What is the PIN?"
                        body="It's your personal access code for Ledger Chat. Without it, no one can open your account — not even us."
                      />
                      <div className="h-px bg-black/[0.05]" />
                      <InfoCard
                        icon={
                          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#25D366" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                            <path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07A19.5 19.5 0 0 1 4.69 12 19.79 19.79 0 0 1 1.61 3.41 2 2 0 0 1 3.6 1.23h3a2 2 0 0 1 2 1.72c.127.96.361 1.903.7 2.81a2 2 0 0 1-.45 2.11L7.91 8.96a16 16 0 0 0 6 6l1.27-.95a2 2 0 0 1 2.11-.45c.907.339 1.85.573 2.81.7A2 2 0 0 1 22 16.92z"/>
                          </svg>
                        }
                        title="Forgot your PIN?"
                        body="You can reset it anytime using a 6-digit code sent to your email address. You'll never be permanently locked out."
                      />
                      <div className="h-px bg-black/[0.05]" />
                      <InfoCard
                        icon={
                          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#25D366" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                            <circle cx="12" cy="12" r="10"/><path d="M12 8v4l3 3"/>
                          </svg>
                        }
                        title="When do you enter it?"
                        body="Once per session. The PIN clears when you close the browser tab, so your account stays safe even on shared devices."
                      />
                    </div>

                    <button
                      onClick={() => setSetupStep(1)}
                      className="w-full h-[52px] bg-[#1C1C1E] hover:bg-black text-white rounded-2xl font-bold text-[15px] transition-colors active:scale-[0.98]"
                    >
                      Set up my PIN
                    </button>
                    {cleared && (
                      <button
                        onClick={() => setSettingPin(false)}
                        className="w-full py-3 text-[12px] text-black/35 hover:text-black/60 transition-colors mt-1"
                      >
                        Skip for now
                      </button>
                    )}
                  </motion.div>
                )}

                {/* STEP 1: Enter new PIN */}
                {setupStep === 1 && (
                  <motion.div
                    key="step-new"
                    initial={{ opacity: 0, x: 20 }}
                    animate={{ opacity: 1, x: 0 }}
                    exit={{ opacity: 0, x: -20 }}
                    transition={{ duration: 0.3 }}
                    className="flex flex-col items-center"
                  >
                    <div className="w-14 h-14 rounded-full bg-black/[0.04] flex items-center justify-center mb-5">
                      <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="#1C1C1E" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
                        <rect x="3" y="11" width="18" height="11" rx="2"/><path d="M7 11V7a5 5 0 0 1 10 0v4"/>
                      </svg>
                    </div>
                    <h2 className="text-[21px] font-black text-[#1C1C1E] tracking-tight mb-2 text-center">
                      Choose your PIN
                    </h2>
                    <p className="text-[13px] text-black/45 text-center leading-relaxed mb-7">
                      Pick a 6-digit code you'll remember. Avoid obvious sequences like 123456.
                    </p>

                    {pinSetError && (
                      <motion.p
                        initial={{ opacity: 0, y: -4 }}
                        animate={{ opacity: 1, y: 0 }}
                        className="text-red-500 text-[12px] font-semibold mb-4 text-center"
                      >
                        {pinSetError}
                      </motion.p>
                    )}

                    <PinInput
                      value={newPin}
                      onChange={v => { setNewPin(v); setPinSetError(null); }}
                      onComplete={v => { if (v.length === 6) handleSetPin(v); }}
                      disabled={savingPin}
                      error={!!pinSetError}
                    />

                    <button
                      onClick={() => handleSetPin()}
                      disabled={newPin.length < 6 || savingPin}
                      className="w-full h-[52px] bg-[#1C1C1E] hover:bg-black text-white rounded-2xl font-bold text-[15px] mt-6 transition-colors disabled:opacity-30 disabled:cursor-not-allowed active:scale-[0.98]"
                    >
                      Continue
                    </button>
                    <button
                      onClick={() => setSetupStep(0)}
                      className="w-full py-3 text-[12px] text-black/35 hover:text-black/60 transition-colors mt-1"
                    >
                      Back
                    </button>
                  </motion.div>
                )}

                {/* STEP 2: Confirm PIN */}
                {setupStep === 2 && (
                  <motion.div
                    key="step-confirm"
                    initial={{ opacity: 0, x: 20 }}
                    animate={{ opacity: 1, x: 0 }}
                    exit={{ opacity: 0, x: -20 }}
                    transition={{ duration: 0.3 }}
                    className="flex flex-col items-center"
                  >
                    <div className="w-14 h-14 rounded-full bg-[#25D366]/10 flex items-center justify-center mb-5">
                      <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="#25D366" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
                        <path d="M9 12l2 2 4-4"/><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/>
                      </svg>
                    </div>
                    <h2 className="text-[21px] font-black text-[#1C1C1E] tracking-tight mb-2 text-center">
                      Confirm your PIN
                    </h2>
                    <p className="text-[13px] text-black/45 text-center leading-relaxed mb-7">
                      Enter the same 6-digit code again to confirm.
                    </p>

                    {pinSetError && (
                      <motion.p
                        initial={{ opacity: 0, y: -4 }}
                        animate={{ opacity: 1, y: 0 }}
                        className="text-red-500 text-[12px] font-semibold mb-4 text-center"
                      >
                        {pinSetError}
                      </motion.p>
                    )}

                    <PinInput
                      value={confirmPin}
                      onChange={v => { setConfirmPin(v); setPinSetError(null); }}
                      onComplete={v => { if (v.length === 6) handleSetPin(v); }}
                      disabled={savingPin}
                      error={!!pinSetError}
                    />

                    <button
                      onClick={() => handleSetPin()}
                      disabled={(confirmPin.length < 6) || savingPin}
                      className="w-full h-[52px] bg-[#1C1C1E] hover:bg-black text-white rounded-2xl font-bold text-[15px] mt-6 transition-colors disabled:opacity-30 disabled:cursor-not-allowed flex items-center justify-center gap-2 active:scale-[0.98]"
                    >
                      {savingPin ? (
                        <>
                          <motion.div
                            className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full"
                            animate={{ rotate: 360 }}
                            transition={{ duration: 0.8, repeat: Infinity, ease: 'linear' }}
                          />
                          Saving...
                        </>
                      ) : 'Save PIN'}
                    </button>
                    <button
                      onClick={() => { setSetupStep(1); setConfirmPin(''); setPinSetError(null); }}
                      className="w-full py-3 text-[12px] text-black/35 hover:text-black/60 transition-colors mt-1"
                    >
                      Back
                    </button>
                  </motion.div>
                )}

                {/* STEP 3: Success */}
                {setupStep === 3 && (
                  <motion.div
                    key="step-success"
                    initial={{ opacity: 0, scale: 0.9 }}
                    animate={{ opacity: 1, scale: 1 }}
                    transition={{ type: 'spring', stiffness: 280, damping: 24 }}
                    className="flex flex-col items-center py-4"
                  >
                    <motion.div
                      initial={{ scale: 0 }}
                      animate={{ scale: 1 }}
                      transition={{ type: 'spring', stiffness: 300, damping: 22, delay: 0.1 }}
                      className="w-20 h-20 rounded-full bg-[#25D366] flex items-center justify-center mb-6 shadow-[0_8px_32px_rgba(37,211,102,0.35)]"
                    >
                      <svg width="34" height="34" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                        <polyline points="20 6 9 17 4 12"/>
                      </svg>
                    </motion.div>
                    <h2 className="text-[22px] font-black text-[#1C1C1E] tracking-tight mb-2 text-center">
                      PIN saved
                    </h2>
                    <p className="text-[13px] text-black/50 text-center leading-relaxed mb-3 px-2">
                      Your access PIN has been set. You'll enter it at the start of each session.
                    </p>

                    {/* Recovery reminder */}
                    <div className="w-full bg-[#FFF9E6] border border-[#F5C518]/30 rounded-2xl p-4 mb-7 text-left">
                      <p className="text-[12px] font-bold text-[#7A5C00] mb-1">Remember your PIN</p>
                      <p className="text-[11px] text-[#7A5C00]/80 leading-relaxed">
                        If you ever forget it, use the <span className="font-bold">"Forgot your PIN?"</span> link on the
                        login screen. A reset code will be sent to your email.
                      </p>
                    </div>

                    <button
                      onClick={() => setSettingPin(false)}
                      className="w-full h-[52px] bg-[#1C1C1E] hover:bg-black text-white rounded-2xl font-bold text-[15px] transition-colors active:scale-[0.98]"
                    >
                      Go to Ledger Chat
                    </button>
                  </motion.div>
                )}

              </AnimatePresence>
            </div>
          </motion.div>
        </motion.div>
      </>
    );
  }

  if (cleared) return <>{children}</>;

  // ─── MAIN PIN GATE ─────────────────────────────────────────────────────────────
  const isOtpFlow = resetFlowState === 'awaiting_otp' || resetFlowState === 'verifying_otp';

  return (
    <div
      className="fixed inset-0 z-[99999] overflow-y-auto flex flex-col items-center justify-center p-4"
      style={{ WebkitOverflowScrolling: 'touch', background: 'linear-gradient(160deg, #F9F9F9 0%, #F2F2F7 100%)' }}
    >
      {/* Subtle ambient accent */}
      <div className="absolute top-1/4 left-1/2 -translate-x-1/2 w-[600px] h-[300px] bg-[#25D366]/[0.04] blur-[100px] rounded-full pointer-events-none" />

      <AnimatePresence mode="wait">
        <motion.div
          key="pin-gate"
          initial={{ opacity: 0, y: 28 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -16 }}
          transition={{ duration: 0.4, ease: [0.22, 1, 0.36, 1] }}
          className="relative z-10 w-full max-w-[420px] my-auto"
        >

          {/* ── Header ── */}
          <div className="text-center mb-8">
            <div className="inline-flex items-center justify-center w-16 h-16 rounded-2xl bg-white border border-black/[0.06] shadow-[0_4px_20px_rgba(0,0,0,0.07)] mb-5">
              {locked ? (
                <svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="#EF4444" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
                  <rect x="3" y="11" width="18" height="11" rx="2"/><path d="M7 11V7a5 5 0 0 1 10 0v4"/>
                </svg>
              ) : (
                <svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="#1C1C1E" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
                  <rect x="3" y="11" width="18" height="11" rx="2"/><path d="M7 11V7a5 5 0 0 1 10 0v4"/>
                </svg>
              )}
            </div>
            <h1 className="text-[26px] font-black tracking-tight text-[#1C1C1E] leading-tight">
              {locked ? 'Access suspended' : 'Ledger Chat'}
            </h1>
            <p className="text-[13px] text-black/40 font-medium mt-1.5">
              {locked
                ? `Unlocks in ${Math.floor(lockoutCountdown / 60)}:${String(lockoutCountdown % 60).padStart(2, '0')}`
                : 'Enter your PIN to continue'}
            </p>
          </div>

          {/* ── Card ── */}
          <div className="bg-white rounded-[28px] border border-black/[0.07] shadow-[0_8px_40px_rgba(0,0,0,0.07)] overflow-hidden">

            {/* Verifying progress bar */}
            <AnimatePresence>
              {verifying && (
                <motion.div
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  exit={{ opacity: 0 }}
                  className="h-[3px] bg-black/[0.04] w-full"
                >
                  <motion.div
                    className="h-full bg-[#25D366] rounded-full"
                    animate={{ width: `${verifyProgress}%` }}
                    transition={{ duration: 0.3, ease: 'linear' }}
                  />
                </motion.div>
              )}
            </AnimatePresence>

            <div className="p-8">
              <AnimatePresence mode="wait">

                {/* Normal PIN entry */}
                {!locked && !isOtpFlow && !confirmReset && (
                  <motion.div
                    key="pin-normal"
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    exit={{ opacity: 0 }}
                    className="flex flex-col items-center"
                  >
                    <motion.div
                      animate={shake ? { x: [0, -10, 10, -10, 10, 0] } : { x: 0 }}
                      transition={{ duration: 0.4 }}
                      className="w-full"
                    >
                      <PinInput
                        value={pin}
                        onChange={v => { setPin(v); setPinError(null); }}
                        onComplete={handleSubmit}
                        disabled={verifying}
                        error={!!pinError}
                        label={verifying ? 'Verifying...' : 'Enter your PIN'}
                      />
                    </motion.div>

                    {/* Error */}
                    <AnimatePresence>
                      {pinError && (
                        <motion.div
                          initial={{ opacity: 0, y: -6 }}
                          animate={{ opacity: 1, y: 0 }}
                          exit={{ opacity: 0 }}
                          className="flex items-center gap-2 mb-4 mt-2"
                        >
                          <div className="w-4 h-4 rounded-full bg-red-100 flex items-center justify-center shrink-0">
                            <svg width="9" height="9" viewBox="0 0 24 24" fill="none" stroke="#EF4444" strokeWidth="3">
                              <path d="M18 6L6 18M6 6l12 12"/>
                            </svg>
                          </div>
                          <p className="text-red-500 text-[12px] font-semibold">{pinError}</p>
                        </motion.div>
                      )}
                    </AnimatePresence>

                    {attemptsRemaining !== null && attemptsRemaining <= 2 && !locked && (
                      <p className="text-orange-500 text-[11px] font-semibold mb-3 text-center">
                        {attemptsRemaining} attempt{attemptsRemaining !== 1 ? 's' : ''} remaining before temporary lockout
                      </p>
                    )}

                    {/* Verifying state */}
                    {verifying ? (
                      <div className="w-full h-[52px] flex items-center justify-center gap-3 mb-4">
                        <VerifyingPulse />
                        <span className="text-[13px] font-semibold text-black/40">Checking PIN...</span>
                      </div>
                    ) : (
                      <button
                        onClick={() => handleSubmit(pin)}
                        disabled={pin.length < 6}
                        className="w-full h-[52px] bg-[#1C1C1E] hover:bg-black text-white rounded-2xl font-bold text-[15px] transition-all active:scale-[0.97] disabled:opacity-25 disabled:cursor-not-allowed mb-4 mt-2"
                      >
                        Unlock
                      </button>
                    )}

                    {/* Help row */}
                    <div className="flex items-center justify-between w-full border-t border-black/[0.06] pt-4">
                      <button
                        onClick={handleRequestOtp}
                        disabled={resetFlowState === 'requesting'}
                        className="text-[12px] font-medium text-black/40 hover:text-[#1C1C1E] transition-colors disabled:opacity-50"
                      >
                        {resetFlowState === 'requesting' ? 'Sending...' : 'Forgot PIN?'}
                      </button>
                      <button
                        onClick={() => setShowHelp(v => !v)}
                        className="text-[12px] font-medium text-black/40 hover:text-[#1C1C1E] transition-colors flex items-center gap-1"
                      >
                        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                          <circle cx="12" cy="12" r="10"/><path d="M9.09 9a3 3 0 0 1 5.83 1c0 2-3 3-3 3"/><path d="M12 17h.01"/>
                        </svg>
                        What is this?
                      </button>
                    </div>

                    {/* Help panel */}
                    <AnimatePresence>
                      {showHelp && (
                        <motion.div
                          initial={{ height: 0, opacity: 0 }}
                          animate={{ height: 'auto', opacity: 1 }}
                          exit={{ height: 0, opacity: 0 }}
                          className="w-full overflow-hidden"
                        >
                          <div className="bg-[#F9F9F9] rounded-2xl p-4 mt-4 space-y-3">
                            <p className="text-[12px] font-bold text-[#1C1C1E]">About this PIN</p>
                            <p className="text-[11px] text-black/50 leading-relaxed">
                              Your Ledger Chat access PIN protects your messages and wallet connections.
                              It was set when you created your account. It resets each session (when you close the tab).
                            </p>
                            <div className="h-px bg-black/[0.06]" />
                            <p className="text-[12px] font-bold text-[#1C1C1E]">How to recover access</p>
                            <p className="text-[11px] text-black/50 leading-relaxed">
                              Tap <span className="font-bold text-[#1C1C1E]">"Forgot PIN?"</span> above.
                              We'll send a 6-digit code to your registered email. Enter it to reset your PIN immediately.
                              No waiting, no support ticket needed.
                            </p>
                          </div>
                        </motion.div>
                      )}
                    </AnimatePresence>
                  </motion.div>
                )}

                {/* Locked state */}
                {locked && !confirmReset && (
                  <motion.div
                    key="pin-locked"
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    exit={{ opacity: 0 }}
                    className="flex flex-col items-center py-2"
                  >
                    <div className="w-full bg-red-50 rounded-2xl p-5 mb-5 text-center">
                      <p className="text-[13px] font-bold text-red-600 mb-1">Access temporarily suspended</p>
                      <p className="text-[11px] text-red-500/80 leading-relaxed">
                        Too many incorrect PINs. For your protection, access is paused for 15 minutes.
                      </p>
                      {lockoutCountdown > 0 && (
                        <p className="text-[22px] font-black text-red-500 mt-3 font-mono">
                          {Math.floor(lockoutCountdown / 60)}:{String(lockoutCountdown % 60).padStart(2, '0')}
                        </p>
                      )}
                    </div>
                    {lockoutCountdown === 0 && (
                      <button
                        onClick={() => { setLocked(false); setPinError(null); setPin(''); }}
                        className="w-full h-[50px] bg-[#1C1C1E] text-white rounded-2xl font-bold text-[14px] hover:bg-black transition-colors mb-3"
                      >
                        Try again
                      </button>
                    )}
                    <button
                      onClick={handleRequestOtp}
                      disabled={resetFlowState === 'requesting'}
                      className="text-[12px] font-medium text-black/40 hover:text-[#1C1C1E] transition-colors"
                    >
                      Reset PIN via email
                    </button>
                  </motion.div>
                )}

                {/* OTP reset flow */}
                {isOtpFlow && (
                  <motion.div
                    key="pin-otp"
                    initial={{ opacity: 0, x: 10 }}
                    animate={{ opacity: 1, x: 0 }}
                    exit={{ opacity: 0, x: -10 }}
                    className="flex flex-col items-center"
                  >
                    <div className="w-12 h-12 rounded-full bg-[#1C1C1E]/[0.05] flex items-center justify-center mb-4">
                      <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#1C1C1E" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
                        <path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z"/><polyline points="22,6 12,13 2,6"/>
                      </svg>
                    </div>
                    <h3 className="text-[19px] font-black text-[#1C1C1E] mb-2 text-center">Check your email</h3>
                    <p className="text-[12px] text-black/45 text-center leading-relaxed mb-6">
                      We sent a 6-digit code to{' '}
                      <span className="font-bold text-[#1C1C1E]">{resetEmail}</span>.
                      Enter it below. Expires in 10 minutes.
                    </p>

                    <PinInput
                      value={resetOtp}
                      onChange={v => { setResetOtp(v); setResetOtpError(null); }}
                      onComplete={handleVerifyOtp}
                      disabled={resetFlowState === 'verifying_otp'}
                      error={!!resetOtpError}
                      label="Verification code"
                    />

                    {resetOtpError && (
                      <p className="text-red-500 text-[12px] font-semibold mt-3 text-center">
                        {resetOtpError}
                        {resetAttemptsLeft !== null && resetAttemptsLeft > 0 && (
                          <span className="text-orange-500 ml-1">({resetAttemptsLeft} left)</span>
                        )}
                      </p>
                    )}

                    <div className="flex gap-2.5 w-full mt-5">
                      <button
                        onClick={() => { setResetFlowState('idle'); setResetOtp(''); setResetOtpError(null); }}
                        disabled={resetFlowState === 'verifying_otp'}
                        className="flex-1 h-[48px] border border-black/10 rounded-2xl text-[13px] font-semibold text-[#1C1C1E] hover:bg-black/[0.03] transition-colors disabled:opacity-50"
                      >
                        Cancel
                      </button>
                      <button
                        onClick={() => handleVerifyOtp(resetOtp)}
                        disabled={resetOtp.length < 6 || resetFlowState === 'verifying_otp'}
                        className="flex-1 h-[48px] bg-[#1C1C1E] text-white rounded-2xl text-[13px] font-semibold hover:bg-black transition-colors disabled:opacity-30 flex items-center justify-center gap-2"
                      >
                        {resetFlowState === 'verifying_otp' ? (
                          <>
                            <motion.div
                              className="w-3.5 h-3.5 border-2 border-white/30 border-t-white rounded-full"
                              animate={{ rotate: 360 }}
                              transition={{ duration: 0.8, repeat: Infinity, ease: 'linear' }}
                            />
                            Checking...
                          </>
                        ) : 'Verify'}
                      </button>
                    </div>
                    <button
                      onClick={handleRequestOtp}
                      disabled={resetFlowState === 'verifying_otp'}
                      className="w-full text-center text-[11px] text-black/35 hover:text-black/60 transition-colors mt-4 disabled:opacity-40"
                    >
                      Send a new code
                    </button>
                  </motion.div>
                )}

                {/* Wallet-only fallback reset */}
                {confirmReset && (
                  <motion.div
                    key="pin-walletreset"
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    exit={{ opacity: 0 }}
                    className="flex flex-col items-center"
                  >
                    <div className="w-full bg-[#FFF4F4] border border-red-100 rounded-2xl p-5 mb-5 text-left">
                      <p className="text-[13px] font-black text-red-700 mb-2">No email linked</p>
                      <p className="text-[12px] text-red-600/80 leading-relaxed">
                        This account has no email address. To reset your PIN, you need to re-connect
                        your wallet. This verifies ownership and clears the PIN so you can set a new one.
                      </p>
                    </div>
                    <div className="flex gap-2.5 w-full">
                      <button
                        onClick={() => setConfirmReset(false)}
                        disabled={resetting}
                        className="flex-1 h-[48px] border border-black/10 rounded-2xl text-[13px] font-semibold text-[#1C1C1E] hover:bg-black/[0.03] transition-colors"
                      >
                        Cancel
                      </button>
                      <button
                        onClick={async () => {
                          setResetting(true);
                          try {
                            await fetch('/api/auth/enclave-pin', { method: 'DELETE' });
                            await fetch('/api/auth/logout', { method: 'POST' });
                            sessionStorage.clear();
                            window.location.href = '/connect';
                          } catch { setResetting(false); setConfirmReset(false); }
                        }}
                        disabled={resetting}
                        className="flex-1 h-[48px] bg-red-600 text-white rounded-2xl text-[13px] font-semibold hover:bg-red-700 transition-colors disabled:opacity-50"
                      >
                        {resetting ? 'Please wait...' : 'Log out & reconnect'}
                      </button>
                    </div>
                  </motion.div>
                )}

              </AnimatePresence>
            </div>
          </div>

          {/* Footer */}
          <p className="text-center text-[11px] text-black/25 mt-5 font-medium">
            Humanity Ledger · End-to-end encrypted
          </p>
        </motion.div>
      </AnimatePresence>
    </div>
  );
}
