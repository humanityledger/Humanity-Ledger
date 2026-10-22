'use client';
import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';

interface LedgerPinLockScreenProps {
  onVerify: (pin: string) => Promise<boolean>;
  lockError: string | null;
  isSetupMode?: boolean;
  onSetup?: (pin: string) => Promise<boolean>;
}

export function LedgerPinLockScreen({
  onVerify,
  lockError,
  isSetupMode = false,
  onSetup,
}: LedgerPinLockScreenProps) {
  const [success, setSuccess] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(lockError);
  const [trying, setTrying] = useState(false);

  useEffect(() => {
    let active = true;

    const authenticate = async () => {
      // Guard: WebAuthn must be available
      if (typeof window === 'undefined' || !window.PublicKeyCredential) {
        setErrorMsg('Biometric authentication is not supported on this device.');
        return;
      }

      setTrying(true);
      try {
        const challenge = new Uint8Array(32);
        crypto.getRandomValues(challenge);

        if (isSetupMode && onSetup) {
          const cred = await navigator.credentials.create({
            publicKey: {
              challenge,
              rp: { name: 'Humanity Ledger', id: window.location.hostname },
              user: {
                id: new Uint8Array(16),
                name: 'user@humanityledger.com',
                displayName: 'Ledger User',
              },
              pubKeyCredParams: [
                { type: 'public-key', alg: -7 },
                { type: 'public-key', alg: -257 },
              ],
              authenticatorSelection: { userVerification: 'required' },
              timeout: 60000,
            },
          });
          if (cred && active) {
            setSuccess(true);
            await onSetup('BIOMETRIC_AUTH');
          }
        } else {
          const cred = await navigator.credentials.get({
            publicKey: {
              challenge,
              rpId: window.location.hostname,
              userVerification: 'required',
              timeout: 60000,
            },
          });
          if (cred && active) {
            setSuccess(true);
            await onVerify('BIOMETRIC_AUTH');
          }
        }
      } catch (err: any) {
        if (!active) return;
        const name = err?.name || '';
        if (name === 'NotAllowedError') {
          setErrorMsg('Authentication cancelled. Tap below to try again.');
        } else if (name === 'SecurityError') {
          setErrorMsg('Authentication unavailable on this connection. Use HTTPS.');
        } else {
          setErrorMsg('Authentication failed. Please try again.');
        }
      } finally {
        if (active) setTrying(false);
      }
    };

    // Brief delay so the screen renders before the system prompt appears
    const t = setTimeout(authenticate, 400);
    return () => { active = false; clearTimeout(t); };
  }, [isSetupMode, onSetup, onVerify]);

  if (success) {
    return (
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        className="fixed inset-0 z-[99999] bg-white flex flex-col items-center justify-center"
      >
        <motion.div
          initial={{ scale: 0 }}
          animate={{ scale: 1 }}
          transition={{ type: 'spring', stiffness: 300, damping: 25 }}
          className="w-16 h-16 bg-[#2754d6] rounded-full flex items-center justify-center mb-5 shadow-lg"
        >
          <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
            <polyline points="20 6 9 17 4 12"/>
          </svg>
        </motion.div>
        <h2 className="text-[22px] font-black text-[#1C1C1E] tracking-tight">Access granted</h2>
      </motion.div>
    );
  }

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      className="fixed inset-0 z-[99999] bg-[#FAFAFA] flex flex-col items-center justify-center p-8 select-none"
    >
      <motion.div
        initial={{ y: -16, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        transition={{ delay: 0.1 }}
        className="flex flex-col items-center text-center max-w-sm w-full"
      >
        {/* Icon */}
        <div className="w-20 h-20 rounded-full bg-black/[0.04] border border-black/[0.07] flex items-center justify-center mb-6">
          <svg width="34" height="34" viewBox="0 0 24 24" fill="none" stroke="#1C1C1E" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
            <path d="M5 3v4M3 5h4M6 17v4m-2-2h4m11-16v4m-2-2h4m-2 12v4m-2-2h4M9 9a3 3 0 1 0 6 0a3 3 0 0 0-6 0Z"/>
          </svg>
        </div>

        <h1 className="text-[24px] font-black text-[#1C1C1E] tracking-tight mb-3">
          {isSetupMode ? 'Set up biometric access' : 'Biometric verification'}
        </h1>
        <p className="text-[14px] text-black/45 font-medium leading-relaxed mb-8">
          {isSetupMode
            ? 'Register your biometrics to secure your Ledger Chat account.'
            : 'Use Face ID, fingerprint, or your device passkey to continue.'}
        </p>

        {/* Error */}
        <AnimatePresence>
          {errorMsg && (
            <motion.p
              initial={{ opacity: 0, y: -6 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0 }}
              className="text-[13px] text-red-500 font-semibold mb-6 px-4 py-3 bg-red-50 rounded-2xl border border-red-100 w-full text-center"
            >
              {errorMsg}
            </motion.p>
          )}
        </AnimatePresence>

        <button
          onClick={() => window.location.reload()}
          disabled={trying}
          className="w-full py-3.5 bg-[#1C1C1E] text-white rounded-2xl font-bold text-[14px] hover:bg-black active:scale-[0.97] transition-all disabled:opacity-50"
        >
          {trying ? 'Waiting for biometric...' : 'Try again'}
        </button>
      </motion.div>
    </motion.div>
  );
}
