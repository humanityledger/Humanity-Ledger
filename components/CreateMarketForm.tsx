import React from 'react';
import { ProposeMarket } from './governance/ProposeMarket';
import { GlassCard } from './ui/GlassComponents';

export const CreateMarketForm = () => {
    return (
        <div className="w-full max-w-2xl px-4">
            <div className="text-center mb-8">
                <h1 className="text-4xl md:text-6xl font-black text-transparent bg-clip-text bg-gradient-to-r from-white via-cyan-200 to-blue-400 tracking-tighter mb-4">
                    HUMAN MARKETS
                </h1>
                <p className="text-blue-200/60 text-lg font-light tracking-wide">
                    Analytics driven by system individuals, secured by World ID.
                </p>
            </div>

            <GlassCard className="relative z-20 backdrop-blur-2xl bg-black/40 border-cyan-500/20 shadow-[0_0_50px_rgba(34,211,238,0.1)]">
                <div className="propose-market-wrapper h-[500px]">
                    {/* reusing the existing logic directly */}
                    <ProposeMarket />
                </div>
            </GlassCard>
        </div>
    );
};


