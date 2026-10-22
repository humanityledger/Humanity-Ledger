"use client";
import React from 'react';
import { Camera, Mic } from 'lucide-react';

interface MediaPermissionsPrePromptProps {
    pendingCallType: 'audio' | 'video' | 'answer' | null;
    setPendingCallType: (t: 'audio' | 'video' | 'answer' | null) => void;
    onGrant: (type: 'audio' | 'video' | 'answer') => void;
}

export function MediaPermissionsPrePrompt({ pendingCallType, setPendingCallType, onGrant }: MediaPermissionsPrePromptProps) {
    if (!pendingCallType) return null;
    return (
        <div className="fixed inset-0 bg-black/40 backdrop-blur-sm flex flex-col items-center justify-center p-6 text-black" style={{ zIndex: 999999 }}>
            <div className="max-w-md w-full bg-white p-8 border border-black shadow-2xl flex flex-col items-center">
                <div className="flex gap-4 mb-6 text-black justify-center">
                    <Camera size={32} />
                    <Mic size={32} />
                </div>
                <h2 className="text-2xl font-black text-center mb-4 uppercase tracking-tighter">Hardware Access</h2>
                <p className="text-[11px] font-mono uppercase tracking-widest text-black/60 text-center mb-8 leading-relaxed">
                    Ledger Chat requires camera and microphone permissions for peer to peer encrypted {pendingCallType === 'video' ? 'video' : 'audio'} tunneling. No media traverses our servers.
                </p>
                <div className="flex flex-col gap-3 w-full">
                    <button
                        onClick={() => onGrant(pendingCallType)}
                        className="w-full py-4 bg-black text-white font-mono font-bold text-[11px] uppercase tracking-[0.2em] hover:bg-white hover:text-black border border-black transition-colors"
                    >
                        Allow &amp; Initialize
                    </button>
                    <button
                        onClick={() => setPendingCallType(null)}
                        className="w-full py-4 bg-transparent text-black/50 font-mono font-bold text-[11px] uppercase tracking-[0.2em] hover:text-black transition-colors"
                    >
                        Abort
                    </button>
                </div>
            </div>
        </div>
    );
}
