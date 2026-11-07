'use client';

import React, { useEffect } from 'react';
import { usePathname } from 'next/navigation';

export function ZoomWrapper({ children }: { children: React.ReactNode }) {
    const pathname = usePathname();

    useEffect(() => {
        // The viewport meta is owned by `export const viewport` in app/layout.tsx.
        // This used to overwrite it with maximum-scale=1 and user-scalable=0,
        // which blocks pinch zoom (WCAG 1.4.4) on every page.

        const isZoomTarget =
            pathname === '/' ||
            pathname === '/connect' ||
            pathname?.startsWith('/connect');

        const updateZoom = () => {
            const isTouch = typeof window !== 'undefined' && window.matchMedia?.('(pointer: coarse)').matches;
            if (isZoomTarget && window.innerWidth >= 980 && !isTouch) {
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
