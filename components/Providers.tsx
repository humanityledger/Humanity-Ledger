"use client";


import { LanguageProvider } from "@/lib/i18n/LanguageContext";
import { State } from "wagmi";
import { SettingsProvider } from "@/context/SettingsContext";
import { AppProvider } from "@/components/AppContext";
import ClientWeb3Provider from '@/components/ClientWeb3Provider';
import { WorldProvider } from "@/context/WorldContext";
import { MarketWebsocketProvider } from "@/context/MarketWebsocketProvider";

import { SessionProvider } from "next-auth/react";
import { CWIProvider } from "@/lib/bsv/CWIContext";
import { useEffect } from "react";
import { WalletConnectionBridge } from "@/components/providers/WalletConnectionBridge";
import { GeoLoginTracker } from "@/components/auth/GeoLoginTracker";
import { VIPStoreBootstrap } from "@/components/providers/VIPStoreBootstrap";

export default function Providers({ children, initialState, cookies }: { children: React.ReactNode, initialState?: State, cookies?: string | null }) {
    useEffect(() => {
        if (typeof window !== "undefined" && "serviceWorker" in navigator) {
            navigator.serviceWorker.register("/sw.js").catch(console.error);
        }
    }, []);

    return (
        <SessionProvider>
            <AppProvider>
                <ClientWeb3Provider cookies={cookies || null}>
                    <SettingsProvider>
                        <LanguageProvider>
                            <MarketWebsocketProvider>
                                <WorldProvider>
                                    <CWIProvider>
                                        <WalletConnectionBridge />
                                        <GeoLoginTracker />
                                        <VIPStoreBootstrap />
                                        {children}
                                    </CWIProvider>
                                </WorldProvider>
                            </MarketWebsocketProvider>
                        </LanguageProvider>
                    </SettingsProvider>
                </ClientWeb3Provider>
            </AppProvider>
        </SessionProvider>
    );
}

