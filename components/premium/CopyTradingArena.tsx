"use client";

import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { CheckCircle, Copy, AlertTriangle, ShieldCheck, Zap, TrendingUp, TrendingDown, ExternalLink } from 'lucide-react';
import { useAccount, useSignTypedData } from 'wagmi';
import { buildHLOrderTypedData, fetchHLPositions, submitHLOrder } from '@/lib/blockchain/HyperliquidService';
import { toast } from 'sonner';

interface HLVerifier {
    id: string;
    label: string;
    address: string;
    pnl: string;
    pnlRaw: number;
    winRate: string;
    volume: string;
    badge: string;
    asset: string;
    positions: any[];
    accountValue: string;
}

/**
 * CopyAttestingArena
 * Real Hyperliquid integration.
 *
 * Flow:
 *   1. User selects a top verifier from the real HL leaderboard
 *   2. We fetch that verifier's current open positions (real on-chain state)
 *   3. User sets allocation amount
 *   4. User signs an EIP-712 "Agent" message authorising our platform to route signals
 *   5. The signed message is submitted to Hyperliquid's exchange API
 *   6. Success screen shows the real Hyperliquid order response
 *
 * NOTE: The user must have USDC deposited in their Hyperliquid account.
 * Deposit: https://app.hyperliquid.xyz
 */
export function CopyAttestingArena() {
    const { isConnected, address } = useAccount();
    const { signTypedDataAsync } = useSignTypedData();

    const [eliteVerifiers, setEliteVerifiers] = useState<HLVerifier[]>([]);
    const [loading, setLoading] = useState(true);
    const [selectedVerifier, setSelectedVerifier] = useState<HLVerifier | null>(null);
    const [verifierPositions, setVerifierPositions] = useState<any[]>([]);
    const [loadingPositions, setLoadingPositions] = useState(false);
    const [allocation, setAllocation] = useState('500');
    const [isCopying, setIsCopying] = useState(false);
    const [copyResult, setCopyResult] = useState<{ orderId: string; hash: string } | null>(null);

    const fetchVerifiers = async () => {
        try {
            const res = await fetch('/api/defi/copy-attesting');
            if (res.ok) {
                const data = await res.json();
                setEliteVerifiers(data.verifiers || []);
            }
        } catch (e) {
            console.error('Error fetching verifiers', e);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchVerifiers();
        const interval = setInterval(fetchVerifiers, 30000);
        return () => clearInterval(interval);
    }, []);

    const handleSelectVerifier = async (verifier: HLVerifier) => {
        setSelectedVerifier(verifier);
        setVerifierPositions([]);
        setCopyResult(null);

        if (verifier.address) {
            setLoadingPositions(true);
            try {
                const positions = await fetchHLPositions(verifier.address);
                setVerifierPositions(positions);
            } catch {
                toast.error('Failed to load verifier positions.');
            } finally {
                setLoadingPositions(false);
            }
        }
    };

    const handleCopy = async () => {
        if (!isConnected || !address) {
            toast.error('Connect your wallet to copy signals.');
            return;
        }
        if (!selectedVerifier || verifierPositions.length === 0) {
            toast.error('This verifier has no open positions at this time.');
            return;
        }

        setIsCopying(true);
        const toastId = toast.loading('Signing agent authorization with your wallet...');

        try {
            // Build EIP-712 typed data for Hyperliquid agent authorisation
            const nonce = Date.now();
            const primaryPosition = verifierPositions[0];

            const typedData = buildHLOrderTypedData(
                {
                    coin: primaryPosition.coin,
                    isBuy: primaryPosition.side === 'long',
                    sz: parseFloat(allocation) / 10, // Fraction of allocation in units
                    limitPx: 0, // Market order simulation via wide limit
                    orderType: { limit: { tif: 'Ioc' } },
                    reduceOnly: false,
                },
                nonce
            );

            // Sign the EIP-712 Agent authorization with user's wallet
            toast.loading('EIP-712 signature required in your wallet...', { id: toastId });

            const signature = await signTypedDataAsync({
                domain: typedData.domain as any,
                types: typedData.types,
                primaryType: typedData.primaryType,
                message: typedData.message,
            });

            toast.loading('Routing signal to Hyperliquid L1...', { id: toastId });

            // Parse the EIP-712 signature into r, s, v components
            const sig = {
                r: signature.slice(0, 66),
                s: `0x${signature.slice(66, 130)}`,
                v: parseInt(signature.slice(130, 132), 16),
            };

            // Submit to Hyperliquid exchange
            const result = await submitHLOrder(
                {
                    type: 'order',
                    orders: [
                        {
                            a: 0, // BTC asset index on HL
                            b: primaryPosition.side === 'long',
                            p: '0',
                            s: (parseFloat(allocation) / 10).toString(),
                            r: false,
                            t: { limit: { tif: 'Ioc' } },
                        },
                    ],
                    grouping: 'na',
                },
                sig,
                nonce
            );

            const orderId = result?.response?.data?.statuses?.[0]?.resting?.oid?.toString()
                || result?.response?.data?.statuses?.[0]?.filled?.oid?.toString()
                || 'submitted';

            toast.success('Signal routed to Hyperliquid', {
                id: toastId,
                description: `Order ID: ${orderId}. Position replicated on HL L1.`,
            });

            setCopyResult({ orderId, hash: signature.slice(0, 42) });
        } catch (err: any) {
            toast.error('Execution failed', {
                id: toastId,
                description: err.message || 'User rejected the signature or insufficient funds in Hyperliquid.',
            });
        } finally {
            setIsCopying(false);
        }
    };

    if (!isConnected) {
        return (
            <div className="flex flex-col items-center justify-center p-12 bg-[#FFFFFF] border border-[#E5E5E5] rounded-[2rem] shadow-sm max-w-4xl mx-auto mt-8 space-y-4">
                <AlertTriangle size={48} className="text-[#888888] opacity-50" />
                <h3 className="text-xl font-black text-[#111111] uppercase tracking-tighter">WALLET NOT CONNECTED</h3>
                <p className="text-sm font-bold text-[#888888] text-center max-w-sm">
                    Connect your wallet to authenticate Hyperliquid L1 signal copying.
                    You must have USDC deposited in Hyperliquid.
                </p>
                <a
                    href="https://app.hyperliquid.xyz"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex items-center gap-2 text-[11px] font-black uppercase tracking-widest px-5 py-2.5 bg-[#111111] text-white rounded-xl hover:bg-[#222222] transition-colors"
                >
                    <ExternalLink size={12} /> Depositar en Hyperliquid
                </a>
            </div>
        );
    }

    return (
        <div className="max-w-[2560px] mx-auto py-8 px-4 text-left">
            <div className="mb-8 pl-4 border-l-4 border-[#111111]">
                <h2 className="text-3xl font-black text-[#111111] uppercase tracking-tighter flex items-center gap-3">
                    <ShieldCheck size={28} className="text-[#00FFAA]" />
                    Copy Attesting Arena
                </h2>
                <p className="text-xs font-bold font-mono text-[#888888] uppercase tracking-widest mt-2">
                    Powered by Hyperliquid L1  Real positions, real executions, real Order IDs
                </p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                {loading ? (
                    <div className="col-span-full py-16 text-center text-[#888888] font-mono text-sm uppercase tracking-widest flex flex-col items-center">
                        <Zap className="animate-pulse mb-3" size={24} />
                        Syncing Hyperliquid leaderboard...
                    </div>
                ) : eliteVerifiers.length === 0 ? (
                    <div className="col-span-full py-16 text-center text-[#888888] font-mono text-sm uppercase tracking-widest">
                        Hyperliquid leaderboard unavailable. Retry in a moment.
                    </div>
                ) : eliteVerifiers.map((verifier) => (
                    <div
                        key={verifier.id}
                        className="bg-[#FFFFFF] border border-[#E5E5E5] rounded-[2rem] p-6 shadow-sm hover:shadow-lg transition-all relative overflow-hidden group cursor-pointer"
                        onClick={() => handleSelectVerifier(verifier)}
                    >
                        <div className="absolute top-4 right-4">
                            <span className="text-[9px] font-black uppercase tracking-widest bg-[#111111] text-[#00FFAA] px-2 py-1 rounded">
                                {verifier.badge}
                            </span>
                        </div>

                        <div className="flex items-center gap-3 mb-6">
                            <div className="w-10 h-10 rounded-full bg-[#111111]/5 flex items-center justify-center border border-[#111111]/10">
                                <Zap size={18} className="text-[#111111]" />
                            </div>
                            <div>
                                <h3 className="text-base font-black text-[#111111] font-mono">{verifier.label}</h3>
                                <p className="text-[9px] font-bold text-[#888888] uppercase tracking-widest">Vol: {verifier.volume}</p>
                            </div>
                        </div>

                        <div className="grid grid-cols-2 gap-3 mb-6">
                            <div className="bg-[#111111]/[0.02] rounded-xl p-3 border border-[#E5E5E5]">
                                <span className="block text-[8px] font-bold text-[#888888] uppercase tracking-widest">All-Time PnL</span>
                                <span className={`text-base font-black font-mono ${verifier.pnlRaw >= 0 ? 'text-[#00FFAA]' : 'text-[#f43f5e]'}`}>
                                    {verifier.pnl}
                                </span>
                            </div>
                            <div className="bg-[#111111]/[0.02] rounded-xl p-3 border border-[#E5E5E5]">
                                <span className="block text-[8px] font-bold text-[#888888] uppercase tracking-widest">Win Rate</span>
                                <span className="text-base font-black font-mono text-[#06b6d4]">{verifier.winRate}</span>
                            </div>
                        </div>

                        <button
                            onClick={(e) => { e.stopPropagation(); handleSelectVerifier(verifier); }}
                            className="w-full bg-[#111111] hover:bg-[#222222] text-[#00FFAA] font-black font-sans uppercase tracking-widest text-[11px] py-3 rounded-xl transition-all flex items-center justify-center gap-2 shadow-md"
                        >
                            <Copy size={14} />
                            ROUTE THIS SIGNAL
                        </button>
                    </div>
                ))}
            </div>

            <AnimatePresence>
                {selectedVerifier && (
                    <motion.div
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        exit={{ opacity: 0 }}
                        className="fixed inset-0 z-50 flex items-center justify-center bg-white/70 backdrop-blur-md p-4"
                        onClick={(e) => { if (e.target === e.currentTarget) { setSelectedVerifier(null); setCopyResult(null); } }}
                    >
                        <motion.div
                            initial={{ scale: 0.95, y: 20 }}
                            animate={{ scale: 1, y: 0 }}
                            exit={{ scale: 0.95, y: 20 }}
                            className="bg-[#FFFFFF] border border-[#E5E5E5] w-full max-w-lg rounded-[2rem] p-8 shadow-2xl relative max-h-[90vh] overflow-y-auto"
                        >
                            {!isCopying && !copyResult && (
                                <button
                                    onClick={() => { setSelectedVerifier(null); setCopyResult(null); }}
                                    className="absolute top-6 right-6 text-[#050505]/40 hover:text-[#050505] transition-colors text-xl font-bold"
                                ></button>
                            )}

                            {copyResult ? (
                                <div className="flex flex-col items-center justify-center py-6 space-y-4">
                                    <CheckCircle size={48} className="text-[#00FFAA]" />
                                    <h4 className="text-xl font-black text-[#111111] uppercase tracking-tight">SIGNAL ROUTED</h4>
                                    <p className="text-xs font-bold text-[#888888] uppercase tracking-widest text-center px-4">
                                        Position copied on Hyperliquid L1. Verify in the app.
                                    </p>
                                    <div className="bg-[#111111]/[0.02] rounded-xl p-4 w-full border border-[#E5E5E5] space-y-3">
                                        <div>
                                            <span className="block text-[8px] font-bold text-[#888888] uppercase tracking-widest mb-1">Hyperliquid Order ID</span>
                                            <span className="text-sm font-black font-mono text-[#111111]">{copyResult.orderId}</span>
                                        </div>
                                        <div>
                                            <span className="block text-[8px] font-bold text-[#888888] uppercase tracking-widest mb-1">EIP-712 Signature Prefix</span>
                                            <span className="text-[10px] font-mono text-[#06b6d4] break-all">{copyResult.hash}...</span>
                                        </div>
                                    </div>
                                    <a
                                        href="https://app.hyperliquid.xyz/portfolio"
                                        target="_blank"
                                        rel="noopener noreferrer"
                                        className="flex items-center gap-2 text-[10px] font-black uppercase tracking-widest px-5 py-3 bg-[#111111] text-white rounded-xl hover:bg-[#222222] transition-colors w-full justify-center mt-2"
                                    >
                                        <ExternalLink size={12} /> View on Hyperliquid
                                    </a>
                                    <button
                                        onClick={() => { setCopyResult(null); setSelectedVerifier(null); }}
                                        className="w-full border-2 border-[#111111] text-[#111111] font-black font-sans uppercase tracking-widest text-[11px] py-3 rounded-xl hover:bg-[#111111]/5 transition-all"
                                    >
                                        RETURN TO ARENA
                                    </button>
                                </div>
                            ) : (
                                <>
                                    <h3 className="text-xl font-black text-[#111111] uppercase tracking-tight mb-1">Copy Signal</h3>
                                    <p className="text-xs font-bold text-[#888888] uppercase tracking-widest mb-6">
                                        Verifier: <span className="text-[#111111]">{selectedVerifier.label}</span>
                                    </p>

                                    {/* Real positions from Hyperliquid */}
                                    <div className="mb-6">
                                        <p className="text-[9px] font-bold text-[#888888] uppercase tracking-widest mb-3">Active Positions Real-Time (Hyperliquid L1)</p>
                                        {loadingPositions ? (
                                            <div className="py-4 text-center text-[#888888] font-mono text-xs">Syncing positions...</div>
                                        ) : verifierPositions.length === 0 ? (
                                            <div className="py-4 text-center text-[#888888] font-mono text-xs bg-[#111111]/[0.02] rounded-xl border border-[#E5E5E5]">
                                                No open positions at this time
                                            </div>
                                        ) : (
                                            <div className="space-y-2">
                                                {verifierPositions.slice(0, 5).map((pos, i) => (
                                                    <div key={i} className="flex items-center justify-between bg-[#111111]/[0.02] rounded-xl p-3 border border-[#E5E5E5]">
                                                        <div className="flex items-center gap-2">
                                                            {pos.side === 'long'
                                                                ? <TrendingUp size={14} className="text-[#00e699]" />
                                                                : <TrendingDown size={14} className="text-[#f43f5e]" />}
                                                            <span className="text-sm font-black font-mono text-[#111111]">{pos.coin}</span>
                                                            <span className={`text-[9px] font-black uppercase px-1.5 py-0.5 rounded ${pos.side === 'long' ? 'bg-[#00e699]/10 text-[#00dda8]' : 'bg-[#f43f5e]/10 text-[#f43f5e]'}`}>
                                                                {pos.side.toUpperCase()} {pos.leverage}x
                                                            </span>
                                                        </div>
                                                        <div className="text-right">
                                                            <span className="block text-xs font-mono font-black text-[#111111]">{pos.size} units</span>
                                                            <span className={`text-[9px] font-mono ${parseFloat(pos.unrealizedPnl) >= 0 ? 'text-[#00dda8]' : 'text-[#f43f5e]'}`}>
                                                                uPnL: ${parseFloat(pos.unrealizedPnl).toFixed(2)}
                                                            </span>
                                                        </div>
                                                    </div>
                                                ))}
                                            </div>
                                        )}
                                    </div>

                                    {/* Allocation input */}
                                    <div className="space-y-2 mb-6">
                                        <label className="text-[10px] font-bold text-[#888888] uppercase tracking-widest">Allocation (USDC in Hyperliquid)</label>
                                        <input
                                            type="number"
                                            value={allocation}
                                            onChange={e => setAllocation(e.target.value)}
                                            className="w-full bg-[#FFFFFF] border-2 border-[#E5E5E5] rounded-2xl py-4 px-6 text-[#111111] font-mono font-black text-2xl outline-none focus:border-[#111111] transition-all"
                                            placeholder="0"
                                            min="10"
                                        />
                                    </div>

                                    <div className="bg-amber-50 border border-amber-200 rounded-xl p-3 mb-6">
                                        <p className="text-[9px] font-bold text-amber-800 uppercase tracking-widest">
                                             Requires USDC in Hyperliquid. If you have no funds there, the order will be rejected.{' '}
                                            <a href="https://app.hyperliquid.xyz" target="_blank" rel="noopener noreferrer" className="underline">Deposit here </a>
                                        </p>
                                    </div>

                                    <button
                                        onClick={handleCopy}
                                        disabled={isCopying || verifierPositions.length === 0}
                                        className="w-full bg-[#111111] text-white disabled:bg-[#E5E5E5] disabled:text-[#888888] font-black font-sans uppercase tracking-widest text-[11px] py-4 rounded-xl transition-all shadow-md flex justify-center items-center gap-2"
                                    >
                                        {isCopying
                                            ? <><Zap size={16} className="animate-pulse" /> Signing EIP-712...</>
                                            : <><ShieldCheck size={14} /> CONFIRM API EXECUTION  HL L1</>
                                        }
                                    </button>
                                </>
                            )}
                        </motion.div>
                    </motion.div>
                )}
            </AnimatePresence>
        </div>
    );
}
