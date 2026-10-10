'use client';

import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';

interface PadlockLoaderProps {
  isInitializing: boolean;
  isWaitingForSignature: boolean;
  initError: string;
  onActivate: () => void;
  onClearAndRetry: () => void;
  onReconnect: () => void;
  onRefreshSession: () => void;
  onClearError: () => void;
}

// Open padlock path — shackle raised on left side
const PADLOCK_SHACKLE_OPEN = 'M 36 32 L 36 18 C 36 10 48 10 48 18 L 48 32';
// Closed padlock path — shackle fully arched and locked
const PADLOCK_SHACKLE_CLOSED = 'M 36 32 L 36 22 C 36 12 48 12 48 22 L 48 32';

export function PadlockLoader({
  isInitializing,
  isWaitingForSignature,
  initError,
  onActivate,
  onClearAndRetry,
  onReconnect,
  onRefreshSession,
  onClearError,
}: PadlockLoaderProps) {
  const [locking, setLocking] = useState(false);
  const [locked, setLocked] = useState(false);

  // When isInitializing kicks in, play the locking animation
  useEffect(() => {
    if (isInitializing && !locking) {
      setLocking(true);
      setTimeout(() => setLocked(true), 600);
    }
    if (!isInitializing) {
      setLocking(false);
      setLocked(false);
    }
  }, [isInitializing]);

  const handleActivate = () => {
    setLocking(true);
    setTimeout(() => setLocked(true), 550);
    setTimeout(() => onActivate(), 700);
  };

  const isLimitError = initError.toLowerCase().includes('limit') || initError.toLowerCase().includes('10/10');
  const isWalletError =
    initError.includes('wallet connection lost') ||
    initError.includes('Connect your wallet') ||
    initError.toLowerCase().includes('unknown signer');

  return (
    <div className="flex-1 flex flex-col h-full bg-white items-center justify-center p-6 relative overflow-hidden select-none">
      {/* Subtle radial glow behind the padlock */}
      <div
        className="absolute pointer-events-none"
        style={{
          width: 420,
          height: 420,
          borderRadius: '50%',
          background: 'radial-gradient(circle, rgba(37,211,102,0.10) 0%, transparent 70%)',
          top: '50%',
          left: '50%',
          transform: 'translate(-50%, -65%)',
        }}
      />

      {/* ── THE PADLOCK ── */}
      <motion.div
        className="relative flex items-center justify-center mb-12"
        animate={
          locking
            ? { scale: [1, 0.93, 1.04, 1], y: [0, 3, -2, 0] }
            : { scale: 1, y: 0 }
        }
        transition={{ duration: 0.55, ease: [0.22, 1, 0.36, 1] }}
      >
        {/* Green circle background */}
        <motion.div
          className="rounded-full flex items-center justify-center"
          animate={{
            boxShadow: locked
              ? '0 0 0 0px rgba(37,211,102,0), 0 24px 64px rgba(37,211,102,0.22)'
              : isInitializing
              ? [
                  '0 0 0 8px rgba(37,211,102,0.08), 0 24px 64px rgba(37,211,102,0.18)',
                  '0 0 0 20px rgba(37,211,102,0.04), 0 24px 64px rgba(37,211,102,0.22)',
                  '0 0 0 8px rgba(37,211,102,0.08), 0 24px 64px rgba(37,211,102,0.18)',
                ]
              : '0 0 0 0px rgba(37,211,102,0), 0 24px 64px rgba(37,211,102,0.12)',
            backgroundColor: initError ? '#FFF5F5' : '#25D366',
          }}
          transition={{
            boxShadow: { repeat: isInitializing && !locked ? Infinity : 0, duration: 2, ease: 'easeInOut' },
            backgroundColor: { duration: 0.4 },
          }}
          style={{ width: 148, height: 148 }}
        >
          {/* SVG Padlock */}
          <svg
            width="72"
            height="80"
            viewBox="0 0 84 96"
            fill="none"
            xmlns="http://www.w3.org/2000/svg"
          >
            {/* Shackle — animates from open to closed */}
            <motion.path
              d={locked ? PADLOCK_SHACKLE_CLOSED : PADLOCK_SHACKLE_OPEN}
              stroke={initError ? '#EF4444' : 'white'}
              strokeWidth="6"
              strokeLinecap="round"
              fill="none"
              animate={{ d: locked ? PADLOCK_SHACKLE_CLOSED : PADLOCK_SHACKLE_OPEN }}
              transition={{ duration: 0.4, ease: [0.22, 1, 0.36, 1] }}
            />
            {/* Lock body */}
            <motion.rect
              x="20"
              y="38"
              width="44"
              height="34"
              rx="8"
              fill={initError ? '#EF4444' : 'white'}
              animate={{ opacity: 1 }}
            />
            {/* Keyhole circle */}
            <circle cx="42" cy="56" r="5" fill={initError ? '#FFF5F5' : '#25D366'} />
            {/* Keyhole stem */}
            <rect x="39.5" y="56" width="5" height="7" rx="2" fill={initError ? '#FFF5F5' : '#25D366'} />
          </svg>
        </motion.div>

        {/* Initializing pulse ring */}
        <AnimatePresence>
          {isInitializing && !locked && (
            <motion.div
              key="pulse"
              className="absolute rounded-full border-2 border-[#25D366]/30"
              initial={{ width: 148, height: 148, opacity: 0.6 }}
              animate={{ width: 220, height: 220, opacity: 0 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 1.4, repeat: Infinity, ease: 'easeOut' }}
              style={{ top: '50%', left: '50%', transform: 'translate(-50%, -50%)' }}
            />
          )}
        </AnimatePresence>
      </motion.div>

      {/* ── CONTENT AREA ── */}
      <div className="w-full max-w-[320px] flex flex-col items-center gap-4 z-10">
        <AnimatePresence mode="wait">
          {/* ERROR STATE */}
          {initError ? (
            <motion.div
              key="error"
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              className="w-full flex flex-col gap-3"
            >
              <p className="text-[13px] text-[#EF4444] text-center leading-relaxed font-medium px-2">
                {initError}
              </p>
              {isLimitError ? (
                <>
                  <button
                    onClick={onClearAndRetry}
                    className="w-full py-4 bg-black text-white rounded-[18px] font-semibold text-[14px] active:scale-[0.98] transition-all"
                  >
                    Clear Cache & Retry
                  </button>
                  <button
                    onClick={() => { onClearError(); onActivate(); }}
                    className="w-full py-4 bg-white text-black rounded-[18px] border border-black/10 font-semibold text-[14px] active:scale-[0.98] transition-all"
                  >
                    Retry Without Clearing
                  </button>
                </>
              ) : isWalletError ? (
                <>
                  <button
                    onClick={onReconnect}
                    className="w-full py-4 bg-black text-white rounded-[18px] font-semibold text-[14px] active:scale-[0.98] transition-all"
                  >
                    Reconnect Wallet
                  </button>
                  <button
                    onClick={onRefreshSession}
                    className="w-full py-4 bg-white text-black rounded-[18px] border border-black/10 font-semibold text-[14px] active:scale-[0.98] transition-all"
                  >
                    Refresh Session
                  </button>
                </>
              ) : (
                <button
                  onClick={() => { onClearError(); handleActivate(); }}
                  className="w-full py-4 bg-black text-white rounded-[18px] font-semibold text-[14px] active:scale-[0.98] transition-all"
                >
                  Try Again
                </button>
              )}
            </motion.div>
          ) : isInitializing ? (
            /* LOCKING / INITIALIZING STATE */
            <motion.div
              key="initializing"
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              className="flex flex-col items-center gap-2"
            >
              {isWaitingForSignature ? (
                <p className="text-[14px] font-semibold text-[#25D366] text-center animate-pulse">
                  Check your wallet to sign
                </p>
              ) : (
                <p className="text-[13px] text-black/40 text-center font-medium">
                  Securing your channel…
                </p>
              )}
            </motion.div>
          ) : (
            /* IDLE — READY TO ENTER */
            <motion.div
              key="idle"
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              className="w-full flex flex-col items-center gap-5"
            >
              <div className="text-center">
                <p className="text-[22px] font-bold text-[#1C1C1E] tracking-tight">Ledger Chat</p>
                <p className="text-[14px] text-black/40 font-medium mt-1">End-to-end encrypted</p>
              </div>
              <motion.button
                onClick={handleActivate}
                whileHover={{ scale: 1.02 }}
                whileTap={{ scale: 0.97 }}
                className="w-full py-[18px] bg-[#25D366] text-white rounded-[20px] font-bold text-[16px] transition-all shadow-[0_12px_32px_rgba(37,211,102,0.28)] tracking-tight"
              >
                Enter Ledger Chat
              </motion.button>
              <p className="text-[11px] text-black/20 text-center font-mono uppercase tracking-widest">
                Zero‑knowledge · Non-custodial
              </p>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </div>
  );
}
