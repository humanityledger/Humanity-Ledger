'use client';

import React, { useEffect } from 'react';
// Axioma 452  SW registered here (non-blocking)
// Axioma 350  Funnel tracking per navigation
import { usePathname } from 'next/navigation';
import { useAccount } from 'wagmi';
import { useSettingsStore } from '@/lib/store/useSettingsStore';
import { useSystemSessionLock } from '@/hooks/useSystemSessionLock';
import { useWalletStore } from '@/lib/store/wallet-store';
import { TitaniumGate } from '@/components/layout/TitaniumGate';
import { InstitutionalHeader } from '@/components/shared/InstitutionalHeader';
import { ThemeApplier } from '@/components/layout/ThemeApplier';
import { useDynamicIsland } from '@/lib/store/dynamic-island-store';

import { ZoomWrapper } from './ZoomWrapper';
import dynamic from 'next/dynamic';

const UniversalEliteWallpaper = dynamic(
  () => import('@/components/shared/UniversalEliteWallpaper').then(m => ({ default: m.UniversalEliteWallpaper })),
  { ssr: false }
);
const UtilityPanels = dynamic(
  () => import('@/components/shared/UtilityPanels').then(m => ({ default: m.UtilityPanels })),
  { ssr: false }
);
const BillionLedgerNotification = dynamic(
  () => import('@/components/shared/UtilityPanels').then(m => ({ default: m.BillionLedgerNotification })),
  { ssr: false }
);

const LinkedGate = dynamic(
  () => import('@/components/shared/LinkedGate').then(m => ({ default: m.LinkedGate })),
  { ssr: false }
);

// 
// NOTE: WalletConnectProvider is mounted globally in app/layout.tsx (ssr:false)
// Do NOT declare or render it here to prevent double-initialization.
// 
// 
// Routes that don't need the LinkedGate wrapper (public / self-auth)
// /chat and /hub handle their own auth — wrapping them with LinkedGate causes
// redirect loops and blank screen bugs.
// 
const PUBLIC_PREFIXES = ['/privacy', '/terms', '/connect', '/sign-up', '/login', '/news', '/chat', '/hub'];

// 
// Routes that must NOT get the legacy black Downhead footer
// 
const NO_DOWNHEAD_PREFIXES = [
  '/terminal', '/portfolio', '/academy', '/support',
  '/privacy', '/terms', '/ticket', '/news', '/connect',
  '/voss-supremacy', '/predictions', '/ledger',
  '/gold-registry', '/infrastructure', '/directory', '/company',
  '/vip', '/faq', '/api-marketplace', '/clearance', '/settings',
  '/login', '/sign-up', '/legal', '/admin', '/developer', '/forum',
  '/hub', '/whitepaper', '/manifesto'
];

// 
// Routes that use a bounded-viewport layout (no dead space below content)
// Everything except the landing page ("/") and the dashboard (managed by
// LedgerProShell with its own fixed-inset shell) should be fully contained.
// 
const BOUNDED_PREFIXES = [
  '/portfolio', '/academy', '/support', '/news',
  '/predictions', '/ledger', '/voss-supremacy',
  '/gold-registry', '/vip', '/developer', '/developers', '/faq',
  '/ticket', '/settings', '/privacy', '/terms', '/legal',
  // FIXED: /connect, /sign-up, /login are now bounded — fixed inset-0 overflow-hidden
  // prevents the black void below content. ConnectPage uses flex fill (not fixed inset-0).
  '/connect', '/sign-up', '/login',
  '/admin', '/clearance',
  '/api-marketplace', '/directory', '/company', '/infrastructure',
  '/forum', '/chat', '/hub', '/whitepaper', '/manifesto',
  '/docs', // Added to prevent infinite scroll bugs
  '/blog', // Blog posts are bounded pages
  '/', // Landing page — prevents white zone below footer
];

export function ClientLayout({ children }: { children: React.ReactNode }) {
  const _pathname = usePathname();
  const pathname = _pathname ?? '/'; // usePathname() can return null during static rendering
  const { isConnected } = useAccount();
  const { fetchSettings, settings } = useSettingsStore();

  useSystemSessionLock();

  React.useEffect(() => {
    fetchSettings();
  }, [fetchSettings]);

  //  Axioma 452: PWA Service Worker registration 
  React.useEffect(() => {
    if (typeof window !== 'undefined' && 'serviceWorker' in navigator) {
      navigator.serviceWorker
        .register('/sw.js', { scope: '/' })
        .then((reg) => {
          console.info('[SW] Registered:', reg.scope);
          // Check for waiting updates
          if (reg.waiting) reg.waiting.postMessage({ type: 'SKIP_WAITING' });
          reg.addEventListener('updatefound', () => {
            const newSW = reg.installing;
            if (!newSW) return;
            newSW.addEventListener('statechange', () => {
              if (newSW.state === 'installed' && navigator.serviceWorker.controller) {
                console.info('[SW] Update available  will apply on next visit.');
              }
            });
          });
        })
        .catch((err) => console.warn('[SW] Registration failed:', err));
    }
  }, []);

  //  Axioma 350: Funnel tracking per navigation (non-blocking) 
  React.useEffect(() => {
    // Network connectivity Dynamic Island
    const handleOffline = () => {
      useDynamicIsland.getState().setState('syncing', { title: 'No Connection', subtitle: 'Reconnecting...' });
    };
    const handleOnline = () => {
      useDynamicIsland.getState().setState('tx_success', { title: 'Back Online' }, 2000);
    };
    window.addEventListener('offline', handleOffline);
    window.addEventListener('online', handleOnline);
    return () => {
      window.removeEventListener('offline', handleOffline);
      window.removeEventListener('online', handleOnline);
    };
  }, []);
  React.useEffect(() => {
    if (typeof window !== 'undefined') {
      // Session log (existing)
      fetch('/api/session-logs', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: `NAVIGATED_TO: ${pathname || '/'}` })
      }).catch(() => {});
      // Funnel step tracking
      const step = pathname === '/' ? 'LANDING'
        : pathname.startsWith('/connect') ? 'WALLET_CONNECT'
        : pathname.startsWith('/terminal') ? 'DASHBOARD'
        : null;
      if (step) {
        fetch('/api/analytics/funnel', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ step, ts: Date.now() }),
        }).catch(() => {});
      }
    }
  }, [pathname]);

  //  Layout mode 
  // DASHBOARD   fixed inset-0 overflow-hidden   (LedgerProShell owns scroll)
  // BOUNDED     fixed inset-0 overflow-hidden   (header + inner scroll box)
  // LANDING     also bounded — prevents white zone below footer
  const isDashboard = pathname.startsWith('/terminal');
  const isLanding = pathname === '/';
  const isBounded = !isDashboard && BOUNDED_PREFIXES.some(p => pathname === p || (p !== '/' && pathname.startsWith(p)));

  const isPublicPath = pathname === '/' || PUBLIC_PREFIXES.some(p => pathname.startsWith(p));
  const content = !isPublicPath ? <LinkedGate>{children}</LinkedGate> : children;

  // For non-landing, non-dashboard pages: content is constrained to the left
  // portion of the screen. There is NO hard visual border  the wallpaper's
  // gradient overlay handles the fusion seamlessly.
  // `isLanding`  full width immersive layout
  // `isDashboard`  LedgerProShell owns the full viewport (its own shell)
  // everything else  content max-width left-aligned with transparent bg
  const displayContent = content;


  // Strict body trap for PC/Desktop  completely block document-level scrolling on bounded modules
  React.useEffect(() => {
    if (typeof window === 'undefined') return;
    const originalBodyOverflow = document.body.style.overflow;
    const originalBodyPosition = document.body.style.position;
    const originalHtmlOverflow = document.documentElement.style.overflow;

    if (isDashboard || isBounded) {
      document.body.style.overflow = 'hidden';
      document.documentElement.style.overflow = 'hidden';
      // To strictly prevent drag-scroll bleeds on MacOS trackpad:
      if (document.body.style.position !== 'fixed') {
        document.body.classList.add('ios-scroll-lock-strict');
      }
    } else {
      document.body.style.overflow = '';
      document.documentElement.style.overflow = '';
      document.body.classList.remove('ios-scroll-lock-strict');
    }

    return () => {
      document.body.style.overflow = originalBodyOverflow;
      document.documentElement.style.overflow = originalHtmlOverflow;
      document.body.classList.remove('ios-scroll-lock-strict');
    };
  }, [isDashboard, isBounded]);

  // [AUDIO REMOVED] Global click audio feedback has been permanently disabled.
  // No sounds play on user interaction anywhere in the system.

  //  System Interaction Telemetry (independent of sound settings) 
  // CRITICAL FIX: Previously gated behind soundEffects=true, so if users had
  // sound disabled, ZERO interactions were ever logged to Session Logs.
  // Now fires unconditionally for all authenticated sessions.
  React.useEffect(() => {
    if (typeof document === 'undefined') return;

    const handleInteractionLog = (e: MouseEvent) => {
        // Only log telemetry if the user is authenticated (connected)
        // Check both local wagmi store AND secure QR session cookies
        const hasLocalWallet = !!useWalletStore.getState().address;
        const hasSessionCookie = document.cookie.includes('system_handshake=');
        const isConnected = hasLocalWallet || hasSessionCookie;
        if (!isConnected) return;

        // Try to get the active wallet address to attach to the log
        let activeUserId = useWalletStore.getState().address;
        if (!activeUserId) {
            const match = document.cookie.match(/system_handshake=(0x[0-9a-fA-F]{40,})/i);
            if (match && match[1]) activeUserId = match[1];
        }
        activeUserId = activeUserId || null;

        const target = e.target as HTMLElement;
        const clickable = target.closest('button, a, input[type="submit"], [role="button"], .cursor-pointer');
        if (clickable) {
            const actionText = (clickable.textContent || clickable.tagName || 'ELEMENT')
                .substring(0, 40).trim().replace(/\n/g, ' ');
            fetch('/api/session-logs', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ action: `INTERACTION: CLICKED ${actionText}`, userId: activeUserId }),
            }).catch(() => {});
        }
    };

    document.addEventListener('mousedown', handleInteractionLog, { passive: true });
    return () => document.removeEventListener('mousedown', handleInteractionLog);
  }, []);

  //  Battery-aware CSS class for noise animation 
  // Sets body.perf-high when device is plugged in  enables noise-shift CSS
  // animation via the selector in globals.css.
  // When on battery, the class is absent  noise-shift is paused (0 CPU).
  useEffect(() => {
    if (typeof window === 'undefined') return;
    let battery: any = null;

    const applyPerfClass = (charging: boolean, level: number) => {
      const isHigh = charging || level > 0.30;
      document.body.classList.toggle('perf-high', isHigh);
    };

    const initBattery = async () => {
      try {
        if ('getBattery' in navigator) {
          battery = await (navigator as any).getBattery();
          applyPerfClass(battery.charging, battery.level);
          const onChange = () => applyPerfClass(battery.charging, battery.level);
          battery.addEventListener('chargingchange', onChange);
          battery.addEventListener('levelchange', onChange);
        } else {
          // No Battery API  assume plugged in (desktop)
          document.body.classList.add('perf-high');
        }
      } catch {
        document.body.classList.add('perf-high');
      }
    };

    initBattery();
    return () => {
      if (battery) {
        battery.removeEventListener('chargingchange', () => {});
        battery.removeEventListener('levelchange', () => {});
      }
      document.body.classList.remove('perf-high');
    };
  }, []);

  // /connect, /sign-up, /login manage their own internal centering
  const isCenteredPage = ['/clearance'].some(p => pathname.startsWith(p));
  const isChat = pathname.startsWith('/chat');

  // Root container
  const rootClass = isDashboard || isChat
    ? 'fixed inset-0 w-full overflow-hidden flex flex-col bg-transparent z-0'
    : isBounded
      ? 'fixed inset-0 w-full overflow-hidden flex flex-col bg-transparent z-0'
      : 'w-full min-h-[100vh] relative z-0 flex flex-col bg-transparent';

  // Inner wrapper (below header)
  const innerClass = isDashboard || isChat
    ? 'flex-1 flex flex-col relative w-full overflow-hidden min-h-0'
    : isBounded
      ? 'flex-1 flex flex-col relative w-full overflow-hidden min-h-0'
      : 'flex-1 flex flex-col relative w-full';

  const isForumPage = pathname.startsWith('/forum');
  const mainClass = isDashboard || isChat
    ? 'relative z-10 w-full flex-1 flex flex-col min-h-0 overflow-hidden md:pb-0'
    : isBounded
      // Scroll is fully contained here — no empty page-level void zones.
      // Landing page also uses this path so scroll stops exactly at footer.
      ? `relative z-10 w-full flex-1 min-h-0 overflow-y-auto overflow-x-hidden overscroll-none flex flex-col md:pb-0 bg-white`
      : `relative z-10 w-full flex-1 flex flex-col overscroll-none md:pb-0`;

  const showInstitutionalHeader =
    !pathname.startsWith('/sign-up') &&
    !pathname.startsWith('/login') &&
    !pathname.startsWith('/connect') &&
    !pathname.startsWith('/hub') &&
    !pathname.startsWith('/scan') &&
    (
      pathname.startsWith('/terminal') ||
      pathname === '/ledger' ||
      (pathname === '/portfolio' && isConnected) ||
      pathname === '/support' ||
      pathname === '/academy' ||
      pathname === '/vip'
      // removed careers
    );


  // /chat has its own full-screen header  never show the global one there

  return (
    <>
      <ThemeApplier />
      <TitaniumGate>
        <UniversalEliteWallpaper />

          <div className={rootClass}>
            {/* Top header for select standalone routes — single instance, responsive internally */}
            {showInstitutionalHeader && !isChat && (
              <div className="flex-none w-full z-50 fixed top-0 left-0 right-0">
                <InstitutionalHeader />
              </div>
            )}
            {/* Spacer to prevent content from hiding under fixed header */}
            {showInstitutionalHeader && !isChat && (
              <div className="w-full flex-none" style={{ minHeight: '64px' }} />
            )}

            <div className={innerClass}>
              <div className="relative z-40">
                <UtilityPanels />
                <BillionLedgerNotification />
              </div>

              <ZoomWrapper>
                <main
                  className={mainClass}
                  style={isBounded ? {
                    height: '100%',
                    minHeight: '100%',
                    scrollbarWidth: 'thin',
                    overscrollBehavior: 'none',
                    touchAction: 'pan-y',
                  } : undefined}
                >
                  {displayContent}
                </main>
              </ZoomWrapper>
            </div>

          </div>
        </TitaniumGate>
    </>
  );
}
