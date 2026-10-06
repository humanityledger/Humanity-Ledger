import React, { useEffect, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';

export interface CallDetails {
  callerAddress: string;
  callerName?: string;
  callType: 'audio' | 'video';
  signalId?: string;
  [key: string]: any;
}

export function IncomingCallOverlay() {
  const [incomingCall, setIncomingCall] = useState<CallDetails | null>(null);

  useEffect(() => {
    const handleIncomingCall = (e: Event) => {
      const customEvent = e as CustomEvent<CallDetails>;
      setIncomingCall(customEvent.detail);
    };

    const handleClearCall = () => {
      setIncomingCall(null);
    };

    window.addEventListener('ledger_incoming_call_ui', handleIncomingCall);
    window.addEventListener('ledger_clear_call_ui', handleClearCall);

    return () => {
      window.removeEventListener('ledger_incoming_call_ui', handleIncomingCall);
      window.removeEventListener('ledger_clear_call_ui', handleClearCall);
    };
  }, []);

  useEffect(() => {
    if (incomingCall) {
      const timer = setTimeout(() => {
        handleDecline();
      }, 30000); // 30 seconds auto-dismiss
      return () => clearTimeout(timer);
    }
  }, [incomingCall]);

  const handleAnswer = () => {
    if (incomingCall) {
      const event = new CustomEvent('ledger_call_answered', { detail: incomingCall });
      window.dispatchEvent(event);
      setIncomingCall(null);
    }
  };

  const handleDecline = () => {
    if (incomingCall) {
      const event = new CustomEvent('ledger_call_declined', { detail: incomingCall });
      window.dispatchEvent(event);
      setIncomingCall(null);
    }
  };

  if (!incomingCall) return null;

  const getDisplayName = () => {
    if (incomingCall.callerName) return incomingCall.callerName;
    const addr = incomingCall.callerAddress;
    return addr ? `${addr.slice(0, 6)}...${addr.slice(-4)}` : 'Unknown Caller';
  };

  const getInitials = () => {
    if (incomingCall.callerName) return incomingCall.callerName.slice(0, 2).toUpperCase();
    const addr = incomingCall.callerAddress;
    return addr ? addr.slice(2, 4).toUpperCase() : '??';
  };

  const getHue = () => {
    const addr = incomingCall.callerAddress || '0x000000';
    return parseInt(addr.slice(2, 8), 16) % 360;
  };

  return (
    <AnimatePresence>
      {incomingCall && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/60 backdrop-blur-md"
        >
          <motion.div
            initial={{ scale: 0.9, opacity: 0, y: 20 }}
            animate={{ scale: 1, opacity: 1, y: 0 }}
            exit={{ scale: 0.9, opacity: 0, y: 20 }}
            className="bg-white rounded-3xl shadow-2xl p-8 flex flex-col items-center w-[320px] text-center"
          >
            {/* Avatar with haptic-style animation */}
            <div className="relative mb-6">
              <motion.div
                animate={{
                  scale: [1, 1.2, 1],
                  opacity: [0.5, 0, 0.5]
                }}
                transition={{
                  duration: 2,
                  repeat: Infinity,
                  ease: "easeInOut"
                }}
                className="absolute inset-0 rounded-full bg-[#25D366]/20"
                style={{ zIndex: -1 }}
              />
              <motion.div
                animate={{
                  scale: [1, 1.1, 1],
                }}
                transition={{
                  duration: 0.5,
                  repeat: Infinity,
                  repeatType: "reverse",
                }}
                className="w-24 h-24 rounded-full flex items-center justify-center text-3xl font-black text-white shadow-xl"
                style={{ background: `hsl(${getHue()}, 70%, 45%)` }}
              >
                {getInitials()}
              </motion.div>
            </div>

            <h2 className="text-2xl font-black text-black mb-1 truncate w-full">
              {getDisplayName()}
            </h2>
            <div className="bg-black/5 px-4 py-1.5 rounded-full mb-8">
              <span className="text-sm font-bold text-black/70">
                {incomingCall.callType === 'video' ? '📹 Video Call' : '🎙️ Voice Call'}
              </span>
            </div>

            <div className="flex items-center gap-6 w-full justify-center">
              <motion.button
                whileHover={{ scale: 1.05 }}
                whileTap={{ scale: 0.95 }}
                onClick={handleDecline}
                className="w-16 h-16 rounded-full bg-red-500 text-white flex items-center justify-center shadow-lg hover:bg-red-600 transition-colors"
              >
                <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M10.68 13.31a16 16 0 0 0 3.41 2.6l1.27-1.27a2 2 0 0 1 2.11-.45 12.84 12.84 0 0 0 2.81.7 2 2 0 0 1 1.72 2v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.42 19.42 0 0 1-3.33-2.67m-2.67-3.34a19.79 19.79 0 0 1-3.07-8.63A2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72 12.84 12.84 0 0 0 .7 2.81 2 2 0 0 1-.45 2.11L8.09 9.91"></path>
                  <line x1="23" y1="1" x2="1" y2="23"></line>
                </svg>
              </motion.button>

              <motion.button
                whileHover={{ scale: 1.05 }}
                whileTap={{ scale: 0.95 }}
                onClick={handleAnswer}
                className="w-16 h-16 rounded-full bg-green-500 text-white flex items-center justify-center shadow-lg hover:bg-green-600 transition-colors"
                style={{ animation: 'pulse 2s infinite' }}
              >
                <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6 19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72 12.84 12.84 0 0 0 .7 2.81 2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45 12.84 12.84 0 0 0 2.81.7A2 2 0 0 1 22 16.92z"></path>
                </svg>
              </motion.button>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}

