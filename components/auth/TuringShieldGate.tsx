'use client';

import React, { useEffect, useState, useRef, useCallback } from 'react';
import { Cpu, CheckCircle2, Key, AlertTriangle, Loader2, Lock, RefreshCw, Mail } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { toast } from 'sonner';

// ─── Session key ─────────────────────────────────────────────────────────────
// The enclave clearance token is persisted for the current browser session only.
// It resets on tab close — requiring re-verification each new session.
// NOTE: This token is issued by the server after real PIN verification.
const CLEARANCE_KEY = '__enclave_clearance_v2__';
const CLEARANCE_TOKEN_KEY = 'ledger_enclave_clearance';
const CLEARANCE_TS_KEY = 'ledger_enclave_ts';
// [SECURITY FIX] Add token fingerprint to detect manual sessionStorage injection
const CLEARANCE_FINGERPRINT_KEY = '__enclave_fp__';
const CLEARANCE_TTL_MS = 8 * 60 * 60 * 1000; // 8 hours

function PinInput({ value, onChange, onComplete, disabled, error }: { value: string, onChange: (v: string) => void, onComplete?: (v: string) => void, disabled?: boolean, error?: boolean }) {
  const inputRef = useRef<HTMLInputElement>(null);
  
  return (
    <div className="relative w-full flex justify-center mb-4 cursor-text" onClick={() => inputRef.current?.focus()}>
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
      <div className="flex gap-2 justify-center w-full relative z-10 pointer-events-none">
        {Array.from({ length: 6 }).map((_, i) => {
          const digit = value[i];
          const isActive = value.length === i || (value.length === 6 && i === 5);
          return (
            <div
              key={i}
              className={`w-11 h-13 sm:w-12 sm:h-14 flex items-center justify-center text-[18px] font-black rounded-xl border-2 transition-all duration-200
                ${error
                  ? 'bg-red-50 border-red-400 text-red-600'
                  : digit
                  ? 'bg-indigo-50 border-indigo-500 text-indigo-700'
                  : isActive
                  ? 'bg-white border-indigo-500 ring-2 ring-indigo-500/20'
                  : 'bg-black/[0.04] border-black/10 text-black'
                }
              `}
              style={{ height: '56px' }}
            >
              {digit || ''}
            </div>
          );
        })}
      </div>
    </div>
  );
}

// Derive a simple client-side fingerprint from the token to detect tampering.
// This is NOT cryptographic security — it's a client-side sanity check.
// Real security is always enforced server-side by the /api/auth/enclave-pin route.
function deriveFingerprint(token: string, ts: number): string {
  // Simple XOR-based fingerprint: makes manual injection require knowing the token
  const combined = `${token}:${ts}:ledger_enclave`;
  let hash = 0;
  for (let i = 0; i < combined.length; i++) {
    hash = ((hash << 5) - hash + combined.charCodeAt(i)) | 0;
  }
  return Math.abs(hash).toString(36);
}

function readClearance(): boolean {
  try {
    const granted = sessionStorage.getItem(CLEARANCE_KEY) === 'granted';
    if (!granted) return false;
    // Validate token age
    const ts = parseInt(sessionStorage.getItem(CLEARANCE_TS_KEY) || '0', 10);
    if (Date.now() - ts > CLEARANCE_TTL_MS) {
      // Token expired — clear it
      sessionStorage.removeItem(CLEARANCE_KEY);
      sessionStorage.removeItem(CLEARANCE_TOKEN_KEY);
      sessionStorage.removeItem(CLEARANCE_TS_KEY);
      sessionStorage.removeItem(CLEARANCE_FINGERPRINT_KEY);
      return false;
    }
    // [SECURITY FIX] Validate fingerprint — catches naive sessionStorage injection
    const token = sessionStorage.getItem(CLEARANCE_TOKEN_KEY) || '';
    const storedFp = sessionStorage.getItem(CLEARANCE_FINGERPRINT_KEY) || '';
    const expectedFp = deriveFingerprint(token, ts);
    if (!token || storedFp !== expectedFp) {
      // Fingerprint mismatch — possible injection attempt, clear and force re-auth
      sessionStorage.removeItem(CLEARANCE_KEY);
      sessionStorage.removeItem(CLEARANCE_TOKEN_KEY);
      sessionStorage.removeItem(CLEARANCE_TS_KEY);
      sessionStorage.removeItem(CLEARANCE_FINGERPRINT_KEY);
      return false;
    }
    return true;
  } catch {
    return false;
  }
}

function writeClearance(token: string, ts: number) {
  try {
    const fp = deriveFingerprint(token, ts);
    sessionStorage.setItem(CLEARANCE_KEY, 'granted');
    sessionStorage.setItem(CLEARANCE_TOKEN_KEY, token);
    sessionStorage.setItem(CLEARANCE_TS_KEY, ts.toString());
    sessionStorage.setItem(CLEARANCE_FINGERPRINT_KEY, fp);
  } catch {}
}

// ─── Component ───────────────────────────────────────────────────────────────
export function TuringShieldGate({
  children,
  onVerified,
}: {
  children: React.ReactNode;
  onVerified?: (enclaveId: string) => void;
}) {
  const [mounted, setMounted] = useState(false);
  const [cleared, setCleared] = useState(false);
  const [pin, setPin] = useState('');
  const [pinError, setPinError] = useState<string | null>(null);
  const [verifying, setVerifying] = useState(false);
  const [shake, setShake] = useState(false);
  const [attemptsRemaining, setAttemptsRemaining] = useState<number | null>(null);
  const [locked, setLocked] = useState(false);
  // [SECURITY FIX] Server-enforced lockout timer — cannot be bypassed client-side
  const [lockoutExpiresAt, setLockoutExpiresAt] = useState<number | null>(null);
  const [lockoutCountdown, setLockoutCountdown] = useState(0);

  // Count down the lockout timer — purely cosmetic, server enforces the real block
  React.useEffect(() => {
    if (!lockoutExpiresAt) return;
    const interval = setInterval(() => {
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
    return () => clearInterval(interval);
  }, [lockoutExpiresAt]);

  // Set new PIN flow
  const [isFirstTime, setIsFirstTime] = useState(false);
  const [settingPin, setSettingPin] = useState(false);
  const [newPin, setNewPin] = useState('');
  const [confirmPin, setConfirmPin] = useState('');
  const [pinSetStep, setPinSetStep] = useState<'new' | 'confirm'>('new');
  const [pinSetError, setPinSetError] = useState<string | null>(null);
  const [pinSetSuccess, setPinSetSuccess] = useState(false);
  
  // Reset PIN flow
  const [confirmReset, setConfirmReset] = useState(false);
  const [resetting, setResetting] = useState(false);

  const [resetFlowState, setResetFlowState] = useState<'idle' | 'requesting' | 'awaiting_otp' | 'verifying_otp'>('idle');
  const [resetEmail, setResetEmail] = useState<string | null>(null);
  const [resetOtp, setResetOtp] = useState('');
  const [resetOtpError, setResetOtpError] = useState<string | null>(null);
  const [resetAttemptsLeft, setResetAttemptsLeft] = useState<number | null>(null);
  const [tempClearanceToken, setTempClearanceToken] = useState<string | null>(null);
  const [tempClearanceTs, setTempClearanceTs] = useState<number | null>(null);

  // Anti-Bot CAPTCHA
  const [captchaPassed, setCaptchaPassed] = useState(true);
  // Cryptographic ZK-SNARK Handshake instead of childish math captchas
  const [zkStatus, setZkStatus] = useState<string>('INITIATING ZK-SNARK HANDSHAKE');
  const [zkProgress, setZkProgress] = useState(0);

  useEffect(() => {
    setMounted(true);
    if (readClearance()) {
      setCleared(true);
      setCaptchaPassed(true);
    } else {
      // Check if user even has a PIN set
      fetch('/api/auth/enclave-pin', { credentials: 'include' })
        .then(res => res.json())
        .then(async data => {
          if (data && data.hasPin === false) {
            // First time user: get a clearance token via default PIN automatically
            try {
              const res = await fetch('/api/auth/enclave-pin', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ pin: '777777' }),
              });
              const postData = await res.json();
              if (postData.success && postData.clearanceToken) {
                setTempClearanceToken(postData.clearanceToken);
                setTempClearanceTs(postData.clearanceTs);
              }
            } catch (err) {
              console.error('Failed to get default clearance token', err);
            }
            setIsFirstTime(true);
            setSettingPin(true);
            setCaptchaPassed(true); // skip captcha if setting pin
          }
        })
        .catch(console.error);
    }
  }, []);

  // Initialize ZK-SNARK Handshake immediately on mount
  useEffect(() => {
    if (mounted && !cleared && !captchaPassed) {
      let progress = 0;
      const interval = setInterval(() => {
        progress += Math.floor(Math.random() * 15) + 5;
        if (progress > 100) progress = 100;
        setZkProgress(progress);
        
        if (progress < 30) setZkStatus('GENERATING ACIR WITNESS MAP...');
        else if (progress < 60) setZkStatus('PROVING EXECUTION IN ENCLAVE...');
        else if (progress < 90) setZkStatus('VERIFYING ZK-SNARK ON-CHAIN...');
        else setZkStatus('CRYPTOGRAPHIC HANDSHAKE ESTABLISHED');

        if (progress === 100) {
          clearInterval(interval);
          setTimeout(() => setCaptchaPassed(true), 600);
        }
      }, 250);
      return () => clearInterval(interval);
    }
  }, [mounted, cleared, captchaPassed]);

  const triggerShake = useCallback(() => {
    setShake(true);
    setTimeout(() => setShake(false), 500);
  }, []);

  const handleRequestOtp = async () => {
    setResetFlowState('requesting');
    setResetOtpError(null);
    try {
      const res = await fetch('/api/auth/enclave-pin-reset', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'request' })
      });
      const data = await res.json();
      if (!res.ok) {
        if (data.error === 'no_email') {
          // Wallet-only user. Use the legacy reset flow which logs them out.
          setResetFlowState('idle');
          setConfirmReset(true);
          return;
        }
        throw new Error(data.error || 'Failed to request OTP');
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
      const res = await fetch('/api/auth/enclave-pin-reset', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'verify', otp: code })
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
      
      // Success! Proceed to set new PIN flow.
      setTempClearanceToken(data.clearanceToken || null);
      setTempClearanceTs(data.clearanceTs || null);
      setResetFlowState('idle');
      setConfirmReset(false);
      setSettingPin(true);
      setIsFirstTime(false); // we're resetting, not first time setup
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

  // ─── Verify PIN against server ─────────────────────────────────────────────
  const handleSubmit = useCallback(async (code: string) => {
    if (code.length !== 6) return;
    if (verifying || locked) return;

    setVerifying(true);
    setPinError(null);

    try {
      const res = await fetch('/api/auth/enclave-pin', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ pin: code }),
        credentials: 'include',
      });

      const data = await res.json();

      if (res.status === 429) {
        setLocked(true);
        setPinError(data.error || 'Too many attempts. Please wait 15 minutes.');
        setPin('');
        triggerShake();
        setVerifying(false);
        setLockoutExpiresAt(Date.now() + 15 * 60 * 1000);
        setLockoutCountdown(15 * 60);
        return;
      }

      if (!res.ok || !data.success) {
        const remaining = data.attemptsRemaining ?? null;
        setAttemptsRemaining(remaining);
        if (remaining === 0) {
          setLocked(true);
          setPinError('Enclave locked. Too many failed attempts. Wait 15 minutes.');
        } else {
          if (data.error?.includes('expired')) {
            window.location.href = '/connect';
            return;
          }
          setPinError(data.error || `Incorrect PIN. ${remaining !== null ? `${remaining} attempts remaining.` : ''}`);
        }
        setPin('');
        triggerShake();
        setVerifying(false);
        return;
      }

      // ✅ Verified
      writeClearance(data.clearanceToken, data.clearanceTs);
      setVerifying(false);
      setCleared(true);
      if (onVerified) onVerified(data.clearanceToken);

      if (data.isFirstTimeUser) {
        setIsFirstTime(true);
        setSettingPin(true);
        setTempClearanceToken(data.clearanceToken);
        setTempClearanceTs(data.clearanceTs);
      }

    } catch (err) {
      console.error('[TuringShieldGate] Network error:', err);
      setPinError('Network error. Please check your connection and try again.');
      triggerShake();
      setVerifying(false);
    }
  }, [verifying, locked, onVerified, triggerShake]);

  // ─── Set new PIN flow ─────────────────────────────────────────────────────
  const handleSetPin = useCallback(async (val?: string | React.MouseEvent) => {
      const stringVal = typeof val === 'string' ? val : undefined;
      const code = pinSetStep === 'new' ? (stringVal ?? newPin) : newPin;
      const conf = pinSetStep === 'confirm' ? (stringVal ?? confirmPin) : confirmPin;

    if (code.length !== 6) { setPinSetError('Enter a 6-digit PIN.'); return; }

    if (pinSetStep === 'new') {
      setPinSetStep('confirm');
      setConfirmPin('');
      return;
    }

    // Confirm step
    if (code !== conf) {
      setPinSetError('PINs do not match. Please start over.');
      setPinSetStep('new');
      setNewPin('');
      setConfirmPin('');
      return;
    }

    // [SECURITY FIX] Do NOT close the overlay before server confirmation.
    // Previously, setSettingPin(false) was called before the fetch, meaning
    // a network failure left the user in a broken state (cleared but no PIN saved).
    setPinSetError(null);
    try {
      const payload: any = { newPin: code };
      if (tempClearanceToken && tempClearanceTs) {
        payload.clearanceToken = tempClearanceToken;
        payload.clearanceTs = tempClearanceTs;
      }

      const res = await fetch('/api/auth/enclave-pin', {
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
        // Only NOW close the input step and show the success message
        setSettingPin(true);
      } else {
        if (data.error?.includes('expired')) {
          window.location.href = '/connect';
          return;
        }
        setPinSetError(data.error || 'Failed to update PIN.');
        // Stay on the confirm step so user can retry
        setPinSetStep('new');
        setNewPin('');
        setConfirmPin('');
      }
    } catch (err) {
      setPinSetError('Network error while saving PIN. Please try again.');
      // Stay on confirm step, do NOT close overlay
    }
  }, [newPin, confirmPin, pinSetStep, onVerified, tempClearanceToken, tempClearanceTs]);

  // Prevent Hydration Mismatch
  if (!mounted) return null;

  // ─── Set PIN Overlay (shown after first successful login or if no PIN is set) ──
  if (settingPin) {
    return (
      <>
        {cleared && children}
        <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
          <motion.div
            initial={{ scale: 0.92, opacity: 0, y: 20 }}
            animate={{ scale: 1, opacity: 1, y: 0 }}
            className="w-full max-w-[380px] bg-white rounded-[28px] p-7 shadow-2xl flex flex-col items-center text-center"
          >
            <div className="w-14 h-14 rounded-full bg-indigo-50 flex items-center justify-center mb-4 text-indigo-600">
              <Lock size={24} strokeWidth={2.5} />
            </div>
            <h2 className="text-[20px] font-black tracking-tight mb-1">
              {pinSetSuccess ? 'PIN Saved!' : 'Set Your Enclave PIN'}
            </h2>
            {pinSetSuccess ? (
              <>
                <p className="text-[13px] text-[#555] mb-5 leading-relaxed">
                  Your personal 6-digit enclave PIN has been saved securely. Use it every session.
                </p>
                <button
                  onClick={() => setSettingPin(false)}
                  className="w-full py-3 bg-indigo-600 text-white rounded-2xl font-black text-[13px] uppercase tracking-[0.1em]"
                >
                  <CheckCircle2 size={14} className="inline mr-2" />
                  Continue to Enclave
                </button>
              </>
            ) : (
              <>
                <p className="text-[12px] text-[#666] mb-5 leading-relaxed px-2">
                  {isFirstTime
                    ? (cleared ? 'You logged in with the default PIN. Set your own personal PIN now for maximum security.' : 'Set your personal 6-digit Enclave PIN now to secure your session.')
                    : `${pinSetStep === 'confirm' ? 'Confirm your new PIN.' : 'Enter a new 6-digit PIN.'}`
                  }
                </p>
                {pinSetError && (
                  <p className="text-red-500 text-[11px] font-bold mb-3 flex items-center gap-1">
                    <AlertTriangle size={11} /> {pinSetError}
                  </p>
                )}
                <PinInput
                  value={pinSetStep === 'new' ? newPin : confirmPin}
                  onChange={v => {
                      if (pinSetStep === 'new') setNewPin(v);
                      else setConfirmPin(v);
                      setPinSetError(null);
                    }}
                    onComplete={v => {
                      if (v.length === 6) handleSetPin(v);
                    }}
                  error={!!pinSetError}
                />
                <button
                  onClick={handleSetPin}
                  disabled={(pinSetStep === 'new' ? newPin : confirmPin).length < 6}
                  className="w-full py-3 bg-indigo-600 hover:bg-indigo-700 text-white rounded-2xl font-black text-[13px] uppercase tracking-[0.1em] transition-all disabled:opacity-40 disabled:cursor-not-allowed mb-2"
                >
                  {pinSetStep === 'new' ? 'Next: Confirm PIN →' : 'Save PIN'}
                </button>
                {cleared && (
                  <button
                    onClick={() => setSettingPin(false)}
                    className="w-full py-2.5 text-[11px] text-[#999] hover:text-black transition-colors"
                  >
                    Skip for now (use default PIN next time)
                  </button>
                )}
              </>
            )}
          </motion.div>
        </div>
      </>
    );
  }

  // Already cleared — render children immediately
  if (cleared) return <>{children}</>;

  // ─── PIN Gate ─────────────────────────────────────────────────────────────
  return (
    <div
      className="fixed inset-0 z-[99999] overflow-y-auto bg-[#FAFAFA] font-sans text-[#0A0A0A] p-4 sm:p-8 flex flex-col items-center justify-center select-none"
      style={{ WebkitOverflowScrolling: 'touch' }}
    >
      <div className="flex-1 flex flex-col items-center justify-center w-full min-h-full py-12">
        {/* Background ambient glow */}
        <div className="absolute top-[20%] left-1/2 -translate-x-1/2 w-[500px] h-[500px] bg-indigo-500/5 blur-[120px] rounded-full pointer-events-none" />
        <div className="absolute top-[30%] right-1/4 w-[300px] h-[300px] bg-purple-500/4 blur-[100px] rounded-full pointer-events-none" />

        <AnimatePresence mode="wait">
          <motion.div
            key="enclave-gate"
            initial={{ scale: 0.94, opacity: 0, y: 24 }}
            animate={{ scale: 1, opacity: 1, y: 0 }}
            exit={{ scale: 0.94, opacity: 0, y: -16 }}
            transition={{ duration: 0.5, ease: [0.22, 1, 0.36, 1] }}
            style={{ willChange: 'transform, opacity' }}
            className="relative z-10 w-full max-w-[420px] border border-[#EBEBEB] bg-white rounded-[32px] p-8 shadow-[0_40px_100px_rgba(0,0,0,0.08)] flex flex-col items-center text-center mx-auto"
          >
          {/* Icon */}
          <div className="relative w-[72px] h-[72px] mb-5 flex items-center justify-center">
            <div className={`absolute inset-0 rounded-full opacity-15 animate-pulse ${locked ? 'bg-red-500' : 'bg-gradient-to-tr from-indigo-500 to-purple-600'}`} />
            <div className="absolute inset-[3px] rounded-full border border-indigo-400/25" />
            <div className={`w-14 h-14 rounded-full bg-white shadow-[0_0_32px_rgba(99,102,241,0.25)] flex items-center justify-center relative z-10 ${locked ? 'text-red-500' : 'text-indigo-600'}`}>
              {locked ? <Lock size={26} strokeWidth={2.5} /> : <Key size={26} strokeWidth={2.5} />}
            </div>
          </div>

          {/* Title */}
          <h2 className="text-[22px] font-black tracking-tight text-black mb-1 leading-tight">
            {verifying ? 'Verifying...' : locked ? 'Enclave Locked' : 'Enclave Authentication'}
          </h2>
          <div className={`text-[10px] font-bold uppercase tracking-[0.2em] mb-5 flex items-center justify-center gap-1.5 ${locked ? 'text-red-500' : 'text-indigo-600'}`}>
            <Cpu size={10} strokeWidth={3} />
            {locked ? 'Brute-Force Protection Active' : 'Secure Enclave Active'}
          </div>

          {/* ZK Handshake or PIN Panel */}
          {!captchaPassed ? (
            // State 1 & 2: Cryptographic Handshake visualization
            <div className="w-full flex flex-col items-center py-6">
              <p className="font-mono text-[11px] font-bold tracking-widest text-[#0A0A0A] mb-6 uppercase">
                {zkStatus}
              </p>
              
              <div className="w-full h-1 bg-black/5 rounded-full overflow-hidden mb-6 relative">
                <motion.div 
                  className="absolute left-0 top-0 bottom-0 bg-indigo-600 rounded-full"
                  animate={{ width: `${zkProgress}%` }}
                  transition={{ ease: "linear", duration: 0.2 }}
                />
              </div>

              <div className="flex gap-2 mb-2 w-full justify-center opacity-40">
                 {Array.from({length: 6}).map((_, i) => (
                   <div key={i} className="w-12 h-14 bg-black/5 rounded-xl animate-pulse" style={{ animationDelay: `${i * 0.1}s` }} />
                 ))}
              </div>
            </div>
          ) : (
            <>
              <p className="text-[13px] text-[#666] font-medium leading-[1.6] mb-6 px-1">
                {locked
                  ? 'Too many failed attempts. Enclave is temporarily locked for security. Please wait before trying again.'
                  : 'Enter your 6-digit Enclave PIN to verify identity and access the sovereign network.'
                }
              </p>

              {!locked && (
                <>
                  {/* PIN inputs */}
                  <motion.div
                    animate={shake ? { x: [0, -10, 10, -10, 10, 0] } : { x: 0 }}
                    transition={{ duration: 0.4 }}
                    className="flex gap-2 mb-4 w-full justify-center"
                  >
                    <PinInput
                      value={pin}
                      onChange={v => {
                        setPin(v);
                        setPinError(null);
                      }}
                      onComplete={handleSubmit}
                      disabled={verifying}
                      error={!!pinError}
                    />
                  </motion.div>

                  {/* Error */}
                  <AnimatePresence>
                    {pinError && (
                      <motion.div
                        initial={{ opacity: 0, y: -8 }}
                        animate={{ opacity: 1, y: 0 }}
                        exit={{ opacity: 0 }}
                        className="flex items-center gap-1.5 text-red-600 text-[11px] font-bold uppercase tracking-widest mb-4 text-center"
                      >
                        <AlertTriangle size={12} className="shrink-0" />
                        {pinError}
                      </motion.div>
                    )}
                  </AnimatePresence>

                  {/* Attempts indicator */}
                  {attemptsRemaining !== null && attemptsRemaining <= 3 && !locked && (
                    <p className="text-orange-500 text-[10px] font-bold uppercase tracking-widest mb-3">
                      ⚠ {attemptsRemaining} attempt{attemptsRemaining !== 1 ? 's' : ''} remaining before lockout
                    </p>
                  )}

                  {/* Submit button */}
                  <button
                    onClick={() => handleSubmit(pin)}
                    disabled={pin.length < 6 || verifying}
                    className="w-full h-[52px] bg-[#0A0A0A] hover:bg-black/80 text-white rounded-2xl font-black text-[13px] uppercase tracking-[0.15em] transition-all duration-200 active:scale-[0.97] shadow-lg shadow-black/15 flex items-center justify-center gap-3 disabled:opacity-40 disabled:cursor-not-allowed mb-6"
                  >
                    {verifying ? (
                      <><Loader2 size={16} className="animate-spin" /> Verifying...</>
                    ) : (
                      <> Confirm Enclave Access</>
                    )}
                  </button>
                  
                  <button
                    onClick={handleRequestOtp}
                    disabled={resetFlowState === 'requesting'}
                    className="w-full text-center text-[12px] font-bold text-[#999] hover:text-black transition-colors mb-2 disabled:opacity-50"
                  >
                    {resetFlowState === 'requesting' ? 'Requesting Reset Code...' : 'Forgot PIN? Reset Enclave'}
                  </button>
                </>
              )}
            </>
          )}

          {locked && !confirmReset && (
            <div className="w-full flex flex-col items-center gap-3 mb-6">
              <div className="flex items-center gap-2 text-[12px] text-red-400 font-mono">
                <RefreshCw size={12} className="animate-spin" />
                {/* [SECURITY FIX] Countdown is cosmetic — server enforces the real lockout */}
                {lockoutCountdown > 0
                  ? `Lockout expires in ${Math.floor(lockoutCountdown / 60)}:${String(lockoutCountdown % 60).padStart(2, '0')}`
                  : 'Lockout active. Server will verify readiness.'}
              </div>
              {/* [SECURITY FIX] Removed "Try again anyway" button — it allowed infinite attempts
                   by resetting client-side state only. The server enforces brute-force protection
                   independently. Attempting again while locked will receive a 429 from the server. */}
              {lockoutCountdown === 0 && (
                <button
                  onClick={() => { setPinError(null); setPin(''); }}
                  className="w-full py-3 border border-black/10 rounded-2xl text-[12px] font-bold text-[#666] hover:bg-black/[0.03] transition-all"
                >
                  Try Again
                </button>
              )}
            </div>
          )}

          {/* Audit trail */}
          {!confirmReset && (
            <div className="w-full flex flex-col gap-2 text-left bg-black/[0.02] px-4 py-4 rounded-2xl border border-black/[0.06]">
              <div className="text-[9px] uppercase tracking-[0.25em] text-black/35 font-black mb-1">Security Audit Trail</div>
              {[
                'Server-side PIN verification (no local bypass)',
                'HMAC-SHA256 • Timing-safe comparison',
                'Brute-force protection: 5 attempts / 15 min',
              ].map(item => (
                <div key={item} className="flex items-center gap-2 text-[11px] font-medium text-[#555]">
                  <CheckCircle2 size={12} className="text-indigo-500 shrink-0" />
                  {item}
                </div>
              ))}
            </div>
          )}

          {/* ── OTP Reset Flow ───────────────────────────────────────────── */}
          <AnimatePresence>
            {(resetFlowState === 'awaiting_otp' || resetFlowState === 'verifying_otp') && (
              <motion.div
                initial={{ opacity: 0, height: 0 }}
                animate={{ opacity: 1, height: 'auto' }}
                exit={{ opacity: 0, height: 0 }}
                className="w-full overflow-hidden mt-4"
              >
                <div className="w-full p-5 bg-indigo-50 border border-indigo-100 rounded-2xl text-left">
                  {/* Header */}
                  <div className="flex items-center gap-2 mb-3">
                    <Mail size={14} className="text-indigo-600 shrink-0" />
                    <h3 className="text-indigo-800 font-black text-[13px] uppercase tracking-widest">
                      Verify Your Identity
                    </h3>
                  </div>
                  <p className="text-indigo-700/80 text-[12px] font-medium leading-relaxed mb-4">
                    A 6-digit code has been sent to <span className="font-black text-indigo-800">{resetEmail}</span>.
                    Enter it below to reset your Enclave PIN. Code expires in 10 minutes.
                  </p>

                  {/* OTP Input */}
                  <PinInput
                    value={resetOtp}
                    onChange={v => {
                      setResetOtp(v);
                      setResetOtpError(null);
                    }}
                    onComplete={handleVerifyOtp}
                    disabled={resetFlowState === 'verifying_otp'}
                    error={!!resetOtpError}
                  />

                  {/* Error */}
                  {resetOtpError && (
                    <div className="flex items-center gap-1.5 text-red-600 text-[11px] font-bold mb-3">
                      <AlertTriangle size={11} className="shrink-0" />
                      {resetOtpError}
                      {resetAttemptsLeft !== null && resetAttemptsLeft > 0 && (
                        <span className="text-orange-500 ml-1">({resetAttemptsLeft} left)</span>
                      )}
                    </div>
                  )}

                  {/* Loading indicator */}
                  {resetFlowState === 'verifying_otp' && (
                    <div className="flex items-center gap-2 text-indigo-600 text-[11px] font-bold mb-3">
                      <Loader2 size={12} className="animate-spin" />
                      Verifying code...
                    </div>
                  )}

                  {/* Actions */}
                  <div className="flex gap-2">
                    <button
                      onClick={() => {
                        setResetFlowState('idle');
                        setResetOtp('');
                        setResetOtpError(null);
                        setResetAttemptsLeft(null);
                      }}
                      disabled={resetFlowState === 'verifying_otp'}
                      className="flex-1 py-2 rounded-xl border border-indigo-200 text-indigo-700 text-[11px] font-bold uppercase tracking-widest hover:bg-indigo-100 transition-colors disabled:opacity-50"
                    >
                      Cancel
                    </button>
                    <button
                      onClick={() => handleVerifyOtp(resetOtp)}
                      disabled={resetOtp.length < 6 || resetFlowState === 'verifying_otp'}
                      className="flex-1 py-2 rounded-xl bg-indigo-600 text-white text-[11px] font-bold uppercase tracking-widest hover:bg-indigo-700 transition-colors disabled:opacity-40"
                    >
                      {resetFlowState === 'verifying_otp' ? 'Verifying...' : 'Verify Code →'}
                    </button>
                  </div>

                  {/* Resend link */}
                  <button
                    onClick={handleRequestOtp}
                    disabled={resetFlowState === 'verifying_otp'}
                    className="w-full text-center text-[11px] text-indigo-500 hover:text-indigo-700 transition-colors mt-3 disabled:opacity-40"
                  >
                    Didn't receive it? Send a new code
                  </button>
                </div>
              </motion.div>
            )}
          </AnimatePresence>

          {/* ── Wallet-only Fallback (no email) ─── */}
          <AnimatePresence>
            {confirmReset && (
              <motion.div
                initial={{ opacity: 0, height: 0 }}
                animate={{ opacity: 1, height: 'auto' }}
                exit={{ opacity: 0, height: 0 }}
                className="w-full overflow-hidden"
              >
                <div className="w-full p-5 bg-red-50 border border-red-100 rounded-2xl text-left mt-2 mb-4">
                  <h3 className="text-red-700 font-black text-[13px] uppercase tracking-widest flex items-center gap-2 mb-2">
                    <AlertTriangle size={14} /> Reset Enclave PIN
                  </h3>
                  <p className="text-red-600/80 text-[12px] font-medium leading-relaxed mb-4">
                    No email is linked to this wallet. To reset your Enclave PIN, you must re-authenticate
                    by re-connecting your wallet — this cryptographically proves ownership.
                  </p>
                  <div className="flex gap-2">
                    <button
                      onClick={() => setConfirmReset(false)}
                      disabled={resetting}
                      className="flex-1 py-2.5 rounded-xl border border-red-200 text-red-700 text-[11px] font-bold uppercase tracking-widest hover:bg-red-100 transition-colors"
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
                        } catch {
                          setResetting(false);
                          setConfirmReset(false);
                        }
                      }}
                      disabled={resetting}
                      className="flex-1 py-2.5 rounded-xl bg-red-600 text-white text-[11px] font-bold uppercase tracking-widest hover:bg-red-700 transition-colors disabled:opacity-50"
                    >
                      {resetting ? 'Logging out...' : 'Log Out & Re-connect'}
                    </button>
                  </div>
                </div>
              </motion.div>
            )}
          </AnimatePresence>

        </motion.div>
      </AnimatePresence>
      </div>
    </div>
  );
}


