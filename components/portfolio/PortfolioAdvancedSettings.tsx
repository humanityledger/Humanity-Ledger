"use client";

import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { 
    X, Settings as SettingsIcon, Globe, Shield, Activity, 
    Network, FlaskConical, Info, Check, Copy, Trash2, 
    Search, Download, Users, Lock, Eye, EyeOff, Bell,
    Fingerprint, HardDrive, Smartphone, Zap, FileJson, AlertTriangle, ArrowRight, ChevronRight
} from 'lucide-react';
import { toast } from 'sonner';
import { useEnsName } from 'wagmi';

// Constants for styling
const BG = "transparent";
const INK = "#050505";
const MUTED = "rgba(5,5,5,0.45)";
const BORDER = "rgba(5,5,5,0.08)";
const CARD = "rgba(255, 255, 255, 0.85)";
const CARD_HOVER = "rgba(0, 0, 0, 0.03)";

export interface PortfolioSettingsProps {
    isOpen: boolean;
    onClose: () => void;
    userAddress?: string | null;
}

type TabType = 'general' | 'advanced' | 'contacts' | 'security' | 'alerts' | 'networks' | 'experimental' | 'about';

export function PortfolioAdvancedSettings({ isOpen, onClose, userAddress }: PortfolioSettingsProps) {
    const [activeTab, setActiveTab] = useState<TabType>('general');

    // State for General
    const [currency, setCurrency] = useState('EUR');
    const [primaryDisplay, setPrimaryDisplay] = useState('crypto');
    const [language, setLanguage] = useState('en');

    // State for Advanced
    const [autoLockTimer, setAutoLockTimer] = useState('0');
    const [showHexData, setShowHexData] = useState(false);
    const [advancedGas, setAdvancedGas] = useState(false);
    const [showTestnets, setShowTestnets] = useState(false);

    // State for Contacts
    const [contacts, setContacts] = useState<Record<string, string>>({});
    const [newContactName, setNewContactName] = useState('');
    const [newContactAddress, setNewContactAddress] = useState('');

    // State for Security
    const [phishingDetection, setPhishingDetection] = useState(true);
    const [incomingTxs, setIncomingTxs] = useState(true);

    // State for Alerts
    const [pushEnabled, setPushEnabled] = useState(false);
    const [priceAlerts, setPriceAlerts] = useState(true);

    // State for Experimental
    const [quantumRouting, setQuantumRouting] = useState(false);
    const [tokenDetection, setTokenDetection] = useState(true);

    // Load persisted data
    useEffect(() => {
        if (!isOpen) return;
        try {
            setCurrency(localStorage.getItem('sys_set_currency') || 'EUR');
            setPrimaryDisplay(localStorage.getItem('sys_set_primary') || 'crypto');
            setLanguage(localStorage.getItem('sys_set_lang') || 'en');
            setAutoLockTimer(localStorage.getItem('sys_set_autolock') || '0');
            setShowHexData(localStorage.getItem('sys_set_hex') === 'true');
            setAdvancedGas(localStorage.getItem('sys_set_gas') === 'true');
            setShowTestnets(localStorage.getItem('sys_set_testnets') === 'true');
            setPhishingDetection(localStorage.getItem('sys_set_phishing') !== 'false');
            setIncomingTxs(localStorage.getItem('sys_set_incoming') !== 'false');
            setPushEnabled(localStorage.getItem('sys_set_push') === 'true');
            setPriceAlerts(localStorage.getItem('sys_set_pricealerts') !== 'false');
            setQuantumRouting(localStorage.getItem('sys_set_quantum') === 'true');
            setTokenDetection(localStorage.getItem('sys_set_tokendetect') !== 'false');
            
            const savedContacts = localStorage.getItem('sys_set_contacts');
            if (savedContacts) setContacts(JSON.parse(savedContacts));
        } catch (e) {}
    }, [isOpen]);

    // Save helper
    const save = (key: string, value: string | boolean) => {
        localStorage.setItem(key, String(value));
    };

    const handleCopy = (text: string) => {
        navigator.clipboard.writeText(text);
        toast.success('Copied to clipboard');
    };

    const handleAddContact = () => {
        if (!newContactName || !newContactAddress) return;
        if (!/^0x[a-fA-F0-9]{40}$/.test(newContactAddress) && !newContactAddress.endsWith('.eth')) {
            toast.error('Invalid address format');
            return;
        }
        const updated = { ...contacts, [newContactName]: newContactAddress };
        setContacts(updated);
        localStorage.setItem('sys_set_contacts', JSON.stringify(updated));
        setNewContactName('');
        setNewContactAddress('');
        toast.success('Contact added to Address Book');
    };

    const handleRemoveContact = (name: string) => {
        const updated = { ...contacts };
        delete updated[name];
        setContacts(updated);
        localStorage.setItem('sys_set_contacts', JSON.stringify(updated));
        toast.success('Contact removed');
    };

    const handleDownloadLogs = () => {
        const logs = {
            timestamp: new Date().toISOString(),
            address: userAddress,
            settings: { currency, primaryDisplay, showTestnets, quantumRouting },
            userAgent: navigator.userAgent
        };
        const blob = new Blob([JSON.stringify(logs, null, 2)], { type: 'application/json' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `state-logs-${Date.now()}.json`;
        a.click();
        URL.revokeObjectURL(url);
        toast.success('State logs downloaded successfully');
    };

    const handleClearData = () => {
        localStorage.removeItem('sys_set_contacts');
        setContacts({});
        toast.success('Activity and local data cleared');
    };

    // Component Rendering
    if (!isOpen) return null;

    const tabs: { id: TabType; label: string; icon: any }[] = [
        { id: 'general', label: 'General', icon: SettingsIcon },
        { id: 'advanced', label: 'Advanced', icon: FlaskConical },
        { id: 'contacts', label: 'Contacts', icon: Users },
        { id: 'security', label: 'Security & Privacy', icon: Shield },
        { id: 'alerts', label: 'Alerts', icon: Bell },
        { id: 'networks', label: 'Networks', icon: Network },
        { id: 'experimental', label: 'Experimental', icon: Zap },
        { id: 'about', label: 'About', icon: Info },
    ];

    return (
        <AnimatePresence>
            <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                className="fixed inset-0 z-[100] flex items-center justify-center p-4 sm:p-6 bg-black/20 backdrop-blur-sm"
            >
                <motion.div
                    initial={{ scale: 0.95, y: 20 }}
                    animate={{ scale: 1, y: 0 }}
                    exit={{ scale: 0.95, y: 20 }}
                    transition={{ type: "spring", damping: 25, stiffness: 300 }}
                    className="w-full max-w-5xl h-[85vh] sm:h-[80vh] flex flex-col sm:flex-row rounded-[2rem] border overflow-hidden shadow-2xl"
                    style={{ background: "#FFFFFF", borderColor: BORDER }}
                >
                    {/* SIDEBAR */}
                    <div className="w-full sm:w-64 shrink-0 flex flex-col border-r bg-white/50" style={{ borderColor: BORDER }}>
                        <div className="p-6 flex flex-row sm:flex-col items-center justify-between sm:items-start">
                            <div className="flex items-center gap-3">
                                <div className="w-8 h-8 rounded-xl bg-black flex items-center justify-center">
                                    <SettingsIcon size={16} className="text-white" />
                                </div>
                                <h2 className="font-black text-lg tracking-tight uppercase" style={{ color: INK }}>Settings</h2>
                            </div>
                            <button onClick={onClose} className="p-2 sm:hidden rounded-full bg-black/5">
                                <X size={20} />
                            </button>
                        </div>
                        <div className="flex-1 overflow-y-auto px-3 pb-6 flex flex-row sm:flex-col gap-1 hide-scrollbar" style={{ overflowX: 'auto' }}>
                            {tabs.map(tab => (
                                <button
                                    key={tab.id}
                                    onClick={() => setActiveTab(tab.id)}
                                    className={`flex items-center gap-3 px-4 py-3 rounded-xl transition-all whitespace-nowrap sm:whitespace-normal shrink-0 sm:shrink ${
                                        activeTab === tab.id ? 'bg-black text-white' : 'hover:bg-black/5 text-black/60'
                                    }`}
                                >
                                    <tab.icon size={16} strokeWidth={activeTab === tab.id ? 2.5 : 2} />
                                    <span className="font-bold text-[11px] uppercase tracking-widest">{tab.label}</span>
                                </button>
                            ))}
                        </div>
                    </div>

                    {/* CONTENT AREA */}
                    <div className="flex-1 overflow-y-auto bg-transparent relative">
                        {/* Desktop Close Button */}
                        <button onClick={onClose} className="hidden sm:flex absolute top-6 right-6 p-2 rounded-full hover:bg-black/5 text-black/40 hover:text-black transition-colors z-10">
                            <X size={24} />
                        </button>

                        <div className="p-8 sm:p-12 max-w-3xl">
                            
                            {/* GENERAL TAB */}
                            {activeTab === 'general' && (
                                <div className="space-y-10 animate-in fade-in slide-in-from-bottom-4 duration-500">
                                    <div>
                                        <h3 className="text-2xl font-black uppercase tracking-tighter mb-2" style={{ color: INK }}>General</h3>
                                        <p className="text-xs font-mono" style={{ color: MUTED }}>Currency conversion, primary display, and language preferences.</p>
                                    </div>

                                    <div className="space-y-8">
                                        <div className="space-y-3">
                                            <label className="text-[10px] font-black uppercase tracking-widest" style={{ color: INK }}>Currency Conversion</label>
                                            <p className="text-[11px]" style={{ color: MUTED }}>Updated fetching real-time market data.</p>
                                            <select 
                                                value={currency} 
                                                onChange={e => { setCurrency(e.target.value); save('sys_set_currency', e.target.value); }}
                                                className="w-full p-4 rounded-2xl border bg-white focus:outline-none focus:ring-2 focus:ring-black/10 font-mono text-sm"
                                            >
                                                <option value="EUR">EUR - Euro</option>
                                                <option value="USD">USD - United States Dollar</option>
                                                <option value="GBP">GBP - British Pound</option>
                                                <option value="JPY">JPY - Japanese Yen</option>
                                            </select>
                                        </div>

                                        <div className="space-y-3">
                                            <label className="text-[10px] font-black uppercase tracking-widest" style={{ color: INK }}>Primary Currency Display</label>
                                            <p className="text-[11px]" style={{ color: MUTED }}>Select native token or fiat equivalent to be displayed as primary.</p>
                                            <div className="flex gap-4">
                                                <button onClick={() => { setPrimaryDisplay('crypto'); save('sys_set_primary', 'crypto'); }} className={`flex-1 py-4 border rounded-2xl font-bold text-xs uppercase tracking-widest transition-all ${primaryDisplay === 'crypto' ? 'border-black bg-black/5' : 'border-black/10 bg-white'}`}>Crypto</button>
                                                <button onClick={() => { setPrimaryDisplay('fiat'); save('sys_set_primary', 'fiat'); }} className={`flex-1 py-4 border rounded-2xl font-bold text-xs uppercase tracking-widest transition-all ${primaryDisplay === 'fiat' ? 'border-black bg-black/5' : 'border-black/10 bg-white'}`}>Fiat</button>
                                            </div>
                                        </div>

                                        <div className="space-y-3">
                                            <label className="text-[10px] font-black uppercase tracking-widest" style={{ color: INK }}>Current Language</label>
                                            <select 
                                                value={language} 
                                                onChange={e => { setLanguage(e.target.value); save('sys_set_lang', e.target.value); }}
                                                className="w-full p-4 rounded-2xl border bg-white focus:outline-none focus:ring-2 focus:ring-black/10 font-mono text-sm"
                                            >
                                                <option value="en">English</option>
                                                <option value="es">Spanish</option>
                                                <option value="fr">French</option>
                                                <option value="de">German</option>
                                            </select>
                                        </div>
                                    </div>
                                </div>
                            )}

                            {/* ADVANCED TAB */}
                            {activeTab === 'advanced' && (
                                <div className="space-y-10 animate-in fade-in slide-in-from-bottom-4 duration-500">
                                    <div>
                                        <h3 className="text-2xl font-black uppercase tracking-tighter mb-2" style={{ color: INK }}>Advanced</h3>
                                        <p className="text-xs font-mono" style={{ color: MUTED }}>Logs, local state clears, and advanced network parameters.</p>
                                    </div>

                                    <div className="space-y-8">
                                        <div className="p-6 rounded-3xl border bg-white flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                                            <div>
                                                <h4 className="font-black text-[11px] uppercase tracking-widest" style={{ color: INK }}>State Logs</h4>
                                                <p className="text-[11px] mt-1" style={{ color: MUTED }}>Download your active session state for debugging.</p>
                                            </div>
                                            <button onClick={handleDownloadLogs} className="flex items-center justify-center gap-2 px-5 py-2.5 bg-black text-white rounded-full font-bold text-[10px] uppercase tracking-widest">
                                                <Download size={14} /> Download
                                            </button>
                                        </div>

                                        <div className="p-6 rounded-3xl border bg-white flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                                            <div>
                                                <h4 className="font-black text-[11px] uppercase tracking-widest text-rose-500">Clear Activity & Data</h4>
                                                <p className="text-[11px] mt-1" style={{ color: MUTED }}>Reset the local account nonce and flush storage caches.</p>
                                            </div>
                                            <button onClick={handleClearData} className="flex items-center justify-center gap-2 px-5 py-2.5 border border-rose-500/30 text-rose-500 hover:bg-rose-50 rounded-full font-bold text-[10px] uppercase tracking-widest transition-colors">
                                                <Trash2 size={14} /> Clear Data
                                            </button>
                                        </div>

                                        <div className="space-y-3 pt-4 border-t">
                                            <div className="flex items-center justify-between">
                                                <label className="text-[10px] font-black uppercase tracking-widest" style={{ color: INK }}>Show Hex Data</label>
                                                <Toggle isOn={showHexData} onToggle={() => { setShowHexData(!showHexData); save('sys_set_hex', !showHexData); }} />
                                            </div>
                                            <p className="text-[11px]" style={{ color: MUTED }}>Display hex data fields on the send screen.</p>
                                        </div>

                                        <div className="space-y-3 pt-4 border-t">
                                            <div className="flex items-center justify-between">
                                                <label className="text-[10px] font-black uppercase tracking-widest" style={{ color: INK }}>Advanced Gas Controls</label>
                                                <Toggle isOn={advancedGas} onToggle={() => { setAdvancedGas(!advancedGas); save('sys_set_gas', !advancedGas); }} />
                                            </div>
                                            <p className="text-[11px]" style={{ color: MUTED }}>Select this to show advanced gas priority and base fee settings on confirmation.</p>
                                        </div>

                                        <div className="space-y-3 pt-4 border-t">
                                            <div className="flex items-center justify-between">
                                                <label className="text-[10px] font-black uppercase tracking-widest" style={{ color: INK }}>Show Test Networks</label>
                                                <Toggle isOn={showTestnets} onToggle={() => { setShowTestnets(!showTestnets); save('sys_set_testnets', !showTestnets); }} />
                                            </div>
                                            <p className="text-[11px]" style={{ color: MUTED }}>Include Sepolia, Goerli, and Base Goerli in network selectors.</p>
                                        </div>

                                        <div className="space-y-3 pt-4 border-t">
                                            <label className="text-[10px] font-black uppercase tracking-widest" style={{ color: INK }}>Auto-Lock Timer (Minutes)</label>
                                            <p className="text-[11px]" style={{ color: MUTED }}>Set the idle time before requiring session re-authentication. (0 = never)</p>
                                            <input 
                                                type="number"
                                                value={autoLockTimer}
                                                onChange={e => { setAutoLockTimer(e.target.value); save('sys_set_autolock', e.target.value); }}
                                                className="w-full sm:w-32 p-4 rounded-2xl border bg-white focus:outline-none focus:ring-2 focus:ring-black/10 font-mono text-sm"
                                            />
                                        </div>
                                    </div>
                                </div>
                            )}

                            {/* CONTACTS TAB */}
                            {activeTab === 'contacts' && (
                                <div className="space-y-10 animate-in fade-in slide-in-from-bottom-4 duration-500">
                                    <div>
                                        <h3 className="text-2xl font-black uppercase tracking-tighter mb-2" style={{ color: INK }}>Address Book</h3>
                                        <p className="text-xs font-mono" style={{ color: MUTED }}>Manage saved contacts and ENS resolutions for quick transfers.</p>
                                    </div>

                                    <div className="p-6 rounded-3xl border bg-white space-y-5 shadow-sm">
                                        <h4 className="font-black text-[11px] uppercase tracking-widest" style={{ color: INK }}>Add New Contact</h4>
                                        <div className="flex flex-col sm:flex-row gap-3">
                                            <input 
                                                type="text" placeholder="Alias (e.g. Satoshi)" 
                                                value={newContactName} onChange={e => setNewContactName(e.target.value)}
                                                className="flex-1 p-3 rounded-xl border font-mono text-xs focus:outline-none focus:border-black"
                                            />
                                            <input 
                                                type="text" placeholder="0x... or ENS" 
                                                value={newContactAddress} onChange={e => setNewContactAddress(e.target.value)}
                                                className="flex-[2] p-3 rounded-xl border font-mono text-xs focus:outline-none focus:border-black"
                                            />
                                            <button onClick={handleAddContact} className="px-6 py-3 bg-black text-white rounded-xl font-bold text-[10px] uppercase tracking-widest shrink-0">Add</button>
                                        </div>
                                    </div>

                                    <div className="space-y-3">
                                        <h4 className="font-black text-[11px] uppercase tracking-widest" style={{ color: MUTED }}>Saved Contacts</h4>
                                        {Object.entries(contacts).length === 0 ? (
                                            <div className="p-12 text-center border border-dashed rounded-3xl text-black/30">
                                                <Users size={32} className="mx-auto mb-3" />
                                                <p className="text-[11px] font-mono">No contacts saved yet.</p>
                                            </div>
                                        ) : (
                                            <div className="grid gap-3">
                                                {Object.entries(contacts).map(([name, addr]) => (
                                                    <ContactRow key={name} name={name} address={addr} onCopy={handleCopy} onRemove={() => handleRemoveContact(name)} />
                                                ))}
                                            </div>
                                        )}
                                    </div>
                                </div>
                            )}

                            {/* SECURITY TAB */}
                            {activeTab === 'security' && (
                                <div className="space-y-10 animate-in fade-in slide-in-from-bottom-4 duration-500">
                                    <div>
                                        <h3 className="text-2xl font-black uppercase tracking-tighter mb-2" style={{ color: INK }}>Security & Privacy</h3>
                                        <p className="text-xs font-mono" style={{ color: MUTED }}>Control your footprint and on-chain exposure.</p>
                                    </div>

                                    <div className="space-y-8">
                                        <div className="p-6 rounded-3xl border border-amber-500/20 bg-amber-500/5">
                                            <div className="flex items-center gap-3 mb-2">
                                                <Shield size={20} className="text-amber-600" />
                                                <h4 className="font-black text-[11px] uppercase tracking-widest text-amber-700">Reveal Secret Recovery Phrase</h4>
                                            </div>
                                            <p className="text-[11px] text-amber-700/70 mb-4 leading-relaxed">If you lose your recovery phrase, you will lose access to your funds. Do not share it with anyone.</p>
                                            <button className="px-5 py-2.5 bg-amber-500 text-white rounded-full font-bold text-[10px] uppercase tracking-widest">Reveal Phrase</button>
                                        </div>

                                        <div className="space-y-3 pt-4 border-t">
                                            <div className="flex items-center justify-between">
                                                <label className="text-[10px] font-black uppercase tracking-widest" style={{ color: INK }}>Phishing Detection</label>
                                                <Toggle isOn={phishingDetection} onToggle={() => { setPhishingDetection(!phishingDetection); save('sys_set_phishing', !phishingDetection); }} />
                                            </div>
                                            <p className="text-[11px]" style={{ color: MUTED }}>Warns you when interacting with known malicious domains or contracts.</p>
                                        </div>

                                        <div className="space-y-3 pt-4 border-t">
                                            <div className="flex items-center justify-between">
                                                <label className="text-[10px] font-black uppercase tracking-widest" style={{ color: INK }}>Incoming Transactions</label>
                                                <Toggle isOn={incomingTxs} onToggle={() => { setIncomingTxs(!incomingTxs); save('sys_set_incoming', !incomingTxs); }} />
                                            </div>
                                            <p className="text-[11px]" style={{ color: MUTED }}>Query block explorers to show incoming transactions in your history.</p>
                                        </div>

                                        <div className="space-y-3 pt-4 border-t">
                                            <label className="text-[10px] font-black uppercase tracking-widest text-rose-500">Privacy Data</label>
                                            <p className="text-[11px] mb-3" style={{ color: MUTED }}>Clear your connected sites and hardware wallet bindings.</p>
                                            <button className="px-5 py-2.5 border border-rose-500/30 text-rose-500 rounded-full font-bold text-[10px] uppercase tracking-widest">Clear Privacy Data</button>
                                        </div>
                                    </div>
                                </div>
                            )}

                            {/* ALERTS TAB */}
                            {activeTab === 'alerts' && (
                                <div className="space-y-10 animate-in fade-in slide-in-from-bottom-4 duration-500">
                                    <div>
                                        <h3 className="text-2xl font-black uppercase tracking-tighter mb-2" style={{ color: INK }}>Alerts</h3>
                                        <p className="text-xs font-mono" style={{ color: MUTED }}>Manage notifications and on-chain intelligence alerts.</p>
                                    </div>

                                    <div className="space-y-8">
                                        <div className="space-y-3">
                                            <div className="flex items-center justify-between">
                                                <label className="text-[10px] font-black uppercase tracking-widest" style={{ color: INK }}>Push Notifications</label>
                                                <Toggle isOn={pushEnabled} onToggle={() => { setPushEnabled(!pushEnabled); save('sys_set_push', !pushEnabled); }} />
                                            </div>
                                            <p className="text-[11px]" style={{ color: MUTED }}>Receive browser notifications for completed transactions and chat messages.</p>
                                        </div>

                                        <div className="space-y-3 pt-4 border-t">
                                            <div className="flex items-center justify-between">
                                                <label className="text-[10px] font-black uppercase tracking-widest" style={{ color: INK }}>Price Alerts</label>
                                                <Toggle isOn={priceAlerts} onToggle={() => { setPriceAlerts(!priceAlerts); save('sys_set_pricealerts', !priceAlerts); }} />
                                            </div>
                                            <p className="text-[11px]" style={{ color: MUTED }}>Notify me when major assets in my portfolio experience &gt;10% volatility.</p>
                                        </div>
                                    </div>
                                </div>
                            )}

                            {/* NETWORKS TAB */}
                            {activeTab === 'networks' && (
                                <div className="space-y-10 animate-in fade-in slide-in-from-bottom-4 duration-500">
                                    <div>
                                        <h3 className="text-2xl font-black uppercase tracking-tighter mb-2" style={{ color: INK }}>Networks</h3>
                                        <p className="text-xs font-mono" style={{ color: MUTED }}>Manage your custom RPCs and node connections.</p>
                                    </div>

                                    <div className="grid gap-4">
                                        {[
                                            { name: 'Ethereum Mainnet', rpc: 'https://mainnet.infura.io/v3/...' },
                                            { name: 'Base', rpc: 'https://mainnet.base.org' },
                                            { name: 'Arbitrum One', rpc: 'https://arb1.arbitrum.io/rpc' },
                                            { name: 'Humanity Ledger', rpc: 'https://rpc.humanity.ledger' }
                                        ].map(n => (
                                            <div key={n.name} className="p-4 rounded-2xl border flex items-center justify-between bg-white">
                                                <div className="flex items-center gap-3">
                                                    <div className="w-8 h-8 rounded-full bg-black/5 flex items-center justify-center">
                                                        <Network size={14} className="text-black/60" />
                                                    </div>
                                                    <div>
                                                        <div className="font-bold text-xs" style={{ color: INK }}>{n.name}</div>
                                                        <div className="font-mono text-[9px]" style={{ color: MUTED }}>{n.rpc}</div>
                                                    </div>
                                                </div>
                                                <button className="text-black/40 hover:text-black"><ArrowRight size={14} /></button>
                                            </div>
                                        ))}
                                    </div>
                                    <button className="w-full py-4 rounded-2xl border border-dashed text-[11px] font-black uppercase tracking-widest text-black/40 hover:text-black hover:border-black/20 transition-all">
                                        + Add a Network
                                    </button>
                                </div>
                            )}

                            {/* EXPERIMENTAL TAB */}
                            {activeTab === 'experimental' && (
                                <div className="space-y-10 animate-in fade-in slide-in-from-bottom-4 duration-500">
                                    <div>
                                        <h3 className="text-2xl font-black uppercase tracking-tighter mb-2 bg-gradient-to-r from-purple-600 to-[#25D366] bg-clip-text text-transparent">Experimental</h3>
                                        <p className="text-xs font-mono" style={{ color: MUTED }}>Advanced protocol features under active development. Enable with caution in production environments.</p>
                                    </div>

                                    <div className="space-y-8">
                                        <div className="p-6 rounded-3xl border border-purple-500/20 bg-purple-500/5 space-y-4">
                                            <div className="flex items-center justify-between">
                                                <div className="flex items-center gap-2">
                                                    <Zap size={16} className="text-purple-600" />
                                                    <label className="text-[11px] font-black uppercase tracking-widest text-purple-700">Adaptive Cross-Chain Routing</label>
                                                </div>
                                                <Toggle isOn={quantumRouting} onToggle={() => { setQuantumRouting(!quantumRouting); save('sys_set_quantum', !quantumRouting); }} color="bg-purple-600" />
                                            </div>
                                            <p className="text-[11px] text-purple-700/70 leading-relaxed">Enables heuristic cross-chain liquidity routing, automatically optimizing your token swaps through multi-chain bridging layers in a single transaction.</p>
                                        </div>

                                        <div className="space-y-3 pt-4 border-t">
                                            <div className="flex items-center justify-between">
                                                <label className="text-[10px] font-black uppercase tracking-widest" style={{ color: INK }}>Token Auto-Detection</label>
                                                <Toggle isOn={tokenDetection} onToggle={() => { setTokenDetection(!tokenDetection); save('sys_set_tokendetect', !tokenDetection); }} />
                                            </div>
                                            <p className="text-[11px]" style={{ color: MUTED }}>Automatically scan for new tokens and add them to your portfolio without manual contract imports.</p>
                                        </div>
                                    </div>
                                </div>
                            )}

                            {/* ABOUT TAB */}
                            {activeTab === 'about' && (
                                <div className="space-y-10 animate-in fade-in slide-in-from-bottom-4 duration-500">
                                    <div>
                                        <h3 className="text-2xl font-black uppercase tracking-tighter mb-2" style={{ color: INK }}>About</h3>
                                        <p className="text-xs font-mono" style={{ color: MUTED }}>Version 14.12.0 - Sovereign Release</p>
                                    </div>

                                    <div className="space-y-4">
                                        <a href="/legal/privacy" className="flex items-center justify-between p-5 rounded-2xl border bg-white hover:border-black/20 transition-all">
                                            <span className="font-bold text-xs" style={{ color: INK }}>Privacy Policy</span>
                                            <ArrowRight size={14} className="text-black/40" />
                                        </a>
                                        <a href="/legal/terms" className="flex items-center justify-between p-5 rounded-2xl border bg-white hover:border-black/20 transition-all">
                                            <span className="font-bold text-xs" style={{ color: INK }}>Terms of Use</span>
                                            <ArrowRight size={14} className="text-black/40" />
                                        </a>
                                        <a href="/company/contact" className="flex items-center justify-between p-5 rounded-2xl border bg-white hover:border-black/20 transition-all">
                                            <span className="font-bold text-xs" style={{ color: INK }}>Contact Support</span>
                                            <ArrowRight size={14} className="text-black/40" />
                                        </a>
                                    </div>
                                    <div className="pt-8 text-center opacity-40">
                                        <Fingerprint size={24} className="mx-auto mb-2" />
                                        <p className="text-[10px] font-mono uppercase tracking-widest">Built for the Cryptographic Web</p>
                                    </div>
                                </div>
                            )}

                        </div>
                    </div>
                </motion.div>
            </motion.div>
        </AnimatePresence>
    );
}

// Subcomponents

function Toggle({ isOn, onToggle, color = "bg-black" }: { isOn: boolean; onToggle: () => void; color?: string }) {
    return (
        <button 
            onClick={onToggle}
            className={`w-10 h-6 rounded-full flex items-center p-1 transition-colors duration-300 ${isOn ? color : 'bg-black/10'}`}
        >
            <motion.div 
                animate={{ x: isOn ? 16 : 0 }}
                transition={{ type: "spring", stiffness: 500, damping: 30 }}
                className="w-4 h-4 bg-white rounded-full shadow-sm"
            />
        </button>
    );
}

function ContactRow({ name, address, onCopy, onRemove }: { name: string; address: string; onCopy: (s: string) => void; onRemove: () => void }) {
    const { data: ensName } = useEnsName({ address: address as `0x${string}` | undefined });
    const displayName = ensName || `${address.slice(0, 6)}...${address.slice(-4)}`;

    return (
        <div className="flex items-center justify-between p-4 border rounded-2xl bg-[#FFFFFF] hover:bg-white transition-colors group">
            <div className="flex items-center gap-4">
                <div className="w-10 h-10 rounded-full bg-gradient-to-br from-gray-100 to-gray-200 border flex items-center justify-center font-bold text-xs uppercase shadow-sm">
                    {name.slice(0,2)}
                </div>
                <div>
                    <div className="font-bold text-sm tracking-tight" style={{ color: INK }}>{name}</div>
                    <div className="font-mono text-[10px] flex items-center gap-1.5" style={{ color: MUTED }}>
                        {displayName}
                    </div>
                </div>
            </div>
            <div className="flex items-center gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                <button onClick={() => onCopy(address)} className="p-2 rounded-lg hover:bg-black/5 text-black/60"><Copy size={14} /></button>
                <button onClick={onRemove} className="p-2 rounded-lg hover:bg-rose-50 text-rose-500"><Trash2 size={14} /></button>
            </div>
        </div>
    );
}

