"use client";

import React, { useEffect, useState, useCallback, useRef } from "react";

import { PasskeyOnboarding } from '@/components/auth/PasskeyOnboarding';
import { motion, AnimatePresence } from "framer-motion";
import dynamic from "next/dynamic";
import Link from "next/link";
import { useAccount, useConnect, useDisconnect, useSignMessage } from "wagmi";
import { useAppKit } from "@reown/appkit/react";
import { useUIStore } from "@/lib/store/ui-store";
import { toast } from "sonner";
import { QRCodeSVG } from "qrcode.react";
import { useSystemSignOut } from "@/hooks/useSystemSignOut";
import { EmailLoginModal } from "@/components/auth/EmailLoginModal";
import { useDynamicIsland } from "@/lib/store/dynamic-island-store";
import {
  ArrowRight, Loader2, ExternalLink, ScanLine,
  Lock, Shield, Mail, Wallet, CheckCircle2,
} from "lucide-react";

const DynamicUniversalScanModal = dynamic(
  () => import("@/components/scan/UniversalScanModal"),
  { ssr: false }
);

function useIsMobile() {
  const [isMobile, setIsMobile] = useState(false);
  useEffect(() => {
    setIsMobile(/Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini|Mobile/i.test(
      typeof navigator !== "undefined" ? navigator.userAgent : ""
    ));
  }, []);
  return isMobile;
}

const DESKTOP_WALLETS = [
  { id: "metamask", name: "MetaMask",       badge: "Browser Extension", logo: "/wallets/metamask.svg", rdns: "io.metamask",        installUrl: "https://metamask.io/download/",  delay: 0    },
  { id: "coinbase", name: "Coinbase Wallet",badge: "Browser Extension", logo: "/wallets/coinbase.png", rdns: "com.coinbase.wallet", installUrl: "https://www.coinbase.com/wallet", delay: 0.06 },
  { id: "rainbow",  name: "Rainbow",        badge: "Browser Extension", logo: "/wallets/rainbow.png",  rdns: "me.rainbow",          installUrl: "https://rainbow.me/extension",   delay: 0.12 },
];

const MOBILE_WALLETS = [
  { id: "metamask-mobile", name: "MetaMask",       badge: "Tap to open app", logo: "/wallets/metamask.svg", delay: 0    },
  { id: "coinbase-mobile", name: "Coinbase Wallet", badge: "Tap to open app", logo: "/wallets/coinbase.png", delay: 0.06 },
  { id: "rainbow-mobile",  name: "Rainbow",         badge: "Tap to open app", logo: "/wallets/rainbow.png",  delay: 0.12 },
];

function WalletRow({ logo, name, badge, onClick, loading = false, delay = 0 }: {
  logo: string; name: string; badge: string; onClick: () => void; loading?: boolean; delay?: number;
}) {
  return (
    <motion.button
      initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }}
      transition={{ delay, duration: 0.5, ease: [0.16, 1, 0.3, 1] }}
      onClick={loading ? undefined : onClick} disabled={loading}
      className="group w-full flex items-center gap-3 px-4 py-3 rounded-xl border border-black/10 bg-white hover:border-black hover:bg-black transition-all duration-300 disabled:opacity-40 disabled:cursor-not-allowed"
    >
      <div className="w-7 h-7 shrink-0 flex items-center justify-center grayscale group-hover:grayscale-0 group-hover:brightness-200 transition-all duration-300">
        <img src={logo} alt={name} className="w-full h-full object-contain" onError={(e) => { (e.target as HTMLImageElement).style.display = "none"; }} />
      </div>
      <div className="flex-1 text-left">
        <p className="text-[13px] font-semibold text-black group-hover:text-white transition-colors duration-300 leading-tight">{loading ? "Connecting..." : name}</p>
        <p className="text-[10px] text-black/40 group-hover:text-white/50 transition-colors duration-300 uppercase tracking-wider font-mono">{badge}</p>
      </div>
      {loading ? <Loader2 size={14} className="animate-spin text-black/30 group-hover:text-white/50 shrink-0" />
               : <ArrowRight size={14} className="text-black/20 group-hover:text-white shrink-0 transition-all duration-300 -translate-x-1 group-hover:translate-x-0" />}
    </motion.button>
  );
}

function Divider({ label }: { label: string }) {
  return (
    <div className="flex items-center gap-3 my-4">
      <div className="flex-1 h-px bg-black/8" />
      <span className="text-[10px] font-mono uppercase tracking-widest text-black/30">{label}</span>
      <div className="flex-1 h-px bg-black/8" />
    </div>
  );
}

export default function ConnectPage() {
  const isMobile = useIsMobile();
  const { isConnected, address, status: accountStatus } = useAccount();
  const { connect, connectors, isPending, isError, error } = useConnect();
  const { signMessageAsync } = useSignMessage();
  const { open: openAppKit } = useAppKit();
  const { isLinked, setLinked } = useUIStore();
  const { nuclearDisconnect } = useSystemSignOut();

  const [mounted,           setMounted]           = useState(false);
  const [qrSession,         setQrSession]         = useState<string | null>(null);
  const [syncStatus,        setSyncStatus]        = useState<"IDLE" | "AWAITING" | "SYNCED" | "ERROR">("IDLE");
  const [pendingId,         setPendingId]         = useState<string | null>(null);
  const [pendingWalletName, setPendingWalletName] = useState<string | null>(null);
  const [pendingWalletLogo, setPendingWalletLogo] = useState<string | null>(null);

  const [showMobileScanner, setShowMobileScanner] = useState(false);
  const [qrData,            setQrData]            = useState("");
  const [ephemeral,         setEphemeral]         = useState<{ publicKey: string; privateKey: string; isECDH?: boolean } | null>(null);
  const [authStatus,        setAuthStatus]        = useState<"idle" | "verifying" | "failed">("idle");
  const [pinCode,           setPinCode]           = useState<string | null>(null);
  const [emailModalOpen,    setEmailModalOpen]    = useState(false);
  const redirectingRef = useRef(false);
  const signingRef     = useRef(false);

  let isGuarded = false;
  try {
    if (typeof window !== "undefined")
      isGuarded = sessionStorage.getItem("__disconnected__") === "1" || localStorage.getItem("__disconnected__") === "1";
  } catch {}
  const effectiveIsConnected = mounted && isConnected && !isGuarded;

  useEffect(() => {
    if (!isError || !error) return;
    setPendingId(null);
    const msg = error.message ?? "Unknown error";
    if (msg.toLowerCase().includes("already connected")) return;
    if (msg.toLowerCase().includes("provider not found") || msg.toLowerCase().includes("not installed")) {
      toast.error("Wallet extension not found", { action: { label: "Install MetaMask", onClick: () => window.open("https://metamask.io/download/", "_blank") }, duration: 7000 });
    } else if (msg.toLowerCase().includes("rejected")) {
      toast.error("Connection declined");
    } else {
      toast.error("Connection failed", { description: msg });
    }
  }, [isError, error]);

  useEffect(() => {
    setMounted(true);
    if (typeof window !== "undefined") {
      const p = new URLSearchParams(window.location.search);
      if (p.has("s") && p.has("p")) window.location.replace("/scan?payload=" + encodeURIComponent(window.location.href));
      if (!document.cookie.includes("system_handshake=")) {
        fetch("/api/auth/session-heal", { credentials: "include", cache: "no-store" })
          .then(r => r.json()).then(d => { if (d.healed) window.dispatchEvent(new Event("storage")); }).catch(() => {});
      }
    }
  }, []);

  useEffect(() => {
    if (typeof document === "undefined") return;
    try { if (sessionStorage.getItem("__disconnected__") === "1" || localStorage.getItem("__disconnected__") === "1") return; } catch {}
    const hasCookie = document.cookie.split("; ").some(r => r.startsWith("system_handshake="));
    const hasLocal = (() => { try { const r = localStorage.getItem("system_session_v2"); if (!r) return false; const p = JSON.parse(r); return p && p.exp && p.exp > Date.now(); } catch { return false; } })();
    if (hasCookie || hasLocal) setLinked(true);
  }, [setLinked]);

  const initEphemeral = useCallback(async () => {
    try {
      const { generateX25519KeyPair, generateVisualPin } = await import("@/lib/web-crypto");
      const pair = await generateX25519KeyPair();
      setEphemeral(pair);
      const pin = generateVisualPin(); setPinCode(pin);
      const sessId = crypto.randomUUID?.() ?? Date.now().toString(36); setQrSession(sessId);
      const origin = typeof window !== "undefined" ? window.location.origin : "https://humanidfi.com";
      const url = new URL("/connect", origin);
      url.searchParams.set("s", sessId); url.searchParams.set("p", pair.publicKey);
      if (pair.isECDH) url.searchParams.set("ecdh", "1");
      setQrData(url.toString()); setSyncStatus("AWAITING");
      const t = setTimeout(() => { setQrSession(null); setSyncStatus("IDLE"); setPinCode(null); }, 270000);
      return () => clearTimeout(t);
    } catch { setSyncStatus("ERROR"); }
  }, []);

  useEffect(() => { if (!qrSession && mounted) initEphemeral(); }, [qrSession, initEphemeral, mounted]);

  useEffect(() => {
    if (!qrSession || !ephemeral || syncStatus === "SYNCED" || syncStatus === "ERROR") return;
    const poll = setInterval(async () => {
      try {
        const res = await fetch(`/api/auth/qr-poll?uuid=${qrSession}&t=${Date.now()}`, { cache: "no-store" });
        if (!res.ok) return;
        const data = await res.json();
        if (!data.encryptedPayload && !data.serverJwt) return;
        clearInterval(poll);
        let jwt: string | null = null;
        if (data.encryptedPayload && data.iv && data.mobilePub) {
          try {
            const { deriveSharedSecret, decryptAESGCM } = await import("@/lib/web-crypto");
            const shared = await deriveSharedSecret(ephemeral.privateKey, data.mobilePub, ephemeral.isECDH, pinCode ?? undefined);
            const decrypted = await decryptAESGCM(shared, data.encryptedPayload, data.iv);
            try {
              const p = JSON.parse(decrypted); if (p.jwt) jwt = p.jwt;
              const active = jwt || data.serverJwt;
              if (active) {
                const parts = active.split("."); if (parts.length === 3) {
                  const j = JSON.parse(atob(parts[1].replace(/-/g, "+").replace(/_/g, "/")));
                  const addr = (j.sub || j.address || "").toLowerCase();
                  if (p.seed && addr) localStorage.setItem(`ledger_chat_seed_${addr}`, p.seed);
                  if (p.vault) localStorage.setItem("system_vault_v1", p.vault);
                }
              }
            } catch { if (decrypted?.split(".").length === 3) jwt = decrypted; }
          } catch (e) { console.warn("[QR] ECDH failed, fallback:", e); }
        }
        if (!jwt && data.serverJwt) jwt = data.serverJwt;
        if (!jwt) { setSyncStatus("ERROR"); return; }
        setSyncStatus("SYNCED");
        useDynamicIsland.getState().setState("syncing", { title: "Syncing Session" }, 3000);
        const hy = await fetch("/api/auth/qr-hydrate", { method: "POST", headers: { "Content-Type": "application/json" }, credentials: "include", body: JSON.stringify({ jwt }) });
        if (hy.ok) {
          const hd = await hy.json().catch(() => ({}));
          let normalized: string | null = (hd as any).address || null;
          if (!normalized) {
            const parts = jwt.split("."); if (parts.length === 3) {
              const p = JSON.parse(atob(parts[1].replace(/-/g, "+").replace(/_/g, "/")));
              const addr = (p.sub || p.address || "") as string;
              if (addr?.startsWith("0x") && addr.length === 42) normalized = addr.toLowerCase();
            }
          }
          if (normalized) {
            localStorage.setItem("system_session_v2", JSON.stringify({ wallet: normalized, exp: Date.now() + 604800000, source: "qr-handshake" }));
            sessionStorage.setItem("system_wallet_addr", normalized); sessionStorage.setItem("portfolio_unlocked", "true");
            sessionStorage.removeItem("__disconnected__"); localStorage.removeItem("__disconnected__");
            document.cookie = `system_handshake=${normalized}; path=/; max-age=604800; SameSite=Lax`;
            setLinked(true);
          }
          await new Promise(r => setTimeout(r, 800));
          const rp = new URLSearchParams(window.location.search);
          const raw = rp.get("returnUrl") || rp.get("redirect_url") || "";
          const safe = (raw.startsWith("/") && !raw.startsWith("//") && raw !== "/hub" && !raw.startsWith("/terminal")) ? raw : "/chat";
          window.location.replace(safe);
        } else { setSyncStatus("ERROR"); }
      } catch {}
    }, 1000);
    return () => clearInterval(poll);
  }, [qrSession, ephemeral, qrData, syncStatus, pinCode, setLinked]);

  useEffect(() => {
    if (!mounted || accountStatus !== "connected" || !address) return;
    if (redirectingRef.current || signingRef.current || authStatus === "failed") return;
    try { if (sessionStorage.getItem("__disconnected__") === "1" || localStorage.getItem("__disconnected__") === "1") return; } catch {}
    signingRef.current = true;
    (async () => {
      setAuthStatus("verifying");
      try {
        const ctrl = new AbortController(); const tid = setTimeout(() => ctrl.abort(), 10000);
        const r = await fetch("/api/auth/verify-session", { cache: "no-store", credentials: "include", signal: ctrl.signal }); clearTimeout(tid);
        if (r.ok) {
          const d = await r.json();
          if (d.authenticated && d.user?.address?.toLowerCase() === address?.toLowerCase()) {
            setLinked(true); redirectingRef.current = true;
            const rp = new URLSearchParams(window.location.search);
            const rv = rp.get("returnUrl") || rp.get("redirect_url");
            const safe = (rv && rv !== "/portfolio" && !rv.startsWith("/terminal")) ? rv : "/hub";
            window.location.replace(safe); return;
          }
        }
      } catch {}
      try {
        let nonce: string;
        let nonceFromServer = false;
        try {
          const nonceRes = await fetch("/api/auth/nonce", { cache: "no-store", signal: AbortSignal.timeout(4000) });
          if (nonceRes.ok) {
            const nd = await nonceRes.json();
            nonce = nd.nonce;
            nonceFromServer = true;
          } else {
            nonce = `HL-${Date.now()}-${crypto.randomUUID ? crypto.randomUUID().replace(/-/g, "") : Math.random().toString(36).slice(2)}`;
          }
        } catch {
          nonce = `HL-${Date.now()}-${crypto.randomUUID ? crypto.randomUUID().replace(/-/g, "") : Math.random().toString(36).slice(2)}`;
        }
        const msg = `Sign in to Humanity Ledger\n\nAddress: ${address}\nNonce: ${nonce}\nChain: Ethereum`;
        const signature = await signMessageAsync({ message: msg });
        const vr = await fetch("/api/auth/system-verify", { method: "POST", headers: { "Content-Type": "application/json" }, credentials: "include", body: JSON.stringify({ address, message: msg, signature, nonce, _clientNonce: !nonceFromServer }) });
        if (vr.ok) {
          setLinked(true); redirectingRef.current = true;
          const rp = new URLSearchParams(window.location.search);
          const rv = rp.get("returnUrl") || rp.get("redirect_url");
          window.location.replace((rv && !rv.startsWith("/terminal")) ? rv : "/hub");
        } else { setAuthStatus("failed"); signingRef.current = false; }
      } catch (e: any) {
        if (e?.message?.toLowerCase().includes("rejected") || e?.message?.toLowerCase().includes("cancelled")) toast.error("Signature declined");
        setAuthStatus("failed"); signingRef.current = false;
      }
    })();
  }, [mounted, accountStatus, address, authStatus, signMessageAsync, setLinked]);

  const openAppKitSafe = useCallback(() => {
    try { (openAppKit as any)({ view: "Connect" }); } catch { try { openAppKit(); } catch {
      try { const el = (document.querySelector("appkit-modal") || document.querySelector("w3m-modal")) as any; if (el) { el.open = true; el.openModal?.(); } } catch {}
    }}
  }, [openAppKit]);

  const handleDesktopWallet = useCallback((walletId: string, rdns: string | null, installUrl: string | null, name: string, logo: string) => {
    try { sessionStorage.removeItem("__disconnected__"); localStorage.removeItem("__disconnected__"); } catch {}
    setPendingId(walletId);
    setPendingWalletName(name);
    setPendingWalletLogo(logo);
    if (!rdns) { openAppKitSafe(); setPendingId(null); return; }
    const conn = connectors.find((c: any) => c.id === rdns) || connectors.find(c => c.name.toLowerCase().includes(walletId)) || connectors.find(c => c.id === "injected" || (c as any).type === "injected");
    if (conn) connect({ connector: conn });
    else { setPendingId(null); setPendingWalletName(null); if (installUrl) toast.error("Wallet not found", { action: { label: "Install", onClick: () => window.open(installUrl, "_blank") } }); }
  }, [connect, connectors, openAppKitSafe]);


  const handleMobileWallet = useCallback((walletId: string) => {
    try { sessionStorage.removeItem("__disconnected__"); localStorage.removeItem("__disconnected__"); localStorage.setItem("system_pending_wakeup", "1"); } catch {}
    const inj = connectors.find((c: any) => c.id === "injected" || c.type === "injected" || c.id === "io.metamask" || c.name.toLowerCase().includes(walletId.split("-")[0]));
    if (inj && typeof window !== "undefined" && ((window as any).ethereum || (window as any).web3)) { setPendingId(walletId); connect({ connector: inj }); return; }
    try { const btn = document.querySelector("appkit-button") || document.querySelector("w3m-button"); if (btn?.shadowRoot) { const nb = btn.shadowRoot.querySelector("button"); if (nb) { nb.click(); return; } } } catch {}
    try { (openAppKit as any)({ view: "Connect" }); } catch { try { openAppKit(); } catch {} }
  }, [openAppKit, connect, connectors]);

  const handleTotalDisconnect = useCallback(() => { toast.success("Disconnected."); nuclearDisconnect(); }, [nuclearDisconnect]);
  const triggerManualVerify   = useCallback(() => { signingRef.current = false; setAuthStatus("idle"); }, []);
  const isVerified = mounted && isLinked;

  if (!mounted) return <div className="w-full min-h-screen bg-white" />;

  return (
    <div className="w-full min-h-screen bg-[#F7F7F6] text-black overflow-x-hidden selection:bg-black selection:text-white">
      {/* ────────────────────────────────────────────────────────────
          MOBILE HERO: Full-width globe video, natural 16:9 ratio
          Hidden on desktop — desktop uses the left/right grid below
      ──────────────────────────────────────────────────────────── */}
      <div className="lg:hidden w-full relative overflow-hidden bg-black aspect-video max-h-[40vh]">
        <video
          autoPlay
          loop
          muted
          playsInline
          preload="auto"
          disablePictureInPicture
          className="absolute inset-0 w-full h-full object-cover"
          src="/system-shots/72298-541981714.mp4"
          style={{ objectPosition: 'center center' }}
        />
        {/* Bottom fade for seamless transition to the white auth form */}
        <div className="absolute inset-x-0 bottom-0 h-20 z-10" style={{ background: 'linear-gradient(to bottom, transparent, #ffffff)' }} />
        {/* Logo top-left with safe-area inset */}
        <div className="absolute top-4 left-4 z-20" style={{ paddingTop: 'env(safe-area-inset-top, 0px)' }}>
          <img src="/logo-corporate.png" alt="Humanity Ledger" className="h-6 w-auto invert drop-shadow-lg" />
        </div>
      </div>

      <div className="w-full flex flex-col lg:grid lg:grid-cols-[1fr_460px] xl:grid-cols-[1fr_500px] min-h-screen lg:h-screen lg:min-h-[600px] lg:max-h-screen">

        {/* LEFT: Branding — desktop only */}
        <div className="hidden lg:flex flex-col justify-between bg-black text-white p-12 relative overflow-hidden h-full">
          {/* HIGH-QUALITY VIDEO BACKGROUND */}
          <video
            autoPlay
            loop
            muted
            playsInline
            preload="auto"
            className="absolute inset-0 w-full h-full object-cover z-0 opacity-90"
            src="/system-shots/72298-541981714.mp4"
          />
          <div className="absolute inset-0 z-[1]" style={{ background: 'linear-gradient(to bottom, rgba(0,0,0,0.25) 0%, rgba(0,0,0,0.1) 40%, rgba(0,0,0,0.55) 100%)' }} />
          
          <div className="relative z-20">
            <img src="/logo-corporate.png" alt="Humanity Ledger" className="h-7 w-auto object-contain invert" />
          </div>
          <motion.div initial={{ opacity: 0, y: 30 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 1, ease: [0.16, 1, 0.3, 1] }} className="relative z-20 flex flex-col gap-6">
            <div>
              <p className="text-[10px] font-mono uppercase tracking-[0.3em] text-white/30 mb-4">Humanity Ledger Beta</p>
              <h1 className="text-4xl xl:text-5xl font-black tracking-tight leading-[1.1] text-white">Your sovereign<br />cryptographic network.</h1>
            </div>
            <p className="text-[15px] text-white/45 leading-relaxed max-w-[360px]">Authenticate once with a hardware-bound Ethereum wallet. Access Zero-Knowledge identity shielding, portfolio sync, and unbroken encrypted messaging.</p>
            <div className="flex flex-col gap-3 mt-2">
              {[
                { icon: <Lock size={12} />,   label: "Client-Side ZK Proving & Sovereign Messaging (XMTP)" },
                { icon: <Shield size={12} />, label: "Hardware-Rooted Authentication (No passwords)" },
                { icon: <Wallet size={12} />, label: "Multi-chain portfolio sync" },
              ].map((f, i) => (
                <div key={i} className="flex items-center gap-3">
                  <div className="w-6 h-6 rounded-md border border-white/10 bg-white/5 flex items-center justify-center text-white/40">{f.icon}</div>
                  <span className="text-[12px] text-white/40 font-medium">{f.label}</span>
                </div>
              ))}
            </div>
          </motion.div>
        </div>

        {/* RIGHT: Auth panel — full height on desktop, white bottom sheet on mobile */}
        <div
          className="flex flex-col items-center justify-start lg:justify-center overflow-y-auto bg-white relative border-l border-black/6 h-full w-full shrink-0 shadow-[-20px_0_40px_rgba(0,0,0,0.5)]"
          style={{
            minHeight: '50vh',
            paddingTop: 'clamp(1.5rem, 4vw, 2.5rem)',
            paddingBottom: 'max(2rem, env(safe-area-inset-bottom, 2rem))',
            paddingLeft: '1.5rem',
            paddingRight: '1.5rem',
          }}
        >

          <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.6, ease: [0.16, 1, 0.3, 1] }} className="w-full max-w-[380px]">
            <div className="mb-7">
              <h2 className="text-[22px] font-black tracking-tight text-black">Sign in</h2>
              <p className="text-[13px] text-black/35 font-medium mt-0.5">Connect your wallet to access the workspace.</p>
            </div>

            <AnimatePresence mode="wait">
              {isVerified ? (
                <motion.div key="verified" initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="flex flex-col items-center gap-5 py-10">
                  <div className="w-14 h-14 rounded-full bg-emerald-50 flex items-center justify-center">
                    <CheckCircle2 size={28} className="text-emerald-500" />
                  </div>
                  <div className="text-center">
                    <p className="font-black text-[17px] text-black">Workspace unlocked</p>
                    <p className="text-[11px] text-black/35 mt-1">Redirecting you now...</p>
                  </div>
                  {isMobile && (
                    <button onClick={() => setShowMobileScanner(true)} className="w-full flex items-center justify-center gap-2 py-3 rounded-xl border border-black text-black font-bold text-[11px] uppercase tracking-widest hover:bg-black hover:text-white transition-all">
                      <ScanLine size={12} /> Link another device
                    </button>
                  )}
                  <button onClick={handleTotalDisconnect} className="text-[10px] font-mono text-black/25 hover:text-red-500 uppercase tracking-widest transition-colors">Terminate session</button>
                </motion.div>

              ) : effectiveIsConnected && !isLinked ? (
                <motion.div key="signing" initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="flex flex-col items-center gap-5 py-10 text-center">
                  {pendingWalletLogo ? (
                    <div className="relative">
                      <div className="w-16 h-16 rounded-2xl border border-black/8 bg-[#F7F7F6] flex items-center justify-center p-3">
                        <img src={pendingWalletLogo} alt={pendingWalletName ?? ''} className="w-full h-full object-contain" />
                      </div>
                      <div className="absolute -bottom-1 -right-1 w-5 h-5 rounded-full bg-black flex items-center justify-center">
                        <Lock size={10} className="text-white" />
                      </div>
                    </div>
                  ) : (
                    <div className="w-14 h-14 rounded-full border border-black/10 flex items-center justify-center">
                      <Lock size={20} strokeWidth={1.5} />
                    </div>
                  )}
                  <div>
                    <h3 className="font-black text-[16px] text-black">
                      {pendingWalletName ? `Waiting for ${pendingWalletName}` : 'Sign to verify ownership'}
                    </h3>
                    <p className="text-[12px] text-black/35 mt-1 max-w-[260px] leading-relaxed">
                      Check your wallet app and approve the signature request. No gas fees.
                    </p>
                  </div>
                  {authStatus === "failed" ? (
                    <div className="flex flex-col gap-2 w-full">
                      <button onClick={triggerManualVerify} className="w-full flex items-center justify-center gap-2 py-3 bg-black text-white font-bold text-[12px] rounded-xl hover:bg-black/80 transition-colors">
                        <ExternalLink size={12} /> Retry signature
                      </button>
                      <button onClick={handleTotalDisconnect} className="text-[10px] font-mono text-black/25 hover:text-red-500 uppercase tracking-widest transition-colors mt-1">Disconnect</button>
                    </div>
                  ) : (
                    <div className="flex flex-col items-center gap-3 w-full">
                      <div className="flex items-center gap-2 text-[10px] font-mono uppercase tracking-widest text-black/30 animate-pulse">
                        <Loader2 size={11} className="animate-spin" /> Awaiting signature...
                      </div>
                      <button onClick={handleTotalDisconnect} className="text-[9px] font-mono text-black/20 hover:text-red-400 uppercase tracking-widest transition-colors">Cancel</button>
                    </div>
                  )}
                </motion.div>


              ) : (
                <motion.div key="form" initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="flex flex-col gap-2">
                  {!isMobile && (
                    <div className="mb-4 p-4 rounded-2xl border border-black/8 bg-[#F7F7F6] flex flex-col items-center gap-3">
                      <p className="text-[9px] font-mono uppercase tracking-[0.3em] text-black/30">Scan with mobile wallet</p>
                      <div className="p-3 bg-white border border-black/8 rounded-xl">
                        {syncStatus === "AWAITING" && qrData
                          ? <QRCodeSVG value={qrData} size={156} fgColor="#000000" bgColor="#FFFFFF" level="L" includeMargin={false} />
                          : syncStatus === "ERROR"
                          ? <div className="w-[156px] h-[156px] flex flex-col items-center justify-center gap-3">
                              <Shield size={18} className="text-black/20" />
                              <button onClick={() => { setSyncStatus("IDLE"); setQrSession(null); setQrData(""); }} className="text-[9px] font-mono uppercase tracking-widest text-black border border-black px-3 py-1.5 hover:bg-black hover:text-white transition-colors rounded">Retry</button>
                            </div>
                          : <div className="w-[156px] h-[156px] flex items-center justify-center"><Loader2 size={18} className="animate-spin text-black/15" /></div>
                        }
                      </div>
                      {pinCode && syncStatus === "AWAITING" && (
                        <div className="flex flex-col items-center gap-1.5">
                          <p className="text-[8px] font-mono uppercase tracking-[0.2em] text-black/25">Security PIN</p>
                          <div className="flex gap-1.5">
                            {pinCode.split("").map((d, i) => (
                              <div key={i} className="w-8 h-9 border border-black/15 rounded-lg flex items-center justify-center bg-white">
                                <span className="text-[14px] font-black text-black">{d}</span>
                              </div>
                            ))}
                          </div>
                        </div>
                      )}
                    </div>
                  )}

                  {!isMobile && (
                    <>
                      <Divider label="or connect browser wallet" />
                      <div className="flex flex-col gap-2">
                        {DESKTOP_WALLETS.map(w => (
                          <WalletRow key={w.id} logo={w.logo} name={w.name} badge={w.badge}
                            onClick={() => handleDesktopWallet(w.id, w.rdns, w.installUrl, w.name, w.logo)}
                            loading={isPending && pendingId === w.id} delay={w.delay} />
                        ))}
                      </div>
                    </>
                  )}

                  {isMobile && (
                    <div className="flex flex-col gap-2">
                      <WalletRow logo="https://raw.githubusercontent.com/WalletConnect/walletconnect-assets/master/Logo/Blue%20(Default)/Logo.svg" name="Connect Wallet" badge="WalletConnect protocol" onClick={openAppKitSafe} delay={0} />
                      {MOBILE_WALLETS.map(w => (
                        <WalletRow key={w.id} logo={w.logo} name={w.name} badge={w.badge} onClick={() => handleMobileWallet(w.id)} delay={w.delay} />
                      ))}
                      <button onClick={() => setShowMobileScanner(true)} className="w-full flex items-center justify-center gap-2 py-3 rounded-xl border border-black/10 text-[11px] font-mono font-bold uppercase tracking-widest text-black/40 hover:border-black hover:text-black transition-colors mt-1">
                        <ScanLine size={12} /> Scan QR Code
                      </button>
                    </div>
                  )}

                  <Divider label="or sign in with email" />
                  <button onClick={() => setEmailModalOpen(true)} className="group w-full flex items-center gap-3 px-4 py-3 rounded-xl border border-black/10 bg-white hover:border-black hover:bg-black transition-all duration-300">
                    <div className="w-7 h-7 shrink-0 flex items-center justify-center">
                      <Mail size={15} className="text-black/35 group-hover:text-white transition-colors" />
                    </div>
                    <div className="flex-1 text-left">
                      <p className="text-[13px] font-semibold text-black group-hover:text-white transition-colors leading-tight">Sign in with Email</p>
                      <p className="text-[10px] text-black/35 group-hover:text-white/50 transition-colors uppercase tracking-wider font-mono">OTP verification</p>
                    </div>
                    <ArrowRight size={13} className="text-black/15 group-hover:text-white shrink-0 transition-all -translate-x-1 group-hover:translate-x-0" />
                  </button>

                  {/* Terms + Privy */}
                  <div className="mt-5 flex flex-col items-center gap-2">
                    <p className="text-[9px] text-black/30 text-center leading-relaxed font-mono uppercase tracking-wider">
                      By connecting you agree to our{" "}
                      <Link href="/docs/terms" className="underline hover:text-black transition-colors">Terms of Service</Link>
                      {" & "}
                      <Link href="/docs/privacy" className="underline hover:text-black transition-colors">Privacy Policy</Link>.
                    </p>
                    <div className="flex items-center gap-1.5 px-3 py-1.5 bg-[#F7F7F6] rounded-full border border-black/8">
                      <Shield size={10} className="text-black/30" />
                      <span className="text-[9px] font-mono uppercase tracking-widest text-black/30">Protected by Privy</span>
                    </div>
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
            
            <div className="mt-6 flex justify-center">
              <div className="flex items-center gap-2 text-[9px] font-mono uppercase tracking-widest text-black/25">
                <div className="w-1 h-1 rounded-full bg-emerald-400" />
                Secured / SIWE / XMTP
              </div>
            </div>
          </motion.div>
        </div>
      </div>

      {/* ── WAITING FOR WALLET OVERLAY ─────────────────────────────────── */}
      <AnimatePresence>
        {pendingWalletName && isPending && (
          <motion.div
            key="waiting-overlay"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/60 backdrop-blur-sm"
          >
            <motion.div
              initial={{ scale: 0.9, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.9, opacity: 0 }}
              transition={{ type: "spring", damping: 20, stiffness: 300 }}
              className="bg-white rounded-3xl shadow-2xl p-8 flex flex-col items-center gap-5 w-[280px]"
            >
              {pendingWalletLogo && (
                <div className="w-16 h-16 rounded-2xl border border-black/8 bg-[#F7F7F6] flex items-center justify-center p-3">
                  <img src={pendingWalletLogo} alt={pendingWalletName} className="w-full h-full object-contain" />
                </div>
              )}
              <div className="text-center">
                <p className="font-black text-[16px] text-black">Waiting for {pendingWalletName}</p>
                <p className="text-[12px] text-black/40 mt-1">Open your wallet app and approve the connection</p>
              </div>
              <div className="flex items-center gap-2 text-[10px] font-mono uppercase tracking-widest text-black/30 animate-pulse">
                <Loader2 size={12} className="animate-spin" />
                Awaiting approval...
              </div>
              <button
                onClick={() => { setPendingId(null); setPendingWalletName(null); setPendingWalletLogo(null); }}
                className="text-[10px] font-mono uppercase tracking-widest text-black/25 hover:text-black transition-colors"
              >
                Cancel
              </button>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {isMobile && mounted && (
        <DynamicUniversalScanModal isOpen={showMobileScanner} onClose={() => setShowMobileScanner(false)} address={address ?? ""} mode="session-only" onScan={() => { setShowMobileScanner(false); toast.success("Session synchronized"); }} />
      )}
      <EmailLoginModal isOpen={emailModalOpen} onClose={() => setEmailModalOpen(false)} />
      <div aria-hidden="true" style={{ position: "absolute", opacity: 0, width: 1, height: 1, pointerEvents: "none", overflow: "hidden" }}>
        {/* @ts-ignore */}
        <appkit-button />
      </div>
    </div>
  );
}

