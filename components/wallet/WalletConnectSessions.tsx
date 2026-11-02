"use client";

import React from 'react';
import { useAppKitNetwork, useDisconnect } from '@reown/appkit/react';
import { useSystemAccount } from '@/hooks/useSystemAccount';
import NextLink from 'next/link';
import { toast } from 'sonner';

export function WalletConnectSessions() {
    const { isConnected, address } = useSystemAccount();
    const caipAddress = `eip155:1:${address}`;
    const { caipNetwork } = useAppKitNetwork();
    const { disconnect } = useDisconnect();

    const handleDisconnect = async () => {
        try {
            await disconnect();
            toast.success("Wallet disconnected");
        } catch (e) {
            toast.error("Failed to disconnect");
        }
    };

    if (!isConnected) {
        return (
            <div className="flex flex-col items-center justify-center py-20 bg-white/30 backdrop-blur-md rounded-[3rem] border border-dashed border-[#1F1F1F]/20">
                <div className="w-20 h-20 rounded-full bg-white flex items-center justify-center mb-6 shadow-xl text-[#1F1F1F]/40">
                </div>
                <h3 className="text-xl font-bold text-[#1F1F1F]/80 mb-2">No Active Session</h3>
                <p className="text-[#1F1F1F]/40 font-medium">Connect your wallet to see session details.</p>
            </div>
        );
    }

    return (
        <div className="bg-white/50 backdrop-blur-xl border border-white/40 p-8 rounded-[2rem]">
            <div className="flex justify-between items-center mb-8">
                <div>
                    <h3 className="text-xl font-bold text-[#1F1F1F] flex items-center gap-2">
                        Active Connection
                    </h3>
                    <p className="text-sm text-[#1F1F1F]/50">Monitoring real-time session parameters.</p>
                </div>
                <span className="px-3 py-1 bg-black text-white rounded-full text-xs font-bold border border-black/20 animate-pulse">
                    LIVE
                </span>
            </div>

            <div className="grid gap-6">
                {/* Network Status */}
                <div className="p-4 bg-white/60 rounded-2xl border border-white/50 flex items-center justify-between">
                    <div className="flex items-center gap-4">
                        <div>
                            <p className="text-xs font-bold text-[#1F1F1F]/40 uppercase">Network</p>
                            <p className="text-[#1F1F1F] font-bold">{caipNetwork?.name || 'Unknown Network'}</p>
                        </div>
                    </div>
                    <div className="text-right">
                         <p className="text-xs font-bold text-[#1F1F1F]/40 uppercase">Chain ID</p>
                         <p className="font-mono text-sm text-[#1F1F1F]">{caipNetwork?.id || '---'}</p>
                    </div>
                </div>

                {/* Session Details */}
                <div className="p-4 bg-white/60 rounded-2xl border border-white/50 flex items-center justify-between">
                    <div className="flex items-center gap-4">
                        <div>
                            <p className="text-xs font-bold text-[#1F1F1F]/40 uppercase">Protocol</p>
                            <p className="text-[#1F1F1F] font-bold">WalletConnect v2</p>
                        </div>
                    </div>
                     <div className="text-right">
                         <p className="text-xs font-bold text-[#1F1F1F]/40 uppercase">Encryption</p>
                         <p className="font-mono text-sm text-[#1F1F1F] flex items-center gap-1 justify-end">
                            End to End
                         </p>
                    </div>
                </div>

                 {/* Address Info */}
                 <div className="p-6 bg-[#1F1F1F] rounded-2xl shadow-xl text-white">
                    <p className="text-xs font-bold text-white/40 uppercase mb-2">Connected Account</p>
                    <p className="font-mono text-lg md:text-xl break-all">{address}</p>
                    <div className="mt-4 pt-4 border-t border-white/10 flex justify-between items-center">
                        <span className="text-xs text-white/40">{caipAddress || 'CAIP-10 Standard'}</span>
                        <div className="flex items-center gap-2">
                             <span className="text-xs font-bold text-white">Secure</span>
                        </div>
                    </div>
                </div>

                <NextLink
                    href="/hub"
                    className="w-full py-4 mt-4 bg-black/5 hover:bg-black/10 text-black border border-black/20 rounded-xl font-bold flex items-center justify-center gap-2 transition-all"
                >
                    Open App Hub
                </NextLink>

                <button 
                    onClick={handleDisconnect}
                    className="w-full py-4 mt-2 bg-black hover:bg-black/80 text-white border border-black rounded-xl font-bold flex items-center justify-center gap-2 transition-all"
                >
                    Disconnect Session
                </button>
            </div>
        </div>
    );
}

