'use client';

import React, { useEffect, useState, useRef } from 'react';
import { motion, AnimatePresence, useMotionValue, useSpring, useTransform } from 'framer-motion';
import { Shield, Zap, Sparkles, CheckCircle2, Lock } from 'lucide-react';
import { useAccount } from 'wagmi';
import { useLanguage } from '@/lib/i18n/LanguageContext';
import { useRouter } from 'next/navigation';

import { useSearchParams } from 'next/navigation';

interface LandingHeroProps {
    onStart?: () => void;
}

export function LandingHero({ onStart }: LandingHeroProps) {
    const { t } = useLanguage();
    const { isConnected, address, status } = useAccount();
    const isLoaded = status !== 'connecting' && status !== 'reconnecting';
    const router = useRouter();
    const searchParams = useSearchParams();
    const [loginSuccess, setLoginSuccess] = useState(false);
    const [isDisconnectGuarded, setIsDisconnectGuarded] = useState(false);

    const isLoginRedirect = searchParams?.get('login') === 'true';

    // [ABSOLUTE DISCONNECT FIREWALL] Check the guard on mount synchronously.
    // wagmi auto-reconnects on page reload even after logout, which would cause
    // isConnected to be true and show the "Access Granted" panel to a user who
    // just clicked Disconnect. We must read both storages: sessionStorage for the
    // current tab and localStorage for cross-reload persistence.
    useEffect(() => {
        try {
            const guarded =
                sessionStorage.getItem('__disconnected__') === '1' ||
                localStorage.getItem('__disconnected__') === '1';
            setIsDisconnectGuarded(guarded);
        } catch { /* storage blocked — treat as unguarded */ }
    }, []);

    // Treat wagmi's "connected" state as false if the disconnect guard is active.
    const isSignedIn = isConnected && !isDisconnectGuarded;

    useEffect(() => {
        if (isSignedIn && isLoaded && !loginSuccess) {
            setLoginSuccess(true);
        }
    }, [isSignedIn, isLoaded, loginSuccess]);

    return (
        <div className="relative w-full h-full flex items-center justify-center overflow-hidden bg-black">
            {/* 1. PERMANENT BACKGROUND */}
            <div className="absolute inset-0 z-0 overflow-hidden">
                <div className="absolute inset-0 opacity-40 bg-[radial-gradient(at_0%_0%,rgba(37,99,235,0.2)_0px,transparent_50%),radial-gradient(at_100%_0%,rgba(139,92,246,0.1)_0px,transparent_50%),radial-gradient(at_50%_100%,rgba(37,99,235,0.15)_0px,transparent_50%)]" />
                <div className="absolute inset-0 bg-[radial-gradient(circle_at_center,_var(--tw-gradient-stops))] from-emerald-900/20 via-black to-black" />
                <div className="absolute inset-0 bg-[url('/grid.svg')] opacity-20" style={{ backgroundSize: '30px 30px' }} />
                <div className="absolute inset-0 bg-gradient-to-b from-black/80 via-transparent to-black/90 pointer-events-none" />
                <div className="absolute inset-0 bg-[radial-gradient(circle_at_center,rgba(0,0,0,0.1)_0%,black_100%)] opacity-90 pointer-events-none" />
            </div>

            <div className="relative z-10 w-full max-w-[2560px] mx-auto px-6 grid grid-cols-1 lg:grid-cols-2 gap-12 lg:gap-20 items-center min-h-screen pt-20 pb-10 text-left">
                
                {/* LEFT COLUMN - MARKETING CONTENT */}
                <motion.div
                    initial={{ opacity: 0, x: -40 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ duration: 1, ease: "easeOut" }}
                    className="flex flex-col items-center lg:items-start text-center lg:text-left h-full justify-center"
                >
                    <div className="inline-flex items-center gap-2 bg-white/5 border border-white/10 px-4 py-2 rounded-full mb-8 backdrop-blur-md">
                        <Sparkles className="w-4 h-4 text-purple-400" />
                        <span className="text-sm font-medium text-white/80">{t.landing.hero.badge}</span>
                    </div>

                    <h1 className="font-black tracking-tighter leading-[0.9] text-white mb-6" style={{
                        fontSize: 'clamp(3.5rem, 8vw, 7rem)'
                    }}>
                        {t.landing.hero.title} <span className="text-purple-500 drop-shadow-[0_0_30px_rgba(168,85,247,0.4)]">DeFi</span>
                    </h1>

                    <p className="text-white/80 max-w-xl mb-6 leading-relaxed font-light text-xl md:text-2xl">
                        {t.landing.hero.subtitle}
                    </p>

                    <p className="text-white/60 max-w-xl mb-12 font-light text-lg">
                        <span className="text-green-400 font-medium tracking-wide">{t.landing.hero.keys}</span>
                        <br className="hidden md:block"/> {t.landing.hero.identity}
                    </p>

                    <div className="grid grid-cols-3 gap-8 w-full max-w-lg mb-12">
                        <div>
                            <div className="text-2xl md:text-3xl font-black text-white mb-1">100K+</div>
                            <div className="text-[10px] uppercase tracking-widest text-white/40 font-bold">{t.landing.hero.stats.identities}</div>
                        </div>
                        <div>
                            <div className="text-2xl md:text-3xl font-black text-white mb-1">$50M+</div>
                            <div className="text-[10px] uppercase tracking-widest text-white/40 font-bold">{t.landing.hero.stats.secured}</div>
                        </div>
                        <div>
                            <div className="text-2xl md:text-3xl font-black text-white mb-1">99.9%</div>
                            <div className="text-[10px] uppercase tracking-widest text-white/40 font-bold">{t.landing.hero.stats.decentralised}</div>
                        </div>
                    </div>
                </motion.div>

                {/* RIGHT COLUMN - CALL TO ACTION */}
                <motion.div
                    initial={{ opacity: 0, x: 40 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ duration: 1, ease: "easeOut", delay: 0.2 }}
                    className="relative flex justify-center lg:justify-end h-full items-center"
                >
                    <AnimatePresence mode="wait">
                        {!isSignedIn ? (
                            <motion.div
                                key="login-box"
                                exit={{ opacity: 0, scale: 0.9, filter: "blur(10px)" }}
                                transition={{ duration: 0.5 }}
                                className="w-full flex flex-col items-center lg:items-end"
                            >
                                <div className={`w-full max-w-[420px] mx-auto transition-all duration-500 ${
                                    isLoginRedirect ? 'scale-105' : ''
                                }`}>
                                    <div className="bg-white/5 backdrop-blur-xl border border-white/10 rounded-[2.5rem] p-10 shadow-2xl shadow-black/50 relative overflow-hidden flex flex-col items-center text-center">
                                        
                                        <div className="w-16 h-16 rounded-full bg-[#25D366]/10 flex flex-col items-center justify-center mb-6 border border-[#25D366]/20">
                                            <Lock className="w-6 h-6 text-emerald-400" />
                                        </div>
                                        
                                        <h3 className="text-2xl font-black text-white mb-2 tracking-tight uppercase">Access Terminal</h3>
                                        <p className="text-white/60 text-sm mb-8 font-medium">Authenticate securely to enter the Humanity Ledger Analytics network.</p>

                                        <button 
                                            onClick={() => router.push('/login')}
                                            className="w-full bg-white text-black hover:bg-gray-200 h-14 rounded-2xl font-black uppercase tracking-widest text-xs transition-colors group flex items-center justify-center gap-2"
                                        >
                                            Enter Portal
                                        </button>
                                    </div>
                                </div>
                            </motion.div>
                        ) : (
                            <motion.div
                                key="success-box"
                                initial={{ opacity: 0, scale: 0.9, y: 20 }}
                                animate={{ opacity: 1, scale: 1, y: 0 }}
                                className="bg-[#161A1E] border border-white/20 p-12 rounded-[2.5rem] flex flex-col items-center gap-6 text-center w-full max-w-[420px] shadow-[0_40px_120px_rgba(168,85,247,0.15)] mx-auto lg:mx-0 lg:ml-auto"
                            >
                                <div className="w-20 h-20 rounded-full bg-green-500/20 border border-green-500/30 flex items-center justify-center">
                                    <CheckCircle2 className="w-10 h-10 text-green-400" />
                                </div>
                                <div className="mb-4">
                                    <h3 className="text-2xl font-black text-white mb-2 uppercase tracking-tight">{t.landing.hero.accessGranted}</h3>
                                    <p className="text-white/40 font-medium">Welcome back, {address ? `${address.slice(0,6)}...${address.slice(-4)}` : 'System Ledger'}.<br/>All systems online.</p>
                                </div>
                                <div className="w-full flex justify-center pb-2">
                                     <button 
                                        onClick={() => router.push('/portfolio')}
                                        className="w-full bg-emerald-600 hover:bg-[#25D366] text-white h-14 rounded-2xl font-black uppercase tracking-widest text-xs transition-colors"
                                    >
                                        Launch Application
                                    </button>
                                </div>
                            </motion.div>
                        )}
                    </AnimatePresence>
                </motion.div>
            </div>
        </div>
    );
}



