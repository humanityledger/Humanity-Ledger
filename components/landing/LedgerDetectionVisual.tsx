"use client";

import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import Image from 'next/image';
import { Radar, Zap, Shield, Waves } from 'lucide-react';
import { useLanguage } from '@/lib/i18n/LanguageContext';

/**
 * [LEGENDARY] LedgerDetectionVisual
 * A high-impact reactive component for the landing page.
 * Uses a generated legendary image and adds overlay animations that trigger
 * when a "Ledger" is detected (Executed for landing impact).
 */
export function LedgerDetectionVisual() {
    const { t } = useLanguage();
    const [isDetecting, setIsDetecting] = useState(false);
    const [ledgerData, setLedgerData] = useState<{ amount: number; time: string } | null>(null);

    // Execute legendary detection events
    useEffect(() => {
        const interval = setInterval(() => {
            if (Math.random() > 0.8) {
                triggerDetection();
            }
        }, 8000);
        return () => clearInterval(interval);
    }, []);

    const triggerDetection = () => {
        setIsDetecting(true);
        setLedgerData({
            amount: 500 + Math.floor(Math.random() * 2000),
            time: new Date().toLocaleTimeString()
        });
        
        // Reset after 4 seconds
        setTimeout(() => setIsDetecting(false), 4000);
    };

    return (
        <section className="relative w-full py-24 px-6 overflow-hidden bg-black flex flex-col items-center">
            {/* Ambient Background Glow */}
            <div className="absolute inset-0 pointer-events-none">
                <div className={`absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[800px] h-[800px] rounded-full blur-[160px] transition-all duration-1000 ${
                    isDetecting ? 'bg-emerald-500/20' : 'bg-emerald-600/5'
                }`} />
            </div>

            <div className="relative z-10 max-w-[2560px] mx-auto w-full flex flex-col lg:grid lg:grid-cols-2 gap-12 items-start text-left">
                
                {/* 1. Content Area */}
                <div className="space-y-8 text-center lg:text-left">
                    <motion.div 
                        initial={{ opacity: 0, y: 20 }}
                        whileInView={{ opacity: 1, y: 0 }}
                        className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 font-black text-[10px] tracking-[0.2em] uppercase"
                    >
                        <Radar className={`w-3 h-3 ${isDetecting ? 'animate-ping' : ''}`} />
                        {isDetecting ? t.landing.visual.badgeDetected : t.landing.visual.badge}
                    </motion.div>

                    <h2 className="text-4xl md:text-6xl font-black text-white leading-tight">
                        {t.landing.visual.title} 
                        <span className="block italic text-transparent bg-clip-text bg-gradient-to-r from-emerald-400 to-[#25D366]">
                            {t.landing.visual.precision}
                        </span>
                    </h2>

                    <p className="text-gray-500 text-lg max-w-xl mx-auto lg:mx-0">
                        {t.landing.visual.description}
                    </p>

                    <div className="grid grid-cols-2 gap-4">
                        <Feature icon={Zap} label={t.landing.visual.latency} val="<500ms" />
                        <Feature icon={Shield} label={t.landing.visual.noiseFilter} val="Advanced AI" />
                    </div>
                </div>

                {/* 2. Visual Container */}
                <div className="relative w-full aspect-[4/3] rounded-[2.5rem] overflow-hidden border border-white/10 shadow-[0_40px_100px_rgba(0,0,0,1)] group">
                    {/* The Legendary Visual */}
                    <div className={`relative w-full h-full transition-all duration-1000 ease-[cubic-bezier(0.23,1,0.32,1)] ${isDetecting ? 'scale-110 saturate-[2.5] brightness-125' : 'scale-100 grayscale-[0.3]'}`}>
                        <Image 
                            src="/models/ballenatracker.png" 
                            alt="Ledger Monitoring Visualization" 
                            fill 
                            sizes="(max-width: 768px) 100vw, 50vw"
                            className={`object-cover transition-all duration-500 ${isDetecting ? 'blur-[2px]' : 'blur-0'}`}
                        />
                        
                        {isDetecting && (
                            <div className="absolute inset-0 opacity-50 mix-blend-screen animate-pulse pointer-events-none">
                                <Image src="/models/ballenatracker.png" alt="" fill sizes="(max-width: 768px) 100vw, 50vw" className="object-cover translate-x-1 saturate-200 hue-rotate-90 opacity-40" />
                                <Image src="/models/ballenatracker.png" alt="" fill sizes="(max-width: 768px) 100vw, 50vw" className="object-cover -translate-x-1 saturate-200 -hue-rotate-90 opacity-40" />
                            </div>
                        )}
                        
                        {/* Overlay Gradient */}
                        <div className="absolute inset-0 bg-gradient-to-t from-black via-transparent to-black/40" />
                    </div>

                    {/* Legendary Sonar Pulse Animation (Overlay) */}
                    <AnimatePresence>
                        {isDetecting && (
                            <motion.div 
                                initial={{ opacity: 0 }}
                                animate={{ opacity: 1 }}
                                exit={{ opacity: 0 }}
                                className="absolute inset-0 pointer-events-none z-20"
                            >
                                <div className="absolute inset-0 bg-emerald-500/10 mix-blend-screen animate-pulse" />
                                
                                {/* Scanning Line */}
                                <motion.div 
                                    initial={{ top: '-10%' }}
                                    animate={{ top: '110%' }}
                                    transition={{ duration: 2, repeat: Infinity, ease: "linear" }}
                                    className="absolute left-0 right-0 h-px bg-gradient-to-r from-transparent via-emerald-400/50 to-transparent shadow-[0_0_20px_2px_rgba(16,185,129,0.3)]"
                                />

                                {/* Humanity Ledger Data Overlay */}
                                <motion.div 
                                    initial={{ opacity: 0, scale: 0.9, y: 20 }}
                                    animate={{ opacity: 1, scale: 1, y: 0 }}
                                    className="absolute bottom-12 left-12 right-12 p-6 bg-black/60 backdrop-blur-xl rounded-3xl border border-emerald-500/30 flex items-center justify-between"
                                >
                                    <div>
                                        <p className="text-[10px] font-black text-emerald-400 uppercase tracking-widest mb-1">{t.landing.visual.impactAlert}</p>
                                        <h3 className="text-white text-2xl font-black">+{ledgerData?.amount} BTC</h3>
                                    </div>
                                    <div className="text-right">
                                        <p className="text-[10px] font-bold text-gray-500 uppercase">{ledgerData?.time}</p>
                                        <div className="flex gap-1 mt-1 justify-end">
                                            {[1,2,3].map(i => <div key={i} className="w-1 h-3 bg-emerald-500 rounded-full" />)}
                                        </div>
                                    </div>
                                </motion.div>
                            </motion.div>
                        )}
                    </AnimatePresence>

                    {/* Passive UI Elements */}
                    <div className="absolute top-8 left-8 flex items-center gap-3">
                        <div className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse shadow-[0_0_8px_rgba(16,185,129,0.8)]" />
                        <span className="text-[9px] font-black text-white/40 uppercase tracking-[0.3em]">Active Feed / Nodes_Satoshi</span>
                    </div>

                    <div className="absolute top-8 right-8">
                        <Waves className="w-5 h-5 text-white/20 animate-bounce" />
                    </div>
                </div>

            </div>
        </section>
    );
}

function Feature({ icon: Icon, label, val }: any) {
    return (
        <div className="bg-white/[0.03] border border-white/5 p-4 rounded-2xl flex flex-col items-center gap-1 group hover:border-emerald-500/20 transition-colors">
            <Icon className="w-5 h-5 text-gray-400 group-hover:text-emerald-400 transition-colors" />
            <span className="text-[10px] text-gray-600 font-bold uppercase tracking-wider">{label}</span>
            <span className="text-white font-black">{val}</span>
        </div>
    );
}



