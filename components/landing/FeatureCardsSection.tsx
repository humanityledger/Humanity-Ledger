"use client";

import React from 'react';
import { motion } from 'framer-motion';
import { useLanguage } from '@/lib/i18n/LanguageContext';

const PerspectiveCard = ({ title, subtitle, color, rotate, zIndex, translate }: any) => (
    <motion.div 
        initial={{ opacity: 0, y: 50 }}
        whileInView={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.8, delay: zIndex * 0.1 }}
        style={{ 
            rotate: rotate, 
            zIndex: zIndex,
            x: translate.x,
            y: translate.y 
        }}
        className={`absolute w-64 h-80 md:w-80 md:h-96 rounded-[2.5rem] shadow-2xl border border-white/10 overflow-hidden flex flex-col justify-end p-8 backdrop-blur-md transition-all hover:scale-105 hover:z-50 duration-500 group cursor-pointer`}
    >
        <div className={`absolute inset-0 opacity-40 transition-opacity group-hover:opacity-60 ${color}`} />
        <div className="absolute inset-0 bg-gradient-to-t from-black via-black/40 to-transparent" />
        
        <div className="relative z-10">
             <h3 className="text-3xl font-black text-white uppercase leading-none mb-3 drop-shadow-2xl tracking-tighter">{title}</h3>
             <p className="text-white/60 font-bold text-sm leading-tight uppercase tracking-widest">{subtitle}</p>
        </div>
    </motion.div>
);

export function FeatureCardsSection() {
    const { t } = useLanguage();

    return (
        <div className="w-full relative py-40 flex flex-col items-center justify-center overflow-hidden min-h-[700px]">
            
            <div className="text-center mb-24 relative z-20">
                <motion.h3 
                    initial={{ opacity: 0, y: 20 }}
                    whileInView={{ opacity: 1, y: 0 }}
                    className="text-5xl md:text-8xl font-black text-white tracking-tighter uppercase mb-4 drop-shadow-[0_0_50px_rgba(255,255,255,0.1)]"
                >
                    {t('features.welcome_to')}<br/>
                    <span className="text-[#25D366]">Humanity Ledger</span>
                </motion.h3>
            </div>

            {/* Centralised Depth Group */}
            <div className="relative w-full max-w-4xl h-[450px] flex items-center justify-center perspective-[2000px]">
                
                {/* Card 1: Left Back */}
                <PerspectiveCard 
                    title={t('card1.title')}
                    subtitle={t('card1.desc')}
                    color="bg-emerald-600"
                    rotate={-15}
                    zIndex={10}
                    translate={{ x: -140, y: 20 }}
                />

                {/* Card 2: Right Back */}
                 <PerspectiveCard 
                    title={t('card2.title')}
                    subtitle={t('card2.desc')}
                    color="bg-blue-600"
                    rotate={15}
                    zIndex={10}
                    translate={{ x: 140, y: 20 }}
                />

                {/* Card 3: Center Back (Slightly higher) */}
                 <PerspectiveCard 
                    title={t('card3.title')}
                    subtitle={t('card3.desc')}
                    color="bg-purple-600"
                    rotate={-5}
                    zIndex={20}
                    translate={{ x: -50, y: -40 }}
                />

                {/* Card 4: Front Center (Main Focus) */}
                 <PerspectiveCard 
                    title={t('card4.title')}
                    subtitle={t('card4.desc')}
                    color="bg-orange-600"
                    rotate={0}
                    zIndex={30}
                    translate={{ x: 50, y: 40 }}
                />

            </div>
        </div>
    );
}



