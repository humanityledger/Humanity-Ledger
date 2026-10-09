"use client";
import React, { useState, useCallback, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { toast } from 'sonner';
import { useWalletStore, NETWORKS, NetworkId } from '@/lib/store/wallet-store';
import { useVIPStore } from '@/lib/vip-store';
import { SettingsView } from '@/components/settings/SettingsView';
import { useSystemSignOut } from '@/hooks/useSystemSignOut';
import { useFeeData } from 'wagmi';
import { formatUnits } from 'viem';
import { useSystemAccount } from '@/hooks/useSystemAccount';
import ReceiveHub from '@/components/wallet/ReceiveHub';
import QRScannerModal from '@/components/wallet/QRScannerModal';
import SecurityVault from '@/components/wallet/SecurityVault';
import SettingsPanel from '@/components/wallet/SettingsPanel';
import { useRealWalletData } from '@/hooks/useRealWalletData';
import { QRCodeSVG } from 'qrcode.react';
import { MetaMaskNetworkSelector } from '@/components/portfolio/MetaMaskNetworkSelector';
import { QuantumHoldingsEngine } from '@/components/portfolio/QuantumHoldingsEngine';
import { AztecPrivacyTerminal } from '@/components/portfolio/AztecPrivacyTerminal';
import { AztecIdentityCard } from '@/components/portfolio/AztecIdentityCard';
import { SecurityAllowances } from '@/components/portfolio/SecurityAllowances';
import { ContractDeployerView } from '@/components/portfolio/ContractDeployerView';
import { TransactionManagerView } from '@/components/portfolio/TransactionManager';
import { HDAccountManager } from '@/components/portfolio/HDAccountManager';
import { SmartAccountTerminal } from '@/components/portfolio/SmartAccountTerminal';
import { OmnichainBridgeView } from '@/components/portfolio/OmnichainBridgeView';
import { TransactionHistory } from '@/components/portfolio/TransactionHistory';
import { QuantumDeFiPositions } from '@/components/portfolio/QuantumDeFiPositions';
import { PerformanceChart } from '@/components/portfolio/PerformanceChart';
import { Download, ArrowRightLeft, Route, Send, QrCode, Scan, Activity, Hexagon, Shield, Settings, LogOut, Lock } from 'lucide-react';
import { NativeSwapView } from '@/components/portfolio/NativeSwapView';
import { NativeBridgeView } from '@/components/portfolio/NativeBridgeView';
import { NativeBuyView } from '@/components/portfolio/NativeBuyView';
import { NativeSendView } from '@/components/portfolio/NativeSendView';
import { SystemFooter } from '@/components/landing/SystemFooter';
import { useAztecNative } from '@/context/AztecNativeContext';
import { Zap } from 'lucide-react';
import { formatQd } from '@/lib/qd';
import { useSettings } from '@/src/context/SettingsContext';


// AUDIT FIX #6: Live ECB exchange rates — replaces the hardcoded 0.92 "video demo" rate.
// Module-level cache: one fetch per 5 minutes across all component instances.
let _eurRateCache: { rate: number; ts: number } | null = null;
const ECB_RATE_TTL = 5 * 60 * 1000; // 5 minutes

async function fetchEurUsdRate(): Promise<number> {
  if (_eurRateCache && Date.now() - _eurRateCache.ts < ECB_RATE_TTL) {
    return _eurRateCache.rate;
  }
  try {
    // ECB daily reference rates — free, no auth, no CORS issues via our proxy
    const res = await fetch('/api/fx/eur-rate', { cache: 'no-store' });
    if (res.ok) {
      const { rate } = await res.json();
      if (rate && typeof rate === 'number' && rate > 0) {
        _eurRateCache = { rate, ts: Date.now() };
        return rate;
      }
    }
  } catch {
    // fall through to hardcoded fallback
  }
  return 0.92; // ECB fallback if proxy unavailable
}

function useLiveEurRate() {
  const [eurRate, setEurRate] = React.useState(0.92);
  React.useEffect(() => {
    fetchEurUsdRate().then(r => setEurRate(r)).catch(() => {});
  }, []);
  return eurRate;
}






// Legacy VaultUnlockScreen removed.

const truncate = (str: string, len: number) => {
    if (!str) return '';
    if (str.length <= len) return str;
    const charsToShow = len - 3;
    const frontChars = Math.ceil(charsToShow / 2);
    const backChars = Math.floor(charsToShow / 2);
    return str.substring(0, frontChars) + '...' + str.substring(str.length - backChars);
};

export function InstitutionalPortfolioView() {
    const balance = useWalletStore(s => s.balance);
    const updateBalance = useWalletStore(s => s.updateBalance);
    const activeNetwork = useWalletStore(s => s.activeNetwork);
    const restoreFromCloud = useWalletStore(s => s.restoreFromCloud);
    const unlockVault = useWalletStore(s => s.unlockVault);
    const passwordHash = useWalletStore(s => s.passwordHash);
    const isLocked = useWalletStore(s => s.isLocked);
    
    const setDisplayCurrency = useWalletStore(s => s.setDisplayCurrency);
    const { address, isLocalSystemWallet, isConnected, isEmailAuth } = useSystemAccount();
    const { assets, totalBalance } = useRealWalletData([], address || undefined);
    const liveEurRate = useLiveEurRate(); // AUDIT FIX: live ECB rate
    const { hideBalances, currency: settingsCurrency, toggleHideBalances } = useSettings();
    const displayCurrency = settingsCurrency || "USD";

    
    // We keep 'HOME' as the main view, and overlay modals for actions
    const [view, setView] = useState<'HOME'|'NETWORK'|'CREATE'|'SHIELD'|'SECURITY'|'DEPLOY'|'MEMPOOL'|'SMART_ACCOUNT'|'OMNICHAIN'|'SWAP'|'BRIDGE'|'BUY'|'SEND'|'QDS'>('HOME');
    
    // Modal states for full universal capability
    const [showReceive, setShowReceive] = useState(false);
    const [showScan, setShowScan] = useState(false);
    const [showAccounts, setShowAccounts] = useState(false);
    const [showSettings, setShowSettings] = useState(false);
    
    // MiCA License Lock State
    const [micaLockType, setMicaLockType] = useState<'SWAP' | 'SEND' | 'RECEIVE' | 'BRIDGE' | null>(null);
    
    const [prefilledAddress, setPrefilledAddress] = useState('');
    const [loading, setLoading] = useState(false);
    const [isHydrated, setIsHydrated] = useState(false);

    const refreshBalance = useCallback(async () => {
        if (!address) return;
        setLoading(true);
        try {
            await updateBalance();
        } catch (e) {
            console.error('[PORTFOLIO] On-chain sync failure:', e);
        } finally {
            setLoading(false);
        }
    }, [address, updateBalance]);

    const handleSend = useCallback(() => {
        setView('SEND');
    }, []);

    const handleQds = useCallback(() => {
        setView('QDS');
    }, []);

    // INFINITE LOOP FIX 1: restoreFromCloud is not a stable reference from Zustand.
    // Depending on [address, restoreFromCloud] caused it to re-fire every render.
    // Use a ref guard to call it only once on mount.
    const hasRestoredRef = useRef(false);
    useEffect(() => {
        setIsHydrated(true);
        if (!hasRestoredRef.current) {
            hasRestoredRef.current = true;
            if (!address) restoreFromCloud();
        }
    // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);

    // INFINITE LOOP FIX 2: refreshBalance is a useCallback that depends on [address, updateBalance].
    // updateBalance from Zustand is not a stable reference, so refreshBalance gets a new identity
    // on every render, causing this effect to fire continuously.
    // Fix: depend only on [isHydrated, address] which are stable primitives.
    useEffect(() => {
        if (isHydrated && address) {
            refreshBalance();
        }
    // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [isHydrated, address]);

    const ethPrice = useVIPStore(s => s.ethPrice);
    const btcPrice = useVIPStore(s => s.btcPrice) || 0;

    const getExchangeRate = (currency: string) => {
        // AUDIT FIX: EUR now uses the live ECB rate fetched on mount.
        // BTC uses live price from VIP store.
        // USD is always 1:1.
        if (currency === 'EUR') return liveEurRate;
        if (currency === 'BTC') return 1 / btcPrice;
        return 1; // USD
    };


    const getCurrencySymbol = (currency: string) => {
        if (currency === 'EUR') return '€';
        if (currency === 'BTC') return '₿';
        return '$';
    };

    const rate = getExchangeRate(displayCurrency);
    const symbol = getCurrencySymbol(displayCurrency);

    if (!isHydrated) {
        return (
            <div className="flex items-center justify-center min-h-[100vh] bg-white text-zinc-900 text-[10px] uppercase tracking-widest font-bold">
                Loading...
            </div>
        );
    }

    const getScannerBase = (netId: string) => {
        switch(netId) {
            case 'polygon': return 'https://polygonscan.com';
            case 'arbitrum': return 'https://arbiscan.io';
            case 'optimism': return 'https://optimistic.etherscan.io';
            case 'base': return 'https://basescan.org';
            case 'bsc': return 'https://bscscan.com';
            case 'worldchain': return 'https://worldscan.org';
            default: return 'https://etherscan.io';
        }
    };
    const scannerBase = getScannerBase(activeNetwork);
    const priceOracle = ethPrice;
    const balanceFiat = `${(parseFloat(balance || "0") * priceOracle * rate).toFixed(2)}`;

    return (
        <div className="flex flex-col relative text-zinc-900 selection:bg-zinc-900/10 min-h-[100vh] bg-white font-sans overflow-x-hidden">
            <AnimatePresence mode="wait">
                {view === 'HOME' && (
                    <HomeView key="home"
                        address={address}
                        balance={balance}
                        balanceFiat={balanceFiat}
                        loading={loading}
                        activeNetwork={activeNetwork}
                        onRefresh={refreshBalance}
                        onSend={() => setView('SEND')}
                        onReceive={() => setMicaLockType('RECEIVE')}
                        onCreate={() => setView('BUY')}
                        onBuy={() => setView('BUY')}
                        onSwap={() => setMicaLockType('SWAP')}
                        onBridge={() => setMicaLockType('BRIDGE')}
                        onNetworkClick={() => setView('NETWORK')}
                        onSettingsClick={() => setShowSettings(true)}
                        onAccountsClick={() => setShowAccounts(true)}
                        onScan={() => setShowScan(true)}
                        scannerBase={scannerBase}
                        
                        
                        
                        
                        
                        
                        onQds={handleQds}
                        assets={assets || []}
                        totalBalance={totalBalance}
                        displayCurrency={displayCurrency}
                        setDisplayCurrency={setDisplayCurrency}
                        rate={rate}
                        symbol={symbol}
                        isEmailAuth={isEmailAuth}
                    />
                )}
                {/* Embedded older views for deep protocol interactions */}
                {view === 'NETWORK' && <NetworkView key="network" onBack={() => setView('HOME')} />}

                {view === 'SHIELD' && <AztecPrivacyTerminal key="shield" onBack={() => setView('HOME')} />}
                {view === 'SECURITY' && <SecurityAllowances key="security" onBack={() => setView('HOME')} />}
                {view === 'DEPLOY' && <ContractDeployerView key="deploy" onBack={() => setView('HOME')} />}
                {view === 'MEMPOOL' && <TransactionManagerView key="mempool" onBack={() => setView('HOME')} />}
                {view === 'SMART_ACCOUNT' && <SmartAccountTerminal key="smart_account" onBack={() => setView('HOME')} />}
                {view === 'OMNICHAIN' && <OmnichainBridgeView key="omnichain" onBack={() => setView('HOME')} />}
                {view === 'SWAP' && <NativeSwapView key="swap" address={address} onBack={() => setView('HOME')} />}
                {view === 'BRIDGE' && <NativeBridgeView key="bridge" onBack={() => setView('HOME')} />}
                {view === 'BUY' && <NativeBuyView key="buy" address={address} onBack={() => setView('HOME')} />}
                {view === 'SEND' && <NativeSendView key="send" onBack={() => setView('HOME')} />}
            </AnimatePresence>

            {micaLockType && (
                <div className="fixed inset-0 z-[110] flex items-center justify-center bg-zinc-900/40 backdrop-blur-sm p-6" onClick={() => setMicaLockType(null)}>
                    <div className="bg-white p-8 max-w-sm w-full shadow-2xl border border-zinc-900/10 flex flex-col items-center text-center" onClick={e => e.stopPropagation()}>
                        <div className="w-16 h-16 bg-zinc-100 flex items-center justify-center mb-6 rounded-full">
                            <Lock className="text-zinc-900" size={24} />
                        </div>
                        <h3 className="text-sm font-black uppercase tracking-[0.2em] mb-3">MiCA License Required</h3>
                        <p className="text-[10px] text-zinc-500 leading-relaxed mb-6">Your institutional account requires regulatory clearance for {micaLockType.toLowerCase()} operations. Please contact your compliance officer.</p>
                        <button onClick={() => setMicaLockType(null)} className="w-full py-3 bg-zinc-900 text-white text-[10px] uppercase tracking-widest font-bold">ACKNOWLEDGE</button>
                    </div>
                </div>
            )}

            {showReceive && (
                <div className="fixed inset-0 z-[100] flex items-center justify-center bg-white/90 backdrop-blur-sm" onClick={() => setShowReceive(false)}>
                    <div className="w-full max-w-5xl max-h-[90vh] bg-white border border-zinc-900/10 shadow-2xl flex flex-col" onClick={e => e.stopPropagation()}>
                        <div className="flex items-center justify-between px-8 py-5 border-b border-zinc-900/10">
                            <h2 className="text-[11px] font-black uppercase tracking-[0.3em] text-zinc-900">Receive Assets</h2>
                            <button onClick={() => setShowReceive(false)} className="font-black text-[9px] uppercase tracking-widest text-zinc-900/40 hover:text-zinc-900 transition-colors border border-zinc-900/10 px-3 py-2">[CLOSE]</button>
                        </div>
                        <div className="overflow-y-auto flex-1">
                            <ReceiveHub addresses={[
                                { network: 'Ethereum', address: address || '0x...', token: 'ETH', chainId: 1 },
                                { network: 'Polygon', address: address || '0x...', token: 'MATIC', chainId: 137 },
                                { network: 'Arbitrum', address: address || '0x...', token: 'ETH', chainId: 42161 },
                                { network: 'Base', address: address || '0x...', token: 'ETH', chainId: 8453 },
                                { network: 'Optimism', address: address || '0x...', token: 'ETH', chainId: 10 },
                            ]} />
                        </div>
                    </div>
                </div>
            )}

            <QRScannerModal 
                isOpen={showScan} 
                onClose={() => setShowScan(false)}
                onScan={(data) => {
                    const addr = data.startsWith('ethereum:') ? data.replace('ethereum:', '').split('@')[0].split('?')[0] : data;
                    setShowScan(false);
                    toast.success(`Scanned: ${addr}`);
                    setTimeout(() => handleSend(), 500);
                }}
            />

            <AnimatePresence>
                {showSettings && <SettingsView onClose={() => setShowSettings(false)} />}
            </AnimatePresence>
            {showAccounts && (
                <div className="fixed inset-0 z-[100] flex items-center justify-center bg-white/90 backdrop-blur-sm p-4" onClick={() => setShowAccounts(false)}>
                    <div className="w-full max-w-4xl bg-white border border-zinc-900/10 shadow-2xl overflow-hidden flex flex-col max-h-[90vh]" onClick={e => e.stopPropagation()}>
                        <div className="p-4 border-b border-zinc-900/10 flex justify-between items-center bg-zinc-900/5">
                            <h2 className="text-lg font-black uppercase tracking-widest text-zinc-900">Account Manager</h2>
                            <button onClick={() => setShowAccounts(false)} className="text-zinc-900/40 hover:text-zinc-900 font-bold text-xs uppercase">Close</button>
                        </div>
                        <div className="overflow-y-auto p-4">
                            <SecurityVault />
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}

function HomeView({ address, balance, balanceFiat, totalBalance, activeNetwork, loading, onRefresh, onSend, onReceive, onScan, onCreate, onBuy, onSwap, onBridge, onNetworkClick, onSettingsClick, onAccountsClick, scannerBase, onShield, onSecurity, onSmartAccount, onDeploy, onOmnichain, onMempool, onQds, assets, displayCurrency, setDisplayCurrency, rate, symbol, isEmailAuth }: any) {
    const { hideBalances, toggleHideBalances } = useSettings();
    const [copied, setCopied] = useState(false);
    const [isDisconnecting, setIsDisconnecting] = useState(false);
    const [activeTab, setActiveTab] = useState<'TOKENS'|'ACTIVITY'|'AZTEC'>('TOKENS');
    const { nuclearDisconnect } = useSystemSignOut();
    const networkInfo = NETWORKS[activeNetwork as NetworkId] || NETWORKS.polygon;

    const activeChainId = NETWORKS[activeNetwork as NetworkId]?.chainId || 1;
    const { data: feeData } = useFeeData({ chainId: activeChainId });
    
    const handleDisconnect = async () => {
        setIsDisconnecting(true);
        await nuclearDisconnect();
    };

    const copy = () => {
        if (!address) return;
        navigator.clipboard.writeText(address);
        setCopied(true);
        setTimeout(() => setCopied(false), 2000);
        toast.success(isEmailAuth ? "Email Copied" : "Address Captured");
    };

    return (
        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="flex flex-col w-full min-h-[100vh] bg-white">

            {/* Disconnecting overlay */}
            {isDisconnecting && (
                <div className="fixed inset-0 z-[9999] bg-white flex flex-col items-center justify-center">
                    <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-zinc-900 mb-4"></div>
                    <p className="text-[10px] font-bold uppercase tracking-widest text-zinc-900/50">Signing out...</p>
                </div>
            )}

            {/* ── Top Navigation Bar ── */}
            <header className="flex flex-col md:flex-row md:items-center justify-between px-6 md:px-10 py-5 border-b border-zinc-900/10 bg-white">
                <div className="flex flex-col gap-1 items-start">
                    <span className="text-[9px] uppercase tracking-[0.3em] font-black text-zinc-900/30">Network</span>
                    <MetaMaskNetworkSelector 
                        activeNetworkId={activeChainId}
                        onNetworkChange={(id) => {
                            const networkEntries = Object.entries(NETWORKS);
                            const found = networkEntries.find(([_idx, config]) => config.chainId === id);
                            if (found) {
                                useWalletStore.getState().setNetwork(found[0] as NetworkId);
                            }
                        }} 
                    />
                </div>

                <div className="hidden md:flex flex-col items-center">
                    <span className="text-[11px] font-black uppercase tracking-[0.4em] text-zinc-900/20">Humanity Ledger</span>
                </div>

                {address && (
                    <div className="flex flex-wrap gap-2 items-center justify-end mt-3 md:mt-0">
                        {/* Currency Toggle */}
                        <div className="flex bg-zinc-900/[0.03] border border-zinc-900/10 rounded-md p-0.5 mr-2">
                            {(['EUR', 'USD', 'BTC'] as const).map(c => (
                                <button 
                                    key={c}
                                    onClick={() => setDisplayCurrency(c)}
                                    className={`px-3 py-1 text-[9px] font-black uppercase tracking-widest rounded-sm transition-all ${displayCurrency === c ? 'bg-white text-zinc-900 shadow-sm border border-zinc-900/10' : 'text-zinc-900/40 hover:text-zinc-900'}`}
                                >
                                    {c}
                                </button>
                            ))}
                        </div>

                        <button onClick={onAccountsClick} className="flex items-center gap-2 border border-zinc-900/10 bg-white hover:bg-zinc-900/5 transition-all px-4 py-2 rounded-md group">
                            <Shield size={12} className="text-zinc-900/40 group-hover:text-zinc-900" />
                            <span className="text-[10px] font-black uppercase tracking-widest text-zinc-900 hidden sm:inline">Vault</span>
                        </button>
                        <button onClick={onSettingsClick} className="flex items-center justify-center border border-zinc-900/10 bg-white hover:bg-zinc-900/5 transition-all p-2 rounded-md group">
                            <Settings size={14} className="text-zinc-900/40 group-hover:text-zinc-900" />
                        </button>
                        <button onClick={handleDisconnect} className="flex items-center justify-center border border-zinc-900/10 bg-white hover:bg-red-50 hover:border-red-200 transition-all p-2 rounded-md group">
                            <LogOut size={14} className="text-zinc-900/40 group-hover:text-red-500" />
                        </button>
                    </div>
                )}
            </header>

            {/* ── Main Dashboard Hero ── */}
            <section className="w-full flex flex-col items-center justify-center py-10 px-4 md:py-16 md:px-10 border-b border-zinc-900/10 bg-zinc-900/[0.02]">
                <div className="flex flex-col items-center mb-6">
                    <span onClick={toggleHideBalances} className="text-[10px] uppercase font-black tracking-[0.3em] text-zinc-900/40 mb-3 cursor-pointer hover:text-zinc-900 transition-colors">Portfolio Value {hideBalances ? "(Hidden)" : ""}</span>
                    <h1 className="text-5xl md:text-7xl font-sans tracking-tighter text-zinc-900 flex items-baseline gap-1">
                        <span className="text-3xl md:text-5xl opacity-40 font-serif mr-1">{symbol}</span>
                        {hideBalances ? "****" : ((parseFloat(totalBalance) || 0) * rate).toFixed(2).split('.')[0]}
                        <span className="text-2xl md:text-4xl opacity-50 font-serif">
                           {hideBalances ? "" : "." + (((parseFloat(totalBalance) || 0) * rate).toFixed(2).split('.')[1] || '00')}
                        </span>
                    </h1>
                </div>
                <div className="flex flex-wrap items-center justify-center gap-3 mb-8">
                    <p className="text-[11px] tracking-[0.18em] font-mono text-zinc-900/50 border border-zinc-900/10 px-4 py-1.5">
                        {hideBalances ? "****" : balance} {networkInfo.currency} ({symbol}{hideBalances ? "****" : balanceFiat})
                    </p>
                </div>

                {/* Performance Chart (MetaMask / Rainbow Style) */}
                {address && (
                    <div className="w-full max-w-4xl h-[160px] mb-8">
                        <PerformanceChart />
                    </div>
                )}

                {address ? (
                    <div className="flex flex-col items-center gap-3 w-full max-w-lg mx-auto">
                        <button onClick={copy} className="w-full bg-zinc-900 text-white px-6 py-4 flex items-center justify-between hover:bg-zinc-900/80 transition-all group">
                            <div className="flex flex-col items-start">
                                <span className="text-[8px] uppercase tracking-[0.3em] opacity-40 mb-1">{isEmailAuth ? 'Linked Account' : 'Your Address'}</span>
                                <code className="text-sm font-mono tracking-wider">{isEmailAuth ? address.replace('email_', '') : truncate(address, 26)}</code>
                            </div>
                            <span className="text-[9px] uppercase font-black tracking-widest opacity-50 group-hover:opacity-100 transition-opacity">{copied ? 'Copied' : 'Copy'}</span>
                        </button>
                        {!isEmailAuth && (
                            <a href={`${scannerBase}/address/${address}`} target="_blank" rel="noopener noreferrer"
                                className="w-full border border-zinc-900/10 bg-white px-6 py-3 flex items-center justify-center text-[10px] font-black uppercase tracking-[0.2em] text-zinc-900 hover:bg-zinc-900/5 transition-all">
                                View on Explorer
                            </a>
                        )}
                    </div>
                ) : (
                    <div className="flex flex-col items-center gap-5 mt-4 p-10 bg-white border border-zinc-900/10 max-w-sm mx-auto">
                        <h4 className="text-sm font-black uppercase tracking-wider text-zinc-900">No Wallet Connected</h4>
                        <p className="text-xs text-zinc-900/40 leading-relaxed text-center">Create or import a wallet to start using the portfolio.</p>
                        <button onClick={onCreate} className="w-full bg-zinc-900 text-white px-8 py-4 text-[11px] uppercase tracking-[0.25em] font-black hover:bg-zinc-900/80 transition-all">
                            Connect Wallet
                        </button>
                    </div>
                )}
            </section>

            {/* ── Main Layout: Minimalist Stacked Architecture ── */}
            {address && (
                <section className="w-full max-w-6xl mx-auto px-4 md:px-10 py-6">
                    
                    {/* Horizontal scrollable Action buttons (Mobile First) */}
                    <div className="mb-8">
                        <div className="flex gap-3 overflow-x-auto no-scrollbar pb-4 -mx-4 px-4 md:mx-0 md:px-0 md:flex-wrap md:justify-center">
                            {!isEmailAuth && <ActionPill label="Deposit" icon={<Download size={14} />} onClick={onBuy} />}
                            {!isEmailAuth && <ActionPill label="Swap" icon={<ArrowRightLeft size={14} />} onClick={onSwap} />}
                            {!isEmailAuth && <ActionPill label="Bridge" icon={<Route size={14} />} onClick={onBridge} />}
                            {!isEmailAuth && <ActionPill label="Send" icon={<Send size={14} />} onClick={onSend} />}
                            {!isEmailAuth && <ActionPill label="Receive" icon={<QrCode size={14} />} onClick={onReceive} />}
                            <ActionPill label="Scan" icon={<Scan size={14} />} onClick={onScan} />
                        </div>
                    </div>

                    {/* ── Sovereign Identity Banner (for non-connected identities) ── */}
                    <AztecIdentityBanner onOpenAztec={() => setActiveTab('AZTEC')} />

                    {/* Minimalist Tabs Panel */}
                    <div className="bg-white border border-zinc-900/10 overflow-hidden flex flex-col shadow-sm rounded-sm">
                        <div className="flex border-b border-zinc-900/10 overflow-x-auto no-scrollbar snap-x">
                            {(['TOKENS', 'ACTIVITY', 'AZTEC'] as const).map(t => (
                                <AztecAwareTabButton
                                    key={t}
                                    tab={t}
                                    activeTab={activeTab}
                                    onClick={() => setActiveTab(t)}
                                />
                            ))}
                        </div>
                        <div className="flex-1 bg-white flex flex-col p-4 md:p-8 min-h-[400px]">
                            {activeTab === 'TOKENS' && <QuantumHoldingsEngine address={address} activeNetwork={activeNetwork} scannerBase={scannerBase} userAssets={assets} displayCurrency={displayCurrency} rate={rate} symbol={symbol} onSwapRequest={onSwap} onBridgeRequest={onBridge} onQdsTransfer={onQds} />}
                            {activeTab === 'ACTIVITY' && <TransactionHistory address={address} scannerBase={scannerBase} activeNetwork={activeNetwork} />}
                            {activeTab === 'AZTEC' && <div className="w-full max-w-4xl mx-auto"><AztecIdentityCard /></div>}
                        </div>
                    </div>
                </section>
            )}

            {/* ── Downpage Footer ── */}
            <SystemFooter />

        </motion.div>
    );
}

function ActionBtn({ label, icon, onClick }: any) {
    return (
        <button
            onClick={onClick}
            className="flex flex-col items-center justify-center p-4 border border-zinc-900/5 hover:border-zinc-900 hover:bg-zinc-900 hover:text-white hover:shadow-xl transition-all duration-300 group bg-zinc-900/[0.02] gap-3"
        >
            <div className="text-zinc-900/60 group-hover:text-white transition-colors">
                {icon}
            </div>
            <span className="text-[10px] font-bold uppercase tracking-widest">{label}</span>
        </button>
    );
}

/** Inline QD balance badge in the portfolio header */
function QDBadgeInline({ onClickAztec }: { onClickAztec: () => void }) {
    const { balance, aztecAddress } = useAztecNative();
    if (!aztecAddress) {
        return (
            <button
                onClick={onClickAztec}
                className="flex items-center gap-1.5 px-3 py-1.5 border border-amber-300 bg-amber-50 rounded-full text-amber-700 hover:bg-amber-100 transition-colors animate-pulse"
            >
                <Zap size={10} />
                <span className="text-[9px] font-black uppercase tracking-widest">CLAIM 1000 QDs</span>
            </button>
        );
    }
    return (
        <button
            onClick={onClickAztec}
            className="flex items-center gap-1.5 px-3 py-1.5 border border-zinc-900/10 bg-zinc-900/5 rounded-full hover:bg-zinc-900 hover:text-white transition-colors"
        >
            <Zap size={10} className="text-amber-500" />
            <span className="text-[9px] font-black uppercase tracking-widest">{formatQd(balance)} QD</span>
        </button>
    );
}

/** Prominent Sovereign Identity banner shown above the tabs when identity is not connected */
function AztecIdentityBanner({ onOpenAztec }: { onOpenAztec: () => void }) {
    const { aztecAddress, balance } = useAztecNative();
    if (aztecAddress) return null; // Already connected — no banner needed

    return (
        <div className="mb-6 relative overflow-hidden border border-amber-200 bg-gradient-to-r from-amber-50 via-orange-50 to-amber-50 rounded-lg p-4 flex flex-col sm:flex-row items-start sm:items-center gap-4">
            {/* Animated glow */}
            <div className="absolute inset-0 bg-gradient-to-r from-transparent via-amber-100/40 to-transparent animate-pulse pointer-events-none" />
            <div className="flex items-center gap-3 flex-1 relative z-10">
                <div className="w-10 h-10 rounded-full bg-amber-100 border border-amber-300 flex items-center justify-center flex-shrink-0">
                    <Zap size={18} className="text-amber-600" />
                </div>
                <div>
                    <div className="font-black text-[11px] uppercase tracking-[0.2em] text-amber-800">Claim Your 10 QD Genesis Airdrop</div>
                    <div className="text-[10px] text-amber-700/70 mt-0.5 font-mono">
                        Connect your Sovereign Identity to unlock Chat, Studio Passports &amp; Noir Sandbox.
                    </div>
                </div>
            </div>
            <button
                onClick={onOpenAztec}
                className="relative z-10 flex-shrink-0 px-5 py-2.5 bg-amber-600 hover:bg-amber-700 text-white text-[10px] font-black uppercase tracking-widest rounded-lg transition-all shadow-sm hover:shadow-md active:scale-[0.98]"
            >
                Connect Identity →
            </button>
        </div>
    );
}

/** Tab button that's visually upgraded for Sovereign Identity */
function AztecAwareTabButton({ tab, activeTab, onClick }: { tab: string; activeTab: string; onClick: () => void }) {
    const { aztecAddress, balance } = useAztecNative();
    const isAztec = tab === 'AZTEC';
    const isActive = activeTab === tab;
    const hasIdentity = !!aztecAddress;

    const label = tab === 'TOKENS' ? 'Assets' : tab === 'DEFI' ? 'DeFi' : tab === 'ACTIVITY' ? 'History' : 'Sovereign Identity';

    return (
        <button
            onClick={onClick}
            className={`snap-start px-4 md:px-6 py-4 text-[10px] font-black uppercase tracking-widest whitespace-nowrap transition-all flex-1 text-center relative ${
                isActive
                    ? isAztec
                        ? 'bg-gradient-to-r from-zinc-900 to-zinc-800 text-white'
                        : 'bg-zinc-900 text-white'
                    : 'text-zinc-900/50 hover:text-zinc-900 hover:bg-zinc-900/[0.03] border-r border-zinc-900/10 last:border-0'
            }`}
        >
            <span className="flex items-center justify-center gap-1.5">
                {isAztec && <Zap size={10} className={isActive ? 'text-amber-400' : 'text-amber-500'} />}
                {label}
                {isAztec && !hasIdentity && (
                    <span className="inline-flex items-center justify-center w-4 h-4 bg-amber-500 text-white text-[7px] font-black rounded-full animate-pulse ml-1">
                        !
                    </span>
                )}
                {isAztec && hasIdentity && (
                    <span className="inline-flex items-center gap-0.5 px-1.5 py-0.5 bg-amber-500/20 text-amber-700 text-[7px] font-black rounded-full ml-1">
                        {formatQd(balance)} QD
                    </span>
                )}
            </span>
        </button>
    );
}

function ActionPill({ label, icon, onClick }: any) {
    return (
        <button
            onClick={onClick}
            className="flex items-center justify-center px-6 py-3 border border-zinc-900/10 hover:border-zinc-900 hover:bg-zinc-900 hover:text-white transition-all rounded-full bg-white gap-2 flex-none"
        >
            <div className="text-zinc-900/60 group-hover:text-white transition-colors">
                {icon}
            </div>
            <span className="text-[10px] font-bold uppercase tracking-widest whitespace-nowrap">{label}</span>
        </button>
    );
}

function ModalView({ title, onBack, children }: any) {
    return (
        <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: 10 }} className="flex flex-col max-w-xl mx-auto w-full pt-8 px-6 pb-20 font-mono min-h-full flex-1">
            <div className="flex items-center justify-between mb-8 pb-4 border-b border-zinc-900/10">
                <h2 className="text-lg font-black uppercase tracking-widest text-zinc-900">{title}</h2>
                <button onClick={onBack} className="text-[10px] uppercase tracking-widest font-bold text-zinc-900/40 hover:text-zinc-900 transition-colors border border-zinc-900/10 px-3 py-1">
                    CLOSE
                </button>
            </div>
            <div className="flex-1 flex flex-col min-h-0">
                {children}
            </div>
        </motion.div>
    );
}

function NetworkView({ onBack }: any) {
    const activeNetwork = useWalletStore(s => s.activeNetwork);
    const setNetwork = useWalletStore(s => s.setNetwork);
    return (
        <ModalView title="Protocol Selection" onBack={onBack}>
            <div className="grid grid-cols-1 gap-2">
                {Object.entries(NETWORKS).map(([id, data]) => (
                    <button key={id} onClick={() => { setNetwork(id as NetworkId); onBack(); }} className={`flex items-center justify-between p-5 border transition-all ${activeNetwork === id ? 'border-zinc-900 bg-zinc-900 text-white' : 'border-zinc-900/10 hover:border-zinc-900/30 bg-white text-zinc-900'}`}>
                        <div className="flex items-center gap-4">
                            <span className="font-bold uppercase tracking-widest text-xs">{data.name}</span>
                        </div>
                        <span className={`text-[10px] tracking-widest ${activeNetwork === id ? 'opacity-50' : 'opacity-30'}`}>{data.currency}</span>
                    </button>
                ))}
            </div>
        </ModalView>
    );
}

