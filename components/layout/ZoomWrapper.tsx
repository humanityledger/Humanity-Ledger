'use client';

import React, { useEffect } from 'react';
import { usePathname } from 'next/navigation';

export function ZoomWrapper({ children }: { children: React.ReactNode }) {
    const pathname = usePathname();

    useEffect(() => {
        const viewport = document.querySelector('meta[name="viewport"]');
        if (viewport) {
            viewport.setAttribute('content', 'width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=0, viewport-fit=cover');
        }

        const isZoomTarget =
            pathname === '/' ||
            pathname === '/connect' ||
            pathname?.startsWith('/connect') ||
            pathname === '/chat' ||
            pathname?.startsWith('/chat');

        const updateZoom = () => {
            // Apply 67% scale on screens 640px and wider (desktop and tablets).
            // Zoom is driven purely via the CSS class 'hl-zoom-67' defined in
            // globals.css (@media screen and (min-width:640px){ html.hl-zoom-67{zoom:0.67} }).
            // We do NOT set document.documentElement.style.zoom here — that would
            // create an inline style that fights the stylesheet rule and causes
            // double-zoom when both exist simultaneously in Chromium.
            if (isZoomTarget && window.innerWidth >= 640) {
                document.documentElement.classList.add('hl-zoom-67');
            } else {
                document.documentElement.classList.remove('hl-zoom-67');
            }
        };

        updateZoom();
        window.addEventListener('resize', updateZoom);

        return () => {
            window.removeEventListener('resize', updateZoom);
            document.documentElement.classList.remove('hl-zoom-67');
        };
    }, [pathname]);

    // Native container without Lenis smooth scroll
    return (
        <>
            {children}
        </>
    );
}
