'use client';

import React, { useEffect, useState, useRef, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { toast } from 'sonner';

// ─── Session clearance ────────────────────────────────────────────────────────
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

function readClearance(): boolean {
  try {
    if (sessionStorage.getItem(CLEARANCE_KEY) !== 'granted') return false;
    const ts = parseInt(sessionStorage.getItem(CLEARANCE_TS_KEY) || '0', 10);
    if (Date.now() - ts > CLEARANCE_TTL_MS) {
      ['', CLEARANCE_TOKEN_KEY, CLEARANCE_TS_KEY, CLEARANCE_FP_KEY].forEach(k =>
        sessionStorage.removeItem(k || CLEARANCE_KEY)
      );
      return false;
    }
    const token     = sessionStorage.getItem(CLEARANCE_TOKEN_KEY) || '';
    const storedFp  = sessionStorage.getItem(CLEARANCE_FP_KEY) || '';
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

// ─── 6-Digit PIN input ────────────────────────────────────────────────────────
function PinInput({
  value, onChange, onComplete, disabled, error,
}: {
  value: string;
  onChange: (v: string) => void;
  onComplete?: (v: string) => void;
  disabled?: boolean;
  error?: boolean;
}) {
  const inputRef = useRef<HTMLInputElement>(null);

  // Auto-focus on mount and whenever disabled clears
  useEffect(() => {
    if (!disabled) {
      const t = setTimeout(() => inputRef.current?.focus(), 80);
      return () => clearTimeout(t);
    }
  }, [disabled]);

  return (
    <div
      className="relative w-full flex justify-center mb-4 cursor-text"
      onClick={() => inputRef.current?.focus()}
    >
      {/* Hidden real input — captures keyboard on all devices */}
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
      />
      {/* Visual digit boxes */}
      <div className="flex gap-2 justify-center w-full relative z-10 pointer-events-none">
        {Array.from({ length: 6 }).map((_, i) => {
          const digit    = value[i];
          const isActive = value.length === i || (value.length === 6 && i === 5);
          return (
            <div
              key={i}
              className={`flex items-center justify-center text-[20px] font-black rounded-xl border-2 transition-all duration-150
                ${error
                  ? 'bg-red-50 border-red-400 text-red-600'
                  : digit
                  ? 'bg-[#25D366]/8 border-[#25D366] text-[#1C1C1E]'
                  : isActive
                  ? 'bg-white border-[#25D366] ring-2 ring-[#25D366]/20'
                  : 'bg-[#F2F2F7] border-black/10 text-[#1C1C1E]'
                }
              `}
              style={{ width: 48, height: 56 }}
            >
              {digit ? '•' : ''}
            </div>
          );
        })}
      </div>
    </div>
  );
}

// ─── Main gate ─────────────────────────────────────────────────────────────────
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
  const [shake,              setShake]              = useState(false);
  const [attemptsRemaining,  setAttemptsRemaining]  = useState<number | null>(null);
  const [locked,             setLocked]             = useState(false);
  const [lockoutExpiresAt,   setLockoutExpiresAt]   = useState<number | null>(null);
  const [lockoutCountdown,   setLockoutCountdown]   = useState(0);

  // Set-PIN flow
  const [isFirstTime,        setIsFirstTime]        = useState(false);
  const [settingPin,         setSettingPin]          = useState(false);
  const [newPin,             setNewPin]             = useState('');
  const [confirmPin,         setConfirmPin]         = useState('');
  const [pinSetStep,         setPinSetStep]         = useState<'new' | 'confirm'>('new');
  const [pinSetError,        setPinSetError]        = useState<string | null>(null);
  const [pinSetSuccess,      setPinSetSuccess]      = useState(false);
  const [savingPin,          setSavingPin]          = useState(false);
  const [tempClearanceToken, setTempClearanceToken] = useState<string | null>(null);
  const [tempClearanceTs,    setTempClearanceTs]    = useState<number | null>(null);

  // Reset flow
  const [resetFlowState,   setResetFlowState]   = useState<'idle' | 'requesting' | 'awaiting_otp' | 'verifying_otp'>('idle');
  const [resetEmail,       setResetEmail]       = useState<string | null>(null);
  const [resetOtp,         setResetOtp]         = useState('');
  const [resetOtpError,    setResetOtpError]    = useState<string | null>(null);
  const [resetAttemptsLeft,setResetAttemptsLeft]= useState<number | null>(null);
  const [confirmReset,     setConfirmReset]     = useState(false);
  const [resetting,        setResetting]        = useState(false);

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

  // Mount + check existing clearance
  useEffect(() => {
    setMounted(true);
    if (readClearance()) {
      setCleared(true);
      return;
    }
    // Check if user has ever set a PIN
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
        setLocked(true);
        setLockoutExpiresAt(Date.now() + 15 * 60 * 1000);
        setLockoutCountdown(15 * 60);
        setPinError(data.error || 'Too many attempts. Please wait 15 minutes.');
        setPin('');
        triggerShake();
        setVerifying(false);
        return;
      }

      if (!res.ok || !data.success) {
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
              ? `Incorrect PIN. ${remaining} attempt${remaining !== 1 ? 's' : ''} remaining.`
              : 'Incorrect PIN.'
          );
        }
        setPin('');
        triggerShake();
        setVerifying(false);
        return;
      }

      // Success
      writeClearance(data.clearanceToken, data.clearanceTs);
      setVerifying(false);

      if (data.isFirstTimeUser) {
        // Show set-PIN overlay BEFORE marking cleared, so children aren't rendered yet
        setTempClearanceToken(data.clearanceToken);
        setTempClearanceTs(data.clearanceTs);
        setIsFirstTime(true);
        setSettingPin(true);
        // Mark cleared so child renders behind overlay
        setCleared(true);
        if (onVerified) onVerified(data.clearanceToken);
      } else {
        setCleared(true);
        if (onVerified) onVerified(data.clearanceToken);
      }

    } catch {
      setPinError('Connection error. Please check your network and try again.');
      triggerShake();
      setVerifying(false);
    }
  }, [verifying, locked, onVerified, triggerShake]);

  // ─── Set new PIN ─────────────────────────────────────────────────────────────
  const handleSetPin = useCallback(async (val?: string | React.MouseEvent) => {
    const stringVal = typeof val === 'string' ? val : undefined;
    const code = pinSetStep === 'new'
      ? (stringVal ?? newPin)
      : newPin;
    const conf = pinSetStep === 'confirm'
      ? (stringVal ?? confirmPin)
      : confirmPin;

    if (code.length !== 6) { setPinSetError('Enter a 6-digit PIN.'); return; }

    if (pinSetStep === 'new') {
      setPinSetStep('confirm');
      setConfirmPin('');
      setPinSetError(null);
      return;
    }

    if (code !== conf) {
      setPinSetError('PINs do not match. Please start over.');
      setPinSetStep('new');
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
        setPinSetSuccess(true);
      } else {
        if (data.error?.includes('expired')) { window.location.href = '/connect'; return; }
        setPinSetError(data.error || 'Could not save PIN. Please try again.');
        setPinSetStep('new');
        setNewPin('');
        setConfirmPin('');
      }
    } catch {
      setPinSetError('Network error. Please try again.');
    } finally {
      setSavingPin(false);
    }
  }, [newPin, confirmPin, pinSetStep, onVerified, tempClearanceToken, tempClearanceTs]);

  // ─── Reset OTP request ───────────────────────────────────────────────────────
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
        if (data.error === 'no_email') {
          setResetFlowState('idle');
          setConfirmReset(true);
          return;
        }
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

  // ─── Verify OTP ──────────────────────────────────────────────────────────────
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
        if (data.expired || data.invalidated) {
          setResetFlowState('idle');
          setPinError(data.error);
        } else {
          setResetFlowState('awaiting_otp');
          setResetOtpError(data.error || 'Invalid code');
          setResetOtp('');
        }
        triggerShake();
        return;
      }
      setTempClearanceToken(data.clearanceToken || null);
      setTempClearanceTs(data.clearanceTs || null);
      setResetFlowState('idle');
      setConfirmReset(false);
      setSettingPin(true);
      setIsFirstTime(false);
      setPinSetStep('new');
      setNewPin('');
      setConfirmPin('');
      toast.success('Identity verified. Please set a new PIN.');
    } catch (err: any) {
      setResetFlowState('awaiting_otp');
      setResetOtpError(err.message);
      triggerShake();
    }
  };

  if (!mounted) return null;

  // ─── Set-PIN overlay ─────────────────────────────────────────────────────────
  if (settingPin) {
    return (
      <>
        {cleared && children}
        <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/50 p-4">
          <motion.div
            initial={{ scale: 0.93, opacity: 0, y: 16 }}
            animate={{ scale: 1, opacity: 1, y: 0 }}
            className="w-full max-w-[360px] bg-white rounded-[24px] p-7 shadow-2xl flex flex-col items-center text-center"
          >
            {pinSetSuccess ? (
              <>
                <div className="w-12 h-12 rounded-full bg-[#25D366]/10 flex items-center justify-center mb-4">
                  <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="#25D366" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                    <polyline points="20 6 9 17 4 12"/>
                  </svg>
                </div>
                <h2 className="text-[19px] font-black tracking-tight text-[#1C1C1E] mb-2">PIN saved</h2>
                <p className="text-[13px] text-black/50 mb-6 leading-relaxed">
                  Your access code has been saved. You will use it each time you open Ledger Chat.
                </p>
                <button
                  onClick={() => setSettingPin(false)}
                  className="w-full py-3 bg-[#1C1C1E] text-white rounded-2xl font-bold text-[14px] hover:bg-black transition-colors"
                >
                  Continue
                </button>
              </>
            ) : (
              <>
                <div className="w-12 h-12 rounded-full bg-black/5 flex items-center justify-center mb-4">
                  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-[#1C1C1E]">
                    <rect x="3" y="11" width="18" height="11" rx="2"/><path d="M7 11V7a5 5 0 0 1 10 0v4"/>
                  </svg>
                </div>
                <h2 className="text-[19px] font-black tracking-tight text-[#1C1C1E] mb-2">
                  {pinSetStep === 'confirm' ? 'Confirm your PIN' : 'Create your PIN'}
                </h2>
                <p className="text-[12px] text-black/45 mb-5 leading-relaxed px-2">
                  {isFirstTime
                    ? 'Choose a 6-digit code you will remember. You will enter it each session.'
                    : pinSetStep === 'confirm'
                    ? 'Enter the same 6-digit code again to confirm.'
                    : 'Enter a new 6-digit code for your account.'}
                </p>

                {pinSetError && (
                  <p className="text-red-500 text-[12px] font-semibold mb-3">{pinSetError}</p>
                )}

                <PinInput
                  value={pinSetStep === 'new' ? newPin : confirmPin}
                  onChange={v => {
                    pinSetStep === 'new' ? setNewPin(v) : setConfirmPin(v);
                    setPinSetError(null);
                  }}
                  onComplete={v => { if (v.length === 6) handleSetPin(v); }}
                  disabled={savingPin}
                  error={!!pinSetError}
                />

                <button
                  onClick={() => handleSetPin()}
                  disabled={(pinSetStep === 'new' ? newPin : confirmPin).length < 6 || savingPin}
                  className="w-full py-3 bg-[#1C1C1E] hover:bg-black text-white rounded-2xl font-bold text-[14px] transition-colors disabled:opacity-35 disabled:cursor-not-allowed mb-2"
                >
                  {savingPin ? 'Saving...' : pinSetStep === 'new' ? 'Continue' : 'Save PIN'}
                </button>

                {cleared && (
                  <button
                    onClick={() => setSettingPin(false)}
                    className="w-full py-2 text-[12px] text-black/35 hover:text-black/60 transition-colors"
                  >
                    Skip for now
                  </button>
                )}
              </>
            )}
          </motion.div>
        </div>
      </>
    );
  }

  // Already cleared
  if (cleared) return <>{children}</>;

  // ─── Main PIN gate ────────────────────────────────────────────────────────────
  return (
    <div
      className="fixed inset-0 z-[99999] overflow-y-auto bg-[#FAFAFA] flex flex-col items-center justify-center p-6"
      style={{ WebkitOverflowScrolling: 'touch' }}
    >
      <AnimatePresence mode="wait">
        <motion.div
          key="pin-gate"
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -12 }}
          transition={{ duration: 0.35, ease: [0.22, 1, 0.36, 1] }}
          className="w-full max-w-[400px] bg-white rounded-[28px] border border-black/[0.07] p-8 shadow-[0_20px_60px_rgba(0,0,0,0.08)] flex flex-col items-center text-center"
        >
          {/* Logo mark */}
          <div className={`w-16 h-16 rounded-full flex items-center justify-center mb-5 ${locked ? 'bg-red-50' : 'bg-black/[0.04]'}`}>
            {locked ? (
              <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="#ef4444" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <rect x="3" y="11" width="18" height="11" rx="2"/><path d="M7 11V7a5 5 0 0 1 10 0v4"/>
              </svg>
            ) : (
              <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="#1C1C1E" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
                <rect x="3" y="11" width="18" height="11" rx="2"/><path d="M7 11V7a5 5 0 0 1 10 0v4"/>
              </svg>
            )}
          </div>

          {/* Title */}
          <h2 className="text-[22px] font-black tracking-tight text-[#1C1C1E] mb-1 leading-tight">
            {locked ? 'Access suspended' : verifying ? 'Checking...' : 'Enter your PIN'}
          </h2>
          <p className="text-[13px] text-black/45 font-medium mb-6 leading-relaxed px-1">
            {locked
              ? 'Too many failed attempts. Please wait before trying again.'
              : 'Enter your 6-digit code to access Ledger Chat.'}
          </p>

          {!locked && (
            <>
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
                />
              </motion.div>

              {/* Error */}
              <AnimatePresence>
                {pinError && (
                  <motion.p
                    initial={{ opacity: 0, y: -6 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0 }}
                    className="text-red-500 text-[12px] font-semibold mb-4 text-center"
                  >
                    {pinError}
                  </motion.p>
                )}
              </AnimatePresence>

              {/* Attempts warning */}
              {attemptsRemaining !== null && attemptsRemaining <= 3 && !locked && (
                <p className="text-orange-500 text-[11px] font-semibold mb-3">
                  {attemptsRemaining} attempt{attemptsRemaining !== 1 ? 's' : ''} remaining before temporary lockout
                </p>
              )}

              {/* Submit */}
              <button
                onClick={() => handleSubmit(pin)}
                disabled={pin.length < 6 || verifying}
                className="w-full h-[50px] bg-[#1C1C1E] hover:bg-black text-white rounded-2xl font-bold text-[14px] transition-all active:scale-[0.97] disabled:opacity-35 disabled:cursor-not-allowed mb-5 flex items-center justify-center gap-2"
              >
                {verifying ? (
                  <>
                    <svg className="animate-spin" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                      <path d="M21 12a9 9 0 1 1-6.219-8.56"/>
                    </svg>
                    Checking...
                  </>
                ) : 'Unlock'}
              </button>

              {/* Forgot PIN */}
              <button
                onClick={handleRequestOtp}
                disabled={resetFlowState === 'requesting'}
                className="w-full text-center text-[12px] font-medium text-black/40 hover:text-black/70 transition-colors mb-1 disabled:opacity-50"
              >
                {resetFlowState === 'requesting' ? 'Sending...' : 'Forgot your PIN?'}
              </button>
            </>
          )}

          {/* Lockout countdown */}
          {locked && !confirmReset && (
            <div className="w-full flex flex-col items-center gap-3 mb-4">
              <p className="text-[13px] text-red-400 font-mono font-semibold">
                {lockoutCountdown > 0
                  ? `Try again in ${Math.floor(lockoutCountdown / 60)}:${String(lockoutCountdown % 60).padStart(2, '0')}`
                  : 'Lockout has expired'}
              </p>
              {lockoutCountdown === 0 && (
                <button
                  onClick={() => { setLocked(false); setPinError(null); setPin(''); }}
                  className="w-full py-3 border border-black/10 rounded-2xl text-[13px] font-semibold text-[#1C1C1E] hover:bg-black/[0.03] transition-all"
                >
                  Try again
                </button>
              )}
              <button
                onClick={handleRequestOtp}
                disabled={resetFlowState === 'requesting'}
                className="w-full text-center text-[12px] text-black/40 hover:text-black/70 transition-colors disabled:opacity-50"
              >
                Forgot your PIN? Reset via email
              </button>
            </div>
          )}

          {/* OTP Reset panel */}
          <AnimatePresence>
            {(resetFlowState === 'awaiting_otp' || resetFlowState === 'verifying_otp') && (
              <motion.div
                initial={{ opacity: 0, height: 0 }}
                animate={{ opacity: 1, height: 'auto' }}
                exit={{ opacity: 0, height: 0 }}
                className="w-full overflow-hidden mt-2"
              >
                <div className="w-full p-5 bg-[#F2F2F7] border border-black/[0.06] rounded-2xl text-left">
                  <h3 className="text-[#1C1C1E] font-black text-[14px] mb-2">Check your email</h3>
                  <p className="text-black/50 text-[12px] font-medium leading-relaxed mb-4">
                    A 6-digit code was sent to <span className="font-black text-[#1C1C1E]">{resetEmail}</span>.
                    Enter it below. Expires in 10 minutes.
                  </p>

                  <PinInput
                    value={resetOtp}
                    onChange={v => { setResetOtp(v); setResetOtpError(null); }}
                    onComplete={handleVerifyOtp}
                    disabled={resetFlowState === 'verifying_otp'}
                    error={!!resetOtpError}
                  />

                  {resetOtpError && (
                    <p className="text-red-500 text-[11px] font-semibold mb-3">
                      {resetOtpError}
                      {resetAttemptsLeft !== null && resetAttemptsLeft > 0 && (
                        <span className="text-orange-500 ml-1">({resetAttemptsLeft} left)</span>
                      )}
                    </p>
                  )}

                  <div className="flex gap-2">
                    <button
                      onClick={() => { setResetFlowState('idle'); setResetOtp(''); setResetOtpError(null); setResetAttemptsLeft(null); }}
                      disabled={resetFlowState === 'verifying_otp'}
                      className="flex-1 py-2.5 rounded-xl border border-black/10 text-[#1C1C1E] text-[12px] font-semibold hover:bg-black/[0.03] transition-colors disabled:opacity-50"
                    >
                      Cancel
                    </button>
                    <button
                      onClick={() => handleVerifyOtp(resetOtp)}
                      disabled={resetOtp.length < 6 || resetFlowState === 'verifying_otp'}
                      className="flex-1 py-2.5 rounded-xl bg-[#1C1C1E] text-white text-[12px] font-semibold hover:bg-black transition-colors disabled:opacity-40"
                    >
                      {resetFlowState === 'verifying_otp' ? 'Checking...' : 'Verify'}
                    </button>
                  </div>

                  <button
                    onClick={handleRequestOtp}
                    disabled={resetFlowState === 'verifying_otp'}
                    className="w-full text-center text-[11px] text-black/35 hover:text-black/60 transition-colors mt-3 disabled:opacity-40"
                  >
                    Send a new code
                  </button>
                </div>
              </motion.div>
            )}
          </AnimatePresence>

          {/* Wallet-only reset fallback */}
          <AnimatePresence>
            {confirmReset && (
              <motion.div
                initial={{ opacity: 0, height: 0 }}
                animate={{ opacity: 1, height: 'auto' }}
                exit={{ opacity: 0, height: 0 }}
                className="w-full overflow-hidden"
              >
                <div className="w-full p-5 bg-red-50 border border-red-100 rounded-2xl text-left mt-2 mb-2">
                  <h3 className="text-red-700 font-black text-[13px] mb-2">Reset PIN</h3>
                  <p className="text-red-600/80 text-[12px] font-medium leading-relaxed mb-4">
                    No email linked to this account. To reset your PIN, you will need to reconnect your wallet.
                  </p>
                  <div className="flex gap-2">
                    <button
                      onClick={() => setConfirmReset(false)}
                      disabled={resetting}
                      className="flex-1 py-2.5 rounded-xl border border-red-200 text-red-700 text-[12px] font-semibold hover:bg-red-100 transition-colors"
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
                      className="flex-1 py-2.5 rounded-xl bg-red-600 text-white text-[12px] font-semibold hover:bg-red-700 transition-colors disabled:opacity-50"
                    >
                      {resetting ? 'Please wait...' : 'Log out & reconnect'}
                    </button>
                  </div>
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </motion.div>
      </AnimatePresence>
    </div>
  );
}
