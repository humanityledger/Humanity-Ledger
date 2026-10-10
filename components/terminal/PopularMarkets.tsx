"use client";

import { useQuery } from "@tanstack/react-query";
import { getMarkets, Market } from "@/lib/api";
import { motion } from "framer-motion";
import { TrendingUp } from "lucide-react";

import { safeToFixed, safeToLocaleString } from '@/lib/utils/number-format';

export default function PopularMarkets() {
    const { data: markets, isLoading } = useQuery({
        queryKey: ["markets"],
        queryFn: getMarkets,
    });

    if (isLoading) {
        return (
            <div className="space-y-4">
                {[1, 2, 3].map((i) => (
                    <div key={i} className="h-16 w-full bg-white/5 rounded-xl animate-pulse" />
                ))}
            </div>
        );
    }

    return (
        <div className="space-y-4">
            <div className="flex items-center space-x-2 text-white/80 mb-4">
                <TrendingUp className="w-5 h-5 text-emerald-400" />
                <h2 className="text-lg font-bold">Trending Markets</h2>
            </div>

            <div className="grid gap-3">
                {markets?.map((market, idx) => (
                    <motion.div
                        key={market.slug}
                        initial={{ opacity: 0, y: 10 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ delay: idx * 0.1 }}
                        className="group relative p-4 rounded-2xl bg-white/5 border border-white/5 hover:border-white/10 hover:bg-white/[0.07] transition-all cursor-pointer flex items-center justify-between"
                    >
                        <div className="flex-1">
                            <h3 className="font-medium text-white group-hover:text-emerald-200 transition-colors">
                                {market.question}
                            </h3>
                            <div className="mt-1 flex space-x-4 text-xs text-gray-400">
                                <span>Vol: ${safeToFixed(market.volume / 1000000, 1)}M</span>
                                <span>Ends: {market.endDate}</span>
                            </div>
                        </div>

                        <div className="flex space-x-2 pl-4">
                            {market.tokens.map(token => (
                                <div key={token.tokenId} className={`
                      flex flex-col items-center justify-center w-14 h-12 rounded-lg border font-medium text-xs
                      ${token.outcome === 'Yes'
                                        ? 'bg-emerald-500/10 border-emerald-500/20 text-emerald-400'
                                        : 'bg-rose-500/10 border-rose-500/20 text-rose-400'}
                   `}>
                                    <span>{token.outcome}</span>
                                    <span>{safeToFixed(token.price * 100, 0)}%</span>
                                </div>
                            ))}
                        </div>
                    </motion.div>
                ))}
            </div>
        </div>
    );
}


