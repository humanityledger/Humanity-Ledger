"use client";
import React, { memo } from "react";

interface TokenRowProps {
  symbol: string;
  name: string;
  balance: string;
  value: string;
  icon?: string;
  change24h?: number;
  chainId?: number;
}

const getChainName = (id?: number) => {
    switch(id) {
        case 1: return "Ethereum";
        case 137: return "Polygon";
        case 8453: return "Base";
        case 42161: return "Arbitrum";
        case 10: return "Optimism";
        case 56: return "BSC";
        case 43114: return "Avalanche";
        case 480: return "Worldchain";
        default: return "Mainnet";
    }
}

const getChainColor = (id?: number) => {
    switch(id) {
        case 137: return "bg-purple-500/10 text-purple-400 border-purple-500/20";
        case 8453: return "bg-[#25D366]/10 text-blue-400 border-[#25D366]/20";
        case 42161: return "bg-sky-500/10 text-sky-400 border-sky-500/20";
        case 10: return "bg-red-500/10 text-red-400 border-red-500/20";
        case 480: return "bg-emerald-500/10 text-emerald-400 border-emerald-500/20";
        default: return "bg-white/10 text-zinc-300 border-white/20";
    }
}

const TokenRowComponent = ({ symbol, name, balance, value, icon, change24h, chainId }: TokenRowProps) => {
  return (
    <div className="p-4 flex items-center justify-between cursor-default">
      <div className="flex items-center gap-4">
        {/* Minimalist Icon */}
        <div className="relative w-10 h-10 flex-shrink-0">
          <div className="w-full h-full bg-white/5 rounded-full flex items-center justify-center border border-white/10 overflow-hidden">
             {icon ? (
                 <img src={icon} alt={symbol} className="w-7 h-7 rounded-full object-cover" />
             ) : (
                 <span className="font-bold text-sm text-zinc-400">{symbol[0]}</span>
             )}
          </div>
          {/* Network badge */}
          {chainId && chainId !== 1 && (
             <div className="absolute -bottom-1 -right-1 w-4 h-4 rounded-full bg-black border border-white/10 flex items-center justify-center p-0.5" title={getChainName(chainId)}>
                <div className={`w-full h-full rounded-full ${getChainColor(chainId).split(' ')[0]}`} />
             </div>
          )}
        </div>
        
        <div>
          <div className="font-bold text-white tracking-tight flex items-center gap-2 drop-shadow-md">
              {name} 
              <span className={`text-[9px] font-bold px-1.5 py-0.5 rounded border uppercase tracking-widest ${getChainColor(chainId)}`}>
                  {getChainName(chainId)}
              </span>
          </div>
          <div className="text-xs text-zinc-400 font-medium">
              {balance} {symbol}
          </div>
        </div>
      </div>

      <div className="text-right">
         <div className="font-bold text-white tracking-tight drop-shadow-md">
             {value}
         </div>
         {change24h !== undefined && (
             <div className={`text-[10px] font-bold ${change24h >= 0 ? 'text-emerald-400' : 'text-red-400'} flex justify-end items-center gap-1 uppercase drop-shadow-sm`}>
                 {change24h >= 0 ? '+' : ''}{change24h.toFixed(2)}%
             </div>
         )}
      </div>
    </div>
  );
};

export const TokenRow = memo(TokenRowComponent);


