"use client";
import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { MODULE_EXPLANATIONS } from './ModuleExplanations';
import { useSettingsStore } from '@/lib/store/useSettingsStore';
import { useRouter } from 'next/navigation';
import { useEffect, useRef } from 'react';
import { useMarketStream } from '@/context/MarketStreamContext';
import { GlobalCommandPalette } from '@/components/ui/GlobalCommandPalette';
import { InstitutionalErrorBoundary } from '@/components/ui/InstitutionalErrorBoundary';
import { useSystemAccount } from '@/hooks/useSystemAccount';
import { useEthMetrics } from '@/hooks/useEthMetrics';
import { useDisconnect } from 'wagmi';
import { toast } from 'sonner';


// ─── Custom minimal SVG icons (not Lucide) ─────────────────────────────────
const Icon = {
  markets:    <span className="font-mono text-[10px] tracking-widest font-black">[MKT]</span>,
  explorer:   <span className="font-mono text-[10px] tracking-widest font-black">[EXP]</span>,
  roadmap:    <span className="font-mono text-[10px] tracking-widest font-black">[RDM]</span>,
  sync:       <span className="font-mono text-[10px] tracking-widest font-black">[SNC]</span>,
  logs:       <span className="font-mono text-[10px] tracking-widest font-black">[LOG]</span>,
  identity:   <span className="font-mono text-[10px] tracking-widest font-black">[ID]</span>,
  support:    <span className="font-mono text-[10px] tracking-widest font-black">[SUP]</span>,
  forum:      <span className="font-mono text-[10px] tracking-widest font-black">[FRM]</span>,
  studio:     <span className="font-mono text-[10px] tracking-widest font-black">[STU]</span>,
  map:        <span className="font-mono text-[10px] tracking-widest font-black">[MAP]</span>,
};

// Tier access helper
const TIER_LEVELS: Record<string, number> = { FREE: 0, STANDARD: 1 };
function hasAccess(userTier: string, minTier: 'FREE' | 'STANDARD'): boolean {
    return (TIER_LEVELS[userTier] ?? 0) >= (TIER_LEVELS[minTier] ?? 0);
}

interface NavItem {
    id: string;
    label: string;
    icon: React.ReactNode;
    badge?: string;
    badgeColor?: string;
    externalUrl?: string;
    requiresZK?: boolean;
    minTier?: 'FREE' | 'STANDARD';
}

const SIDEBAR_ITEMS: NavItem[] = [
    { id: 'humanity-ledger', label: 'Roadmap',     icon: Icon.roadmap   },
    { id: 'gold',            label: 'Identity',    icon: Icon.identity  },
    { id: 'studio',          label: 'Provenance',  icon: Icon.studio    },
    { id: 'markets',         label: 'Markets',     icon: Icon.markets   },
    { id: 'governance',      label: 'Governance',  icon: <span className="font-mono text-[10px] tracking-widest font-black">[GOV]</span> },
    { id: 'token',           label: 'Token',       icon: <span className="font-mono text-[10px] tracking-widest font-black">[TKN]</span> },
    { id: 'map',             label: 'Network Map', icon: Icon.map       },
    { id: 'logs',            label: 'Privacy',     icon: Icon.logs      },
];

const RESTRICTED_TABS = ['logs', 'privacy'];

// Convert autoDisconnectTimer setting string to milliseconds
function timerToMs(t: '15m' | '1h' | '24h' | 'never'): number | null {
    if (t === '15m')  return 15  * 60 * 1000;
    if (t === '1h')   return 60  * 60 * 1000;
    if (t === '24h')  return 24  * 60 * 60 * 1000;
    return null; // 'never'
}

// ─── Sidebar item button ────────────────────────────────────────────────────
function AztecSidebarItem({
    item, isActive, isCollapsed, onClick, isLocked
}: {
    item: NavItem; isActive: boolean; isCollapsed: boolean; onClick: () => void; isLocked?: boolean;
}) {
    return (
        <button
            onClick={onClick}
            className={`relative w-full flex items-center justify-between py-2.5 px-3 rounded-xl group select-none outline-none transition-all duration-300 active:scale-95 ${
                isActive
                    ? 'bg-white shadow-md border border-[#1A1A1A]'
                    : 'bg-transparent border border-transparent hover:bg-black/[0.04]'
            } ${isLocked ? 'opacity-70 grayscale' : ''}`}
        >
            <div className="relative flex items-center w-full">
                {isActive && (
                    <motion.div
                        layoutId="activeTabIndicator"
                        className="absolute left-[-13px] top-1/2 -translate-y-1/2 w-[3px] h-[18px] bg-[#FFFFFF] rounded-r-full"
                    />
                )}
                {item.icon && (
                    <span className={`shrink-0 transition-colors duration-300 ${isActive ? 'text-[#FFFFFF]' : 'text-[#888888] group-hover:text-[#050505]'}`}>
                        {item.icon}
                    </span>
                )}
                {!isCollapsed && (
                    <span className={`text-[11px] font-black uppercase tracking-widest flex-1 text-left leading-none truncate transition-colors duration-300 ml-2.5 ${isActive ? 'text-[#FFFFFF]' : 'text-[#555555] group-hover:text-[#050505]'}`}>
                        {item.label}
                    </span>
                )}
                {!isCollapsed && isLocked && (
                    <span className="ml-2 text-[10px] font-mono font-black text-black/30 shrink-0">[LOCKED]</span>
                )}
                {!isCollapsed && !isLocked && item.badge && (
                    <span
                        className="ml-2 text-[8px] font-black uppercase tracking-widest px-1.5 py-0.5 rounded-[4px] border shrink-0 transition-colors"
                        style={isActive
                            ? { background: 'rgba(255,255,255,0.15)', color: '#FFFFFF', borderColor: 'rgba(255,255,255,0.3)' }
                            : { background: `${item.badgeColor ?? '#050505'}15`, color: item.badgeColor ?? '#050505', borderColor: `${item.badgeColor ?? '#050505'}30` }
                        }
                    >
                        {item.badge}
                    </span>
                )}
                {!isCollapsed && item.externalUrl && (
                    <span className={`ml-2 text-[10px] font-mono font-black transition-colors ${isActive ? 'text-[#FFFFFF]' : 'text-[#A0A0A0] group-hover:text-[#050505]'}`}>[↗]</span>
                )}
            </div>
        </button>
    );
}

interface LedgerProShellProps {
    children: React.ReactNode;
    activeTab: string;
    onTabChange: (id: string) => void;
    isExternalEmbed?: boolean;
    isZkVerified?: boolean;
}

export function LedgerProShell({
    activeTab, onTabChange, children, isExternalEmbed = false, isZkVerified = false
}: LedgerProShellProps) {
    const [isCollapsed, setIsCollapsed]             = useState(false);
    const [isPaletteOpen, setIsPaletteOpen]         = useState(false);
    const [isMenuDrawerOpen, setIsMenuDrawerOpen]   = useState(false);
    const [isSessionLocked, setIsSessionLocked]     = useState(false);
    const [tier, setTier]                           = useState<string | null>(null);
    const [subStatus, setSubStatus]                 = useState<string | null>(null);
    const [isTierLoaded, setIsTierLoaded]           = useState(false);
    const [isDropdownOpen, setIsDropdownOpen]       = useState(false);
    const idleTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

    const { setSettingsOpen, autoDisconnectTimer } = useSettingsStore();
    const router   = useRouter();
    const { disconnect } = useDisconnect();

    const { latency, isConnected: streamConnected, mode } = useMarketStream();
    const { connector, isConnected: isWalletConnected, isSystemHandshake } = useSystemAccount();
    const { blockNumber, baseFeeGwei, utcTime, syncing: ethSyncing } = useEthMetrics();

    const currentExplanation = MODULE_EXPLANATIONS[activeTab] || {
        title: 'MODULE IN DEVELOPMENT', subtitle: 'BETA RELEASE',
        overview: 'This module is under active deployment.',
        features: []
    };

    // Load Tier + subscription
    useEffect(() => {
        fetch('/api/auth/session', { cache: 'no-store' })
            .then(r => r.ok ? r.json() : null)
            .then(data => {
                setTier(data?.user?.tier ? data.user.tier.split('_')[0].toUpperCase() : 'FREE');
                setSubStatus(data?.user?.subscription?.status || null);
                setIsTierLoaded(true);
            })
            .catch(() => { setTier('FREE'); setSubStatus(null); setIsTierLoaded(true); });
    }, [isWalletConnected, isSystemHandshake]);

    // True desktop detection (uses screen.width, not viewport)
    const [isMounted, setIsMounted]         = useState(false);
    const [isTrueDesktop, setIsTrueDesktop] = useState(true);
    useEffect(() => {
        setIsMounted(true);
        const check = () => setIsTrueDesktop(window.screen.width >= 1024);
        check();
        window.addEventListener('resize', check);
        return () => window.removeEventListener('resize', check);
    }, []);
    const showMobileNav = isMounted && !isTrueDesktop;

    // Node health
    const [nodeStatus, setNodeStatus] = useState<'OPERATIONAL' | 'DEGRADED' | 'OFFLINE'>('OPERATIONAL');
    useEffect(() => { setNodeStatus('OPERATIONAL'); }, []);

    // Inactivity session lock
    useEffect(() => {
        const ms = timerToMs(autoDisconnectTimer);
        if (!ms) return;
        const reset = () => {
            if (idleTimerRef.current) clearTimeout(idleTimerRef.current);
            idleTimerRef.current = setTimeout(() => setIsSessionLocked(true), ms);
        };
        const events = ['mousemove', 'mousedown', 'keydown', 'touchstart', 'scroll'];
        events.forEach(e => window.addEventListener(e, reset, { passive: true }));
        reset();
        return () => {
            if (idleTimerRef.current) clearTimeout(idleTimerRef.current);
            events.forEach(e => window.removeEventListener(e, reset));
        };
    }, [autoDisconnectTimer]);

    const unlockSession = async () => {
        try {
            const res  = await fetch('/api/auth/session', { cache: 'no-store' });
            if (!res.ok) throw new Error('Session Expired');
            const data = await res.json();
            if (!data?.user?.userId) throw new Error('No valid session');
            setIsSessionLocked(false);
            if (idleTimerRef.current) clearTimeout(idleTimerRef.current);
        } catch {
            toast.error('Session Expired', { description: 'Your cryptographic lease has timed out.' });
            disconnect();
            router.push('/connect');
        }
    };

    const handleTabChange = (id: string) => {
        if (SIDEBAR_ITEMS.find(i => i.id === id)?.externalUrl) {
            window.open(SIDEBAR_ITEMS.find(i => i.id === id)!.externalUrl, '_blank', 'noopener,noreferrer');
            return;
        }
        if (id === 'developer') { window.location.href = '/developers'; return; }
        if (RESTRICTED_TABS.includes(id) && !isWalletConnected) { router.push('/connect'); return; }
        onTabChange(id);
    };

    // Redirect away from restricted tabs when wallet disconnects
    useEffect(() => {
        if (RESTRICTED_TABS.includes(activeTab) && !isWalletConnected) {
            onTabChange('humanity-ledger');
        }
    // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [isWalletConnected, activeTab]);

    // ─── Mobile bottom-nav tabs ──────────────────────────────────────────────
    const MOBILE_TABS = [
        { id: 'gold',     icon: Icon.identity, label: 'Identity' },
        { id: 'markets',  icon: Icon.markets,  label: 'Markets'  },
        { id: 'map',      icon: Icon.map,      label: 'Network'  },
        { id: 'menu',     icon: <span className="font-mono text-[10px] tracking-widest font-black leading-none">[≡]</span>, label: 'Menu' },
    ];

    return (
        <>
        <GlobalCommandPalette isOpen={isPaletteOpen} setIsOpen={setIsPaletteOpen} onTabChange={onTabChange} />

        {/* Session Lock Overlay */}
        <AnimatePresence>
            {isSessionLocked && (
                <motion.div
                    initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
                    className="fixed inset-0 z-[9999] flex flex-col items-center justify-center text-center"
                    style={{ background: 'rgba(250,249,246,0.97)', backdropFilter: 'blur(24px)' }}
                >
                    <h2 className="text-2xl font-black uppercase tracking-[0.2em] text-[#050505] mb-2">Session Locked</h2>
                    <p className="text-[10px] font-bold uppercase tracking-widest text-black/40 mb-8">
                        Auto-lock after {autoDisconnectTimer} of inactivity
                    </p>
                    <button
                        onClick={unlockSession}
                        className="px-8 py-3.5 bg-white text-white text-[11px] font-black uppercase tracking-widest rounded-xl hover:bg-black/80 transition-all active:scale-[0.98]"
                    >
                        Resume Session
                    </button>
                </motion.div>
            )}
        </AnimatePresence>

        <div className={`flex fixed inset-0 bg-white text-[#050505] font-sans selection:bg-black/10 overflow-hidden transition-all duration-300 ${isSessionLocked ? 'scale-[0.99] pointer-events-none' : ''}`}>

            {/* ── Main Content ── */}
            <div className="flex-1 flex flex-col min-w-0 relative h-full bg-white">

                {/* Top Bar */}
                <header
                    className="sticky top-0 border-b border-black/[0.07] bg-white/95 backdrop-blur-xl flex items-center justify-between px-4 lg:px-6 z-40 shrink-0"
                    style={{
                        minHeight: 'calc(56px + env(safe-area-inset-top, 0px))',
                        paddingTop: 'env(safe-area-inset-top, 0px)'
                    }}
                >
                    {/* Left: Back to Hub */}
                    <button
                        onClick={() => router.push('/')}
                        className="group flex items-center gap-2.5 h-8 px-4 rounded-full bg-black text-white hover:bg-black/80 transition-all duration-200 cursor-pointer shrink-0 shadow-md"
                    >
                        <span className="text-[12px] font-bold tracking-widest uppercase">← App Hub</span>
                    </button>

                    {/* Center: ETH metrics (desktop) */}
                    <div className="hidden lg:flex items-center gap-0 divide-x divide-black/10 flex-1 mx-6 overflow-hidden justify-center">
                        {[
                            { label: 'ETH Block', value: ethSyncing ? '...' : (blockNumber ?? '---') },
                            { label: 'Base Fee',  value: baseFeeGwei ? `${baseFeeGwei} Gwei` : '---'  },
                            { label: 'UTC',       value: utcTime ?? '---'                             },
                        ].map(m => (
                            <div key={m.label} className="flex flex-col items-center px-6 py-1 min-w-[100px]">
                                <span className="font-mono text-[7px] uppercase tracking-[0.25em] text-black/30">{m.label}</span>
                                <span className="font-mono text-[10px] font-black text-[#050505] tabular-nums leading-tight">{m.value}</span>
                            </div>
                        ))}
                    </div>

                    <div className="flex-1 lg:hidden" /> {/* Spacer on mobile */}

                    {/* Right: Settings */}
                    <button
                        onClick={() => setSettingsOpen(true)}
                        title="Open Settings"
                        className="shrink-0 p-2.5 rounded-full border border-black/10 hover:bg-black/5 hover:scale-105 hover:shadow-sm text-[#888888] hover:text-[#050505] transition-all flex items-center justify-center w-10 h-10 text-[11px] font-black uppercase"
                    >
                        SET
                    </button>
                </header>

                {/* Content Area */}
                <main className="flex-1 flex flex-col min-h-0 bg-white relative">
                    <div
                        id="main-scroll-container"
                        className={`flex-1 min-h-0 overflow-x-hidden flex flex-col no-scrollbar ${activeTab === 'chat' ? 'overflow-hidden' : 'overflow-y-auto'}`}
                        style={{
                            scrollbarWidth: 'none',
                            msOverflowStyle: 'none',
                        }}
                    >
                        <div className="pb-0 md:pb-0 w-full flex-1 flex flex-col relative z-10">
                            <motion.div
                                key={activeTab}
                                initial={{ opacity: 0, filter: 'blur(4px)' }}
                                animate={{ opacity: 1, filter: 'blur(0px)' }}
                                exit={{ opacity: 0, filter: 'blur(4px)' }}
                                transition={{ duration: 0.3, ease: [0.16, 1, 0.3, 1] }}
                                className="w-full h-full flex-1 flex flex-col"
                            >
                                <InstitutionalErrorBoundary moduleName="Loading Module">
                                    {children}
                                </InstitutionalErrorBoundary>
                            </motion.div>
                            {/* iOS spacer for mobile bottom nav */}
                            {showMobileNav && (
                                <div
                                    className="block lg:hidden shrink-0"
                                    style={{ height: 'calc(72px + env(safe-area-inset-bottom, 0px))' }}
                                    aria-hidden="true"
                                />
                            )}
                        </div>
                    </div>
                </main>

                {/* ── Mobile Bottom Nav ── */}
                {showMobileNav && (
                    <nav
                        className="mobile-bottom-nav lg:hidden flex fixed bottom-0 left-0 right-0 items-center justify-around px-2 z-50"
                        style={{
                            height: 'calc(64px + env(safe-area-inset-bottom, 0px))',
                            paddingBottom: 'env(safe-area-inset-bottom, 0px)',
                            background: 'rgba(255,255,255,0.98)',
                            backdropFilter: 'blur(20px)',
                            WebkitBackdropFilter: 'blur(20px)',
                            borderTop: '1px solid rgba(0,0,0,0.08)',
                        }}
                    >
                        {MOBILE_TABS.map(tab => {
                            const isActive = activeTab === tab.id;
                            return (
                                <button
                                    key={tab.id}
                                    onClick={() => {
                                        if (tab.id === 'menu') setIsMenuDrawerOpen(true);
                                        else handleTabChange(tab.id);
                                    }}
                                    style={{ minHeight: 0, minWidth: 0 }}
                                    className={`relative flex flex-col items-center justify-center flex-1 h-full gap-1 transition-colors select-none ${
                                        isActive ? 'text-[#050505]' : 'text-[#AAAAAA]'
                                    }`}
                                >
                                    {/* Active pill indicator */}
                                    {isActive && (
                                        <motion.span
                                            layoutId="mobileTabPill"
                                            className="absolute top-2 left-1/2 -translate-x-1/2 w-6 h-[3px] rounded-full bg-white"
                                        />
                                    )}
                                    <span className={`transition-transform ${isActive ? 'scale-110' : 'scale-100'}`}>
                                        {tab.icon}
                                    </span>
                                    <span className={`text-[9px] font-black uppercase tracking-widest leading-none ${isActive ? 'text-[#050505]' : 'text-[#BBBBBB]'}`}>
                                        {tab.label}
                                    </span>
                                </button>
                            );
                        })}
                    </nav>
                )}

                {/* Status Bar (desktop) */}
                <footer className="hidden md:flex h-7 border-t border-black/[0.07] bg-white items-center justify-between px-6 shrink-0">
                    <div className="flex items-center gap-4 text-[9px] font-black text-black/40 uppercase tracking-widest">
                        <span className="flex items-center gap-1.5">
                            Latency: <span className="text-black/70">{latency > 0 ? `${latency}ms` : '12ms'}</span>
                        </span>
                        <span className="flex items-center gap-1.5">Servers: <span className="text-black/80">{nodeStatus}</span></span>
                    </div>
                    <div className="flex items-center gap-4 text-[9px] font-black text-black/35 uppercase tracking-widest">
                        <span>Connected</span>
                        <span>© 2026 Humanity Ledger</span>
                    </div>
                </footer>
            </div>
        </div>

        {/* Mobile Menu Sheet Drawer */}
        <AnimatePresence>
        {showMobileNav && isMenuDrawerOpen && (
            <motion.div
                initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
                onClick={() => setIsMenuDrawerOpen(false)}
                className="fixed inset-0 z-[9999] bg-black/60 backdrop-blur-sm flex items-end justify-center lg:hidden"
            >
                <motion.div
                    initial={{ y: '100%' }} animate={{ y: 0 }} exit={{ y: '100%' }}
                    transition={{ type: 'spring', damping: 25, stiffness: 220 }}
                    onClick={e => e.stopPropagation()}
                    className="w-full max-w-md bg-white rounded-t-[28px] border-t border-black/[0.08] shadow-[0_-12px_40px_rgba(0,0,0,0.10)] flex flex-col overflow-hidden max-h-[85vh]"
                >
                    {/* Handle */}
                    <div className="flex justify-center py-3">
                        <div className="w-12 h-1 rounded-full bg-black/10" />
                    </div>

                    {/* Title */}
                    <div className="px-6 pb-4 flex justify-between items-center border-b border-black/5">
                        <div>
                            <h3 className="text-[16px] font-bold text-[#050505]">Navigation</h3>
                            <p className="text-[12px] text-black/40 mt-0.5">Choose a section</p>
                        </div>
                        <button
                            onClick={() => setIsMenuDrawerOpen(false)}
                            className="w-7 h-7 rounded-full hover:bg-black/5 flex items-center justify-center transition-colors"
                        >
                            <span className="text-black/50 text-[17px] leading-none font-light">×</span>
                        </button>
                    </div>

                    {/* Nav Items */}
                    <div className="px-4 py-5 overflow-y-auto space-y-1.5">
                        {SIDEBAR_ITEMS.map(item => {
                            const isRestricted   = RESTRICTED_TABS.includes(item.id);
                            const isLocked       = isRestricted && tier === 'FREE';
                            const isActive       = activeTab === item.id;
                            const isZkRestricted = item.requiresZK && !isZkVerified;

                            return (
                                <button
                                    key={item.id}
                                    disabled={!!(isZkRestricted || isLocked)}
                                    onClick={() => { handleTabChange(item.id); setIsMenuDrawerOpen(false); }}
                                    className={`w-full flex items-center justify-between p-4 rounded-2xl transition-all ${
                                        isActive
                                            ? 'bg-white text-white'
                                            : 'bg-black/[0.02] hover:bg-black/[0.05] text-[#050505]'
                                    } disabled:opacity-40 disabled:cursor-not-allowed`}
                                >
                                    <div className="flex items-center gap-3.5">
                                        <div className={isActive ? 'text-white' : 'text-black/50'}>{item.icon}</div>
                                        <span className="text-[14px] font-medium">{item.label}</span>
                                    </div>
                                    <div className="flex items-center gap-2">
                                        {isZkRestricted && (
                                            <span className="text-[10px] font-semibold bg-black/[0.06] text-black/60 px-2 py-0.5 rounded-full border border-black/10">Verify first</span>
                                        )}
                                        {isLocked && (
                                            <span className="text-[10px] font-semibold bg-black/[0.06] text-black/60 px-2 py-0.5 rounded-full border border-black/10">Upgrade</span>
                                        )}
                                        {!isActive && !isZkRestricted && !isLocked && (
                                            <span className="font-mono text-[10px] font-black opacity-30">[&gt;]</span>
                                        )}
                                    </div>
                                </button>
                            );
                        })}
                    </div>

                    <div className="h-4 bg-transparent shrink-0" />
                </motion.div>
            </motion.div>
        )}
        </AnimatePresence>
        </>
    );
}
