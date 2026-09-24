"use client";

import React, { useState } from 'react';
import { Camera, MessageCircle, QrCode } from 'lucide-react';
import { QrScanner } from '@/components/terminal/QrScanner';
import { LedgerChat } from '@/components/terminal/LedgerChatV2';

export function ScannerZone() {
    const [mode, setMode] = useState<'chat' | 'project'>('chat');

    return (
        <div className="flex flex-col w-full h-full mx-auto px-2 md:px-0 relative">
            {/* Toggle Header */}
            <div className="flex bg-black/5 p-1 rounded-xl w-full max-w-[320px] mx-auto mb-5 shrink-0 z-10 border border-black/5">
                <button
                    onClick={() => setMode('chat')}
                    className={`flex-1 py-2 text-[10px] font-black uppercase tracking-widest rounded-lg flex items-center justify-center gap-2 transition-all ${
                        mode === 'chat' 
                            ? 'bg-white text-[#9945FF] shadow-sm shadow-black/5' 
                            : 'text-black/50 hover:text-black'
                    }`}
                >
                    <MessageCircle size={14} /> Ledger Chat Encrypted
                </button>
                <button
                    onClick={() => setMode('project')}
                    className={`flex-1 py-2 text-[10px] font-black uppercase tracking-widest rounded-lg flex items-center justify-center gap-2 transition-all ${
                        mode === 'project' 
                            ? 'bg-white text-[#050505] shadow-sm shadow-black/5' 
                            : 'text-black/50 hover:text-black'
                    }`}
                >
                    <QrCode size={14} /> Show PC QR
                </button>
            </div>

            {/* Content Area */}
            <div className="flex-1 min-h-0 w-full flex justify-center pb-safe">
                {mode === 'chat' ? (
                    <div className="w-full h-full flex flex-col relative">
                        <LedgerChat />
                    </div>
                ) : (
                    <div className="w-full max-w-sm pt-8 flex flex-col items-center">
                        <div className="mb-6 text-center">
                            <h3 className="text-sm font-black uppercase tracking-widest text-[#050505]">Desktop Session QR</h3>
                            <p className="text-[11px] text-black/50 mt-1 font-mono">Scan this QR with your mobile device from the Ledger Chat Encrypted tab to link your secure session.</p>
                        </div>
                        <QrScanner mode="project" />
                    </div>
                )}
            </div>
        </div>
    );
}
