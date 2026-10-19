"use client";

import { useState, useEffect } from "react";
// No Clerk dependency  wallet identity comes from SIWE wagmi
import { useAccount, useBalance, useDisconnect } from "wagmi";
import { useTokenBalance } from "@/hooks/useTokenBalance";
import { 
    Copy, ArrowDown, ArrowUp, RefreshCw, ExternalLink, 
    MoreVertical, LogOut, Shield, Key, Eye, EyeOff, Lock,
    Check, ChevronRight, Settings, Info, Wallet, TrendingUp, TrendingDown, DollarSign
} from "lucide-react";
import { toast } from "sonner";
import { decryptWithPassword } from "@/lib/wallet-security";
import ReceiveModal from "./ReceiveModal";
import SendModal from "./SendModal";
import SwapModal from "./SwapModal";
import { motion, AnimatePresence } from "framer-motion";
import { getAddress } from "ethers";
import { formatEther } from 'viem';
import useSWR from 'swr';

const fetcher = (url: string) => fetch(url).then((res) => res.json());

// [REMOVED] Unused Transaction interface to sanitize code for production


// [PRODUCTION FIX] Multi-chain token addresses instead of hardcoded Polygon only
const TOKEN_ADDRESSES: Record<number, { USDC: string }> = {
    1: { USDC: '0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48' }, // Ethereum
    137: { USDC: '0x2791Bca1f2de4661ED88A30C99A7a9449Aa84174' }, // Polygon USDC.e
    8453: { USDC: '0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913' } // Base
};

export default function MetaMaskWalletView() {
    const { address: externalAddress } = useAccount();
    const { disconnect } = useDisconnect();

    // SIWE-native: active address is always the connected wagmi wallet
    const [useInternal, setUseInternal] = useState(false);
    const activeAddress = externalAddress ? getAddress(externalAddress) : null;

    // Real Native Balance (POL/MATIC)
    const { data: nativeBalance, refetch: refetchBalance } = useBalance({ 
        address: activeAddress as `0x${string}` 
    });

    // Real USDC Balance - using chain-aware address (defaulting to Polygon for this view)
    const chainId = 137; // Polygon - this component is Polygon-specific
    const USDC_ADDRESS = TOKEN_ADDRESSES[chainId]?.USDC as `0x${string}`;
    const { formatted: usdcBalance } = useTokenBalance(USDC_ADDRESS);

    const [activeTab, setActiveTab] = useState<"assets" | "activity">("assets");
    const [isReceiveOpen, setIsReceiveOpen] = useState(false);
    const [isSendOpen, setIsSendOpen] = useState(false);
    const [isSwapOpen, setIsSwapOpen] = useState(false);
    const [showRevealModal, setShowRevealModal] = useState(false);
    const [revealPassword, setRevealPassword] = useState("");
    const [decryptedMnemonic, setDecryptedMnemonic] = useState<string | null>(null);
    const [isRevealing, setIsRevealing] = useState(false);

    // [SENIOR SECURITY] Stealth Mode & Auto-Lock
    const [isStealthMode, setIsStealthMode] = useState(false);
    const [isLocked, setIsLocked] = useState(false);

    // Optimized: Fetch real settings with caching to prevent 429 errors
    const { data: settingsData } = useSWR('/api/user/settings', fetcher, {
        revalidateOnFocus: false, // Don't spam when switching tabs
        dedupingInterval: 60000,   // Cache for 1 minute
    });

    useEffect(() => {
         if (settingsData?.settings?.walletStealthMode) {
             setIsStealthMode(true);
         }
    }, [settingsData]);

    // [PRODUCTION FIX] Fetch real-time prices instead of hardcoded values
    const [maticPrice, setMaticPrice] = useState(0);
    const [isLoadingPrice, setIsLoadingPrice] = useState(true);

    useEffect(() => {
        const fetchPrice = async () => {
            try {
                setIsLoadingPrice(true);
                const response = await fetch('/api/prices?symbols=MATIC');
                if (response.ok) {
                    const data = await response.json();
                    setMaticPrice(data.MATIC || 0);
                } else {
                    // Fallback to CoinGecko
                    const cgResponse = await fetch(
                        'https://api.coingecko.com/api/v3/simple/price?ids=matic-network&vs_currencies=usd'
                    );
                    if (cgResponse.ok) {
                        const cgData = await cgResponse.json();
                        setMaticPrice(cgData['matic-network']?.usd || 0);
                    }
                }
            } catch (error) {
                console.error('Failed to fetch MATIC price:', error);
            } finally {
                setIsLoadingPrice(false);
            }
        };

        fetchPrice();
        const interval = setInterval(fetchPrice, 30000); // Refresh every 30s
        return () => clearInterval(interval);
    }, []);

    const totalUsd = (
        (parseFloat(nativeBalance?.formatted || "0") * maticPrice) +
        parseFloat(usdcBalance || "0")
    ).toFixed(2);

    const handleCopy = () => {
        if (activeAddress) {
            navigator.clipboard.writeText(activeAddress);
            toast.success("Address copied to clipboard");
        }
    };

    const handleRevealPhrase = async () => {
        setIsRevealing(true);
        try {
            const cleanAddr = activeAddress ? activeAddress.toLowerCase() : '';
            const storedEncrypted = (typeof window !== 'undefined'
                ? (localStorage.getItem(`hl_vault_encrypted_mnemonic_${cleanAddr}`) || localStorage.getItem('hl_vault_encrypted_mnemonic'))
                : null);

            if (!storedEncrypted) {
                throw new Error("No locally encrypted vault found on this device.");
            }

            const decrypted = await decryptWithPassword(storedEncrypted, revealPassword);
            setDecryptedMnemonic(decrypted);
            toast.success("Mnemonic decrypted successfully");
        } catch (err: unknown) {
            const errorMessage = err instanceof Error ? err.message : "Failed to reveal phrase. Check password.";
            toast.error(errorMessage);
        } finally {
            setIsRevealing(false);
        }
    };

    return (
        <div className="min-h-screen bg-[#FFFFFF] text-[#0A0A0A] font-sans flex justify-center selection:bg-black/10">
            
            <div className="w-full max-w-md bg-white md:my-8 md:rounded-[40px] md:shadow-sm md:border border-black/5 flex flex-col min-h-[850px] relative overflow-hidden">
                
                {/* Visual Grid */}
                <div className="absolute inset-0 bg-[linear-gradient(to_right,rgba(0,0,0,0.01)_1px,transparent_1px),linear-gradient(to_bottom,rgba(0,0,0,0.01)_1px,transparent_1px)] bg-[size:2rem_2rem] pointer-events-none" />

                {/* Header */}
                <header className="px-6 py-6 flex items-center justify-between sticky top-0 bg-white/80 backdrop-blur-xl z-30 border-b border-black/5">
                    <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-xl bg-black flex items-center justify-center">
                            <Shield className="w-5 h-5 text-white" />
                        </div>
                        <div>
                            <div className="flex items-center gap-1.5">
                                <div className="w-1.5 h-1.5 rounded-full bg-black/20" />
                                <span className="text-[10px] font-black uppercase tracking-[0.2em] text-black/30">Polygon Net</span>
                            </div>
                            <h2 className="text-sm font-black tracking-tight text-[#0A0A0A] leading-none mt-0.5">Humanity Ledger</h2>
                        </div>
                    </div>
                    
                    <div className="flex items-center gap-1">
                        <button className="p-2.5 hover:bg-black/5 rounded-2xl transition-all">
                            <Settings className="w-5 h-5 text-black/40" />
                        </button>
                        <button onClick={() => disconnect()} className="p-2.5 hover:bg-red-500/5 rounded-2xl transition-all group">
                            <LogOut className="w-5 h-5 text-black/40 group-hover:text-red-600" />
                        </button>
                    </div>
                </header>

                {/* Account Switcher / Address Display */}
                <div className="px-6 pb-8 space-y-8 z-10 pt-8">
                    
                    <div className="flex flex-col items-center">
                        {/* Identicon Placeholder */}
                        <div className="relative group">
                            <div className="w-20 h-20 rounded-3xl bg-black/5 border border-black/10 flex items-center justify-center">
                                <Wallet className="w-8 h-8 text-black/20" />
                            </div>
                        </div>

                        {/* Address Pill */}
                        <button 
                            onClick={handleCopy}
                            className="mt-6 flex items-center gap-2 px-5 py-2.5 bg-black/[0.02] hover:bg-black/5 border border-black/5 rounded-2xl transition-all group active:scale-95"
                        >
                            <span className="text-xs font-mono font-bold text-black/60">
                                {activeAddress ? `${activeAddress.slice(0, 10)}...${activeAddress.slice(-6)}` : "No Wallet Connected"}
                            </span>
                            <Copy className="w-3.5 h-3.5 text-black/20 group-hover:text-black" />
                        </button>

                        {/* Balance Section */}
                        <div className="mt-8 text-center relative group/balance">
                            <div className={`text-6xl font-black tracking-tighter text-[#0A0A0A] transition-all ${isStealthMode ? 'blur-xl opacity-10' : ''}`}>
                                ${totalUsd}
                            </div>
                            {isStealthMode && (
                                <div className="absolute inset-0 flex items-center justify-center">
                                    <button 
                                        onClick={() => setIsStealthMode(false)}
                                        className="px-4 py-2 bg-black text-white rounded-full text-[10px] font-black tracking-[0.2em]"
                                    >
                                        REVEAL ASSETS
                                    </button>
                                </div>
                            )}
                            <div className="mt-2 text-[10px] font-black uppercase tracking-[0.3em] text-black/20">
                                Capitalization (USD)
                            </div>
                        </div>
                    </div>

                    {/* Action Grid */}
                    <div className="grid grid-cols-4 gap-4">
                        <ActionButton 
                            icon={<ArrowDown className="w-5 h-5" />} 
                            label="Ingress" 
                            onClick={() => setIsReceiveOpen(true)}
                        />
                        <ActionButton icon={<ArrowUp className="w-5 h-5" />} label="Egress" onClick={() => setIsSendOpen(true)} />
                        <ActionButton icon={<RefreshCw className="w-5 h-5" />} label="Rotate" onClick={() => setIsSwapOpen(true)} />
                        <ActionButton 
                            icon={<Key className="w-5 h-5" />} 
                            label="VAULT" 
                            highlight
                            onClick={() => {
                                setRevealPassword("");
                                setDecryptedMnemonic(null);
                                setShowRevealModal(true);
                            }}
                        />
                    </div>
                </div>

                {/* Tabs & List Section */}
                <div className="flex-1 bg-[#FFFFFF] rounded-t-[40px] border-t border-black/5 mt-4 flex flex-col">
                    <div className="px-6 py-2 flex items-center gap-8 border-b border-black/5">
                        <button
                            onClick={() => setActiveTab("assets")}
                            className={`py-4 text-xs font-black uppercase tracking-widest relative transition-colors ${activeTab === "assets" ? "text-black" : "text-black/30 hover:text-black/60"}`}
                        >
                            Assets
                            {activeTab === "assets" && <motion.div layoutId="activeTab" className="absolute bottom-0 left-0 right-0 h-0.5 bg-black" />}
                        </button>
                        <button
                            onClick={() => setActiveTab("activity")}
                            className={`py-4 text-xs font-black uppercase tracking-widest relative transition-colors ${activeTab === "activity" ? "text-black" : "text-black/30 hover:text-black/60"}`}
                        >
                            Activity
                            {activeTab === "activity" && <motion.div layoutId="activeTab" className="absolute bottom-0 left-0 right-0 h-0.5 bg-black" />}
                        </button>
                    </div>

                    <div className="p-4 space-y-3 overflow-y-auto">
                        {activeTab === "assets" ? (
                            <>
                                <AssetRow 
                                    symbol="POL" 
                                    name="Polygon Protocol"
                                    balance={nativeBalance?.formatted.slice(0, 8) || "0.00"}
                                    value={(parseFloat(nativeBalance?.formatted || "0") * maticPrice).toFixed(2)}
                                    color="bg-black/5"
                                />
                                <AssetRow 
                                    symbol="USDC" 
                                    name="Stable Liquidity"
                                    balance={usdcBalance || "0.00"}
                                    value={usdcBalance || "0.00"}
                                    color="bg-black/5"
                                />
                                <div className="pt-6 px-4">
                                    <button className="w-full py-4 rounded-2xl border border-dashed border-black/10 text-[10px] font-black uppercase tracking-widest text-black/20 hover:text-black hover:border-black/20 transition-all">
                                        + Import Identifier
                                    </button>
                                </div>
                            </>
                        ) : (
                            <div className="flex flex-col items-center justify-center py-20 text-center opacity-20">
                                <div className="w-16 h-16 rounded-full bg-black/5 flex items-center justify-center mb-4">
                                    <RefreshCw className="w-6 h-6 text-black" />
                                </div>
                                <p className="text-[10px] font-black uppercase tracking-widest text-black">No recent history</p>
                            </div>
                        )}
                    </div>
                </div>

                {/* Modals */}
                <ReceiveModal 
                    isOpen={isReceiveOpen} 
                    onClose={() => setIsReceiveOpen(false)} 
                    address={activeAddress || undefined}
                />
                <SendModal 
                    isOpen={isSendOpen} 
                    onClose={() => setIsSendOpen(false)} 
                />
                <SwapModal 
                    isOpen={isSwapOpen} 
                    onClose={() => setIsSwapOpen(false)} 
                />

                {/* Reveal Secret Phrase Modal */}
                <AnimatePresence>
                    {showRevealModal && (
                        <>
                            <motion.div 
                                initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
                                onClick={() => setShowRevealModal(false)}
                                className="fixed inset-0 bg-white/80 backdrop-blur-md z-[60]" 
                            />
                            <motion.div 
                                initial={{ y: 100, opacity: 0 }} animate={{ y: 0, opacity: 1 }} exit={{ y: 100, opacity: 0 }}
                                className="fixed bottom-0 left-0 right-0 md:relative md:bottom-auto z-[70] p-6"
                            >
                                <div className="bg-white rounded-[3rem] border border-black/10 p-8 space-y-6 shadow-2xl max-w-md mx-auto">
                                    <div className="flex justify-between items-start">
                                        <div className="w-12 h-12 rounded-2xl bg-black flex items-center justify-center">
                                            <Key className="w-6 h-6 text-white" />
                                        </div>
                                        <button onClick={() => setShowRevealModal(false)} className="p-2 hover:bg-black/5 rounded-full text-black/20">
                                            <LogOut className="w-5 h-5 rotate-90" />
                                        </button>
                                    </div>

                                    <div className="space-y-2">
                                        <h3 className="text-2xl font-black tracking-tight uppercase">Protocol Recovery</h3>
                                        <p className="text-sm text-black/40 font-serif italic">This phrase grants absolute access to the vault. Metadata leakage is irreversible.</p>
                                    </div>

                                    {!decryptedMnemonic ? (
                                        <div className="space-y-4 pt-4">
                                            <div className="space-y-2">
                                                <label className="text-[10px] font-black uppercase tracking-widest text-black/20 ml-1">Identity Verification</label>
                                                <div className="relative">
                                                    <input 
                                                        type="password"
                                                        value={revealPassword}
                                                        onChange={(e) => setRevealPassword(e.target.value)}
                                                        className="w-full bg-black/[0.02] border border-black/10 rounded-2xl px-4 py-4 text-black outline-none focus:border-black/40 transition-all font-mono"
                                                        placeholder=""
                                                    />
                                                </div>
                                            </div>
                                            <button 
                                                onClick={handleRevealPhrase}
                                                disabled={!revealPassword || isRevealing}
                                                className="w-full py-5 bg-black text-white font-black uppercase tracking-widest rounded-2xl hover:bg-black/80 active:scale-[0.98] transition-all disabled:opacity-20"
                                            >
                                                {isRevealing ? "Verifying..." : "Reveal Recovery Phrase"}
                                            </button>
                                        </div>
                                    ) : (
                                        <motion.div 
                                            initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }}
                                            className="space-y-6 pt-2"
                                        >
                                            <div className="p-8 bg-[#FFFFFF] border border-black/10 rounded-[2rem] relative group select-all">
                                                <p className="text-lg font-mono font-bold text-black text-center leading-relaxed">
                                                    {decryptedMnemonic}
                                                </p>
                                            </div>
                                            <button 
                                                onClick={() => {
                                                    navigator.clipboard.writeText(decryptedMnemonic);
                                                    toast.success("Phrase copied");
                                                }}
                                                className="w-full py-4 border border-black/10 rounded-2xl text-[10px] font-black uppercase tracking-widest text-black/40 hover:text-black transition-colors"
                                            >
                                                Copy to Clipboard
                                            </button>
                                        </motion.div>
                                    )}
                                    
                                    <div className="p-4 bg-black/5 border border-black/5 rounded-2xl flex gap-3">
                                        <Shield className="w-5 h-5 text-black/40 shrink-0 mt-0.5" />
                                        <p className="text-[11px] text-black/60 leading-relaxed font-serif">
                                            Vault security is deterministic. Keys are encrypted locally and never persist in the network cloud.
                                        </p>
                                    </div>
                                </div>
                            </motion.div>
                        </>
                    )}
                </AnimatePresence>

            </div>
        </div>
    );
}

interface ActionButtonProps {
    icon: React.ReactNode;
    label: string;
    onClick: () => void;
    highlight?: boolean;
}

function ActionButton({ icon, label, onClick, highlight = false }: ActionButtonProps) {
    return (
        <button 
            onClick={onClick}
            className="flex flex-col items-center gap-3 transition-transform active:scale-90 group"
        >
            <div className={`
                w-16 h-16 rounded-[1.5rem] flex items-center justify-center transition-all duration-300
                ${highlight 
                    ? 'bg-black text-white' 
                    : 'bg-black/5 text-black/40 border border-black/5 hover:bg-black/10 hover:text-black'}
            `}>
                {icon}
            </div>
            <span className={`text-[9px] font-black uppercase tracking-[0.2em] transition-colors ${highlight ? 'text-black' : 'text-black/30 group-hover:text-black/60'}`}>
                {label}
            </span>
        </button>
    );
}

interface AssetRowProps {
    symbol: string;
    name: string;
    balance: string;
    value: string;
    color: string;
}

function AssetRow({ symbol, name, balance, value, color }: AssetRowProps) {
    return (
        <div className="p-5 rounded-[1.5rem] bg-white border border-black/5 hover:bg-[#FFFFFF] transition-all flex items-center justify-between group cursor-pointer">
            <div className="flex items-center gap-4">
                <div className={`w-12 h-12 rounded-xl ${color} flex items-center justify-center text-black/20 font-black group-hover:scale-105 transition-transform`}>
                    {symbol[0]}
                </div>
                <div>
                    <div className="text-sm font-black tracking-tight text-black">{symbol}</div>
                    <div className="text-[10px] font-bold text-black/30 uppercase tracking-widest">{name}</div>
                </div>
            </div>
            <div className="text-right">
                <div className="text-sm font-black tracking-tight text-black">{balance}</div>
                <div className="text-[10px] font-bold text-black/40 tracking-wider">${value} USD</div>
            </div>
        </div>
    );
}

