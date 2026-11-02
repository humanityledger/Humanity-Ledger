'use client';

import React from 'react';
import { TerminalSettingsPanel } from '@/components/terminal/TerminalSettingsPanel';

export default function SettingsPage() {
    return (
        <div className="bg-transparent text-[#0A0A0A] font-mono selection:bg-black selection:text-white flex flex-col relative py-12 px-4 md:px-8 max-w-[1400px] mx-auto w-full">
            <h1 className="text-3xl font-black uppercase tracking-tighter mb-8 px-4 text-black border-b border-black/10 pb-4">
                Settings
            </h1>
            
            <div className="w-full relative shadow-sm">
                {/* 
                    Terminal Settings Panel injects the 20 real variables from the Backend 
                    via useSettingsStore & /api/user/settings (Prisma) 
                */}
                <TerminalSettingsPanel />
            </div>
        </div>
    );
}
