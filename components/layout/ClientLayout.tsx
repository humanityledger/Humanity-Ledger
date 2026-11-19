'use client';

import React, { useEffect } from 'react';
// Axioma 452  SW registered here (non-blocking)
// Axioma 350  Funnel tracking per navigation
import { usePathname } from 'next/navigation';
import { useAccount } from 'wagmi';
import { useSettingsStore } from '@/lib/store/useSettingsStore';
import { useSystemSessionLock } from '@/hooks/useSystemSessionLock';
import { TitaniumGate } from '@/components/layout/TitaniumGate';
import { ThemeApplier } from '@/components/layout/ThemeApplier';
import { setSessionActivity } from '@/lib/activities/hooks';
import { ChatKeepAlive } from '@/components/chat/surface/ChatKeepAlive';

import { ZoomWrapper } from './ZoomWrapper';
import { StudioLockGuard } from '@/components/studio/StudioLockGuard';
import { isPublicContentPage } from '@/lib/routing/publicPages';
import dynamic from 'next/dynamic';

const UniversalEliteWallpaper = dynamic(
  () => import('@/components/shared/UniversalEliteWallpaper').then(m => ({ default: m.UniversalEliteWallpaper })),
  { ssr: false }
);
// BillionLedgerNotification removed per user request (no fake transfer alerts)

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
// /chat handles its own auth — wrapping them with LinkedGate causes
// redirect loops and blank screen bugs.
// 
const PUBLIC_PREFIXES = ['/privacy', '/terms', '/connect', '/chat', '/studio'];

// 
// Routes that must NOT get the legacy black Downhead footer
// 
const NO_DOWNHEAD_PREFIXES = ['/privacy', '/terms', '/connect', '/settings', '/legal', '/admin'];

// 
// Routes that use a bounded-viewport layout (no dead space below content)
// Everything except the landing page ("/") and the dashboard (managed by
// LedgerProShell with its own fixed-inset shell) should be fully contained.
// 
const BOUNDED_PREFIXES = ['/settings', '/privacy', '/terms', '/legal', '/connect', '/admin', '/chat', '/studio', '/docs', '/'];

export function ClientLayout({ children }: { children: React.ReactNode }) {
  const _pathname = usePathname();
  const pathname = _pathname ?? '/'; // usePathname() can return null during static rendering
  const { isConnected } = useAccount();
  const { fetchSettings, settings } = useSettingsStore();

  useSystemSessionLock();

  React.useEffect(() => {
    // Settings live on the account: a signed-out visitor has none to fetch,
    // and asking anyway only logged a 401. Local DOM settings still apply.
    const signedIn = typeof document !== 'undefined' && /(?:^|;\s*)(?:wallet-auth|system_handshake)=/.test(document.cookie);
    if (signedIn) fetchSettings();
    else useSettingsStore.getState().syncDOM();
  }, [fetchSettings]);

  //  Axioma 452: PWA Service Worker registration 
  React.useEffect(() => {
    if (typeof window !== 'undefined' && 'serviceWorker' in navigator) {
      if (window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1') {
        navigator.serviceWorker.getRegistrations().then((regs) => {
          for (const reg of regs) reg.unregister();
        });
        if (window.caches) {
          window.caches.keys().then((keys) => keys.forEach((k) => window.caches.delete(k)));
        }
        return;
      }
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
              if (newSW.state === 'installed') newSW.postMessage({ type: 'SKIP_WAITING' });
            });
          });
          let reloaded = false;
          navigator.serviceWorker.addEventListener('controllerchange', () => {
            if (reloaded) return;
            reloaded = true;
            window.location.reload();
          });
        })
        .catch((err) => console.warn('[SW] Registration failed:', err));
    }
  }, []);

  //  Axioma 350: Funnel tracking per navigation (non-blocking) 
  React.useEffect(() => {
    // Connectivity in the island (lib/activities): offline stays until the network is back.
    const handleOffline = () => setSessionActivity('offline');
    const handleOnline = () => setSessionActivity('online');
    window.addEventListener('offline', handleOffline);
    window.addEventListener('online', handleOnline);
    return () => {
      window.removeEventListener('offline', handleOffline);
      window.removeEventListener('online', handleOnline);
    };
  }, []);
  // No navigation or click logging leaves the device (internal audit IA-02). /api/session-logs
  // answers 410 and stores nothing, but the click log sent the first 40 characters of every
  // clicked button, which in the chat list include the decrypted last-message preview.

  //  Layout mode 
  // DASHBOARD   fixed inset-0 overflow-hidden   (LedgerProShell owns scroll)
  // BOUNDED     fixed inset-0 overflow-hidden   (header + inner scroll box)
  // LANDING     the document scrolls (not bounded). On iPhone and Android a fixed body with the page
  //             scrolling inside <main> kept the browser bars from collapsing, made 100svh scenes
  //             disagree with the scroller's height, and broke the sticky scenes during a flick
  //             (white and glitched frames reported on 19/11/2026). The landing paints its own white
  //             page down to the footer, so there is no white zone to prevent.
  const isDashboard = pathname.startsWith('/terminal');
  const isLanding = pathname === '/';
  const isBounded = !isDashboard && !isLanding && BOUNDED_PREFIXES.some(p => pathname === p || (p !== '/' && pathname.startsWith(p)));

  // Documentation, company and legal pages are public and must never be
  // wrapped in LinkedGate, which redirects visitors without a session.
  const isPublicPath = pathname === '/' || PUBLIC_PREFIXES.some(p => pathname.startsWith(p)) || isPublicContentPage(pathname);
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

    if (isDashboard || isBounded || isChat) {
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
  const isChat = pathname.startsWith('/chat') || pathname.startsWith('/studio');

  // Root container
  const rootClass = isDashboard
    ? 'fixed inset-0 w-full h-full overflow-hidden flex flex-col bg-white z-0'
    : isChat
      ? 'fixed inset-0 w-full h-full overflow-hidden flex flex-col bg-transparent z-0'
      : isBounded
        ? 'fixed inset-0 w-full overflow-hidden flex flex-col bg-transparent z-0'
        : 'w-full min-h-[100vh] relative z-0 flex flex-col bg-transparent';

  // Inner wrapper (below header)
  const innerClass = isDashboard || isChat
    ? 'flex-1 flex flex-col relative w-full h-full overflow-hidden min-h-0'
    : isBounded
      ? 'flex-1 flex flex-col relative w-full overflow-hidden min-h-0'
      : 'flex-1 flex flex-col relative w-full';

  const isForumPage = pathname.startsWith('/forum');
  const mainClass = isDashboard
    ? 'relative z-10 w-full h-full flex-1 flex flex-col min-h-0 overflow-hidden md:pb-0'
    : isChat
      ? 'relative z-10 w-full h-full flex-1 flex flex-col min-h-0 overflow-hidden bg-transparent md:pb-0'
      : isBounded
      // Scroll is fully contained here — no empty page-level void zones.
      // Landing page also uses this path so scroll stops exactly at footer.
      ? `relative z-10 w-full flex-1 min-h-0 overflow-y-auto overflow-x-hidden overscroll-none flex flex-col md:pb-0 bg-white`
      : `relative z-10 w-full flex-1 flex flex-col overscroll-none md:pb-0`;



  // /chat has its own full-screen header  never show the global one there

  return (
    <>
      <ThemeApplier />
      <StudioLockGuard />
      <TitaniumGate>
        <UniversalEliteWallpaper />

          <div className={rootClass} data-chat-root={isChat ? '' : undefined}>
            <div className={innerClass}>

              <ZoomWrapper>
                <main
                  className={mainClass}
                  style={(isBounded || isChat) ? {
                    height: '100%',
                    minHeight: '100%',
                    maxHeight: '100%',
                    scrollbarWidth: 'thin',
                    overscrollBehavior: 'none',
                    touchAction: 'pan-y',
                  } : undefined}
                >
                  {displayContent}
                  {/* Same place for every route, so a live call's chat is never remounted. */}
                  <ChatKeepAlive />
                </main>
              </ZoomWrapper>
            </div>

          </div>
        </TitaniumGate>
    </>
  );
}
