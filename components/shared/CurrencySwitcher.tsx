"use client";

import React, { useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useCurrencyStore, CurrencyCode } from '@/lib/store/currency-store';
import { Globe, Coins, Bitcoin } from 'lucide-react';

export function CurrencySwitcher() {
  const { currency, setCurrency, fetchRates, lastUpdated } = useCurrencyStore();
  const [isOpen, setIsOpen] = React.useState(false);

  useEffect(() => {
    // Refresh rates on mount and every 5 minutes
    fetchRates();
    const interval = setInterval(fetchRates, 1000 * 60 * 5);
    return () => clearInterval(interval);
  }, [fetchRates]);

  const options: { id: CurrencyCode; label: string; icon: any; color: string }[] = [
    { id: 'USD', label: 'USD', icon: Globe, color: 'text-emerald-500' },
    { id: 'EUR', label: 'EUR', icon: Coins, color: 'text-indigo-500' },
    { id: 'GBP', label: 'GBP', icon: Coins, color: 'text-[#25D366]' },
    { id: 'CHF', label: 'CHF', icon: Coins, color: 'text-red-500' },
    { id: 'BTC', label: 'BTC', icon: Bitcoin, color: 'text-amber-500' },
    { id: 'SEK', label: 'SEK', icon: Coins, color: 'text-blue-400' },
    { id: 'NOK', label: 'NOK', icon: Coins, color: 'text-red-400' },
    { id: 'DKK', label: 'DKK', icon: Coins, color: 'text-red-600' },
    { id: 'PLN', label: 'PLN', icon: Coins, color: 'text-red-300' },
    { id: 'TRY', label: 'TRY', icon: Coins, color: 'text-red-700' },
  ];

  return (
    <div className="relative">
      <motion.button
        whileHover={{ scale: 1.05 }}
        whileTap={{ scale: 0.95 }}
        onClick={() => setIsOpen(!isOpen)}
        className="flex items-center gap-2 px-3 py-1.5 bg-white/5 border border-white/10 rounded-full hover:border-[var(--aztec-chartreuse)]/50 transition-all group shadow-sm"
      >
        <span className="text-[10px] font-aztec-mono font-black text-white/50 uppercase tracking-widest leading-none group-hover:text-white">
          {currency}
        </span>
        <div className="w-px h-3 bg-white/20" />
        <Globe size={12} className="text-white/40 group-hover:text-[var(--aztec-chartreuse)] transition-colors" />
      </motion.button>

      <AnimatePresence>
        {isOpen && (
          <>
            <div className="fixed inset-0 z-40" onClick={() => setIsOpen(false)} />
            <motion.div
              initial={{ opacity: 0, y: 10, scale: 0.95 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: 10, scale: 0.95 }}
              className="absolute top-full right-0 mt-2 w-32 bg-[var(--aztec-ink)] border border-white/10 rounded-2xl shadow-2xl p-2 z-50 flex flex-col gap-1"
            >
              {options.map((opt) => (
                <button
                  key={opt.id}
                  onClick={() => {
                    setCurrency(opt.id);
                    setIsOpen(false);
                  }}
                  className={`flex items-center justify-between px-3 py-2 rounded-xl text-[10px] font-aztec-mono font-black uppercase tracking-widest transition-all ${
                    currency === opt.id 
                      ? 'bg-[var(--aztec-chartreuse)]/10 text-[var(--aztec-chartreuse)] border border-[var(--aztec-chartreuse)]/20' 
                      : 'text-white/40 hover:bg-white/5 hover:text-white'
                  }`}
                >
                  <div className="flex items-center gap-2">
                    <opt.icon size={12} className={currency === opt.id ? 'text-[var(--aztec-chartreuse)]' : opt.color} />
                    {opt.id}
                  </div>
                  {currency === opt.id && (
                    <div className="w-1.5 h-1.5 bg-[var(--aztec-chartreuse)] shadow-[0_0_5px_rgba(212,255,40,0.8)] rounded-full" />
                  )}
                </button>
              ))}
            </motion.div>
          </>
        )}
      </AnimatePresence>
    </div>
  );
}

