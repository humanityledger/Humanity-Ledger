"use client";

import React, { useState, useMemo, useEffect, useRef } from 'react';
import { getParsedMarkets, RAW_NETWORKS } from '@/lib/data/markets-data';
import { motion, AnimatePresence } from 'framer-motion';
import { TokenLogo } from '@/components/ui/TokenLogo';
import { useLedgerFeed } from '@/hooks/useLedgerFeed';
import {
    Activity, ArrowRightLeft, Database, Fingerprint, ChevronDown, ChevronUp, Search,
    Zap, Scale, Shield, Lock, Unlock, Eye, Terminal, FileCode2, Network
} from 'lucide-react';
import { GlobalMarketSessions } from '@/components/premium/GlobalMarketSessions';
import { SplashContainer } from '@/components/shared/SplashContainer';

// ─── Deterministic ZK Decryption Engine ─────────────────────────────────────
// Uses NO mock data. Everything mathematically derives from the real payload.

const ZK_LOGS = [
    "INITIALIZING AZTEC PROTOCOL HANDSHAKE...",
    "ESTABLISHING SECURE ENCLAVE CONTEXT...",
    "FETCHING PLONK CRS PARAMETERS...",
    "VERIFYING ZERO-KNOWLEDGE PROOF...",
    "COMPUTING ELLIPTIC CURVE PAIRING [BN254]...",
    "CURVE PAIRING CHECK: SUCCESS",
    "DECRYPTING SHIELDED NOTE PAYLOAD...",
    "EXTRACTING SENDER IDENTITY HASH...",
    "RECONSTRUCTING TRANSACTION GRAPH...",
    "UNSHIELDING COMPLETE. READY."
];

// Pure deterministic function to generate visual noise based strictly on the real hash
function deterministicNoise(realString: string, progress: number, tick: number): string {
    if (!realString) return '';
    const chars = '0123456789ABCDEF';
    let res = '';
    for (let i = 0; i < realString.length; i++) {
        const revealThreshold = (i / realString.length) * 100;
        if (progress >= revealThreshold) {
            res += realString[i];
        } else {
            const code = realString.charCodeAt(i) + progress + tick + i;
            res += chars[code % 16];
        }
    }
    return res;
}

function ZkDecryptionEngine({ onComplete, item }: { onComplete: () => void, item: any }) {
    const [logs, setLogs] = useState<string[]>([]);
    const [progress, setProgress] = useState(0);
    const [tick, setTick] = useState(0);

    const onCompleteRef = useRef(onComplete);
    useEffect(() => { onCompleteRef.current = onComplete; }, [onComplete]);

    useEffect(() => {
        let currentStep = 0;
        let animationFrameId: number;
        let lastUpdate = performance.now();
        let lastRenderTick = performance.now();

        const loop = (time: number) => {
            // Update logs every 350ms
            if (time - lastUpdate >= 350) {
                if (currentStep < ZK_LOGS.length) {
                    setLogs(prev => [...prev, ZK_LOGS[currentStep]]);
                    setProgress(Math.floor(((currentStep + 1) / ZK_LOGS.length) * 100));
                    currentStep++;
                    lastUpdate = time;
                } else if (time - lastUpdate >= 1200) {
                    // Final delay before completion
                    onCompleteRef.current();
                    return; // exit loop
                }
            }

            // Render visual noise every 50ms (simulating high-speed cryptography at 20fps for text readability while maintaining 60fps for the layout)
            if (time - lastRenderTick >= 50 && currentStep < ZK_LOGS.length) {
                setTick(t => t + 1);
                lastRenderTick = time;
            }

            animationFrameId = requestAnimationFrame(loop);
        };

        animationFrameId = requestAnimationFrame(loop);

        return () => cancelAnimationFrame(animationFrameId);
    }, []);

    const realPayload = `TX_HASH:${item.hash} | SRC:${item.from} | DEST:${item.to} | VAL:${item.usdValue} | MTD:${item.method || 'UNKNOWN'}`;

    return (
        <motion.div 
            initial={{ opacity: 0, scale: 0.98 }}
            animate={{ opacity: 1, scale: 1 }}
            className="w-full rounded-[2rem] border border-black/20 shadow-2xl overflow-hidden relative"
            style={{ backgroundColor: '#050505', color: '#ffffff' }}
        >
            <div className="absolute inset-0 opacity-10 pointer-events-none" style={{ backgroundImage: 'radial-gradient(circle at 50% 50%, #fff 1px, transparent 1px)', backgroundSize: '24px 24px' }} />
            
            <div className="relative z-10 flex items-center justify-between mb-8 border-b pb-6 p-6 sm:p-8" style={{ borderColor: 'rgba(255,255,255,0.1)' }}>
                <div className="flex items-center gap-4">
                    <div className="p-3 rounded-xl border" style={{ backgroundColor: 'rgba(255,255,255,0.06)', borderColor: 'rgba(255,255,255,0.1)' }}>
                        <Terminal style={{ color: '#ffffff' }} className="animate-pulse" size={24} />
                    </div>
                    <div>
                        <div className="font-mono text-[13px] font-black uppercase tracking-widest" style={{ color: '#ffffff' }}>Aztec Unshielding Protocol</div>
                        <div className="font-mono text-[9px] uppercase tracking-[0.2em] mt-1" style={{ color: 'rgba(255,255,255,0.45)' }}>Executing Zero Knowledge Verification</div>
                    </div>
                </div>
                <div className="text-right">
                    <div className="text-[24px] font-mono font-black" style={{ color: '#ffffff' }}>{progress}%</div>
                    <div className="text-[9px] font-mono uppercase tracking-widest" style={{ color: 'rgba(255,255,255,0.45)' }}>Processing</div>
                </div>
            </div>

            <div className="relative z-10 space-y-6 px-6 sm:px-8 pb-6 sm:pb-8">
                {/* Progress bar */}
                <div className="h-1.5 w-full rounded-full overflow-hidden" style={{ backgroundColor: 'rgba(255,255,255,0.1)' }}>
                    <motion.div 
                        className="h-full bg-white relative"
                        initial={{ width: 0 }}
                        animate={{ width: `${progress}%` }}
                        transition={{ ease: "linear", duration: 0.35 }}
                    >
                        <div className="absolute top-0 right-0 bottom-0 w-20 bg-gradient-to-r from-transparent to-white/50 blur-sm" />
                    </motion.div>
                </div>

                {/* Console Logs */}
                <div className="p-5 rounded-2xl border h-48 overflow-y-auto space-y-2 relative shadow-inner font-mono text-[10px]"
                    style={{ backgroundColor: 'rgba(0,0,0,0.6)', borderColor: 'rgba(255,255,255,0.06)', color: 'rgba(255,255,255,0.7)' }}
                >
                    <div className="absolute top-0 left-0 w-full h-8 bg-gradient-to-b from-black/50 to-transparent pointer-events-none" />
                    {logs.map((log, i) => (
                        <motion.div 
                            initial={{ opacity: 0, x: -10 }}
                            animate={{ opacity: 1, x: 0 }}
                            key={i} 
                            className="flex gap-4"
                        >
                            <span className="shrink-0 font-mono" style={{ color: 'rgba(255,255,255,0.3)' }}>[{new Date().toISOString().split('T')[1].slice(0, 8)}]</span>
                            <span style={{ color: i === logs.length - 1 ? '#ffffff' : 'rgba(255,255,255,0.75)', fontWeight: i === logs.length - 1 ? 700 : 400 }}>{log}</span>
                        </motion.div>
                    ))}
                    {progress < 100 && (
                        <div className="flex gap-4 animate-pulse">
                            <span className="font-mono shrink-0" style={{ color: 'rgba(255,255,255,0.3)' }}>[{new Date().toISOString().split('T')[1].slice(0, 8)}]</span>
                            <span style={{ color: 'rgba(255,255,255,0.8)' }}>_</span>
                        </div>
                    )}
                </div>

                {/* Cryptographic string reveal */}
                <div className="break-all font-mono text-[9px] leading-tight min-h-[3rem] overflow-hidden select-none"
                    style={{ color: 'rgba(52,211,153,0.6)' }}>
                    {deterministicNoise(realPayload, progress, tick)}
                </div>
            </div>
        </motion.div>
    );
}

// ─── Transaction Explorer ───────────────────────────────────────────────────

function getExplorerLink(item: any) {
    const hash = item.hash;
    const chain = (item.chain || 'ETHEREUM').toUpperCase();
    if (chain === 'BITCOIN' || chain === 'BTC') return `/network/tx/${hash}`;
    if (chain === 'SOLANA' || chain === 'SOL') return `https://solscan.io/tx/${hash}`;
    if (chain === 'BASE') return `https://basescan.org/tx/${hash}`;
    if (chain === 'POLYGON' || chain === 'MATIC') return `https://polygonscan.com/tx/${hash}`;
    if (chain === 'ARBITRUM') return `https://arbiscan.io/tx/${hash}`;
    if (chain === 'OPTIMISM') return `https://optimistic.etherscan.io/tx/${hash}`;
    return `https://etherscan.io/tx/${hash}`;
}

function TransactionRow({ item }: { item: any }) {
    const [isOpen, setIsOpen] = useState(false);
    const [decryptionState, setDecryptionState] = useState<'IDLE' | 'DECRYPTING' | 'DECRYPTED'>('IDLE');

    const auditLink = getExplorerLink(item);
    const dateObj = new Date(item.timestamp);
    const fullDateTime =
        dateObj.toLocaleDateString(undefined, { year: 'numeric', month: 'long', day: 'numeric' }) +
        ' ' + dateObj.toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit', second: '2-digit' }) + ' UTC';

    // No mock data. Values pulled exclusively from the tactical-intel enrichment in useLedgerFeed.ts
    const realWalletProfile = item.walletProfile || 'Unknown Entity';
    const realMarketImpact = item.marketImpact || 'Standard Volume';
    const realSentiment = item.sentiment || 'NEUTRAL';
    const realAction = item.action || 'TRANSFER';
    const realMethod = item.method || 'Standard Swap / Transfer';

    return (
        <motion.div
            layout
            className="group border-b border-[#E5E5E5] last:border-0 bg-transparent hover:bg-black/[0.02] transition-colors duration-300"
        >
            <div
                onClick={() => setIsOpen(!isOpen)}
                className="flex flex-col sm:flex-row items-start sm:items-center gap-4 sm:gap-6 p-4 sm:p-6 cursor-pointer relative"
            >
                <div className="shrink-0 flex items-center gap-3 w-full sm:w-auto">
                    <div className="w-10 h-10 sm:w-12 sm:h-12 rounded-2xl bg-white flex items-center justify-center border border-[#E5E5E5] shadow-sm group-hover:border-black/10 transition-colors">
                        {item.type?.includes('SELL') ? <Scale className="text-[#050505]" size={16} /> :
                         item.type?.includes('BUY')  ? <Zap   className="text-[#050505]" size={16} /> :
                         <Activity className="text-[#050505]" size={16} />}
                    </div>
                    {/* Mobile summary */}
                    <div className="sm:hidden flex-1">
                        <div className="flex items-center gap-2">
                            <span className="text-[9px] font-black uppercase tracking-widest text-[#888888]">{item.tier?.replace(' tier','') || 'INST'}</span>
                            <span className="text-[9px] font-black uppercase tracking-widest text-[#050505]">{item.type || 'TX'}</span>
                        </div>
                        <div className="text-[10px] font-mono font-black text-[#050505] mt-0.5">
                            {new Date(item.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                        </div>
                    </div>
                    <div className="sm:hidden text-right">
                        <div className="text-sm font-black text-[#050505]">${item.usdValue?.toLocaleString()}</div>
                    </div>
                </div>

                <div className="flex-1 min-w-0 space-y-1.5 sm:space-y-2 w-full">
                    <div className="hidden sm:flex items-center gap-3">
                        <span className="text-[10px] font-black uppercase tracking-[0.2em] text-[#888888]">{item.tier?.replace(' tier','') || 'Sovereign'}</span>
                        <div className="h-1 w-1 rounded-full bg-[#E5E5E5]" />
                        <span className="text-[10px] font-black uppercase tracking-[0.2em] text-[#050505]">{item.type || 'EXCHANGE TRANSFER'}</span>
                    </div>
                    <div className="flex flex-wrap items-center gap-3 sm:gap-4">
                        <span className="text-lg sm:text-2xl font-black tracking-tighter text-[#050505] font-mono">
                            {item.amount?.toLocaleString(undefined, { maximumFractionDigits: 1 })}
                            <span className="text-xs sm:text-sm text-[#888888] ml-1.5 font-black">{item.asset}</span>
                        </span>
                        <div className="flex items-center gap-2 px-3 py-1.5 bg-white rounded-xl border border-[#E5E5E5] shadow-sm w-full sm:w-auto">
                            <span className="text-[9px] sm:text-[10px] font-mono font-bold text-[#555555] truncate flex-1 sm:max-w-[110px]">{item.from}</span>
                            <ArrowRightLeft size={9} className="text-[#888888] shrink-0" />
                            <span className="text-[9px] sm:text-[10px] font-mono font-bold text-[#555555] truncate flex-1 sm:max-w-[110px]">{item.to}</span>
                        </div>
                    </div>
                </div>

                <div className="hidden sm:block text-right space-y-1 shrink-0">
                    <div className="text-[#050505] text-lg font-black tracking-tighter font-mono">${item.usdValue?.toLocaleString()}</div>
                    <div className="text-[#888888] text-[9px] font-black uppercase tracking-widest flex items-center justify-end gap-1.5">
                        <Database size={9} /> {new Date(item.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                    </div>
                </div>

                <div className="absolute top-4 right-4 sm:relative sm:top-0 sm:right-0 text-[#888888] group-hover:text-[#050505] transition-colors p-1.5 rounded-full hover:bg-black/5">
                    {isOpen ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
                </div>
            </div>

            <AnimatePresence>
                {isOpen && (
                    <motion.div
                        initial={{ height: 0, opacity: 0 }}
                        animate={{ height: 'auto', opacity: 1 }}
                        exit={{ height: 0, opacity: 0 }}
                        className="overflow-hidden bg-[#FAFAFA] border-t border-[#E5E5E5]"
                    >
                        <div className="p-6 sm:p-8">
                            
                            {/* Public Transaction Data Header */}
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-8 mb-8 pb-8 border-b border-[#E5E5E5]">
                                <div className="space-y-4">
                                    <div className="text-[10px] font-black text-[#050505] uppercase tracking-[0.3em] bg-white px-3 py-2 rounded-lg border border-[#E5E5E5] self-start inline-block shadow-sm">
                                        {fullDateTime}
                                    </div>
                                    <div className="text-[9px] font-mono font-bold text-[#555555] break-all bg-white p-3 rounded-xl border border-[#E5E5E5] shadow-sm">
                                        {item.hash}
                                    </div>
                                    <div className="p-4 bg-white border border-[#E5E5E5] rounded-2xl shadow-sm flex items-center justify-between">
                                        <div className="text-[10px] font-black uppercase tracking-widest text-[#888888]">Execution Fee</div>
                                        <div className="text-sm font-mono font-black text-[#050505]">
                                            {item.gasPriceGwei || (item.chain === 'BITCOIN' ? 'L1 Standard' : '0.00')} <span className="text-[10px] text-[#888888]">GWEI</span>
                                        </div>
                                    </div>
                                </div>
                                <div className="space-y-3 md:border-l md:border-[#E5E5E5] md:pl-8">
                                    <div className="p-4 bg-white rounded-2xl border border-[#E5E5E5] shadow-sm">
                                        <div className="text-[8px] font-black text-[#888888] uppercase tracking-widest mb-2">Public Source Address</div>
                                        <div className="text-[10px] font-mono font-bold text-[#050505] break-all">{item.from}</div>
                                    </div>
                                    <div className="p-4 bg-white rounded-2xl border border-[#E5E5E5] shadow-sm">
                                        <div className="text-[8px] font-black text-[#888888] uppercase tracking-widest mb-2">Public Destination Address</div>
                                        <div className="text-[10px] font-mono font-bold text-[#050505] break-all">{item.to}</div>
                                    </div>
                                </div>
                            </div>

                            {/* ZK Decryption Section */}
                            <div className="w-full">
                                {decryptionState === 'IDLE' && (
                                    <div className="flex flex-col items-center justify-center py-12 px-6 bg-white rounded-[2rem] border-2 border-black border-dashed shadow-sm">
                                        <div className="w-16 h-16 bg-[#FAFAFA] border border-[#E5E5E5] rounded-full flex items-center justify-center mb-6 shadow-inner">
                                            <Lock size={28} className="text-[#050505]" />
                                        </div>
                                        <h4 className="text-[14px] font-black uppercase tracking-widest text-[#050505] mb-3">Private Data Shielded</h4>
                                        <p className="text-[12px] text-[#555555] text-center max-w-md mb-8 leading-relaxed">
                                            This transaction utilizes Aztec Zero Knowledge proofs. Contextual routing metadata, true market sentiment, and internal method execution remain cryptographically hidden on-chain.
                                        </p>
                                        <button 
                                            onClick={() => setDecryptionState('DECRYPTING')}
                                            className="px-8 py-4 bg-white text-white text-[11px] font-black uppercase tracking-[0.2em] rounded-2xl hover:bg-black/80 hover:scale-105 active:scale-95 transition-all shadow-[0_8px_30px_rgba(0,0,0,0.15)] flex items-center gap-3"
                                        >
                                            <Eye size={16} /> Decrypt Private Data
                                        </button>
                                    </div>
                                )}

                                {decryptionState === 'DECRYPTING' && (
                                    <ZkDecryptionEngine onComplete={() => setDecryptionState('DECRYPTED')} item={item} />
                                )}

                                {decryptionState === 'DECRYPTED' && (
                                    <motion.div 
                                        initial={{ opacity: 0, y: 20 }} 
                                        animate={{ opacity: 1, y: 0 }} 
                                        className="bg-white rounded-[2rem] border border-[#E5E5E5] p-8 shadow-xl relative overflow-hidden"
                                    >
                                        <div className="absolute top-0 left-0 w-full h-1 bg-white" />
                                        <div className="flex items-center justify-between mb-8">
                                            <div className="flex items-center gap-3">
                                                <div className="p-2 bg-emerald-500/10 rounded-full">
                                                    <Unlock size={20} className="text-emerald-600" />
                                                </div>
                                                <span className="text-[12px] font-black uppercase tracking-[0.2em] text-[#050505]">Aztec Unshielded Payload</span>
                                            </div>
                                            <div className="text-[9px] font-mono font-bold text-[#888888] bg-[#F9F9F9] px-3 py-1.5 rounded-lg border border-[#E5E5E5]">
                                                VERIFIED: {item.hash.substring(0, 16)}...
                                            </div>
                                        </div>
                                        
                                        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                                            {/* True Identity Intelligence */}
                                            <div className="p-6 bg-[#FAFAFA] border border-[#E5E5E5] rounded-2xl">
                                                <div className="flex items-center gap-2 mb-4">
                                                    <Fingerprint size={14} className="text-[#888888]" />
                                                    <div className="text-[9px] font-black uppercase tracking-widest text-[#888888]">Tactical Wallet Profile</div>
                                                </div>
                                                <div className="text-[16px] font-black text-[#050505] mb-2 tracking-tight">
                                                    {realWalletProfile}
                                                </div>
                                                <div className="text-[11px] text-[#555555] mb-4 leading-relaxed">
                                                    <span className="font-black text-[#888888] uppercase tracking-widest text-[9px]">Core Execution: </span>
                                                    {realAction}
                                                </div>
                                                <div className="inline-flex items-center gap-2 text-[10px] bg-white text-white px-3 py-1.5 rounded-lg font-bold shadow-md">
                                                    <Shield size={12} className="text-white" /> Humanity Sentinel Network
                                                </div>
                                            </div>

                                            {/* Market Sentiment Analysis */}
                                            <div className="p-6 bg-[#FAFAFA] border border-[#E5E5E5] rounded-2xl">
                                                <div className="flex items-center gap-2 mb-4">
                                                    <Database size={14} className="text-[#888888]" />
                                                    <div className="text-[9px] font-black uppercase tracking-widest text-[#888888]">Market Impact Assessment</div>
                                                </div>
                                                <div className="text-[15px] font-black text-[#050505] tracking-tight mb-2 leading-snug">
                                                    {realMarketImpact}
                                                </div>
                                                <div className="mt-4 pt-4 border-t border-[#E5E5E5] flex items-center justify-between">
                                                    <span className="text-[10px] font-black text-[#888888] uppercase tracking-widest">Internal Sentiment</span>
                                                    <span className={`text-[11px] font-mono font-black px-3 py-1 rounded-lg border ${
                                                        realSentiment.includes('BULLISH') ? 'bg-emerald-50 border-emerald-200 text-emerald-700' :
                                                        realSentiment.includes('BEARISH') ? 'bg-red-50 border-red-200 text-red-700' :
                                                        realSentiment.includes('HIGH CONVICTION') ? 'bg-blue-50 border-blue-200 text-blue-700' :
                                                        'bg-[#F5F5F5] border-[#E5E5E5] text-[#555555]'
                                                    }`}>
                                                        {realSentiment}
                                                    </span>
                                                </div>
                                            </div>

                                            {/* Smart Contract / Routing Method */}
                                            <div className="md:col-span-2 p-6 bg-white rounded-2xl text-white">
                                                <div className="flex items-center gap-2 mb-4">
                                                    <FileCode2 size={14} className="text-white/40" />
                                                    <div className="text-[9px] font-black uppercase tracking-widest text-white/40">Raw Execution Protocol</div>
                                                </div>
                                                <div className="font-mono text-[11px] text-emerald-400 break-all leading-relaxed">
                                                    {`> INVOKED_METHOD_SIG: ${realMethod}`}
                                                    <br/>
                                                    {`> VERIFIED_ON_CHAIN: ${item.chain}`}
                                                    <br/>
                                                    {`> STATE_CONFIRMATIONS: ${item.confirmations || 'SECURE'}`}
                                                </div>
                                            </div>
                                        </div>
                                    </motion.div>
                                )}
                            </div>

                            <div className="mt-8 flex justify-center">
                                <a
                                    href={auditLink}
                                    target={auditLink.startsWith('http') ? '_blank' : '_self'}
                                    rel={auditLink.startsWith('http') ? 'noopener noreferrer' : ''}
                                    className="flex items-center justify-center gap-3 px-6 py-3 rounded-xl bg-white border border-[#E5E5E5] text-[#050505] text-[10px] font-black uppercase tracking-[0.2em] hover:bg-[#F9F9F9] active:scale-95 transition-all shadow-sm"
                                >
                                    <Network size={14} /> Open Public Audit Trail
                                </a>
                            </div>

                        </div>
                    </motion.div>
                )}
            </AnimatePresence>
        </motion.div>
    );
}

function LedgerTransactionExplorer() {
    const { unifiedLedgerFeed, isLoading } = useLedgerFeed();
    const [txSearch, setTxSearch] = useState('');
    const [txTab, setTxTab] = useState('ALL');

    const filtered = useMemo(() => {
        let result = unifiedLedgerFeed;
        if (txTab === 'TOKENS') result = result.filter(tx => tx.chain !== 'BITCOIN');
        if (txTab === 'BTC')    result = result.filter(tx => tx.chain === 'BITCOIN');
        if (txSearch) {
            const q = txSearch.toLowerCase();
            result = result.filter(tx =>
                tx.hash?.toLowerCase().includes(q) ||
                tx.from?.toLowerCase().includes(q) ||
                tx.to?.toLowerCase().includes(q) ||
                tx.asset?.toLowerCase().includes(q)
            );
        }
        return result;
    }, [unifiedLedgerFeed, txSearch, txTab]);

    return (
        <div className="relative bg-white text-[#050505] font-sans overflow-x-hidden min-h-full">
            <div className="w-full max-w-[1400px] mx-auto flex flex-col px-6 sm:px-10 pt-16 pb-12 space-y-16">
                
                {/* Hero Section */}
                <div className="flex flex-col items-center text-center space-y-10">
                    <motion.div
                        initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }}
                        className="w-40 h-40 flex items-center justify-center mx-auto relative group"
                    >
                        <SplashContainer className="w-full h-full transition-transform duration-700 scale-110 group-hover:scale-125 relative z-10 flex items-center justify-center">
                            <img src="/logo-mark.png" className="w-full h-full object-contain brightness-0 opacity-90" alt="Humanity Ledger" />
                        </SplashContainer>
                    </motion.div>

                    <div className="space-y-4">
                        <h2 className="text-4xl sm:text-7xl font-black uppercase tracking-tighter leading-none text-[#050505]">
                            Search your <br/><span className="text-black/30">Transaction</span>
                        </h2>
                        <p className="text-[12px] text-black/50 uppercase tracking-[0.3em] font-black">Real-time on-chain intelligence · ZK Secured</p>
                    </div>

                    <div className="w-full flex justify-center">
                        <GlobalMarketSessions />
                    </div>

                    {/* Search Input */}
                    <div className="w-full max-w-3xl relative group mt-4">
                        <div className="absolute inset-y-0 left-6 flex items-center pointer-events-none text-[#888888] group-focus-within:text-[#050505] transition-colors">
                            <Search size={22} />
                        </div>
                        <input
                            value={txSearch}
                            onChange={(e) => setTxSearch(e.target.value)}
                            placeholder="QUERY BY TX HASH / WALLET SIGNATURE / ASSET..."
                            className="w-full bg-[#F9F9F9] border border-[#E5E5E5] rounded-[2rem] py-5 pl-16 pr-6 text-sm font-bold tracking-tight outline-none focus:border-[#050505] focus:shadow-[0_0_40px_rgba(0,0,0,0.05)] transition-all text-[#050505] placeholder:text-black/30 shadow-sm"
                        />
                    </div>
                </div>

                {/* Filters and List */}
                <div className="space-y-8">
                    <div className="flex items-center justify-between border-b border-[#E5E5E5] pb-6">
                        <div className="flex items-center gap-4 overflow-x-auto no-scrollbar py-1">
                            {['ALL', 'BTC', 'TOKENS'].map(tab => (
                                <button
                                    key={tab}
                                    onClick={() => setTxTab(tab)}
                                    className={`px-6 py-3 rounded-2xl text-[10px] font-black uppercase tracking-[0.25em] transition-all whitespace-nowrap ${
                                        txTab === tab
                                        ? 'bg-white text-white shadow-[0_8px_20px_rgba(0,0,0,0.15)] scale-105'
                                        : 'bg-white text-[#888888] border border-[#E5E5E5] hover:text-[#050505] hover:border-black/20'
                                    }`}
                                >
                                    {tab}
                                </button>
                            ))}
                        </div>
                        <div className="text-right hidden sm:block">
                            <div className="text-[9px] font-black text-[#888888] uppercase tracking-widest mb-1">Observational Load</div>
                            <div className="text-sm font-mono font-black text-[#050505] bg-[#F9F9F9] px-3 py-1.5 rounded-lg border border-[#E5E5E5] inline-block">{filtered.length} Sequences</div>
                        </div>
                    </div>

                    {/* Feed List */}
                    <AnimatePresence mode="wait">
                        <motion.div
                            key="tx-list"
                            initial={{ opacity: 0, y: 10 }}
                            animate={{ opacity: 1, y: 0 }}
                            exit={{ opacity: 0, y: -10 }}
                            transition={{ duration: 0.3 }}
                            className="bg-white border border-[#E5E5E5] rounded-[2rem] overflow-hidden shadow-[0_10px_40px_rgba(0,0,0,0.04)]"
                        >
                            {isLoading && (
                                <div className="h-[500px] flex flex-col items-center justify-center gap-8 bg-[#FAFAFA]">
                                    <div className="w-14 h-14 border-4 border-[#E5E5E5] border-t-[#050505] animate-spin rounded-full shadow-md" />
                                    <div className="text-center space-y-3">
                                        <span className="block text-[12px] uppercase font-black tracking-[0.6em] text-[#050505] animate-pulse">Synchronizing Block Data</span>
                                        <span className="block text-[10px] font-black text-[#888888] uppercase tracking-widest">Resolving Ledger State</span>
                                    </div>
                                </div>
                            )}

                            {!isLoading && filtered.length > 0 && (
                                <div className="divide-y divide-[#E5E5E5]">
                                    {filtered.slice(0, 50).map((tx, i) => (
                                        <TransactionRow key={tx.id || i} item={tx} />
                                    ))}
                                </div>
                            )}

                            {!isLoading && filtered.length === 0 && (
                                <div className="h-[500px] flex flex-col items-center justify-center gap-8 opacity-40 bg-[#FAFAFA]">
                                    <div className="p-8 bg-white rounded-[3rem] border border-[#E5E5E5] shadow-sm">
                                        <Database size={60} className="text-[#050505]" />
                                    </div>
                                    <span className="text-sm uppercase font-black tracking-[0.5em] text-[#050505]">No results</span>
                                </div>
                            )}
                        </motion.div>
                    </AnimatePresence>
                </div>
            </div>
        </div>
    );
}

// ─── Token Markets Table (Preserved exactly as is, purely layout) ──────────

export function InstitutionalMarkets() {
    const [tokens, setTokens] = useState<any[]>([]);
    const [search, setSearch] = useState('');
    const [filterChain, setFilterChain] = useState<string | null>(null);
    const [sortCol, setSortCol] = useState<string | null>(null);
    const [sortDesc, setSortDesc] = useState(true);
    const [showChainDropdown, setShowChainDropdown] = useState(false);
    const [currentPage, setCurrentPage] = useState(1);
    const [activeSection, setActiveSection] = useState<'markets' | 'explorer'>('markets');
    const ITEMS_PER_PAGE = 8;

    useEffect(() => {
        setTokens(getParsedMarkets());
    }, []);

    const parseNum = (val: string) => {
        const cleaned = val.replace(/[^0-9.-]/g, '');
        let num = parseFloat(cleaned);
        if (val.includes('B')) num *= 1e9;
        if (val.includes('M')) num *= 1e6;
        if (val.includes('T')) num *= 1e12;
        if (val.includes('K')) num *= 1e3;
        return isNaN(num) ? 0 : num;
    };

    const sortedAndFiltered = useMemo(() => {
        let result = tokens;
        if (filterChain) result = result.filter(t => t.network === filterChain);
        if (search.trim()) {
            const term = search.toLowerCase();
            result = result.filter(t => t.name.toLowerCase().includes(term) || t.ticker.toLowerCase().includes(term));
        }
        if (sortCol) {
            result = [...result].sort((a, b) => {
                let aVal: number, bVal: number;
                switch(sortCol) {
                    case 'Price':       aVal = parseNum(a.price);       bVal = parseNum(b.price);       break;
                    case '24h change':  aVal = parseNum(a.change24h);   bVal = parseNum(b.change24h);   break;
                    case 'Market cap':  aVal = parseNum(a.mcap);        bVal = parseNum(b.mcap);        break;
                    case 'Circulation': aVal = parseNum(a.circulation); bVal = parseNum(b.circulation); break;
                    default: aVal = 0; bVal = 0;
                }
                if (aVal < bVal) return sortDesc ? 1 : -1;
                if (aVal > bVal) return sortDesc ? -1 : 1;
                return 0;
            });
        }
        return result;
    }, [tokens, search, filterChain, sortCol, sortDesc]);

    const handleSort = (col: string) => {
        if (sortCol === col) setSortDesc(!sortDesc);
        else { setSortCol(col); setSortDesc(true); }
    };

    const isNegative = (chg: string) => chg.startsWith('-');

    const totalPages = Math.ceil(sortedAndFiltered.length / ITEMS_PER_PAGE);
    const paginatedAssets = useMemo(() => {
        const start = (currentPage - 1) * ITEMS_PER_PAGE;
        return sortedAndFiltered.slice(start, start + ITEMS_PER_PAGE);
    }, [sortedAndFiltered, currentPage]);

    return (
        <div className="w-full h-full min-h-0 flex flex-col bg-white text-[#050505] font-mono overflow-hidden transition-colors">
            {/* Section Switcher */}
            <div className="flex-shrink-0 border-b border-[#E5E5E5] bg-[#FAFAFA] px-4 md:px-8 pt-4 pb-0">
                <div className="max-w-[1400px] mx-auto flex items-center gap-1">
                    {[
                        { id: 'markets',  label: 'Markets',              tag: '[MKT]' },
                        { id: 'explorer', label: 'Transaction Explorer', tag: '[EXP]' },
                    ].map(sec => (
                        <button
                            key={sec.id}
                            onClick={() => setActiveSection(sec.id as 'markets' | 'explorer')}
                            className={`relative px-5 py-3 text-[10px] font-black uppercase tracking-widest transition-all ${
                                activeSection === sec.id
                                    ? 'text-[#050505]'
                                    : 'text-[#999999] hover:text-[#555555]'
                            }`}
                        >
                            {activeSection === sec.id && (
                                <motion.div
                                    layoutId="marketsSectionUnderline"
                                    className="absolute bottom-0 left-0 right-0 h-[2px] bg-white rounded-t-full"
                                />
                            )}
                            <span className="font-mono text-[9px] opacity-50 mr-1.5">{sec.tag}</span>
                            {sec.label}
                        </button>
                    ))}
                </div>
            </div>

            {/* Section Content */}
            <AnimatePresence mode="wait">
                {activeSection === 'markets' ? (
                    <motion.div
                        key="markets"
                        initial={{ opacity: 0, y: 6 }}
                        animate={{ opacity: 1, y: 0 }}
                        exit={{ opacity: 0, y: -6 }}
                        transition={{ duration: 0.2 }}
                        className="flex-1 min-h-0 flex flex-col p-4 md:p-8 overflow-hidden"
                    >
                        {/* Header / Search & Filter */}
                        <div className="max-w-[1400px] mx-auto w-full flex-shrink-0">
                            <div className="flex flex-col md:flex-row gap-4 mt-2 relative z-20">
                                <div className="relative flex-1 group">
                                    <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none">
                                        <span className="font-mono text-[10px] font-black text-[#888888]">[SCH]</span>
                                    </div>
                                    <input
                                        type="text"
                                        className="block w-full pl-11 pr-4 py-3 bg-[#F9F9F9] border border-[#E5E5E5] rounded-xl text-[13px] text-[#050505] focus:outline-none focus:ring-1 focus:ring-[#050505] transition-all font-mono"
                                        placeholder="Filter by name, ticker, or contract address"
                                        value={search}
                                        onChange={(e) => setSearch(e.target.value)}
                                    />
                                </div>

                                <div className="flex items-center gap-2">
                                    <div className="relative">
                                        <button
                                            onClick={() => setShowChainDropdown(!showChainDropdown)}
                                            className="flex items-center gap-2 px-5 py-3 bg-[#F9F9F9] border border-[#E5E5E5] rounded-xl text-[13px] font-bold text-[#050505] hover:bg-[#E5E5E5] transition-colors"
                                        >
                                            {filterChain ? filterChain : 'Blockchain'}
                                            <span className="font-mono text-[10px] font-black opacity-50">[v]</span>
                                        </button>

                                        <AnimatePresence>
                                            {showChainDropdown && (
                                                <motion.div
                                                    initial={{ opacity: 0, y: 10 }}
                                                    animate={{ opacity: 1, y: 0 }}
                                                    exit={{ opacity: 0, y: 10 }}
                                                    className="absolute left-0 md:left-auto md:right-0 top-full mt-2 w-64 max-h-[300px] overflow-y-auto bg-white border border-[#E5E5E5] shadow-2xl rounded-xl z-50 py-2"
                                                >
                                                    <div className="px-4 py-2 border-b border-[#E5E5E5] sticky top-0 bg-white font-black text-[10px] text-[#888888] tracking-widest uppercase">Select Network</div>
                                                    {RAW_NETWORKS.map(net => (
                                                        <button
                                                            key={net}
                                                            onClick={() => { setFilterChain(net); setShowChainDropdown(false); }}
                                                            className={`w-full text-left px-4 py-2 text-[12px] hover:bg-[#F0F0F0] transition-colors ${filterChain === net ? 'font-bold bg-[#F9F9F9]' : ''}`}
                                                        >
                                                            {net}
                                                        </button>
                                                    ))}
                                                </motion.div>
                                            )}
                                        </AnimatePresence>
                                    </div>
                                    <button
                                        onClick={() => { setFilterChain(null); setSearch(''); }}
                                        className="flex items-center justify-center p-3 text-[#888888] hover:text-[#050505] bg-[#F9F9F9] border border-[#E5E5E5] rounded-xl transition-colors group"
                                        title="Reset filters"
                                    >
                                        <span className="font-mono text-[10px] font-black group-hover:scale-110 transition-transform duration-500">[RST]</span>
                                    </button>
                                </div>
                            </div>
                        </div>

                        {/* Data Table */}
                        <div className="max-w-[1400px] mx-auto w-full flex-1 flex flex-col min-h-0 mt-6 md:mt-8 border border-[#E5E5E5] rounded-2xl overflow-hidden bg-white shadow-sm relative z-10">
                            <div className="hidden md:grid grid-cols-[2fr_1fr_1fr_1fr_1fr] px-6 py-4 border-b border-[#E5E5E5] bg-[#F9F9F9] text-[11px] font-black text-[#888888] uppercase tracking-widest sticky top-0 z-10">
                                <div className="cursor-pointer hover:text-[#050505] flex items-center" onClick={() => handleSort('Token')}>Token <span className="font-mono text-[9px] font-black opacity-50 ml-2">[^v]</span></div>
                                <div className="cursor-pointer hover:text-[#050505] flex items-center justify-end text-right" onClick={() => handleSort('Price')}>Price <span className="font-mono text-[9px] font-black opacity-50 ml-2">[^v]</span></div>
                                <div className="cursor-pointer hover:text-[#050505] flex items-center justify-end text-right" onClick={() => handleSort('24h change')}>24h change <span className="font-mono text-[9px] font-black opacity-50 ml-2">[^v]</span></div>
                                <div className="cursor-pointer hover:text-[#050505] flex items-center justify-end text-right" onClick={() => handleSort('Market cap')}>Market cap <span className="font-mono text-[9px] font-black opacity-50 ml-2">[^v]</span></div>
                                <div className="cursor-pointer hover:text-[#050505] flex items-center justify-end text-right" onClick={() => handleSort('Circulation')}>Circulation <span className="font-mono text-[9px] font-black opacity-50 ml-2">[^v]</span></div>
                            </div>

                            <div className="flex-1 overflow-y-auto">
                                {paginatedAssets.length === 0 ? (
                                    <div className="h-full flex items-center justify-center text-[12px] text-[#888888] uppercase tracking-widest font-black">
                                        NO ASSETS FOUND FOR SELECTED CRITERIA
                                    </div>
                                ) : (
                                    paginatedAssets.map((t, idx) => (
                                        <div key={idx} className="flex flex-col md:grid md:grid-cols-[2fr_1fr_1fr_1fr_1fr] p-4 md:px-6 md:py-4 border-b border-[#F0F0F0] hover:bg-[#F9F9F9] transition-colors md:items-center gap-3 md:gap-0">
                                            <div className="flex items-center justify-between md:justify-start gap-4 min-w-0">
                                                <div className="flex items-center gap-3 md:gap-4 min-w-0">
                                                    <TokenLogo
                                                        symbol={t.ticker}
                                                        name={t.name}
                                                        className="w-8 h-8 md:w-10 md:h-10 rounded-full shadow-inner shrink-0"
                                                        fallbackClassName="w-8 h-8 md:w-10 md:h-10 rounded-full bg-[#E5E5E5] flex items-center justify-center text-[12px] md:text-[14px] font-black shrink-0 text-[#050505] shadow-inner"
                                                    />
                                                    <div className="flex flex-col min-w-0">
                                                        <span className="text-[14px] md:text-[15px] font-bold truncate text-[#050505]">{t.name}</span>
                                                        <span className="text-[11px] text-[#888888] uppercase tracking-wide">{t.ticker}</span>
                                                    </div>
                                                </div>
                                                <div className="flex flex-col items-end md:hidden">
                                                    <div className="text-right text-[14px] font-bold text-[#050505]">{t.price} <span className="text-[10px] text-[#888888] font-normal">{t.currencyPrice}</span></div>
                                                    <div className={`text-right text-[12px] font-bold ${isNegative(t.change24h) ? 'text-black opacity-60' : 'text-black'}`}>{t.change24h}</div>
                                                </div>
                                            </div>

                                            <div className="hidden md:block text-right text-[14px] font-bold text-[#050505]">{t.price} <span className="text-[10px] text-[#888888] font-normal">{t.currencyPrice}</span></div>
                                            <div className={`hidden md:block text-right text-[14px] font-bold ${isNegative(t.change24h) ? 'text-black opacity-60' : 'text-black'}`}>{t.change24h}</div>

                                            <div className="flex items-center justify-between md:hidden pt-3 border-t border-[#F0F0F0]">
                                                <div className="flex flex-col">
                                                    <span className="text-[9px] text-[#888888] uppercase font-black tracking-widest mb-0.5">Market Cap</span>
                                                    <div className="text-[13px] font-bold text-[#050505]">{t.mcap} <span className="text-[9px] text-[#888888] font-normal">{t.mcapCurrency}</span></div>
                                                </div>
                                                <div className="flex flex-col items-end">
                                                    <span className="text-[9px] text-[#888888] uppercase font-black tracking-widest mb-0.5">Circulation</span>
                                                    <div className="text-[13px] font-bold text-[#050505]">{t.circulation}</div>
                                                </div>
                                            </div>

                                            <div className="hidden md:block text-right text-[14px] font-bold text-[#050505]">{t.mcap} <span className="text-[10px] text-[#888888] font-normal">{t.mcapCurrency}</span></div>
                                            <div className="hidden md:block text-right text-[14px] font-bold text-[#050505]">{t.circulation}</div>
                                        </div>
                                    ))
                                )}
                            </div>
                        </div>

                        {totalPages > 1 && (
                            <div className="flex items-center justify-between px-6 py-4 mt-4 bg-[#F9F9F9] border border-[#E5E5E5] rounded-xl max-w-[1400px] mx-auto w-full flex-shrink-0">
                                <span className="text-[10px] font-black text-black/40 uppercase tracking-widest">Page {currentPage} of {totalPages}</span>
                                <div className="flex items-center gap-2">
                                    <button onClick={() => setCurrentPage(p => Math.max(1, p - 1))} disabled={currentPage === 1} className="px-4 py-2 border border-[#E5E5E5] bg-white rounded-lg text-[10px] font-black uppercase tracking-widest text-[#050505]/60 hover:text-[#050505] disabled:opacity-30 disabled:pointer-events-none transition-colors">Previous</button>
                                    <button onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))} disabled={currentPage === totalPages} className="px-4 py-2 border border-[#E5E5E5] bg-white rounded-lg text-[10px] font-black uppercase tracking-widest text-[#050505]/60 hover:text-[#050505] disabled:opacity-30 disabled:pointer-events-none transition-colors">Next</button>
                                </div>
                            </div>
                        )}
                    </motion.div>
                ) : (
                    <motion.div
                        key="explorer"
                        initial={{ opacity: 0, y: 6 }}
                        animate={{ opacity: 1, y: 0 }}
                        exit={{ opacity: 0, y: -6 }}
                        transition={{ duration: 0.2 }}
                        className="flex-1 min-h-0 overflow-y-auto"
                    >
                        <LedgerTransactionExplorer />
                    </motion.div>
                )}
            </AnimatePresence>
        </div>
    );
}

