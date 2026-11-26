"use client";

import React, { useEffect, useState, useRef } from 'react';
import dynamic from 'next/dynamic';
import { useSystemAccount } from '@/hooks/useSystemAccount';

// No mobile news shell anymore

export function MobileEnforcer({ children }: { children: React.ReactNode }) {
    const [mounted, setMounted] = useState(false);
    const [, setIsMobile] = useState(false); // drives the body classes below; no route decisions
    const { isConnected, address, isZkVerified } = useSystemAccount();

    // Track previous connection state to detect NEW wallet connections
    const prevConnected = useRef<boolean>(false);

    useEffect(() => {
        const checkMobile = () => {
            // Absolute hardware guard: If physical screen is >= 1024px, it is NEVER mobile.
            // This prevents false positives on large touch screens or UA spoofing.
            if (window.screen && window.screen.width >= 1024) {
                setIsMobile(false);
                return;
            }

            const userAgent = navigator.userAgent || navigator.vendor || (window as any).opera;
            // UA-based detection  works for standard mobile browsers
            const isUaMobile = /android|webos|iphone|ipad|ipod|blackberry|iemobile|opera mini/i.test(userAgent.toLowerCase());
            const isTouchScreen = navigator.maxTouchPoints > 0 || 'ontouchstart' in window;
            const isSmallScreen  = window.screen.width < 768;
            
            const mobileDetected = isUaMobile || (isTouchScreen && isSmallScreen);
            setIsMobile(mobileDetected);

            //  INHUMAN OPTIMIZATION: Sterile Layout Constraints 
            // If mobile is detected, immediately enforce sterile viewport physics
            // directly onto the root DOM before React finishes hydration.
            if (mobileDetected) {
                document.documentElement.style.setProperty('--mobile-sterile-enforcer', 'active');
                if (document.body) {
                    document.body.classList.add('mobile-sterile-lock');
                    document.body.classList.add('is-mobile-device');
                }
            } else {
                if (document.body) {
                    document.body.classList.remove('is-mobile-device');
                }
            }
        };

        checkMobile();
        setMounted(true);
        window.addEventListener('resize', checkMobile);

        // [SECURITY 2026-10-28] Desktop sign-in links (?uuid=&pub= or ?session=)
        // are no longer picked up from the URL. They used to be stored here and
        // completed automatically once a wallet was connected, without asking:
        // opening one crafted link on a signed-in phone signed an attacker's
        // computer into that account. Desktop sign-in now always goes through
        // the scanner, which shows a warning and asks for the PIN on the computer.
        try {
            ['pending_qr_uuid', 'pending_qr_pub', 'pending_qr_ecdh', 'pending_qr_exp', 'pending_handshake_session']
                .forEach(k => sessionStorage.removeItem(k));
        } catch { /* storage unavailable */ }

        // Legacy check removed

        return () => window.removeEventListener('resize', checkMobile);
    }, []);


    useEffect(() => {
        if (!mounted) return;
        prevConnected.current = isConnected;
    }, [isConnected, mounted]);

    if (!mounted) {
        // [SOVEREIGN PERFECTION] We NO LONGER hide the children.
        // Hydration errors are best handled by stable skeletons in TitaniumGate.
        return <>{children}</>;
    }

    // Every route renders on phones exactly as on a computer. This component used to keep an allowlist of
    // routes and send any other one to /chat with window.location.replace. /beta, /join/<code>, /alpha,
    // /status and the other pages added later were missing from it, so on every phone (iPhone and Android,
    // Safari and Chrome) a signed-in user without a beta pass went /chat → 303 /beta (middleware) →
    // replace('/chat') → /beta … forever, and beta invitation links never opened (23/11/2026).
    // The PC-only pages that list protected (/terminal, /portfolio, /vip, /predictions, /ledgerpost…)
    // are retired on the server by the middleware (lib/security/retiredRoutes.ts), for every device,
    // so no redirect is needed here. Do not add one back: a client redirect that disagrees with the
    // middleware is a redirect loop.
    return <>{children}</>;
}
