"use client";

import React, { useEffect, useState, useCallback, useRef } from "react";

import { PasskeyOnboarding } from '@/components/auth/PasskeyOnboarding';
import { motion, AnimatePresence } from "framer-motion";
import dynamic from "next/dynamic";
import Link from "next/link";
import { HLLogo } from "@/components/shared/HLLogo";
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

// ─── App Store Badge (Official look — matches Apple's badge exactly) ──────────
function AppStoreBadge() {
  return (
    <a
      href="#"
      className="inline-flex items-center gap-[10px] bg-black text-white px-[14px] py-[8px] rounded-[10px] border border-white/[0.12] hover:bg-[#111] active:scale-[0.97] transition-all select-none"
      style={{ height: '50px', minWidth: '148px' }}
    >
      {/* Official Apple logo — correct viewBox so the leaf doesn't clip */}
      <svg width="20" height="24" viewBox="0 0 170 209" fill="white" xmlns="http://www.w3.org/2000/svg">
        <path d="M150.37 130.25c-2.45 5.66-5.35 10.87-8.71 15.66-4.58 6.53-8.33 11.05-11.22 13.56-4.48 4.12-9.28 6.23-14.42 6.35-3.69 0-8.14-1.05-13.32-3.18-5.2-2.12-9.97-3.17-14.34-3.17-4.58 0-9.49 1.05-14.75 3.17-5.26 2.13-9.5 3.24-12.75 3.35-4.94.21-9.84-1.96-14.72-6.52-3.13-2.73-7.05-7.41-11.76-14.03-5.04-7.08-9.19-15.29-12.43-24.65-3.47-10.11-5.21-19.9-5.21-29.38 0-10.86 2.35-20.23 7.06-28.1 3.7-6.31 8.63-11.3 14.82-14.99 6.19-3.69 12.87-5.57 20.07-5.69 3.94 0 9.1 1.22 15.53 3.61 6.41 2.4 10.52 3.62 12.32 3.62 1.35 0 5.92-1.43 13.68-4.27 7.33-2.65 13.52-3.75 18.6-3.32 13.75 1.11 24.08 6.52 30.95 16.26-12.29 7.45-18.37 17.87-18.25 31.22.11 10.41 3.88 19.07 11.3 25.95 3.36 3.19 7.11 5.65 11.27 7.4-.9 2.62-1.86 5.12-2.88 7.52zM113.22 3.48c0 8.16-2.98 15.78-8.92 22.84-7.17 8.38-15.84 13.23-25.23 12.47-.12-.98-.19-2-.19-3.07 0-7.83 3.41-16.21 9.46-23.07 3.02-3.48 6.86-6.37 11.52-8.69 4.65-2.29 9.05-3.55 13.18-3.77.12 1.1.18 2.2.18 3.29z"/>
      </svg>
      <div className="flex flex-col text-left leading-none">
        <span className="text-[10px] font-normal opacity-75 tracking-wide mb-[2px]">Download on the</span>
        <span className="text-[19px] font-semibold tracking-[-0.3px]">App Store</span>
      </div>
    </a>
  );
}

// ─── Google Play Badge (Official look — matches Google's badge exactly) ────────
function GooglePlayBadge() {
  return (
    <a
      href="#"
      className="inline-flex items-center gap-[10px] bg-black text-white px-[14px] py-[8px] rounded-[10px] border border-white/[0.12] hover:bg-[#111] active:scale-[0.97] transition-all select-none"
      style={{ height: '50px', minWidth: '162px' }}
    >
      {/* Official Google Play triangle logo */}
      <svg width="24" height="27" viewBox="0 0 40 45" fill="none" xmlns="http://www.w3.org/2000/svg">
        <path d="M1.5 0.7L22.1 21.3L1.5 41.9C0.6 41.4 0 40.5 0 39.4V2.2C0 1.1 0.6 0.2 1.5 0.7Z" fill="#4CAF50"/>
        <path d="M33.1 15L22.1 21.3L29.7 28.9L40.6 22.7C41.8 22 41.8 20.7 40.6 20L33.1 15Z" fill="#FFC107"/>
        <path d="M1.5 41.9L22.1 21.3L29.7 28.9L4.2 43.6C2.9 44.4 1.5 43.4 1.5 41.9Z" fill="#F44336"/>
        <path d="M1.5 0.7L22.1 21.3L29.7 13.7L4.2 -1C2.9 -1.8 1.5 -0.8 1.5 0.7Z" fill="#2196F3"/>
      </svg>
      <div className="flex flex-col text-left leading-none">
        <span className="text-[10px] font-normal opacity-75 tracking-[0.08em] uppercase mb-[2px]">Get it on</span>
        <span className="text-[19px] font-semibold tracking-[-0.3px]">Google Play</span>
      </div>
    </a>
  );
}

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
    if (hasCookie || hasLocal) {
      setLinked(true);
      // Auto-redirect to /chat if already logged in (important for Electron .exe)
      const rp = new URLSearchParams(typeof window !== "undefined" ? window.location.search : "");
      const returnUrl = rp.get("redirect") || rp.get("returnUrl") || "/chat";
      const safe = returnUrl.startsWith("/") && !returnUrl.startsWith("//") ? returnUrl : "/chat";
      setTimeout(() => { window.location.replace(safe); }, 500);
    }
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
            const safe = (rv && rv !== '/portfolio' && !rv.startsWith('/terminal')) ? rv : '/chat';
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
          window.location.replace((rv && !rv.startsWith('/terminal')) ? rv : '/chat');
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
    
    if (conn) {
      connect({ connector: conn });
    } else {
      // If we're in the .exe or a browser without extensions, fallback to WalletConnect QR
      setPendingId(null);
      setPendingWalletName(null);
      openAppKitSafe();
      toast.info(`Please scan the QR code with your ${name} mobile app.`);
    }
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
      {/* MOBILE HERO — clean white, world map bg, Ledger Chat icon */}
      <div className="lg:hidden w-full relative flex flex-col items-center justify-center bg-[#FAFAFA] pt-14 pb-8 px-6 overflow-hidden border-b border-black/5">
        {/* Faint world map */}
        <div className="absolute inset-0 flex items-center justify-center pointer-events-none select-none">
          <img src="/worldmap.png" alt="" aria-hidden="true" className="w-[140%] max-w-none h-auto object-contain opacity-[0.03]" />
        </div>
        
        <div className="relative z-10 w-28 h-28 rounded-[36px] overflow-hidden mb-6" style={{ boxShadow: '0 24px 48px -12px rgba(255,42,133,0.25), inset 0 1px 1px rgba(255,255,255,0.5), 0 0 0 1px rgba(0,0,0,0.02)' }}>
          <img src="/ledgerchaticon.jpg" alt="Ledger Chat" className="w-full h-full object-cover" />
        </div>
        <h2 className="relative z-10 text-[32px] font-black tracking-[-0.03em] text-black mb-2">Ledger Chat</h2>
        <p className="relative z-10 text-[14px] text-neutral-500 font-medium mb-6 text-center max-w-[280px] leading-relaxed">
          The ultimate secure messenger. Perfectly comfortable for everyone, including older adults. No passwords needed.
        </p>
        
        {/* Live status badge */}
        <div className="relative z-10 inline-flex items-center gap-3 pl-3 pr-5 py-2 rounded-full bg-white shadow-[0_4px_20px_rgb(0,0,0,0.06)] border border-[#25D366]/20">
          <span className="w-2.5 h-2.5 rounded-full bg-[#25D366] animate-pulse block shrink-0" />
          <span className="text-[12px] font-bold tracking-tight text-black">Live Now · Mobile Apps Coming</span>
        </div>
      </div>

      <div className="w-full flex flex-col lg:grid lg:grid-cols-[1fr_460px] xl:grid-cols-[1fr_500px] min-h-screen lg:h-screen lg:min-h-[600px] lg:max-h-screen">

        {/* LEFT: Branding — desktop only, masterpiece clean white */}
        <div className="hidden lg:flex flex-col justify-between bg-[#FAFAFA] text-black p-14 relative overflow-hidden h-full">

          {/* Faint world map background - elegant sizing and mask */}
          <div className="absolute inset-0 flex items-center justify-center pointer-events-none select-none">
            <img src="/worldmap.png" alt="" aria-hidden="true" className="w-[85%] max-w-[1000px] h-auto object-contain opacity-[0.025]" style={{ maskImage: 'radial-gradient(circle at center, black 30%, transparent 80%)', WebkitMaskImage: 'radial-gradient(circle at center, black 30%, transparent 80%)' }} />
          </div>

          {/* Top logo */}
          <div className="relative z-20">
            <HLLogo size={36} theme="dark" />
          </div>

          {/* Centre content */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.8, ease: [0.16, 1, 0.3, 1] }}
            className="relative z-20 flex flex-col justify-center gap-0 w-full max-w-[560px] mx-auto mt-[-40px]"
          >
            <div className="inline-flex items-center gap-3 pl-3 pr-5 py-2 rounded-full bg-white shadow-[0_4px_20px_rgb(0,0,0,0.06)] border border-black/5 w-fit mb-8">
              <span className="w-2.5 h-2.5 rounded-full bg-[#25D366] animate-pulse block shrink-0" />
              <span className="text-[12px] font-mono uppercase tracking-widest text-black/60 font-semibold">Protocol Active</span>
            </div>

            <h1 className="text-[52px] xl:text-[64px] font-black tracking-[-0.04em] leading-[1.05] text-black mb-6">
              Sovereign Identity Protocol
            </h1>

            <p className="text-[18px] text-neutral-500 leading-[1.6] font-medium mb-12 max-w-[480px]">
              Connect to Humanity Ledger to access your decentralized portfolio, participate in zero-knowledge governance, and communicate securely over the XMTP network.
            </p>

            <div className="grid grid-cols-2 gap-x-8 gap-y-10 w-full">
              <div className="flex flex-col gap-2">
                <div className="w-10 h-10 rounded-xl bg-black/5 flex items-center justify-center text-black mb-1">
                  <Shield size={20} strokeWidth={1.5} />
                </div>
                <h3 className="font-bold text-[15px] text-black">Zero-Knowledge</h3>
                <p className="text-[13px] text-black/50 leading-relaxed">Cryptographic proofs via Aztec Network. Validate identity without exposing personal data.</p>
              </div>
              <div className="flex flex-col gap-2">
                <div className="w-10 h-10 rounded-xl bg-black/5 flex items-center justify-center text-black mb-1">
                  <Lock size={20} strokeWidth={1.5} />
                </div>
                <h3 className="font-bold text-[15px] text-black">End-to-End Encrypted</h3>
                <p className="text-[13px] text-black/50 leading-relaxed">Direct messaging via XMTP. Fully decentralized communication channels.</p>
              </div>
              <div className="flex flex-col gap-2">
                <div className="w-10 h-10 rounded-xl bg-black/5 flex items-center justify-center text-black mb-1">
                  <Wallet size={20} strokeWidth={1.5} />
                </div>
                <h3 className="font-bold text-[15px] text-black">Sovereign Asset Hub</h3>
                <p className="text-[13px] text-black/50 leading-relaxed">Institutional-grade dashboard to track, stake, and secure digital assets.</p>
              </div>
              <div className="flex flex-col gap-2">
                <div className="w-10 h-10 rounded-xl bg-black/5 flex items-center justify-center text-black mb-1">
                  <CheckCircle2 size={20} strokeWidth={1.5} />
                </div>
                <h3 className="font-bold text-[15px] text-black">EIP-4361 Standard</h3>
                <p className="text-[13px] text-black/50 leading-relaxed">Sign-In with Ethereum authentication. You are the sole custodian of your session.</p>
              </div>
            </div>
          </motion.div>

          {/* Bottom links */}
          <div className="relative z-20 flex items-center justify-between text-[11px] font-medium text-neutral-400">
            <span>© 2026 Humanity Ledger Protocol</span>
            <div className="flex items-center gap-6">
              <Link href="/docs/whitepaper" className="hover:text-black transition-colors">Whitepaper</Link>
              <Link href="/docs/terms" className="hover:text-black transition-colors">Terms</Link>
              <Link href="/docs/privacy" className="hover:text-black transition-colors">Privacy</Link>
            </div>
          </div>
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
                    <>
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

