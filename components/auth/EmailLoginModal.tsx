"use client";

import React, { useState, useRef, useEffect } from "react";
import { createPortal } from "react-dom";
import { motion, AnimatePresence } from "framer-motion";

interface Props {
  isOpen: boolean;
  onClose: () => void;
  /** Called once the user is successfully authenticated via email OTP */
  onSuccess?: () => void;
}

type Step = "email" | "code" | "success";

const FADE: any = {
  hidden: { opacity: 0, y: 12 },
  visible: { opacity: 1, y: 0, transition: { duration: 0.32, ease: [0.22, 1, 0.36, 1] } },
  exit: { opacity: 0, y: -8, transition: { duration: 0.2 } },
};

export function EmailLoginModal({ isOpen, onClose, onSuccess }: Props) {
  const [step, setStep] = useState<Step>("email");
  const [email, setEmail] = useState("");
  const [code, setCode] = useState(["", "", "", "", "", ""]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [countdown, setCountdown] = useState(0);
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  const codeRefs = useRef<(HTMLInputElement | null)[]>([]);

  // Reset state when modal opens
  useEffect(() => {
    if (isOpen) {
      setStep("email");
      setEmail("");
      setCode(["", "", "", "", "", ""]);
      setError("");
      setLoading(false);
      setCountdown(0);
    }
  }, [isOpen]);

  // Countdown timer for resend
  useEffect(() => {
    if (countdown <= 0) return;
    const t = setTimeout(() => setCountdown((c) => c - 1), 1000);
    return () => clearTimeout(t);
  }, [countdown]);

  // Auto-focus first code input when step changes
  useEffect(() => {
    if (step === "code") {
      setTimeout(() => codeRefs.current[0]?.focus({ preventScroll: true }), 100);
    }
  }, [step]);

  async function handleSendCode(e: React.FormEvent) {
    e.preventDefault();
    if (!email || !email.includes("@")) {
      setError("Please enter a valid email address.");
      return;
    }
    setError("");
    setLoading(true);
    try {
      const res = await fetch("/api/auth/send-code", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to send code");
      setStep("code");
      setCountdown(60);
    } catch (err: any) {
      setError(err.message || "Failed to send verification code.");
    } finally {
      setLoading(false);
    }
  }

  async function handleVerifyCode(e: React.FormEvent) {
    e.preventDefault();
    const fullCode = code.join("");
    if (fullCode.length !== 6) {
      setError("Please enter all 6 digits.");
      return;
    }
    setError("");
    setLoading(true);
    try {
      const res = await fetch("/api/auth/verify-code", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, code: fullCode, isLogin: true }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Invalid code");
      setStep("success");

      // CLEAR DISCONNECT GUARD SO THE USER CAN ACTUALLY ENTER THE APP
      try { sessionStorage.removeItem("__disconnected__"); } catch {}
      try { localStorage.removeItem("__disconnected__"); } catch {}

      setTimeout(async () => {
        // Heal the system_handshake cookie so the gate detects auth state
        try {
          await fetch('/api/auth/session-heal', { credentials: 'include', cache: 'no-store' });
        } catch {}
        onSuccess?.();
        onClose();
        // Redirect to the authenticated terminal, not the public landing
        window.location.replace("/chat");
      }, 1800);
    } catch (err: any) {
      setError(err.message || "Invalid or expired code.");
      setCode(["", "", "", "", "", ""]);
      codeRefs.current[0]?.focus({ preventScroll: true });
    } finally {
      setLoading(false);
    }
  }

  function handleCodeInput(index: number, value: string) {
    const char = value.replace(/\D/g, "").slice(-1);
    const newCode = [...code];
    newCode[index] = char;
    setCode(newCode);
    if (char && index < 5) {
      codeRefs.current[index + 1]?.focus({ preventScroll: true });
    }
    if (!char && index > 0) {
      codeRefs.current[index - 1]?.focus({ preventScroll: true });
    }
  }

  function handleCodeKeyDown(index: number, e: React.KeyboardEvent) {
    if (e.key === "Backspace" && !code[index] && index > 0) {
      codeRefs.current[index - 1]?.focus({ preventScroll: true });
    }
  }

  function handleCodePaste(e: React.ClipboardEvent) {
    e.preventDefault();
    const pasted = e.clipboardData.getData("text").replace(/\D/g, "").slice(0, 6);
    if (pasted.length > 0) {
      const newCode = [...code];
      for (let i = 0; i < 6; i++) newCode[i] = pasted[i] || "";
      setCode(newCode);
      codeRefs.current[Math.min(pasted.length, 5)]?.focus({ preventScroll: true });
    }
  }

  async function handleResend() {
    if (countdown > 0) return;
    setError("");
    setLoading(true);
    try {
      const res = await fetch("/api/auth/send-code", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email }),
      });
      if (!res.ok) throw new Error("Failed to resend");
      setCode(["", "", "", "", "", ""]);
      setCountdown(60);
      codeRefs.current[0]?.focus({ preventScroll: true });
    } catch (err: any) {
      setError("Failed to resend. Please try again.");
    } finally {
      setLoading(false);
    }
  }

  if (!mounted) return null;

  // Use a portal so the modal always renders on top of everything,
  // including fixed/stacked parents. Guarded by `mounted` above so this
  // only runs client-side — safe for SSR + iOS Safari.
  const modalContent = (
    <AnimatePresence>
      {isOpen && (
        <motion.div
          key="modal-container"
          className="fixed inset-0 z-[9000] flex items-center justify-center p-3 sm:p-4 overflow-y-auto overflow-x-hidden select-none"
        >
          {/* Backdrop */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.2 }}
            className="fixed inset-0 bg-black/30 backdrop-blur-sm -z-10"
            onClick={onClose}
          />

          {/* Modal Panel */}
          <motion.div
            initial={{ opacity: 0, scale: 0.97, y: 16 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.97, y: 16 }}
            transition={{ duration: 0.28, ease: [0.22, 1, 0.36, 1] }}
            className="w-full max-w-[420px] bg-white border border-black/10 shadow-2xl rounded-2xl relative z-10 max-h-[90vh] overflow-y-auto overflow-x-hidden my-auto"
            style={{ paddingBottom: 'env(safe-area-inset-bottom, 0px)' }}
            onClick={(e) => e.stopPropagation()}
          >
            {/* Header */}
            <div className="px-6 sm:px-7 pt-7 pb-5 border-b border-black/8">
                <div className="flex items-start justify-between">
                    <div className="pr-2 min-w-0 flex-1">
                      <div className="flex items-center gap-2 mb-2.5">
                        <img
                          src="/logo-mark.png"
                          alt="Humanity Ledger"
                          className="w-5 h-5 object-contain shrink-0"
                        />
                        <span className="text-[11px] font-black uppercase tracking-[0.2em] text-black/40 truncate">
                          Humanity Ledger
                        </span>
                      </div>
                    <h2 className="text-[20px] sm:text-[22px] font-black tracking-tight text-black leading-tight">
                      {step === "email" && "Sign in with Email"}
                      {step === "code" && "Check your inbox"}
                      {step === "success" && "You are in"}
                    </h2>
                    <p className="text-[13px] text-black/55 font-medium mt-1.5 break-words max-w-full">
                      {step === "email" && "No password needed. We will send you a secure 6 digit code."}
                      {step === "code" && (
                        <span className="block break-words">
                          We sent a 6 digit code to{" "}
                          <span className="font-semibold text-black/85 break-all underline decoration-black/20">{email}</span>
                        </span>
                      )}
                      {step === "success" && "Authentication complete. Redirecting you now..."}
                    </p>
                  </div>
                  <button
                    onClick={onClose}
                    className="w-8 h-8 flex items-center justify-center text-black/35 hover:text-black/70 transition-colors shrink-0 -mt-1 -mr-1"
                    aria-label="Close"
                  >
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
                      <path d="M18 6L6 18M6 6l12 12" />
                    </svg>
                  </button>
                </div>
              </div>

              {/* Body */}
              <div className="px-6 sm:px-7 py-6">
                <AnimatePresence mode="wait">
                  {/* ── Step 1: Email input ── */}
                  {step === "email" && (
                    <motion.form
                      key="email-step"
                      variants={FADE}
                      initial="hidden"
                      animate="visible"
                      exit="exit"
                      onSubmit={handleSendCode}
                      className="flex flex-col gap-4"
                    >
                      <div>
                        <label className="block text-[11px] font-bold uppercase tracking-wider text-black/50 mb-2">
                          Email Address
                        </label>
                        <input
                          type="email"
                          value={email}
                          onChange={(e) => setEmail(e.target.value)}
                          placeholder="you@example.com"
                          autoFocus
                          required
                          className="w-full px-4 py-3 border border-black/15 text-[15px] font-medium text-black placeholder-black/30 focus:outline-none focus:border-black/50 transition-colors bg-white rounded-xl"
                        />
                      </div>

                      {error && (
                        <p className="text-[12.5px] text-red-600 font-medium">{error}</p>
                      )}

                      <button
                        type="submit"
                        disabled={loading}
                        className="w-full py-3.5 bg-black text-white text-[14px] font-bold tracking-wide hover:bg-black/85 active:scale-[0.99] transition-all disabled:opacity-50 flex items-center justify-center gap-2 rounded-xl"
                      >
                        {loading ? (
                          <>
                            <svg className="w-4 h-4 animate-spin" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="12" cy="12" r="10" strokeOpacity="0.3"/><path d="M12 2a10 10 0 0 1 10 10"/></svg>
                            Sending…
                          </>
                        ) : (
                          <>
                            Continue
                            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M5 12h14M12 5l7 7-7 7"/></svg>
                          </>
                        )}
                      </button>

                      <p className="text-[12px] text-black/40 font-medium text-center leading-relaxed">
                        By continuing, you agree to our{" "}
                        <a href="/legal/terms" className="underline hover:text-black/70 transition-colors">Terms</a>
                        {" "}and{" "}
                        <a href="/legal/privacy" className="underline hover:text-black/70 transition-colors">Privacy Policy</a>.
                      </p>
                    </motion.form>
                  )}

                  {/* ── Step 2: OTP Code ── */}
                  {step === "code" && (
                    <motion.form
                      key="code-step"
                      variants={FADE}
                      initial="hidden"
                      animate="visible"
                      exit="exit"
                      onSubmit={handleVerifyCode}
                      className="flex flex-col gap-5 w-full"
                    >
                      {/* 6 digit boxes */}
                      <div className="w-full">
                        <label className="block text-[11px] font-bold uppercase tracking-wider text-black/50 mb-3 text-center sm:text-left">
                          Verification Code
                        </label>
                        <div className="flex gap-1.5 sm:gap-2 w-full justify-between items-center max-w-full">
                          {code.map((digit, i) => (
                            <input
                              key={i}
                              ref={(el) => { codeRefs.current[i] = el; }}
                              type="text"
                              inputMode="numeric"
                              pattern="[0-9]*"
                              maxLength={1}
                              value={digit}
                              onChange={(e) => handleCodeInput(i, e.target.value)}
                              onKeyDown={(e) => handleCodeKeyDown(i, e)}
                              onPaste={i === 0 ? handleCodePaste : undefined}
                              className="w-10 sm:w-12 h-12 sm:h-14 min-w-0 flex-1 max-w-[50px] aspect-square text-center text-[20px] sm:text-[22px] font-black text-black border border-black/15 focus:border-black focus:ring-2 focus:ring-black/5 focus:outline-none transition-all bg-white tabular-nums rounded-xl"
                            />
                          ))}
                        </div>
                      </div>

                      {error && (
                        <p className="text-[12.5px] text-red-600 font-medium text-center">{error}</p>
                      )}

                      <button
                        type="submit"
                        disabled={loading || code.join("").length < 6}
                        className="w-full py-3.5 bg-black text-white text-[14px] font-bold tracking-wide hover:bg-black/85 active:scale-[0.99] transition-all disabled:opacity-40 flex items-center justify-center gap-2 rounded-xl"
                      >
                        {loading ? (
                          <>
                            <svg className="w-4 h-4 animate-spin" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="12" cy="12" r="10" strokeOpacity="0.3"/><path d="M12 2a10 10 0 0 1 10 10"/></svg>
                            Verifying…
                          </>
                        ) : (
                          "Verify and Sign In"
                        )}
                      </button>

                      <div className="flex items-center justify-between pt-1">
                        <button
                          type="button"
                          onClick={() => { setStep("email"); setError(""); setCode(["","","","","",""]); }}
                          className="text-[12.5px] font-medium text-black/45 hover:text-black/70 transition-colors"
                        >
                          Change email
                        </button>
                        <button
                          type="button"
                          onClick={handleResend}
                          disabled={countdown > 0 || loading}
                          className="text-[12.5px] font-semibold text-black/65 hover:text-black transition-colors disabled:opacity-40"
                        >
                          {countdown > 0 ? `Resend in ${countdown}s` : "Resend code"}
                        </button>
                      </div>
                    </motion.form>
                  )}

                  {/* ── Step 3: Success ── */}
                  {step === "success" && (
                    <motion.div
                      key="success-step"
                      variants={FADE}
                      initial="hidden"
                      animate="visible"
                      exit="exit"
                      className="flex flex-col items-center py-4 gap-4"
                    >
                      <motion.div
                        initial={{ scale: 0.5, opacity: 0 }}
                        animate={{ scale: 1, opacity: 1 }}
                        transition={{ type: "spring", stiffness: 200, damping: 14 }}
                        className="w-14 h-14 border-2 border-black flex items-center justify-center"
                      >
                        <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                          <polyline points="20 6 9 17 4 12" />
                        </svg>
                      </motion.div>
                      <p className="text-[14px] font-semibold text-black/60 text-center">
                        Identity verified. Preparing your session…
                      </p>
                    </motion.div>
                  )}
                </AnimatePresence>
                </div>
            </motion.div>
          </motion.div>
      )}
    </AnimatePresence>
  );

  return createPortal(modalContent, document.body);
}
