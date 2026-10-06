"use client";

import React from 'react';
import LottieCard from '../ui/LottieCard';
import { useLanguage } from '@/lib/i18n/LanguageContext';
import { motion } from 'framer-motion';

export function SecurityGrowthSection() {
    const { t } = useLanguage();

    return (
        <div className="w-full max-w-[2560px] mx-auto px-4 pb-32 text-left">
            
            {/* Center Text Interlude with Background */}
            <div className="py-32 flex flex-col items-center justify-center text-center relative rounded-[3rem] overflow-hidden my-24 shadow-2xl">
                <div className="absolute inset-0 z-0">
                    <img 
                        src="/models/update/Aztec Image_01.jpg" 
                        alt="Security Background"
                        className="w-full h-full object-cover rounded-3xl"
                    />
                    <div className="absolute inset-0 bg-gradient-to-b from-[#F5F5DC] via-transparent to-[#F5F5DC]" />
                </div>

                <motion.div 
                    initial={{ opacity: 0, scale: 0.9 }}
                    whileInView={{ opacity: 1, scale: 1 }}
                    className="relative z-10"
                >
                    <h2 className="text-6xl md:text-9xl font-black text-transparent bg-clip-text bg-gradient-to-b from-black/40 to-transparent tracking-tighter opacity-30 leading-none">
                        {t('sec.max')}
                    </h2>
                    <h2 className="text-6xl md:text-9xl font-black text-indigo-950 tracking-[0.2em] mt-[-20px] md:mt-[-50px] drop-shadow-2xl uppercase leading-none">
                        {t('sec.title')}
                    </h2>
                </motion.div>
            </div>

            {/* 4 Cards: Security */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-40">
                <LottieCard
                    lottieSrc="https://lottie.host/57803657-6105-4752-921c-308101452631/ShieldSecure.lottie"
                    title={t('sec.card1_title')}
                    subtitle={t('sec.card1_desc')}
                    lottieSize="md"
                    className="bg-white/80 backdrop-blur-xl border-white/40 hover:scale-[1.02] transition-transform duration-500 rounded-[2.5rem]"
                />
                <LottieCard
                    lottieSrc="https://lottie.host/1a2b3c4d-5e6f-7g8h-9i0j-1k2l3m4n5o6p/FastLightning.lottie"
                    title={t('sec.card2_title')}
                    subtitle={t('sec.card2_desc')}
                    lottieSize="md"
                    className="bg-white/80 backdrop-blur-xl border-white/40 hover:scale-[1.02] transition-transform duration-500 rounded-[2.5rem]"
                />
                <LottieCard
                    lottieSrc="https://lottie.host/0f8c4e3d-9b7a-4f6c-8d2e-1a3b4c5d6e7f/9KJh8G7F6D.lottie"
                    title={t('sec.card3_title')}
                    subtitle={t('sec.card3_desc')}
                    lottieSize="md"
                    className="bg-white/80 backdrop-blur-xl border-white/40 hover:scale-[1.02] transition-transform duration-500 rounded-[2.5rem]"
                />
                <LottieCard
                    lottieSrc="https://lottie.host/0a1b2c3d-4e5f-6g7h-8i9j-0k1l2m3n4o5p/CoinSwap3D.lottie"
                    title={t('sec.card4_title')}
                    subtitle={t('sec.card4_desc')}
                    lottieSize="md"
                    className="bg-white/80 backdrop-blur-xl border-white/40 hover:scale-[1.02] transition-transform duration-500 rounded-[2.5rem]"
                />
            </div>

            {/* Growth Section */}
            <motion.h3 
                initial={{ opacity: 0, x: -20 }}
                whileInView={{ opacity: 1, x: 0 }}
                className="text-4xl font-black text-white mb-12 pl-6 border-l-8 border-[#25D366] uppercase tracking-tighter"
            >
                {t('growth.title')}
            </motion.h3>
            
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
                <LottieCard
                    lottieSrc="https://lottie.host/8e4d2f1c-9bfa-4b77-8db5-3c5f1b2e6a9d/RainCoins.lottie"
                    title={t('growth.card1_title')}
                    subtitle={t('growth.card1_desc')}
                    lottieSize="md"
                    className="bg-blue-600/10 border-[#25D366]/20 rounded-[2.5rem] hover:bg-blue-600/20 transition-all duration-500"
                />
                <LottieCard
                    lottieSrc="https://lottie.host/1a2b3c4d-5e6f-7g8h-9i0j-1k2l3m4n5o6p/FastLightning.lottie"
                    title={t('growth.card2_title')}
                    subtitle={t('growth.card2_desc')}
                    lottieSize="md"
                    className="bg-blue-600/10 border-[#25D366]/20 rounded-[2.5rem] hover:bg-blue-600/20 transition-all duration-500"
                />
                <LottieCard
                    lottieSrc="https://lottie.host/0a1b2c3d-4e5f-6g7h-8i9j-0k1l2m3n4o5p/CoinSwap3D.lottie"
                    title={t('growth.card3_title')}
                    subtitle={t('growth.card3_desc')}
                    lottieSize="md"
                    className="bg-blue-600/10 border-[#25D366]/20 rounded-[2.5rem] hover:bg-blue-600/20 transition-all duration-500"
                />
                <LottieCard
                    lottieSrc="https://lottie.host/57803657-6105-4752-921c-308101452631/ShieldSecure.lottie"
                    title={t('growth.card4_title')}
                    subtitle={t('growth.card4_desc')}
                    lottieSize="md"
                    className="bg-blue-600/10 border-[#25D366]/20 rounded-[2.5rem] hover:bg-blue-600/20 transition-all duration-500"
                />
            </div>

        </div>
    );
}


