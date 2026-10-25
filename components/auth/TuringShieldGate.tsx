'use client';

import React, { useEffect, useState, useRef, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { toast } from 'sonner';
import { Check, CircleHelp, Clock, Lock, Mail, X } from 'lucide-react';

// ─── Session clearance ────────────────────────────────────────────────────────
// DUAL STORAGE: sessionStorage (primary) + localStorage (fallback)
// sessionStorage is wiped on iOS tab close / background / hard reload.
// localStorage persists across reloads — critical for mobile users who get
// redirected mid-flow and lose sessionStorage, causing an infinite PIN loop.
const CLEARANCE_KEY       = '__enclave_clearance_v2__';
const CLEARANCE_TOKEN_KEY = 'ledger_enclave_clearance';
const CLEARANCE_TS_KEY    = 'ledger_enclave_ts';
const CLEARANCE_FP_KEY    = '__enclave_fp__';
const CLEARANCE_TTL_MS    = 8 * 60 * 60 * 1000; // 8 hours

function deriveFingerprint(token: string, ts: number): string {
  const combined = `${token}:${ts}:ledger_enclave`;
  let hash = 0;
  for (let i = 0; i < combined.length; i++) {
    hash = ((hash << 5) - hash + combined.charCodeAt(i)) | 0;
  }
  return Math.abs(hash).toString(36);
}

function _clearAll(store: Storage) {
  [CLEARANCE_KEY, CLEARANCE_TOKEN_KEY, CLEARANCE_TS_KEY, CLEARANCE_FP_KEY]
    .forEach(k => { try { store.removeItem(k); } catch {} });
}

function _readFrom(store: Storage): boolean {
  try {
    if (store.getItem(CLEARANCE_KEY) !== 'granted') return false;
    const ts = parseInt(store.getItem(CLEARANCE_TS_KEY) || '0', 10);
    if (!ts || Date.now() - ts > CLEARANCE_TTL_MS) { _clearAll(store); return false; }
    const token    = store.getItem(CLEARANCE_TOKEN_KEY) || '';
    const storedFp = store.getItem(CLEARANCE_FP_KEY) || '';
    if (!token || storedFp !== deriveFingerprint(token, ts)) { _clearAll(store); return false; }
    return true;
  } catch { return false; }
}

function readClearance(): boolean {
  // Check sessionStorage first (fastest), fall back to localStorage (survives reloads)
  try {
    if (_readFrom(sessionStorage)) return true;
    // Restore sessionStorage from localStorage if localStorage has valid clearance
    if (_readFrom(localStorage)) {
      try {
        // Re-populate sessionStorage from localStorage so subsequent reads are fast
        (['__enclave_clearance_v2__','ledger_enclave_clearance','ledger_enclave_ts','__enclave_fp__'] as const)
          .forEach(k => sessionStorage.setItem(k, localStorage.getItem(k) || ''));
      } catch {}
      return true;
    }
    return false;
  } catch { return false; }
}

function writeClearance(token: string, ts: number) {
  const fp = deriveFingerprint(token, ts);
  const pairs: [string, string][] = [
    [CLEARANCE_KEY, 'granted'],
    [CLEARANCE_TOKEN_KEY, token],
    [CLEARANCE_TS_KEY, ts.toString()],
    [CLEARANCE_FP_KEY, fp],
  ];
  // Write to BOTH storages — dual write guarantees survival across reloads
  for (const store of [sessionStorage, localStorage] as Storage[]) {
    try { pairs.forEach(([k, v]) => store.setItem(k, v)); } catch {}
  }
}

function clearClearance() {
  for (const store of [sessionStorage, localStorage] as Storage[]) {
    try { _clearAll(store); } catch {}
  }
}

function getStoredWalletAddress(): string {
  if (typeof window === 'undefined') return '';
  try {
    return sessionStorage.getItem('system_wallet_addr') ||
           localStorage.getItem('system_wallet_addr') ||
           JSON.parse(localStorage.getItem('system_session_v2') || '{}').wallet || '';
  } catch {
    return '';
  }
}

// ─── Animated dots loader ─────────────────────────────────────────────────────
function VerifyingPulse() {
  return (
    <div className="flex items-center justify-center gap-1.5">
      {[0, 1, 2].map(i => (
        <motion.div
          key={i}
          className="w-2 h-2 rounded-full bg-[#15171c]"
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
      <circle cx="36" cy="36" r={r} fill="none" stroke="#f2f4f7" strokeWidth="3" />
      <motion.circle
        cx="36" cy="36" r={r}
        fill="none"
        stroke="#15171c"
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
        <p className="text-[12.5px] font-semibold tracking-[0.12em] text-black/35 mb-3 text-center">
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
                    ? 'bg-[#15171c] border-[#15171c]'
                    : isActive
                    ? 'bg-white border-[#15171c] shadow-[0_0_0_3px_rgba(21,23,28,0.08)]'
                    : 'bg-[#f2f4f7] border-transparent'
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
                    className="w-[2px] h-5 bg-[#15171c] rounded-full"
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
      <div className="w-8 h-8 rounded-xl bg-[#eff1f4] flex items-center justify-center shrink-0 mt-0.5">
        {icon}
      </div>
      <div>
        <p className="text-[13px] font-semibold text-[#15171c] mb-0.5">{title}</p>
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

  useEffect(() => {
    // Mount + clearance check
    // A-015: No longer sending x-wallet-address header — identity resolved server-side from session only
    setMounted(true);
    if (readClearance()) { setCleared(true); return; }
    fetch('/api/auth/enclave-pin', { 
      credentials: 'include',
    })
      .then(r => r.json().then(data => ({ status: r.status, data })))
      .then(({ status, data }) => {
        // No session — redirect to connect so user can authenticate
        if (status === 401 || data?.noSession) {
          const dest = typeof window !== 'undefined' ? window.location.pathname : '/chat';
          window.location.replace(`/connect?redirect=${encodeURIComponent(dest)}`);
          return;
        }
        if (data?.hasPin === false) {
          if (data.clearanceToken && data.clearanceTs) {
            setTempClearanceToken(data.clearanceToken);
            setTempClearanceTs(data.clearanceTs);
          }
          setIsFirstTime(true);
          setSettingPin(true);
          setSetupStep(0);
        }
        // hasPin === true → show main PIN gate (default state)
      })
      .catch(() => {
        // Network error — show gate, user will see the PIN input and retry
      });
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
      // A-015: No longer sending x-wallet-address header — identity from session cookie only
      const headers: Record<string, string> = { 'Content-Type': 'application/json' };

      const res = await fetch('/api/auth/enclave-pin', {
        method: 'POST',
        headers,
        body: JSON.stringify({ pin: code }),
        credentials: 'include',
      });
      const data = await res.json();

      if (res.status === 429) {
        setVerifyProgress(100);
        // Parse actual lockout duration from server error if available,
        // otherwise fall back to our known 5-minute window
        const minutesMatch = data.error?.match(/(\d+)\s*minute/);
        const lockoutMs = minutesMatch ? parseInt(minutesMatch[1]) * 60 * 1000 : 5 * 60 * 1000;
        const lockoutSecs = Math.floor(lockoutMs / 1000);
        setTimeout(() => {
          setLocked(true);
          setLockoutExpiresAt(Date.now() + lockoutMs);
          setLockoutCountdown(lockoutSecs);
          setPinError(data.error || 'Too many attempts. Please wait 5 minutes.');
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
          setLockoutExpiresAt(Date.now() + 5 * 60 * 1000);
          setLockoutCountdown(5 * 60);
          setPinError('Too many failed attempts. Please wait 5 minutes.');
        } else if (data.noSession || (res.status === 401 && (data.error?.includes('Session expired') || data.error?.includes('Please reconnect')))) {
          window.location.href = '/connect?redirect=/chat';
          return;
        } else {
          setPinError(
            remaining !== null
              ? `Wrong PIN. ${remaining} ${remaining !== 1 ? 'attempts' : 'attempt'} left.`
              : (data.error || 'Incorrect PIN.')
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
      // A-015: No longer sending x-wallet-address header — identity from session cookie only
      const headers: Record<string, string> = { 'Content-Type': 'application/json' };

      const res  = await fetch('/api/auth/enclave-pin', {
        method: 'PUT',
        headers,
        body: JSON.stringify(payload),
        credentials: 'include',
      });
      const data = await res.json();
      if (res.ok) {
        // Write clearance — use server token if returned, otherwise re-derive from temp
        const ct  = data.clearanceToken  || tempClearanceToken;
        const cts = data.clearanceTs     || tempClearanceTs;
        if (ct && cts) writeClearance(ct, cts);
        setCleared(true);
        if (onVerified) onVerified(ct || '');
        setSetupStep(3);
      } else {
        if (data.noSession || (res.status === 401 && (data.error?.includes('Session expired') || data.error?.includes('Please reconnect')))) {
          window.location.href = '/connect?redirect=/chat';
          return;
        }
        // Non-fatal error: let user retry but don't trap them
        setPinSetError(data.error || 'Could not save PIN. Please try again.');
        setSetupStep(1);
        setNewPin('');
        setConfirmPin('');
      }
    } catch {
      // Network error during PIN save: user already verified identity so let them in
      // They can set a PIN later. Don't trap them in the setup flow.
      if (tempClearanceToken && tempClearanceTs) {
        writeClearance(tempClearanceToken, tempClearanceTs);
      }
      setCleared(true);
      setSetupStep(3); // show success screen anyway
      if (onVerified) onVerified(tempClearanceToken || '');
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
                  className="h-full bg-[#15171c] rounded-full"
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
                    {/* Icon: clean lock mark, no shield */}
                    <div className="relative w-20 h-20 mb-6">
                      <div className="absolute inset-0 bg-[#eff1f4] rounded-full" />
                      <div className="absolute inset-0 flex items-center justify-center">
                        <Lock size={34} strokeWidth={1.7} className="text-[#15171c]" aria-hidden="true" />
                      </div>
                      <motion.div
                        className="absolute inset-0 rounded-full border-2 border-[#15171c]"
                        animate={{ scale: [1, 1.14, 1], opacity: [0.5, 0, 0.5] }}
                        transition={{ duration: 2.8, repeat: Infinity, ease: 'easeInOut' }}
                      />
                    </div>

                    <h2 className="text-[22px] font-semibold text-[#15171c] tracking-tight mb-2 text-center">
                      Welcome to Ledger Chat
                    </h2>
                    <p className="text-[13px] text-black/50 text-center leading-relaxed mb-7 px-2">
                      Before you start, set up your{' '}
                      <span className="font-semibold text-[#15171c]">access PIN</span>. A 6 digit code
                      that protects your account every time you open the app.
                    </p>

                    <div className="w-full bg-[#f7f8fa] rounded-2xl p-5 space-y-4 mb-6">
                      <InfoCard
                        icon={
                          <Lock size={16} strokeWidth={2} className="text-[#15171c]" aria-hidden="true" />
                        }
                        title="What is the PIN?"
                        body="Your personal access code for Ledger Chat. Without it no one can open your account, not even us."
                      />
                      <div className="h-px bg-black/[0.05]" />
                      <InfoCard
                        icon={
                          <Mail size={16} strokeWidth={2} className="text-[#15171c]" aria-hidden="true" />
                        }
                        title="Forgot your PIN?"
                        body="Reset it anytime with a 6 digit code sent to your email. You will never be permanently locked out."
                      />
                      <div className="h-px bg-black/[0.05]" />
                      <InfoCard
                        icon={
                          <Clock size={16} strokeWidth={2} className="text-[#15171c]" aria-hidden="true" />
                        }
                        title="When do you enter it?"
                        body="Once per session, valid for 8 hours. Your account stays secure because only you know the PIN."
                      />
                    </div>

                    <button
                      onClick={() => setSetupStep(1)}
                      className="w-full h-[52px] bg-[#15171c] hover:bg-black text-white rounded-2xl font-semibold text-[15px] transition-colors active:scale-[0.98]"
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
                      <Lock size={24} strokeWidth={1.8} className="text-[#15171c]" aria-hidden="true" />
                    </div>
                    <h2 className="text-[21px] font-semibold text-[#15171c] tracking-tight mb-2 text-center">
                      Choose your PIN
                    </h2>
                    <p className="text-[13px] text-black/45 text-center leading-relaxed mb-7">
                      Pick a 6 digit code you will remember. Avoid obvious sequences like 123456.
                    </p>

                    {pinSetError && (
                      <motion.p
                        initial={{ opacity: 0, y: -4 }}
                        animate={{ opacity: 1, y: 0 }}
                        className="text-[#d93036] text-[12px] font-semibold mb-4 text-center"
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
                      className="w-full h-[52px] bg-[#15171c] hover:bg-black text-white rounded-2xl font-semibold text-[15px] mt-6 transition-colors disabled:opacity-30 disabled:cursor-not-allowed active:scale-[0.98]"
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
                    <div className="w-14 h-14 rounded-full bg-[#eff1f4] flex items-center justify-center mb-5">
                      <Check size={24} strokeWidth={1.8} className="text-[#15171c]" aria-hidden="true" />
                    </div>
                    <h2 className="text-[21px] font-semibold text-[#15171c] tracking-tight mb-2 text-center">
                      Confirm your PIN
                    </h2>
                    <p className="text-[13px] text-black/45 text-center leading-relaxed mb-7">
                      Enter the same 6 digit code again to confirm.
                    </p>

                    {pinSetError && (
                      <motion.p
                        initial={{ opacity: 0, y: -4 }}
                        animate={{ opacity: 1, y: 0 }}
                        className="text-[#d93036] text-[12px] font-semibold mb-4 text-center"
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
                      className="w-full h-[52px] bg-[#15171c] hover:bg-black text-white rounded-2xl font-semibold text-[15px] mt-6 transition-colors disabled:opacity-30 disabled:cursor-not-allowed flex items-center justify-center gap-2 active:scale-[0.98]"
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
                      className="w-20 h-20 rounded-full bg-[#15171c] flex items-center justify-center mb-6 shadow-[0_8px_32px_rgba(37,211,102,0.35)]"
                    >
                      <Check size={34} strokeWidth={1.7} className="text-white" aria-hidden="true" />
                    </motion.div>
                    <h2 className="text-[22px] font-semibold text-[#15171c] tracking-tight mb-2 text-center">
                      PIN saved
                    </h2>
                    <p className="text-[13px] text-black/50 text-center leading-relaxed mb-3 px-2">
                      Your access PIN has been saved. You will enter it at the start of each session.
                    </p>

                    {/* Recovery reminder */}
                    <div className="w-full bg-[#FFF9E6] border border-[#F5C518]/30 rounded-2xl p-4 mb-7 text-left">
                      <p className="text-[12px] font-semibold text-[#7A5C00] mb-1">Remember your PIN</p>
                      <p className="text-[12.5px] text-[#7A5C00]/80 leading-relaxed">
                        If you ever forget it, tap <span className="font-semibold">"Forgot your PIN?"</span> on the
                        sign in screen. A reset code will be sent to your email.
                      </p>
                    </div>

                    <button
                      onClick={() => setSettingPin(false)}
                      className="w-full h-[52px] bg-[#15171c] hover:bg-black text-white rounded-2xl font-semibold text-[15px] transition-colors active:scale-[0.98]"
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
      style={{ WebkitOverflowScrolling: 'touch', background: 'linear-gradient(160deg, #f7f8fa 0%, #f2f4f7 100%)' }}
    >
      {/* Subtle ambient accent */}
      <div className="absolute top-1/4 left-1/2 -translate-x-1/2 w-[600px] h-[300px] bg-[#eff1f4] blur-[100px] rounded-full pointer-events-none" />

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
            <div className="inline-flex items-center justify-center w-16 h-16 rounded-2xl bg-white border border-black/[0.06] shadow-[0_4px_20px_rgba(0,0,0,0.07)] mb-5 p-2.5">
              {locked ? (
                <Lock size={26} strokeWidth={1.8} className="text-[#d93036]" aria-hidden="true" />
              ) : (
                <img src="/worldmap.png" alt="Humanity Ledger" className="w-full h-full object-contain" />
              )}
            </div>
            <h1 className="text-[26px] font-semibold tracking-tight text-[#15171c] leading-tight">
              {locked ? 'Too many attempts' : 'Ledger Chat'}
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
                    className="h-full bg-[#15171c] rounded-full"
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
                        label={verifying ? 'Checking' : 'Enter your PIN'}
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
                            <X size={9} strokeWidth={3} className="text-[#d93036]" aria-hidden="true" />
                          </div>
                          <p className="text-[#d93036] text-[12px] font-semibold">{pinError}</p>
                        </motion.div>
                      )}
                    </AnimatePresence>

                    {attemptsRemaining !== null && attemptsRemaining <= 2 && !locked && (
                      <p className="text-orange-500 text-[12.5px] font-semibold mb-3 text-center">
                        {attemptsRemaining} attempt{attemptsRemaining !== 1 ? 's' : ''} remaining before temporary lockout
                      </p>
                    )}

                    {/* Verifying state */}
                    {verifying ? (
                      <div className="w-full h-[52px] flex items-center justify-center gap-3 mb-4">
                        <VerifyingPulse />
                        <span className="text-[13px] font-medium text-black/45">Checking your PIN</span>
                      </div>
                    ) : (
                      <button
                        onClick={() => handleSubmit(pin)}
                        disabled={pin.length < 6}
                        className="w-full h-[52px] bg-[#15171c] hover:bg-black text-white rounded-2xl font-semibold text-[15px] transition-all active:scale-[0.97] disabled:opacity-25 disabled:cursor-not-allowed mb-4 mt-2"
                      >
                        Unlock
                      </button>
                    )}

                    {/* Help row */}
                    <div className="flex items-center justify-between w-full border-t border-black/[0.06] pt-4">
                      <button
                        onClick={handleRequestOtp}
                        disabled={resetFlowState === 'requesting'}
                        className="text-[12px] font-medium text-black/40 hover:text-[#15171c] transition-colors disabled:opacity-50"
                      >
                        {resetFlowState === 'requesting' ? 'Sending a code' : 'Forgot your PIN?'}
                      </button>
                      <button
                        onClick={() => setShowHelp(v => !v)}
                        className="text-[12px] font-medium text-black/40 hover:text-[#15171c] transition-colors flex items-center gap-1"
                      >
                        <CircleHelp size={12} strokeWidth={2.2} aria-hidden="true" />
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
                          <div className="bg-[#f7f8fa] rounded-2xl p-4 mt-4 space-y-3">
                            <p className="text-[12px] font-semibold text-[#15171c]">About this PIN</p>
                            <p className="text-[12.5px] text-black/50 leading-relaxed">
                              Your Ledger Chat PIN is a second lock on top of your wallet. You chose it the first
                              time you opened Ledger Chat. After you enter it, this device stays unlocked for up to 8 hours.
                            </p>
                            <div className="h-px bg-black/[0.06]" />
                            <p className="text-[12px] font-semibold text-[#15171c]">How to recover access</p>
                            <p className="text-[12.5px] text-black/50 leading-relaxed">
                              Tap <span className="font-semibold text-[#15171c]">"Forgot PIN?"</span> above.
                              We will send a 6 digit code to your registered email. Enter it to reset your PIN immediately.
                              No waiting, no support needed.
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
                      <p className="text-[13px] font-semibold text-red-600 mb-1">Access temporarily suspended</p>
                      <p className="text-[12.5px] text-[#d93036]/80 leading-relaxed">
                        Too many incorrect PINs. For your protection, access is paused for 15 minutes.
                      </p>
                      {lockoutCountdown > 0 && (
                        <p className="text-[22px] font-semibold text-[#d93036] mt-3 tabular-nums">
                          {Math.floor(lockoutCountdown / 60)}:{String(lockoutCountdown % 60).padStart(2, '0')}
                        </p>
                      )}
                    </div>
                    {lockoutCountdown === 0 && (
                      <button
                        onClick={() => { setLocked(false); setPinError(null); setPin(''); }}
                        className="w-full h-[50px] bg-[#15171c] text-white rounded-2xl font-semibold text-[14px] hover:bg-black transition-colors mb-3"
                      >
                        Try again
                      </button>
                    )}
                    <button
                      onClick={handleRequestOtp}
                      disabled={resetFlowState === 'requesting'}
                      className="text-[12px] font-medium text-black/40 hover:text-[#15171c] transition-colors"
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
                    <div className="w-12 h-12 rounded-full bg-[#15171c]/[0.05] flex items-center justify-center mb-4">
                      <Mail size={20} strokeWidth={1.8} className="text-[#15171c]" aria-hidden="true" />
                    </div>
                    <h3 className="text-[19px] font-semibold text-[#15171c] mb-2 text-center">Check your email</h3>
                    <p className="text-[12px] text-black/45 text-center leading-relaxed mb-6">
                      We sent a 6-digit code to{' '}
                      <span className="font-semibold text-[#15171c]">{resetEmail}</span>.
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
                      <p className="text-[#d93036] text-[12px] font-semibold mt-3 text-center">
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
                        className="flex-1 h-[48px] border border-black/10 rounded-2xl text-[13px] font-semibold text-[#15171c] hover:bg-black/[0.03] transition-colors disabled:opacity-50"
                      >
                        Cancel
                      </button>
                      <button
                        onClick={() => handleVerifyOtp(resetOtp)}
                        disabled={resetOtp.length < 6 || resetFlowState === 'verifying_otp'}
                        className="flex-1 h-[48px] bg-[#15171c] text-white rounded-2xl text-[13px] font-semibold hover:bg-black transition-colors disabled:opacity-30 flex items-center justify-center gap-2"
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
                      className="w-full text-center text-[12.5px] text-black/35 hover:text-black/60 transition-colors mt-4 disabled:opacity-40"
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
                      <p className="text-[13px] font-semibold text-red-700 mb-2">No email linked</p>
                      <p className="text-[12px] text-red-600/80 leading-relaxed">
                        This account has no email address. To reset your PIN, you need to re-connect
                        your wallet. This verifies ownership and clears the PIN so you can set a new one.
                      </p>
                    </div>
                    <div className="flex gap-2.5 w-full">
                      <button
                        onClick={() => setConfirmReset(false)}
                        disabled={resetting}
                        className="flex-1 h-[48px] border border-black/10 rounded-2xl text-[13px] font-semibold text-[#15171c] hover:bg-black/[0.03] transition-colors"
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
                        {resetting ? 'Signing out' : 'Sign out and reconnect'}
                      </button>
                    </div>
                  </motion.div>
                )}

              </AnimatePresence>
            </div>
          </div>

          {/* Footer */}
          <p className="text-center text-[12.5px] text-black/25 mt-5 font-medium">
            Humanity Ledger
          </p>
        </motion.div>
      </AnimatePresence>
    </div>
  );
}
