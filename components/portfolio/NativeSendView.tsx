// @ts-nocheck
"use client";

import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useWalletStore, NETWORKS, NetworkId } from '@/lib/store/wallet-store';
import { ethers } from 'ethers';
import { toast } from 'sonner';
import { useAccount, useWalletClient } from 'wagmi';
import { UNIVERSAL_TOKENS, UniversalToken } from '@/config/universal-tokens';
import { encodeFunctionData } from 'viem';

const ERC20_ABI = [
  {
    "constant": false,
    "inputs": [
      { "name": "_to", "type": "address" },
      { "name": "_value", "type": "uint256" }
    ],
    "name": "transfer",
    "outputs": [{ "name": "", "type": "bool" }],
    "payable": false,
    "stateMutability": "nonpayable",
    "type": "function"
  }
];

const safeParseUnits = (val: string, decimals: number) => {
    try {
        let cleanVal = val.toLowerCase();
        if (cleanVal.includes('e')) {
            const [base, expStr] = cleanVal.split('e');
            const [lead, trail = ''] = base.split('.');
            const exp = parseInt(expStr);
            if (exp > 0) {
                if (trail.length > exp) {
                    cleanVal = lead + trail.slice(0, exp) + '.' + trail.slice(exp);
                } else {
                    cleanVal = lead + trail + '0'.repeat(exp - trail.length);
                }
            } else {
                return 0n;
            }
        }
        return ethers.parseUnits(cleanVal || "0", decimals);
    } catch {
        return 0n;
    }
};

function TokenSelector({ selectedToken, onSelect, label }: { selectedToken: UniversalToken, onSelect: (t: UniversalToken) => void, label: string }) {
    const [open, setOpen] = useState(false);
    const [search, setSearch] = useState('');

    const filtered = UNIVERSAL_TOKENS.filter(t => t.symbol.toLowerCase().includes(search.toLowerCase()) || t.name.toLowerCase().includes(search.toLowerCase())).slice(0, 100);

    const handleSelect = (t: UniversalToken) => {
        onSelect(t);
        setOpen(false);
        setSearch('');
    };

    return (
        <div className="relative">
            <button 
                onClick={() => setOpen(!open)}
                className="flex items-center gap-2 bg-black/5 hover:bg-black/10 border border-black/10 px-4 py-2 font-bold uppercase tracking-widest text-sm outline-none transition-colors rounded-sm"
            >
                {selectedToken.logoPath && <img src={selectedToken.logoPath} alt={selectedToken.symbol} className="w-5 h-5 rounded-full" />}
                {selectedToken.symbol}
                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M6 9l6 6 6-6"/></svg>
            </button>
            
            <AnimatePresence>
                {open && (
                    <>
                        <motion.div
                            initial={{ opacity: 0 }}
                            animate={{ opacity: 1 }}
                            exit={{ opacity: 0 }}
                            className="fixed inset-0 z-[998] bg-black/20 backdrop-blur-[2px]"
                            onClick={() => { setOpen(false); setSearch(''); }}
                        />
                        <motion.div
                            initial={{ opacity: 0, scale: 0.95, y: 10 }}
                            animate={{ opacity: 1, scale: 1, y: 0 }}
                            exit={{ opacity: 0, scale: 0.95, y: 10 }}
                            transition={{ type: 'spring', damping: 25, stiffness: 300 }}
                            className="fixed z-[999] bg-white border border-black/15 shadow-2xl flex flex-col overflow-hidden"
                            style={{
                                top: '50%',
                                left: '50%',
                                transform: 'translate(-50%, -50%)',
                                width: 'min(320px, calc(100vw - 32px))',
                                maxHeight: '70vh',
                                borderRadius: '16px',
                            }}
                        >
                            <div className="px-4 py-3 border-b border-black/8 flex items-center justify-between shrink-0">
                                <span className="text-[11px] font-black uppercase tracking-[0.2em] text-black/50">{label}</span>
                                <button
                                    onClick={() => { setOpen(false); setSearch(''); }}
                                    className="w-7 h-7 flex items-center justify-center rounded-full bg-black/5 hover:bg-black/10 text-black/50 hover:text-black transition-colors"
                                >
                                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><path d="M18 6L6 18M6 6l12 12"/></svg>
                                </button>
                            </div>
                            <div className="p-3 border-b border-black/8 shrink-0">
                                <input 
                                    type="text" 
                                    placeholder="Search 500+ tokens..." 
                                    value={search}
                                    onChange={e => setSearch(e.target.value)}
                                    className="w-full bg-black/[0.04] px-3 py-2.5 text-[12px] font-mono tracking-widest outline-none focus:bg-black/[0.07] transition-colors rounded-sm"
                                    autoFocus
                                />
                            </div>
                            <div className="overflow-y-auto flex-1 p-2 space-y-0.5">
                                {filtered.map(t => (
                                    <button key={t.symbol} onClick={() => handleSelect(t)} className="w-full flex items-center gap-3 px-3 py-2.5 hover:bg-black/5 active:bg-black/10 transition-colors text-left rounded-sm">
                                        <img src={t.logoPath} alt={t.symbol} className="w-7 h-7 rounded-full shrink-0" />
                                        <div className="flex flex-col min-w-0">
                                            <span className="text-[12px] font-black tracking-widest uppercase">{t.symbol}</span>
                                            <span className="text-[10px] text-black/40 truncate">{t.name}</span>
                                        </div>
                                    </button>
                                ))}
                                {filtered.length === 0 && <div className="p-6 text-center text-[11px] uppercase text-black/40 font-bold tracking-widest">No tokens found</div>}
                            </div>
                        </motion.div>
                    </>
                )}
            </AnimatePresence>
        </div>
    );
}

export function NativeSendView({ onBack, initialTokenSymbol }: { onBack: () => void, initialTokenSymbol?: string }) {
    const activeNetwork = useWalletStore(s => s.activeNetwork);
    const privateKey = useWalletStore(s => s.privateKey);
    const systemAddress = useWalletStore(s => s.address);
    
    const { activeAddress, isWagmiConnected, walletClient, networkInfo } = useNativeWallet();
    const { balance, seed, aztecAddress, refresh } = useAztecNative();

    // ZK Stealth Mode State
    const [isStealth, setIsStealth] = useState(false);
    
    const isSystemWallet = !!privateKey && !!systemAddress;
    
    const [recipient, setRecipient] = useState('');
    const [amount, setAmount] = useState('');

    const defaultToken = initialTokenSymbol 
        ? UNIVERSAL_TOKENS.find(t => t.symbol === initialTokenSymbol) 
          || UNIVERSAL_TOKENS[0]
        : UNIVERSAL_TOKENS.find(t => t.symbol==='ETH') || UNIVERSAL_TOKENS[0];

    const [selectedToken, setSelectedToken] = useState<UniversalToken>(defaultToken as UniversalToken);
    
    const [isSending, setIsSending] = useState(false);
    const [isEstimating, setIsEstimating] = useState(false);
    const [gasFee, setGasFee] = useState('0.00');
    const [useMultiSig, setUseMultiSig] = useState(false);

    useEffect(() => {
        const estimateGas = async () => {
            if (!amount || parseFloat(amount) <= 0 || !recipient) {
                setGasFee('0.00');
                return;
            }

            if (selectedToken.symbol === 'QDs') {
                setGasFee(isStealth ? 'aztec-shielded' : 'aztec-gasless');
                setIsEstimating(false);
                return;
            }

            if (!ethers.isAddress(recipient)) {
                setGasFee('0.00');
                return;
            }

            setIsEstimating(true);
            try {
                const provider = new ethers.JsonRpcProvider(networkInfo.rpc);
                const feeData = await provider.getFeeData();
                const gasPrice = feeData.gasPrice || ethers.parseUnits('1', 'gwei');
                
                let gasLimit = 21000n; // default native transfer
                if (selectedToken.symbol !== 'ETH' && selectedToken.address && selectedToken.address !== 'native') {
                    gasLimit = 65000n; // default ERC20 transfer
                }
                
                const costInWei = gasLimit * gasPrice;
                setGasFee(ethers.formatEther(costInWei));
            } catch (e) {
                console.error(e);
            } finally {
                setIsEstimating(false);
            }
        };

        const t = setTimeout(estimateGas, 500);
        return () => clearTimeout(t);
    }, [amount, recipient, selectedToken, networkInfo.rpc, isStealth]);

    const executeSend = async () => {
        if (!amount || parseFloat(amount) <= 0) {
            toast.error("Invalid Amount", { description: "Please enter an amount greater than 0." });
            return;
        }

        if (selectedToken.symbol !== 'QDs' && !ethers.isAddress(recipient)) {
            toast.error("Invalid Recipient", { description: "Please enter a valid EVM address." });
            return;
        }

        if (useMultiSig) {
            toast.loading("Multi-Sig Send Initiated", { description: "Transaction pushed to Safe{Wallet} for signatures." });
            return;
        }

        if (!activeAddress) {
            toast.error("Wallet Not Connected", { description: "Please connect a wallet first." });
            return;
        }

        setIsSending(true);
        toast.loading(`Initiating ${selectedToken.symbol} Transfer...`, { id: "send-tx" });

        try {
            const parsedAmount = safeParseUnits(amount, selectedToken.decimals || 18);
            
            let txHash = "";
            const isNative = selectedToken.symbol === 'ETH' || selectedToken.address === 'native' || selectedToken.address === '0x0000000000000000000000000000000000000000';

            if (selectedToken.symbol === 'QDs') {
                let finalRecipient = recipient.trim();
                if (ethers.isAddress(finalRecipient)) {
                    const rHex = finalRecipient.replace('0x', '').toLowerCase();
                    finalRecipient = `0x${rHex.padStart(64, '0').slice(0, 64)}`;
                }
                if (!/^0x[0-9a-f]{64}$/i.test(finalRecipient)) {
                    throw new Error('Invalid recipient — enter an Aztec address (0x + 64 hex chars) or an EVM address.');
                }
                if (!aztecAddress) {
                    throw new Error('Sovereign Identity not initialized. Please connect your wallet to Aztec first.');
                }

                const res = await fetch('/api/aztec/transfer', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        from: aztecAddress,
                        to: finalRecipient,
                        amount: amount,
                        reason: isStealth ? 'Shielded ZK Transfer' : 'Public QD Transfer'
                    })
                });

                const data = await res.json();
                if (!res.ok) throw new Error(data.error || 'Aztec transfer failed');

                txHash = data.txHash;
                toast.success(isStealth ? 'Shielded Transfer Executed' : 'Aztec Transfer Executed', {
                    id: "send-tx",
                    description: `Successfully routed ${amount} QDs to recipient.`,
                });
                
                await refresh();
                setTimeout(() => onBack(), 2000);
                return;
            } else {
                toast.error("MiCA Compliance Lock", { 
                    id: "send-tx",
                    description: "Standard EVM asset routing is administratively disabled pending MiCA clearance. Use Aztec ZK QDs for unhindered operations." 
                });
                setIsSending(false);
                return;
            }
        } catch (e: any) {
            const cleanError = e?.shortMessage || e?.message?.split('\n')[0] || "Transaction cancelled or failed.";
            toast.error("Send Failed", { id: "send-tx", description: cleanError });
        } finally {
            setIsSending(false);
        }
    };

    return (
        <motion.div
            initial={{ opacity: 0, x: -40 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: -40 }}
            transition={{ type: 'spring', damping: 28, stiffness: 260 }}
            className="flex flex-col w-full min-h-screen font-sans overflow-x-hidden"
        >
             <div className={`w-full max-w-md mx-auto h-full flex flex-col bg-white relative overflow-hidden transition-colors duration-700 ${isStealth ? 'bg-zinc-950' : ''}`}>
            
            <AnimatePresence>
                {isStealth && (
                    <motion.div 
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        exit={{ opacity: 0 }}
                        className="absolute inset-0 pointer-events-none z-0"
                    >
                        <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top,_var(--tw-gradient-stops))] from-emerald-900/20 via-zinc-950 to-zinc-950" />
                        <div className="absolute top-0 left-0 right-0 h-px bg-gradient-to-r from-transparent via-emerald-500/50 to-transparent" />
                        <div className="absolute inset-0 opacity-[0.03] flex flex-wrap content-start overflow-hidden text-[8px] font-mono text-emerald-500 leading-none break-all select-none">
                            {Array.from({length: 100}).map((_, i) => (
                                <span key={i}>0x{((i * 0x45d9f3b + 0x119) >>> 0).toString(16).padStart(8, '0')} </span>
                            ))}
                        </div>
                    </motion.div>
                )}
            </AnimatePresence>

            <div className={`flex items-center justify-between p-4 border-b shrink-0 relative z-10 transition-colors ${isStealth ? 'border-emerald-900/30' : 'border-black/5'}`}>
                <div className="flex items-center gap-4">
                    <button onClick={onBack} className={`w-10 h-10 flex items-center justify-center bg-black/5 hover:bg-black/10 rounded-full transition-colors ${isStealth ? 'text-zinc-400 bg-white/5 hover:bg-white/10 hover:text-white' : ''}`}>
                        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M19 12H5M12 19l-7-7 7-7"/></svg>
                    </button>
                    <h2 className={`text-xl font-black tracking-tighter ${isStealth ? 'text-white' : ''}`}>SEND</h2>
                </div>

                <div className="flex items-center gap-2">
                    <span className={`text-[10px] font-bold uppercase tracking-widest transition-colors ${isStealth ? 'text-emerald-400' : 'text-black/40'}`}>ZK STEALTH</span>
                    <button 
                        onClick={() => {
                            if (selectedToken.symbol !== 'QDs') {
                                toast.error('Stealth Mode Unavailable', { description: 'Only Aztec-native QDs support Zero-Knowledge Stealth Transfers.'});
                                return;
                            }
                            setIsStealth(!isStealth);
                        }}
                        className={`w-12 h-6 rounded-full p-1 transition-all duration-300 relative flex items-center ${isStealth ? 'bg-emerald-500/20 shadow-[0_0_15px_rgba(16,185,129,0.3)]' : 'bg-black/10'}`}
                    >
                        <motion.div 
                            className={`w-4 h-4 rounded-full shadow-sm flex items-center justify-center ${isStealth ? 'bg-emerald-400' : 'bg-white'}`}
                            animate={{ x: isStealth ? 24 : 0 }}
                            transition={{ type: "spring", stiffness: 500, damping: 30 }}
                        >
                            {isStealth && <div className="w-1.5 h-1.5 bg-emerald-900 rounded-full" />}
                        </motion.div>
                    </button>
                </div>
            </div>

            <div className="flex-1 overflow-y-auto p-4 space-y-6 relative z-10">
                <div className="space-y-3">
                    <label className={`text-[11px] font-black tracking-[0.2em] uppercase ${isStealth ? 'text-emerald-500/70' : 'text-black/50'}`}>
                        Recipient Address {selectedToken.symbol === 'QDs' ? '(Aztec ZK Address)' : ''}
                    </label>
                    <div className="relative">
                        <input
                            type="text"
                            value={recipient}
                            onChange={e => setRecipient(e.target.value)}
                            placeholder="0x..."
                            className={`w-full h-14 pl-4 pr-12 rounded-xl text-sm font-mono outline-none transition-all ${
                                isStealth 
                                ? 'bg-zinc-900/50 border border-emerald-900/30 text-emerald-400 placeholder-emerald-900/50 focus:border-emerald-500/50 focus:bg-zinc-900' 
                                : 'bg-black/5 border border-transparent focus:border-black/10 focus:bg-white'
                            }`}
                        />
                    </div>
                </div>

                <div className="space-y-3">
                    <div className="flex justify-between items-center">
                        <label className={`text-[11px] font-black tracking-[0.2em] uppercase ${isStealth ? 'text-emerald-500/70' : 'text-black/50'}`}>Amount</label>
                        <span className={`text-[11px] font-medium font-mono ${isStealth ? 'text-emerald-500/50' : 'text-black/40'}`}>
                            Balance: {selectedToken.symbol === 'QDs' ? balance.toLocaleString() : '0.00'}
                        </span>
                    </div>
                    <div className="flex gap-2">
                        <div className="flex-1 relative">
                            <input
                                type={isStealth ? "password" : "text"}
                                value={amount}
                                onChange={e => {
                                    if (!/^\d*\.?\d*$/.test(e.target.value)) return;
                                    setAmount(e.target.value);
                                }}
                                placeholder="0.00"
                                className={`w-full h-14 pl-4 pr-4 rounded-xl text-lg font-mono outline-none transition-all ${
                                    isStealth 
                                    ? 'bg-zinc-900/50 border border-emerald-900/30 text-emerald-400 placeholder-emerald-900/50 focus:border-emerald-500/50 focus:bg-zinc-900' 
                                    : 'bg-black/5 border border-transparent focus:border-black/10 focus:bg-white'
                                }`}
                            />
                        </div>
                        <TokenSelector 
                            selectedToken={selectedToken} 
                            onSelect={(t) => {
                                setSelectedToken(t);
                                if (t.symbol !== 'QDs' && isStealth) {
                                    setIsStealth(false);
                                    toast.info("Stealth Mode Disabled", { description: "Stealth mode is only available for Aztec-native assets like QDs."});
                                }
                            }} 
                            label="Pay With" 
                        />
                    </div>
                </div>
            </div>

            <div className={`p-4 border-t shrink-0 relative z-10 transition-colors ${isStealth ? 'border-emerald-900/30 bg-zinc-950' : 'border-black/5'}`}>
                <div className="flex justify-between items-center mb-4">
                    <span className={`text-xs ${isStealth ? 'text-emerald-500/50' : 'text-black/40'}`}>Network Fee</span>
                    <div className="flex items-center gap-2">
                        {isEstimating ? (
                            <span className="w-4 h-4 rounded-full border-2 border-black/10 border-t-black animate-spin" />
                        ) : (
                            <span className={`font-mono text-sm ${isStealth ? 'text-emerald-400' : ''}`}>{gasFee} {selectedToken.symbol === 'QDs' ? '' : 'ETH'}</span>
                        )}
                        {gasFee === 'aztec-gasless' && !isStealth && <span className="text-[9px] bg-black text-white px-1.5 py-0.5 rounded-sm font-bold uppercase tracking-wider">SPONSORED</span>}
                        {isStealth && <span className="text-[9px] bg-emerald-900 text-emerald-100 px-1.5 py-0.5 rounded-sm font-bold uppercase tracking-wider shadow-[0_0_10px_rgba(16,185,129,0.5)]">SHIELDED</span>}
                    </div>
                </div>

                <button
                    onClick={executeSend}
                    disabled={isSending || !amount || !recipient}
                    className={`w-full h-14 flex items-center justify-center gap-2 text-sm font-black tracking-widest uppercase transition-all
                        ${isSending || !amount || !recipient ? 'opacity-50 cursor-not-allowed' : 'hover:scale-[0.99] active:scale-95'}
                        ${isStealth ? 'bg-emerald-600 hover:bg-emerald-500 text-white shadow-[0_0_20px_rgba(16,185,129,0.3)]' : 'bg-black text-white rounded-xl'}`}
                    style={isStealth ? { borderRadius: '8px', border: '1px solid rgba(16,185,129,0.5)' } : {}}
                >
                    {isSending ? (
                        <>
                            <span className={`w-4 h-4 rounded-full border-2 ${isStealth ? 'border-white/20 border-t-white' : 'border-white/20 border-t-white'} animate-spin`} />
                            {isStealth ? 'GENERATING ZK PROOF...' : 'SENDING...'}
                        </>
                    ) : (
                        <>
                            {isStealth ? 'EXECUTE STEALTH TRANSFER' : 'CONFIRM SEND'}
                        </>
                    )}
                </button>
            </div>
        </div>
        </motion.div>
    );
}

