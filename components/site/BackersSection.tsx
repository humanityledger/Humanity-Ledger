"use client";

import React from 'react';
import { motion } from 'framer-motion';
import { useLanguage } from '@/lib/i18n/LanguageContext';

const backers = [
    { name: 'Coinglass', color: 'text-blue-400', glow: 'shadow-[#25D366]/20' },
    { name: 'CoinGecko', color: 'text-emerald-400', glow: 'shadow-emerald-500/20' },
    { name: 'Kernel Ventures', color: 'text-purple-400', glow: 'shadow-purple-500/20' },
    { name: 'Good News Ventures', color: 'text-orange-400', glow: 'shadow-orange-500/20' },
    { name: 'A_Capital', color: 'text-red-400', glow: 'shadow-red-500/20' },
    { name: 'Hivemind', color: 'text-zinc-300', glow: 'shadow-white/10' },
    { name: 'Fenbushi Capital', color: 'text-amber-400', glow: 'shadow-amber-500/20' },
    { name: 'Aztek Networks', color: 'text-cyan-400', glow: 'shadow-cyan-500/20' },
];

// Duplicate the array to create a seamless loop
const scrollItems = [...backers, ...backers];

export function BackersSection() {
    const { t } = useLanguage();
    
    return (
        <section className="relative py-24 overflow-hidden bg-black border-y border-white/[0.02]">
            {/* Background Atmosphere */}
            <div className="absolute inset-0 pointer-events-none overflow-hidden">
                <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[1000px] h-[300px] bg-blue-600/5 blur-[120px] rounded-full" />
            </div>

            <div className="relative z-10 max-w-[2560px] mx-auto px-6 text-left">
                <motion.div
                    initial={{ opacity: 0, y: 10 }}
                    whileInView={{ opacity: 1, y: 0 }}
                    viewport={{ once: true }}
                    className="flex flex-col items-center mb-16"
                >
                    <span className="text-[10px] font-black uppercase tracking-[0.4em] text-[#25D366] mb-3">{t.backers.badge}</span>
                    <h2 className="text-3xl font-black text-white tracking-widest uppercase">{t.backers.title}</h2>
                </motion.div>

                {/* The Marquee */}
                <div className="relative w-full">
                    {/* Seamless Edge Masks (Fading into the background) */}
                    <div className="absolute left-0 top-0 bottom-0 w-40 z-20 bg-gradient-to-r from-black via-black/80 to-transparent pointer-events-none" />
                    <div className="absolute right-0 top-0 bottom-0 w-40 z-20 bg-gradient-to-l from-black via-black/80 to-transparent pointer-events-none" />

                    <div className="flex overflow-hidden">
                        <motion.div 
                            className="flex gap-8 items-center py-6"
                            animate={{ 
                                x: [0, -1920] // Sufficient distance to loopbackers
                            }}
                            transition={{ 
                                x: {
                                    repeat: Infinity,
                                    repeatType: "loop",
                                    duration: 30, // Slow, premium speed
                                    ease: "linear",
                                }
                            }}
                        >
                            {scrollItems.map((backer, idx) => (
                                <div 
                                    key={`${backer.name}-${idx}`}
                                    className="flex-shrink-0 flex items-center gap-4 px-8 py-3 rounded-2xl bg-white/[0.03] border border-white/[0.05] backdrop-blur-sm group hover:border-white/20 transition-all duration-500"
                                >
                                    {/* Iconic Typography "Logos" */}
                                    <div className={`w-8 h-8 rounded-lg bg-black flex items-center justify-center font-black text-xs ${backer.color} border border-white/10 shadow-lg ${backer.glow}`}>
                                        {backer.name[0]}
                                    </div>
                                    <span className="text-sm font-black text-white/50 group-hover:text-white transition-colors tracking-tight">
                                        {backer.name}
                                    </span>
                                </div>
                            ))}
                        </motion.div>
                    </div>
                </div>
            </div>

            {/* Bottom Glow Sweep */}
            <div className="absolute bottom-0 left-0 right-0 h-px bg-gradient-to-r from-transparent via-[#25D366]/20 to-transparent" />
        </section>
    );
}


