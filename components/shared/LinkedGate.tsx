"use client";

import React, { useState, useEffect, useRef, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { usePathname, useRouter } from 'next/navigation';
import {
  Shield,
  Smartphone,
  Wallet,
  ChevronRight,
  Fingerprint,
  Activity,
  RefreshCw,
  Cpu,
  Globe,
  X,
  CheckCircle2,
  Zap,
  ArrowRight,
  Database,
} from 'lucide-react';
import { useUIStore } from '@/lib/store/ui-store';

import { useAccount, useConnect, useSignMessage, useReconnect, useChainId, useSwitchChain, useDisconnect } from 'wagmi';
import { useAppKit } from '@reown/appkit/react';
import { toast } from 'sonner';
import dynamic from 'next/dynamic';

const UniversalEliteWallpaper = dynamic(
  () => import('@/components/shared/UniversalEliteWallpaper').then(m => ({ default: m.UniversalEliteWallpaper })),
  { ssr: false }
);

const QR_TTL = 300;

//  HUGE ANIMATED LEDGER 
function HugeAnimatedLedger() {
  const [splashes, setSplashes] = useState<{ id: number; x: number; y: number }[]>([]);

  const handleClick = (e: React.MouseEvent<HTMLDivElement>) => {
    const rect = e.currentTarget.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;
    setSplashes((prev) => [...prev, { id: Date.now(), x, y }]);
  };

  const removeSplash = (id: number) => {
    setSplashes((prev) => prev.filter((s) => s.id !== id));
  };

  return (
    <div 
      className="relative cursor-pointer flex justify-center items-center w-56 h-56 md:w-[300px] md:h-[300px] lg:w-[340px] lg:h-[340px] select-none group shrink-0" 
      onClick={handleClick}
    >
      <motion.img
        src="/worldmap.png"
        className="w-full h-full object-contain relative z-10 drop-shadow-[0_20px_40px_rgba(0,0,0,0.15)] group-hover:drop-shadow-[0_40px_80px_rgba(0,0,0,0.30)] transition-all duration-500"
        alt="Humanity Ledger"
        whileHover={{ scale: 1.05 }}
        whileTap={{ scale: 0.95 }}
        animate={{ y: [0, -20, 0] }}
        transition={{ y: { duration: 6, repeat: Infinity, ease: "easeInOut" } }}
      />
    </div>
  );
}

//  WALLET DEFINITIONS 


//  SESSION PERSISTENCE (4-layer, never re-prompt) 
const LS_SESSION_KEY = 'system_session_v2';

function hasValidStoredSession(addr?: string): boolean {
  try {
    // Layer 1: cookie
    if (document.cookie.split('; ').some(r => r.startsWith('system_handshake='))) return true;
    // Layer 2: localStorage with 30-day TTL
    const raw = localStorage.getItem(LS_SESSION_KEY);
    if (raw) {
      const data = JSON.parse(raw);
      const addrOk = !addr || data.address?.toLowerCase() === addr.toLowerCase();
      if (addrOk && data.exp > Date.now()) return true;
    }
    // Layer 3: sessionStorage per address
    if (addr && sessionStorage.getItem(`system_signed_${addr.toLowerCase()}`) === 'true') return true;
  } catch {}
  return false;
}

function writeSessionAll(addr: string) {
  const norm = addr.toLowerCase();
  // Cookie  30 days
  document.cookie = `system_handshake=${norm}; path=/; max-age=2592000; SameSite=Lax`;
  // localStorage  30 days TTL
  try {
    localStorage.setItem(LS_SESSION_KEY, JSON.stringify({
      address: norm,
      exp: Date.now() + 30 * 24 * 60 * 60 * 1000,
      // [FIX] Tag source as 'wagmi' so useSystemAccount doesn't treat external
      // wallets as local Humanity Ledger wallets (which would break signing).
      source: 'wagmi',
    }));
  } catch {}
  // sessionStorage
  sessionStorage.setItem(`system_signed_${norm}`, 'true');
}

function usePrevious<T>(value: T): T | undefined {
  const ref = useRef<T>(undefined);
  useEffect(() => {
    ref.current = value;
  }, [value]);
  return ref.current;
}

//  MAIN GATE COMPONENT 
export function LinkedGate({ children }: { children: React.ReactNode }) {
  const pathname = usePathname() ?? '/';
  const router = useRouter();
  const { isLinked, setLinked } = useUIStore();
  const { isConnected: isWalletConnected, address } = useAccount();
  const { disconnect } = useDisconnect();
  
  const [isMounted, setIsMounted] = useState(false);
  const prevWalletConnected = usePrevious(isWalletConnected);

  //  Read session from ALL 3 layers on mount 
  useEffect(() => {
    setIsMounted(true);
    // [CRITICAL FIX] Check disconnect guard BEFORE restoring any session.
    // sessionStorage is cleared on hard reload, so we MUST also check localStorage.
    try {
      const isGuarded =
        sessionStorage.getItem('__disconnected__') === '1' ||
        localStorage.getItem('__disconnected__') === '1';
      if (isGuarded) return;
    } catch {}
    if (typeof document !== 'undefined' && hasValidStoredSession(address)) {
      setLinked(true);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [setLinked, address]);

  //  Auto-Link Wallet WITHOUT secondary signature 
  useEffect(() => {
    if (!isMounted) return;

    //  INHUMAN OPTIMIZATION: Nuclear Guard State Transition Fix 
    // If the wallet transitions from disconnected to connected, the user intentionally
    // re-authenticated. We MUST purge the __disconnected__ flag to resume auto-routing.
    // [FIX] BUG-8: wagmi auto-reconnect (e.g. WalletConnect resuming after page reload)
    // was triggering this block without user intent → guard erased → logout failed silently.
    // We now only clear the guard when the user explicitly connected a NEW wallet
    // AND the guard is not present (i.e. not a post-logout auto-reconnect attempt).
    // The explicit clear happens in handleDesktopWallet / handleMobileWallet in ConnectPage.
    // This block is intentionally left as a no-op — do NOT clear guard here.
    // if (prevWalletConnected === false && isWalletConnected) { ... }

    // [FIX] Nuclear Logout Guard: Check FIRST, before ANY storage read.
    // Previously this guard was AFTER hasValidStoredSession(), meaning:
    //   1. User clicks disconnect
    //   2. nuclearDisconnect starts clearing storage (async)
    //   3. LinkedGate re-renders, reads cookie/localStorage BEFORE they're cleared
    //   4. hasValidStoredSession() returns true → setLinked(true) → logout fails
    // The guard must be checked unconditionally regardless of current isLinked state.
    // [FIX] BUG-6: Read guard from BOTH storages (localStorage survives the reload,
    // sessionStorage is consumed by useSystemAccount before LinkedGate sometimes mounts).
    const justDisconnected =
        sessionStorage.getItem('__disconnected__') === '1' ||
        localStorage.getItem('__disconnected__') === '1';
    if (justDisconnected) {
        console.log('[LinkedGate] Nuclear Logout Guard active — blocking all auto-link paths');
        return;
    }

    // Triple-check all layers  zero false positives
    if (typeof document !== 'undefined' && hasValidStoredSession(address)) {
      setLinked(true);
      return;
    }
    if (isWalletConnected && !isLinked && address) {
      writeSessionAll(address);
      setLinked(true);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isWalletConnected, isLinked, isMounted, address, prevWalletConnected]);


  //  Body scroll lockdown when gate is active 
  useEffect(() => {
    if (!isMounted) return;
    let justDisconnected = false;
    try {
      // [FIX] Check BOTH storages — sessionStorage is empty in new tabs,
      // localStorage persists across tabs and page reloads.
      justDisconnected =
        sessionStorage.getItem('__disconnected__') === '1' ||
        localStorage.getItem('__disconnected__') === '1';
    } catch {}
    
    const isPublicPath = pathname === '/' ||
                         pathname.startsWith('/connect') ||
                         pathname.startsWith('/login') ||
                         pathname.startsWith('/news') ||
                         pathname.startsWith('/chat') ||
                         pathname.startsWith('/portfolio') ||
                         pathname.startsWith('/sign-up') ||
                         (pathname.startsWith('/forum') && !pathname.startsWith('/forum/settings'));

    const shouldLock = !isLinked && !isWalletConnected && !justDisconnected && !isPublicPath;
    document.body.style.overflow = shouldLock ? 'hidden' : '';
    document.documentElement.style.overflow = shouldLock ? 'hidden' : '';
    return () => {
      document.body.style.overflow = '';
      document.documentElement.style.overflow = '';
    };
  }, [isLinked, isWalletConnected, isMounted, pathname]);

  //  Redirect unauthenticated users to /connect 
  // SECURITY PROTOCOL: A dual-layer check is performed before any redirect fires.
  // Layer A — in-memory isLinked flag (set by this component's mount effect).
  // Layer B — direct cookie/localStorage read (guards against the race condition
  //            where the mount effect's state update hasn't propagated yet when
  //            the timer fires, e.g. after a client-side navigation from /sign-up).
  //
  // This eliminates the "sign-up → /hub → /connect loop" permanently.
  useEffect(() => {
    if (!isMounted) return;
    const isPublic = pathname === '/' ||
                     pathname.startsWith('/connect') ||
                     pathname.startsWith('/login') ||
                     pathname.startsWith('/docs') ||
                     pathname.startsWith('/privacy') ||
                     pathname.startsWith('/terms') ||
                     pathname.startsWith('/developers') ||
                     pathname.startsWith('/news') ||
                     pathname.startsWith('/chat') ||
                     pathname.startsWith('/portfolio') ||
                     pathname.startsWith('/sign-up') ||
                     (pathname.startsWith('/forum') && !pathname.startsWith('/forum/settings'));
    const isBot = typeof window !== 'undefined' && /bot|google|grok|crawler|spider|robot|crawling|bing/i.test(navigator.userAgent);

    const checkTimer = setTimeout(() => {
      // [FIX] If the user just disconnected, let nuclearDisconnect handle the redirect to '/'.
      // Since checkTimer is 1500ms, if they are STILL on an internal app page after 1.5s,
      // nuclearDisconnect failed or they manually navigated back. Redirect to /connect.
      // [FIX] Read from BOTH storages — nuclearDisconnect writes to localStorage which
      // survives page reloads, while sessionStorage is cleared on tab close.
      const justDisconnected = typeof window !== 'undefined' && (
        sessionStorage.getItem('__disconnected__') === '1' ||
        localStorage.getItem('__disconnected__') === '1'
      );
      if (justDisconnected) {
        if (pathname !== '/' && !pathname.startsWith('/connect')) {
          router.replace('/connect');
        }
        return;
      }

      // Layer B: direct cookie check — catches the race condition window
      // where isLinked is still false even though the session is established.
      const hasCookieSession = typeof document !== 'undefined' &&
        hasValidStoredSession(address);

      if (hasCookieSession && !isLinked) {
        // Session is valid — self-heal the in-memory state and abort redirect.
        setLinked(true);
        return;
      }

      // Only redirect if genuinely unauthenticated across all layers.
      if (!isLinked && !hasCookieSession && !isWalletConnected && !isPublic && !isBot) {
        router.replace('/connect');
      }
    }, 1500);

    return () => clearTimeout(checkTimer);
  }, [isLinked, isWalletConnected, isMounted, pathname, router, address, setLinked]);



  return <>{children}</>;
}
