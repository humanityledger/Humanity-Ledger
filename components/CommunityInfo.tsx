'use client';

import React from 'react';
import LottieCard from './ui/LottieCard';
import { Users, TrendingUp, Globe, Award, Shield, Zap, Heart, MessageCircle, DollarSign, BookOpen, Target, Trophy, Sparkles, Lock, Wallet, Coins, BarChart, Star, CheckCircle, Gift } from 'lucide-react';

export function CommunityInfo() {
    const communityCards = [
        {
            lottieSrc: "https://lottie.host/0f8c4e3d-9b7a-4f6c-8d2e-1a3b4c5d6e7f/9KJh8G7F6D.lottie",
            title: "+150K Members",
            subtitle: "Global active community in 45 countries",
            color: "bg-indigo-600"
        },
        {
            lottieSrc: "https://lottie.host/57803657-6105-4752-921c-308101452631/ShieldSecure.lottie",
            title: "300% Growth",
            subtitle: "Monthly increase in verified users",
            color: "bg-purple-600"
        },
        {
            lottieSrc: "https://lottie.host/8e4d2f1c-9bfa-4b77-8db5-3c5f1b2e6a9d/RainCoins.lottie",
            title: "Global Reach",
            subtitle: "Operations in 45+ countries worldwide",
            color: "bg-emerald-600"
        },
        {
            lottieSrc: "https://lottie.host/0a1b2c3d-4e5f-6g7h-8i9j-0k1l2m3n4o5p/CoinSwap3D.lottie",
            title: "$2M in Rewards",
            subtitle: "Distributed to the community this year",
            color: "bg-pink-600"
        },
        {
            lottieSrc: "https://lottie.host/1a2b3c4d-5e6f-7g8h-9i0j-1k2l3m4n5o6p/FastLightning.lottie",
            title: "100% Secure",
            subtitle: "Quarterly security audits",
            color: "bg-emerald-600"
        },
        {
            lottieSrc: "https://lottie.host/0f8c4e3d-9b7a-4f6c-8d2e-1a3b4c5d6e7f/9KJh8G7F6D.lottie",
            title: "<1s Transactions",
            subtitle: "Average speed on Layer 2",
            color: "bg-cyan-600"
        },
        {
            lottieSrc: "https://lottie.host/57803657-6105-4752-921c-308101452631/ShieldSecure.lottie",
            title: "98% Satisfaction",
            subtitle: "Average rating from active users",
            color: "bg-rose-600"
        },
        {
            lottieSrc: "https://lottie.host/8e4d2f1c-9bfa-4b77-8db5-3c5f1b2e6a9d/RainCoins.lottie",
            title: "24/7 Support",
            subtitle: "Team available on Discord and Telegram",
            color: "bg-violet-600"
        },
        {
            lottieSrc: "https://lottie.host/0a1b2c3d-4e5f-6g7h-8i9j-0k1l2m3n4o5p/CoinSwap3D.lottie",
            title: "$50M Volume",
            subtitle: "Total cumulative attesting volume",
            color: "bg-green-600"
        },
        {
            lottieSrc: "https://lottie.host/1a2b3c4d-5e6f-7g8h-9i0j-1k2l3m4n5o6p/FastLightning.lottie",
            title: "200+ Tutorials",
            subtitle: "Free DeFi Academy for everyone",
            color: "bg-amber-600"
        },
        {
            lottieSrc: "https://lottie.host/0f8c4e3d-9b7a-4f6c-8d2e-1a3b4c5d6e7f/9KJh8G7F6D.lottie",
            title: "92% Accuracy",
            subtitle: "Accurate predictions in markets",
            color: "bg-red-600"
        },
        {
            lottieSrc: "https://lottie.host/57803657-6105-4752-921c-308101452631/ShieldSecure.lottie",
            title: "Top 5 DeFi",
            subtitle: "Global ranking on DeFi platforms",
            color: "bg-yellow-600"
        },
        {
            lottieSrc: "https://lottie.host/8e4d2f1c-9bfa-4b77-8db5-3c5f1b2e6a9d/RainCoins.lottie",
            title: "Zero Gas Fees",
            subtitle: "Free transactions for holders",
            color: "bg-fuchsia-600"
        },
        {
            lottieSrc: "https://lottie.host/0a1b2c3d-4e5f-6g7h-8i9j-0k1l2m3n4o5p/CoinSwap3D.lottie",
            title: "Non-Custodial",
            subtitle: "You control your private keys always",
            color: "bg-slate-700"
        },
        {
            lottieSrc: "https://lottie.host/1a2b3c4d-5e6f-7g8h-9i0j-1k2l3m4n5o6p/FastLightning.lottie",
            title: "Multi-Chain",
            subtitle: "Compatible with 15+ blockchains",
            color: "bg-orange-600"
        },
        {
            lottieSrc: "https://lottie.host/0f8c4e3d-9b7a-4f6c-8d2e-1a3b4c5d6e7f/9KJh8G7F6D.lottie",
            title: "12% Average APY",
            subtitle: "Automatic staking yields",
            color: "bg-lime-600"
        },
        {
            lottieSrc: "https://lottie.host/57803657-6105-4752-921c-308101452631/ShieldSecure.lottie",
            title: "500K Operations",
            subtitle: "Transactions processed this month",
            color: "bg-teal-600"
        },
        {
            lottieSrc: "https://lottie.host/8e4d2f1c-9bfa-4b77-8db5-3c5f1b2e6a9d/RainCoins.lottie",
            title: "4.9/5 Rating",
            subtitle: "Rating across all platforms",
            color: "bg-indigo-500"
        },
        {
            lottieSrc: "https://lottie.host/0a1b2c3d-4e5f-6g7h-8i9j-0k1l2m3n4o5p/CoinSwap3D.lottie",
            title: "99.9% Uptime",
            subtitle: "Guaranteed annual availability",
            color: "bg-sky-600"
        },
        {
            lottieSrc: "https://lottie.host/1a2b3c4d-5e6f-7g8h-9i0j-1k2l3m4n5o6p/FastLightning.lottie",
            title: "Referral Program",
            subtitle: "Earn 15% commission per referral",
            color: "bg-purple-500"
        }
    ];

    return (
        <div className="w-full max-w-[1440px] mx-auto mb-12 px-5 py-20">
            {/* Header */}
            <div className="mb-12 px-4 text-center">
                <h2 className="text-5xl md:text-7xl font-black text-indigo-900 mb-6 tracking-tighter drop-shadow-sm">
                    GLOBAL COMMUNITY
                </h2>
                <p className="text-indigo-800/80 text-xl max-w-2xl mx-auto font-medium">
                    Join the world's fastest financial revolution.
                </p>
            </div>

            {/* Grid de 20 Tarjetas Vibrant */}
            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-6 px-4">
                {communityCards.map((card, index) => (
                    <LottieCard
                        key={index}
                        lottieSrc={card.lottieSrc}
                        title={card.title}
                        subtitle={card.subtitle}
                        lottieSize="md"
                        className={`
                            ${card.color} 
                            border-none
                            hover:scale-105 hover:rotate-1 
                            transition-all duration-300 
                            shadow-[0_10px_30px_rgba(0,0,0,0.2)]
                            hover:shadow-[0_20px_40px_rgba(0,0,0,0.3)]
                        `}
                    />
                ))}
            </div>
        </div>
    );
}


