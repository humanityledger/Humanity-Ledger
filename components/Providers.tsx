"use client";


import { LanguageProvider } from "@/lib/i18n/LanguageContext";
import { State } from "wagmi";
import { SettingsProvider } from "@/context/SettingsContext";
import { AppProvider } from "@/components/AppContext";
import ClientWeb3Provider from '@/components/ClientWeb3Provider';

import { SessionProvider } from "next-auth/react";
import { useEffect } from "react";
import { WalletConnectionBridge } from "@/components/providers/WalletConnectionBridge";

export default function Providers({ children, initialState, cookies }: { children: React.ReactNode, initialState?: State, cookies?: string | null }) {
    useEffect(() => {
        if (typeof window !== "undefined" && "serviceWorker" in navigator) {
            navigator.serviceWorker.register("/sw.js").catch(console.error);
        }
    }, []);

    return (
        <SessionProvider refetchOnWindowFocus={false}>
            <AppProvider>
                <ClientWeb3Provider cookies={cookies || null}>
                    <SettingsProvider>
                        <LanguageProvider>
                            {/* Only Ledger Chat ships: no market websocket (it opened a Binance stream for every visitor), World ID or BSV providers. */}
                            <WalletConnectionBridge />
                            {children}
                        </LanguageProvider>
                    </SettingsProvider>
                </ClientWeb3Provider>
            </AppProvider>
        </SessionProvider>
    );
}

