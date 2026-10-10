"use client";

import { useBalance } from "wagmi";
import { useSystemAccount as useAccount } from '@/hooks/useSystemAccount';
import { Loader2 } from "lucide-react";

import { safeToFixed, safeToLocaleString } from '@/lib/utils/number-format';
export default function BalanceCard() {
    const { address } = useAccount();
    const { data, isLoading } = useBalance({
        address,
        // For Polygon, you might want to specify the USDC token address here. 
        // If undefined, it fetches native MATIC.
        // token: "0x3c499c542cEF5E3811e1192ce70d8cC03d5c3359" (USDC Polygon)
    });

    return (
        <div className="w-full h-full p-6 rounded-3xl bg-white/5 border border-white/10 backdrop-blur-xl flex flex-col justify-between">
            <div>
                <h3 className="text-gray-400 font-medium text-sm tracking-wider uppercase">Portfolio Value</h3>
                <div className="mt-2 flex items-baseline space-x-2">
                    {isLoading ? (
                        <Loader2 className="w-8 h-8 text-white/50 animate-spin" />
                    ) : ( 
                        <>
                            <span className="text-4xl font-bold text-white">
                                {data ? safeToFixed(data.formatted, 2) : "0.00"}
                            </span>
                            <span className="text-lg text-gray-500 font-medium">{data?.symbol}</span>
                        </>
                    )}
                </div>
            </div>

            <div className="mt-4 flex space-x-2">
                <button className="flex-1 py-2 rounded-xl bg-emerald-600 hover:bg-[#25D366] text-white font-medium text-sm transition-colors">
                    Deposit
                </button>
                <button className="flex-1 py-2 rounded-xl bg-white/10 hover:bg-white/20 text-white font-medium text-sm transition-colors">
                    Withdraw
                </button>
            </div>
        </div>
    );
}


