"use client";

import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { TrendingUp, TrendingDown, Waves, AlertCircle, Star, Eye, Bell, Search, BarChart3, X, Activity, Zap, ArrowRight, Crown, Lock, ShieldCheck, Award } from 'lucide-react';
// System SIWE  No Clerk dependency. Wallet identity via wagmi useAccount.
import useSWR from 'swr';
import { useVIPAnalytics } from '@/hooks/useVIPAnalytics';
import { usePublicClient } from 'wagmi';
import { useSystemAccount } from '@/hooks/useSystemAccount';
import { useQuery } from '@tanstack/react-query';
import axios from 'axios';
import { useAuth } from '@/hooks/useAuth';
import { toast } from 'sonner';
import { createPublicClient, http } from 'viem';
import { mainnet } from 'viem/chains';
import { resolveENSName } from '@/lib/wallet/ens';
import { ForensicAnalysis } from '@/lib/services/AIService';
import { safeCompact, safeToFixed, safeToLocaleString } from '@/lib/utils/number-format';
import WalletAnalyticsPanel from './WalletAnalyticsPanel';
import LedgerVerificationReport from './LedgerVerificationReport';

const ALCHEMY_ID = process.env.NEXT_PUBLIC_ALCHEMY_ID;
// DEDICATED ENS RESOLVER (Forces Ethereum Mainnet regardless of connected chain)
const ensPublicClient = createPublicClient({
  chain: mainnet,
  transport: http(ALCHEMY_ID ? `https://eth-mainnet.g.alchemy.com/v2/${ALCHEMY_ID}` : "https://eth.llamarpc.com")
});

const fetcher = (url: string) => fetch(url).then(r => r.json());

export interface WatchedWallet {
  id: string;
  address: string;
  label: string;
  note?: string;
  tags: string[];
  isLedger: boolean;
  isSmart: boolean;
  totalValue: number;
  change24h: number;
  pnl24h?: number;
  txCount?: number;
  riskScore?: number;
  rank?: number;
  activityScore?: number;
  lastActive: Date | string;
  alertsEnabled: boolean;
  metadata?: Record<string, number>;
  ledgerEvidence?: string[];
  influenceScore?: number;
  category?: string;
  identityTier?: string;
  forensics?: ForensicAnalysis;
}

export interface LedgerActivity {
  id: string;
  walletAddress: string;
  walletLabel: string;
  type: 'BUY' | 'SELL' | 'TRANSFER' | 'SWAP';
  token: string;
  amount: number;
  usdValue: number;
  timestamp: Date;
  txHash: string;
  chain?: string;
}

interface LedgerTrackerProps {
  isPremium: boolean;
  onUpgrade: () => void;
  onWalletsUpdate?: (wallets: WatchedWallet[]) => void;
  selectedComparisonIds?: string[];
  onToggleComparison?: (id: string) => void;
  selectedWalletAddress?: string;
  onSelectWallet?: (address: string) => void;
  onTabChange?: (tab: 'tracker' | 'analytics' | 'alerts' | 'news' | 'comparison') => void;
}

export default function LedgerTracker({ 
  isPremium, 
  onUpgrade, 
  onWalletsUpdate,
  selectedComparisonIds = [],
  onToggleComparison,
  selectedWalletAddress,
  onSelectWallet,
  onTabChange
}: LedgerTrackerProps) {
  const { address: web3Address } = useSystemAccount();
  const { isAuthenticated, isPremium: authIsPremium } = useAuth();
  const isOwner = false;
  const trialViews = 3;
  const viewedAddresses: string[] = [];
  const publicClient = usePublicClient();



  const { data: managedWallet } = useQuery({
    queryKey: ['managed-wallet-small'],
    queryFn: async () => {
        if (!isAuthenticated || web3Address) return null;
        const { data } = await axios.get('/api/user/wallet');
        return data;
    },
    enabled: isAuthenticated && !web3Address
  });

  const currentUserAddress = web3Address || managedWallet?.address;
  
  const { data: watchedData, isLoading: isLoadingWallets, mutate: mutateWallets } = useSWR(
    currentUserAddress ? `/api/premium/watched-wallets` : null, // Disable SWR fully if no address, do not fetch demo mode
    async (url: string) => {
        const res = await fetch(url, {
            headers: { 'x-web3-address': currentUserAddress! }
        });
        return res.json();
    }
  );

  const [activities, setActivities] = useState<LedgerActivity[]>([]);
  const [filter, setFilter] = useState<'all' | 'ledgers' | 'smart' | 'alerts'>('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [showAddWallet, setShowAddWallet] = useState(false);
  const [selectedChains, setSelectedChains] = useState<string[]>(['bitcoin', 'base', 'ethereum', 'polygon']);
  const [activeTab, setActiveTab] = useState<'signals' | 'wallets'>('wallets'); // Default to wallets for demo impact
  const [selectedAnalyticsWallet, setSelectedAnalyticsWallet] = useState<WatchedWallet | null>(null);
  const [selectedReportWallet, setSelectedReportWallet] = useState<WatchedWallet | null>(null);
  const [syncingAddresses, setSyncingAddresses] = useState<Set<string>>(new Set());

  const handleSyncWallet = async (address: string) => {
    if (!currentUserAddress) {
        toast.info("Demo Mode: Sync simulation active", { description: "Real-time data is already up to date for this ledger." });
        return;
    }
    setSyncingAddresses(prev => new Set(prev).add(address.toLowerCase()));
    try {
        toast.loading(`Starting Deep Scan for ${address.slice(0,6)}...`, { id: 'sync-wallet' });
        const res = await fetch(`/api/wallet/analytics/${address}?refresh=true&deep=true`);
        if (res.ok) {
            toast.success(` Data synchronized successfully (Full history recovered)`, { id: 'sync-wallet' });
            await mutateWallets();
        } else {
            toast.error("Failed to synchronize deep data", { id: 'sync-wallet' });
        }
    } catch (e) {
        toast.error("Network error while synchronizing", { id: 'sync-wallet' });
    } finally {
        setSyncingAddresses(prev => {
            const next = new Set(prev);
            next.delete(address.toLowerCase());
            return next;
        });
    }
  };

  const watchedWallets: WatchedWallet[] = (watchedData?.wallets || []).map((w: any) => ({
    ...w,
    totalValue: w.totalValue ?? w.lastValue ?? 0,
    change24h: w.change24h ?? 0,
    lastActive: w.lastActive ? new Date(w.lastActive) : new Date(),
    // Propagate diagnostic errors from API
    error: w.error,
    errorMessage: w.errorMessage
  }));

  const { transactions } = useVIPAnalytics();

  useEffect(() => {
    if (!transactions || transactions.length === 0) return;
    
    const mapped: LedgerActivity[] = transactions.map(tx => ({
        id: tx.hash,
        walletAddress: tx.from,
        walletLabel: tx.from.slice(0, 6) + '...' + tx.from.slice(-4),
        type: tx.txType === 'MEV_BOT' ? 'SWAP' : tx.txType === 'DEFI_ROUTING' ? 'BUY' : 'TRANSFER',
        token: tx.tokenSymbol || 'ETH',
        amount: tx.valueEth,
        usdValue: tx.valueUsd,
        timestamp: new Date(tx.timestamp),
        txHash: tx.hash,
        chain: tx.network.toLowerCase()
    }));

    setActivities(mapped);
  }, [transactions]);

  useEffect(() => {
    if (onWalletsUpdate && watchedWallets.length > 0) {
      onWalletsUpdate(watchedWallets);
    }
  }, [watchedData, onWalletsUpdate]);

    useEffect(() => {
        console.log(`[WC-TRACE] Current Project ID: ${process.env.NEXT_PUBLIC_WALLETCONNECT_PROJECT_ID || 'FORBIDDEN-FALLBACK'}`);
    }, []);

    const handleAddWallet = async (inputAddress: string, label: string) => {
    if (!currentUserAddress) {
        toast.info("Demo Mode: Read-only", { description: "Sign in to track your own wallets." });
        return;
    }

    let finalAddress = inputAddress.trim();

    //  ENS RESOLUTION (con timeout agresivo de 1.5s) 
    const isEns = finalAddress.toLowerCase().endsWith('.eth') ||
        (!finalAddress.startsWith('0x') && !finalAddress.startsWith('bc1') && finalAddress.includes('.'));

    if (isEns) {
        const ensInput = finalAddress.includes('.') ? finalAddress : `${finalAddress}.eth`;
        console.log(`[ENS] Resolving: ${ensInput}`);

        const ENS_TIMEOUT_MS = 1500; // Máximo 1.5 segundos para ENS
        const timeoutError = new Error('ENS_TIMEOUT');

        try {
            toast.loading(`Resolving ${ensInput}...`, { id: 'ens-resolve', duration: 2000 });
            const resolved = await Promise.race([
                resolveENSName(ensInput),
                new Promise<null>((_idx, reject) => setTimeout(() => reject(timeoutError), ENS_TIMEOUT_MS))
            ]);

            if (resolved) {
                toast.success(`ENS resolved: ${resolved.slice(0, 6)}...${resolved.slice(-4)}`, { id: 'ens-resolve' });
                finalAddress = resolved;
            } else {
                toast.error(`ENS not found: ${ensInput}. Try with the 0x address?`, { id: 'ens-resolve' });
                return;
            }
        } catch (e: any) {
            toast.dismiss('ens-resolve');
            if (e.message === 'ENS_TIMEOUT') {
                toast.error(`ENS took too long. Enter the 0x address directly to add instantly.`, {
                    duration: 5000,
                    description: 'ENS resolution may take time if the RPC is congested.'
                });
            } else {
                toast.error(`Could not resolve ${ensInput}.`, { description: 'Use the 0x address for maximum speed.' });
            }
            return;
        }
    }

    //  BASIC VALIDATION 
    if (!finalAddress.startsWith('0x') || finalAddress.length < 42) {
        toast.error('Invalid address. Use 0x... format or a valid .eth name.');
        return;
    }

    try {
        // Fetch CSRF Token + POST en paralelo (CSRF primero, luego POST)
        const csrfRes = await fetch('/api/auth/csrf', {
            headers: { 'x-web3-address': currentUserAddress }
        });
        const { token: csrfToken } = await csrfRes.json();

        toast.loading('Adding wallet...', { id: 'add-wallet' });
        
        const res = await fetch('/api/premium/watched-wallets', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'x-web3-address': currentUserAddress,
                'x-csrf-token': csrfToken,
                'x-is-architect': (web3Address?.toLowerCase() === '0xhumanityledger' ? 'true' : 'false') // Placeholder  use OWNER_ADDRESSES
            },
            body: JSON.stringify({
                address: finalAddress,
                label: label || inputAddress.trim(), 
                tags: ['Custom']
            })
        });
        
        if (res.ok) {
            toast.success(` ${label || inputAddress} added successfully`, { id: 'add-wallet' });
            await mutateWallets();
            setShowAddWallet(false);
        } else {
            const errData = await res.json();
            if (res.status === 429) {
                toast.dismiss('add-wallet');
                return;
            }
            if (errData.stack) console.error("CRITICAL API STACK:", errData.stack);
            toast.error(`Error: ${errData.error || res.statusText}`, { id: 'add-wallet', description: errData.details });
        }
    } catch (e) {
        console.error("Error adding wallet:", e);
        toast.error('Connection failure while adding wallet', { id: 'add-wallet' });
    }
  };

  const handleDeleteWallet = async (id: string, label: string) => {
    if (!currentUserAddress) return;
    if (!confirm(`Are you sure you want to stop watching "${label}"?`)) return;

    toast.loading(`Deleting "${label}"...`, { id: 'delete-wallet' });

    try {
        //  CSRF HANDSHAKE
        console.log('[DELETE-WALLET-FRONTEND] Fetching CSRF token...');
        const csrfRes = await fetch('/api/auth/csrf', {
            headers: { 'x-web3-address': currentUserAddress }
        });
        const { token: csrfToken } = await csrfRes.json();
        console.log('[DELETE-WALLET-FRONTEND] CSRF token received');

        console.log('[DELETE-WALLET-FRONTEND] Sending DELETE request...', { id, userAddress: currentUserAddress });
        const res = await fetch(`/api/premium/watched-wallets?id=${id}`, {
            method: 'DELETE',
            headers: {
                'x-web3-address': currentUserAddress,
                'x-csrf-token': csrfToken
            }
        });

        const data = await res.json();
        console.log('[DELETE-WALLET-FRONTEND] Server response:', { status: res.status, data });

        if (res.ok) {
            toast.success(` Wallet "${label}" deleted successfully`, { id: 'delete-wallet' });
            console.log('[DELETE-WALLET-FRONTEND] Mutation triggered');
            await mutateWallets();
        } else {
            console.error('[DELETE-WALLET-FRONTEND] Deletion failed:', data);
            
            // Build detailed error message
            let errorMessage = data.error || 'Unknown error';
            if (data.details) errorMessage += ` - ${data.details}`;
            if (data.code) errorMessage += ` (Code: ${data.code})`;
            
            toast.error(`Error deleting: ${errorMessage}`, { 
                id: 'delete-wallet',
                duration: 5000 
            });
        }
    } catch (e: any) {
        console.error('[DELETE-WALLET-FRONTEND] Critical error:', e);
        toast.error(`Connection failure: ${e.message || 'Network error'}`, { 
            id: 'delete-wallet',
            duration: 5000 
        });
    }
  };

  const filteredWallets = (watchedWallets || []).filter(w => {
    if (filter === 'ledgers' && !w.isLedger) return false;
    if (filter === 'smart' && !w.isSmart) return false;
    if (filter === 'alerts' && !w.alertsEnabled) return false;
    if (searchQuery && !w.label.toLowerCase().includes(searchQuery.toLowerCase()) 
        && !w.address.toLowerCase().includes(searchQuery.toLowerCase())) return false;
    return true;
  });

  const formatValue = (val: any) => {
    const num = typeof val === 'string' ? parseFloat(val) : Number(val);
    if (isNaN(num)) return "$0.00 (0.00)";
    const eur = num * 0.92;
    return `$${safeToLocaleString(num, { minimumFractionDigits: 2, maximumFractionDigits: 2 })} (${safeToLocaleString(eur, { minimumFractionDigits: 2, maximumFractionDigits: 2 })})`;
  };

  const formatPercent = (val: any) => {
    const num = typeof val === 'string' ? parseFloat(val) : Number(val);
    if (isNaN(num)) return "0.00%";
    return `${num >= 0 ? '+' : ''}${num.toFixed(2)}%`;
  };

  return (
    <div className="space-y-8 font-sans">
      
      {/* 2. MAIN NAV TABS - SIMPLE & BIG */}

      <div className="flex justify-center gap-4">
        <button
          onClick={() => setActiveTab('signals')}
          className={`px-8 py-4 rounded-full text-lg font-bold transition-all shadow-sm flex items-center gap-2 ${
            activeTab === 'signals' 
              ? 'bg-emerald-600 text-white shadow-lg shadow-emerald-900/40' 
              : 'bg-white/5 text-gray-400 hover:bg-white/10 hover:text-white'
          }`}
        >
          <Zap className={activeTab === 'signals' ? "text-white fill-white" : ""} size={20} />
          LIVE SIGNALS
        </button>
        <button
          onClick={() => setActiveTab('wallets')}
          className={`px-8 py-4 rounded-full text-lg font-bold transition-all shadow-sm flex items-center gap-2 ${
            activeTab === 'wallets' 
              ? 'bg-emerald-600 text-white shadow-lg shadow-emerald-900/40' 
              : 'bg-white/5 text-gray-400 hover:bg-white/10 hover:text-white'
          }`}
        >
          <Eye size={20} />
          WATCHED WALLETS
        </button>
      </div>

      {/* 3. CONTENT AREA */}
      <AnimatePresence mode="wait">
        
        {/* === SIGNALS TAB === */}
        {activeTab === 'signals' && (
            <motion.div 
                key="signals"
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -20 }}
                className="space-y-6"
            >
                <div className="flex justify-between items-center px-4">
                    <div className="flex items-center gap-4">
                        <h3 className="text-2xl font-black text-white flex items-center gap-2">
                            <Activity className="text-[#25D366]" />
                            Latest Movements
                        </h3>
                         <span className="bg-[#25D366]/20 text-emerald-300 px-3 py-1 rounded-full text-xs font-bold uppercase border border-[#25D366]/30">Telegram Bot Feed ($500M+)</span>
                    </div>
                    <span className="text-sm font-bold text-green-400 bg-green-900/20 border border-green-500/20 px-3 py-1 rounded-full animate-pulse flex items-center gap-2">
                        <span className="w-2 h-2 rounded-full bg-green-500"></span>
                        Active Update
                    </span>
                </div>

                <div className="grid grid-cols-1 gap-4">
                    {activities.length === 0 ? (
                        <div className="text-center py-20 bg-white/5 rounded-3xl border border-white/10">
                            <Waves size={48} className="mx-auto text-gray-600 mb-4 animate-pulse" />
                            <p className="text-xl text-gray-400 font-bold">Scanning the Blockchain...</p>
                        </div>
                    ) : (
                        <div className="relative">
                            <div className="">
                                {activities.map((activity, index) => (
                                    <SignalCard key={activity.id} activity={activity} index={index} />
                                ))}
                            </div>
                             {!isPremium && (
                                <div className="mt-8 p-6 bg-gradient-to-r from-emerald-900/20 to-purple-900/20 rounded-2xl border border-[#25D366]/30 text-center backdrop-blur-sm">
                                    <p className="text-gray-300 font-medium mb-4">You are viewing the standard high-value ledger feed.</p>
                                    <button 
                                        onClick={onUpgrade} 
                                        data-upgrade-trigger="true"
                                        className="bg-emerald-600 text-white px-6 py-3 rounded-xl font-bold hover:scale-105 transition-transform shadow-lg shadow-emerald-900/50"
                                    >
                                        Unlock Custom Alerts & Portfolio Tracking
                                    </button>
                                </div>
                            )}
                        </div>
                    )}
                </div>
            </motion.div>
        )}

        {/* === WALLETS TAB === */}
        {activeTab === 'wallets' && (
            <motion.div 
                key="wallets"
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -20 }}
                className="space-y-6"
            >
                 <div className="bg-white/5 p-6 rounded-3xl shadow-sm border border-white/10 flex flex-wrap gap-4 items-center justify-between backdrop-blur-sm">
                    <div className="flex items-center gap-6">
                        <div className="flex gap-2">
                            <button onClick={() => setFilter('all')} className={`px-4 py-2 rounded-xl font-bold transition-all ${filter === 'all' ? 'bg-emerald-600 text-white' : 'bg-white/5 text-gray-400 hover:bg-white/10'}`}>All</button>
                            <button onClick={() => setFilter('ledgers')} className={`px-4 py-2 rounded-xl font-bold transition-all ${filter === 'ledgers' ? 'bg-emerald-600 text-white' : 'bg-white/5 text-gray-400 hover:bg-white/10'}`}>Ledgers</button>
                        </div>
                        
                        {!authIsPremium && (
                            <div className="flex items-center gap-3 px-4 py-2 bg-[#25D366]/10 border border-[#25D366]/20 rounded-2xl">
                                <div className="text-[10px] font-black text-emerald-400 uppercase tracking-widest">Trial Access</div>
                                <div className="flex gap-1">
                                    {[1, 2, 3].map((i) => (
                                        <div 
                                            key={i} 
                                            className={`w-2 h-2 rounded-full ${i <= trialViews ? 'bg-[#25D366] shadow-[0_0_8px_rgba(59,130,246,0.6)]' : 'bg-white/10'}`} 
                                        />
                                    ))}
                                </div>
                                <span className="text-xs font-bold text-white/60">{trialViews}/3 Views</span>
                            </div>
                        )}
                    </div>
                    
                    <button
                        onClick={() => setShowAddWallet(true)}
                        className="px-6 py-3 bg-white text-black rounded-xl font-black hover:bg-gray-200 transition-all flex items-center gap-2 shadow-lg"
                    >
                        <Eye size={20} />
                        WATCH NEW WALLET
                    </button>
                </div>

                <div className="grid grid-cols-1 gap-4">
                    {filteredWallets.length === 0 ? (
                        <div className="text-center py-20 bg-white/5 rounded-[2.5rem] border border-white/10 backdrop-blur-md">
                            <div className="w-20 h-20 bg-emerald-600/10 rounded-full flex items-center justify-center mx-auto mb-6 border border-[#25D366]/20">
                                <Eye size={40} className="text-[#25D366] opacity-50" />
                            </div>
                            <h3 className="text-2xl font-black text-white mb-2">You are not watching any wallets</h3>
                            <p className="text-gray-400 max-w-xs mx-auto font-medium">
                                Add a 0x address or a .eth name to start tracking movements.
                            </p>
                        </div>
                    ) : (
                        filteredWallets.map((wallet, index) => (
                            <ElegantWalletCard 
                                key={wallet.id} 
                                wallet={wallet} 
                                formatValue={formatValue}
                                index={index}
                                isPremium={authIsPremium}
                                trialViews={trialViews}
                                hasTrialed={viewedAddresses.includes(wallet.address.toLowerCase())}
                                onAnalyze={() => {
                                    onSelectWallet?.(wallet.address);
                                    onTabChange?.('analytics');
                                }}
                                onAnalyzeSelect={setSelectedAnalyticsWallet}
                                onCompare={() => {
                                    if (!authIsPremium) {
                                        onUpgrade();
                                        return;
                                    }
                                    onToggleComparison?.(wallet.id);
                                }}
                                onDelete={() => handleDeleteWallet(wallet.id, wallet.label)}
                                isSelected={selectedWalletAddress === wallet.address}
                                isComparing={selectedComparisonIds.includes(wallet.id)}
                                onUpgrade={onUpgrade}
                                isSyncing={syncingAddresses.has(wallet.address.toLowerCase())}
                                onSync={() => handleSyncWallet(wallet.address)}
                                onShowReport={() => setSelectedReportWallet(wallet)}
                            />
                        ))
                    )}
                    {/* 
                    {!isPremium && filteredWallets.length >= 3 && (
                        <div className="text-center py-8">
                            <p className="text-gray-500 mb-2">You have reached the free limit of 3 wallets.</p>
                            <button onClick={onUpgrade} data-upgrade-trigger="true" className="text-emerald-400 font-bold underline hover:text-emerald-300">Upgrade to Premium</button>
                        </div>
                    )}
                    */}
                </div>
            </motion.div>
        )}
      </AnimatePresence>

      <AddWalletModal isOpen={showAddWallet} onClose={() => setShowAddWallet(false)} onAdd={handleAddWallet} />
      
      {selectedAnalyticsWallet && (
        <WalletAnalyticsPanel
          address={selectedAnalyticsWallet.address}
          label={selectedAnalyticsWallet.label}
          analytics={undefined}
          onClose={() => setSelectedAnalyticsWallet(null)}
        />
      )}

      {selectedReportWallet && (
        <LedgerVerificationReport
          address={selectedReportWallet.address}
          label={selectedReportWallet.label}
          category={selectedReportWallet.category || (selectedReportWallet.isLedger ? 'Ledger' : 'Active Verifier')}
          influenceScore={selectedReportWallet.influenceScore || (selectedReportWallet.isLedger ? 85 : 45)}
          evidence={selectedReportWallet.ledgerEvidence || []}
          totalValue={selectedReportWallet.totalValue}
          identityTier={selectedReportWallet.identityTier}
          forensics={selectedReportWallet.forensics}
          onClose={() => setSelectedReportWallet(null)}
        />
      )}
    </div>
  );
}

// === SUB-COMPONENTS ===

function SignalCard({ activity, index }: { activity: LedgerActivity, index: number }) {
    const isBuy = activity.type === 'BUY';
    const isSell = activity.type === 'SELL';
    
    return (
        <motion.div 
            initial={{ opacity: 0, x: -20 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ delay: index * 0.05 }}
            className={`p-6 rounded-3xl border-l-[4px] shadow-lg hover:shadow-xl transition-all bg-white/5 backdrop-blur-md mb-3 border-y border-r border-white/5 ${
                isBuy ? 'border-l-green-500' : isSell ? 'border-l-indigo-500' : 'border-l-[#25D366]'
            }`}
        >
            <div className="flex flex-col md:flex-row items-center justify-between gap-6">
                
                {/* 1. TYPE & TOKEN */}
                <div className="flex items-center gap-4 w-full md:w-auto">
                    <div className={`p-4 rounded-2xl ${isBuy ? 'bg-green-500/10 text-green-400' : isSell ? 'bg-indigo-500/10 text-indigo-400' : 'bg-[#25D366]/10 text-emerald-400'}`}>
                        {isBuy ? <TrendingUp size={24} /> : isSell ? <TrendingDown size={24} /> : <ArrowRight size={24} />}
                    </div>
                    <div>
                        <div className="text-xs font-bold opacity-50 uppercase tracking-widest text-gray-400">{activity.type}</div>
                        <div className="text-2xl font-black text-white">{activity.token}</div>
                    </div>
                </div>

                {/* 2. AMOUNT & VALUE */}
                <div className="text-center md:text-right flex-1">
                    <div className="text-2xl font-black text-white tracking-tight">
                        ${(activity.usdValue).toLocaleString('de-DE', { maximumFractionDigits: 0 })}
                        <span className="text-sm text-gray-400 font-bold ml-2">
                           ({(activity.usdValue * 0.92).toLocaleString('de-DE', { maximumFractionDigits: 0 })})
                        </span>
                    </div>
                    <div className="text-sm font-medium text-gray-400">
                        {activity.amount.toLocaleString('de-DE', { maximumFractionDigits: 4 })} {activity.token}
                    </div>
                </div>

                {/* 3. WHO & TIME */}
                <div className="flex items-center gap-4 md:border-l md:pl-6 border-white/10 w-full md:w-auto justify-between md:justify-end">
                    <div className="text-right">
                        <div className="font-bold text-white text-lg">{activity.walletLabel}</div>
                        <div className="text-xs text-gray-500 font-mono">{new Date(activity.timestamp).toLocaleTimeString()}</div>
                    </div>
                    {/* @ts-ignore */}
                    {activity.chain === 'bitcoin' ? (
                       <div className="w-10 h-10 rounded-full bg-[#f7931a]/20 flex items-center justify-center text-[#f7931a] font-bold border border-[#f7931a]/30"></div> 
                    ) : activity.chain === 'base' ? (
                       <div className="w-10 h-10 rounded-full bg-emerald-600 flex items-center justify-center text-white font-bold shadow-lg shadow-emerald-600/30">B</div>
                    ) : (
                       <div className="w-10 h-10 rounded-full bg-indigo-500/20 flex items-center justify-center text-indigo-400 font-bold border border-indigo-500/30">Ξ</div>
                    )}
                </div>

            </div>
        </motion.div>
    );
}

function ElegantWalletCard({ 
    wallet, 
    formatValue, 
    index, 
    onAnalyze, 
    onAnalyzeSelect,
    onCompare, 
    onDelete,
    isSelected, 
    isComparing,
    isPremium,
    trialViews,
    hasTrialed,
    onUpgrade,
    isSyncing,
    onSync,
    onShowReport
}: { 
    wallet: WatchedWallet, 
    formatValue: any, 
    index: number, 
    onAnalyze: any, 
    onAnalyzeSelect: (wallet: WatchedWallet) => void,
    onCompare: any, 
    onDelete?: () => void,
    isSelected: boolean, 
    isComparing: boolean,
    isPremium: boolean,
    trialViews: number,
    hasTrialed: boolean,
    onUpgrade: () => void,
    isSyncing?: boolean,
    onSync?: () => void,
    onShowReport?: () => void
}) {
    const riskColor = wallet.riskScore && wallet.riskScore > 60 ? 'text-indigo-400' : 'text-green-400';
    const pnl24h = wallet.pnl24h || 0;
    return (
        <motion.div 
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: index * 0.05 }}
            className={`p-6 rounded-[2rem] border shadow-2xl flex flex-col gap-4 hover:bg-white/10 transition-all backdrop-blur-md group ${
                isSelected ? 'bg-white/15 border-[#25D366] shadow-emerald-900/20' : 'bg-white/5 border-white/10'
            }`}
        >
            <div className="flex items-center gap-4 w-full md:w-auto">
                <div className="w-12 h-12 bg-emerald-600/20 rounded-2xl flex items-center justify-center text-emerald-400 border border-[#25D366]/30 relative flex-shrink-0">
                    {wallet.isLedger ? <Waves size={24} /> : <Eye size={24} />}
                    <div className="absolute -top-2 -right-2 flex gap-1">
                        {wallet.address.startsWith('0x') && (
                            <div className="w-5 h-5 rounded-full bg-indigo-600 flex items-center justify-center text-[10px] text-white font-bold border border-black shadow-lg">Ξ</div>
                        )}
                        {(wallet.address.startsWith('bc1') || /^[13]/.test(wallet.address)) && !wallet.address.startsWith('0x') && (
                            <div className="w-5 h-5 rounded-full bg-orange-500 flex items-center justify-center text-[10px] text-white font-bold border border-black shadow-lg"></div>
                        )}
                        {/^[1-9A-HJ-NP-Za-km-z]{32,44}$/.test(wallet.address) && !wallet.address.startsWith('0x') && !wallet.address.startsWith('bc1') && (
                            <div className="w-5 h-5 rounded-full bg-green-500 flex items-center justify-center text-[10px] text-white font-bold border border-black shadow-lg">S</div>
                        )}
                    </div>
                </div>
                <div className="truncate">
                    <h4 className="text-xl font-black text-white flex items-center gap-2">
                        {wallet.label}
                        {wallet.isSmart && <Zap size={14} className="text-yellow-400 fill-yellow-400" />}
                    </h4>
                    <span className="text-sm font-mono text-gray-500">{wallet.address.slice(0,6)}...{wallet.address.slice(-4)}</span>
                </div>
                {wallet.isLedger && (
                   <div className="ml-auto flex items-center gap-1.5 px-3 py-1 bg-[#25D366]/10 border border-[#25D366]/20 rounded-full">
                       <ShieldCheck size={12} className="text-emerald-400" />
                       <span className="text-[10px] font-black text-emerald-400 uppercase tracking-tighter">Identity Verified</span>
                   </div>
                )}
            </div>

            <div className="flex flex-col md:flex-row items-center gap-6 w-full justify-between md:justify-end mt-4 md:mt-0">
                <div className="text-center md:text-right w-full md:w-auto">
                    {(wallet as any).error ? (
                        <div className="flex flex-col items-end">
                            <div className={`text-sm font-black ${(wallet as any).error === 'PRICE_THROTTLED' ? 'text-amber-500' : 'text-indigo-500'} flex items-center gap-1.5 uppercase tracking-tighter`}>
                                <AlertCircle size={14} />
                                {(wallet as any).error === 'PRICE_THROTTLED' ? 'Price Error' : 'Sync Failed'}
                            </div>
                            <div className="text-[10px] text-gray-500 font-mono mt-0.5">{(wallet as any).errorMessage || 'Check Config'}</div>
                        </div>
                    ) : (
                        <>
                            <div className="text-2xl font-black text-white">{formatValue(wallet.totalValue)}</div>
                            <div className={`font-bold flex items-center justify-end gap-1 ${wallet.change24h >= 0 ? 'text-green-400' : 'text-indigo-400'}`}>
                                {wallet.change24h >= 0 ? '+' : ''}{wallet.change24h}% (24h)
                            </div>
                        </>
                    )}
                </div>

                <div className="flex flex-wrap justify-center md:justify-end gap-2 w-full md:w-auto">
                    <button 
                        onClick={(e) => { e.stopPropagation(); onAnalyze(); }}
                        className="px-4 py-2 bg-emerald-600 text-white rounded-xl text-xs font-black uppercase hover:bg-[#25D366] transition-colors shadow-lg shadow-emerald-900/40"
                        title="View portfolio details and analysis"
                    >
                        View Portfolio
                    </button>
                    <button 
                        onClick={(e) => { 
                            e.stopPropagation(); 
                            if (!isPremium && trialViews >= 3 && !hasTrialed) {
                                onUpgrade();
                                return;
                            }
                            onAnalyzeSelect(wallet);
                        }}
                        className={`px-4 py-2 ${(!isPremium && trialViews >= 3 && !hasTrialed) ? 'bg-gray-600' : 'bg-purple-600'} text-white rounded-xl text-xs font-black uppercase hover:bg-purple-500 transition-colors shadow-lg shadow-purple-900/40 flex items-center gap-2`}
                        title={(!isPremium && trialViews >= 3 && !hasTrialed) ? "Trial limit reached" : "View advanced analytics (10+ metrics)"}
                    >
                        {(!isPremium && !hasTrialed) && <Lock size={12} />}
                        {(!isPremium && trialViews >= 3 && !hasTrialed) ? 'Unlock Pro' : 'Analytics'}
                    </button>
                    {wallet.isLedger && (
                       <button 
                           onClick={(e) => { e.stopPropagation(); onShowReport?.(); }}
                           className="px-4 py-2 bg-gradient-to-r from-emerald-600 to-emerald-400 text-white rounded-xl text-xs font-black uppercase hover:scale-105 transition-transform shadow-lg shadow-emerald-900/40 flex items-center gap-2"
                           title="View Ledger Identity Certificate"
                       >
                           <Award size={12} />
                           Certificate
                       </button>
                    )}
                    <button 
                        onClick={(e) => { 
                            e.stopPropagation(); 
                            if (!isPremium) {
                                onUpgrade();
                                return;
                            }
                            onCompare(); 
                        }}
                        className={`px-4 py-2 rounded-xl text-xs font-black uppercase transition-all shadow-lg ${
                            isComparing 
                                ? 'bg-purple-600 text-white shadow-purple-900/40 border-purple-400' 
                                : 'bg-white/10 text-gray-300 hover:bg-white/20 border-white/10'
                        } border flex items-center gap-2`}
                    >
                        {!isPremium && <Lock size={12} />}
                        {isComparing ? 'Selected' : 'Compare'}
                    </button>
                    <a 
                        href={wallet.address.startsWith('0x') ? `https://etherscan.io/address/${wallet.address}` : `https://www.blockchain.com/explorer/addresses/btc/${wallet.address}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        onClick={(e) => e.stopPropagation()}
                        className="p-2.5 bg-[#25D366]/10 text-emerald-400 rounded-xl hover:bg-[#25D366]/20 transition-colors border border-[#25D366]/20"
                        title="View in Explorer (Real Verification)"
                    >
                        <Search size={16} />
                    </a>
                     <button 
                        onClick={(e) => { e.stopPropagation(); onSync?.(); }}
                        disabled={isSyncing}
                        className={`p-2.5 rounded-xl transition-all border ${
                            isSyncing 
                                ? 'bg-[#25D366]/20 text-emerald-400 border-[#25D366]/30' 
                                : 'bg-green-500/10 text-green-400 hover:bg-green-500/20 border-green-500/20'
                        }`}
                        title="Sincronizar datos on-chain (Force Refresh)"
                    >
                        {isSyncing ? <Zap size={16} className="animate-pulse" /> : <Zap size={16} />}
                    </button>
                    <button 
                        onClick={(e) => { e.stopPropagation(); onDelete?.(); }}
                        className="p-2.5 bg-indigo-500/10 text-indigo-400 rounded-xl hover:bg-indigo-500/20 transition-colors border border-indigo-500/20"
                        title="Delete"
                    >
                        <X size={16} />
                    </button>


                </div>
            </div>
        </motion.div>
    );
}

function AddWalletModal({ isOpen, onClose, onAdd }: { isOpen: boolean, onClose: () => void, onAdd: (address: string, label: string) => Promise<void> }) {
    const [address, setAddress] = useState('');
    const [label, setLabel] = useState('');
    const [isAdding, setIsAdding] = useState(false);
    // Preview ENS resolution inline (no bloquea el submit)
    const [ensPreview, setEnsPreview] = useState<{ state: 'idle' | 'resolving' | 'ok' | 'error'; resolved?: string }>({ state: 'idle' });

    const isEnsInput = address.toLowerCase().endsWith('.eth') || 
        (!address.startsWith('0x') && !address.startsWith('bc1') && address.includes('.') && address.length > 4);
    const isHexAddress = address.startsWith('0x') && address.length >= 40;

    //  Preview ENS inline mientras el usuario escribe 
    useEffect(() => {
        if (!isEnsInput) { setEnsPreview({ state: 'idle' }); return; }
        setEnsPreview({ state: 'resolving' });
        const timer = setTimeout(async () => {
            try {
                const resolved = await Promise.race([
                    resolveENSName(address.includes('.') ? address : `${address}.eth`),
                    new Promise<null>((_idx, reject) => setTimeout(() => reject(new Error('timeout')), 1500))
                ]);
                if (resolved) setEnsPreview({ state: 'ok', resolved });
                else setEnsPreview({ state: 'error' });
            } catch {
                setEnsPreview({ state: 'error' });
            }
        }, 600); // Debounce 600ms after the user stops typing
        return () => clearTimeout(timer);
    }, [address, isEnsInput]);

    const handleSubmit = async () => {
        if (!address.trim()) return;
        setIsAdding(true);
        try {
            await onAdd(address.trim(), label.trim());
        } finally {
            setIsAdding(false);
        }
    };

    const handleKeyDown = (e: React.KeyboardEvent) => {
        if (e.key === 'Enter' && !isAdding) handleSubmit();
    };

    // Reset on open
    useEffect(() => {
        if (isOpen) { setAddress(''); setLabel(''); setIsAdding(false); setEnsPreview({ state: 'idle' }); }
    }, [isOpen]);

    if (!isOpen) return null;

    // Estado del botón
    const canSubmit = !isAdding && (isHexAddress || ensPreview.state === 'ok');
    const buttonLabel = isAdding
        ? 'ADDING...'
        : isHexAddress
        ? 'START TRACKING'
        : ensPreview.state === 'ok'
        ? 'START TRACKING'
        : ensPreview.state === 'resolving'
        ? 'SEARCHING ENS...'
        : 'START TRACKING';

    return (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/80 backdrop-blur-xl">
            <motion.div
                initial={{ scale: 0.9, opacity: 0 }}
                animate={{ scale: 1, opacity: 1 }}
                className="bg-[#111] border border-white/10 w-full max-w-lg rounded-[2rem] p-8 shadow-2xl"
            >
                <div className="flex justify-between items-center mb-8">
                    <h2 className="text-2xl font-black text-white">Seguir Nueva Ballena</h2>
                    <button onClick={onClose} className="p-2 hover:bg-white/10 rounded-full text-white"><X size={24} /></button>
                </div>

                <div className="space-y-6">
                    <div>
                        <label className="text-sm font-bold text-gray-500 uppercase tracking-wide">Wallet Address or ENS</label>
                        <input
                            value={address}
                            onChange={(e) => setAddress(e.target.value)}
                            onKeyDown={handleKeyDown}
                            placeholder="0x... o vitalik.eth"
                            autoFocus
                            className={`w-full px-4 py-4 bg-black border rounded-2xl outline-none text-xl font-mono mt-2 transition-all text-white placeholder-gray-700 ${
                                isHexAddress ? 'border-green-500/60 focus:border-green-500' :
                                ensPreview.state === 'ok' ? 'border-green-500/60 focus:border-green-500' :
                                ensPreview.state === 'error' ? 'border-indigo-500/60 focus:border-indigo-500' :
                                'border-white/10 focus:border-[#25D366]'
                            }`}
                        />
                        {/* Instant visual feedback */}
                        <div className="mt-2 h-5">
                            {isHexAddress && (
                                <p className="text-xs text-green-400 font-bold flex items-center gap-1">
                                    <span className="w-2 h-2 bg-green-400 rounded-full inline-block" />
                                    Valid 0x address  ready to track
                                </p>
                            )}
                            {isEnsInput && ensPreview.state === 'resolving' && (
                                <p className="text-xs text-emerald-400 font-bold flex items-center gap-2">
                                    <span className="w-3 h-3 border-2 border-emerald-400/40 border-t-emerald-400 rounded-full animate-spin inline-block" />
                                    Buscando en ENS...
                                </p>
                            )}
                            {isEnsInput && ensPreview.state === 'ok' && ensPreview.resolved && (
                                <p className="text-xs text-green-400 font-bold flex items-center gap-1">
                                    <span className="w-2 h-2 bg-green-400 rounded-full inline-block" />
                                    {ensPreview.resolved.slice(0, 6)}...{ensPreview.resolved.slice(-4)}
                                </p>
                            )}
                            {isEnsInput && ensPreview.state === 'error' && (
                                <p className="text-xs text-amber-400 font-bold">ENS not found. Try with the 0x address.</p>
                            )}
                        </div>
                    </div>

                    <div>
                        <label className="text-sm font-bold text-gray-500 uppercase tracking-wide">Etiqueta</label>
                        <input
                            value={label}
                            onChange={(e) => setLabel(e.target.value)}
                            onKeyDown={handleKeyDown}
                            placeholder="Ej: BlackRock Ledger"
                            className="w-full px-4 py-4 bg-black border border-white/10 rounded-2xl outline-none text-xl mt-2 transition-all focus:border-[#25D366] text-white placeholder-gray-700"
                        />
                    </div>

                    <button
                        onClick={handleSubmit}
                        disabled={isAdding}
                        className={`w-full py-5 rounded-2xl font-black text-xl transition-all shadow-xl flex items-center justify-center gap-3 ${
                            isAdding
                            ? 'bg-emerald-800 cursor-wait text-white/70'
                            : isHexAddress || ensPreview.state === 'ok'
                            ? 'bg-emerald-600 hover:bg-[#25D366] text-white hover:scale-[1.02] shadow-emerald-900/40'
                            : 'bg-white/10 text-white/50 cursor-default'
                        }`}
                    >
                        {isAdding && <div className="w-5 h-5 border-3 border-white/30 border-t-white rounded-full animate-spin" />}
                        {buttonLabel}
                    </button>

                    <p className="text-center text-xs text-gray-600">
                        Tip: 0x addresses are added instantly. ENS is resolved automatically.
                    </p>
                </div>
            </motion.div>
        </div>
    );
}


