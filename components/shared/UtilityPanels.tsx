"use client";

import React, { useEffect, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { X, Clock, Eye, Settings, ShieldAlert, Fingerprint, Zap, Laptop, MapPin, Smartphone, Globe, Shield, ArrowUpRight, ArrowDownLeft, Lock, Link2, CheckCircle2 } from 'lucide-react';
import { useUIStore } from '@/lib/store/ui-store';
import { useSettings } from '@/src/context/SettingsContext';
import useSWR from 'swr';
import { useVIPStore, VIPStoreState, LedgerEvent } from '@/lib/vip-store'; 
import { useSystemAccount as useAccount } from '@/hooks/useSystemAccount';
import { useOmniInfrastructure } from "@/lib/api-client";
import { useWalletConnectStore } from '@/lib/store/wallet-connect-store';
import { WCScannerModal } from '@/components/walletconnect/WCScannerModal';
import { getWeb3Wallet } from '@/lib/walletconnect/walletKit';

const fetcher = (url: string) => fetch(url).then(r => r.json());

export function UtilityPanels() {
    const { activePanel, setActivePanel } = useUIStore();
    const { address } = useAccount();
    const [showScanner, setShowScanner] = useState(false);
    const { sessions: wcSessions, isInitialized } = useWalletConnectStore();

    const {
        theme, setTheme, currency, setCurrency,
        privacyMode, togglePrivacyMode,
        walletStealthMode, toggleWalletStealthMode,
        hideBalances, toggleHideBalances,
        pushNotifications, togglePushNotifications,
        transactionAlerts, toggleTransactionAlerts,
        autoLockDuration, setAutoLockDuration
    } = useSettings();

    // Data Fetching
    const [sessions, setSessions] = useState<any[]>([]);
    const [sessionsLoading, setSessionsLoading] = useState(true);

    useEffect(() => {
        if (!address) {
            setSessions([]);
            setSessionsLoading(false);
            return;
        }
        setSessionsLoading(true);
        fetch(`/api/session-logs?userId=${address}`)
            .then(r => r.json())
            .then(data => {
                let apiSessions = [];
                if (Array.isArray(data)) apiSessions = data;
                else if (data.logs) apiSessions = data.logs;
                
                const localKey = `system_history_${address}`;
                let localSessions = [];
                try {
                    const stored = localStorage.getItem(localKey);
                    if (stored) {
                        localSessions = JSON.parse(stored).map((s: any, i: number) => {
                            const parsedTime = new Date(`${s.date} ${s.time}`).getTime();
                            return {
                                id: `local-${i}-${Date.now()}`,
                                action: `LOGIN (${s.provider})`,
                                timestamp: isNaN(parsedTime) ? Date.now() : parsedTime,
                                userId: address,
                                ipAddress: s.os || 'Unknown Device'
                            };
                        });
                    }
                } catch (e) {}

                const merged = [...apiSessions, ...localSessions].sort((a, b) => b.timestamp - a.timestamp);
                setSessions(merged);
            })
            .catch((err) => {
                console.error(err);
                const localKey = `system_history_${address}`;
                let localSessions = [];
                try {
                    const stored = localStorage.getItem(localKey);
                    if (stored) {
                        localSessions = JSON.parse(stored).map((s: any, i: number) => {
                            const parsedTime = new Date(`${s.date} ${s.time}`).getTime();
                            return {
                                id: `local-${i}-${Date.now()}`,
                                action: `LOGIN (${s.provider})`,
                                timestamp: isNaN(parsedTime) ? Date.now() : parsedTime,
                                userId: address,
                                ipAddress: s.os || 'Unknown Device'
                            };
                        });
                    }
                } catch (e) {}
                setSessions(localSessions);
            })
            .finally(() => setSessionsLoading(false));
    }, [address]);

    const { data: txData, isLoading: txLoading } = useSWR(address ? `/api/wallet/transactions?authUserId=${address}` : null, fetcher);
    const transactions = txData?.transactions || [];

    if (!activePanel) return null;

    const panels = {
        notifications: (
            <div className="space-y-4">
                <div className="flex items-center justify-between mb-6 pr-12">
                    <h3 className="text-sm font-aztec-mono font-black uppercase tracking-[0.2em] text-[#050505]">Log Session</h3>
                    <div className="flex items-center gap-2">
                        <span className="text-[10px] font-mono font-bold text-[#050505]/50 uppercase tracking-widest">{sessionsLoading ? 'Syncing...' : 'Session Logs'}</span>
                    </div>
                </div>
                
                <div className="space-y-3 max-h-[400px] overflow-y-auto custom-scrollbar pr-2">
                    {!address ? (
                        <div className="py-20 text-center">
                            <Lock size={24} className="mx-auto text-black/20 mb-4" />
                            <p className="text-[10px] font-black uppercase text-black/40 tracking-widest">Connect Wallet to View Logs</p>
                        </div>
                    ) : (
                        <>
                            {wcSessions && wcSessions.length > 0 && (
                                <div className="mb-6">
                                    <h4 className="text-[10px] font-black uppercase text-black/40 mb-3 tracking-widest border-b border-black/5 pb-2">Active Web3 Connections</h4>
                                    <div className="space-y-3">
                                        {wcSessions.map((session: any) => (
                                            <div key={session.topic} className="p-4 border rounded-2xl bg-white border-[#00C076]/20 shadow-sm relative overflow-hidden">
                                                <div className="absolute top-0 right-0 w-16 h-16 bg-[#00C076]/5 rounded-bl-full -z-0" />
                                                <div className="flex items-center gap-3 relative z-10">
                                                    {session?.peer?.metadata?.icons?.[0] ? (
                                                        <img src={session.peer.metadata.icons[0]} className="w-8 h-8 rounded-full border border-black/10" alt="" />
                                                    ) : (
                                                        <div className="w-8 h-8 rounded-full border border-black/10 bg-black/5 flex items-center justify-center">
                                                            <Globe size={14} className="text-black/40" />
                                                        </div>
                                                    )}
                                                    <div className="flex-1 overflow-hidden">
                                                        <h4 className="text-[11px] font-bold text-black truncate">{session?.peer?.metadata?.name || 'Unknown dApp'}</h4>
                                                        <p className="text-[9px] font-mono text-black/50 truncate w-full">{session?.peer?.metadata?.url || 'No URL provided'}</p>
                                                    </div>
                                                    <div className="w-2 h-2 rounded-full bg-[#00C076] animate-pulse shadow-[0_0_8px_#00C076]" />
                                                </div>
                                            </div>
                                        ))}
                                    </div>
                                </div>
                            )}

                            {sessions.length > 0 && (
                                <h4 className="text-[10px] font-black uppercase text-black/40 mb-3 tracking-widest border-b border-black/5 pb-2">Session History</h4>
                            )}

                            {sessions.map((log: any) => (
                                <div key={log.id} className="p-4 border rounded-2xl transition-all group bg-white border-black/5 hover:border-black/20 shadow-sm">
                                    <div className="flex items-center justify-between mb-2">
                                        <span className="text-[9px] font-black px-2 py-0.5 rounded-md uppercase tracking-tighter bg-black/5 text-black/60">
                                            {log.action}
                                        </span>
                                        <span className="text-[9px] font-mono font-bold text-[#050505]/40">
                                            {new Date(log.timestamp).toLocaleDateString([], { day: '2-digit', month: 'short' })}
                                        </span>
                                    </div>

                                    <div className="flex items-start gap-3">
                                        <div className="p-2 rounded-xl bg-black/5 text-black/60">
                                            <ShieldAlert size={14} />
                                        </div>
                                        <div className="space-y-1">
                                            <h4 className="text-[11px] font-mono font-bold text-[#050505] leading-tight truncate w-[200px]">
                                                {log.userId || "Anonymous"}
                                            </h4>
                                            <div className="flex flex-col gap-0.5">
                                                <div className="flex items-center gap-1">
                                                    <Globe size={10} className="text-[#050505]/40" />
                                                    <span className="text-[10px] font-mono font-bold text-black/70 truncate max-w-[150px]">{log.ipAddress || "Hidden"}</span>
                                                </div>
                                            </div>
                                        </div>
                                    </div>

                                    <div className="mt-3 pt-3 border-t border-black/5 flex items-center justify-between opacity-0 group-hover:opacity-100 transition-opacity">
                                        <div className="flex items-center gap-1">
                                            <Clock size={10} className="text-[#050505]/40" />
                                            <span className="text-[9px] font-black text-[#050505]/40 uppercase tracking-widest font-mono">
                                                {new Date(log.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' })}
                                            </span>
                                        </div>
                                        <Shield size={12} className="text-black" />
                                    </div>
                                </div>
                            ))}
                            
                            {!sessionsLoading && sessions.length === 0 && (
                                <div className="py-20 text-center">
                                    <p className="text-[10px] font-black uppercase text-black/40 tracking-widest">No Session Logs</p>
                                </div>
                            )}
                        </>
                    )}
                </div>
            </div>
        ),
        history: (
            <div className="space-y-4">
                <div className="flex items-center justify-between mb-6 pr-12">
                    <h3 className="text-sm font-aztec-mono font-black uppercase tracking-[0.2em] text-[#050505]">Global Ledger</h3>
                    <div className="flex items-center gap-2">
                        {address && <span className="px-2 py-0.5 bg-black/5 text-black font-mono text-[9px] font-black rounded-sm border border-black/10 tracking-widest uppercase shadow-sm">Connected</span>}
                    </div>
                </div>

                <div className="space-y-3 max-h-[400px] overflow-y-auto no-scrollbar pr-2">
                    {txLoading && (
                        <div className="space-y-3">
                            {[1, 2, 3].map(i => (
                                <div key={i} className="animate-pulse bg-black/5 h-16 rounded-2xl border border-black/5" />
                            ))}
                        </div>
                    )}
                    
                    {!txLoading && (!address || transactions.length === 0) && (
                         <div className="text-center py-20 opacity-40">
                              <Zap className="mx-auto mb-4" size={32} />
                              <p className="text-[10px] font-mono uppercase tracking-widest font-black text-black/60">{!address ? 'Awaiting Wallet Connection' : 'No historical signals detected'}</p>
                         </div>
                    )}

                    {!txLoading && transactions.map((tx: any) => (
                        <div key={tx.hash} className="p-4 bg-white hover:bg-black/5 border border-black/5 transition-colors rounded-2xl flex items-center justify-between group shadow-sm hover:shadow-md">
                            <div className="flex gap-3 items-center">
                                 <div className={`w-10 h-10 rounded-full flex items-center justify-center ${tx.type === 'DEPOSIT' || tx.type === 'RECEIVE' ? 'bg-emerald-500/10 text-emerald-600' : 'bg-black/5 text-black'}`}>
                                      {tx.type === 'DEPOSIT' || tx.type === 'RECEIVE' ? <ArrowDownLeft size={14} /> : <ArrowUpRight size={14} />}
                                 </div>
                                 <div>
                                      <div className="text-sm font-black font-mono tracking-tighter text-[#050505]">
                                          {tx.value} <span className="text-[10px] opacity-60 ml-1">{tx.tokenSymbol || 'ETH'}</span>
                                      </div>
                                      <div className="text-[9px] font-mono text-black/40 uppercase tracking-widest mt-0.5 group-hover:text-black transition-colors">{tx.hash.slice(0, 10)}...{tx.hash.slice(-4)}</div>
                                 </div>
                            </div>
                            <div className="text-right">
                                 <div className={`text-[9px] font-black uppercase tracking-widest ${tx.status === 'CONFIRMED' || tx.status === 'SUCCESS' ? 'text-emerald-600' : 'text-black/50'}`}>
                                     {tx.status || 'CONFIRMED'}
                                 </div>
                                 <div className="text-[9px] text-black/40 font-mono mt-1">{new Date(tx.timestamp).toLocaleDateString()}</div>
                            </div>
                        </div>
                    ))}
                </div>
            </div>
        ),
        privacy: (
            <div className="space-y-6">
                <h3 className="text-sm font-aztec-mono font-black uppercase tracking-[0.2em] text-[#050505] flex items-center gap-2 pr-12">
                    <ShieldAlert size={16} /> UI Privacy Settings
                </h3>
                
                <div className="p-6 border border-black/10 rounded-3xl bg-white relative overflow-hidden group mb-4 shadow-sm">
                    <div className="absolute inset-0 bg-gradient-to-br from-black/5 to-transparent opacity-0 group-hover:opacity-100 transition-duration-500 pointer-events-none" />
                    <div className="relative z-10">
                        <h4 className="font-aztec-serif font-black text-[#050505] text-xl mb-1 italic">Local Privacy Filters</h4>
                        <p className="text-[10px] text-black/50 font-mono uppercase tracking-widest mb-6">Manage data visibility on your screen</p>

                        <div className="space-y-3">
                            <SettingToggle 
                                label="Mask Balances" 
                                description="Hide numeric values in the terminal" 
                                active={hideBalances} 
                                onToggle={toggleHideBalances} 
                                color="orchid"
                            />
                            <SettingToggle 
                                label="Incognito UI" 
                                description="Obscure sensitive activity locally" 
                                active={privacyMode} 
                                onToggle={togglePrivacyMode} 
                                color="orchid"
                            />
                            <SettingToggle 
                                label="Address Cloaking" 
                                description="Truncate public wallet addresses" 
                                active={walletStealthMode} 
                                onToggle={toggleWalletStealthMode} 
                                color="orchid"
                            />
                        </div>
                    </div>
                </div>
            </div>
        ),
        settings: (
            <div className="space-y-6">
                <div className="flex items-center justify-between mb-4 pb-4 border-b border-black/5 pr-12">
                    <h3 className="text-sm font-aztec-mono font-black uppercase tracking-[0.2em] text-[#050505]">System Core</h3>
                    <Settings size={16} className="text-black/30 animate-spin-slow" />
                </div>

                <div className="space-y-6 max-h-[450px] overflow-y-auto custom-scrollbar pr-2 pb-4">
                    <div className="space-y-4">
                        <h4 className="text-[10px] font-aztec-mono font-black text-black uppercase tracking-widest">Global Architecture</h4>
                        <div className="grid grid-cols-2 gap-3">
                            <div className="space-y-2">
                                <label className="text-[9px] font-black text-black/50 uppercase tracking-widest font-mono">UI Variables</label>
                                <select 
                                    value={theme}
                                    onChange={(e) => setTheme(e.target.value as any)}
                                    className="w-full bg-white border border-black/10 rounded-xl px-3 py-2.5 text-[11px] font-black font-mono text-[#050505] focus:outline-none focus:border-black transition-all uppercase tracking-wider appearance-none"
                                >
                                    <option value="light">Arctic Light</option>
                                    <option value="auto">System OS</option>
                                </select>
                            </div>
                            <div className="space-y-2">
                                <label className="text-[9px] font-black text-black/50 uppercase tracking-widest font-mono">Fiat Anchor</label>
                                <select 
                                    value={currency}
                                    onChange={(e) => setCurrency(e.target.value as any)}
                                    className="w-full bg-white border border-black/10 rounded-xl px-3 py-2.5 text-[11px] font-black font-mono text-[#050505] focus:outline-none focus:border-black transition-all uppercase tracking-wider appearance-none"
                                >
                                    <option value="USD">USD ($)</option>
                                    <option value="EUR">EUR ()</option>
                                    <option value="GBP">GBP (£)</option>
                                </select>
                            </div>
                        </div>
                    </div>

                    <div className="space-y-3">
                        <h4 className="text-[10px] font-aztec-mono font-black text-black uppercase tracking-widest">Analytics Relays</h4>
                        <SettingToggle 
                            label="Push Alerts" 
                            description="Instant browser signal injection" 
                            active={pushNotifications} 
                            onToggle={togglePushNotifications} 
                            color="chartreuse"
                        />
                        <SettingToggle 
                            label="TX Surveillance" 
                            description="Notify on every block inclusion" 
                            active={transactionAlerts} 
                            onToggle={toggleTransactionAlerts} 
                            color="chartreuse"
                        />
                        <div className="pt-4 mt-2 border-t border-black/5 space-y-3">
                             <div className="flex justify-between items-center text-[9px] font-black uppercase text-black/50 font-mono tracking-widest">
                                 <span>Session Timeout Hash</span>
                                 <span className="text-[#050505]">{autoLockDuration} Min</span>
                             </div>
                             <input 
                                type="range" min="1" max="60" 
                                value={autoLockDuration}
                                onChange={(e) => setAutoLockDuration(Number(e.target.value))}
                                className="w-full h-1 bg-black/10 rounded-lg appearance-none cursor-pointer border-none outline-none [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:w-3 [&::-webkit-slider-thumb]:h-3 [&::-webkit-slider-thumb]:bg-black [&::-webkit-slider-thumb]:rounded-full" 
                             />
                             <div className="flex justify-between text-[8px] font-bold text-black/30 font-mono">
                                <span>1m</span>
                                <span>60m</span>
                             </div>
                    </div>
                </div>

                {/*  dApp Connections section  */}
                <div className="pt-4 mt-2 border-t border-black/5 space-y-3">
                    <h4 className="text-[10px] font-aztec-mono font-black text-black uppercase tracking-widest flex items-center gap-2">
                        <Link2 size={12} /> dApp Connections
                    </h4>
                    <button
                        onClick={() => setShowScanner(true)}
                        className="w-full flex items-center justify-center gap-2 py-3 rounded-xl font-aztec-mono text-[11px] font-black uppercase tracking-widest bg-black text-white hover:bg-black/80 transition-all shadow-lg shadow-black/10"
                    >
                        <Link2 size={14} /> Connect dApp
                    </button>
                    {isInitialized && Object.keys(wcSessions).length > 0 && (
                        <div className="space-y-2">
                            <span className="text-[9px] font-black text-black/40 uppercase tracking-widest">Active Sessions</span>
                            {Object.values(wcSessions).map((session: any) => (
                                <div key={session.topic} className="p-3 bg-white border border-black/5 rounded-xl flex items-center justify-between shadow-sm">
                                    <div className="flex items-center gap-2">
                                        <CheckCircle2 size={12} className="text-emerald-500" />
                                        <span className="text-[11px] font-mono font-bold text-black truncate max-w-[180px]">{session.peer?.metadata?.name || 'Unknown dApp'}</span>
                                    </div>
                                    <button
                                        onClick={async () => {
                                            const wc = getWeb3Wallet();
                                            if (wc) await wc.disconnectSession({ topic: session.topic, reason: { code: 6000, message: 'User disconnected' } });
                                        }}
                                        className="text-[9px] font-black text-red-500 hover:text-red-700 uppercase tracking-wider font-mono"
                                    >
                                        Revoke
                                    </button>
                                </div>
                            ))}
                        </div>
                    )}
                </div>
            </div>
        </div>
        )
    };

    return (
        <>
        <AnimatePresence>
            {/* Full-screen backdrop — always covers the viewport */}
            <motion.div
                key="panel-backdrop"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                onClick={() => setActivePanel(null)}
                className="fixed inset-0 z-[100] bg-black/25 backdrop-blur-sm"
            />

            {/* Panel — bottom drawer on mobile, floating card on desktop */}
            <motion.div
                key="panel-content"
                initial={{ opacity: 0, y: 40, scale: 0.97 }}
                animate={{ opacity: 1, y: 0, scale: 1 }}
                exit={{ opacity: 0, y: 40, scale: 0.97 }}
                transition={{ type: 'spring', damping: 28, stiffness: 260 }}
                className={[
                    'fixed z-[101] bg-white border border-black/10 shadow-[0_24px_80px_rgba(0,0,0,0.18)] text-[#050505] font-sans overflow-hidden',
                    // Mobile: full-width sheet from bottom
                    'bottom-0 left-0 right-0 rounded-t-[2rem] max-h-[88dvh] overflow-y-auto',
                    // Desktop: top-right floating card
                    'sm:bottom-auto sm:top-20 sm:left-auto sm:right-6 sm:w-[420px] sm:max-w-[calc(100vw-3rem)] sm:rounded-[2.5rem] sm:max-h-[calc(100vh-6rem)]',
                ].join(' ')}
            >
                {/* Drag handle (mobile only) */}
                <div className="flex justify-center pt-3 pb-1 sm:hidden">
                    <div className="w-10 h-1 rounded-full bg-black/10" />
                </div>

                {/* Close button */}
                <div className="absolute top-4 right-4 sm:top-5 sm:right-5 z-50">
                    <button
                        onClick={() => setActivePanel(null)}
                        className="p-2 bg-black/5 border border-black/10 rounded-full hover:bg-black/10 hover:border-black/20 transition-all active:scale-95"
                        aria-label="Close panel"
                    >
                        <X size={14} className="text-[#050505]/60" />
                    </button>
                </div>

                {/* Panel content */}
                <div className="relative z-10 p-6 sm:p-8">
                    {panels[activePanel as keyof typeof panels]}
                </div>
            </motion.div>
        </AnimatePresence>

        {showScanner && <WCScannerModal onClose={() => setShowScanner(false)} />}
        </>
    );
}

function SettingToggle({ label, description, active, onToggle, color = 'chartreuse' }: { label: string, description: string, active: boolean, onToggle: () => void, color?: 'chartreuse' | 'orchid' }) {
    const activeColor = 'bg-black';
    const activeText = 'text-black';

    return (
        <div className="flex items-center justify-between p-3.5 bg-white border border-black/5 rounded-2xl hover:border-black/20 transition-all cursor-pointer group shadow-sm" onClick={onToggle}>
            <div>
                <h5 className={`text-[11px] font-black uppercase tracking-widest font-mono transition-colors ${active ? activeText : 'text-black/60 group-hover:text-black'}`}>{label}</h5>
                <p className="text-[9px] text-black/40 font-medium font-sans mt-0.5">{description}</p>
            </div>
            <div className={`w-10 h-5 rounded-full relative transition-all duration-300 border ${active ? 'border-transparent ' + activeColor : 'bg-black/5 border-black/10'}`}>
                <div className={`absolute top-[3px] w-3 h-3 rounded-full bg-white shadow-sm transition-all duration-300 ${active ? 'left-[22px]' : 'left-[3px] opacity-80'}`} />
            </div>
        </div>
    );
}

export function BillionLedgerNotification() {
    // Disabled per user request (eliminates fake transfer popups)
    return null;
    const ledgerEvents = useVIPStore((state: VIPStoreState) => state.ledgerEvents);
    const [activeTransfers, setActiveTransfers] = useState<LedgerEvent[]>([]);

    useEffect(() => {
        if (!ledgerEvents) return;
        
        const checkLedgers = () => {
            const data = ledgerEvents.filter(w => w.usdNum >= 1000000000);
            if (data.length > 0) {
                setActiveTransfers(prev => {
                    const existingIds = new Set(prev.map(item => item.id));
                    const newLedgers = data.filter(w => !existingIds.has(w.id));
                    if (newLedgers.length === 0) return prev;
                    
                    return [...newLedgers, ...prev].slice(0, 5);
                });
            }
        };

        const interval = setInterval(checkLedgers, 15000); 
        return () => clearInterval(interval);
    }, [ledgerEvents]);

    return (
        <div className="fixed bottom-4 right-4 sm:bottom-10 sm:right-10 z-[200] flex flex-col gap-3 items-end pointer-events-none max-w-[calc(100vw-2rem)] sm:max-w-[420px]">
            <AnimatePresence mode="popLayout">
                {activeTransfers.map((ledger) => (
                    <motion.div
                        key={ledger.id}
                        layout
                        initial={{ x: 400, opacity: 0, clipPath: 'inset(0% 100% 0% 0%)' }}
                        animate={{ x: 0, opacity: 1, clipPath: 'inset(0% 0% 0% 0%)' }}
                        exit={{ x: 400, opacity: 0, filter: 'blur(10px)' }}
                        transition={{ duration: 0.4, ease: [0.16, 1, 0.3, 1] }}
                        className="w-[420px] bg-white border border-black/10 border-l-4 border-l-black p-6 pointer-events-auto relative shadow-2xl"
                    >
                        {/* Static Brutalist Grid Background */}
                        <div className="absolute inset-0 bg-[linear-gradient(rgba(0,0,0,0.03)_1px,transparent_1px),linear-gradient(90deg,rgba(0,0,0,0.03)_1px,transparent_1px)] bg-[size:16px_16px] pointer-events-none" />
                        
                        <div className="relative z-10 flex flex-col gap-6 h-full">
                            
                            {/* Header */}
                            <div className="flex justify-between items-start">
                                <div className="flex items-center gap-4">
                                    <div className="bg-black text-white p-2 flex items-center justify-center relative">
                                        <div className="absolute -top-1 -right-1 w-2 h-2 bg-[#FFFFFF]" />
                                        <Zap size={16} className="fill-white" />
                                    </div>
                                    <div className="flex flex-col">
                                        <h3 className="font-aztec-mono font-black text-sm text-[#050505] tracking-widest uppercase leading-none">
                                            $1B+ TRANSFER DETECTED
                                        </h3>
                                        <div className="text-[10px] font-aztec-mono text-black/50 tracking-[0.2em] mt-1.5 uppercase">
                                            ON-CHAIN SIGNATURE CONFIRMED
                                        </div>
                                    </div>
                                </div>
                                <button 
                                    onClick={() => setActiveTransfers(prev => prev.filter(t => t.id !== ledger.id))}
                                    className="p-1.5 hover:bg-black/5 transition-colors text-black/40 hover:text-black border border-transparent hover:border-black/10"
                                >
                                    <X size={14} />
                                </button>
                            </div>

                            {/* Core Metrics Block */}
                            <div className="bg-[#FFFFFF] border border-black/10 p-5 space-y-5">
                                <div className="flex flex-col gap-1.5">
                                    <span className="text-[10px] font-aztec-mono text-black/50 uppercase tracking-widest">Global Asset Volume</span>
                                    <div className="flex items-baseline gap-3 flex-wrap">
                                        <span className="font-aztec-mono text-3xl font-black text-black tracking-tighter break-all">
                                            {ledger.amount}
                                        </span>
                                        <span className="text-xs font-black text-[#050505] uppercase tracking-widest">{ledger.token}</span>
                                    </div>
                                </div>

                                <div className="grid grid-cols-2 gap-4 pt-4 border-t border-dashed border-black/10">
                                    <div className="flex flex-col gap-1.5">
                                        <span className="text-[9px] font-aztec-mono uppercase text-black/40 tracking-widest flex items-center gap-1.5">
                                            <Globe size={10} /> USD EQUIVALENT
                                        </span>
                                        <span className="font-aztec-mono text-xs font-black text-black">${(ledger.usdNum / 1000000000).toFixed(2)}B USD</span>
                                    </div>
                                    <div className="flex flex-col gap-1.5">
                                        <span className="text-[9px] font-aztec-mono uppercase text-black/40 tracking-widest flex items-center gap-1.5">
                                            <Globe size={10} /> EUR EQUIVALENT
                                        </span>
                                        <span className="font-aztec-mono text-xs font-black text-black">{((ledger.usdNum * 0.92) / 1000000000).toFixed(2)}B EUR</span>
                                    </div>
                                </div>
                            </div>

                            {/* Footer / Trace */}
                            <div className="flex items-center justify-between border-t border-black/10 pt-5">
                                <div className="flex flex-col gap-1.5">
                                    <div className="flex items-center gap-1.5 text-[9px] font-aztec-mono uppercase text-black/60 tracking-widest">
                                        <Fingerprint size={12} /> SENDER TRACE
                                    </div>
                                    <span className="font-aztec-mono text-[11px] text-[#050505]/70 bg-black/5 py-1 px-2 border border-black/10">{ledger.wallet.slice(0, 16)}...</span>
                                </div>
                                <button className="px-6 py-2.5 bg-black text-[#FFFFFF] font-aztec-mono text-[10px] font-black uppercase tracking-widest border border-transparent hover:border-black hover:bg-[#FFFFFF] hover:text-black transition-colors leading-tight text-center">
                                    EXECUTE <br/> AUDIT
                                </button>
                            </div>
                        </div>
                    </motion.div>
                ))}
            </AnimatePresence>
        </div>
    );
}

