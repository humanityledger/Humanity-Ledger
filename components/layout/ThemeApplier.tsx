"use client";

import { useEffect, useState } from "react";
import { useWalletStore } from "@/lib/store/wallet-store";
import { pxeEngine, DEFAULT_PXE_SETTINGS } from "@/lib/wallet/SettingsEnginePXE";

export function ThemeApplier() {
    const address = useWalletStore(state => state.address);
    const [theme, setTheme] = useState(DEFAULT_PXE_SETTINGS.theme);

    useEffect(() => {
        if (!address) return;
        
       if (typeof window !== 'undefined') {
        pxeEngine.mountNode(address).then(s => setTheme(s.theme));
      }
      
      // Subscribe to changes
        const unsubscribe = pxeEngine.subscribe(address, (newSettings) => {
            setTheme(newSettings.theme);
        });

        return () => unsubscribe();
    }, [address]);

    useEffect(() => {
        const html = document.documentElement;
        
        // Remove all previous theme classes
        html.classList.remove('theme-brutalist', 'theme-monochrome', 'theme-neon_void', 'theme-terminal', 'dark', 'light');
        
        // Map PXE themes to CSS classes
        // Note: For now, if brutalist/monochrome/terminal, we can default to light mode base
        // If neon_void, we can default to dark mode base
        html.classList.remove('dark');
        html.classList.add('light');
        
        // Add specific theme class
        html.classList.add(`theme-${theme}`);
    }, [theme]);

    return null;
}
