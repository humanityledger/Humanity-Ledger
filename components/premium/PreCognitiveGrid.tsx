"use client";

import React, { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Activity, Zap, Eye, ArrowUp, ArrowDown } from 'lucide-react';
import { SystemSignalOverlay } from './SystemSignalOverlay';

interface GlobalIceberg {
    price: number;
    sizeUsd: number;
    exchanges: string[];
    isAsk: boolean;
}

interface PrecognitiveState {
    gravityScore: number;
    direction: 'BEARISH' | 'BULLISH' | 'NEUTRAL';
    targetPrice: number;
    institutionalVigorValue: number;
    institutionalVigorPercent: number;
    institutionalIsAccumulation: boolean;
    polyConfluenceValue: number;
    polyHasData: boolean;
    icebergs: GlobalIceberg[];
    probabilityOfReversal: number;
    expectedMove: number;
}

interface PreCognitiveGridProps {
    symbol: string;
}

export function PreCognitiveGrid({ symbol }: PreCognitiveGridProps) {
    const [state, setState] = useState<PrecognitiveState | null>(null);
    const [isHovered, setIsHovered] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [showSystemOverlay, setShowSystemOverlay] = useState(false);
    
    const canvasRef = useRef<HTMLCanvasElement>(null);

    useEffect(() => {
        let isMounted = true;

        const fetchStream = async () => {
            try {
                const response = await fetch(`/api/grid/stream?asset=${symbol}`);

                if (!response.ok) throw new Error(`Stream ${response.status}`);
                if (!response.body) throw new Error('ReadableStream not supported');
                const reader = response.body.getReader();
                const decoder = new TextDecoder('utf-8');
                let buffer = '';

                while (isMounted) {
                    const { done, value } = await reader.read();
                    if (done) break;
                    buffer += decoder.decode(value, { stream: true });
                    const lines = buffer.split('\n\n');
                    buffer = lines.pop() || '';

                    for (const line of lines) {
                        if (line.startsWith('data: ')) {
                            try {
                                const parsed = JSON.parse(line.slice(6));
                                if (isMounted) setState(parsed);
                            } catch (_err) {}
                        }
                    }
                }
            } catch (err) {
                if (!isMounted) return;
                setError('reconnecting...');
                // Exponential backoff reconnect
                await new Promise(r => setTimeout(r, 3000));
                if (isMounted) { setError(null); fetchStream(); }
            }
        };

        fetchStream();
        return () => { isMounted = false; };
    }, [symbol]);

    // Format utility
    const fmtCompact = (n: number) => new Intl.NumberFormat('en-US', { notation: 'compact', style: 'currency', currency: 'USD', maximumFractionDigits: 1 }).format(Math.abs(n));

    const gravityPercent = state?.gravityScore || 50;
    const positionPercent = state?.direction === 'BULLISH' ? 50 - (gravityPercent / 2) : 50 + (gravityPercent / 2);

    let gaugeColor = '#94a3b8'; // gray
    let auraClass = '';
    
    if (positionPercent <= 40) {
        gaugeColor = '#06b6d4'; // Cyan-500
        if (gravityPercent > 70) auraClass = 'shadow-[0_0_15px_3px_rgba(6,182,212,0.8)] border-cyan-400';
    } else if (positionPercent >= 60) {
        gaugeColor = '#f97316'; // Orange-500
        if (gravityPercent > 70) auraClass = 'shadow-[0_0_15px_3px_rgba(249,115,22,0.8)] border-orange-400';
    }

    // Phase 2: LEDGER CONFLUENCE OVERRIDE
    const isLedgerConfluence = (state?.institutionalVigorPercent || 0) > 80 && gravityPercent > 70;
    if (isLedgerConfluence) {
        gaugeColor = '#ef4444'; // Rose-500
        auraClass = 'shadow-[0_0_20px_5px_rgba(239,68,68,0.9)] border-rose-400';
    }

    // Phase 3: premium signal overlay
    useEffect(() => {
        if (!state) return;
        const vigorActive = state.institutionalVigorPercent > 80;
        const gravityActive = state.gravityScore > 70;
        const polyActive = state.polyHasData && (state.polyConfluenceValue > 0.75); // Using exact decimals up to mapped probability
        
        // Let's assume polyConfluenceValue is returned 0-100 internally, map bounds 75+
        const pmMeetsThreshold = state.polyHasData && state.polyConfluenceValue >= 75; 

        if (vigorActive && gravityActive && pmMeetsThreshold) {
            setShowSystemOverlay(true);
        }
    }, [state]);

    // Canvas WebGL (Native 2D) Heatmap rendering
    useEffect(() => {
        if (!canvasRef.current || !state) return;
        
        const canvas = canvasRef.current;
        const ctx = canvas.getContext('2d');
        if (!ctx) return;

        // Ensure canvas draws sharp pixels
        const width = canvas.width;
        const height = canvas.height;
        ctx.clearRect(0, 0, width, height);

        // Draw thermal glow background base
        const gradient = ctx.createLinearGradient(0, 0, width, 0);
        gradient.addColorStop(0, 'rgba(6, 182, 212, 0.05)'); // Cyan Longs
        gradient.addColorStop(0.5, 'rgba(255, 255, 255, 0.0)');
        gradient.addColorStop(1, 'rgba(249, 115, 22, 0.05)'); // Orange Shorts
        ctx.fillStyle = gradient;
        ctx.fillRect(0, 0, width, height);

        // Draw Icebergs
        if (state.icebergs && state.icebergs.length > 0) {
            state.icebergs.forEach(iceberg => {
                // Map the price arbitrarily onto the 0-100% X axis for the heatmap visualization
                // Normally we map exact delta from Mark Price, here we use the direction mapping roughly
                const isShort = iceberg.isAsk;
                const normalizedX = isShort ? Math.min(width * 0.8, width * (0.6 + (Math.random() * 0.3))) : Math.max(width * 0.1, width * (0.1 + (Math.random() * 0.3)));
                
                // Opacity/Glow strength by size
                const sizeWeight = Math.min(iceberg.sizeUsd / 100_000_000, 1.0); // max glow at 100M
                
                ctx.beginPath();
                ctx.moveTo(normalizedX, 0);
                ctx.lineTo(normalizedX, height);
                ctx.lineWidth = 1 + (sizeWeight * 3);
                
                // Add WebGL-like shadow blur natively in Canvas
                ctx.shadowBlur = sizeWeight * 15;
                ctx.shadowColor = isShort ? 'rgba(239, 68, 68, 0.8)' : 'rgba(59, 130, 246, 0.8)';
                ctx.strokeStyle = isShort ? `rgba(239, 68, 68, ${0.4 + sizeWeight*0.5})` : `rgba(59, 130, 246, ${0.4 + sizeWeight*0.5})`;
                ctx.stroke();
                
                // Reset shadow to not pollute next draws
                ctx.shadowBlur = 0;
            });
        }
    }, [state]);

    if (!state) {
        return (
            <div className="bg-[#FFFFFF] border border-[#050505]/10 rounded-2xl p-6 h-40 flex items-center justify-center animate-pulse">
                <span className="text-[10px] font-black uppercase text-[#050505]/30 tracking-widest">Warming Grid Engine...</span>
            </div>
        );
    }

    return (
        <>
            <AnimatePresence>
                {showSystemOverlay && (
                    <SystemSignalOverlay 
                        symbol={symbol}
                        direction={state.direction}
                        reversalProb={state.probabilityOfReversal}
                        expectedMove={state.expectedMove}
                        vigorPercent={state.institutionalVigorPercent}
                        gravityScore={state.gravityScore}
                        icebergDefense={state.icebergs?.[0] ? `${fmtCompact(state.icebergs[0].sizeUsd)} Limit` : 'None'}
                        onClose={() => setShowSystemOverlay(false)}
                    />
                )}
            </AnimatePresence>

            <div 
                className="group relative bg-[#FFFFFF] border border-[#050505]/10 rounded-2xl p-6 overflow-hidden transition-all duration-300 hover:shadow-2xl hover:border-[#050505]/30 cursor-crosshair min-h-[160px]"
                onMouseEnter={() => setIsHovered(true)}
                onMouseLeave={() => setIsHovered(false)}
            >
                {/* Active Indicator Badge */}
                {!error && (
                    <div className="absolute top-5 right-5 flex items-center gap-1.5 z-20">
                        <div className="w-1.5 h-1.5 rounded-full bg-[#00FFAA] animate-[pulse_600ms_ease-in-out_infinite]" />
                        <span className="text-[7px] font-black text-[#00FFAA] uppercase tracking-[0.2em] bg-[#00FFAA]/10 px-1.5 py-0.5 rounded">
                            {showSystemOverlay ? 'Premium overlay' : 'On-chain synced'}
                        </span>
                    </div>
                )}

                {/* Header */}
                <div className="flex items-center justify-between z-10 relative">
                    <div className="flex items-center gap-3">
                        <span className="text-2xl font-black italic tracking-tighter text-[#050505]">{symbol}</span>
                        <span className="px-2 py-0.5 rounded text-[8px] font-black bg-white text-white tracking-[0.2em] shadow-sm flex items-center gap-1">
                            <Zap size={8} className="text-amber-400" />
                            PRE-COG
                        </span>
                    </div>
                    <div className="text-right">
                        <span className="block text-[8px] font-black text-[#050505]/40 uppercase tracking-[0.3em] mb-1">Gravity Squeeze</span>
                        <span className="text-xl font-mono font-black text-[#050505] tracking-tighter flex items-center gap-1.5 justify-end">
                            {state.gravityScore.toFixed(1)}G
                            {state.direction === 'BULLISH' ? <ArrowUp size={16} className="text-cyan-500" /> : state.direction === 'BEARISH' ? <ArrowDown size={16} className="text-orange-500" /> : <Activity size={16} className="text-slate-400" />}
                        </span>
                    </div>
                </div>

                {/* Tension Gauge & Native Canvas Heatmap */}
                <div className="mt-8 relative z-10">
                    <div className="flex justify-between text-[7px] font-black text-[#050505]/40 uppercase tracking-widest mb-1">
                        <span className="text-cyan-600 font-bold">Long Liquidity</span>
                        <span>Equilibrium</span>
                        <span className="text-orange-600 font-bold">Short Liquidity</span>
                    </div>
                    
                    {/* The WebGL/Canvas layer renders just beneath the line physically within the DOM */}
                    <div className="relative w-full h-10 mt-1 mb-2">
                        <canvas ref={canvasRef} width={800} height={40} className="w-full h-full absolute top-0 left-0 bg-transparent rounded pointer-events-none" />
                        
                        {/* Gauge Axis Line */}
                        <div className="absolute top-1/2 -translate-y-1/2 w-full h-1 bg-white/5 rounded-full" />
                        
                        {/* Interactive Position Node */}
                        <motion.div 
                            initial={false}
                            animate={{ left: `${positionPercent}%` }}
                            transition={{ type: 'spring', stiffness: 200, damping: 20 }}
                            className="absolute top-1/2 -translate-y-1/2 -ml-1.5 z-20 flex flex-col items-center"
                        >
                            {isLedgerConfluence && (
                                <motion.div 
                                    animate={{ scale: [1, 1.12, 1] }} 
                                    transition={{ duration: 0.6, repeat: Infinity, ease: "easeInOut" }}
                                    className="absolute -top-4 w-max text-[6px] font-black tracking-widest text-[#ef4444]"
                                >
                                    LEDGER CONFLUENCE
                                </motion.div>
                            )}
                            <motion.div 
                                animate={gravityPercent > 85 ? { scale: [1, 1.08, 1] } : { scale: 1 }}
                                transition={gravityPercent > 85 ? { duration: 0.8, repeat: Infinity, ease: "easeInOut" } : {}}
                                className={`w-3 h-3 rounded-full bg-white border border-white transition-all duration-300 mix-blend-multiply ${auraClass}`} 
                                style={{ backgroundColor: gravityPercent > 70 ? gaugeColor : '#050505' }}
                            />
                        </motion.div>
                    </div>
                </div>

                {/* Hover Tooltip - Absolute Alpha */}
                <AnimatePresence>
                    {isHovered && (
                        <motion.div 
                            initial={{ opacity: 0, y: 10, backdropFilter: 'blur(0px)' }}
                            animate={{ opacity: 1, y: 0, backdropFilter: 'blur(12px)' }}
                            exit={{ opacity: 0, y: 5, backdropFilter: 'blur(0px)' }}
                            transition={{ duration: 0.2 }}
                            className="absolute inset-0 bg-white/90 z-30 p-5 flex flex-col justify-center overflow-auto"
                        >
                            <div className="space-y-4">
                                <div className="grid grid-cols-2 gap-4 divide-x divide-white/10">
                                    {/* VIGOR METRIC */}
                                    <div>
                                        <span className="block text-[8px] font-bold text-white/40 uppercase tracking-widest mb-1">Inst. Vigor (Delta)</span>
                                        <div className="flex flex-col">
                                            <span className={`text-[10px] font-mono font-black ${state.institutionalIsAccumulation ? 'text-cyan-400' : 'text-orange-400'}`}>
                                                {state.institutionalVigorPercent.toFixed(0)}% {state.institutionalIsAccumulation ? 'ACCUM' : 'DISTRIB'}
                                            </span>
                                            <span className="text-[8px] font-mono font-bold text-white/60 mt-0.5">
                                                Delta 1H: {state.institutionalIsAccumulation ? '+' : '-'}${fmtCompact(state.institutionalVigorValue)} (Ledger vs Retail)
                                            </span>
                                        </div>
                                    </div>
                                    
                                    {/* POLY CONFLUENCE METRIC */}
                                    <div className="pl-4">
                                        <span className="block text-[8px] font-bold text-white/40 uppercase tracking-widest mb-1">Poly Confluence</span>
                                        {state.polyHasData ? (
                                            <span className="text-xs font-mono font-black text-amber-300 shadow-[0_0_8px_rgba(252,211,77,0.3)]">
                                                {typeof state.polyConfluenceValue === 'number' ? state.polyConfluenceValue.toFixed(1) : (state.polyConfluenceValue as any).ratio || state.polyConfluenceValue}% Agreement
                                            </span>
                                        ) : (
                                            <span className="text-[9px] font-mono font-black text-[#888888] bg-[#888]/10 px-1 py-0.5 rounded">
                                                NO PM DATA - Neutral Applied
                                            </span>
                                        )}
                                    </div>
                                </div>

                                {/* GLOBAL ICEBERGS METRIC */}
                                {state.icebergs && state.icebergs.length > 0 && (
                                    <div className="border border-red-500/20 bg-red-500/5 rounded p-2">
                                        <span className="block text-[8px] font-bold text-red-400 uppercase tracking-[0.2em] mb-1">Global Icebergs Detected</span>
                                        {state.icebergs.slice(0,1).map((ice, i) => (
                                            <span key={i} className="text-[9px] font-mono text-white tracking-widest">
                                                Iceberg ${fmtCompact(ice.sizeUsd)} @ ${ice.price.toLocaleString()} ({ice.exchanges.join(' + ')} combined)
                                            </span>
                                        ))}
                                    </div>
                                )}

                                {/* REVERSAL EQUATION */}
                                <div className="border border-white/20 bg-white/5 rounded-lg p-3 relative overflow-hidden">
                                    <span className="text-[7px] font-black tracking-[0.2em] text-[#00FFAA]/70 uppercase block mb-2 font-mono">
                                        Prob_Reversal = (Vigor*0.55) + (Gravity*0.30) + (Poly*0.15)
                                    </span>
                                    <div className="flex flex-col mb-1">
                                        <div className="flex items-center gap-2">
                                            <Eye size={12} className="text-white animate-[pulse_1s_infinite]" />
                                            <span className="text-white font-black text-[11px] tracking-wide">
                                                {state.probabilityOfReversal.toFixed(1)}% probabilidad de {state.direction === 'BULLISH' ? 'Long-Squeeze' : 'Short-Squeeze'}
                                            </span>
                                        </div>
                                        <span className="block text-white/60 font-bold text-[9px] mt-0.5 pl-5">
                                            Expected Move (15m): <span className="text-white/90">{state.expectedMove > 0 ? '+' : '±'}{Math.abs(state.expectedMove).toFixed(2)}%</span>
                                        </span>
                                    </div>
                                    <div className="absolute top-0 right-0 h-full w-1 bg-gradient-to-b from-cyan-500 to-[#00FFAA] opacity-50" />
                                </div>
                            </div>
                        </motion.div>
                    )}
                </AnimatePresence>
            </div>
        </>
    );
}
