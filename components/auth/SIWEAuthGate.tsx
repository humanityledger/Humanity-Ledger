"use client";

import React, { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { useAccount, useDisconnect } from "wagmi";
import {
  Shield,
  Fingerprint,
  CheckCircle2,
  AlertTriangle,
  Loader2,
  LogOut,
  Wallet,
  Zap,
  Lock,
} from "lucide-react";
import { useSIWE } from "@/hooks/useSIWE";
import { useAppKit } from "@reown/appkit/react";
import { toast } from "sonner";

interface SIWEAuthGateProps {
  children: React.ReactNode;
  /**
   * If true, shows inline authentication UI instead of a modal overlay.
   * Useful when embedding inside a landing/mobile page.
   */
  inline?: boolean;
  /**
   * Custom callback triggered after successful authentication
   */
  onAuthenticated?: (address: string) => void;
}

//  Status labels for cinematic UX 
const STATUS_LABELS: Record<string, string> = {
  idle: "AWAITING SIGNATURE",
  "pending-nonce": "FETCHING NONCE...",
  "pending-sign": "SIGN IN WALLET",
  "pending-verify": "VERIFYING ON-CHAIN...",
  authenticated: "Signed in",
  error: "AUTHENTICATION FAILED",
};

const STATUS_COLORS: Record<string, string> = {
  idle: "#6366f1",
  "pending-nonce": "#f59e0b",
  "pending-sign": "#3b82f6",
  "pending-verify": "#8b5cf6",
  authenticated: "#10b981",
  error: "#ef4444",
};

//  Cinematic SIWE Panel 
function SIWEPanel({
  onAuthenticated,
  inline = false,
}: {
  onAuthenticated?: (address: string) => void;
  inline?: boolean;
}) {
  const { address, isConnected } = useAccount();
  const { disconnect } = useDisconnect();
  const { open: openAppKit } = useAppKit();
  const { status, signIn, signOut, error, address: authedAddress } = useSIWE();

  const isPending = ["pending-nonce", "pending-sign", "pending-verify"].includes(status);
  const isAuthed = status === "authenticated";
  const color = STATUS_COLORS[status] || "#6366f1";

  useEffect(() => {
    if (isAuthed && authedAddress && onAuthenticated) {
      onAuthenticated(authedAddress);
    }
  }, [isAuthed, authedAddress, onAuthenticated]);

  const handleSignIn = async () => {
    const success = await signIn();
    if (success && authedAddress && onAuthenticated) {
      onAuthenticated(authedAddress);
    }
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 20, scale: 0.96 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      exit={{ opacity: 0, y: -20, scale: 0.96 }}
      transition={{ duration: 0.6, ease: [0.16, 1, 0.3, 1] }}
      className={`relative ${inline ? "w-full" : "w-full max-w-[420px] mx-auto"} rounded-[2.5rem] overflow-hidden`}
      style={{
        background: "rgba(255,255,255,0.96)",
        border: "1px solid rgba(0,0,0,0.08)",
        boxShadow: "0 40px 100px -20px rgba(0,0,0,0.25), 0 0 0 1px rgba(0,0,0,0.04)",
        backdropFilter: "blur(40px)",
      }}
    >
      {/* Glow orb */}
      <motion.div
        className="absolute -top-20 -right-20 w-48 h-48 rounded-full pointer-events-none"
        animate={{ opacity: [0.4, 0.7, 0.4], scale: [1, 1.1, 1] }}
        transition={{ duration: 3, repeat: Infinity, ease: "easeInOut" }}
        style={{ background: `radial-gradient(circle, ${color}30, transparent)` }}
      />

      <div className="p-8 md:p-10">
        {/* Header */}
        <div className="flex flex-col items-center text-center mb-8">
          <motion.div
            animate={{ rotate: isAuthed ? 0 : [0, 5, -5, 0] }}
            transition={{ duration: 2, repeat: isAuthed ? 0 : Infinity, ease: "easeInOut" }}
            className="w-16 h-16 rounded-[1.5rem] flex items-center justify-center mb-5"
            style={{
              background: `linear-gradient(135deg, ${color}20, ${color}08)`,
              border: `1px solid ${color}30`,
            }}
          >
            {isAuthed ? (
              <CheckCircle2 size={28} style={{ color }} />
            ) : status === "error" ? (
              <AlertTriangle size={28} style={{ color }} />
            ) : (
              <Fingerprint size={28} style={{ color }} />
            )}
          </motion.div>

          <span
            className="text-[9px] font-mono font-black uppercase tracking-[0.5em] mb-2"
            style={{ color: `${color}cc` }}
          >
            {STATUS_LABELS[status] || "SIWE"}
          </span>

          <h2 className="text-2xl font-black text-[#050505] tracking-tight leading-snug">
            {isAuthed ? "System Access" : "Authenticate Identity"}
          </h2>
          <p className="text-xs text-[#050505]/50 mt-2 leading-relaxed max-w-[280px]">
            {isAuthed
              ? `Session active for ${authedAddress?.slice(0, 6)}...${authedAddress?.slice(-4)}`
              : "Sign a cryptographic message to prove wallet ownership. No fees. No transaction."}
          </p>
        </div>

        {/* Wallet info chip */}
        {isConnected && address && (
          <div
            className="flex items-center gap-3 px-4 py-3 rounded-2xl mb-6"
            style={{
              background: "rgba(5,5,5,0.04)",
              border: "1px solid rgba(5,5,5,0.08)",
            }}
          >
            <div
              className="w-8 h-8 rounded-full flex items-center justify-center shrink-0"
              style={{ background: `${color}15` }}
            >
              <Wallet size={14} style={{ color }} />
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-[10px] font-black uppercase tracking-widest text-[#050505]/40">
                Connected Wallet
              </p>
              <p className="text-[12px] font-mono font-bold text-[#050505] truncate">
                {address ? `${address.slice(0, 10)}...${address.slice(-6)}` : 'Connecting...'}
              </p>
            </div>
            {!isAuthed && (
              <button
                onClick={() => disconnect()}
                className="p-1.5 rounded-lg opacity-40 hover:opacity-70 transition-opacity"
              >
                <LogOut size={12} className="text-[#050505]" />
              </button>
            )}
          </div>
        )}

        {/* Error message */}
        <AnimatePresence>
          {error && status === "error" && (
            <motion.div
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: "auto" }}
              exit={{ opacity: 0, height: 0 }}
              className="mb-5 px-4 py-3 rounded-2xl flex items-center gap-3"
              style={{ background: "rgba(239,68,68,0.06)", border: "1px solid rgba(239,68,68,0.15)" }}
            >
              <AlertTriangle size={14} className="text-red-500 shrink-0" />
              <p className="text-[11px] font-bold text-red-600 leading-relaxed">{error}</p>
            </motion.div>
          )}
        </AnimatePresence>

        {/* CTA Button */}
        {!isAuthed ? (
          <div className="flex flex-col gap-3">
            {/* Premium Frictionless WebAuthn */}
            <motion.button
              onClick={async () => {
                try {
                  toast.loading('Authenticating via FaceID / Passkey...', { id: 'webauthn' });
                  const res = await fetch('/api/premium/webauthn', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ action: 'authenticate' })
                  });
                  if (!res.ok) throw new Error('Biometrics Failed');
                  toast.success('Premium Passkey Auth Success!', { id: 'webauthn' });
                  if (onAuthenticated && address) onAuthenticated(address);
                } catch (e) {
                  toast.error('Passkey failed. Fallback to Wallet SIWE.', { id: 'webauthn' });
                }
              }}
              disabled={isPending || !isConnected}
              whileHover={{ scale: isPending ? 1 : 1.03 }}
              whileTap={{ scale: 0.97 }}
              className="w-full h-[56px] rounded-[1.5rem] flex items-center justify-center gap-3 font-black uppercase tracking-[0.2em] text-[10px] transition-all relative overflow-hidden"
              style={{
                background: "linear-gradient(135deg, #f0f0f0, #e0e0e0)",
                color: "#050505",
                border: "1px solid rgba(0,0,0,0.1)",
                cursor: isPending || !isConnected ? "not-allowed" : "pointer",
              }}
            >
              <Fingerprint size={16} className="opacity-80" />
              USE PASSKEY / FACE ID
              <span className="absolute top-1 right-2 text-[8px] bg-white text-white px-2 py-0.5 rounded-full">PRO</span>
            </motion.button>

            {/* Standard SIWE Auth */}
            <motion.button
              onClick={!isConnected ? () => openAppKit() : handleSignIn}
              disabled={isPending}
              whileHover={{ scale: isPending ? 1 : 1.03 }}
              whileTap={{ scale: 0.97 }}
              className="w-full h-[64px] rounded-[1.5rem] flex items-center justify-center gap-3 font-black uppercase tracking-[0.2em] text-[11px] transition-all"
              style={{
                background: isPending
                  ? "rgba(5,5,5,0.08)"
                  : `linear-gradient(135deg, #050505, #1a1a2e)`,
                color: isPending ? "rgba(5,5,5,0.3)" : "#ffffff",
                border: `1px solid ${isPending ? "transparent" : "transparent"}`,
                boxShadow: isPending ? "none" : "0 20px 50px -10px rgba(0,0,0,0.4)",
                cursor: isPending ? "not-allowed" : "pointer",
              }}
            >
              {isPending ? (
                <>
                  <Loader2 size={16} className="animate-spin opacity-60" />
                  <span style={{ color: "rgba(5,5,5,0.5)" }}>
                    {STATUS_LABELS[status]}
                  </span>
                </>
              ) : !isConnected ? (
                <>
                  <Wallet size={16} className="opacity-80" />
                  CONNECT WALLET
                </>
              ) : (
                <>
                  <Lock size={16} className="opacity-80" />
                  SIGN & AUTHENTICATE
                </>
              )}
            </motion.button>
          </div>
        ) : (
          <motion.button
            onClick={signOut}
            whileHover={{ scale: 1.02 }}
            whileTap={{ scale: 0.97 }}
            className="w-full h-[56px] rounded-[1.5rem] flex items-center justify-center gap-3 font-black uppercase tracking-[0.25em] text-[10px]"
            style={{
              background: "rgba(239,68,68,0.06)",
              border: "1px solid rgba(239,68,68,0.15)",
              color: "#ef4444",
            }}
          >
            <LogOut size={14} />
            Terminate Session
          </motion.button>
        )}

        {/* Info footer */}
        <div className="flex items-center gap-2 mt-5 justify-center">
          <Shield size={10} className="text-[#050505]/20" />
          <span className="text-[9px] font-mono text-[#050505]/30 uppercase tracking-widest">
            EIP-191 · No transaction · No gas
          </span>
          <Zap size={10} className="text-[#050505]/20" />
        </div>
      </div>
    </motion.div>
  );
}

//  Main Gate 

/**
 * SIWEAuthGate
 * 
 * Wraps content requiring SIWE authentication.
 * Detects existing session via `wallet-auth` cookie and auto-unlocks.
 * Otherwise shows a cinematic sign-in panel.
 */
export function SIWEAuthGate({ children, inline = false, onAuthenticated }: SIWEAuthGateProps) {
  const { isConnected } = useAccount();
  const [isVerified, setIsVerified] = useState(() => {
    // Check for existing session cookie on mount
    if (typeof document === "undefined") return false;
    return document.cookie.includes("wallet-auth=") || document.cookie.includes("system_handshake=");
  });

  const handleAuthenticated = (address: string) => {
    setIsVerified(true);
    onAuthenticated?.(address);
  };

  if (isVerified) {
    return <>{children}</>;
  }

  if (inline) {
    return (
      <SIWEPanel inline onAuthenticated={handleAuthenticated} />
    );
  }

  return (
    <AnimatePresence>
      <motion.div
        key="siwe-gate-overlay"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        className="fixed inset-0 z-[9999] flex items-center justify-center p-4"
        style={{
          background: "rgba(250,249,246,0.85)",
          backdropFilter: "blur(40px)",
        }}
      >
        <SIWEPanel onAuthenticated={handleAuthenticated} />
      </motion.div>
    </AnimatePresence>
  );
}

export { SIWEPanel };
