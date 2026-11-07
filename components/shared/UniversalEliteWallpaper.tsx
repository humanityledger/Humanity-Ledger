"use client";

import React from 'react';
import { useSettingsStore } from '@/lib/store/useSettingsStore';
import { usePathname } from 'next/navigation';

/**
 * UniversalEliteWallpaper  Global fixed background layer
 *
 * - backgroundSize: cover  zero white side bands, fills edge-to-edge
 * - Dark mode   wallpaper fully visible, 55% dark overlay for contrast
 * - Light mode  wallpaper at full size, 88% white overlay for readability
 * - /connect    hidden — page manages its own background
 */
export function UniversalEliteWallpaper() {
    const pathname = usePathname() ?? '/';
    const theme = useSettingsStore((s) => s.theme);

    // /connect and /chat manage their own wallpaper — skip the global overlay
    if (pathname.startsWith('/connect') || pathname.startsWith('/chat')) return null;

    const isDark = theme === 'dark' || (
        theme === 'system' &&
        typeof window !== 'undefined' &&
        window.matchMedia('(prefers-color-scheme: dark)').matches
    );

    return (
        <div
            className="fixed inset-0 pointer-events-none select-none overflow-hidden"
            style={{ zIndex: -1 }}
            aria-hidden="true"
        >
            {/*  Base: light background  */}
            <div className="absolute inset-0 bg-[#FFFFFF]" />



            {/*  Light mode: translucent overlay  */}
            {!isDark && (
                <div
                    className="absolute inset-0 transition-opacity duration-700 bg-white"
                />
            )}

            {/*  Dark mode: deepen shadows so white text is readable  */}
            {isDark && (
                <div
                    className="absolute inset-0 transition-opacity duration-700"
                    style={{ background: 'rgba(0, 0, 0, 0.30)' }}
                />
            )}
        </div>
    );
}
