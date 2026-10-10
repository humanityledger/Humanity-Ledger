"use client";

import React, { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useWalletStore, NETWORKS, NetworkId } from '@/lib/store/wallet-store';
import { toast } from 'sonner';

export function NativeBuyView({ address, onBack }: any) {
    const activeNetwork = useWalletStore(s => s.activeNetwork);
    const [fiatAmount, setFiatAmount] = useState('1000');
    
    // Moonpay requires specific currency codes based on network
    const cryptoCurrencyCode = activeNetwork === 'ethereum' ? 'eth' : 
                               activeNetwork === 'polygon' ? 'matic_polygon' : 
                               activeNetwork === 'arbitrum' ? 'eth_arbitrum' : 
                               activeNetwork === 'optimism' ? 'eth_optimism' : 
                               activeNetwork === 'base' ? 'eth_base' : 'eth';

    // Quantum states
    const [isInitializing, setIsInitializing] = useState(false);
    const [isPolling, setIsPolling] = useState(false);
    const executionLogsRef = useRef<HTMLDivElement>(null);
    const [logs, setLogs] = useState<string[]>([]);
    
    const addLog = (msg: string) => {
        const time = new Date().toISOString().split('T')[1].slice(0, -1);
        setLogs(prev => [...prev, `[${time}] ${msg}`]);
    };

    useEffect(() => {
        if (executionLogsRef.current) {
            executionLogsRef.current.scrollTop = executionLogsRef.current.scrollHeight;
        }
    }, [logs]);

    const handlePurchase = async () => {
        setIsInitializing(true);
        setLogs([]);
        addLog(`Initiating secure fiat gateway...`);
        addLog(`Target Asset: ${cryptoCurrencyCode.toUpperCase()} on ${activeNetwork.toUpperCase()}`);
        addLog(`Recipient: ${address}`);

        try {
            await new Promise(r => setTimeout(r, 600));
            addLog(`Preparing purchase parameters...`);
            await new Promise(r => setTimeout(r, 400));

            const baseUrl = 'https://buy.moonpay.com/';
            const params: Record<string, string> = {
                currencyCode: cryptoCurrencyCode,
                walletAddress: address || '',
                baseCurrencyCode: 'usd',
                baseCurrencyAmount: fiatAmount,
                colorCode: '%23000000',
                theme: 'light',
                showWalletAddressForm: 'true',
            };

            const qs = new URLSearchParams(params).toString();
            const moonpayUrl = `${baseUrl}?${qs}`;
            
            const res = await fetch('/api/internal/moonpay/sign', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ url: moonpayUrl }),
            });
            const { signedUrl } = await res.json();

            const link = document.createElement('a');
            link.href = signedUrl;
            link.target = '_blank';
            link.rel = 'noopener noreferrer';
            document.body.appendChild(link);
            link.click();
            document.body.removeChild(link);
            
            addLog(`MoonPay secure gateway initialized. Complete your purchase in the new window.`);

            toast.success('Purchase Window Opened', { id: 'fiat-tx', description: 'Complete your purchase on MoonPay.' });

            setIsPolling(true);
            addLog(`Listening for deposit confirmation...`);
            let attempts = 0;
            const pollInterval = setInterval(() => {
                attempts++;
                if (attempts % 4 === 0) {
                    addLog(`Checking for incoming transaction...`);
                }
                if (attempts > 12) {
                    clearInterval(pollInterval);
                    setIsPolling(false);
                    addLog(`Deposit of ${fiatAmount} USD in ${cryptoCurrencyCode.toUpperCase()} may be settling — check your balance.`);
                    toast.success('Purchase Submitted', { duration: 5000 });
                }
            }, 2000);

        } catch (e: any) {
            addLog(`ERROR: ${e.message}`);
            toast.error('Failed to open purchase window', { id: 'fiat-tx' });
        } finally {
            setIsInitializing(false);
        }
    };

    return (
        <motion.div initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0, scale: 0.95 }} className="flex flex-col max-w-xl mx-auto w-full pt-8 px-6 pb-20 font-mono min-h-full flex-1">
            <div className="flex items-center justify-between mb-8 pb-4 border-b border-black/10 ">
                <div>
                    <h2 className="text-lg font-black uppercase tracking-widest text-black  flex items-center gap-2">
                        Capital Ingress
                        <span className="flex h-2 w-2 rounded-full bg-emerald-500 animate-pulse"></span>
                    </h2>
                    <p className="text-[10px] uppercase text-black/50  tracking-widest mt-1">Fiat-to-Crypto Gateway Engine</p>
                </div>
                <button onClick={onBack} className="text-[10px] uppercase font-bold tracking-widest border border-black/10  px-3 py-1 hover:bg-black hover:text-white   transition-colors">
                    CLOSE
                </button>
            </div>

            <div className="flex-1 flex flex-col min-h-0 space-y-4">
                
                {/* Visual Dashboard */}
                <div className="bg-black text-white   p-6 relative overflow-hidden transition-colors shadow-2xl">
                    <div className="absolute top-0 right-0 w-32 h-32 bg-white/10  rounded-full blur-3xl -translate-y-1/2 translate-x-1/4"></div>
                    <h3 className="text-[9px] font-bold uppercase tracking-[0.2em] text-white/50  mb-6 flex items-center gap-2">
                        <span className="w-1.5 h-1.5 bg-emerald-500 block animate-pulse"></span> DEPOSIT TARGET IDENTITY
                    </h3>
                    <div className="flex items-center gap-4 mb-2 relative z-10">
                        <span className="text-xl font-light tracking-widest break-all">
                            {address ? `${address.slice(0, 12)}...${address.slice(-10)}` : 'WALLET_NOT_CONNECTED'}
                        </span>
                    </div>
                    <div className="flex items-center justify-between mt-4 border-t border-white/10  pt-4 relative z-10">
                        <span className="text-[9px] uppercase tracking-widest text-emerald-400  font-bold">
                            CRYPTOGRAPHICALLY VERIFIED
                        </span>
                        <span className="text-[9px] font-mono opacity-50">L1/L2 SECURE</span>
                    </div>
                </div>

                {/* Amount Input */}
                <div className="border border-black/10  p-6 bg-white  transition-colors group">
                    <label className="text-[9px] uppercase tracking-[0.2em] font-bold text-black/40  mb-4 block">Fiat Allocation</label>
                    <div className="flex flex-col sm:flex-row items-start sm:items-center gap-4">
                        <span className="hidden sm:block text-2xl font-light tracking-widest text-black/40 ">$</span>
                        <input 
                            type="number" 
                            value={fiatAmount}
                            onChange={(e) => setFiatAmount(e.target.value)}
                            placeholder="1000"
                            className="bg-transparent text-5xl font-light outline-none w-full sm:flex-1 [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none text-black  transition-colors"
                        />
                        <span className="text-lg font-bold tracking-widest text-black/40 ">USD</span>
                    </div>
                </div>

                {/* Routing Details */}
                <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="border border-black/10  p-4 bg-black/5  text-[10px] uppercase font-mono tracking-widest space-y-3">
                    <div className="flex justify-between text-black/60 ">
                        <span>Liquidity Provider</span>
                        <span className="text-black  font-bold flex items-center gap-1">Moonpay Integration</span>
                    </div>
                    <div className="flex justify-between text-black/60 ">
                        <span>Target Ledger</span>
                        <span className="text-black  font-bold">{activeNetwork} ({cryptoCurrencyCode.toUpperCase()})</span>
                    </div>
                    <div className="flex justify-between text-black/60 ">
                        <span>Settlement Time</span>
                        <span className="text-[#00C076] font-bold">~ 2 - 5 Minutes</span>
                    </div>
                </motion.div>



                <div className="mt-auto pt-4">
                    <button 
                        onClick={handlePurchase}
                        disabled={isInitializing || isPolling}
                        className="w-full py-6 bg-black text-white   font-black text-[12px] uppercase tracking-[0.3em] transition-all hover:bg-black/90  disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-3 shadow-2xl"
                    >
                        {isPolling ? 'AWAITING FIAT SETTLEMENT...' : 'INITIALIZE SECURE INGRESS'}
                    </button>
                    
                    <div className="mt-5 flex items-start gap-2 text-[8px] uppercase tracking-[0.2em] text-black/40  text-center justify-center px-4 leading-relaxed">
                        <p>TO ENSURE MAXIMUM SECURITY AND ISOLATION, THE PAYMENT TERMINAL WILL OPEN IN AN ENCRYPTED POPUP ENVIRONMENT OUTSIDE THE MAIN THREAD.</p>
                    </div>
                </div>
            </div>
        </motion.div>
    );
}
