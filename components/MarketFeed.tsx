'use client';

import React from 'react';
import { motion } from 'framer-motion';
import { GlassCard, GlassBadge, ProgressBar } from './ui/GlassComponents';
import { RiskBadge } from './crystalline/RiskBadge';
import { TrendingUp, Clock, Users, ArrowRight, AlertCircle, BarChart3 } from 'lucide-react';
import { useMarkets } from '../hooks/useMarkets';
import { useRouter } from 'next/navigation';

import { safeToFixed, safeToLocaleString } from '@/lib/utils/number-format';
// Animaciones optimizadas
const container = {
    hidden: { opacity: 0 },
    show: { opacity: 1, transition: { staggerChildren: 0.1 } }
};

const item = {
    hidden: { opacity: 0, y: 20 },
    show: { opacity: 1, y: 0 }
};

export const MarketFeed = () => {
    const { markets, isLoading } = useMarkets();
    const router = useRouter();

    return (
        <div className="w-full max-w-[1440px] mx-auto mt-20 pb-20 px-5">

            {/* Header Sección */}
            <div className="flex items-center justify-between mb-8 px-4">
                <h3 className="text-2xl font-bold text-white flex items-center gap-2">
                    <TrendingUp className="text-cyan-400" />
                    Mercados en Base Sepolia
                </h3>
                <span className="px-3 py-1 rounded-full bg-[#25D366]/10 border border-[#25D366]/20 text-blue-200 text-xs font-mono">
                    {isLoading ? "Sincronizando..." : `${markets.length} Activos`}
                </span>
            </div>

            {/* Lógica de Renderizado */}
            {isLoading ? (
                // Status: Loading (Skeleton UI)
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 px-4">
                    {[1, 2, 3].map((i) => (
                        <div key={i} className="h-[280px] rounded-3xl bg-white/5 animate-pulse border border-white/5" />
                    ))}
                </div>
            ) : markets.length === 0 ? (
                // Estado: Vacío
                <GlassCard className="text-center py-20 mx-4 border-dashed border-white/20">
                    <div className="w-16 h-16 bg-white/5 rounded-full flex items-center justify-center mx-auto mb-4">
                        <AlertCircle className="text-white/40" size={32} />
                    </div>
                    <h3 className="text-xl text-white font-bold">No active markets</h3>
                    <p className="text-blue-200/50 mt-2 max-w-md mx-auto">
                        The blockchain is quiet. Be the first to create a prediction above.
                    </p>
                </GlassCard>
            ) : (
                // Estado: Data Real
                <motion.div
                    variants={container}
                    initial="hidden"
                    animate="show"
                    className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 px-4"
                >
                    {markets.map((market) => (
                        <motion.div key={market.address} variants={item}>
                            <GlassCard
                                className="h-full p-6 hover:bg-white/15 transition-all duration-300 hover:-translate-y-1 cursor-pointer group flex flex-col relative overflow-hidden"
                                onClick={() => router.push(`/wallet?market=${market.address}`)}
                            >

                                {/* Decoración de fondo hover */}
                                <div className="absolute top-0 right-0 w-32 h-32 bg-cyan-500/10 blur-[50px] rounded-full opacity-0 group-hover:opacity-100 transition-opacity" />

                                {/* Badges Superiores */}
                                <div className="flex justify-between items-start mb-4 relative z-10">
                                    <div className="flex items-center gap-2">
                                        <RiskBadge level={market.riskLevel || 'LOW'} />
                                        <div className="flex items-center gap-1 text-[10px] font-bold text-green-300 bg-green-500/10 border border-green-500/20 px-2 py-1 rounded-full uppercase tracking-wide">
                                            En Curso
                                        </div>
                                    </div>
                                </div>

                                {/* Título del Mercado */}
                                <h4 className="text-xl font-bold text-white leading-tight mb-4 group-hover:text-cyan-300 transition-colors line-clamp-3 min-h-[4.5rem]">
                                    {market.title}
                                </h4>

                                {/* Sección de Probabilidades (El núcleo del valor) */}
                                <div className="space-y-3 mb-6 mt-auto relative z-10">
                                    <div className="flex justify-between text-sm font-medium">
                                        <span className="text-cyan-200">SÍ {market.probability}%</span>
                                        <span className="text-purple-200">NO {100 - market.probability}%</span>
                                    </div>
                                    {/* Barra visual de probabilidad */}
                                    <ProgressBar value={market.probability} color="cyan" />
                                </div>

                                {/* Footer de Métricas */}
                                <div className="flex items-center justify-between border-t border-white/10 pt-4 mt-2">
                                    <div className="flex items-center gap-2 text-xs text-blue-200/50 font-mono">
                                        <BarChart3 size={14} />
                                        <span>Vol: {safeToFixed(market.volume, 0)} TKN</span>
                                    </div>

                                    <div className="flex items-center gap-1 text-xs font-bold text-cyan-400 opacity-80 group-hover:opacity-100 transition-opacity">
                                        OPERAR
                                        <ArrowRight size={14} className="-translate-x-1 group-hover:translate-x-0 transition-transform" />
                                    </div>
                                </div>

                            </GlassCard>
                        </motion.div>
                    ))}
                </motion.div>
            )}
        </div>
    );
};


