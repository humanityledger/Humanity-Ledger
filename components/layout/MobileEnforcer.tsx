"use client";

import React, { useEffect, useState, useRef } from 'react';
import { MobileLanding as MobileSystemLanding } from '@/components/landing/MobileLanding';
import dynamic from 'next/dynamic';
import { useSystemAccount } from '@/hooks/useSystemAccount';
import { usePathname } from 'next/navigation';

// No mobile news shell anymore

export function MobileEnforcer({ children }: { children: React.ReactNode }) {
    const [mounted, setMounted] = useState(false);
    const [isMobile, setIsMobile] = useState(false);
    const { isConnected, address, isZkVerified } = useSystemAccount();
    const pathname = usePathname() ?? '/';

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

    //  MOBILE ZONE 
    if (isMobile) {
        //  [DIRECT ACCESS ROUTES] 
        // These are PUBLIC or informational routes that render normally on mobile.
        // ️  PC-ONLY routes (/terminal, /portfolio, /settings, /system-intel,
        //     /predictions, /vip, /ledgerpost) are intentionally EXCLUDED here.
        //     A mobile user  even with a connected wallet  must NOT reach those
        //     pages because they are designed exclusively for the PC terminal.
        //     They will stay on MobileSystemLanding as intended.
        const DIRECT_ACCESS_ROUTES = [
            '/',
            '/news',
            '/connect',
            '/login',
            '/sign-up',

            '/faq',
            '/ticket',
            '/privacy',
            '/terms',
            '/legal',
            '/forum',

            '/company',
            '/about',
            '/product',
            '/academy',
            '/support',
            '/passport',
            '/scan',
            '/studio',

            // App hub + docs: same experience on mobile and desktop
            '/chat',
            '/docs',
            '/settings',
            '/whitepaper',
        ];

        // [Cryptographic-GATE] Always allow dashboard/chat/portfolio so they can reach the ZK-Gate and connect from there
        DIRECT_ACCESS_ROUTES.push('/terminal', '/chat', '/portfolio');

        const isDirectAccessRoute = DIRECT_ACCESS_ROUTES.some(r => pathname === r || pathname.startsWith(r + '/'));

        if (isDirectAccessRoute) {
            return <>{children}</>;
        }

        // If it's a mobile device and they try to hit a non-direct access route,
        // we redirect them to /hub instead of showing a fake mobile landing.
        // This ensures the App Hub is EXACTLY the same on Android/iOS/PC.
        if (typeof window !== 'undefined') {
            window.location.replace('/chat');
            return null;
        }
    }

    //  PC ZONE 
    return <>{children}</>;
}
