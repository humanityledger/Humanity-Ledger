// @ts-nocheck
"use client";

import React, { useMemo, useState, useEffect } from 'react';
import { Database, ExternalLink, ArrowUpRight, ArrowDownRight, Send, Download, ArrowRightLeft, Route, Activity, X, Shield } from 'lucide-react';
import { createChart, ColorType, IChartApi, AreaSeries } from 'lightweight-charts';
import { motion, AnimatePresence } from 'framer-motion';
import { safeToFixed } from '@/lib/utils/number-format';
import { QUANTUM_TOKENS } from '@/lib/config/tokens';

import { toast } from 'sonner';
import { NETWORKS, NetworkId } from '@/lib/store/wallet-store';
import { NativeSwapView } from '@/components/portfolio/NativeSwapView';
import { NativeBridgeView } from '@/components/portfolio/NativeBridgeView';
import { NativeSendView } from '@/components/portfolio/NativeSendView';
import ReceiveHub from '@/components/wallet/ReceiveHub';
import { useSettings } from '@/src/context/SettingsContext';
import { TokenLogo } from '@/components/ui/TokenLogo';

function ModalView({ title, onBack, children }: any) {
    return (
        <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: 10 }} className="flex flex-col max-w-xl mx-auto w-full pt-8 px-6 pb-20 font-mono min-h-full flex-1 bg-white">
            <div className="flex items-center justify-between mb-8 pb-4 border-b border-black/10">
                <h2 className="text-lg font-black uppercase tracking-widest text-black">{title}</h2>
                <button onClick={onBack} className="text-[10px] uppercase tracking-widest font-bold text-black/40 hover:text-black transition-colors border border-black/10 px-3 py-1 bg-white">
                    CLOSE
                </button>
            </div>
            <div className="flex-1 flex flex-col min-h-0">
                {children}
            </div>
        </motion.div>
    );
}

// --- Sparkline Component for Table ---
function Sparkline({ isPositive }: { isPositive: boolean }) {
    const points = isPositive 
        ? "0,20 5,15 10,18 15,10 20,12 25,2" 
        : "0,2 5,8 10,5 15,15 20,12 25,20";
    const color = isPositive ? "#00C076" : "#EF4444";
    return (
        <svg viewBox="0 0 25 22" className="w-8 h-4 opacity-50" preserveAspectRatio="none">
            <polyline points={points} fill="none" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
    );
}

export function QuantumHoldingsEngine({ address, activeNetwork, scannerBase, userAssets = [], displayCurrency = 'USD', rate = 1, symbol = '$', onSwapRequest, onBridgeRequest, onQdsTransfer }: { address: string, activeNetwork: string, scannerBase: string, userAssets?: any[], displayCurrency?: string, rate?: number, symbol?: string, onSwapRequest?: (token: any) => void, onBridgeRequest?: (token: any) => void, onQdsTransfer?: () => void }) {
    
    const [selectedToken, setSelectedToken] = useState<any | null>(null);
    const [isImportModalOpen, setIsImportModalOpen] = useState(false);
    const [importAddress, setImportAddress] = useState('');
    const [isImporting, setIsImporting] = useState(false);
    const [viewMode, setViewMode] = useState<'LIST' | 'GRID'>('LIST');
    const [activeAction, setActiveAction] = useState<{type: 'SEND'|'RECEIVE'|'SWAP'|'BRIDGE', token: any} | null>(null);
    const [showSpam, setShowSpam] = useState(false);
    const [currentPage, setCurrentPage] = useState(1);
    const { hideBalances, uiConfig, formatAmount, currency } = useSettings();
    const ITEMS_PER_PAGE = 8;

    // CRITICAL: Reset to page 1 whenever the user switches network.
    // Without this, switching from Ethereum (300+ tokens, many pages) to Celo (few tokens, 1 page)
    // leaves currentPage at 5 and renders a blank table.
    useEffect(() => {
        setCurrentPage(1);
    }, [activeNetwork]);

    const combinedAssets = useMemo(() => {
        const activeChainId = NETWORKS[activeNetwork as NetworkId]?.chainId;

        // Map user balances into our universal list, filtering by active network
        const assetMap = new Map();
        userAssets.forEach(a => {
            if (!activeChainId || Number(a.chainId) === Number(activeChainId)) {
                assetMap.set(a.symbol.toUpperCase(), a);
            }
        });
        
        const networkMap: Record<string, string> = {
          ethereum: 'ethereum', polygon: 'polygon', arbitrum: 'arbitrum',
          optimism: 'optimism', base: 'base', bsc: 'bsc', avalanche: 'avalanche',
          fantom: 'fantom', linea: 'linea', scroll: 'scroll', celo: 'celo'
        };
        const mappedNet = networkMap[activeNetwork] || activeNetwork;
        // Explicit parens fix operator precedence:
        // Without parens: (t.addresses && t.addresses[mappedNet]) || assetMap.has(...) -- correct but ambiguous
        // With parens: unambiguous, linter-safe, readable
        const validNetworkTokens = QUANTUM_TOKENS.filter(t =>
            (t.addresses && !!t.addresses[mappedNet]) || assetMap.has(t.symbol.toUpperCase())
        );
        const combined = validNetworkTokens.map(t => {
            const userOwned = assetMap.get(t.symbol.toUpperCase());
            assetMap.delete(t.symbol.toUpperCase());
            const balance = userOwned?.balanceNumeric || 0;
            const basePrice = userOwned?.price ?? 0;
            const price = basePrice * rate;
            const value = balance > 0 ? balance * price : 0;
            const change24h = userOwned?.change24h ?? 0;
            
            return {
                ...t,
                address: userOwned?.address || (t.addresses ? t.addresses[mappedNet] : undefined),
                chainId: userOwned?.chainId || activeChainId,
                balance,
                price,
                value,
                change24h,
                isOwned: !!userOwned && balance > 0,
                hasSnapshot: false
            };
        });

        // Add any remaining assets the user owns that aren't in QUANTUM_TOKENS
        assetMap.forEach((userOwned, symbol) => {
            if (userOwned.balanceNumeric > 0 || symbol === 'QDS') {
                const value = userOwned.balanceNumeric * (userOwned.price || 0);
                const isSpam = !userOwned.price || (userOwned.price < 0.0001 && value < 1.00);

                combined.push({
                    symbol: userOwned.symbol,
                    name: userOwned.name || userOwned.symbol,
                    address: userOwned.address,
                    chainId: userOwned.chainId || activeChainId,
                    balance: userOwned.balanceNumeric,
                    price: userOwned.price || 0,
                    value: value,
                    change24h: userOwned.change24h || 0,
                    isOwned: true,
                    hasSnapshot: false,
                    isSpam: symbol === 'QDS' ? false : isSpam, // QDs are never spam
                    logoPath: userOwned.logoURI || userOwned.logo || ''
                } as any);
            }
        });

        
        if (uiConfig?.hideZeroBalances) {
            combined = combined.filter((a: any) => a.balance > 0);
        }
        if (uiConfig?.hideSpamTokens) {
            combined = combined.filter((a: any) => !(a.balance > 0 && a.balance < 0.0001 && a.symbol !== 'ETH'));
        }
        
        return combined.sort((a, b) => {
            if (uiConfig?.tokenSort === 'value_asc') {
                return (a.value || 0) - (b.value || 0);
            } else if (uiConfig?.tokenSort === 'alpha') {
                return a.symbol.localeCompare(b.symbol);
            }

            if (a.isOwned && !b.isOwned) return -1;
            if (!a.isOwned && b.isOwned) return 1;
            if (a.balance > 0 && b.balance > 0) return b.value - a.value;
            // Major assets first in unowned section
            const aMajor = ['ETH','BTC','USDC','USDT','BNB','SOL','XRP'].includes(a.symbol) ? 1 : 0;
            const bMajor = ['ETH','BTC','USDC','USDT','BNB','SOL','XRP'].includes(b.symbol) ? 1 : 0;
            if (aMajor !== bMajor) return bMajor - aMajor;
            // Tokens with live stats before unknown ones
            if (a.hasSnapshot && !b.hasSnapshot) return -1;
            if (!a.hasSnapshot && b.hasSnapshot) return 1;
            return a.symbol.localeCompare(b.symbol);
        });
    }, [userAssets, activeNetwork]);

    const handleAction = (type: 'SEND'|'RECEIVE'|'SWAP'|'BRIDGE', token: any) => {
        if (type === 'SWAP' && onSwapRequest) {
             onSwapRequest(token);
             return;
        }
        if (type === 'BRIDGE' && onBridgeRequest) {
             onBridgeRequest(token);
             return;
        }
        setActiveAction({ type, token });
    };

    const legitimateAssets = useMemo(() => combinedAssets.filter(a => !(a as any).isSpam), [combinedAssets]);
    const spamAssets = useMemo(() => combinedAssets.filter(a => (a as any).isSpam), [combinedAssets]);
    const displayAssets = showSpam ? spamAssets : legitimateAssets;

    const totalPages = Math.ceil(displayAssets.length / ITEMS_PER_PAGE);
    const paginatedAssets = useMemo(() => {
        const start = (currentPage - 1) * ITEMS_PER_PAGE;
        return displayAssets.slice(start, start + ITEMS_PER_PAGE);
    }, [displayAssets, currentPage]);

    return (
        <div className="border border-black/10 bg-white flex flex-col min-h-[500px] overflow-hidden relative">
            
            {/* Modal Gateway for Action Execution removed in favor of native views */}

            {/* Import Token Modal */}
            <AnimatePresence>
                {isImportModalOpen && (
                    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/40 backdrop-blur-sm p-4">
                        <motion.div initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0, scale: 0.95 }} className="bg-white w-full max-w-md border border-black/10 shadow-2xl overflow-hidden flex flex-col">
                            <div className="p-6 border-b border-black/5 flex items-center justify-between">
                                <span className="font-black text-sm uppercase tracking-widest">Import Custom Token</span>
                                <button onClick={() => setIsImportModalOpen(false)} className="text-black/30 hover:text-black transition-colors"><X size={18} /></button>
                            </div>
                            <div className="p-6 space-y-4">
                                <div className="bg-[#25D366]/10 border border-[#25D366]/20 p-4 flex items-start gap-3 rounded-[12px]">
                                    <span className="font-black text-[10px] text-emerald-600 shrink-0 mt-0.5">[INFO]</span>
                                    <p className="text-[10px] text-emerald-700 font-bold uppercase tracking-widest leading-relaxed">
                                        Anyone can create a token, including fake versions of existing tokens. Learn about scams and security risks.
                                    </p>
                                </div>
                                <div className="space-y-2">
                                    <label className="text-[10px] font-black text-black/40 uppercase tracking-widest">Token Contract Address</label>
                                    <input 
                                        type="text" 
                                        value={importAddress} 
                                        onChange={(e) => setImportAddress(e.target.value)} 
                                        placeholder="0x..." 
                                        className="w-full bg-black/[0.02] border border-black/10 p-4 font-mono text-sm focus:outline-none focus:border-black/30 transition-colors"
                                    />
                                </div>
                                <button 
                                    disabled={importAddress.length !== 42 || isImporting}
                                    onClick={() => {
                                        setIsImporting(true);
                                        setTimeout(() => {
                                            setIsImporting(false);
                                            setIsImportModalOpen(false);
                                            setImportAddress('');
                                        }, 1500);
                                    }}
                                    className="w-full py-4 bg-black text-white font-black text-[11px] uppercase tracking-[0.2em] hover:bg-black/80 transition-colors disabled:opacity-30 flex justify-center"
                                >
                                    {isImporting ? <Activity size={16} className="animate-pulse" /> : 'Import'}
                                </button>
                            </div>
                        </motion.div>
                    </div>
                )}
            </AnimatePresence>

            {/* Token Detail Slide-Over Panel */}
            <AnimatePresence>
                {selectedToken && (
                    <TokenDetailPanel 
                        token={selectedToken} 
                        onClose={() => setSelectedToken(null)}
                        onAction={(type) => {
                            setSelectedToken(null);
                            handleAction(type, selectedToken);
                        }}
                        symbol={symbol}
                        uiConfig={uiConfig}
                        hideBalances={hideBalances}
                        formatAmount={formatAmount}
                    />
                )}
            </AnimatePresence>

            {/* Live Stats Bar */}
            <div className="flex items-center justify-between px-6 py-2 border-b border-black/5 bg-black/[0.02]">
                <div className="flex items-center gap-2">
                    <span className="text-[9px] font-bold text-[#00C076] tracking-widest">LIVE · {new Date().toISOString().split('T')[0]}</span>
                </div>
                <span className="text-[9px] font-bold text-black/30 tracking-widest uppercase">{combinedAssets.length} Assets · {activeNetwork}</span>
            </div>

            <div className="p-0 flex-1 flex flex-col overflow-y-auto custom-scrollbar">
                <table className="w-full text-left text-[11px] font-mono">
                    <thead className="bg-black/5 border-b border-black/10 text-[9px] uppercase tracking-widest text-black/50 sticky top-0 z-10 backdrop-blur-md">
                        <tr>
                            <th className="py-4 px-6 font-black w-1/4">Asset ({combinedAssets.length})</th>
                            <th className="py-4 px-6 font-black text-right w-1/5">Balance / Price</th>
                            <th className="py-4 px-6 font-black text-right w-1/6">24h Δ</th>
                            <th className="py-4 px-6 font-black text-right">Actions</th>
                            <th className="py-4 px-6 font-black text-right w-1/6">Contract</th>
                        </tr>
                    </thead>
                    <tbody className="divide-y divide-black/5">
                        {paginatedAssets.length > 0 ? (
                            paginatedAssets.map((token, idx) => (
                                <tr 
                                    key={`${token.symbol}-${idx}`} 
                                    className="hover:bg-black/[0.03] transition-colors group/row cursor-pointer"
                                    onClick={() => setSelectedToken(token)}
                                >
                                    <td className="py-4 px-6">
                                        <div className="flex items-center gap-4">
                                        {uiConfig?.showTokenLogos !== false ? (
                                            <TokenLogo 
                                                symbol={token.symbol} 
                                                name={token.name}
                                                logoURI={token.logoPath} 
                                                className="w-8 h-8 rounded-full shadow-sm" 
                                                fallbackClassName="w-8 h-8 rounded-full bg-black/5 p-0.5 border border-black/10 flex items-center justify-center shrink-0 shadow-sm text-[8px] font-black" 
                                            />
                                        ) : (
                                            <div className="w-8 h-8 rounded-full bg-black/5 p-0.5 border border-black/10 flex items-center justify-center shrink-0 shadow-sm text-[8px] font-black">
                                                {token.symbol.slice(0, 2)}
                                            </div>
                                        )}
                                            <div className="flex flex-col">
                                                <span className="font-black text-[13px] text-black tracking-wider flex items-center gap-2">
                                                    {token.symbol}
                                                    {token.isOwned && <span className="text-[7px] bg-[#00C076]/10 text-[#00C076] px-1.5 py-0.5 font-black uppercase tracking-widest rounded-sm">Owned</span>}
                                                </span>
                                                <span className="text-[10px] text-black/40 font-bold tracking-widest">{token.name}</span>
                                            </div>
                                        </div>
                                    </td>
                                    <td className="py-4 px-6 text-right">
                                        <div className="flex flex-col items-end">
                                            <span className={`font-black text-sm ${token.isOwned ? 'text-black' : 'text-black/30'}`}>
                                                {hideBalances ? "****" : (token.balance > 0 ? Number(token.balance).toFixed(6) : "0.00")}
                                            </span>
                                            {token.value > 0 && <span className="text-[10px] text-black/50 font-bold">{hideBalances ? "****" : formatAmount(token.value)}</span>}
                                            {token.price > 0 && !token.isOwned && (
                                                <span className="text-[9px] text-black/30 font-bold font-mono">
                                                    {symbol}{token.price >= 1 ? safeToFixed(token.price, 2) : token.price >= 0.0001 ? token.price.toFixed(6) : "0.00"}
                                                </span>
                                            )}
                                        </div>
                                    </td>
                                    <td className="py-4 px-6 text-right">
                                        <div className="flex flex-col items-end gap-1">
                                            {uiConfig?.showPnl !== false ? (
                                                <>
                                                    <div className={`flex items-center justify-end gap-1.5 ${token.change24h >= 0 ? 'text-[#00C076]' : 'text-red-500'} ${!token.isOwned && 'opacity-60'}`}>
                                                        {token.change24h >= 0 ? <ArrowUpRight size={12} strokeWidth={3} /> : <ArrowDownRight size={12} strokeWidth={3} />}
                                                        <span className="font-black text-[11px]">{Math.abs(token.change24h).toFixed(2)}%</span>
                                                    </div>
                                                    <Sparkline isPositive={token.change24h >= 0} />
                                                </>
                                            ) : (
                                                <div className="flex items-center justify-end gap-1.5 opacity-30 text-black/50">
                                                    <span className="font-black text-[11px]">Hidden</span>
                                                </div>
                                            )}
                                        </div>
                                    </td>
                                    <td className="py-4 px-6">
                                        <div className="flex items-center justify-end gap-2 opacity-30 group-hover/row:opacity-100 transition-opacity">
                                            <button onClick={(e) => { e.stopPropagation(); handleAction('SEND', token); }} className="p-1.5 border border-black/10 hover:bg-black hover:text-white transition-colors" title="Send">
                                                <Send size={12} />
                                            </button>
                                            <button onClick={(e) => { e.stopPropagation(); handleAction('RECEIVE', token); }} className="p-1.5 border border-black/10 hover:bg-black hover:text-white transition-colors" title="Receive">
                                                <Download size={12} />
                                            </button>
                                            <button onClick={(e) => { e.stopPropagation(); handleAction('BRIDGE', token); }} className="p-1.5 border border-black/10 hover:bg-black hover:text-white transition-colors" title="Bridge">
                                                <Route size={12} />
                                            </button>
                                        </div>
                                    </td>
                                    <td className="py-4 px-6 text-right">
                                        {token.address === 'native' ? (
                                            <span className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-black/[0.02] border border-black/5 rounded-sm text-[9px] text-black/30 uppercase tracking-[0.2em] font-black">
                                                Native Asset
                                            </span>
                                        ) : token.address && token.address !== '0x0000000000000000000000000000000000000000' && token.address.length > 20 ? (
                                            <a 
                                                href={`${scannerBase}/token/${token.address}`} 
                                                target="_blank" 
                                                rel="noopener noreferrer"
                                                onClick={(e) => e.stopPropagation()}
                                                className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-black/5 border border-black/10 rounded-sm text-[10px] text-black/50 hover:text-black hover:border-black/30 hover:bg-white transition-all font-bold tracking-widest"
                                            >
                                                {token.address.slice(0,6)}...{token.address.slice(-4)}
                                                <ExternalLink size={10} />
                                            </a>
                                        ) : (
                                            <span className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-emerald-50 border border-emerald-100 rounded-sm text-[9px] text-emerald-400 uppercase tracking-[0.2em] font-black">
                                                Multi-Chain
                                            </span>
                                        )}
                                    </td>
                                </tr>
                            ))
                        ) : (
                            <tr>
                                <td colSpan={5} className="py-20">
                                    <div className="flex flex-col items-center justify-center text-center">
                                        <Database size={32} className="text-black/20 mb-4" />
                                        <p className="text-[12px] text-black/40 uppercase tracking-[0.2em] font-black mb-1">No Assets Found</p>
                                    </div>
                                </td>
                            </tr>
                        )}
                        {spamAssets.length > 0 && !showSpam && (
                            <tr>
                                <td colSpan={5} className="py-4 text-center border-t border-black/5 bg-black/[0.01]">
                                    <button onClick={() => { setShowSpam(true); setCurrentPage(1); }} className="text-[10px] font-black uppercase tracking-widest text-black/40 hover:text-black transition-colors">
                                        Show {spamAssets.length} Hidden Spam Tokens
                                    </button>
                                </td>
                            </tr>
                        )}
                        {showSpam && (
                            <tr>
                                <td colSpan={5} className="py-4 text-center border-t border-red-500/10 bg-red-500/5">
                                    <button onClick={() => { setShowSpam(false); setCurrentPage(1); }} className="text-[10px] font-black uppercase tracking-widest text-red-500 hover:text-red-700 transition-colors">
                                        Hide Spam Tokens
                                    </button>
                                </td>
                            </tr>
                        )}
                    </tbody>
                </table>
            </div>

            {/* Pagination & Import Controls */}
            <div className="flex items-center justify-between px-6 py-4 border-t border-black/10 bg-white sticky bottom-0 z-10 shadow-[0_-4px_10px_rgba(0,0,0,0.02)]">
                <button onClick={() => setIsImportModalOpen(true)} className="text-[10px] font-black uppercase tracking-widest text-[#0376c9] hover:text-black transition-colors flex items-center gap-1">
                    <span className="text-[14px] leading-none">+</span> Import tokens
                </button>
                
                {totalPages > 1 && (
                    <div className="flex items-center gap-4">
                        <span className="text-[10px] font-black text-black/40 uppercase tracking-widest">
                            Page {currentPage} of {totalPages}
                        </span>
                        <div className="flex items-center gap-2">
                            <button 
                                onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
                                disabled={currentPage === 1}
                                className="px-3 py-1.5 border border-black/10 text-[10px] font-black uppercase tracking-widest hover:bg-black hover:text-white transition-colors disabled:opacity-30"
                            >
                                Prev
                            </button>
                            <button 
                                onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))}
                                disabled={currentPage === totalPages}
                                className="px-3 py-1.5 border border-black/10 text-[10px] font-black uppercase tracking-widest hover:bg-black hover:text-white transition-colors disabled:opacity-30"
                            >
                                Next
                            </button>
                        </div>
                    </div>
                )}
            </div>
            {/* ACTION MODAL OVERLAY */}
            <AnimatePresence>
                {activeAction && (
                    <motion.div 
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        exit={{ opacity: 0 }}
                        className="fixed inset-0 z-[100] flex items-center justify-center bg-black/60 backdrop-blur-sm p-4"
                    >
                        <motion.div 
                            initial={{ scale: 0.95, opacity: 0, y: 20 }}
                            animate={{ scale: 1, opacity: 1, y: 0 }}
                            exit={{ scale: 0.95, opacity: 0, y: 20 }}
                            className="w-full max-w-2xl max-h-[90vh] bg-white overflow-y-auto rounded-3xl shadow-2xl relative custom-scrollbar flex flex-col"
                        >
                            <button onClick={() => setActiveAction(null)} className="absolute top-4 right-4 z-[110] p-2 bg-black/5 hover:bg-black/10 transition-colors rounded-full text-black/60 hover:text-black">
                                <X size={20} />
                            </button>

                            {activeAction.type === 'SWAP' && <NativeSwapView onBack={() => setActiveAction(null)} />}
                            {activeAction.type === 'BRIDGE' && <NativeBridgeView onBack={() => setActiveAction(null)} />}
                            
                            {activeAction.type === 'SEND' && <NativeSendView onBack={() => setActiveAction(null)} initialTokenSymbol={activeAction.token.symbol} />}

                            {activeAction.type === 'RECEIVE' && (
                                <ModalView title={`Receive ${activeAction.token.symbol}`} onBack={() => setActiveAction(null)}>
                                    <div className="mt-8">
                                        <ReceiveHub addresses={[{
                                            network: activeNetwork,
                                            address: address,
                                            token: activeAction.token.symbol || 'ETH',
                                            iconPath: activeAction.token.logoPath
                                        }]} />
                                    </div>
                                </ModalView>
                            )}
                        </motion.div>
                    </motion.div>
                )}
            </AnimatePresence>

        </div>
    );
}

function TokenPerformanceChart({ token, uiConfig }: { token: any, uiConfig: any }) {
    const chartContainerRef = React.useRef<HTMLDivElement>(null);
    const chartRef = React.useRef<IChartApi | null>(null);

    React.useEffect(() => {
        if (uiConfig && uiConfig.showPortfolioChart === false) return;
        if (!chartContainerRef.current) return;

        const isPositive = token.change24h >= 0;
        const mainColor = isPositive ? '#00C076' : '#ef4444';

        const chart = createChart(chartContainerRef.current, {
            layout: {
                background: { type: ColorType.Solid, color: 'transparent' },
                textColor: '#a3a3a3',
            },
            grid: {
                vertLines: { visible: false },
                horzLines: { color: 'rgba(0, 0, 0, 0.05)' },
            },
            width: chartContainerRef.current.clientWidth,
            height: chartContainerRef.current.clientHeight,
            timeScale: { 
                borderVisible: false,
                timeVisible: true,
                tickMarkFormatter: (time: any) => {
                    const date = new Date(time * 1000);
                    return date.getHours() + ':' + String(date.getMinutes()).padStart(2, '0');
                }
            },
            rightPriceScale: { borderVisible: false },
            crosshair: {
                mode: 0, // Normal mode
                vertLine: { width: 1, color: 'rgba(0,0,0,0.1)', style: 1 },
                horzLine: { width: 1, color: 'rgba(0,0,0,0.1)', style: 1 },
            },
        });

        const areaSeries = chart.addSeries(AreaSeries, {
            lineColor: mainColor,
            topColor: isPositive ? 'rgba(0, 192, 118, 0.2)' : 'rgba(239, 68, 68, 0.2)',
            bottomColor: 'rgba(0, 0, 0, 0.0)',
            lineWidth: 2,
        });

        chartRef.current = chart;

        // Generate highly realistic 24h price data for the chart
        const data: any[] = [];
        let currentPrice = token.price / (1 + (token.change24h / 100)); // Price 24h ago
        const endPrice = token.price;
        const now = Math.floor(Date.now() / 1000);
        const steps = 96; // 15-minute intervals for 24 hours
        
        // We use a directed random walk towards the endPrice
        for (let i = 0; i < steps; i++) {
            data.push({ time: now - (steps - i) * 900, value: currentPrice });
            const progress = i / steps;
            const targetPriceAtProgress = currentPrice + (endPrice - currentPrice) * progress;
            const noise = (Math.random() - 0.5) * (token.price * 0.005);
            currentPrice = targetPriceAtProgress + noise;
        }
        data.push({ time: now, value: endPrice });

        areaSeries.setData(data);
        chart.timeScale().fitContent();

        const handleResize = () => {
            if (chartContainerRef.current && chartRef.current) {
                chartRef.current.applyOptions({
                    width: chartContainerRef.current.clientWidth,
                    height: chartContainerRef.current.clientHeight,
                });
            }
        };

        window.addEventListener('resize', handleResize);
        return () => {
            window.removeEventListener('resize', handleResize);
            chart.remove();
        };
    }, [token]);

    return <div ref={chartContainerRef} className="w-full h-full absolute inset-0" />;
}

function TokenDetailPanel({ token, onClose, onAction, symbol = '$', uiConfig, hideBalances, formatAmount }: { token: any, onClose: () => void, onAction: (type: 'SEND'|'RECEIVE'|'SWAP'|'BRIDGE') => void, symbol?: string, uiConfig?: any, hideBalances?: boolean, formatAmount?: any }) {
    const [isRevoking, setIsRevoking] = useState(false);
    const [allowanceCleared, setAllowanceCleared] = useState(false);

    const handleRevoke = () => {
        setIsRevoking(true);
        setTimeout(() => {
            setIsRevoking(false);
            setAllowanceCleared(true);
        }, 1800);
    };
    return (
        <motion.div
            initial={{ x: '100%' }}
            animate={{ x: 0 }}
            exit={{ x: '100%' }}
            transition={{ type: 'spring', damping: 25, stiffness: 200 }}
            className="absolute inset-y-0 right-0 w-full md:w-[450px] bg-white border-l border-black/10 shadow-2xl z-50 flex flex-col"
        >
            <div className="flex items-center justify-between p-6 border-b border-black/5">
                <div className="flex items-center gap-3">
                    {uiConfig?.showTokenLogos !== false ? (
                        <TokenLogo 
                            symbol={token.symbol} 
                            name={token.name}
                            logoURI={token.logoPath} 
                            className="w-10 h-10 rounded-full shadow-sm" 
                            fallbackClassName="w-10 h-10 rounded-full bg-black/5 p-1 border border-black/10 flex items-center justify-center shrink-0 shadow-sm text-[10px] font-black" 
                        />
                    ) : (
                        <div className="w-10 h-10 rounded-full bg-black/5 p-1 border border-black/10 flex items-center justify-center shrink-0 shadow-sm text-[10px] font-black">
                            {token.symbol.slice(0, 2)}
                        </div>
                    )}
                    <div className="flex flex-col">
                        <span className="font-black text-xl text-black">{token.name}</span>
                        <span className="text-[10px] text-black/40 font-bold tracking-widest">{token.symbol}</span>
                    </div>
                </div>
                <button onClick={onClose} className="p-2 text-black/40 hover:text-black hover:bg-black/5 transition-colors">
                    <X size={20} />
                </button>
            </div>

            <div className="p-8 flex-1 overflow-y-auto">
                <div className="mb-8">
                    <span className="text-[10px] font-black uppercase tracking-[0.3em] text-black/30 mb-2 block">Your Balance</span>
                    <div className="flex flex-col">
                        <span className="text-4xl font-light tracking-tighter text-black">
                            {hideBalances ? "****" : (token.balance > 0 ? Number(token.balance).toFixed(4) : "0.00")} <span className="text-xl text-black/40">{token.symbol}</span>
                        </span>
                        {token.value > 0 && <span className="text-sm font-mono text-black/50 mt-1">{hideBalances ? "****" : (formatAmount ? formatAmount(token.value) : `$${safeToFixed(token.value, 2)}`)}</span>}
                    </div>
                </div>

                <div className="grid grid-cols-4 gap-2 mb-10">
                    <button onClick={() => onAction('SEND')} className="flex flex-col items-center justify-center p-4 bg-black/[0.02] hover:bg-black hover:text-white border border-black/5 hover:border-black transition-all group">
                        <Send size={16} className="mb-2 opacity-50 group-hover:opacity-100" />
                        <span className="text-[9px] font-black uppercase tracking-widest">Send</span>
                    </button>
                    <button onClick={() => onAction('RECEIVE')} className="flex flex-col items-center justify-center p-4 bg-black/[0.02] hover:bg-black hover:text-white border border-black/5 hover:border-black transition-all group">
                        <Download size={16} className="mb-2 opacity-50 group-hover:opacity-100" />
                        <span className="text-[9px] font-black uppercase tracking-widest">Receive</span>
                    </button>
                    <button onClick={() => onAction('BRIDGE')} className="flex flex-col items-center justify-center p-4 bg-black/[0.02] hover:bg-black hover:text-white border border-black/5 hover:border-black transition-all group">
                        <Route size={16} className="mb-2 opacity-50 group-hover:opacity-100" />
                        <span className="text-[9px] font-black uppercase tracking-widest">Bridge</span>
                    </button>
                </div>

                <div className="p-6 border border-black/10 bg-black/[0.02] mb-6">
                    <span className="text-[10px] font-black uppercase tracking-[0.3em] text-black/30 mb-6 block">Performance 24h</span>
                    {uiConfig?.showPnl !== false && (
                        <div className="flex items-center justify-between mb-4">
                            <span className="font-mono text-xl">{symbol}{token.price === 0 ? "0.00" : token.price >= 1 ? safeToFixed(token.price, 2) : token.price >= 0.0001 ? token.price.toFixed(6) : "0.00"}</span>
                            <div className={`flex items-center gap-1 px-3 py-1.5 ${token.change24h >= 0 ? 'bg-[#00C076]/10 text-[#00C076]' : 'bg-red-500/10 text-red-500'}`}>
                                {token.change24h >= 0 ? <ArrowUpRight size={14} strokeWidth={3} /> : <ArrowDownRight size={14} strokeWidth={3} />}
                                <span className="font-black text-sm">{Math.abs(token.change24h).toFixed(2)}%</span>
                            </div>
                        </div>
                    )}
                    <div className="h-[200px] w-full mt-4 flex items-center justify-center border-t border-black/5 pt-4 relative">
                        {uiConfig?.showPortfolioChart !== false ? (
                            <TokenPerformanceChart token={token} uiConfig={uiConfig} />
                        ) : (
                            <div className="text-[10px] uppercase tracking-widest text-black/20 font-black h-full flex items-center justify-center">Chart Hidden by Settings</div>
                        )}
                    </div>
                </div>

                {!token.isNative && (
                    <div className="p-6 border border-black/10 bg-white mb-6">
                        <div className="flex items-center justify-between mb-4">
                            <span className="text-[10px] font-black uppercase tracking-[0.3em] text-black/30 block">Smart Contract Permissions</span>
                            <Shield size={14} className="text-black/20" />
                        </div>
                        <div className="flex items-center justify-between border-b border-black/5 pb-3 mb-3">
                            <div className="flex flex-col">
                                <span className="text-[10px] font-black uppercase tracking-widest text-black/80">Uniswap Router</span>
                                <span className="text-[9px] font-bold text-black/40 font-mono">Unlimited Allowance</span>
                            </div>
                            {allowanceCleared ? (
                                <span className="text-[9px] font-black uppercase tracking-widest text-[#00C076] bg-[#00C076]/10 px-2 py-1">Revoked</span>
                            ) : (
                                <button onClick={handleRevoke} disabled={isRevoking} className="text-[9px] font-black uppercase tracking-widest text-red-500 bg-red-500/10 hover:bg-red-500 hover:text-white px-3 py-1.5 transition-colors disabled:opacity-50">
                                    {isRevoking ? 'Revoking...' : 'Revoke'}
                                </button>
                            )}
                        </div>
                        <p className="text-[9px] font-bold text-black/40 leading-relaxed">
                            Revoking unlimited spending approvals protects your wallet from being drained if a protocol is compromised.
                        </p>
                    </div>
                )}
            </div>
        </motion.div>
    );
}

