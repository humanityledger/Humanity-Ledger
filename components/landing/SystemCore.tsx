"use client";

import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';

const MODULES = [
    {
        id: "core",
        title: "Inteligencia Neural",
        subtitle: "Motor Predictivo L1",
        description: "Millimetric mempool analysis processing thousands of transactions per second. Anticipate Elite flows before confirmation.",
        color: "from-emerald-600 to-indigo-600",
        shadow: "shadow-[#25D366]/20"
    },
    {
        id: "arbitrage",
        title: "Matriz Arbitraje",
        subtitle: "Funding Rates & Liquidez",
        description: "Explora ineficiencias matemáticas cruzando datos de Binance y Bybit en tiempo real. Ejecuta sobre volatilidades simuladas con riesgo calculado.",
        color: "from-emerald-600 to-teal-600",
        shadow: "shadow-emerald-500/20"
    },
    {
        id: "genesis",
        title: "Radar Satoshi",
        subtitle: "Ballenas Durmientes",
        description: "A sensor network strictly dedicated to dormant wallets. Evaluates the relational probability of ancient UTXOs belonging to originating entities.",
        color: "from-yellow-600 to-orange-600",
        shadow: "shadow-yellow-500/20"
    }
];

export function SystemCore() {
    const [activeId, setActiveId] = useState<string>(MODULES[0].id);

    return (
        <section className="relative w-full min-h-screen bg-[#030303] py-32 px-6 flex items-center">
            
            <div className="max-w-[2560px] mx-auto w-full grid grid-cols-1 lg:grid-cols-2 gap-16 lg:gap-24 items-start text-left">
                
                {/* Left Side: Dynamic Accordeon / Selector */}
                <div className="space-y-4">
                    <div className="mb-12">
                        <span className="text-[10px] text-white/40 font-black uppercase tracking-[0.3em]">Arquitectura del Núcleo</span>
                        <h2 className="text-4xl md:text-5xl font-black text-white mt-4 uppercase tracking-tighter">
                            Desglosando <br/>La Complejidad
                        </h2>
                    </div>

                    {MODULES.map((mod) => {
                        const isActive = activeId === mod.id;
                        return (
                            <div 
                                key={mod.id}
                                onMouseEnter={() => setActiveId(mod.id)}
                                className={`relative group cursor-pointer border-l-2 pl-6 py-4 transition-all duration-500 ${isActive ? 'border-white' : 'border-white/10 hover:border-white/40'}`}
                            >
                                <h3 className={`text-2xl font-black uppercase tracking-tight transition-colors ${isActive ? 'text-white' : 'text-white/30 group-hover:text-white/60'}`}>
                                    {mod.title}
                                </h3>
                                <p className={`text-xs font-bold uppercase tracking-widest mt-1 transition-colors ${isActive ? 'text-indigo-400' : 'text-transparent'}`}>
                                    {mod.subtitle}
                                </p>
                            </div>
                        )
                    })}
                </div>

                {/* Right Side: Interactive Glassmorphism Visualizer */}
                <div className="relative aspect-square md:aspect-[4/3] w-full max-w-lg mx-auto lg:mx-0">
                    <AnimatePresence mode="wait">
                        {MODULES.map((mod) => (
                            activeId === mod.id && (
                                <motion.div
                                    key={mod.id}
                                    initial={{ opacity: 0, scale: 0.95, filter: "blur(10px)" }}
                                    animate={{ opacity: 1, scale: 1, filter: "blur(0px)" }}
                                    exit={{ opacity: 0, scale: 1.05, filter: "blur(10px)" }}
                                    transition={{ duration: 0.5, ease: "easeOut" }}
                                    className={`absolute inset-0 rounded-3xl border border-white/10 bg-white/[0.02] backdrop-blur-2xl p-8 md:p-12 flex flex-col justify-end overflow-hidden ${mod.shadow} shadow-2xl`}
                                >
                                    {/* Animated Gradient Background Aura */}
                                    <div className={`absolute top-0 right-0 w-full h-full bg-gradient-to-br ${mod.color} opacity-20 blur-[80px] -z-10 animate-pulse`} />
                                    
                                    {/* Tech Pattern Grid */}
                                    <div className="absolute inset-0 bg-[linear-gradient(rgba(255,255,255,0.03)_1px,transparent_1px),linear-gradient(90deg,rgba(255,255,255,0.03)_1px,transparent_1px)] bg-[size:40px_40px] [mask-image:radial-gradient(ellipse_60%_60%_at_50%_50%,#000_10%,transparent_100%)] pointer-events-none" />

                                    <div className="relative z-10">
                                        <div className="w-12 h-1 mb-8 bg-white/20 rounded-full" />
                                        <h4 className="text-3xl font-black text-white uppercase tracking-tighter mb-4">
                                            {mod.title}
                                        </h4>
                                        <p className="text-sm text-white/50 leading-relaxed font-medium">
                                            {mod.description}
                                        </p>
                                    </div>
                                </motion.div>
                            )
                        ))}
                    </AnimatePresence>
                </div>
            </div>
        </section>
    );
}


