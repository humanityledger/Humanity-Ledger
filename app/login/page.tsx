"use client";

import { useEffect, useState, useCallback, useRef } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import Link from "next/link";
import { Mail, ArrowRight, ArrowLeft, Loader2, Lock, RefreshCw } from "lucide-react";

import { safeReturnPath } from "@/lib/security/safeRedirect";
// ─────────────────────────────────────────────────────────────────────────────
// LOGIN PAGE — Email OTP flow
//
// Flow for ALL users (new + existing):
//   1. User enters email → POST /api/auth/send-code (creates AuthUser if needed, sends 6-digit code)
//   2. User enters 6-digit code → POST /api/auth/verify-code (validates, issues JWT cookies)
//   3. On success → redirect to /portfolio (or returnUrl)
//
// New users are redirected to /sign-up after code verification so they can
// set a username + password and generate their internal wallet.
// ─────────────────────────────────────────────────────────────────────────────

type Step = "email" | "code" | "done";

const RESEND_COOLDOWN_SECS = 60;

export default function LoginPage() {
  const router = useRouter();
  const [mounted, setMounted] = useState(false);
  const [step, setStep] = useState<Step>("email");

  // Form state
  const [email, setEmail] = useState("");
  const [code, setCode] = useState("");
  const [isNewUser, setIsNewUser] = useState(false);
  const [loading, setLoading] = useState(false);

  // Resend cooldown
  const [resendCooldown, setResendCooldown] = useState(0);
  const cooldownRef = useRef<NodeJS.Timeout | null>(null);

  useEffect(() => {
    setMounted(true);
    return () => { if (cooldownRef.current) clearInterval(cooldownRef.current); };
  }, []);

  // ── Redirect helper ──────────────────────────────────────────────────────
  const redirect = useCallback(() => {
    const params = new URLSearchParams(window.location.search);
    // "//host" and "/\host" passed the old startsWith("/") check and left the site.
    const returnUrl = safeReturnPath(params.get("returnUrl") || params.get("redirect_url"), "");
    if (returnUrl && !returnUrl.startsWith("/connect")) {
      window.location.replace(returnUrl);
    } else {
      window.location.replace("/portfolio");
    }
  }, []);

  // ── Start cooldown timer ─────────────────────────────────────────────────
  const startCooldown = useCallback(() => {
    setResendCooldown(RESEND_COOLDOWN_SECS);
    if (cooldownRef.current) clearInterval(cooldownRef.current);
    cooldownRef.current = setInterval(() => {
      setResendCooldown(prev => {
        if (prev <= 1) {
          clearInterval(cooldownRef.current!);
          return 0;
        }
        return prev - 1;
      });
    }, 1000);
  }, []);

  // ── Step 1: Submit email → send OTP ─────────────────────────────────────
  const handleEmailSubmit = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    const trimmedEmail = email.trim().toLowerCase();
    if (!trimmedEmail || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(trimmedEmail)) {
      toast.error("Introduce un email válido");
      return;
    }

    setLoading(true);
    try {
      // Check if user exists (to show correct messaging)
      const checkRes = await fetch("/api/auth/check-email", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: trimmedEmail }),
      });
      const checkData = await checkRes.json();
      const existsAndVerified = checkData.exists && !checkData.requiresVerification;
      setIsNewUser(!existsAndVerified);

      // Send verification code (always)
      const res = await fetch("/api/auth/send-code", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: trimmedEmail }),
      });
      const data = await res.json();

      if (!res.ok) {
        toast.error(data.error || "Error al send el código");
        return;
      }

      setStep("code");
      startCooldown();
      toast.success("Código enviado", {
        description: `Revisa tu email: ${trimmedEmail}`,
      });
    } catch {
      toast.error("Error de red. Inténtalo de nuevo.");
    } finally {
      setLoading(false);
    }
  };

  // ── Step 2: Verify OTP code ──────────────────────────────────────────────
  const handleCodeSubmit = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (code.length !== 6 || !/^\d{6}$/.test(code)) {
      toast.error("Introduce el código de 6 dígitos");
      return;
    }

    setLoading(true);
    try {
      const res = await fetch("/api/auth/verify-code", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: email.trim().toLowerCase(), code }),
      });
      const data = await res.json();

      if (!res.ok) {
        toast.error(data.error || "Código inválido o expirado");
        return;
      }

      // JWT cookies set by server. Now redirect.
      setStep("done");
      toast.success(isNewUser ? "¡Welcome! Completa tu perfil." : "¡Welcome de vuelta!", {
        duration: 2000,
      });

      // New users: go to sign-up to set username + password + wallet
      // Existing users: go to portfolio (or returnUrl)
      setTimeout(() => {
        if (isNewUser) {
          router.replace("/sign-up");
        } else {
          redirect();
        }
      }, 800);
    } catch {
      toast.error("Error de red. Inténtalo de nuevo.");
    } finally {
      setLoading(false);
    }
  };

  // ── Resend code ──────────────────────────────────────────────────────────
  const handleResend = async () => {
    if (resendCooldown > 0) return;
    await handleEmailSubmit();
  };

  // ── Auto-submit when 6 digits entered ───────────────────────────────────
  const handleCodeChange = (val: string) => {
    const clean = val.replace(/\D/g, "").slice(0, 6);
    setCode(clean);
    if (clean.length === 6 && step === "code") {
      // Small delay so user sees the 6th digit before submission
      setTimeout(() => handleCodeSubmit(), 150);
    }
  };

  if (!mounted) return null;

  return (
    <div
      className="relative min-h-screen bg-white flex items-center justify-center p-4 selection:bg-black selection:text-white"
      style={{ fontFamily: "'Inter', sans-serif" }}
    >
      {/* Dot grid background */}
      <div className="fixed inset-0 z-0 pointer-events-none opacity-30"
        style={{
          backgroundImage: "radial-gradient(#d1d5db 1px, transparent 1px)",
          backgroundSize: "24px 24px",
        }}
      />

      {/* Card */}
      <div className="relative z-10 w-full max-w-[420px]">
        {/* Logo / Brand */}
        <div className="flex flex-col items-center mb-8">
          <div className="w-12 h-12 bg-black rounded-2xl flex items-center justify-center mb-4 shadow-lg">
            <Lock size={24} className="text-white" />
          </div>
          <h1 className="text-2xl font-black uppercase tracking-tight text-black text-center">
            Humanity Ledger
          </h1>
          <p className="text-xs font-mono text-black/40 uppercase tracking-widest mt-1 text-center">
            Acceso Seguro · Email OTP
          </p>
        </div>

        {/* ─── STEP: EMAIL ─────────────────────────────────────────────── */}
        {step === "email" && (
          <form
            onSubmit={handleEmailSubmit}
            className="bg-white border-[2.5px] border-black shadow-[6px_6px_0px_0px_rgba(0,0,0,1)] p-8 flex flex-col gap-5"
          >
            <div>
              <label className="block text-[10px] font-black uppercase tracking-widest text-black/50 mb-2">
                Tu Email
              </label>
              <div className="relative">
                <input
                  type="email"
                  autoFocus
                  required
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  onKeyDown={(e) => e.key === "Enter" && handleEmailSubmit()}
                  placeholder="tu@email.com"
                  className="w-full border-[2px] border-black bg-white px-4 py-3 text-black font-mono text-sm placeholder:text-black/30 focus:outline-none focus:bg-black/[0.02] transition-colors pr-12"
                  disabled={loading}
                />
                <Mail size={16} className="absolute right-4 top-1/2 -translate-y-1/2 text-black/30" />
              </div>
              <p className="mt-2 text-[10px] font-mono text-black/35 uppercase tracking-wider">
                Recibirás un código de 6 dígitos • Válido 5 min
              </p>
            </div>

            <button
              type="submit"
              disabled={loading || !email.trim()}
              className="bg-black text-white font-black uppercase tracking-widest text-sm py-4 flex items-center justify-center gap-2 hover:bg-black/85 active:scale-[0.98] transition-all disabled:opacity-50 disabled:cursor-not-allowed border-[2px] border-black"
            >
              {loading ? (
                <Loader2 size={18} className="animate-spin" />
              ) : (
                <>send Código <ArrowRight size={16} /></>
              )}
            </button>

            <div className="flex items-center gap-3">
              <div className="flex-1 h-px bg-black/10" />
              <span className="text-[10px] font-mono text-black/30 uppercase tracking-widest">o</span>
              <div className="flex-1 h-px bg-black/10" />
            </div>

            <Link
              href="/connect"
              className="border-[2px] border-black text-black font-black uppercase tracking-widest text-xs py-3 flex items-center justify-center gap-2 hover:bg-black hover:text-white transition-all text-center"
            >
              Conectar con WalletConnect
            </Link>

            <p className="text-center text-[10px] font-mono text-black/30 uppercase tracking-wider">
              ¿Primera vez?{" "}
              <Link href="/sign-up" className="underline hover:text-black transition-colors">
                Crear cuenta
              </Link>
            </p>
          </form>
        )}

        {/* ─── STEP: CODE ──────────────────────────────────────────────── */}
        {step === "code" && (
          <div className="bg-white border-[2.5px] border-black shadow-[6px_6px_0px_0px_rgba(0,0,0,1)] p-8 flex flex-col gap-6">
            {/* Header */}
            <div className="flex flex-col items-center gap-1 text-center">
              <div className="w-10 h-10 border-[2px] border-black flex items-center justify-center mb-2">
                <Mail size={20} className="text-black" />
              </div>
              <p className="font-black text-black uppercase tracking-tight text-base">
                Revisa tu email
              </p>
              <p className="text-xs font-mono text-black/50">
                Código enviado a <span className="font-bold text-black">{email}</span>
              </p>
            </div>

            {/* Code Input */}
            <form onSubmit={handleCodeSubmit} className="flex flex-col gap-5">
              <div>
                <label className="block text-[10px] font-black uppercase tracking-widest text-black/50 mb-2">
                  Código de 6 dígitos
                </label>
                <input
                  type="text"
                  inputMode="numeric"
                  autoFocus
                  maxLength={6}
                  value={code}
                  onChange={(e) => handleCodeChange(e.target.value)}
                  placeholder="000000"
                  className="w-full border-[2px] border-black bg-white px-4 py-4 text-black font-mono text-2xl tracking-[0.6em] text-center placeholder:text-black/20 focus:outline-none focus:bg-black/[0.02] transition-colors"
                  disabled={loading}
                />
                <p className="mt-2 text-[10px] font-mono text-black/35 uppercase tracking-wider text-center">
                  El código expira en 5 minutos
                </p>
              </div>

              <button
                type="submit"
                disabled={loading || code.length !== 6}
                className="bg-black text-white font-black uppercase tracking-widest text-sm py-4 flex items-center justify-center gap-2 hover:bg-black/85 active:scale-[0.98] transition-all disabled:opacity-50 disabled:cursor-not-allowed border-[2px] border-black"
              >
                {loading ? (
                  <Loader2 size={18} className="animate-spin" />
                ) : (
                  <>Verificar y Acceder <Lock size={16} /></>
                )}
              </button>
            </form>

            {/* Resend + Back */}
            <div className="flex flex-col gap-2">
              <button
                onClick={handleResend}
                disabled={resendCooldown > 0 || loading}
                className="w-full text-[11px] font-mono text-black/40 uppercase tracking-widest hover:text-black transition-colors disabled:opacity-40 disabled:cursor-not-allowed flex items-center justify-center gap-2 py-2"
              >
                <RefreshCw size={12} />
                {resendCooldown > 0
                  ? `Reenviar en ${resendCooldown}s`
                  : "Reenviar código"}
              </button>
              <button
                onClick={() => { setStep("email"); setCode(""); }}
                className="w-full text-[11px] font-mono text-black/30 uppercase tracking-widest hover:text-black transition-colors flex items-center justify-center gap-2 py-1"
              >
                <ArrowLeft size={12} />
                Cambiar email
              </button>
            </div>
          </div>
        )}

        {/* ─── STEP: DONE ──────────────────────────────────────────────── */}
        {step === "done" && (
          <div className="bg-white border-[2.5px] border-black shadow-[6px_6px_0px_0px_rgba(0,0,0,1)] p-8 flex flex-col items-center gap-4">
            <div className="w-14 h-14 bg-black flex items-center justify-center">
              <Lock size={28} className="text-white" />
            </div>
            <p className="font-black text-black uppercase tracking-tight text-lg text-center">
              {isNewUser ? "¡Cuenta Verificada!" : "¡Acceso Concedido!"}
            </p>
            <p className="text-xs font-mono text-black/40 uppercase tracking-widest text-center">
              Redirigiendo…
            </p>
            <div className="w-8 h-8 border-2 border-black/15 border-t-black/60 rounded-full animate-spin mt-2" />
          </div>
        )}

        {/* Footer */}
        <p className="text-center text-[9px] font-mono text-black/20 uppercase tracking-[0.2em] mt-6">
          Non-custodial · Encrypted · Keys never leave your device
        </p>
      </div>
    </div>
  );
}
