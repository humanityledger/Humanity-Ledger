"use client";
import React, { useState, useEffect, useCallback, useRef, useMemo } from "react";
import { createPortal } from "react-dom";
import { motion, AnimatePresence, useScroll, useTransform } from "framer-motion";
import dynamic from "next/dynamic";
import { ZKBiometricGate } from "@/components/security/ZKBiometricGate";
import { SystemFooter } from "./SystemFooter";
import { useSearchParams, useRouter } from "next/navigation";
import Link from "next/link";
import { useAccount, useConnect, useSignMessage, useDisconnect, useReconnect, useBalance, useEnsName } from "wagmi";
import { reconnect as wagmiReconnect, watchAccount, getAccount, getConnectorClient } from '@wagmi/core';
import { config as wagmiConfig } from '@/config/appkit';
import { useAppKit } from "@reown/appkit/react";
import { HLLogo } from "@/components/shared/HLLogo";
import { useSystemSignOut } from '@/hooks/useSystemSignOut';
import { 
  Scan, MessageSquare, LogOut, MessageCircle, ScanLine, 
  Fingerprint, ChevronDown, CheckCircle, Zap, Shield, Menu,
  ArrowLeft, ArrowRight, Loader2, CheckCircle2, AlertCircle, RefreshCw, Mail, Info, X, PieChart,
  Newspaper, GraduationCap, Briefcase, Activity, TrendingUp, Package, LayoutDashboard, Target
} from 'lucide-react';
import { RemoteLottie } from '@/components/ui/RemoteLottie';
import { SafeErrorBoundary } from '@/components/ui/SafeErrorBoundary';
import { ImmersiveManifestoLanding } from "./ImmersiveManifestoLanding";
import { HumanityLedgerTweetFeed } from "./HumanityLedgerTweetFeed";
import { EmailLoginModal } from "@/components/auth/EmailLoginModal";


//  Reown AppKit + WagmiAdapter localStorage key patterns 
// These are ALL the keys that Reown AppKit v1/v2 and its WagmiAdapter write
// to localStorage (2025-2026). We scan ALL of them when recovering a session.
const APPKIT_STORAGE_KEYS = [
  '@wagmi/core',
  'wagmi.store',
  'wagmi.connected',
  'reown-appkit',
  'appkit',
  '@reown/appkit',
  'W3M_STATE',
  '@w3m/',
  'wc@2:',
  'wc@2',
  'walletconnect',
  'wagmi',
  'rainbow',
  'metamask',
  'coinbase',
  'session'
];

function extractAddressFromAppKit(value: string): string | null {
  if (!value || value.length < 42) return null;
  try {
    const parsed = JSON.parse(value);
    // All known Reown AppKit v2 + Wagmi v2 address paths
    const possiblePaths = [
      parsed?.state?.connections?.value?.[0]?.[1]?.accounts?.[0],
      parsed?.state?.data?.account?.address,
      parsed?.sessions?.[0]?.namespaces?.eip155?.accounts?.[0]?.split?.(':')?.[2],
      parsed?.namespaces?.eip155?.accounts?.[0]?.split?.(':')?.[2],
      // Support for WalletConnect v2 Array structure
      parsed?.[0]?.namespaces?.eip155?.accounts?.[0]?.split?.(':')?.[2],
      parsed?.address,
      parsed?.accounts?.[0],
      parsed?.account?.address,
    ];
    for (const candidate of possiblePaths) {
      if (candidate && typeof candidate === 'string') {
        // Clean potential "eip155:1:" prefix if split failed
        const clean = candidate.includes(':') ? candidate.split(':').pop() : candidate;
        if (clean && /^0x[a-fA-F0-9]{40}$/i.test(clean)) {
          return clean.toLowerCase();
        }
      }
    }
  } catch {
    // Not valid JSON  fall through to regex
  }
  // Final fallback: extract any valid Ethereum address from raw string
  const match = value.match(/0x[a-fA-F0-9]{40}(?![a-fA-F0-9])/i);
  return match ? match[0].toLowerCase() : null;
}

//  Active clock hook 
function useActiveClock(intervalMs = 1000): Date {
  const [now, setNow] = useState(() => new Date());
  useEffect(() => {
    const id = setInterval(() => setNow(new Date()), intervalMs);
    return () => clearInterval(id);
  }, [intervalMs]);
  return now;
}

// Universal scanner — session QR, wallet, product passport, GS1
const DynamicUniversalScanModal = dynamic(
  () => import("@/components/scan/UniversalScanModal"),
  { ssr: false }
);


//  Colour tokens 
const IVORY = "#FFFFFF";
const INK   = "#050505";
const FAINT = "rgba(5,5,5,0.08)";
const MUTED = "rgba(5,5,5,0.50)";

//  System sign message (must mirror LinkedGate exactly) 
function buildSystemMessage(address: string): string {
  return [
    '',
    '  Humanity Ledger',
    '  SECURE ACCESS HANDSHAKE',
    '',
    '',
    `Identity: ${address}`,
    `Nonce: ${Date.now()}`,
    `Network: HUMANITY_LEDGER_IDENTITY_NETWORK`,
    `Connected at: ${new Date().toISOString().slice(0, 19).replace('T', ' ')}`,
    `Status: VERIFIED_IDENTITY_CLAIM`,
    'By signing you confirm that',
    'you are the sole owner of this',
    'address and authorize access',
    'to the secure dashboard.',
    '',
  ].join('\n');
}

//  Wallet button 
function WalletOption({
  logo, name, badge, onClick, delay = 0, loading = false,
}: {
  logo: string; name: string; badge: string;
  onClick: () => void; delay?: number; loading?: boolean;
}) {
  return (
    <motion.button
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay, ease: [0.16, 1, 0.3, 1], duration: 0.5 }}
      onClick={onClick}
      disabled={loading}
      className="group w-full flex items-center gap-4 p-4 rounded-2xl border border-black/10 bg-white hover:bg-black/[0.02] hover:border-black/20 active:scale-[0.97] transition-all duration-200 shadow-sm disabled:opacity-60"
    >
      <div className="w-11 h-11 rounded-xl bg-black/[0.03] border border-black/5 flex items-center justify-center p-2 overflow-hidden shrink-0">
        {loading ? (
          <Loader2 size={20} className="animate-spin text-black/40" />
        ) : (
          <img src={logo} alt={name} className="w-full h-full object-contain" />
        )}
      </div>
      <div className="flex-1 text-left">
        <p className="text-[13px] font-black uppercase tracking-tight text-[#050505]">{name}</p>
        <p className="text-[10px] font-mono text-[#050505]/40 uppercase tracking-widest mt-0.5">
          {loading ? "Opening app" : badge}
        </p>
      </div>
      {!loading && (
        <ArrowRight size={14} className="text-[#050505]/20 group-hover:text-[#050505] group-hover:translate-x-0.5 transition-all shrink-0" />
      )}
    </motion.button>
  );
}

//  Signing overlay 
function SigningOverlay({
  address, onSigned, onRetry, onOpenWallet, error, isSigning, wcDeepLink,
}: {
  address: string;
  onSigned: () => void;
  onRetry: () => void;
  /** Opens the Reown AppKit / WalletConnect wallet-selector so the user can approve the signature */
  onOpenWallet: () => void;
  error: string | null;
  isSigning: boolean;
  wcDeepLink?: string | null;
}) {
  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.96 }}
      animate={{ opacity: 1, scale: 1 }}
      className="fixed inset-0 z-[9999] flex items-center justify-center p-6"
      style={{ background: "rgba(255,255,255,0.98)", backdropFilter: "blur(24px)", WebkitBackdropFilter: "blur(24px)" }}
    >
      <div className="w-full max-w-sm flex flex-col items-center gap-5 text-center">
        <div className="w-20 h-20 rounded-[2rem] bg-white border border-black/10 shadow-lg flex items-center justify-center">
          {isSigning ? (
            <RefreshCw size={28} className="text-black/40 animate-spin" />
          ) : error ? (
            <AlertCircle size={28} className="text-red-500" />
          ) : (
            <Fingerprint size={28} className="text-[#050505]" />
          )}
        </div>

        <div className="flex items-center gap-2 px-4 py-2 bg-white border border-black/10 rounded-full shadow-sm">
          <span className="text-[11px] font-black uppercase tracking-widest text-[#050505]/60 font-mono">
            {address.slice(0, 8)}{address.slice(-6)}
          </span>
        </div>

        <div className="space-y-2">
          <h2 className="text-[24px] font-black tracking-tighter text-[#050505] leading-none">
            {isSigning ? "Signature Required" : error ? "Connection Failed" : "Connecting..."}
          </h2>
          <p className="text-[12px] text-[#050505]/50 leading-relaxed">
            {error
              ? "Could not cryptographically verify the wallet. Please try again."
              : isSigning
              ? "Open your wallet and approve the signature request to complete login."
              : "Initializing secure session... Please wait."}
          </p>
        </div>

        {error && (
          <motion.div
            initial={{ opacity: 0, y: -8 }}
            animate={{ opacity: 1, y: 0 }}
            className="w-full px-4 py-3 bg-red-50 border border-red-100 rounded-2xl text-red-600 text-[11px] font-black uppercase tracking-widest"
          >
            {error}
          </motion.div>
        )}

        {error ? (
          /* Error state: primary = open wallet to retry, secondary = just retry session */
          <div className="w-full flex flex-col gap-3">
            <button
              onClick={onOpenWallet}
              className="w-full py-4 rounded-2xl bg-white text-white font-black uppercase tracking-widest text-[12px] flex items-center justify-center gap-3 shadow-lg active:scale-[0.97] transition-all hover:bg-black/90"
            >
              <Fingerprint size={16} />
              Open Wallet & Retry
            </button>
            <button
              onClick={onRetry}
              className="w-full py-3 rounded-2xl bg-transparent border border-black/15 text-[#050505]/60 font-black uppercase tracking-widest text-[11px] flex items-center justify-center gap-2 active:scale-[0.97] transition-all"
            >
              <RefreshCw size={13} />
              Retry Without Opening Wallet
            </button>
          </div>
        ) : isSigning ? (
          <div className="w-full flex flex-col gap-3 mt-2">
            {wcDeepLink ? (
              /* Deep-link available (WalletConnect QR scanned on desktop → mobile deep-link) */
              <a
                href={wcDeepLink}
                rel="noopener noreferrer"
                className="w-full py-4 rounded-2xl bg-white text-white font-black uppercase tracking-widest text-[12px] flex items-center justify-center gap-3 shadow-lg active:scale-[0.97] transition-transform select-none hover:bg-black/90"
              >
                Open Wallet App
              </a>
            ) : (
              /* No deep-link → open the Reown AppKit modal so user picks their wallet */
              <button
                onClick={onOpenWallet}
                className="w-full py-4 rounded-2xl bg-white text-white font-black uppercase tracking-widest text-[12px] flex items-center justify-center gap-3 shadow-lg active:scale-[0.97] transition-all hover:bg-black/90"
              >
                <Fingerprint size={16} />
                Tap to Sign &amp; Complete Login
              </button>
            )}
          </div>
        ) : (
          <div className="w-full px-4 py-3 rounded-2xl border border-black/10 bg-white flex items-center justify-center gap-3">
            <Loader2 size={16} className="animate-spin text-black/40" />
            <span className="text-[#050505] font-black uppercase tracking-widest text-[11px]">Validating...</span>
          </div>
        )}
      </div>
    </motion.div>
  );
}

//  Network name from chain ID 
function chainName(id?: number): string {
  const MAP: Record<number, string> = {
    1: 'Ethereum Mainnet', 10: 'Optimism', 56: 'BNB Chain',
    137: 'Polygon', 8453: 'Base', 42161: 'Arbitrum One',
    43114: 'Avalanche', 100: 'Gnosis', 250: 'Fantom',
    324: 'zkSync Era', 59144: 'Linea', 1101: 'Polygon zkEVM',
  };
  return id ? (MAP[id] ?? `Chain ${id}`) : 'Mainnet';
}

//  Connected Screen 
function ConnectedScreen({
  address, onScan, onScanLabel, showScanner, onCloseScanner, scanMode, onBack, connectorName, chainId, onDisconnect, signMessageAsync, initialScanData, setShowKyc
}: {
  address: string; onScan: () => void; onScanLabel: () => void;
  showScanner: boolean; onCloseScanner: () => void;
  scanMode: 'universal' | 'session-only';
  onBack?: () => void;
  connectorName?: string;
  chainId?: number;
  onDisconnect?: () => void;
  signMessageAsync?: any;
  initialScanData?: string | null;
  setShowKyc: (v: boolean) => void;
}) {
  const now = useActiveClock();
  const [showInfoModal, setShowInfoModal] = useState(false);
  const [userAgentInfo, setUserAgentInfo] = useState('');
  const [sessionHistory, setSessionHistory] = useState<any[]>([]);

  const { data: balance } = useBalance({ address: address as `0x${string}` });
  const { data: ensName } = useEnsName({ address: address as `0x${string}`, chainId: 1 });
  const { connector } = useAccount();

  const fmtBalance = () => {
    if (!balance) return null;
    const val = parseFloat(balance.formatted);
    return `${val.toFixed(4)} ${balance.symbol}`;
  };

  useEffect(() => {
    if (typeof window !== 'undefined') {
       const ua = navigator.userAgent;
       let os = "Unknown OS";
       if (ua.indexOf("Win") != -1) os = "Windows";
       if (ua.indexOf("Mac") != -1) os = "MacOS";
       if (ua.indexOf("Linux") != -1) os = "Linux";
       if (ua.indexOf("Android") != -1) os = "Android";
       if (ua.indexOf("like Mac") != -1) os = "iOS";
       const detectedOs = `${os} (${navigator.vendor || "Browser"})`;
       setUserAgentInfo(detectedOs);
       
       if (address) {
         const key = `system_history_${address}`;
         let existing: any[] = [];
         try {
             const stored = localStorage.getItem(key);
             if (stored) {
                 const parsed = JSON.parse(stored);
                 if (Array.isArray(parsed)) existing = parsed;
             }
         } catch (e) {
             existing = [];
         }

         const currentSession = {
           date: new Date().toLocaleDateString('en-US', { weekday: 'long', day: '2-digit', month: 'long', year: 'numeric' }),
           time: new Date().toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', second: '2-digit' }),
           provider: connectorName || "Secure Wallet",
           os: detectedOs
         };
         
         const isDuplicate = existing.length > 0 && existing[0].time === currentSession.time && existing[0].date === currentSession.date;
         let updated = existing;
         
         if (!isDuplicate) {
           updated = [currentSession, ...existing].slice(0, 50);
           try {
               localStorage.setItem(key, JSON.stringify(updated));
           } catch (e) {}
         }
         setSessionHistory(updated);
       }
    }
  }, [address, connectorName]);

  const fmtTime   = (d: Date) => d.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', second: '2-digit' });
  const fmtDate   = (d: Date) => d.toLocaleDateString('en-US', { weekday: 'long', day: '2-digit', month: 'long', year: 'numeric' });

  return (
    <div className="relative w-full h-full overflow-x-hidden overflow-y-auto font-sans flex flex-col bg-white selection:bg-black/10 selection:text-black" style={{ color: '#000000' }}>
      {/* Background soft ambient noise/gradient */}
      <div className="absolute inset-0 pointer-events-none bg-[radial-gradient(ellipse_at_top,_var(--tw-gradient-stops))] from-black/[0.01] via-white to-white" />
      
      <main className="relative z-10 flex-1 flex flex-col items-center px-6 pt-10 pb-16 gap-0 max-w-[480px] w-full mx-auto">
        {/* TOP BAR */}
        <motion.div
          initial={{ opacity: 0, y: -10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, ease: [0.16, 1, 0.3, 1] }}
          className="w-full flex items-center justify-between mb-12 bg-transparent relative"
        >
          {onBack ? (
            <button
              onClick={onBack}
              className="p-3 -ml-3 text-black/40 hover:text-black active:scale-95 transition-all rounded-full hover:bg-black/5"
              aria-label="Back"
            >
              <ArrowLeft size={22} strokeWidth={1.5} />
            </button>
          ) : (
            <div className="w-8" />
          )}
          
          <div className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2">
             <img
               src="/logo-mark.png"
               className="h-20 w-auto object-contain"
               alt="Humanity Ledger"
             />
          </div>
          
          <div className="w-8" />
        </motion.div>

        {/* HERO TIME SECTION */}
        <motion.div
          initial={{ opacity: 0, scale: 0.98 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ delay: 0.1, duration: 0.8, ease: [0.16, 1, 0.3, 1] }}
          className="w-full flex flex-col items-center justify-center text-center mb-12"
        >
          <p className="text-[64px] sm:text-[76px] font-light tracking-tight leading-none text-black drop-shadow-sm tabular-nums">
            {fmtTime(now)}
          </p>
          <p className="font-mono text-[10px] uppercase tracking-[0.25em] text-black/40 mt-4">
            {fmtDate(now)}
          </p>
        </motion.div>

        {/* IDENTITY BLOCK - ULTRA MINIMAL */}
        <motion.div
          initial={{ opacity: 0, y: 15 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.2, duration: 0.6, ease: [0.16, 1, 0.3, 1] }}
          className="w-full mb-10 flex flex-col items-center"
        >
          <div className="bg-white/40 backdrop-blur-md border border-black/5 rounded-full px-6 py-3 shadow-sm hover:shadow-md transition-shadow">
            <p className="font-mono text-[12px] sm:text-[14px] font-medium text-black tracking-widest text-center">
              {address ? `${address.slice(0, 6)}...${address.slice(-4)}` : ''}
            </p>
          </div>
          {ensName && (
            <p className="font-mono text-[10px] uppercase tracking-widest text-black/50 mt-3">{ensName}</p>
          )}
        </motion.div>

        {/* STATS ROW */}
        <motion.div
          initial={{ opacity: 0, y: 15 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.3, duration: 0.6, ease: [0.16, 1, 0.3, 1] }}
          className="w-full flex justify-between items-center mb-12 px-2"
        >
          {[
            { label: 'Network', value: chainName(chainId) },
            { label: 'Balance', value: fmtBalance() ?? '0.00' },
            { label: 'Provider', value: connectorName || 'Secure' },
          ].map((item, i) => (
            <div key={i} className="flex flex-col items-center flex-1">
              <p className="font-mono text-[8px] uppercase tracking-[0.2em] text-black/40 mb-2">{item.label}</p>
              <p className="font-mono text-[11px] font-bold text-black truncate max-w-[100px]">{item.value}</p>
            </div>
          ))}
        </motion.div>

        {/* APPS SPRINGBOARD - REDESIGNED HIGH-END GRID */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.4, duration: 0.7, ease: [0.16, 1, 0.3, 1] }}
          className="w-full grid grid-cols-2 gap-4 mb-14"
        >
          {[
            { label: 'App Hub', href: '/hub', icon: <LayoutDashboard size={22} strokeWidth={1.5} />, color: 'bg-[#1C1C1E] text-white', border: 'border-transparent' },
            { label: 'Link Session', action: onScan, icon: <ScanLine size={22} strokeWidth={1.5} />, color: 'bg-white text-black', border: 'border-black/10' },
            { label: 'Ledger Chat', href: '/chat', icon: <MessageSquare size={22} strokeWidth={1.5} />, color: 'bg-[#1c7aff] text-white', border: 'border-transparent' },
            { label: 'Portfolio', href: '/portfolio', icon: <PieChart size={22} strokeWidth={1.5} />, color: 'bg-[#f5f5f7] text-black', border: 'border-transparent' },
            { label: 'Studio', href: '/studio/provenance', icon: <Package size={22} strokeWidth={1.5} />, color: 'bg-gradient-to-tr from-purple-500 to-indigo-600 text-white', border: 'border-transparent' },
            { label: 'Developer Sandbox', href: '/sandbox', icon: <Fingerprint size={22} strokeWidth={1.5} />, color: 'bg-black text-white', border: 'border-transparent' },
          ].map((app, i) => {
            const InnerContent = (
              <div className={`flex flex-col justify-between p-4 h-[120px] rounded-[24px] border ${app.border} ${app.color} shadow-sm hover:shadow-md hover:scale-[1.02] active:scale-[0.98] transition-all duration-300 cursor-pointer`}>
                <div className="opacity-80">{app.icon}</div>
                <span className="font-sans text-[15px] font-semibold tracking-tight">
                  {app.label}
                </span>
              </div>
            );

            return app.action ? (
              <button key={i} type="button" onClick={app.action} className="w-full text-left appearance-none">
                {InnerContent}
              </button>
            ) : (
              <Link key={i} href={app.href!} className="w-full block">
                {InnerContent}
              </Link>
            );
          })}
        </motion.div>

        {/* DISCONNECT BUTTON */}
        {onDisconnect && (
          <motion.button
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.6, duration: 0.5 }}
            whileTap={{ scale: 0.95 }}
            onClick={onDisconnect}
            className="mt-auto flex items-center justify-center gap-3 px-8 py-4 rounded-full border border-black/10 bg-white font-mono text-[9px] uppercase tracking-[0.25em] text-black/40 hover:text-black hover:border-black/30 hover:shadow-lg transition-all duration-300"
          >
            <LogOut size={14} strokeWidth={1.5} />
            End Session / Change Wallet
          </motion.button>
        )}
      </main>

      <DynamicUniversalScanModal
        isOpen={showScanner}
        onClose={onCloseScanner}
        address={address}
        mode={scanMode}
        initialScanData={initialScanData}
        onScan={async (result: string) => {
          onCloseScanner();
          // We no longer call completeSessionHandshake here!
          // UniversalScanModal already handles the handshake and PIN verification internally.
          // This callback is only for dismissing the scanner and showing a generic toast if needed.
          const toast = document.createElement('div');
          toast.className = 'fixed top-6 left-4 right-4 z-[99999] bg-black text-white text-[10px] border border-white/10 font-mono uppercase tracking-[0.3em] px-6 py-5 rounded-2xl shadow-2xl text-center';
          toast.textContent = 'Scan complete';
          document.body.appendChild(toast);
          setTimeout(() => toast.remove(), 3000);
        }}
      />
    </div>
  );
}
//  Main Component 
export function MobileLanding() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const sessionParam = searchParams?.get('session');

  //  Reown AppKit is the PRIMARY connector 
  const { address: wagmiAddress, isConnected: wagmiConnected, connector, chainId, status: accountStatus } = useAccount();
  const { connect, connectAsync, connectors } = useConnect();
  const { signMessageAsync } = useSignMessage();
  const { disconnect, disconnectAsync } = useDisconnect();
  const { reconnect } = useReconnect();
  const { open: rkOpenModal, close: rkCloseModal } = useAppKit();

  //  Ref: always holds the latest wagmiAddress for use inside setInterval closures 
  // setInterval captures variables at creation time (stale closure). Without a ref,
  // the poll would never see wagmiAddress updating when wagmi hydrates from cookies.
  const wagmiAddressRef = useRef<string | undefined>(undefined);
  const isSigningRef = useRef(false);
  useEffect(() => { wagmiAddressRef.current = wagmiAddress; }, [wagmiAddress]);
  // Tracks active polling interval so onFocusRecheck can cancel previous runs
  const pollIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  let isGuarded = false;
  try {
    if (typeof window !== 'undefined') {
      isGuarded = sessionStorage.getItem("__disconnected__") === "1" || localStorage.getItem("__disconnected__") === "1";
    }
  } catch {}

  const [mounted, setMounted]           = useState(false);
  const isConnected = mounted && wagmiConnected && !isGuarded;
  const address     = wagmiAddress;
  const [showScanner, setShowScanner]   = useState(false);
  const [scanMode, setScanMode] = useState<'universal' | 'session-only'>('session-only');
  const [showHub, setShowHub]           = useState(false);
  const [showDebug, setShowDebug]       = useState(false);  // secret debug panel
  const [debugTaps, setDebugTaps]       = useState(0);
  // Always false on SSR. Reads from sessionStorage after mount to survive Chrome
  // tab freeze/restore (which resets React state when user returns from Rainbow).
  const [showManualReconnect, setShowManualReconnectRaw] = useState(false);
  const setShowManualReconnect = (val: boolean) => {
    try { sessionStorage.setItem('system_show_reconnect', val ? '1' : '0'); } catch {}
    setShowManualReconnectRaw(val);
  };

  // Init isLinked from cookie immediately  no flash
  const [isLinked, setIsLinked] = useState<boolean>(() => {
    if (typeof document === 'undefined') return false;
    return document.cookie.split('; ').some(r => r.startsWith('system_handshake=0x'));
  });

  // linkedAddress: set synchronously in performLink so effectiveAddress
  // is NEVER null after connection  critical for incognito mode where
  // wagmi/appkit re-hydration is delayed and cookieAddress memo lags.
  const [linkedAddress, setLinkedAddress] = useState<string | null>(() => {
    if (typeof document === 'undefined') return null;
    const match = document.cookie.match(/system_handshake=(0x[0-9a-fA-F]{40,})/i);
    return match?.[1] ?? null;
  });

  // Cookie address fallback (when wagmi hasn't reconnected yet)
  const cookieAddress = useMemo<string | null>(() => {
    if (typeof document === 'undefined') return null;
    const match = document.cookie.match(/system_handshake=(0x[0-9a-fA-F]{40,})/i);
    return match?.[1] ?? null;
  }, [isLinked]);

  // Prefer linkedAddress (set in performLink)  wagmi address  cookie fallback
  const effectiveAddress = linkedAddress || address || cookieAddress || undefined;

  // Auto-sync for mobile camera scans
  const uuidParam = searchParams?.get('uuid') || searchParams?.get('s');
  const [autoSyncStarted, setAutoSyncStarted] = useState(false);

  useEffect(() => {
    if (uuidParam && !autoSyncStarted) {
      if (isLinked && effectiveAddress) {
        setAutoSyncStarted(true);
        
        // [PIN FIX] Do NOT call completeSessionHandshake directly here!
        // We must pass the URL to UniversalScanModal so it can prompt the user for the 4-digit PIN.
        setShowScanner(true);
        
      } else {
        // If they are not linked, we wait until they connect. The useEffect will re-run
        // once isLinked and effectiveAddress become true.
        setShowConnectOverlay(true);
      }
    }
  }, [isLinked, effectiveAddress, uuidParam, autoSyncStarted]);

  const [isActuallySigning, setIsActuallySigning] = useState(false);
  const signingInProgressRef = useRef(false);
  const [signingError, setSigningError] = useState<string | null>(null);
  const [showKyc, setShowKyc] = useState(false);
  const [isVerified, setIsVerified] = useState(false);

  // Show the connect overlay immediately for unauthenticated users (Scroll.io pattern).
  // If the user already has an active session (system_handshake cookie) we start with
  // the overlay hidden so they see the landing page cleanly without a modal flash.
  const [showConnectOverlay, setShowConnectOverlay] = useState(() => {
    if (typeof document === 'undefined') return true;
    const alreadyConnected = document.cookie.split('; ').some(r => r.startsWith('system_handshake=0x'));
    return !alreadyConnected;
  });
  const [connecting, setConnecting] = useState<string | null>(null);
  // Emergency "I already connected" button  appears 3.5s after clicking a wallet button
  const [showFallbackBtn, setShowFallbackBtn] = useState(false);
  const [fallbackStatus, setFallbackStatus] = useState<'idle' | 'checking' | 'failed'>('idle');
  //  Direct deep-link state 
  // Populated after wagmi's walletConnect connector emits 'display_uri'.
  // We render a native <a href> with this URI  bypasses AppKit's shadow DOM
  // which causes Chrome Android to silently block metamask:// navigations.
  const [wcDeepLink, setWcDeepLink] = useState<string | null>(null);
  const [wcTargetWallet, setWcTargetWallet] = useState<string>('metamask');
  const [emailModalOpen, setEmailModalOpen] = useState(false);

  useEffect(() => {
    setMounted(true);
    // Restore button state from sessionStorage (survives Chrome tab freeze/restore)
    try {
      if (sessionStorage.getItem('system_show_reconnect') === '1') {
        setShowManualReconnectRaw(true);
      }
    } catch {}

    // [IOS BFCACHE CRITICAL FIX] Reset stuck signing ref on mount.
    // On iOS WKWebView bfcache restore: React state is reset (isActuallySigning  false)
    // but useRef values PERSIST across bfcache restores. If the user backgrounded the tab
    // mid-signing (to open their wallet), signingInProgressRef.current stays 'true' forever,
    // silently blocking every future signing attempt via the guard:
    //   if (isLinked || isActuallySigning || signingInProgressRef.current) return;
    // This is THE primary cause of "Connect button does nothing" on iOS Chrome after
    // returning from MetaMask/Trust Wallet via deep-link or universal link.
    signingInProgressRef.current = false;

    // [IOS REOWN OAUTH REDIRECT FIX] Detect when AppKit social auth (Google/Apple) redirects back.
    // Reown adds `?wc-redirect` or `#wc-auth` to the URL after completing OAuth on mobile.
    // On iOS, this redirect is a full page navigation (not a postMessage), so React mounts fresh.
    // We detect this, clear stale auth state, and allow wagmi's post-redirect reconnection to work.
    try {
      const urlParams = new URLSearchParams(window.location.search);
      const urlHash = window.location.hash;
      const isOAuthReturn = (
        urlParams.has('wc-redirect') ||
        urlParams.has('code') ||
        urlParams.has('state') ||
        urlHash.includes('wc-auth') ||
        urlHash.includes('access_token') ||
        // Reown's own redirect marker
        document.referrer.includes('accounts.reown.com') ||
        document.referrer.includes('auth.reown.com') ||
        document.referrer.includes('accounts.google.com')
      );
      if (isOAuthReturn) {
        console.log('[System:iOS] OAuth redirect return detected  clearing stale auth state for clean reconnect');
        // Remove stale cached signatures that predate this OAuth session
        try {
          const keysToRemove: string[] = [];
          for (let i = 0; i < localStorage.length; i++) {
            const k = localStorage.key(i);
            if (k && k.startsWith('system_auth_')) keysToRemove.push(k);
          }
          keysToRemove.forEach(k => localStorage.removeItem(k));
        } catch {}
        // Clear the pending wakeup flag since we just completed an OAuth flow
        try { localStorage.removeItem('system_pending_wakeup'); } catch {};
        try { sessionStorage.removeItem('system_show_reconnect'); } catch {};
        // Clean the URL to remove OAuth params without triggering a reload
        try {
          const cleanUrl = window.location.pathname + window.location.search
            .replace(/[?&]code=[^&]*/g, '')
            .replace(/[?&]state=[^&]*/g, '')
            .replace(/^&/, '?');
          window.history.replaceState({}, '', cleanUrl || window.location.pathname);
        } catch {}
      }
    } catch {}
  }, []);

  // 
  // SECURE HANDSHAKE: Verifies wallet ownership via cryptographic proof
  // 
  const establishSession = useCallback(async (addr: string) => {
    if (isLinked || isActuallySigning || signingInProgressRef.current) return;

    signingInProgressRef.current = true;
    const norm = addr.toLowerCase();

    // 1. First, check if we already have a valid server session
    try {
      const checkRes = await fetch('/api/auth/verify-session', { cache: 'no-store', credentials: 'include' });
      if (checkRes.ok) {
        const data = await checkRes.json();
        if (data.authenticated && data.user?.address?.toLowerCase() === norm) {
           console.log('[Auth] Existing session valid for:', norm);
           setLinkedAddress(norm);
           setIsLinked(true);
           signingInProgressRef.current = false;
           return;
        }
      }
    } catch (e) {
      console.warn('[Auth] Session check failed, proceeding to sign');
    }

    // 2. Requires SIWE-sign to establish session securely
    setIsActuallySigning(true);
    setSigningError(null);

    try {
      // [QUANTUM AEGIS] Real SIWE Signature Generation
      const nonceRes = await fetch('/api/auth/nonce', { cache: 'no-store' });
      if (!nonceRes.ok) throw new Error('Failed to fetch cryptographic nonce');
      const { nonce } = await nonceRes.json();

      const message = `Authenticate to Humanity Ledger.\n\nNonce: ${nonce}`;
      let signature = '';

      // ═══════════════════════════════════════════════════════════════════════
      // [MOBILE CONNECTION FIX - MAXIMUM QUANTUM EDITION]
      //
      // PROBLEM: wagmi v2.16.0 throws "Connector not connected" on iOS/Android
      // because the WalletConnect WebSocket relay is CLOSED when returning from
      // a wallet app via deep-link. The relay needs time to re-handshake, and
      // wagmi's status can say 'connected' while the underlying WS is still dead.
      //
      // THREE-LAYER DEFENSE:
      //
      // LAYER 1 — watchAccount: Wait for wagmi state machine to reach 'connected'.
      //   - Fires when wagmi finishes reading session from cookieStorage.
      //   - Necessary but NOT sufficient: status can be 'connected' while WS is down.
      //
      // LAYER 2 — getConnectorClient probe: Repeatedly call getConnectorClient()
      //   which internally calls connector.getClient() → tries to use the provider.
      //   This is the DEFINITIVE readiness signal: if it succeeds, signing WILL work.
      //   If it throws ConnectorUnavailableReconnectingError, the WC relay is busy.
      //   We retry up to 10× (10s) with a fresh wagmiReconnect() every 2 probes.
      //
      // LAYER 3 — EIP-1193 raw fallback: If all wagmi paths fail, bypass the
      //   connector layer entirely and call provider.request('personal_sign')
      //   directly. This works in MetaMask/Coinbase in-app dapp browsers where
      //   window.ethereum is injected even when WC is broken.
      // ═══════════════════════════════════════════════════════════════════════
      let lastErr: any = null;

      // ── LAYER 1: Kick off reconnection, then wait for 'connected' status ──
      try { wagmiReconnect(wagmiConfig).catch(() => {}); } catch {}

      await new Promise<void>((resolveLayer1) => {
        const cur = getAccount(wagmiConfig);
        if (cur.status === 'connected') {
          console.log('[Auth:Mobile] L1: already connected, fast-path');
          resolveLayer1();
          return;
        }
        console.log(`[Auth:Mobile] L1: waiting for status=connected (current: ${cur.status})`);
        let done = false;
        const unwatch = watchAccount(wagmiConfig, {
          onChange(acc) {
            if (done) return;
            console.log(`[Auth:Mobile] L1 watchAccount: ${acc.status}`);
            if (acc.status === 'connected') {
              done = true;
              unwatch();
              resolveLayer1();
            }
          }
        });
        // 12s hard timeout — layer 2 probe will catch remaining failures
        setTimeout(() => {
          if (!done) {
            done = true;
            unwatch();
            console.warn('[Auth:Mobile] L1: 12s timeout, advancing to layer 2');
            resolveLayer1();
          }
        }, 12000);
      });

      // ── LAYER 2: Probe getConnectorClient until the WC relay is actually up ──
      // getConnectorClient() calls connector.getClient() internally.
      // If it succeeds → the EVM provider is live → signing WILL work.
      // Throws ConnectorUnavailableReconnectingError while WC relay is reconnecting.
      let relayReady = false;
      for (let probe = 0; probe < 10; probe++) {
        try {
          const freshAcc = getAccount(wagmiConfig);
          if (!freshAcc.connector) {
            // No connector yet — wagmi hasn't finished reconnecting
            throw new Error('no connector');
          }
          await getConnectorClient(wagmiConfig);
          relayReady = true;
          console.log(`[Auth:Mobile] L2: relay ready after ${probe} probes`);
          break;
        } catch (probeErr: any) {
          const probeMsg = probeErr?.message?.toLowerCase() ?? '';
          const isRecoverable = (
            probeMsg.includes('reconnecting') ||
            probeMsg.includes('unavailable') ||
            probeMsg.includes('not connected') ||
            probeMsg.includes('no connector') ||
            probeMsg.includes('provider')
          );
          console.warn(`[Auth:Mobile] L2 probe ${probe+1}/10: ${probeErr?.message}`);
          if (!isRecoverable) break; // Non-connection error, stop probing
          // Every 2 failed probes, retry the reconnect cycle
          if (probe % 2 === 1) {
            try { wagmiReconnect(wagmiConfig).catch(() => {}); } catch {}
          }
          // Also try: if window.ethereum exists (dapp browser), reconnect via injected
          if (probe === 4 && typeof window !== 'undefined' && (window as any).ethereum) {
            console.log('[Auth:Mobile] L2: detected window.ethereum, attempting injected reconnect');
          }
          await new Promise(r => setTimeout(r, 1000));
        }
      }
      console.log(`[Auth:Mobile] L2 complete. relayReady=${relayReady}, status=${getAccount(wagmiConfig).status}`);

      // ── LAYER 3A: Sign via wagmi (preferred path) ──
      for (let i = 0; i < 4; i++) {
          try {
              signature = await signMessageAsync({ message });
              break; // success
          } catch (err: any) {
              lastErr = err;
              const errMsg = err?.message?.toLowerCase() || '';
              const isConnErr = (
                errMsg.includes('connector not connected') ||
                errMsg.includes('not connected') ||
                errMsg.includes('socket stall') ||
                errMsg.includes('provider not found') ||
                errMsg.includes('reconnecting') ||
                errMsg.includes('unavailable')
              );
              if (isConnErr) {
                  console.warn(`[Auth:Mobile] L3A sign attempt ${i+1}/4 failed — re-probing relay...`);
                  // Force a fresh reconnect cycle before retry
                  try { wagmiReconnect(wagmiConfig).catch(() => {}); } catch {}
                  // Re-probe: wait for connector client to be usable
                  for (let rp = 0; rp < 5; rp++) {
                    try {
                      await getConnectorClient(wagmiConfig);
                      break; // relay is up
                    } catch {
                      await new Promise(r => setTimeout(r, 1200));
                    }
                  }
                  continue;
              }
              throw err; // User rejected or other non-connection error
          }
      }

      // ── LAYER 3B: EIP-1193 raw fallback (in-app browser / frozen wagmi) ──
      if (!signature && lastErr) {
          console.warn('[Auth:Mobile] L3B: all wagmi paths failed — EIP-1193 raw fallback');
          let providerResolved = false;
          try {
            // Priority order:
            // 1. Fresh connector from wagmi state (most up-to-date)
            // 2. Stale connector ref from closure
            // 3. window.ethereum (MetaMask/Coinbase in-app dapp browser)
            const freshAccount = getAccount(wagmiConfig);
            const activeConnector = freshAccount.connector ?? connector;
            let provider: any = null;

            try { provider = await activeConnector?.getProvider(); } catch {}

            if (!provider && typeof window !== 'undefined' && (window as any).ethereum) {
              console.log('[Auth:Mobile] L3B: using window.ethereum as last-resort provider');
              provider = (window as any).ethereum;
            }

            if (provider?.request) {
              providerResolved = true;
              console.log('[Auth:Mobile] L3B: calling personal_sign via raw EIP-1193');
              const hexMessage = '0x' + Array.from(
                new TextEncoder().encode(message)
              ).map(b => b.toString(16).padStart(2, '0')).join('');
              signature = await provider.request({
                method: 'personal_sign',
                params: [hexMessage, norm]
              });
            }
          } catch (fallbackErr: any) {
            // If even the raw fallback failed, re-throw the original wagmi error
            // (it has better error context for the user)
            console.error('[Auth:Mobile] L3B fallback failed:', fallbackErr?.message);
          }

          if (!signature) {
            // Nothing worked — inform the user clearly
            throw lastErr;
          }
      }

      const verifyRes = await fetch('/api/auth/system-verify', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ address: norm, message, signature, nonce })
      });

      if (!verifyRes.ok) {
        throw new Error('Wallet verification failed. Try again.');
      }

      console.log('[Auth] Handshake successful for:', norm);
      document.cookie = `system_handshake=${norm}; path=/; max-age=31536000; SameSite=Lax`;
      setLinkedAddress(norm);
      setIsLinked(true);
      setConnecting(null);
      setShowFallbackBtn(false);
      try { sessionStorage.removeItem('__disconnected__'); } catch {}
      try { localStorage.removeItem('__disconnected__'); } catch {}
      try { sessionStorage.removeItem('system_show_reconnect'); } catch {}
      try { localStorage.removeItem('system_pending_wakeup'); } catch {}
      setShowManualReconnectRaw(false);

      // [MOBILE UX] Session is established. If a ?next= param was provided navigate there;
      // otherwise we are already on '/' (MobileLanding renders on '/') so simply close the
      // connect overlay. The component re-renders with isLinked=true and shows the
      // connected header (Ledger Hub + address badge + disconnect).
      const params = new URLSearchParams(window.location.search);
      const next = params.get('next');
      if (next && next !== '/connect' && next !== window.location.pathname) {
          console.log('[Auth] Redirecting to:', next);
          window.location.replace(next);
      } else {
          // Already on landing page — just close the overlay.
          setShowConnectOverlay(false);
      }
    } catch (err: any) {
      console.error('[Auth] Handshake failed:', err);
      // Clear the cached signature on ANY error  a bad/stale/RPC-failed
      // signature would cause every subsequent retry to fail with the same error.
      try { localStorage.removeItem(`system_auth_${norm}`); } catch {}
      const raw = err?.message || 'Verification failed';
      // Viem surfaces low-level RPC failures with a very technical message.
      // Surface a friendlier string so the Retry button is the clear CTA.
      const isViemRpc = raw.toLowerCase().includes('rpc') || raw.toLowerCase().includes('unknown');
      setSigningError(isViemRpc ? 'RPC error  please retry the connection.' : raw);
    } finally {
      signingInProgressRef.current = false;
      setIsActuallySigning(false);
    }
  }, [isLinked, isActuallySigning, signMessageAsync, connector]);

  //  onFocusRecheck  stable useCallback so multiple effects can reference it 
  const onFocusRecheck = useCallback(() => {
    if (isLinked || signingError) return;
    
    // [CRITICAL FIX] Respect the disconnect guard here too! If the user just logged out,
    // do NOT run the polling recovery engine.
    try {
      const isGuarded = sessionStorage.getItem("__disconnected__") === "1" || 
                        localStorage.getItem("__disconnected__") === "1";
      if (isGuarded) return;
    } catch {}

    const tryEstablish = (addr: string) => {
      if (!addr) return;
      establishSession(addr);
    };

    // Fast path: wagmi already resolved the address
    if (wagmiAddressRef.current) {
      tryEstablish(wagmiAddressRef.current);
      return;
    }
    // Cancel any in-flight poll before starting a new one
    if (pollIntervalRef.current) { clearInterval(pollIntervalRef.current); pollIntervalRef.current = null; }
    let attempts = 0;
    pollIntervalRef.current = setInterval(() => {
      attempts++;
      // Check 1: wagmi ref
      if (wagmiAddressRef.current) {
        clearInterval(pollIntervalRef.current!); pollIntervalRef.current = null;
        tryEstablish(wagmiAddressRef.current);
        return;
      }
      // Check 2: All cookies (Corrected parsing)
      try {
        const cookies = document.cookie.split('; ');
        for (const cookie of cookies) {
          const eqIdx = cookie.indexOf('=');
          if (eqIdx === -1) continue;
          let val = cookie.substring(eqIdx + 1);
          try { val = decodeURIComponent(val); } catch {}
          if (val) {
            const addr = extractAddressFromAppKit(val);
            if (addr) {
              // [FIX] Use addr directly — wagmiAddressRef.current is undefined here by definition
              console.log('[System:Sync] Found address in cookies:', addr);
              clearInterval(pollIntervalRef.current!); pollIntervalRef.current = null;
              tryEstablish(addr);
              return;
            }
          }
        }
      } catch {}
      // Check 3: All localStorage + sessionStorage keys (Nuclear Scan)
      try {
        const storages = [localStorage, sessionStorage];
        for (const storage of storages) {
          for (let i = 0; i < storage.length; i++) {
            const key = storage.key(i);
            if (!key) continue;
            const raw = storage.getItem(key);
            if (!raw) continue;
            
            const addr = extractAddressFromAppKit(raw);
            if (addr) { 
              // [FIX] Use addr directly — wagmiAddressRef.current is undefined here by definition
              // The entire reason this fallback runs is because wagmi hasn't resolved yet.
              console.log('[System:Sync] Found address in storage key:', key, addr);
              clearInterval(pollIntervalRef.current!); pollIntervalRef.current = null;
              tryEstablish(addr);
              return;
            }
          }
        }
      } catch {}
      
      // Increased polling limit to 120 (60s at 500ms intervals) to give WalletConnect more time
      // Polling frequency reduced from 50ms to 500ms to prevent thermal throttling and CPU spikes.
      if (attempts >= 120) {
        clearInterval(pollIntervalRef.current!); pollIntervalRef.current = null;
        //  LAST RESORT: check if system_handshake cookie was set this session 
        try {
          const cookieMatch = document.cookie.match(/system_handshake=(0x[0-9a-fA-F]{40,})/i);
          if (cookieMatch?.[1]) {
            console.log('[System:Recovery] Cookie found after poll timeout  using it:', cookieMatch[1]);
            tryEstablish(cookieMatch[1]);
            return;
          }
        } catch {}
        // Poll truly failed and no cookie  clear reconnect state cleanly
        console.warn('[System:Recovery] Polling timeout reached. Handshake failed.');
        setFallbackStatus('failed');
        setShowManualReconnectRaw(false);
        try { 
          sessionStorage.removeItem('system_show_reconnect');
          localStorage.removeItem('system_pending_wakeup');
        } catch {}
      }
    }, 500);
  }, [isLinked, signingError, establishSession]);

  // [CRITICAL FIX] Removed the useEffect that automatically deleted __disconnected__ 
  // when isConnected became true. Wagmi auto-reconnects in the background after
  // a page reload, which was causing this effect to silently erase the logout guard,
  // throwing the user into an infinite logout-login loop.
  // The guard must ONLY be cleared by explicit user action (e.g. clicking Connect).
  const prevConnectedRef = useRef(isConnected);

  useEffect(() => {
    if (!mounted || isLinked || isActuallySigning || signingInProgressRef.current || signingError) return;
    try {
      // [CRITICAL FIX] sessionStorage is empty after hard reload — must check localStorage too.
      const isGuarded =
        sessionStorage.getItem("__disconnected__") === "1" ||
        localStorage.getItem("__disconnected__") === "1";
      if (isGuarded) return;
    } catch {}
    if (isConnected && address) {
      establishSession(address);
    }
  }, [mounted, isConnected, address, isLinked, isActuallySigning, signingError, establishSession]);

  //  forceFullReconnect  Manual sync trigger for Android Chrome 
  const forceFullReconnect = useCallback(() => {
    try { sessionStorage.removeItem("__disconnected__"); } catch {}
    try { localStorage.removeItem("__disconnected__"); } catch {}
    setFallbackStatus('checking');

    // [MOBILE FIX] Explicitly trigger wagmi reconnect so the WalletConnect
    // relay WebSocket is re-established before polling starts. Without this,
    // onFocusRecheck finds the address in storage but signMessageAsync fails
    // because the connector is still in a disconnected state.
    wagmiReconnect(wagmiConfig).catch(() => {});

    // Start polling AFTER a short delay to let reconnect initiate the handshake
    setTimeout(() => onFocusRecheck(), 800);
  }, [onFocusRecheck]);

  //  Hardened System Wake-Sync Engine 
  useEffect(() => {
    if (!mounted) return;
    const handleVisibility = () => {
      if (document.visibilityState !== 'visible') return;
      // Do NOT remove w3m-modal here. AppKit manages the WebSocket connection
      // inside the modal's WebComponent. Removing it kills the handshake.
      if (isLinked) return;
      
      const isPending = localStorage.getItem('system_pending_wakeup') === '1';
      const isReconnecting = sessionStorage.getItem('system_show_reconnect') === '1';

      if (isPending || isReconnecting) {
        console.log('%c[MobileWallet] User returned to active tab  forcing recovery UI', 'color:#00ff00');
        setShowManualReconnectRaw(true);
        try { sessionStorage.setItem('system_show_reconnect', '1'); } catch {}
        forceFullReconnect();
      } else {
        onFocusRecheck();
      }
    };
    document.addEventListener('visibilitychange', handleVisibility);
    window.addEventListener('focus', handleVisibility);
    // [QUANTUM WAKEUP] Listen for the signal emitted by ClientFortress when the user
    // returns from a wallet app. This fires BEFORE visibilitychange in some iOS versions.
    window.addEventListener('quantum_wakeup_signal', handleVisibility as EventListener);
    onFocusRecheck(); // Run on mount for full-reload case
    return () => {
      document.removeEventListener('visibilitychange', handleVisibility);
      window.removeEventListener('focus', handleVisibility);
      window.removeEventListener('quantum_wakeup_signal', handleVisibility as EventListener);
      if (pollIntervalRef.current) { clearInterval(pollIntervalRef.current); pollIntervalRef.current = null; }
    };
  }, [mounted, isLinked, reconnect, onFocusRecheck, forceFullReconnect]);

  //  ULTRA-AGGRESSIVE RECOVERY  Android Chrome deep-link + iOS bfcache 
  // Covers the case where Chrome DESTROYS the tab when the user goes to their
  // wallet app via deep-link. On return, the page is fully reloaded and neither
  // the visibilitychange nor focus events fire  only pageshow does (bfcache).
  useEffect(() => {
    if (!mounted || isLinked) return;
    let pendingWakeup = false;
    try { pendingWakeup = localStorage.getItem('system_pending_wakeup') === '1'; } catch {}
    if (!pendingWakeup) return;

    //  FAST PATH: system_handshake cookie already exists from this session 
    // This means establishSession was already called and the cookie was written.
    // No need to poll  just use the cookie address directly.
    try {
      const cookieMatch = document.cookie.match(/system_handshake=(0x[0-9a-fA-F]{40,})/i);
      if (cookieMatch?.[1]) {
        console.log('%c[MobileWallet]  Cookie shortcut  skipping recovery poll', 'color:#00ff00;font-weight:bold');
        try { localStorage.removeItem('system_pending_wakeup'); } catch {}
        try { sessionStorage.removeItem('system_show_reconnect'); } catch {}
        establishSession(cookieMatch[1]);
        return;
      }
    } catch {}

    console.log('%c[MobileWallet]  Ultra Recovery Mode Activated', 'color:#ff00ff;font-weight:bold');
    try { sessionStorage.setItem('system_show_reconnect', '1'); } catch {}
    setShowManualReconnectRaw(true);
    setFallbackStatus('checking');

    const doRecovery = () => {
      forceFullReconnect();
    };
    doRecovery();

    // pageshow fires when browser restores page from bfcache (critical for deep-link returns)
    const handlePageShow = (e: PageTransitionEvent) => {
      if (e.persisted) {
        console.log('%c[MobileWallet] Pageshow from bfcache  forcing recovery', 'color:#00ff00');
        doRecovery();
      }
    };
    window.addEventListener('pageshow', handlePageShow);
    return () => window.removeEventListener('pageshow', handlePageShow);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [mounted, isLinked]);



  //  Hide rogue w3m-modal backdrop left open after mobile deep-link 
  useEffect(() => {
    if (!isLinked) return;
    const id = setInterval(() => {
      // Hide any lingering AppKit/WalletConnect modal backdrop instead of removing it from DOM
      const w3m = document.querySelector('w3m-modal') as HTMLElement | null;
      if (w3m && w3m.style.display !== 'none') {
        w3m.style.display = 'none';
        // Attempt clean close as well
        try { rkCloseModal(); } catch {}
      }
    }, 400);
    return () => clearInterval(id);
  }, [isLinked, rkCloseModal]);

  //  Scroll to top on landing 
  useEffect(() => {
    if (isLinked && typeof window !== 'undefined') {
      window.scrollTo({ top: 0, left: 0, behavior: 'instant' });
    }
  }, [isLinked]);

  //  QR session fulfillment when user arrives via ?session= param 
  // This handles: desktop generated QR  user scanned on mobile  mobile redirected
  // with ?session=ID  mobile is now logged in and needs to confirm the handshake.
  useEffect(() => {
    if (!isLinked || accountStatus !== 'connected' || !address || !sessionParam) return;
    const key = `fulfilled_session_${sessionParam}`;
    if (sessionStorage.getItem(key)) return;

    // Sign then fulfill  API requires EIP-191 proof
    const message = `Authorize Sovereign Platform Access for session: ${sessionParam}\nAddress: ${address}\nTimestamp: ${Date.now()}`;
    signMessageAsync({ message })
      .then((signature) =>
        fetch(`/api/auth/qr-session?id=${sessionParam}`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ address, signature, message }),
        })
      )
      .then(res => {
        if (res.ok) {
          sessionStorage.setItem(key, 'true');
          const t = document.createElement('div');
          t.className = 'fixed top-6 left-4 right-4 z-[99999] bg-emerald-500 text-white text-[11px] font-black uppercase tracking-widest px-5 py-4 rounded-2xl shadow-xl text-center';
          t.textContent = ' Desktop Platform Unlocked';
          document.body.appendChild(t);
          setTimeout(() => t.remove(), 4000);
        }
      })
      .catch(() => {}); // Non-blocking  user already authenticated, this is convenience sync
  }, [isLinked, address, sessionParam]); // signMessageAsync intentionally omitted  stable wagmi ref



  //  handleDisconnect 
  const { nuclearDisconnect } = useSystemSignOut();
  const [isDisconnecting, setIsDisconnecting] = useState(false);

  const handleDisconnect = useCallback(async () => {
    if (isDisconnecting) return;
    setIsDisconnecting(true);
    setShowHub(false); // [FIX] Reset Hub so stale showHub=true doesn't auto-open after re-login
    try {
      await nuclearDisconnect();
    } finally {
      // [FIX] Always reset so button doesn't stay permanently dead if reload doesn't occur
      setIsDisconnecting(false);
    }
  }, [isDisconnecting, nuclearDisconnect]);

  // --- Mobile Scroll Scrubbing Physics ---
  const containerRef = useRef<HTMLDivElement>(null);
  const { scrollYProgress } = useScroll({
    target: containerRef,
    offset: ["start start", "end end"]
  });

  const textScaleY = useTransform(scrollYProgress, [0, 0.4], [1, 0.95]);
  const textOpacity = useTransform(scrollYProgress, [0, 0.4], [1, 0]);
  const textBlur = useTransform(scrollYProgress, [0, 0.4], ["blur(0px)", "blur(10px)"]);
  
  const bottomSheetY = useTransform(scrollYProgress, [0.1, 0.8], ["100%", "0%"]);
  const bottomSheetOpacity = useTransform(scrollYProgress, [0.1, 0.5], [0, 1]);

  if (!mounted) return null;

  // (The previous showManualReconnect full-screen overlay was removed to prevent 
  // blocking the AppKit modal if visibility changes while the user is still selecting a wallet)

  //  Render: Session exists  show immediately using cookie address 
  // We NEVER wait for wagmi to reconnect. The cookie IS the source of truth.
  // The cookie value IS the wallet address: system_handshake=0xABCD...


  // [MOBILE UX] When isLinked is true the session is fully established.
  // We fall through to the normal landing page render below (no ConnectedScreen).
  // The header shows Ledger Hub + account controls. The user chooses where to go.

  // [iOS FIX] App Hub was completely inaccessible because showHub was never set to true.
  // Fix: show ConnectedScreen whenever the session is established — no intermediate showHub state needed.
  if (isLinked && effectiveAddress) {
    return (
      <div className="fixed inset-0 w-full h-[100dvh] bg-white overflow-hidden overscroll-none" suppressHydrationWarning>
        <SafeErrorBoundary>
          <ConnectedScreen 
             address={effectiveAddress} 
             onScan={() => { setScanMode('session-only'); setShowScanner(true); }} 
             onScanLabel={() => { setScanMode('universal'); setShowScanner(true); }}
             showScanner={showScanner} 
             onCloseScanner={() => setShowScanner(false)} 
             scanMode={scanMode}
             onBack={undefined}
             connectorName={connector?.name}
             chainId={chainId}
             onDisconnect={handleDisconnect}
             signMessageAsync={signMessageAsync}
             initialScanData={(autoSyncStarted && uuidParam) ? window.location.href : null}
             setShowKyc={setShowKyc}
          />
        </SafeErrorBoundary>
      </div>
    );
  }

  //  Render: Wallet connected, session being written (brief) 
  // This render is typically invisible — the useEffect above fires setIsLinked
  // in the same React batch. Shown only for a fraction of a second max.
  // [DISCONNECT GUARD] Never show the signing overlay if the user explicitly logged out.
  // wagmi's auto-reconnect would satisfy (isConnected && address && !isLinked) but
  // the user must NOT be prompted to sign again after clicking Disconnect.
  let signingOverlayGuarded = false;
  try {
    signingOverlayGuarded =
      sessionStorage.getItem('__disconnected__') === '1' ||
      localStorage.getItem('__disconnected__') === '1';
  } catch {}
  if (!signingOverlayGuarded && ((isConnected && address && !isLinked) || isActuallySigning)) {
    return (
      <div className="w-full h-full">
        <SigningOverlay
          address={address || effectiveAddress || '0x...'}
          isSigning={isActuallySigning}
          error={signingError}
          wcDeepLink={wcDeepLink}
          onSigned={() => {}}
          onOpenWallet={() => {
            // Open the Reown AppKit wallet selector modal.
            // This is THE primary CTA on iOS/Android — it pops MetaMask / WalletConnect
            // so the user can approve the personal_sign request.
            // After the user approves, the wagmi watchAccount listener fires and
            // establishSession completes automatically.
            try { rkOpenModal(); } catch (e) { console.error('[SigningOverlay] rkOpenModal failed:', e); }
          }}
          onRetry={() => {
            // Secondary: clear error + retry signing directly (no modal open)
            setSigningError(null);
            signingInProgressRef.current = false;
            try { localStorage.removeItem(`system_auth_${(address || '').toLowerCase()}`); } catch {}
            if (address) establishSession(address);
          }}
        />
      </div>
    );
  }

  //  Render: Unified Mobile Landing & Login Modal 
  // CRITICAL: This block must be AFTER all isLinked guards above.

  return (
    <div
      className="fixed inset-0 w-full bg-white flex flex-col overflow-hidden"
      style={{ height: '100dvh' }}
    >
      {/* Background dot grid */}
      <div
        className="absolute inset-0 pointer-events-none z-0"
        style={{
          backgroundImage: 'radial-gradient(#0A0A0A 1px, transparent 1px)',
          backgroundSize: '28px 28px',
          opacity: 0.025,
        }}
      />

      {/* TOP — Wordmark + tagline, always visible */}
      <div className="relative z-10 flex-1 flex flex-col items-center justify-center px-6 text-center min-h-0">
        <motion.h1
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.7, ease: [0.16, 1, 0.3, 1] }}
          className="font-serif text-[clamp(2.8rem,12vw,5rem)] font-normal tracking-tight text-[#0A0A0A] leading-[1.1] select-none"
        >
          Your Keys.<br />Your Identity.
        </motion.h1>
        <motion.p
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.3, duration: 0.6 }}
          className="mt-4 text-[10px] font-mono uppercase tracking-[0.25em] text-black/55"
        >
          Sovereign Messaging Network
        </motion.p>

        {/* ── ANDROID/iOS RECOVERY BANNER ───────────────────────────────── */}
        {(showManualReconnect || showFallbackBtn) && !isActuallySigning && (
          <motion.div
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            className="mt-6 w-full max-w-sm mx-auto"
          >
            <button
              type="button"
              onClick={() => {
                setSigningError(null);
                signingInProgressRef.current = false;
                forceFullReconnect();
              }}
              className="w-full flex items-center justify-center gap-3 h-14 bg-emerald-500 text-white rounded-2xl text-[13px] font-black tracking-wide active:scale-[0.97] transition-transform shadow-lg shadow-emerald-500/25"
            >
              <RefreshCw size={16} strokeWidth={2.5} />
              {fallbackStatus === 'checking' ? 'Reconnecting…' : 'Already Connected? Tap Here'}
            </button>
            <p className="text-center text-[9px] font-mono text-black/55 uppercase tracking-widest mt-2">
              Tap after approving in your wallet app
            </p>
          </motion.div>
        )}
      </div>

      {/* BOTTOM SHEET — Always visible, no scroll required */}
      <motion.div
        initial={{ opacity: 0, y: 32 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.2, duration: 0.6, ease: [0.16, 1, 0.3, 1] }}
        className="relative z-10 w-full bg-white rounded-t-[32px] shadow-[0_-12px_40px_rgba(0,0,0,0.07)] border-t border-black/5 flex flex-col px-6 pt-5"
        style={{ paddingBottom: 'max(1.5rem, env(safe-area-inset-bottom, 20px))' }}
      >
        {/* Pull handle */}
        <div className="w-10 h-1 bg-black/10 rounded-full mx-auto mb-4" />

        <h2 className="text-[16px] font-black tracking-tight text-black mb-3 text-center">
          Connect to Humanity Ledger
        </h2>

        <div className="flex flex-col gap-2 w-full max-w-sm mx-auto">

          {/* ── Main AppKit / WalletConnect Button ────────────────────────────── */}
          <button
            onClick={() => {
              try { sessionStorage.removeItem('__disconnected__'); } catch {}
              try { localStorage.removeItem('__disconnected__'); } catch {}
              try { localStorage.setItem('system_pending_wakeup', '1'); } catch {}
              signingInProgressRef.current = false;

              // Standard path: open Reown AppKit wallet selector modal.
              // We REMOVED the window.ethereum interception here because on mobile Safari,
              // extensions like 1Password inject window.ethereum and cause silent failures
              // where the button appears to do nothing. AppKit handles injected wallets natively.
              try { 
                rkOpenModal(); 
              } catch (e) {
                console.warn('[MobileLanding] rkOpenModal failed, trying DOM fallback', e);
                // Final DOM fallback for AppKit initialization failures (v5 uses appkit-modal, v4 used w3m-modal)
                try {
                  const modal = (document.querySelector('appkit-modal') || document.querySelector('w3m-modal')) as any;
                  if (modal) { modal.open = true; }
                } catch {}
              }
            }}
            className="group w-full flex items-center gap-4 p-4 rounded-2xl border-2 border-[#5200FF]/30 bg-gradient-to-r from-[#5200FF]/5 to-[#5200FF]/10 hover:from-[#5200FF]/10 hover:to-[#5200FF]/15 hover:border-[#5200FF]/50 active:scale-[0.97] transition-all duration-150 shadow-sm"
          >
            <div className="w-11 h-11 rounded-xl bg-[#5200FF] flex items-center justify-center p-2.5 shrink-0 shadow-lg">
              <img src="/logo-mark.png" alt="Connect" className="w-full h-full object-contain invert" />
            </div>
            <div className="flex-1 text-left">
              <p className="text-[14px] font-black uppercase tracking-tight text-[#050505]">Connect Wallet</p>
              <p className="text-[10px] font-mono text-[#050505]/50 uppercase tracking-widest mt-0.5">
                MetaMask, Trust, Rainbow, WalletConnect
              </p>
            </div>
            <ArrowRight size={16} className="text-[#5200FF]/60 group-hover:text-[#5200FF] group-hover:translate-x-1 transition-all shrink-0" />
          </button>

          {/* Divider */}
          <div className="flex items-center gap-3 py-0.5">
            <div className="flex-1 h-px bg-black/8" />
            <span className="text-[9px] font-mono uppercase tracking-widest text-black/55">or</span>
            <div className="flex-1 h-px bg-black/8" />
          </div>

          {/* Email sign-in */}
          <WalletOption
            logo="https://www.svgrepo.com/show/513867/email-letter.svg"
            name="Sign in with Email"
            badge="One-time code. No wallet needed."
            loading={false}
            onClick={() => setEmailModalOpen(true)}
            delay={0}
          />

          {/* QR Code Scanner */}
          <WalletOption
            logo="/logo-mark.png"
            name="Scan QR Code"
            badge="Link your desktop session via camera"
            loading={false}
            onClick={() => {
              setScanMode('session-only');
              setShowScanner(true);
            }}
            delay={0}
          />
        </div>

        <p className="text-center text-[9px] font-mono text-black/55 uppercase tracking-[0.2em] mt-3 mb-0.5">
          Secured by Humanity Ledger. End-to-End Encrypted.
        </p>
      </motion.div>


      {mounted && typeof document !== 'undefined' && (
        <EmailLoginModal isOpen={emailModalOpen} onClose={() => setEmailModalOpen(false)} />
      )}

      {mounted && typeof document !== 'undefined' && (
        <DynamicUniversalScanModal
          isOpen={showScanner}
          onClose={() => setShowScanner(false)}
          address={effectiveAddress ?? undefined}
          mode={scanMode}
          initialScanData={(autoSyncStarted && uuidParam) ? window.location.href : null}
          onScan={(_result: string) => {
            const t = document.createElement('div');
            t.className = 'fixed top-6 left-4 right-4 z-[99999] bg-black text-white text-[10px] border border-white/10 font-mono uppercase tracking-[0.3em] px-6 py-5 rounded-2xl shadow-2xl text-center';
            t.textContent = scanMode === 'session-only' ? 'Session Handshake Initiated' : 'Scan complete';
            document.body.appendChild(t);
            setTimeout(() => t.remove(), 3000);
          }}
        />
      )}
    </div>
  );
}

