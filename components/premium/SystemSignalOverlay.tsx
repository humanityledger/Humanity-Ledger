"use client";

import { motion } from 'framer-motion';
import { Target, Copy, CheckCircle, Clock } from 'lucide-react';
import { useState, useEffect } from 'react';

interface SystemSignalOverlayProps {
    symbol: string;
    direction: string;
    reversalProb: number;
    expectedMove: number;
    vigorPercent: number;
    gravityScore: number;
    icebergDefense?: string;
    onClose: () => void;
}

export function SystemSignalOverlay({ 
    symbol, direction, reversalProb, expectedMove, 
    vigorPercent, gravityScore, icebergDefense, onClose 
}: SystemSignalOverlayProps) {
    const [copied, setCopied] = useState(false);
    const [timeLeft, setTimeLeft] = useState(15 * 60);

    useEffect(() => {
        const timer = setInterval(() => {
            setTimeLeft((prev) => (prev > 0 ? prev - 1 : 0));
        }, 1000);
        return () => clearInterval(timer);
    }, []);

    const minutes = Math.floor(timeLeft / 60);
    const seconds = timeLeft % 60;
    const timeString = `${minutes}m ${seconds.toString().padStart(2, '0')}s`;

    const copyToClipboard = () => {
        const text = `Premium alert
Asset: $${symbol}
Direction: ${direction === 'BULLISH' ? 'Long bias' : 'Short bias'}
Reversal prob: ${reversalProb.toFixed(1)}%
Expected move (15m): ${expectedMove > 0 ? '+' : ''}${expectedMove.toFixed(2)}%
Vigor: ${vigorPercent.toFixed(0)}% | Score: ${gravityScore.toFixed(1)}
Defense: ${icebergDefense || 'None'}
—
HumanIDFi analytics`;

        navigator.clipboard.writeText(text);
        setCopied(true);
        setTimeout(() => setCopied(false), 2000);
    };

    return (
        <motion.div 
            initial={{ opacity: 0, backdropFilter: 'blur(0px)' }}
            animate={{ opacity: 1, backdropFilter: 'blur(24px)' }}
            exit={{ opacity: 0, backdropFilter: 'blur(0px)' }}
            className="fixed inset-0 z-50 flex items-center justify-center bg-white/10"
            onClick={onClose}
        >
            <motion.div 
                initial={{ scale: 0.9, y: 20 }}
                animate={{ scale: 1, y: 0 }}
                exit={{ scale: 0.9, y: -20 }}
                onClick={(e) => e.stopPropagation()}
                className="bg-[#FFFFFF]/90 border border-[#050505] p-8 max-w-sm w-full rounded-2xl shadow-2xl relative overflow-hidden"
            >
                {/* Top accent */}
                <div className="absolute top-0 left-0 w-full h-1 bg-white" />

                <div className="flex items-center gap-3 mb-6">
                    <div className="w-10 h-10 rounded-full bg-white flex items-center justify-center">
                        <Target className="text-white" size={20} />
                    </div>
                    <div>
                        <h2 className="text-xl font-black text-[#050505] tracking-tighter leading-none">Premium signal</h2>
                        <span className="text-[10px] font-bold text-[#050505]/50 tracking-[0.2em] uppercase">Confluence readout</span>
                    </div>
                </div>

                <div className="space-y-4 mb-8">
                    <div className="flex justify-between border-b border-[#050505]/10 pb-2">
                        <span className="text-xs font-bold text-[#050505]/60">Target Asset</span>
                        <span className="text-sm font-black text-[#050505]">${symbol}</span>
                    </div>
                    <div className="flex justify-between border-b border-[#050505]/10 pb-2">
                        <span className="text-xs font-bold text-[#050505]/60">Reversal Prob</span>
                        <span className="text-sm font-black text-[#050505] border border-black/15 px-2 py-0.5 bg-black/5 rounded">
                            {reversalProb.toFixed(1)}%
                        </span>
                    </div>
                    <div className="flex justify-between border-b border-[#050505]/10 pb-2">
                        <span className="text-xs font-bold text-[#050505]/60">Expected Move</span>
                        <span className={`text-sm font-black ${expectedMove > 0 ? 'text-[#050505]' : 'text-black/50'}`}>
                            {expectedMove > 0 ? '+' : ''}{expectedMove.toFixed(2)}%
                        </span>
                    </div>
                </div>

                <div className="flex items-center justify-center gap-2 mb-6 text-[#050505]/60">
                    <Clock size={12} className={timeLeft < 60 ? "text-[#050505] animate-pulse" : ""} />
                    <span className={`text-[10px] uppercase font-bold tracking-widest ${timeLeft < 60 ? "text-[#050505]" : ""}`}>
                        Signal expires in {timeString}
                    </span>
                </div>

                <button 
                    onClick={copyToClipboard}
                    className="w-full bg-white text-white py-3 rounded-lg font-bold text-xs uppercase tracking-widest flex items-center justify-center gap-2 hover:bg-[#111] transition-colors"
                >
                    {copied ? <CheckCircle size={14} className="text-white" /> : <Copy size={14} />}
                    {copied ? 'Copied to Clipboard' : 'Copy Alpha Signal'}
                </button>
            </motion.div>
        </motion.div>
    );
}
