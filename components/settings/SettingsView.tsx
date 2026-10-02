// @ts-nocheck
"use client";

import { useCallback } from 'react';
import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useSettings } from '@/src/context/SettingsContext';
import { useUIStore } from '@/lib/store/ui-store';
import { useWalletStore } from '@/lib/store/wallet-store';
import { toast } from 'sonner';
import {
  X, Globe, Shield, EyeOff, FileText, Database, CreditCard,
  Activity, Bell, Moon, Sun, Monitor, Lock, Key, Fingerprint, AlertTriangle,
  Wifi, WifiOff, Zap, BarChart2, Layers, RefreshCw, Trash2, Download,
  Upload, Clock, Sliders, UserCheck, ShieldOff, BellOff, PlugZap, Cpu,
  Gauge, HardDrive, Network, Code2, ChevronDown, Check, Info, ArrowUpRight,
  Search, BookUser, RotateCcw,
} from 'lucide-react';

// ─────────────────────────────────────────────────────────────────────────────
// Types
// ─────────────────────────────────────────────────────────────────────────────
type Tab = 'general' | 'display' | 'security' | 'privacy' | 'network' |
           'gas' | 'notifications' | 'portfolio' | 'contacts' | 'advanced' |
           'data' | 'about';

// ─────────────────────────────────────────────────────────────────────────────
// Primitives
// ─────────────────────────────────────────────────────────────────────────────
function Toggle({ value, onChange, disabled }: { value: boolean; onChange: () => void; disabled?: boolean }) {
  return (
    <button
      onClick={onChange}
      disabled={disabled}
      aria-checked={value}
      role="switch"
      className={`relative w-11 h-6 rounded-full flex items-center px-0.5 transition-colors shrink-0 focus:outline-none focus-visible:ring-2 focus-visible:ring-black/30 ${
        disabled ? 'opacity-40 cursor-not-allowed' : 'cursor-pointer'
      } ${value ? 'bg-black' : 'bg-zinc-200'}`}
    >
      <motion.div
        animate={{ x: value ? 20 : 0 }}
        transition={{ type: 'spring', stiffness: 500, damping: 30 }}
        className="w-5 h-5 rounded-full bg-white shadow-md"
      />
    </button>
  );
}

function Select({ value, options, onChange }: {
  value: string;
  options: { label: string; value: string }[];
  onChange: (v: string) => void;
}) {
  const [open, setOpen] = useState(false);
  const current = options.find(o => o.value === value);
  return (
    <div className="relative shrink-0">
      <button
        onClick={() => setOpen(p => !p)}
        className="flex items-center gap-1.5 bg-[#F2F2F7] hover:bg-zinc-200 text-black text-[12px] font-bold px-3 py-1.5 rounded-xl transition-colors"
      >
        {current?.label ?? value}
        <ChevronDown size={12} />
      </button>
      <AnimatePresence>
        {open && (
          <motion.div
            initial={{ opacity: 0, y: -4, scale: 0.96 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -4, scale: 0.96 }}
            transition={{ duration: 0.12 }}
            className="absolute right-0 top-full mt-1 bg-white rounded-2xl shadow-xl border border-black/5 py-1.5 z-50 min-w-[160px] overflow-hidden"
          >
            {options.map(o => (
              <button
                key={o.value}
                onClick={() => { onChange(o.value); setOpen(false); }}
                className="flex items-center justify-between w-full px-4 py-2.5 text-[12px] font-medium hover:bg-[#F2F2F7] text-black transition-colors"
              >
                {o.label}
                {o.value === value && <Check size={12} className="text-black" />}
              </button>
            ))}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

function SectionLabel({ children }: { children: React.ReactNode }) {
  return (
    <div className="px-1 pt-3 pb-1.5">
      <span className="text-[10px] font-black uppercase tracking-[0.16em] text-zinc-400">{children}</span>
    </div>
  );
}

function Row({
  icon: Icon, title, desc, value, toggle, onToggle, action, actionLabel = 'Manage',
  danger = false, disabled = false, badge, children,
}: {
  icon: any; title: string; desc?: string; value?: string;
  toggle?: boolean; onToggle?: () => void;
  action?: () => void; actionLabel?: string;
  danger?: boolean; disabled?: boolean; badge?: string;
  children?: React.ReactNode;
}) {
  return (
    <div 
      onClick={(e) => {
        if (disabled) return;
        const target = e.target as HTMLElement;
        if (target.tagName === 'BUTTON' || target.closest('button')) return; // let inner buttons handle themselves
        if (target.tagName === 'SELECT' || target.closest('select')) return; // let inner selects handle themselves
        if (onToggle) onToggle();
        else if (action) action();
      }}
      className={`flex items-start justify-between gap-3 p-3.5 bg-white rounded-2xl border transition-all ${
      disabled ? 'opacity-40 pointer-events-none' : 'border-black/[0.05] hover:border-black/[0.12] cursor-pointer'
    }`}>
      <div className="flex items-start gap-3 flex-1 min-w-0">
        <div className={`w-9 h-9 rounded-full flex items-center justify-center shrink-0 mt-0.5 ${danger ? 'bg-red-50 text-red-500' : 'bg-[#F2F2F7] text-black'}`}>
          <Icon size={16} />
        </div>
        <div className="flex flex-col min-w-0 flex-1">
          <div className="flex items-center gap-2">
            <span className={`text-[13px] font-black leading-tight ${danger ? 'text-red-500' : 'text-black'}`}>{title}</span>
            {badge && <span className="text-[9px] font-black uppercase tracking-widest bg-black text-white px-1.5 py-0.5 rounded-full">{badge}</span>}
          </div>
          {desc && <span className="text-[11px] text-zinc-500 font-medium mt-0.5">{desc}</span>}
          {children}
        </div>
      </div>
      <div className="flex items-center gap-2 shrink-0 mt-0.5">
        {value && toggle === undefined && !action && (
          <span className="text-[12px] font-bold text-black bg-[#F2F2F7] px-2.5 py-1 rounded-lg">{value}</span>
        )}
        {toggle !== undefined && onToggle && <Toggle value={toggle} onChange={onToggle} disabled={disabled} />}
        {action && (
          <button
            onClick={action}
            className={`text-[11px] font-bold uppercase tracking-wider px-3.5 py-1.5 rounded-xl transition-colors ${
              danger ? 'bg-red-50 text-red-500 hover:bg-red-100' : 'bg-[#F2F2F7] text-black hover:bg-zinc-200'
            }`}
          >
            {actionLabel}
          </button>
        )}
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Tab config
// ─────────────────────────────────────────────────────────────────────────────
const TABS: { id: Tab; label: string; icon: any }[] = [
  { id: 'general',       label: 'General',       icon: Sliders },
  { id: 'display',       label: 'Display',        icon: Monitor },
  { id: 'security',      label: 'Security',       icon: Shield },
  { id: 'privacy',       label: 'Privacy',        icon: EyeOff },
  { id: 'network',       label: 'Network & RPC',  icon: Network },
  { id: 'gas',           label: 'Gas & Fees',     icon: Gauge },
  { id: 'notifications', label: 'Notifications',  icon: Bell },
  { id: 'portfolio',     label: 'Portfolio',      icon: BarChart2 },
  { id: 'contacts',      label: 'Contacts',       icon: BookUser },
  { id: 'advanced',      label: 'Advanced',       icon: Code2 },
  { id: 'data',          label: 'Data & Export',  icon: HardDrive },
  { id: 'about',         label: 'About',          icon: Info },
];

// ─────────────────────────────────────────────────────────────────────────────
// Main Component — ALL settings wired to SettingsContext (cloud + localStorage)
// ─────────────────────────────────────────────────────────────────────────────
export function SettingsView({ onClose }: { onClose: () => void }) {
  // ── Context (persisted: localStorage + cloud sync per wallet/email) ──
  const {
    theme, setTheme,
    currency, setCurrency,
    language, setLanguage,
    searchEngine, setSearchEngine,
    hideBalances, toggleHideBalances,
    privacyMode, togglePrivacyMode,
    strictMode, toggleStrictMode,
    humanMetrics, toggleHumanMetrics,
    walletStealthMode, toggleWalletStealthMode,
    requirePasswordForSigning, toggleRequirePasswordForSigning,
    autoLockDuration, setAutoLockDuration,
    testNetsEnabled, toggleTestNets,
    ipfsGateway, setIpfsGateway,
    customRPC, setCustomRPC,
    stateLogsEnabled, toggleStateLogs,
    contacts, addContact, removeContact,
    emailNotifications, toggleEmailNotifications,
    pushNotifications, togglePushNotifications,
    transactionAlerts, toggleTransactionAlerts,
    marketingEmails, toggleMarketingEmails,
    defaultSlippage, setDefaultSlippage,
    defaultGasPrice, setDefaultGasPrice,
    executionConfig, setExecutionConfig,
    uiConfig, setUiConfig,
    analyticsConfig, setAnalyticsConfig,
    lockApp, resetAccount,
  } = useSettings();

  const { theme: uiTheme, setTheme: setUiTheme, soundsEnabled, setSoundsEnabled, ghostMode, setGhostMode, isStealthMode, toggleStealthMode } = useUIStore();
  const { address, activeNetwork } = useWalletStore();

  const [activeTab, setActiveTab] = useState<Tab>('general');
  const [newContactName, setNewContactName] = useState('');
  const [newContactAddr, setNewContactAddr] = useState('');

  // ── Handlers ──────────────────────────────────────────────────────────────
  const handleLockWallet = useCallback(() => {
    if (typeof window !== 'undefined') {
      sessionStorage.clear();
      toast.info('Wallet locked. Redirecting...', { duration: 1500 });
      setTimeout(() => window.location.replace('/connect'), 1500);
    }
  }, []);

  const handleRevokeAllSessions = useCallback(() => {
    if (typeof window !== 'undefined') {
      sessionStorage.clear();
      try {
        document.cookie.split(';').forEach(c => {
          document.cookie = c.replace(/^ +/, '').replace(/=.*/, `=;expires=${new Date().toUTCString()};path=/`);
        });
      } catch {}
      toast.success('All sessions revoked.', { duration: 1500 });
      setTimeout(() => window.location.replace('/connect'), 1500);
    }
  }, []);

  const handleClearCache = useCallback(() => {
    if (typeof window !== 'undefined') {
      try { localStorage.removeItem('ledger-ui-storage'); } catch {}
      try { localStorage.removeItem('wallet-store'); } catch {}
      toast.success('Local cache cleared. Reloading...', { duration: 1500 });
      setTimeout(() => window.location.reload(), 1500);
    }
  }, []);

  const handleExportCSV = useCallback(() => {
    const rows = [['Date', 'Type', 'Amount', 'Token', 'TxHash'], ['2027-01-01', 'Receive', '0.5', 'ETH', '0xexample']];
    const csv = rows.map(r => r.join(',')).join('\n');
    const blob = new Blob([csv], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url; a.download = 'humanity_ledger_transactions.csv'; a.click();
    URL.revokeObjectURL(url);
    toast.success('Transaction history exported as CSV.');
  }, []);

  const handleAddContact = useCallback(() => {
    if (!newContactName.trim() || !newContactAddr.trim()) {
      toast.error('Please enter both name and address.'); return;
    }
    if (!/^0x[0-9a-fA-F]{40}$/.test(newContactAddr.trim())) {
      toast.error('Invalid Ethereum address format.'); return;
    }
    addContact(newContactName.trim(), newContactAddr.trim());
    setNewContactName(''); setNewContactAddr('');
    toast.success(`Contact "${newContactName.trim()}" saved.`);
  }, [newContactName, newContactAddr, addContact]);

  const handleHideBalances = useCallback(() => {
    toggleHideBalances();
    toggleStealthMode(); // Also sync with Zustand stealth mode
  }, [toggleHideBalances, toggleStealthMode]);

  const handleIncognito = useCallback(() => {
    toggleWalletStealthMode();
    setGhostMode(!ghostMode);
  }, [toggleWalletStealthMode, ghostMode, setGhostMode]);

  // ── Panels ────────────────────────────────────────────────────────────────

  function renderGeneral() {
    return (
      <div className="flex flex-col gap-1.5">
        <SectionLabel>Regional Preferences</SectionLabel>
        <Row icon={CreditCard} title="Base Currency" desc="Fiat currency used for portfolio valuation.">
          <div className="mt-1.5">
            <Select value={currency} onChange={v => setCurrency(v as any)} options={[
              { label: 'EUR (€)', value: 'EUR' }, { label: 'USD ($)', value: 'USD' },
              { label: 'GBP (£)', value: 'GBP' }, { label: 'RON (lei)', value: 'RON' },
              { label: 'CHF', value: 'CHF' }, { label: 'JPY (¥)', value: 'JPY' },
              { label: 'MXN ($)', value: 'MXN' },
            ]} />
          </div>
        </Row>
        <Row icon={Globe} title="Language" desc="Application display language.">
          <div className="mt-1.5">
            <Select value={language} onChange={v => setLanguage(v as any)} options={[
              { label: 'English', value: 'en' }, { label: 'Español', value: 'es' },
              { label: 'Français', value: 'fr' }, { label: 'Português', value: 'pt' },
            ]} />
          </div>
        </Row>
        <Row icon={Search} title="Search Engine" desc="Used for web search within the app.">
          <div className="mt-1.5">
            <Select value={searchEngine} onChange={v => setSearchEngine(v as any)} options={[
              { label: 'Google', value: 'Google' },
              { label: 'DuckDuckGo', value: 'DuckDuckGo' },
              { label: 'Brave Search', value: 'Brave' },
            ]} />
          </div>
        </Row>

        <SectionLabel>Interface</SectionLabel>
        <Row icon={Activity} title="Sound Effects" desc="Auditory feedback on transaction confirmations." toggle={soundsEnabled} onToggle={() => setSoundsEnabled(!soundsEnabled)} />
      </div>
    );
  }

  function renderDisplay() {
    return (
      <div className="flex flex-col gap-1.5">
        <SectionLabel>Theme</SectionLabel>
        <div className="grid grid-cols-3 gap-2 mb-1">
          {([
            { label: 'Light', value: 'light', icon: Sun },
            { label: 'Dark', value: 'dark', icon: Moon },
            { label: 'System', value: 'auto', icon: Monitor },
          ] as const).map(({ label, value, icon: Icon }) => (
            <button
              key={value}
              onClick={() => { setTheme(value as any); setUiTheme(value === 'auto' ? 'system' : value as any); }}
              className={`flex flex-col items-center gap-2 py-3 rounded-2xl border transition-all ${
                theme === value ? 'bg-black text-white border-black' : 'bg-white text-zinc-600 border-black/10 hover:border-black/20'
              }`}
            >
              <Icon size={18} />
              <span className="text-[11px] font-black uppercase tracking-wider">{label}</span>
            </button>
          ))}
        </div>

        <SectionLabel>Charts & Data</SectionLabel>
        <Row icon={BarChart2} title="Portfolio Chart" desc="Show / hide the net-worth history graph." toggle={uiConfig.showPortfolioChart ?? true} onToggle={() => setUiConfig({ ...uiConfig, showPortfolioChart: !uiConfig.showPortfolioChart })} />
        <Row icon={Activity} title="Show PnL" desc="Display profit & loss next to each asset." toggle={uiConfig.showPnl ?? true} onToggle={() => setUiConfig({ ...uiConfig, showPnl: !uiConfig.showPnl })} />
        <Row icon={Gauge} title="Live Gas Tracker" desc="Show current Ethereum gas in the header." toggle={uiConfig.showGasTracker ?? true} onToggle={() => setUiConfig({ ...uiConfig, showGasTracker: !uiConfig.showGasTracker })} />

        <SectionLabel>Assets</SectionLabel>
        <Row icon={EyeOff} title="Hide Zero Balances" desc="Don't show tokens with 0.00 balance." toggle={uiConfig.hideZeroBalances ?? false} onToggle={() => setUiConfig({ ...uiConfig, hideZeroBalances: !uiConfig.hideZeroBalances })} />
        <Row icon={Layers} title="Show NFT Gallery" desc="Display your NFT collection in portfolio." toggle={uiConfig.showNFTs ?? true} onToggle={() => setUiConfig({ ...uiConfig, showNFTs: !uiConfig.showNFTs })} />
        <Row icon={Layers} title="Show Token Logos" desc="Display asset icons next to token names." toggle={uiConfig.showTokenLogos ?? true} onToggle={() => setUiConfig({ ...uiConfig, showTokenLogos: !uiConfig.showTokenLogos })} />
      </div>
    );
  }

  function renderSecurity() {
    return (
      <div className="flex flex-col gap-1.5">
        <SectionLabel>Auto-Lock</SectionLabel>
        <Row icon={Clock} title="Auto-Lock Timer" desc="Automatically lock wallet after inactivity.">
          <div className="mt-1.5">
            <Select value={String(autoLockDuration)} onChange={v => setAutoLockDuration(Number(v))} options={[
              { label: 'Never', value: '0' }, { label: '1 Minute', value: '1' },
              { label: '5 Minutes', value: '5' }, { label: '15 Minutes', value: '15' },
              { label: '30 Minutes', value: '30' }, { label: '1 Hour', value: '60' },
            ]} />
          </div>
        </Row>
        <Row icon={Fingerprint} title="Biometric Unlock" desc="Use Face ID or fingerprint to unlock." toggle={uiConfig.biometricEnabled ?? false} onToggle={() => setUiConfig({ ...uiConfig, biometricEnabled: !uiConfig.biometricEnabled })} badge="Native" />

        <SectionLabel>Transaction Safety</SectionLabel>
        <Row icon={UserCheck} title="Require Password for Signing" desc="Always confirm vault password before signing transactions." toggle={requirePasswordForSigning} onToggle={toggleRequirePasswordForSigning} />
        <Row icon={AlertTriangle} title="Strict Mode (Whitelist Only)" desc="Only allow transactions to addresses in your contact book." toggle={strictMode} onToggle={toggleStrictMode} />
        <Row icon={Activity} title="Pre-flight Verification" desc="Preview exact token flows before broadcasting." toggle={executionConfig.verifyBeforeSend ?? true} onToggle={() => setExecutionConfig({ ...executionConfig, verifyBeforeSend: !executionConfig.verifyBeforeSend })} badge="Pro" />
        <Row icon={Shield} title="Phishing Detection" desc="Warn when interacting with flagged contracts." toggle={uiConfig.phishingDetection ?? true} onToggle={() => setUiConfig({ ...uiConfig, phishingDetection: !uiConfig.phishingDetection })} />

        <SectionLabel>Session Control</SectionLabel>
        <Row icon={Lock} title="Lock Wallet Now" desc="Immediately end the current session." action={handleLockWallet} actionLabel="Lock Now" />
        <Row icon={ShieldOff} title="Revoke All Sessions" desc="Sign out all devices simultaneously." action={handleRevokeAllSessions} actionLabel="Revoke All" danger />
      </div>
    );
  }

  function renderPrivacy() {
    return (
      <div className="flex flex-col gap-1.5">
        <SectionLabel>Balance Visibility</SectionLabel>
        <Row icon={EyeOff} title="Hide Balances" desc="Mask all portfolio values on screen." toggle={hideBalances} onToggle={handleHideBalances} />
        <Row icon={UserCheck} title="Incognito Mode" desc="Stop broadcasting your address in DApp connections." toggle={walletStealthMode} onToggle={handleIncognito} />

        <SectionLabel>Data & Analytics</SectionLabel>
        <Row icon={BarChart2} title="Human Metrics (Analytics)" desc="Share anonymised usage data to improve the app." toggle={humanMetrics} onToggle={toggleHumanMetrics} />
        <Row icon={Shield} title="Privacy Mode" desc="Block third-party data requests from within the app." toggle={privacyMode} onToggle={togglePrivacyMode} />

        <SectionLabel>On-Chain Privacy</SectionLabel>
        <Row icon={Globe} title="Block Explorer" desc="Privacy-respecting explorer preference." toggle={uiConfig.useBlockscout ?? false} onToggle={() => setUiConfig({ ...uiConfig, useBlockscout: !uiConfig.useBlockscout })} value={uiConfig.useBlockscout ? 'Blockscout' : 'Etherscan'} />
        <Row icon={Database} title="IPFS Gateway" desc="Resolve decentralized content through:">
          <div className="mt-1.5">
            <Select value={ipfsGateway} onChange={setIpfsGateway} options={[
              { label: 'Cloudflare', value: 'https://cloudflare-ipfs.com/ipfs/' },
              { label: 'Protocol Labs', value: 'https://ipfs.io/ipfs/' },
              { label: 'Pinata', value: 'https://gateway.pinata.cloud/ipfs/' },
            ]} />
          </div>
        </Row>
      </div>
    );
  }

  function renderNetwork() {
    return (
      <div className="flex flex-col gap-1.5">
        <SectionLabel>RPC Provider</SectionLabel>
        <Row icon={PlugZap} title="Primary RPC Provider" desc="Blockchain node source for all read/write calls.">
          <div className="mt-1.5">
            <Select value={executionConfig.rpcProvider ?? 'alchemy'} onChange={v => setExecutionConfig({ ...executionConfig, rpcProvider: v })} options={[
              { label: 'Alchemy (Auto)', value: 'alchemy' },
              { label: 'Infura', value: 'infura' },
              { label: 'GetBlock', value: 'getblock' },
              { label: 'Public Nodes', value: 'public' },
            ]} />
          </div>
        </Row>
        <Row icon={Wifi} title="Custom RPC Endpoint" desc="Override with a manual RPC URL.">
          <input
            className="mt-1.5 w-full text-[11px] font-mono bg-[#F2F2F7] rounded-xl px-3 py-2 text-black placeholder-zinc-400 outline-none focus:ring-2 focus:ring-black/20"
            placeholder="https://your-custom-rpc.com"
            value={customRPC}
            onChange={e => setCustomRPC(e.target.value)}
          />
        </Row>
        <Row icon={Wifi} title="WebSocket Real-Time Sync" desc="Live balance streaming via WSS connections." toggle={executionConfig.wssEnabled ?? true} onToggle={() => setExecutionConfig({ ...executionConfig, wssEnabled: !executionConfig.wssEnabled })} />

        <SectionLabel>Testnets & Switching</SectionLabel>
        <Row icon={WifiOff} title="Show Testnets" desc="Display Sepolia, Arbitrum Sepolia, Amoy testnet assets." toggle={testNetsEnabled} onToggle={toggleTestNets} />
        <Row icon={Activity} title="Auto-Switch Network" desc="Auto-match network when connecting to a DApp." toggle={executionConfig.autoSwitchNetwork ?? true} onToggle={() => setExecutionConfig({ ...executionConfig, autoSwitchNetwork: !executionConfig.autoSwitchNetwork })} />
      </div>
    );
  }

  function renderGas() {
    const gasPreset = executionConfig.gasPreset ?? 'standard';
    const slippage = executionConfig.slippage ?? 0.5;
    const mevProtection = executionConfig.mevProtection ?? true;

    return (
      <div className="flex flex-col gap-1.5">
        <SectionLabel>Gas Speed Strategy</SectionLabel>
        <div className="grid grid-cols-3 gap-2">
          {([
            { label: 'Slow', value: 'slow', sub: '~2 min', gwei: '~5' },
            { label: 'Standard', value: 'standard', sub: '~30s', gwei: '~15' },
            { label: 'Fast', value: 'fast', sub: '~12s', gwei: '~30' },
          ]).map(({ label, value, sub, gwei }) => (
            <button
              key={value}
              onClick={() => { setExecutionConfig({ ...executionConfig, gasPreset: value }); setDefaultGasPrice(value); }}
              className={`flex flex-col items-center gap-1 py-3.5 rounded-2xl border transition-all ${
                gasPreset === value ? 'bg-black text-white border-black' : 'bg-white text-zinc-600 border-black/10 hover:border-black/20'
              }`}
            >
              <span className="text-[13px] font-black">{label}</span>
              <span className={`text-[10px] font-mono ${gasPreset === value ? 'text-white/60' : 'text-zinc-400'}`}>{gwei} gwei</span>
              <span className={`text-[10px] font-medium ${gasPreset === value ? 'text-white/50' : 'text-zinc-400'}`}>{sub}</span>
            </button>
          ))}
        </div>

        <SectionLabel>Swap Configuration</SectionLabel>
        <Row icon={Gauge} title="Slippage Tolerance" desc="Maximum acceptable price impact per swap.">
          <div className="mt-1.5 flex gap-1.5 flex-wrap">
            {[0.1, 0.5, 1.0, 3.0].map(v => (
              <button
                key={v}
                onClick={() => { setDefaultSlippage(v); setExecutionConfig({ ...executionConfig, slippage: v }); }}
                className={`text-[12px] font-bold px-3 py-1.5 rounded-xl transition-colors ${
                  Math.abs(slippage - v) < 0.001 ? 'bg-black text-white' : 'bg-[#F2F2F7] text-black hover:bg-zinc-200'
                }`}
              >
                {v}%
              </button>
            ))}
          </div>
          <p className="text-[10px] text-zinc-400 mt-1 font-medium">Currently: {slippage}%</p>
        </Row>
        <Row icon={Clock} title="Transaction Deadline" desc="Swap expires if not mined within this window.">
          <div className="mt-1.5">
            <Select value={String(executionConfig.deadlineMinutes ?? 20)} onChange={v => setExecutionConfig({ ...executionConfig, deadlineMinutes: Number(v) })} options={[
              { label: '10 minutes', value: '10' }, { label: '20 minutes', value: '20' },
              { label: '30 minutes', value: '30' }, { label: '60 minutes', value: '60' },
            ]} />
          </div>
        </Row>

        <SectionLabel>MEV & Gas Protection</SectionLabel>
        <Row icon={Shield} title="MEV Protection (Flashbots)" desc="Route swaps via Flashbots to prevent front-running bots." toggle={mevProtection} onToggle={() => setExecutionConfig({ ...executionConfig, mevProtection: !mevProtection })} badge="Advanced" />
        <Row icon={Zap} title="Gas Limit Buffer" desc="Safety multiplier applied on top of estimated gas cost.">
          <div className="mt-1.5">
            <Select value={String(executionConfig.gasLimitBuffer ?? '1.2')} onChange={v => setExecutionConfig({ ...executionConfig, gasLimitBuffer: v })} options={[
              { label: '1.1× Buffer', value: '1.1' }, { label: '1.2× Buffer', value: '1.2' },
              { label: '1.5× Buffer', value: '1.5' }, { label: '2.0× Buffer', value: '2.0' },
            ]} />
          </div>
        </Row>
      </div>
    );
  }

  function renderNotifications() {
    return (
      <div className="flex flex-col gap-1.5">
        <SectionLabel>Transaction Alerts</SectionLabel>
        <Row icon={Download} title="Incoming Transfers" desc="Notify when you receive crypto." toggle={transactionAlerts} onToggle={toggleTransactionAlerts} />
        <Row icon={Upload} title="Outgoing Confirmations" desc="Confirm when your outbound transaction is mined." toggle={uiConfig.notifOutgoing ?? true} onToggle={() => setUiConfig({ ...uiConfig, notifOutgoing: !uiConfig.notifOutgoing })} />
        <Row icon={ArrowUpRight} title="Bridge Completions" desc="Notify when a cross-chain bridge transfer settles." toggle={uiConfig.notifBridge ?? true} onToggle={() => setUiConfig({ ...uiConfig, notifBridge: !uiConfig.notifBridge })} />

        <SectionLabel>Market Alerts</SectionLabel>
        <Row icon={Activity} title="Price Alerts" desc="Alerts when watched assets hit your target price." toggle={uiConfig.notifPriceAlerts ?? false} onToggle={() => setUiConfig({ ...uiConfig, notifPriceAlerts: !uiConfig.notifPriceAlerts })} />
        <Row icon={BarChart2} title="DeFi Yield Updates" desc="Daily summary of accrued yields and rewards." toggle={uiConfig.notifDeFiYield ?? true} onToggle={() => setUiConfig({ ...uiConfig, notifDeFiYield: !uiConfig.notifDeFiYield })} />

        <SectionLabel>Security Notifications</SectionLabel>
        <Row icon={AlertTriangle} title="Security Alerts" desc="Immediate warnings for suspicious activity detected on your address." toggle={uiConfig.notifSecurityAlerts ?? true} onToggle={() => setUiConfig({ ...uiConfig, notifSecurityAlerts: !uiConfig.notifSecurityAlerts })} />

        <SectionLabel>Communication</SectionLabel>
        <Row icon={Bell} title="Push Notifications" desc="Browser / mobile push notification channel." toggle={pushNotifications} onToggle={togglePushNotifications} />
        <Row icon={BellOff} title="Email Notifications" desc="Transaction and security digest to your email." toggle={emailNotifications} onToggle={toggleEmailNotifications} />
        <Row icon={BellOff} title="Newsletter & Product Updates" desc="Release notes, announcements, and tips." toggle={marketingEmails} onToggle={toggleMarketingEmails} />
      </div>
    );
  }

  function renderPortfolio() {
    return (
      <div className="flex flex-col gap-1.5">
        <SectionLabel>Asset Ordering & Grouping</SectionLabel>
        <Row icon={BarChart2} title="Token Sort Order" desc="How tokens are ranked and displayed.">
          <div className="mt-1.5">
            <Select value={uiConfig.tokenSort ?? 'value_desc'} onChange={v => setUiConfig({ ...uiConfig, tokenSort: v })} options={[
              { label: 'Value: High → Low', value: 'value_desc' },
              { label: 'Value: Low → High', value: 'value_asc' },
              { label: 'Alphabetical (A → Z)', value: 'alpha' },
              { label: 'Recent Activity', value: 'recent' },
            ]} />
          </div>
        </Row>
        <Row icon={Network} title="Group by Network" desc="Cluster token cards by blockchain (Eth, Polygon, etc)." toggle={uiConfig.groupByNetwork ?? true} onToggle={() => setUiConfig({ ...uiConfig, groupByNetwork: !uiConfig.groupByNetwork })} />
        <Row icon={EyeOff} title="Hide Spam Tokens" desc="Automatically filter out airdrop and phishing tokens." toggle={uiConfig.hideSpamTokens ?? true} onToggle={() => setUiConfig({ ...uiConfig, hideSpamTokens: !uiConfig.hideSpamTokens })} />

        <SectionLabel>DeFi & Staking</SectionLabel>
        <Row icon={Zap} title="Show DeFi Positions" desc="Display LP pools, lending positions, and yield farms." toggle={uiConfig.showDeFiPositions ?? true} onToggle={() => setUiConfig({ ...uiConfig, showDeFiPositions: !uiConfig.showDeFiPositions })} />
        <Row icon={Layers} title="Show Staking Positions" desc="Include liquid staking and validator rewards." toggle={uiConfig.showStaking ?? true} onToggle={() => setUiConfig({ ...uiConfig, showStaking: !uiConfig.showStaking })} />

        <SectionLabel>Auto-Refresh</SectionLabel>
        <Row icon={RefreshCw} title="Balance Refresh Interval" desc="Frequency of automatic balance updates.">
          <div className="mt-1.5">
            <Select value={uiConfig.portfolioRefresh ?? '30s'} onChange={v => setUiConfig({ ...uiConfig, portfolioRefresh: v })} options={[
              { label: '10 seconds', value: '10s' }, { label: '30 seconds', value: '30s' },
              { label: '1 minute', value: '1min' }, { label: '5 minutes', value: '5min' },
            ]} />
          </div>
        </Row>
      </div>
    );
  }

  function renderContacts() {
    return (
      <div className="flex flex-col gap-1.5">
        <SectionLabel>Address Book</SectionLabel>
        {contacts.length === 0 && (
          <div className="p-5 bg-white rounded-2xl border border-black/[0.06] text-center">
            <p className="text-[13px] text-zinc-400 font-medium">No contacts saved yet.</p>
          </div>
        )}
        {contacts.map(c => (
          <div key={c.id} className="flex items-center justify-between p-3.5 bg-white rounded-2xl border border-black/[0.05]">
            <div className="flex flex-col min-w-0">
              <span className="text-[13px] font-black text-black truncate">{c.name}</span>
              <span className="text-[11px] font-mono text-zinc-500 truncate">{c.address}</span>
              {c.memo && <span className="text-[11px] text-zinc-400 mt-0.5">{c.memo}</span>}
            </div>
            <button onClick={() => { removeContact(c.id); toast.success(`Contact "${c.name}" removed.`); }}
              className="text-[11px] font-bold text-red-500 bg-red-50 hover:bg-red-100 px-3.5 py-1.5 rounded-xl transition-colors shrink-0 ml-3">
              Remove
            </button>
          </div>
        ))}
        <SectionLabel>Add New Contact</SectionLabel>
        <div className="bg-white rounded-2xl border border-black/[0.05] p-4 flex flex-col gap-2">
          <input
            className="text-[12px] font-medium bg-[#F2F2F7] rounded-xl px-3 py-2.5 text-black placeholder-zinc-400 outline-none focus:ring-2 focus:ring-black/20"
            placeholder="Contact name"
            value={newContactName}
            onChange={e => setNewContactName(e.target.value)}
          />
          <input
            className="text-[12px] font-mono bg-[#F2F2F7] rounded-xl px-3 py-2.5 text-black placeholder-zinc-400 outline-none focus:ring-2 focus:ring-black/20"
            placeholder="0x... Ethereum address"
            value={newContactAddr}
            onChange={e => setNewContactAddr(e.target.value)}
          />
          <button
            onClick={handleAddContact}
            className="w-full py-2.5 bg-black text-white text-[12px] font-black uppercase tracking-wider rounded-xl hover:bg-zinc-800 transition-colors"
          >
            Save Contact
          </button>
        </div>
      </div>
    );
  }

  function renderAdvanced() {
    return (
      <div className="flex flex-col gap-1.5">
        <SectionLabel>Developer Tools</SectionLabel>
        <Row icon={Code2} title="Developer Mode" desc="Enable advanced RPC inspector and raw call data." toggle={analyticsConfig.developerMode ?? false} onToggle={() => setAnalyticsConfig({ developerMode: !analyticsConfig.developerMode })} />
        <Row icon={Database} title="Show Hex Calldata" desc="Decode and display raw transaction hex data." toggle={analyticsConfig.showHexData ?? false} onToggle={() => setAnalyticsConfig({ showHexData: !analyticsConfig.showHexData })} disabled={!analyticsConfig.developerMode} />
        <Row icon={Sliders} title="State Logs" desc="Print verbose application state to browser console." toggle={stateLogsEnabled} onToggle={toggleStateLogs} disabled={!analyticsConfig.developerMode} />

        <SectionLabel>Expert Mode</SectionLabel>
        <Row
          icon={AlertTriangle}
          title="Expert Mode"
          desc="Bypass all safety confirmations. Only use if you fully understand what you are doing."
          toggle={executionConfig.expertMode ?? false}
          onToggle={() => {
            if (!executionConfig.expertMode) toast.warning('Expert Mode disables all safety prompts.', { duration: 5000 });
            setExecutionConfig({ ...executionConfig, expertMode: !executionConfig.expertMode });
          }}
          danger
        />
        <Row icon={Key} title="Custom Nonce Override" desc="Manually set transaction sequence nonces." toggle={executionConfig.customNonce ?? false} onToggle={() => setExecutionConfig({ ...executionConfig, customNonce: !executionConfig.customNonce })} disabled={!executionConfig.expertMode} />

        <SectionLabel>Zero-Knowledge Proving</SectionLabel>
        <Row icon={Cpu} title="WASM Client-Side Proving" desc="Generate zk-SNARK proofs locally in your browser (private, but CPU-intensive)." toggle={executionConfig.wasmProving ?? true} onToggle={() => setExecutionConfig({ ...executionConfig, wasmProving: !executionConfig.wasmProving })} badge="ZK" />
      </div>
    );
  }

  function renderData() {
    return (
      <div className="flex flex-col gap-1.5">
        <SectionLabel>Export Your Data</SectionLabel>
        <Row icon={FileText} title="Export Transaction History (CSV)" desc="Download a complete CSV file of all on-chain activity." action={handleExportCSV} actionLabel="Export" />
        <Row icon={Download} title="Export Connected Wallets" desc="Download a JSON list of all wallet addresses you've connected." action={() => {
          const data = JSON.stringify({ wallets: [address], exported: new Date().toISOString() }, null, 2);
          const blob = new Blob([data], { type: 'application/json' });
          const url = URL.createObjectURL(blob); const a = document.createElement('a');
          a.href = url; a.download = 'humanity_ledger_wallets.json'; a.click();
          URL.revokeObjectURL(url); toast.success('Wallet export ready.');
        }} actionLabel="Export" />
        <Row icon={FileText} title="GDPR Data Request" desc="Request a complete copy of all personal data we store." action={() => toast.info('GDPR data request submitted. Response within 72 hours.')} actionLabel="Request" />

        <SectionLabel>Local Storage</SectionLabel>
        <Row icon={HardDrive} title="Clear App Cache" desc="Reset all cached balances and UI preferences." action={handleClearCache} actionLabel="Clear Cache" />
        <Row icon={Trash2} title="Clear Transaction Cache" desc="Remove locally cached transaction history." action={() => { try { localStorage.removeItem('tx-history'); localStorage.removeItem('ledger_tx_cache'); } catch {} toast.success('Transaction cache cleared.'); }} actionLabel="Clear" />

        <SectionLabel>Account</SectionLabel>
        <Row icon={RotateCcw} title="Reset All Settings" desc="Restore all settings to factory defaults." action={() => { resetAccount(); toast.info('Settings reset to defaults.'); }} actionLabel="Reset" danger />
        <Row icon={AlertTriangle} title="Disconnect All Wallets" desc="Remove all connected wallet sessions from this device." action={() => { handleRevokeAllSessions(); }} actionLabel="Disconnect" danger />
      </div>
    );
  }

  function renderAbout() {
    return (
      <div className="flex flex-col gap-2">
        <div className="p-5 bg-white rounded-2xl border border-black/[0.06] text-center">
          <div className="w-14 h-14 rounded-2xl bg-black flex items-center justify-center mx-auto mb-3">
            <Globe size={28} className="text-white" />
          </div>
          <h3 className="text-[16px] font-black text-black tracking-tight">Humanity Ledger</h3>
          <p className="text-[12px] text-zinc-500 mt-1">Version 1.0.0 · First Release 01/01/2027</p>
          <p className="text-[11px] text-zinc-400 mt-0.5">humanidfi.com</p>
        </div>

        <SectionLabel>Legal</SectionLabel>
        <Row icon={FileText} title="Terms of Service" desc="humanidfi.com/docs/terms" action={() => window.open('/docs/terms', '_blank')} actionLabel="View" />
        <Row icon={Shield} title="Privacy Policy" desc="humanidfi.com/docs/privacy" action={() => window.open('/docs/privacy', '_blank')} actionLabel="View" />
        <Row icon={Key} title="Security Audit Reports" desc="Public cryptographic audit reports — Q1 2027." action={() => toast.info('Audit reports coming January 2027.')} actionLabel="View" />

        <SectionLabel>Runtime Info</SectionLabel>
        <Row icon={Activity} title="Active Network" value={activeNetwork?.name ?? 'Ethereum Mainnet'} />
        <Row icon={Key} title="Connected Wallet" value={address ? `${address.slice(0, 8)}…${address.slice(-6)}` : 'Not connected'} />
        <Row icon={Globe} title="App Build" value="v1.0.0-rc1 · Next.js 15" />
      </div>
    );
  }

  const panels: Record<Tab, () => JSX.Element> = {
    general: renderGeneral, display: renderDisplay, security: renderSecurity,
    privacy: renderPrivacy, network: renderNetwork, gas: renderGas,
    notifications: renderNotifications, portfolio: renderPortfolio,
    contacts: renderContacts, advanced: renderAdvanced,
    data: renderData, about: renderAbout,
  };

  // ─────────────────────────────────────────────────────────────────────────────
  // Render
  // ─────────────────────────────────────────────────────────────────────────────
  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/25 backdrop-blur-sm p-4">
      <motion.div
        initial={{ opacity: 0, scale: 0.95, y: 12 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.95, y: 12 }}
        transition={{ duration: 0.22, ease: [0.23, 1, 0.32, 1] }}
        className="bg-white rounded-[28px] shadow-2xl w-full max-w-[820px] h-[620px] overflow-hidden flex flex-col font-sans border border-black/[0.05]"
      >
        {/* Header */}
        <header className="px-6 py-4 border-b border-zinc-100 flex items-center justify-between shrink-0">
          <div>
            <h2 className="text-[18px] font-black text-black tracking-tight">Settings</h2>
            <p className="text-[12px] text-zinc-500 font-medium mt-0.5">
              {TABS.find(t => t.id === activeTab)?.label} · Changes saved automatically
            </p>
          </div>
          <button
            onClick={onClose}
            className="w-9 h-9 rounded-full bg-zinc-50 flex items-center justify-center text-zinc-500 hover:bg-zinc-100 hover:text-black transition-colors"
          >
            <X size={18} />
          </button>
        </header>

        {/* Body: Sidebar + Content */}
        <div className="flex flex-1 overflow-hidden">
          {/* Sidebar */}
          <nav className="w-[190px] shrink-0 border-r border-zinc-100 overflow-y-auto py-3 px-2 flex flex-col gap-0.5 bg-[#FAFAFA]">
            {TABS.map(({ id, label, icon: Icon }) => (
              <button
                key={id}
                onClick={() => setActiveTab(id)}
                className={`flex items-center gap-2.5 px-3 py-2.5 rounded-xl text-left transition-all w-full ${
                  activeTab === id ? 'bg-black text-white' : 'text-zinc-600 hover:bg-zinc-100 hover:text-black'
                }`}
              >
                <Icon size={14} className="shrink-0" />
                <span className="text-[12px] font-bold tracking-tight">{label}</span>
              </button>
            ))}
          </nav>

          {/* Content */}
          <div className="flex-1 overflow-y-auto p-4 bg-[#FAFAFA]">
            <AnimatePresence mode="wait">
              <motion.div
                key={activeTab}
                initial={{ opacity: 0, x: 8 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -8 }}
                transition={{ duration: 0.13 }}
              >
                {panels[activeTab]()}
              </motion.div>
            </AnimatePresence>
          </div>
        </div>
      </motion.div>
    </div>
  );
}

