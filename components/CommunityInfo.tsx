'use client';

import React from 'react';
import { Users, TrendingUp, Globe, Award, Zap, Heart, MessageCircle, Lock, Wallet, Coins, BarChart, CheckCircle } from 'lucide-react';

export function CommunityInfo() {
    const communityCards = [
        {
            title: "Sovereign Groups",
            subtitle: "Decentralized end-to-end encrypted spaces",
            color: "bg-[#25D366]"
        },
        {
            title: "Polygon and Ethereum",
            subtitle: "Multi-chain cryptographic identity verification",
            color: "bg-emerald-600"
        },
        {
            title: "Global Protocol",
            subtitle: "Decentralized federation relay for communities",
            color: "bg-emerald-700"
        },
        {
            title: "Non-Custodial",
            subtitle: "You retain full control of your private keys",
            color: "bg-slate-700"
        },
    ];

    return (
        <div className="w-full py-12 px-6 bg-[#FAFAFA]">
            <div className="max-w-6xl mx-auto">
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
                    {communityCards.map((card, i) => (
                        <div key={i} className="bg-white p-6 rounded-3xl border border-black/5 shadow-sm">
                            <span className="text-[18px] font-black text-[#1C1C1E] block mb-2">{card.title}</span>
                            <p className="text-[13px] text-black/50 leading-relaxed font-medium">{card.subtitle}</p>
                        </div>
                    ))}
                </div>
            </div>
        </div>
    );
}
