'use client';

import { useAccount, useEnsName, useEnsAvatar } from 'wagmi';
import { useEffect, useState } from 'react';

export const WalletDisplay = () => {
    const { address, isConnected } = useAccount();
    const { data: ensName } = useEnsName({ address });
    const { data: ensAvatar } = useEnsAvatar({ name: ensName! });

    if (!isConnected || !address) return null;

    return (
        <div className="flex items-center gap-3 px-4 py-2 rounded-full glass border border-white/10 hover:border-[#00f2ea] transition-all cursor-pointer group">
            <div className="relative">
                {ensAvatar ? (
                    <img src={ensAvatar} alt="ENS" className="w-6 h-6 rounded-full" />
                ) : (
                    <div className="w-6 h-6 rounded-full bg-gradient-to-tr from-[#00f2ea] to-emerald-600" />
                )}
                <span className="absolute bottom-0 right-0 w-2 h-2 bg-[#00ff9d] border border-black rounded-full"></span>
            </div>

            <div className="flex flex-col leading-none">
                <span className="font-mono text-sm text-white font-bold group-hover:text-[#00f2ea] transition-colors">
                    {ensName || `${address.substring(0, 6)}...${address.substring(address.length - 4)}`}
                </span>
                <span className="text-[10px] text-[#888899] uppercase tracking-wider">
                    {ensName ? 'ENS VERIFIED' : 'EOA CONNECTED'}
                </span>
            </div>
        </div>
    );
};

