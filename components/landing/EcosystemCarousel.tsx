"use client";

import React, { useRef, useState } from 'react';
import { ArrowLeft, ArrowRight } from 'lucide-react';
import LottieCard from '../ui/LottieCard';
import { LOTTIE_CONTENT } from './lottie-content';
import { useLanguage } from '@/lib/i18n/LanguageContext';

export function EcosystemCarousel() {
    const scrollRef = useRef<HTMLDivElement>(null);
    const { t } = useLanguage();

    const scroll = (direction: 'left' | 'right') => {
        if (!scrollRef.current) return;
        const container = scrollRef.current;
        const scrollAmount = direction === 'left' ? -320 : 320;
        container.scrollBy({ left: scrollAmount, behavior: 'smooth' });
    };

    return (
        <div className="w-full max-w-[1440px] mx-auto px-4 py-20 relative group">
            
            <div className="flex justify-between items-end mb-8 px-2">
                <div>
                    <h3 className="text-xl font-black text-white mb-2 uppercase tracking-widest opacity-80">
                        {t('ecosystem.carousel_title')}
                    </h3>
                    <p className="text-zinc-500 text-sm max-w-md font-medium">
                        {t('ecosystem.carousel_desc')}
                    </p>
                </div>
                
                <div className="hidden md:flex gap-2">
                    <button 
                        onClick={() => scroll('left')}
                        className="p-3 rounded-full bg-white/5 border border-white/10 hover:bg-white/10 transition-colors active:scale-95"
                    >
                        <ArrowLeft size={20} className="text-white" />
                    </button>
                    <button 
                        onClick={() => scroll('right')}
                        className="p-3 rounded-full bg-white/5 border border-white/10 hover:bg-white/10 transition-colors active:scale-95"
                    >
                        <ArrowRight size={20} className="text-white" />
                    </button>
                </div>
            </div>

            <div 
                ref={scrollRef}
                className="flex gap-6 overflow-x-auto pb-8 snap-x snap-mandatory scrollbar-hide"
                style={{ scrollBehavior: 'smooth' }}
            >
                {LOTTIE_CONTENT.map((item, index) => (
                    <div 
                        key={item.id} 
                        className="min-w-[85vw] sm:min-w-[400px] snap-center shrink-0 h-[450px]"
                    >
                        <LottieCard 
                            lottieSrc={item.src}
                            title={item.title}
                            subtitle={item.subtitle}
                            lottieSize="lg"
                            className="h-full bg-zinc-900/50 border-white/10 hover:border-[#25D366]/50 transition-all hover:scale-[1.02]"
                        />
                        <div className="mt-3 flex justify-between items-center px-1">
                            <span className="text-xs font-black text-zinc-600 uppercase tracking-widest">
                                {item.category}
                            </span>
                            <span className="text-xs font-mono text-zinc-600">{(index + 1).toString().padStart(2, '0')}</span>
                        </div>
                    </div>
                ))}
            </div>

            <div className="w-full h-1 bg-white/5 rounded-full overflow-hidden mt-4">
                <div className="h-full bg-[#25D366]/50 w-1/3 rounded-full transition-all duration-300" /> 
            </div>

        </div>
    );
}


