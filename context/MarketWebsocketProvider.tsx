"use client";

import React, { createContext, useContext, useEffect, useRef, useState } from 'react';

// Common mapping from Internal Symbol (BTC) to Binance Symbol (btcusdt)
export const BINANCE_SYMBOL_MAP: Record<string, string> = {
    BTC: 'btcusdt', ETH: 'ethusdt', BNB: 'bnbusdt', SOL: 'solusdt', XRP: 'xrpusdt',
    ADA: 'adausdt', DOGE: 'dogeusdt', SHIB: 'shibusdt', DOT: 'dotusdt', LINK: 'linkusdt',
    MATIC: 'maticusdt', POL: 'polusdt', AVAX: 'avaxusdt', TRX: 'trxusdt', UNI: 'uniusdt', PEPE: 'pepeusdt',
    FET: 'fetusdt', DAI: 'daiusdt', APE: 'apeusdt', LDO: 'ldousdt', ARB: 'arbusdt',
    OP: 'opusdt', STRK: 'strkusdt', AUTH: 'wldusdt', NEAR: 'nearusdt', FTM: 'ftmusdt',
    TAO: 'taousdt', INJ: 'injusdt', RNDR: 'rndrusdt', RENDER: 'renderusdt', JUP: 'jupusdt'
};

// Reverse map for quick lookup: 'btcusdt' -> 'BTC'
const REVERSE_MAP: Record<string, string> = {};
Object.entries(BINANCE_SYMBOL_MAP).forEach(([key, val]) => {
    REVERSE_MAP[val] = key;
});

export interface TokenMarketData {
    price: number;
    change24h: number; // percentage
}

interface MarketContextType {
    marketData: Record<string, TokenMarketData>;
    isConnected: boolean;
}

const MarketContext = createContext<MarketContextType>({
    marketData: {},
    isConnected: false
});

export const useMarketWebsocket = () => useContext(MarketContext);

export function MarketWebsocketProvider({ children }: { children: React.ReactNode }) {
    const [isConnected, setIsConnected] = useState(false);
    // Use a ref for continuous updates without forcing 60FPS re-renders
    const dataRef = useRef<Record<string, TokenMarketData>>({});
    // State purely to drive UI renders, throttled to 2 FPS to prevent DOM freeze
    const [, setRenderTick] = useState(0);

    useEffect(() => {
        let ws: WebSocket;
        let isMounted = true;
        let reconnectTimer: NodeJS.Timeout;

        const connect = () => {
            if (!isMounted) return;
            // The !ticker@arr stream sends real-time payload for ALL tickets in one single massive array
            ws = new WebSocket('wss://stream.binance.com:9443/ws/!ticker@arr');

            ws.onopen = () => {
                console.log('[System Grid] Direct Neural Link to Binance established (Zero Latency).');
                setIsConnected(true);
            };

            ws.onmessage = (event) => {
                try {
                    const payload = JSON.parse(event.data);
                    let updated = false;

                    for (const ticker of payload) {
                        const s = ticker.s.toLowerCase(); // Symbol
                        const mappedSymbol = REVERSE_MAP[s];

                        if (mappedSymbol) {
                            const currentPrice = parseFloat(ticker.c);
                            const change24 = parseFloat(ticker.P); // Percentage change

                            dataRef.current[mappedSymbol] = {
                                price: currentPrice,
                                change24h: change24
                            };
                            updated = true;
                        }
                    }
                } catch (e) {
                    // Silent fail parsing
                }
            };

            ws.onclose = () => {
                console.warn('[System Grid] Neural Link lost. Reconnecting...');
                setIsConnected(false);
                reconnectTimer = setTimeout(connect, 3000);
            };

            ws.onerror = (err) => {
                console.error('[System Grid] WebSocket Error:', err);
                ws.close();
            };
        };

        connect();

        // High frequency UI rendering loop: 2 times per second
        const renderLoop = setInterval(() => {
            setRenderTick(t => t + 1);
        }, 500);

        return () => {
            isMounted = false;
            clearInterval(renderLoop);
            if (reconnectTimer) clearTimeout(reconnectTimer);
            if (ws) ws.close();
        };
    }, []);

    return (
        <MarketContext.Provider value={{ marketData: dataRef.current, isConnected }}>
            {children}
        </MarketContext.Provider>
    );
}
