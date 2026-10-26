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

        const isZoomTarget = pathname === '/' || pathname === '/connect' || pathname?.startsWith('/connect');

        const updateZoom = () => {
            // Apply 50% scale on screens 640px and wider (desktop and tablets)
            // On narrow mobile devices (<640px), retain natural touch scale
            if (isZoomTarget && window.innerWidth >= 640) {
                document.documentElement.style.zoom = '0.5';
                document.documentElement.classList.add('hl-zoom-50');
            } else {
                document.documentElement.style.zoom = '';
                document.documentElement.classList.remove('hl-zoom-50');
            }
        };

        updateZoom();
        window.addEventListener('resize', updateZoom);

        return () => {
            window.removeEventListener('resize', updateZoom);
            document.documentElement.style.zoom = '';
            document.documentElement.classList.remove('hl-zoom-50');
        };
    }, [pathname]);

    // Native container without Lenis smooth scroll
    return (
        <>
            {children}
        </>
    );
}
