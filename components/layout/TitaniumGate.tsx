'use client';

import React, { useState, useEffect } from 'react';
import { SafeErrorBoundary } from '@/components/ui/SafeErrorBoundary';
import { createContext, useContext } from 'react';
import { usePathname, useRouter } from 'next/navigation';
import { useAccount } from 'wagmi';

type GateState = 'INTRO' | 'AUTH' | 'APP';

interface GateContextType {
    state: GateState;
    hasPlayedIntro: boolean;
}

const GateStateContext = createContext<GateContextType>({ state: 'INTRO', hasPlayedIntro: false });
export const useGateState = () => useContext(GateStateContext);

interface TitaniumGateProps {
    children: React.ReactNode;
    requiredTier?: string;
}

export function TitaniumGate({ children, requiredTier = 'PRO' }: TitaniumGateProps) {
    const { isConnected, isConnecting, isReconnecting } = useAccount();
    const pathname = usePathname() ?? '/';
    const router = useRouter();

    // Pre-compute isPublicPage synchronously so we can use it as the initial state.
    // This prevents the loader flash on /connect after disconnect.
    // NOTE: /chat and /hub handle their own auth internally — they must NEVER be
    // gated here or TitaniumGate will render null causing a blank white screen.
    const initialIsPublicPage = ['/', '/connect', '/login', '/sign-up', '/terms', '/privacy', '/developers', '/forum', '/news', '/chat', '/hub'].some(
        path => path === pathname || (path !== '/' && pathname?.startsWith(path))
    );

    const [state, setState] = useState<GateState>(initialIsPublicPage ? 'APP' : 'AUTH');
    const [mounted, setMounted] = useState(false);
    const [forceVisible, setForceVisible] = useState(false);

    useEffect(() => {
        // [SOVEREIGN FAIL-SAFE] 
        // Force system visibility after 4 seconds regardless of state.
        // This is a zero-trust measure against hydration hangs.
        const emergency = setTimeout(() => {
            console.warn('[TitaniumGate] Deadlock detected. Forcing emergency visibility.');
            setForceVisible(true);
        }, 5000);
        return () => clearTimeout(emergency);
    }, []);
    
    // Strict Whitelist: connect, docs, terms, privacy, developers, chat and hub are always visible.
    // /chat and /hub handle their own auth — TitaniumGate must not gate them.
    const isPublicPage = ['/', '/connect', '/login', '/sign-up', '/terms', '/privacy', '/developers', '/forum', '/news', '/chat', '/hub'].some(
        path => path === pathname || (path !== '/' && pathname?.startsWith(path))
    );

    useEffect(() => {
        setMounted(true);
        // Fail-safe: if after 2s we are still stuck, force APP state if on public page
        const timer = setTimeout(() => {
            if (isPublicPage) setState('APP');
        }, 2000);
        return () => clearTimeout(timer);
    }, [isPublicPage]);

    useEffect(() => {
        // Increased debounce: 300ms was too short on first mobile connection.
        // establishSession() writes the cookie AFTER wagmi reconnects (~200-400ms).
        // 1500ms gives wagmi + cookie-write time to complete before we gate.
        const checkTimer = setTimeout(async () => {
            if (!mounted) return;

            // ─────────────────────────────────────────────────────────────────
            // [ABSOLUTE DISCONNECT FIREWALL] — Checked FIRST before everything.
            // After nuclearDisconnect(), __disconnected__ is written to BOTH
            // localStorage (survives hard reloads) and sessionStorage (same tab).
            // If this guard is active we MUST NOT call /api/auth/verify-session —
            // the httpOnly cookies (ledger_session, human_session) may still be
            // present in the browser for a brief moment while the server processes
            // the deletion response. A verify-session call in that window would
            // return authenticated:true and silently re-log the user back in.
            // ─────────────────────────────────────────────────────────────────
            let isDisconnectGuarded = false;
            try {
                isDisconnectGuarded =
                    sessionStorage.getItem('__disconnected__') === '1' ||
                    localStorage.getItem('__disconnected__') === '1';
            } catch { /* storage may be blocked in incognito — treat as unguarded */ }

            if (isDisconnectGuarded) {
                // The user explicitly logged out. Deny access to ALL protected routes.
                // Public pages are still allowed (landing, /connect, etc.).
                if (isPublicPage) {
                    setState('APP');
                    return;
                }
                setState('AUTH');
                if (pathname !== '/connect') router.push('/connect?returnUrl=' + encodeURIComponent(pathname));
                return;
            }

            // Failsafe: if we are in the middle of connecting/reconnecting, WAIT.
            if (isConnecting || isReconnecting) return;

            // Priority 1: Wagmi is connected
            if (isConnected) {
                setState('APP');
                return;
            }

            // Priority 2: Public Page (/, /connect, /docs, etc.)
            if (isPublicPage) {
                setState('APP');
                return;
            }

            // Priority 3: system_handshake cookie (JS-readable, set by all auth paths).
            // Accepts: wallet address (0x...) OR Google/Email OAuth identifier (email_...)
            const hasHandshake = typeof document !== 'undefined'
                && document.cookie.split('; ').some(r =>
                    r.startsWith('system_handshake=0x') ||
                    r.startsWith('system_handshake=email_')
                );

            // Priority 3.5: Local System Wallet session storage fallback.
            const isLocalUnlocked = typeof window !== 'undefined'
                && sessionStorage.getItem('portfolio_unlocked') === 'true';

            if (hasHandshake || isLocalUnlocked) {
                setState('APP');
                return;
            }

            // Priority 4: Server-side JWT cookies (ledger_session / human_session).
            // These are HttpOnly so we cannot read them from document.cookie.
            // Call verify-session which checks all token types server-side.
            // This is the fallback for QR-hydrated sessions where system_handshake
            // may briefly lag behind the HttpOnly cookies.
            try {
                const res = await fetch('/api/auth/verify-session', { cache: 'no-store', credentials: 'include' });
                if (res.ok) {
                    const data = await res.json();
                    if (data.authenticated) {
                        setState('APP');
                        return;
                    }
                }
            } catch {
                // Network error — fail open to avoid locking out users on flaky connections.
            }

            // Otherwise: Access Denied — redirect to connect, preserving intended destination.
            setState('AUTH');
            if (pathname !== '/connect') router.push('/connect?returnUrl=' + encodeURIComponent(pathname));
        }, 1500);

        return () => clearTimeout(checkTimer);
    }, [isConnected, isConnecting, isReconnecting, isPublicPage, router, mounted, pathname]);


    // [iOS PERFECTION] We no longer return an invisible div. Instead, we render
    // the provider structure immediately to avoid React Tree mismatch crashes.

    return (
        <GateStateContext.Provider value={{ state, hasPlayedIntro: true }}>
            {/* THE APPLICATION (or EMERGENCY BYPASS)  zero loading UI */}
            {(state === 'APP' || forceVisible) ? (
                <div 
                    className="relative z-10 min-h-full w-full"
                    style={forceVisible ? { opacity: 1, zIndex: 999, display: 'block', minHeight: '100%', width: '100%' } : { minHeight: '100%', width: '100%' }}
                >
                    <SafeErrorBoundary>
                        {children}
                    </SafeErrorBoundary>
                </div>
            ) : null}
        </GateStateContext.Provider>
    );
}

