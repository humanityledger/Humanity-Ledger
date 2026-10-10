"use client";

import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { X, Send, ArrowUpRight, Loader2, AlertTriangle, Shield, Globe, User, ChevronDown, Wallet } from 'lucide-react';
import { ethers } from 'ethers';
import { getExplorerTxUrl } from '@/lib/wallet/chains';
import { useTransactionHandler } from '@/hooks/useTransactionHandler';
import { parseEther } from 'viem';
import { cn } from '@/lib/utils';
import { StealthText } from '@/components/ui/stealth-text';

// [LEGENDARY] Modes for specialized send actions
export type SendMode = 'standard' | 'bridge' | 'private' | 'contact';

interface SendModalProps {
    isOpen: boolean;
    onClose: () => void;
    userAddress: string;
    chainId?: number;
    initialMode?: SendMode;
    tokens?: any[]; // [CELESTIAL] Token List
}

export default function SendModal({ isOpen, onClose, userAddress, chainId = 1, initialMode = 'standard', tokens = [] }: SendModalProps) {
    const { handleExternalTransaction, isConnected: isExternalConnected } = useTransactionHandler();
    const [recipientAddress, setRecipientAddress] = useState('');
    const [amount, setAmount] = useState('');
    const [selectedToken, setSelectedToken] = useState<any>(null); // { symbol: 'ETH', ... }
    const [showTokenSelect, setShowTokenSelect] = useState(false);
    
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState('');
    const [success, setSuccess] = useState(false);
    const [txHash, setTxHash] = useState('');
    const [gasEstimate, setGasEstimate] = useState('');
    const [status, setStatus] = useState<'PENDING' | 'CONFIRMED' | 'FAILED' | 'IDLE'>('IDLE');

    // Default to ETH if no token selected
    useEffect(() => {
        if (tokens.length > 0 && !selectedToken) {
            const native = tokens.find(t => t.symbol === 'ETH') || tokens[0];
            setSelectedToken(native);
        }
    }, [tokens]);

    // [LEGENDARY] Real-time Transaction Status Polling (Smart Websockets simulated hook)
    useEffect(() => {
        let interval: NodeJS.Timeout;
        if (success && txHash && status === 'PENDING') {
            interval = setInterval(async () => {
                try {
                    const res = await fetch(`/api/wallet/transaction/status?txHash=${txHash}&chainId=${chainId}`);
                    const data = await res.json();
                    if (data.status === 'CONFIRMED') setStatus('CONFIRMED');
                    else if (data.status === 'FAILED') setStatus('FAILED');
                } catch (e) { console.error('Polling error:', e); }
            }, 3000); 
        }
        return () => interval && clearInterval(interval);
    }, [success, txHash, status, chainId]);

    // Estimate gas
    const estimateGas = async () => {
        if (!recipientAddress || !amount) return;
        try {
            const res = await fetch('/api/wallet/estimate-gas', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ 
                    to: recipientAddress, 
                    amount, 
                    token: selectedToken?.symbol || 'ETH' 
                }),
            });
            const data = await res.json();
            setGasEstimate(data.gasFeeUSD);
        } catch (e) {
            console.error('Gas estimation failed', e);
        }
    };

    const handleSend = async () => {
        setLoading(true);
        setError('');
        setTxHash('');
        setSuccess(false);
        setStatus('IDLE');

        if (!ethers.isAddress(recipientAddress)) {
            setError('Invalid Ethereum address');
            setLoading(false);
            return;
        }

        if (parseFloat(amount) <= 0) {
            setError('Amount must be greater than 0');
            setLoading(false);
            return;
        }

        try {
            if (isExternalConnected) {
                // External Wallet
                const hash = await handleExternalTransaction({
                    to: recipientAddress as `0x${string}`,
                    value: parseEther(amount),
                    chainId
                });
                if (hash) {
                    setTxHash(hash);
                    setSuccess(true);
                    setStatus('PENDING');
                }
            } else {
                // Internal Celestial Wallet
                const res = await fetch('/api/wallet/send', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        to: recipientAddress,
                        amount: amount,
                        token: selectedToken?.symbol || 'ETH',
                        chainId,
                        mode: initialMode
                    }),
                });

                if (!res.ok) {
                    const errorData = await res.json();
                    throw new Error(errorData.error || 'Transaction failed');
                }

                const data = await res.json();
                setTxHash(data.txHash);
                setSuccess(true);
                setStatus('PENDING');
            }
        } catch (e: any) {
            setError(e.message || 'Failed to send transaction');
        } finally {
            setLoading(false);
        }
    };

    const getModeConfig = () => {
        switch (initialMode) {
            case 'bridge': return { title: 'Cross-Chain Bridge', desc: 'Transfer assets to another network', icon: <Globe className="text-emerald-400" size={24} />, color: 'bg-[#25D366]/20' };
            case 'private': return { title: 'Private Transfer', desc: 'Obfuscated transaction route', icon: <Shield className="text-emerald-400" size={24} />, color: 'bg-emerald-500/20' };
            case 'contact': return { title: 'Send to Contact', desc: 'Select from verified directory', icon: <User className="text-orange-400" size={24} />, color: 'bg-orange-500/20' };
            default: return { title: 'Send Asset', desc: 'Transfer Crypto securely', icon: <Send className="text-purple-400" size={24} />, color: 'bg-purple-500/20' };
        }
    }

    const config = getModeConfig();

    return (
        <AnimatePresence>
            {isOpen && (
                <motion.div
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    exit={{ opacity: 0 }}
                    className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm"
                    onClick={onClose}
                >
                    <motion.div
                        initial={{ scale: 0.9, opacity: 0 }}
                        animate={{ scale: 1, opacity: 1 }}
                        exit={{ scale: 0.9, opacity: 0 }}
                        onClick={(e) => e.stopPropagation()}
                        className="relative w-full max-w-md bg-gradient-to-br from-[#1a1a1a] to-black backdrop-blur-xl rounded-[2rem] p-8 border border-white/10 shadow-2xl overflow-visible"
                    >
                        <button onClick={onClose} className="absolute top-4 right-4 p-2 rounded-full bg-white/5 hover:bg-white/10 transition-colors">
                            <X size={20} className="text-white" />
                        </button>

                        {/* Mode Header */}
                        <div className="flex items-center gap-3 mb-8">
                            <div className={`p-3 ${config.color} rounded-2xl`}>{config.icon}</div>
                            <div>
                                <h2 className="text-xl font-black text-white">{config.title}</h2>
                                <p className="text-xs text-white/50 font-bold uppercase tracking-wider">{config.desc}</p>
                            </div>
                        </div>

                        {success ? (
                            <div className="text-center py-6">
                                <div className={cn("w-20 h-20 rounded-full flex items-center justify-center mx-auto mb-6", 
                                    status === 'CONFIRMED' ? "bg-green-500/20 text-green-400" : status === 'FAILED' ? "bg-indigo-500/20 text-indigo-400" : "bg-purple-500/20 text-purple-400"
                                )}>
                                    {status === 'CONFIRMED' ? <ArrowUpRight size={40} /> : status === 'FAILED' ? <AlertTriangle size={40} /> : <Loader2 className="animate-spin" size={40} />}
                                </div>
                                <h3 className="text-2xl font-black text-white mb-2">{status === 'CONFIRMED' ? 'Confirmed!' : status === 'FAILED' ? 'Failed' : 'Sent!'}</h3>
                                <p className="text-white/60 text-sm mb-6">
                                    {status === 'CONFIRMED' ? 'Funds successfully transferred.' : status === 'FAILED' ? 'Transaction encountered an error.' : 'Confirming on blockchain...'}
                                </p>
                                <a href={chainId ? getExplorerTxUrl(chainId, txHash) : `https://etherscan.io/tx/${txHash}`} target="_blank" rel="noopener noreferrer" className="block w-full py-4 bg-white/5 hover:bg-white/10 rounded-xl font-bold text-white transition-all">
                                    View on Explorer
                                </a>
                                {status === 'FAILED' && <button onClick={() => { setSuccess(false); setStatus('IDLE'); }} className="mt-4 text-white/40 text-xs hover:text-white underline">Try Again</button>}
                            </div>
                        ) : (
                            <>
                                {/* Asset Selector */}
                                <div className="mb-6 relative">
                                    <label className="text-white/40 text-[10px] font-black uppercase tracking-widest mb-2 block">Select Asset</label>
                                    <button 
                                        onClick={() => setShowTokenSelect(!showTokenSelect)}
                                        className="w-full flex items-center justify-between p-4 bg-white/5 border border-white/10 rounded-2xl hover:bg-white/10 transition-all"
                                    >
                                        <div className="flex items-center gap-3">
                                            {selectedToken?.logo ? (
                                                <img src={selectedToken.logo} className="w-8 h-8 rounded-full" />
                                            ) : (
                                                <div className="w-8 h-8 rounded-full bg-purple-600 flex items-center justify-center text-xs font-bold">{selectedToken?.symbol?.[0] || 'E'}</div>
                                            )}
                                            <div className="text-left">
                                                <div className="text-white font-bold">{selectedToken?.symbol || 'ETH'}</div>
                                                <div className="text-white/40 text-xs">{selectedToken?.balanceFormatted || '0.00'} Available</div>
                                            </div>
                                        </div>
                                        <ChevronDown size={16} className="text-white/40" />
                                    </button>

                                    {/* Dropdown */}
                                    <AnimatePresence>
                                        {showTokenSelect && (
                                            <motion.div 
                                                initial={{ opacity: 0, y: 5 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: 5 }}
                                                className="absolute top-full left-0 right-0 mt-2 bg-[#1a1a1a] border border-white/10 rounded-2xl shadow-2xl z-20 max-h-[200px] overflow-y-auto"
                                            >
                                                {tokens.map((t, i) => (
                                                    <button key={i} onClick={() => { setSelectedToken(t); setShowTokenSelect(false); }} className="w-full flex items-center gap-3 p-3 hover:bg-white/5 transition-colors text-left">
                                                        <div className="w-6 h-6 rounded-full bg-white/10 flex items-center justify-center text-[10px] text-white">{t.symbol[0]}</div>
                                                        <div>
                                                            <div className="text-white text-sm font-bold">{t.symbol}</div>
                                                            <div className="text-white/40 text-xs">{t.balanceFormatted}</div>
                                                        </div>
                                                    </button>
                                                ))}
                                            </motion.div>
                                        )}
                                    </AnimatePresence>
                                </div>

                                <div className="mb-6">
                                    <label className="text-white/40 text-[10px] font-black uppercase tracking-widest mb-2 block">Recipient</label>
                                    <input type="text" value={recipientAddress} onChange={(e) => setRecipientAddress(e.target.value)} onBlur={estimateGas} placeholder="0x... or ENS" className="w-full px-4 py-4 bg-white/5 border border-white/10 rounded-2xl text-white placeholder-white/20 focus:outline-none focus:border-purple-500/50 font-mono text-sm" />
                                </div>

                                <div className="mb-8">
                                    <label className="text-white/40 text-[10px] font-black uppercase tracking-widest mb-2 block">Amount</label>
                                    <div className="relative">
                                        <input type="number" value={amount} onChange={(e) => setAmount(e.target.value)} onBlur={estimateGas} placeholder="0.00" step="0.000001" className="w-full pl-4 pr-16 py-4 bg-white/5 border border-white/10 rounded-2xl text-white text-2xl font-black placeholder-white/10 focus:outline-none focus:border-purple-500/50" />
                                        <button onClick={() => setAmount(selectedToken?.balanceNumeric || '')} className="absolute right-4 top-1/2 -translate-y-1/2 text-xs font-bold text-purple-400 hover:text-purple-300 uppercase tracking-wider">MAX</button>
                                    </div>
                                    <div className="mt-2 flex justify-between">
                                        <span className="text-white/40 text-xs font-bold"> ${((parseFloat(amount) || 0) * (selectedToken?.price || 0)).toFixed(2)} USD</span>
                                        {gasEstimate && <span className="text-purple-400 text-xs font-bold">Gas: ~${gasEstimate}</span>}
                                    </div>
                                </div>

                                {error && (
                                    <div className="mb-6 p-4 bg-indigo-500/10 border border-indigo-500/20 rounded-2xl flex items-center gap-3">
                                        <AlertTriangle className="text-red-400 shrink-0" size={18} />
                                        <p className="text-red-400 text-xs font-bold leading-relaxed">{error}</p>
                                    </div>
                                )}

                                <button onClick={handleSend} disabled={loading || !recipientAddress || !amount} className="w-full py-5 bg-gradient-to-r from-purple-600 to-emerald-600 hover:from-purple-500 hover:to-[#25D366] disabled:opacity-50 disabled:cursor-not-allowed rounded-2xl font-black text-white text-lg transition-all shadow-lg hover:shadow-purple-500/25 flex items-center justify-center gap-3">
                                    {loading ? <><Loader2 className="animate-spin" size={24} /> Processing...</> : <><Send size={24} /> Send {selectedToken?.symbol || 'Asset'}</>}
                                </button>
                            </>
                        )}
                    </motion.div>
                </motion.div>
            )}
        </AnimatePresence>
    );
}


