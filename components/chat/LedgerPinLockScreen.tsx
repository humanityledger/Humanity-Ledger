"use client";
import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';

interface LedgerPinLockScreenProps {
  onVerify: (pin: string) => Promise<boolean>;
  lockError: string | null;
  isSetupMode?: boolean;
  onSetup?: (pin: string) => Promise<boolean>;
}

// A helper to detect iOS
const isIOS = typeof navigator !== 'undefined' && (/iPad|iPhone|iPod/.test(navigator.userAgent) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1));

export function LedgerPinLockScreen({ onVerify, lockError, isSetupMode = false, onSetup }: LedgerPinLockScreenProps) {
  const [success, setSuccess] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(lockError);

  // We immediately prompt WebAuthn (Face ID / Windows Hello)
  useEffect(() => {
    let active = true;

    const authenticate = async () => {
      try {
        if (typeof window === 'undefined' || !window.PublicKeyCredential) {
          setErrorMsg('Biometria no soportada en este dispositivo.');
          return;
        }

        // Dummy challenge for local-only device bound authentication
        const challenge = new Uint8Array(32);
        crypto.getRandomValues(challenge);

        if (isSetupMode && onSetup) {
          // Register Passkey
          const cred = await navigator.credentials.create({
            publicKey: {
              challenge,
              rp: { name: "Humanity Ledger", id: window.location.hostname },
              user: {
                id: new Uint8Array(16),
                name: "usuario@humanityledger.com",
                displayName: "Usuario Ledger"
              },
              pubKeyCredParams: [{ type: "public-key", alg: -7 }, { type: "public-key", alg: -257 }],
              authenticatorSelection: { userVerification: "required" },
              timeout: 60000,
            }
          });
          
          if (cred && active) {
            setSuccess(true);
            // Pass a dummy PIN since we use biometrics
            await onSetup('BIOMETRIC_AUTH');
          }
        } else {
          // Verify Passkey
          const cred = await navigator.credentials.get({
            publicKey: {
              challenge,
              rpId: window.location.hostname,
              userVerification: "required",
              timeout: 60000,
            }
          });

          if (cred && active) {
            setSuccess(true);
            await onVerify('BIOMETRIC_AUTH');
          }
        }
      } catch (err: any) {
        if (active) {
          console.error(err);
          setErrorMsg('Autenticacion cancelada o fallida.');
        }
      }
    };

    // Delay slightly so the UI renders before the system prompt
    setTimeout(authenticate, 500);

    return () => { active = false; };
  }, [isSetupMode, onSetup, onVerify]);

  if (success) {
    return (
      <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="fixed inset-0 z-[99999] bg-white flex flex-col items-center justify-center">
        <motion.div initial={{ scale: 0 }} animate={{ scale: 1 }} transition={{ type: 'spring' }} className="w-20 h-20 bg-black rounded-full flex items-center justify-center mb-6 shadow-2xl">
          <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"><polyline points="20 6 9 17 4 12"/></svg>
        </motion.div>
        <h2 className="text-2xl font-black text-black tracking-tight" style={{ fontFamily: "var(--font-aztec-serif), Georgia, serif" }}>Acceso Autorizado</h2>
      </motion.div>
    );
  }

  return (
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="fixed inset-0 z-[99999] bg-[#FAFAFA] flex flex-col items-center justify-center p-8 select-none">
      <motion.div initial={{ y: -20, opacity: 0 }} animate={{ y: 0, opacity: 1 }} transition={{ delay: 0.1 }} className="mb-10 flex flex-col items-center gap-4 text-center max-w-sm">
        <div className="w-24 h-24 rounded-full bg-black/5 flex items-center justify-center shadow-inner border border-black/10 relative overflow-hidden">
          <div className="absolute inset-0 bg-gradient-to-tr from-[#25D366]/20 to-emerald-500/20 mix-blend-overlay" />
          <svg className="text-black/80" width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
            {isIOS ? (
              <path d="M5 3v4M3 5h4M6 17v4m-2-2h4m11-16v4m-2-2h4m-2 12v4m-2-2h4M9 9a3 3 0 1 0 6 0a3 3 0 0 0-6 0Z"/>
            ) : (
              <><rect x="3" y="11" width="18" height="11" rx="2" ry="2" /><path d="M7 11V7a5 5 0 0 1 10 0v4"/></>
            )}
          </svg>
        </div>
        <h1 className="text-[26px] font-black text-black tracking-tight mt-4" style={{ fontFamily: "var(--font-aztec-serif), Georgia, serif" }}>
          {isSetupMode ? 'Configurar Acceso Biometrico' : 'Autenticacion Requerida'}
        </h1>
        <p className="text-[15px] text-black/50 font-medium leading-relaxed">
          {isIOS ? 'Usa Face ID o una Passkey de Google para asegurar tu identidad en Ledger Chat.' : 'Usa Windows Hello o una Passkey de Google para asegurar tu identidad en Ledger Chat.'}
        </p>
      </motion.div>

      <AnimatePresence>
        {(errorMsg) && (
          <motion.p initial={{ opacity: 0, y: -5 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }} className="text-[14px] text-red-500 font-bold mb-8 text-center px-4 py-2 bg-red-50 rounded-lg border border-red-100">
            {errorMsg}
          </motion.p>
        )}
      </AnimatePresence>

      <button onClick={() => window.location.reload()} className="px-8 py-3.5 bg-black text-white rounded-full text-[14px] font-bold hover:bg-black/80 active:scale-95 transition-all shadow-[0_4px_15px_rgba(0,0,0,0.1)]">
        Reintentar Autenticacion
      </button>
    </motion.div>
  );
}

