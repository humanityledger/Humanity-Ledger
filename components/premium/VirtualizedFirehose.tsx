"use client";

import React, { memo, useRef, useEffect, useState, useCallback } from 'react';
import dynamic from 'next/dynamic';
import { AnimatePresence, motion } from 'framer-motion';
import { useVIPStore, LedgerEvent } from '@/lib/vip-store';
import { ArrowRight, ChevronUp } from 'lucide-react';

// Dynamic imports to avoid SSR crashes (React Error #130)
const FixedSizeList = dynamic<any>(
    () => import('react-window').then(m => (m as any).FixedSizeList),
    { ssr: false }
);
const AutoSizer = dynamic<any>(
    () => import('react-virtualized-auto-sizer'),
    { ssr: false }
);

// ============================================================================
// SKELETON COMPONENT
// ============================================================================
const FirehoseSkeleton = () => (
    <div className="w-full flex flex-col gap-2 p-4 border-b border-[#E5E5E5] bg-white">
        <div className="flex items-center justify-between">
            <div className="flex items-center gap-4 w-1/4">
                <div className="h-2 w-12 bg-black/5 rounded animate-pulse" />
                <div className="h-3 w-16 bg-black/10 rounded animate-pulse" />
            </div>
            <div className="h-4 w-24 bg-black/10 rounded animate-pulse" />
            <div className="flex flex-col items-end gap-1 w-1/2">
                <div className="h-3 w-20 bg-black/10 rounded animate-pulse" />
                <div className="h-2 w-16 bg-black/5 rounded animate-pulse" />
            </div>
        </div>
    </div>
);

// ============================================================================
// ROW COMPONENT
// PERF: Replaced motion.div with a plain div + CSS transition.
// With 200+ rows each using motion.div (0.4s animation), Framer Motion was
// scheduling hundreds of concurrent JS animation timers on every store update,
// blocking the main thread. CSS transitions are handled by the GPU compositor
// (zero JS cost) and are visually identical at this opacity range.
// ============================================================================
const FirehoseRow = memo(({ data, index, style }: any) => {
    const event: LedgerEvent = data[index];
    if (!event) return null;

    const isBuy  = event.action === 'BUY'  || event.action === 'COMPRA';
    const isSell = event.action === 'SELL' || event.action === 'VENTA';

    let actionColor = 'text-[#888888]';
    let bgPulse     = 'border-transparent';

    if (isBuy)  { actionColor = 'text-[#00C076]'; bgPulse = 'border-[#00C076]/10 bg-[#00C076]/3'; }
    if (isSell) { actionColor = 'text-[#FF3B30]'; bgPulse = 'border-[#FF3B30]/10 bg-[#FF3B30]/3'; }

    const timeString = new Date(event.ts).toLocaleTimeString('en-US', {
        hour12: false, hour: '2-digit', minute: '2-digit', second: '2-digit'
    });

    return (
        <div style={style} className="px-2 py-1">
            {/* Pure CSS entry animation  zero JS overhead vs motion.div */}
            <div
                className={`w-full h-full flex flex-col justify-center border-b border-[#E5E5E5] ${bgPulse} hover:bg-[#FFFFFF] bg-white cursor-pointer rounded-sm px-4 firehose-row-enter`}
            >
                <div className="flex items-center justify-between">
                    {/* LEFT: Time & Token */}
                    <div className="flex items-center gap-4 w-1/4">
                        <span className="text-[10px] font-mono text-[#888888] tracking-widest">{timeString}</span>
                        <div className="flex items-center gap-2">
                            <div className={`w-1.5 h-1.5 rounded-full ${isBuy ? 'bg-[#00C076]' : isSell ? 'bg-[#FF3B30]' : 'bg-[#D4AF37]'}`} />
                            <span className="text-xs font-black text-[#050505] tracking-widest">{event.token}</span>
                        </div>
                    </div>

                    {/* MIDDLE: Amounts */}
                    <div className="flex flex-col items-center justify-center w-1/4">
                        <span className={`text-sm font-mono font-black tracking-tighter ${actionColor}`}>
                            {isBuy ? '+' : isSell ? '-' : ''}
                            {(parseFloat(event.amount) || 0).toLocaleString(undefined, { maximumFractionDigits: 2 })} {event.token}
                        </span>
                        <span className="text-[10px] font-mono text-[#888888] tracking-widest uppercase">
                            ${(event.usdNum || 0).toLocaleString(undefined, { maximumFractionDigits: 0 })}
                        </span>
                    </div>

                    {/* RIGHT: Action & Wallet */}
                    <div className="flex items-center justify-end gap-6 w-1/2">
                        <div className="flex items-center gap-2">
                            <span className="px-2 py-0.5 border border-[#E5E5E5] text-[9px] font-black text-[#888888] uppercase tracking-[0.2em] rounded-sm">
                                {event.action}
                            </span>
                            <ArrowRight size={10} className="text-[#888888]" />
                            <span className="text-[11px] font-mono text-[#D4AF37] uppercase tracking-widest">
                                {event.dex}
                            </span>
                        </div>
                        <div className="flex flex-col items-end">
                            <span className="text-[11px] font-black tracking-widest text-[#050505] uppercase">{event.label}</span>
                            <span className="text-[9px] font-mono text-[#888888]">
                                {event.wallet.substring(0, 6)}...{event.wallet.slice(-4)}
                            </span>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
});

FirehoseRow.displayName = 'FirehoseRow';

// ============================================================================
// MAIN FIREHOSE COMPONENT
// ============================================================================
export function VirtualizedFirehose() {
    const ledgerEvents = useVIPStore(state => state.ledgerEvents);
    const listRef     = useRef<any>(null);
    const [autoScroll, setAutoScroll] = useState(true);
    const [isMounted,  setIsMounted]  = useState(false);
    const [showJumpTop, setShowJumpTop] = useState(false);
    // Throttle flag  prevents scrollTo() from firing on every individual event
    const scrollThrottleRef = useRef(false);

    // Dynamic imports SSR guard
    useEffect(() => { setIsMounted(true); }, []);

    // PERF: Throttled auto-scroll  coalesce rapid store updates into a single scroll
    useEffect(() => {
        if (!autoScroll || !listRef.current || ledgerEvents.length === 0) return;
        if (scrollThrottleRef.current) return;
        scrollThrottleRef.current = true;
        requestAnimationFrame(() => {
            listRef.current?.scrollTo(0);
            scrollThrottleRef.current = false;
        });
    }, [ledgerEvents, autoScroll]);

    const handleJumpTop = useCallback(() => {
        if (listRef.current) {
            listRef.current.scrollTo(0);
            setAutoScroll(true);
            setShowJumpTop(false);
        }
    }, []);

    return (
        <div className="w-full h-full p-4 md:p-6 flex flex-col overflow-hidden text-[#050505] font-sans">
            {/* CSS entry animation for rows */}
            <style>{`
                @keyframes firehose-in { from { opacity: 0; transform: translateX(-8px); } to { opacity: 1; transform: translateX(0); } }
                .firehose-row-enter { animation: firehose-in 0.25s ease-out both; }
            `}</style>

            <div className="flex-1 w-full bg-white border border-[#E5E5E5] rounded-xl shadow-[0_8px_30px_rgb(0,0,0,0.06)] flex flex-col min-h-0 relative group overflow-hidden">

            {/* HEADER REMOVED - User requested to eliminate 'Global liquidity firehose Active' */}

            {/* VIRTUALIZED LIST CONTAINER */}
            <div
                className="flex-1 relative w-full min-h-0"
                onMouseEnter={() => {
                    setAutoScroll(false);
                    setShowJumpTop(true);
                }}
            >
                {/* Empty State / Skeleton */}
                {(!isMounted || ledgerEvents.length === 0) && (
                    <div className="absolute inset-0 z-10 bg-[#FFFFFF] flex flex-col">
                        {Array.from({ length: 10 }).map((_idx, i) => <FirehoseSkeleton key={i} />)}
                    </div>
                )}

                {/* Only render list on client with data */}
                {isMounted && ledgerEvents.length > 0 && (
                    <AutoSizer>
                        {({ height, width }: { height: number; width: number }) => (
                            <FixedSizeList
                                ref={listRef}
                                height={height || 400}
                                itemCount={ledgerEvents.length}
                                itemSize={64}
                                width={width || 800}
                                itemData={ledgerEvents}
                                className="scrollbar-hide"
                                itemKey={(index: number, data: LedgerEvent[]) => data[index]?.id || index}
                                overscanCount={3}
                            >
                                {FirehoseRow}
                            </FixedSizeList>
                        )}
                    </AutoSizer>
                )}

                {/* Fade gradients */}
                <div className="absolute top-0 left-0 right-0 h-8 bg-gradient-to-b from-[#FFFFFF] to-transparent pointer-events-none z-10" />
                <div className="absolute bottom-0 left-0 right-0 h-10 bg-gradient-to-t from-[#FFFFFF] to-transparent pointer-events-none z-10" />

                {/* Floating "Jump to Top" / Resume Control */}
                <AnimatePresence>
                    {!autoScroll && showJumpTop && (
                        <motion.button
                            initial={{ opacity: 0, y: 20 }}
                            animate={{ opacity: 1, y: 0 }}
                            exit={{ opacity: 0, y: 10 }}
                            onClick={handleJumpTop}
                            className="absolute top-4 left-1/2 -translate-x-1/2 z-20 flex items-center gap-2 px-4 py-2 bg-white text-[#FFFFFF] text-[9px] font-black uppercase tracking-widest rounded-full shadow-lg hover:scale-105 transition-transform active:scale-95 border border-[#E5E5E5]/20"
                        >
                            <ChevronUp size={12} /> Jump to Active Stream
                        </motion.button>
                    )}
                </AnimatePresence>
            </div>

            {/* FOOTER */}
            <div className="shrink-0 p-4 border-t border-[#E5E5E5] bg-[#FFFFFF] rounded-b-xl flex items-center justify-between z-20">
                <span className="text-[8px] font-mono text-[#888888] uppercase tracking-[0.3em]">
                    Powered by Zero Knowledge Nodes
                </span>
                {!autoScroll && ledgerEvents.length > 0 && (
                    <button
                        onClick={() => setAutoScroll(true)}
                        className="text-[8px] font-black text-[#00C076] uppercase tracking-[0.2em] animate-pulse hover:underline"
                    >
                        Resume Alpha Feed
                    </button>
                )}
            </div>
        </div>
        </div>
    );
}

