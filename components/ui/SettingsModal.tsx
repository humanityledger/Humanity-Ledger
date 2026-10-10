'use client';

import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useSettings } from '@/src/context/SettingsContext';
import { LiquidPrismBackground } from '@/components/ui/LiquidPrismBackground';
import {
    X, Settings, Shield, Zap, Database, Bell, Users,
    CreditCard, Beaker, Link, Info, MessageCircle, Lock,
    Loader2, Tablet, LogOut
} from 'lucide-react';
import { useSystemSignOut } from '@/hooks/useSystemSignOut';
import { ActiveSessions } from '../settings/ActiveSessions';
import { CloudSyncManager } from '../settings/CloudSyncManager';
import { RealPrivacySettings } from '../privacy/RealPrivacySettings';
import { toast } from 'sonner';
import { verifyBiometricOwnership } from '@/src/services/security/BiometricService';
import { revokeTokenAllowance } from '@/src/services/security/RevokeService';

export function SettingsModal({ isOpen, onClose }: { isOpen: boolean; onClose: () => void }) {
    const { nuclearDisconnect } = useSystemSignOut();
    const {
        t, theme, setTheme, currency, setCurrency,
        language, setLanguage, searchEngine, setSearchEngine, lockApp,
        strictMode, toggleStrictMode, hideBalances, toggleHideBalances,
        privacyMode, togglePrivacyMode, humanMetrics, toggleHumanMetrics,
        walletStealthMode, toggleWalletStealthMode, requirePasswordForSigning, toggleRequirePasswordForSigning,
        autoLockDuration, setAutoLockDuration, testNetsEnabled, toggleTestNets,
        ipfsGateway, setIpfsGateway, customRPC, setCustomRPC, stateLogsEnabled, toggleStateLogs,
        contacts, addContact, removeContact, emailNotifications, toggleEmailNotifications,
        pushNotifications, togglePushNotifications, transactionAlerts, toggleTransactionAlerts,
        marketingEmails, toggleMarketingEmails, backupFrequency, setBackupFrequency,
        lastBackupAt, triggerBackup, defaultSlippage, setDefaultSlippage, defaultGasPrice, setDefaultGasPrice, resetAccount
    } = useSettings();

    // Manage local tab state
    const [localActiveTab, setLocalActiveTab] = useState('general');
    const activeTab = localActiveTab;
    const setActiveTab = setLocalActiveTab;

    // Security Tab State
    const [biometricsEnabled, setBiometricsEnabled] = useState(false);
    const [revokeToken, setRevokeToken] = useState('');
    const [revokeSpender, setRevokeSpender] = useState('');
    const [isRevoking, setIsRevoking] = useState(false);

    // Contacts Tab State
    const [newContactName, setNewContactName] = useState('');
    const [newContactAddress, setNewContactAddress] = useState('');

    // HELPER: Sidebar Items with Translation
    const SECTIONS = [
        { id: 'general', label: t('nav_general'), icon: Settings },
        { id: 'security', label: t('nav_security'), icon: Shield },
        { id: 'sessions', label: 'Active Sessions', icon: Tablet }, // [NEW]
        { id: 'advanced', label: t('nav_advanced'), icon: Zap },
        { id: 'contacts', label: t('nav_contacts'), icon: Users },
        { id: 'notifications', label: t('nav_notifications'), icon: Bell },
        { id: 'backup', label: t('nav_backup'), icon: Database },
        { id: 'walletconnect', label: t('nav_walletconnect'), icon: Link },
        { id: 'buy', label: t('nav_buy'), icon: CreditCard },
        { id: 'experimental', label: t('nav_experimental'), icon: Beaker },
        { id: 'about', label: t('nav_about'), icon: Info },
        { id: 'support', label: t('nav_support'), icon: MessageCircle },
    ];

    const toggleBiometrics = async () => {
        if (!biometricsEnabled) {
            const verified = await verifyBiometricOwnership();
            if (verified) {
                setBiometricsEnabled(true);
                toast.success("Biometrics Enabled");
            } else {
                toast.error("Biometric verification failed");
            }
        } else {
            setBiometricsEnabled(false);
        }
    };

    const handleRevoke = async () => {
        if (!revokeToken || !revokeSpender) return;
        setIsRevoking(true);
        try {
            const hash = await revokeTokenAllowance(revokeToken, revokeSpender);
            toast.success("Revocation TX Sent", { description: hash });
            setRevokeToken('');
            setRevokeSpender('');
        } catch (e: any) {
            toast.error("Revocation Failed", { description: e.message });
        } finally {
            setIsRevoking(false);
        }
    };

    const renderContent = () => {
        switch (activeTab) {
            case 'general':
                return (
                    <div className="space-y-8 animate-in fade-in slide-in-from-right-4 duration-300">
                        <div className="space-y-4">
                            <div>
                                <label className="text-sm font-medium text-gray-300 block mb-2">UI Theme</label>
                                <select
                                    value={theme}
                                    onChange={(e) => setTheme(e.target.value as any)}
                                    className="w-full bg-black/20 border border-white/10 rounded-xl p-4 text-white focus:border-[#00f2ea] focus:ring-1 focus:ring-[#00f2ea] outline-none transition-all"
                                >
                                    <option value="light">Light Mode</option>
                                    <option value="dark">Dark Mode</option>
                                    <option value="auto">System Auto</option>
                                </select>
                            </div>

                            <div>
                                <label className="text-sm font-medium text-gray-300 block mb-2">{t('label_currency')}</label>
                                <select
                                    value={currency}
                                    onChange={(e) => setCurrency(e.target.value as any)}
                                    className="w-full bg-black/20 border border-white/10 rounded-xl p-4 text-white focus:border-[#00f2ea] focus:ring-1 focus:ring-[#00f2ea] outline-none transition-all"
                                >
                                    <option value="USD">USD - United States Dollar</option>
                                    <option value="EUR">EUR - Euro</option>
                                    <option value="GBP">GBP - British Pound</option>
                                    <option value="JPY">JPY - Japanese Yen</option>
                                    <option value="MXN">MXN - Mexican Peso</option>
                                </select>
                                <p className="text-xs text-gray-500 mt-2 ml-1">{t('desc_currency')}</p>
                            </div>

                            <div>
                                <label className="text-sm font-medium text-gray-300 block mb-2">{t('label_language')}</label>
                                <select
                                    value={language}
                                    onChange={(e) => setLanguage(e.target.value as any)}
                                    className="w-full bg-black/20 border border-white/10 rounded-xl p-4 text-white focus:border-[#00f2ea] focus:ring-1 focus:ring-[#00f2ea] outline-none transition-all"
                                >
                                    <option value="en">English (US)</option>
                                    <option value="es">Spanish (Latam)</option>
                                    <option value="fr">Français</option>
                                </select>
                            </div>

                            <div>
                                <label className="text-sm font-medium text-gray-300 block mb-2">{t('label_search')}</label>
                                <select
                                    value={searchEngine}
                                    onChange={(e) => setSearchEngine(e.target.value as any)}
                                    className="w-full bg-black/20 border border-white/10 rounded-xl p-4 text-white focus:border-[#00f2ea] focus:ring-1 focus:ring-[#00f2ea] outline-none transition-all"
                                >
                                    <option value="Google">Google</option>
                                    <option value="DuckDuckGo">DuckDuckGo (Private)</option>
                                    <option value="Brave">Brave Search</option>
                                </select>
                            </div>
                            
                            <div className="pt-6 border-t border-white/5">
                                <div className="bg-red-500/5 border border-red-500/10 rounded-2xl p-5 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                                    <div>
                                        <h4 className="text-white text-sm font-bold mb-1">Active System Session</h4>
                                        <p className="text-xs text-gray-500 max-w-[90%] font-serif">Log out and clear all secure keys and wallet registries from memory and local cache.</p>
                                    </div>
                                    <button 
                                        onClick={nuclearDisconnect}
                                        className="px-5 py-2.5 bg-red-500 hover:bg-red-600 text-white rounded-xl text-xs font-black uppercase tracking-wider transition-colors shadow-lg shadow-red-500/10 flex items-center justify-center gap-2"
                                    >
                                        <LogOut size={14} /> Disconnect Session
                                    </button>
                                </div>
                            </div>
                        </div>
                    </div>
                );

            case 'security':
                return (
                    <RealPrivacySettings />
                );

            case 'sessions':
                return <ActiveSessions />;

            case 'advanced':
                return (
                    <div className="space-y-6 animate-in fade-in slide-in-from-right-4 duration-300">
                        <ToggleItem title="Enable Testnets" description="Show Sepolia, Goerli, and other test networks." active={testNetsEnabled} onClick={toggleTestNets} />
                        <ToggleItem title="Enable State Logs" description="Print verbose state management logs to the developer console." active={stateLogsEnabled} onClick={toggleStateLogs} />
                        
                        <div>
                            <label className="text-sm font-medium text-gray-300 block mb-2">Custom RPC URL</label>
                            <input value={customRPC || ''} onChange={e => setCustomRPC(e.target.value)} placeholder="https://mainnet.infura.io/v3/..." className="w-full bg-black/40 border border-white/10 rounded-lg p-4 text-white outline-none focus:border-[#00f2ea] font-mono text-sm" />
                        </div>
                        <div>
                            <label className="text-sm font-medium text-gray-300 block mb-2">IPFS Gateway</label>
                            <input value={ipfsGateway} onChange={e => setIpfsGateway(e.target.value)} placeholder="https://ipfs.io/ipfs/" className="w-full bg-black/40 border border-white/10 rounded-lg p-4 text-white outline-none focus:border-[#00f2ea] font-mono text-sm" />
                        </div>
                        <div className="pt-4 border-t border-red-500/20">
                            <button onClick={resetAccount} className="w-full py-4 bg-red-500/10 hover:bg-red-500/20 text-red-500 border border-red-500/30 rounded-xl font-bold transition-all">FACTORY RESET ACCOUNT</button>
                        </div>
                    </div>
                );

            case 'contacts':
                return (
                    <div className="space-y-6 animate-in fade-in slide-in-from-right-4 duration-300">
                        <div className="flex gap-2">
                            <input value={newContactName} onChange={e => setNewContactName(e.target.value)} placeholder="Contact Name" className="flex-1 bg-black/40 border border-white/10 rounded-lg p-3 text-white outline-none" />
                            <input value={newContactAddress} onChange={e => setNewContactAddress(e.target.value)} placeholder="0x..." className="flex-2 bg-black/40 border border-white/10 rounded-lg p-3 text-white outline-none font-mono" />
                            <button onClick={() => { if(newContactName && newContactAddress) { addContact(newContactName, newContactAddress); setNewContactName(''); setNewContactAddress(''); } }} className="px-6 bg-[#00f2ea]/20 text-[#00f2ea] border border-[#00f2ea]/50 rounded-lg font-bold hover:bg-[#00f2ea]/30 transition-all">+</button>
                        </div>
                        <div className="space-y-2">
                            {contacts.length === 0 ? <p className="text-zinc-500 text-center py-4">No contacts saved.</p> : contacts.map(c => (
                                <div key={c.id} className="flex justify-between items-center bg-white/5 p-4 rounded-xl border border-white/10 group">
                                    <div><p className="font-bold text-white">{c.name}</p><p className="text-xs text-zinc-500 font-mono">{c.address}</p></div>
                                    <button onClick={() => removeContact(c.id)} className="text-red-400 opacity-0 group-hover:opacity-100 transition-opacity p-2 hover:bg-red-500/10 rounded-lg"><X size={16} /></button>
                                </div>
                            ))}
                        </div>
                    </div>
                );

            case 'notifications':
                return (
                    <div className="space-y-1 animate-in fade-in slide-in-from-right-4 duration-300">
                        <ToggleItem title="Push Notifications" description="Receive instant browser push alerts." active={pushNotifications} onClick={togglePushNotifications} />
                        <ToggleItem title="Email Notifications" description="Receive daily digests and account alerts via email." active={emailNotifications} onClick={toggleEmailNotifications} />
                        <ToggleItem title="Transaction Alerts" description="Notify on every block confirmation." active={transactionAlerts} onClick={toggleTransactionAlerts} />
                        <ToggleItem title="Marketing Emails" description="Updates, new features, and DeFi news." active={marketingEmails} onClick={toggleMarketingEmails} />
                    </div>
                );

            case 'backup':
                return <CloudSyncManager />;

            case 'walletconnect':
                return (
                    <div className="space-y-6 animate-in fade-in slide-in-from-right-4 duration-300 text-center py-10">
                        <Link className="w-16 h-16 text-[#25D366] mx-auto mb-4 opacity-50" />
                        <h3 className="text-2xl font-bold text-white">WalletConnect V2</h3>
                        <p className="text-zinc-400">View and manage dApp connections securely.</p>
                        <div className="p-4 border border-white/5 bg-white/5 rounded-xl mx-auto max-w-sm mt-6">
                            <p className="text-sm text-zinc-500">No active external dApp sessions currently active on this device.</p>
                        </div>
                    </div>
                );

            case 'buy':
                return (
                    <div className="space-y-6 animate-in fade-in slide-in-from-right-4 duration-300 text-center py-10">
                        <CreditCard className="w-16 h-16 text-emerald-500 mx-auto mb-4 opacity-50" />
                        <h3 className="text-2xl font-bold text-white">Fiat On-Ramp</h3>
                        <p className="text-zinc-400">Buy Crypto directly using Apple Pay, Google Pay, or Credit Card.</p>
                        <button className="mt-6 px-8 py-3 bg-emerald-500/10 text-emerald-400 border border-emerald-500/30 rounded-xl font-bold cursor-not-allowed opacity-50">Provider Initializing...</button>
                    </div>
                );

            case 'experimental':
                return (
                    <div className="space-y-4 animate-in fade-in slide-in-from-right-4 duration-300">
                        <div className="p-4 bg-orange-500/10 border border-orange-500/30 rounded-xl">
                            <h4 className="text-orange-400 font-bold mb-2 flex items-center gap-2"><Beaker className="w-4 h-4"/> Beta Features</h4>
                            <p className="text-xs text-orange-400/70">These features are unstable. Use at your own risk. Loss of funds may occur on beta contract relays.</p>
                        </div>
                        <ToggleItem title="Core Smart Routing" description="Route swaps through experimental L3 aggregators." active={false} onClick={() => {}} />
                        <ToggleItem title="AI Rebalancer" description="Allow System AI to auto-rebalance stablecoins." active={false} onClick={() => {}} />
                    </div>
                );

            case 'about':
                return (
                    <div className="text-center py-10 space-y-4 animate-in fade-in slide-in-from-right-4 duration-300">
                        <h1 className="text-4xl font-black text-white tracking-tighter">Humanity Ledger</h1>
                        <p className="text-zinc-400 font-mono">v2.4.1 (Legendary System Build)</p>
                        <div className="flex justify-center gap-4 mt-8">
                            <a href="#" className="text-sm text-[#00f2ea] hover:underline">Terms of Service</a>
                            <span className="text-zinc-600">|</span>
                            <a href="#" className="text-sm text-[#00f2ea] hover:underline">Privacy Policy</a>
                        </div>
                    </div>
                );

            case 'support':
                return (
                    <div className="space-y-6 animate-in fade-in slide-in-from-right-4 duration-300 text-center py-10">
                        <MessageCircle className="w-16 h-16 text-pink-500 mx-auto mb-4 opacity-50" />
                        <h3 className="text-2xl font-bold text-white mb-2">The Void Support Desk</h3>
                        <p className="text-zinc-400 mb-8 max-w-sm mx-auto">Experiencing issues with your KYC or dark pool routing? Contact the engineers directly.</p>
                        <div className="flex flex-col gap-4 max-w-xs mx-auto">
                            <button className="px-6 py-3 bg-pink-500/10 text-pink-400 border border-pink-500/30 rounded-xl font-bold hover:bg-pink-500/20 transition-colors">Start Active Chat</button>
                            <button className="px-6 py-3 bg-white/5 text-zinc-300 border border-white/10 rounded-xl font-bold hover:bg-white/10 transition-colors">Submit Ticket</button>
                        </div>
                    </div>
                );
            default:
                return null;
        }
    };

    return (
        <AnimatePresence>
            {isOpen && (
                <>
                    {/* Backdrop */}
                    <motion.div
                        initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
                        onClick={onClose}
                        className="fixed inset-0 bg-black/60 backdrop-blur-md z-[100]"
                    />

                    {/* Modal Window */}
                    <motion.div
                        initial={{ opacity: 0, scale: 0.95, y: 20 }}
                        animate={{ opacity: 1, scale: 1, y: 0 }}
                        exit={{ opacity: 0, scale: 0.95, y: 20 }}
                        className="fixed inset-0 md:inset-auto md:top-10 md:bottom-10 md:left-1/2 md:top-1/2 md:-translate-x-1/2 md:-translate-y-1/2 
                                   w-full md:w-[900px] md:h-[700px] border border-white/10 md:rounded-3xl shadow-2xl z-[101] overflow-hidden flex flex-col md:flex-row relative"
                    >
                        {/* Pure CSS Wallpaper Background  400Hz Zero-Latency Render */}
                        <div className="absolute inset-0 z-0 overflow-hidden md:rounded-3xl">
                            <div
                                className="absolute inset-0 animate-prism-shift"
                                style={{
                                    background: "radial-gradient(ellipse at 20% 50%, #2d3080 0%, transparent 50%), radial-gradient(ellipse at 80% 20%, #8b31ff 0%, transparent 50%), radial-gradient(ellipse at 60% 80%, #af1fb8 0%, transparent 50%), #000000",
                                }}
                            />
                            <div className="absolute inset-0 bg-[#020202]/80" />
                        </div>
                        {/* LEFT SIDEBAR (Menu) */}
                        <div className="relative z-10 w-full md:w-64 bg-black/30 border-b md:border-b-0 md:border-r border-white/10 backdrop-blur-sm flex flex-col shrink-0">
                            <div className="p-6 border-b border-white/5 hidden md:block">
                                <h2 className="text-xl font-bold text-white tracking-tight flex items-center gap-2">
                                    <Settings className="text-[#00f2ea]" size={20} /> {t('settings_title')}
                                </h2>
                            </div>

                            <div className="shrink-0 md:flex-1 overflow-x-auto md:overflow-y-auto py-2 scrollbar-hide flex md:flex-col">
                                {SECTIONS.map((item) => (
                                    <button
                                        key={item.id}
                                        onClick={() => setActiveTab(item.id)}
                                        className={`flex-shrink-0 md:w-full flex items-center gap-3 px-6 py-3 text-sm transition-all relative group
                                            ${activeTab === item.id ? 'text-[#00f2ea] bg-[#00f2ea]/5' : 'text-gray-400 hover:text-white hover:bg-white/5'}
                                        `}
                                    >
                                        <item.icon size={18} className={activeTab === item.id ? "opacity-100" : "opacity-70 group-hover:opacity-100"} />
                                        <span className="whitespace-nowrap">{item.label}</span>
                                        {activeTab === item.id && (
                                            <div className="absolute left-0 top-0 bottom-0 w-1 bg-[#00f2ea] rounded-r-full hidden md:block" />
                                        )}
                                        {activeTab === item.id && (
                                            <div className="absolute left-0 right-0 bottom-0 h-1 bg-[#00f2ea] rounded-t-full md:hidden" />
                                        )}
                                    </button>
                                ))}
                            </div>

                            {/* Actions Footer */}
                            <div className="p-4 border-t border-white/5 space-y-2 hidden md:block">
                                <button
                                    onClick={lockApp}
                                    className="w-full flex items-center gap-3 px-4 py-3 text-sm text-red-400 hover:text-red-300 rounded-lg hover:bg-red-500/10 transition-colors"
                                >
                                    <Lock size={18} /> {t('btn_lock')}
                                </button>
                                <button
                                    onClick={nuclearDisconnect}
                                    className="w-full flex items-center gap-3 px-4 py-3 text-sm text-red-500 hover:text-red-400 rounded-lg hover:bg-red-500/10 transition-colors"
                                >
                                    <LogOut size={18} /> Disconnect Session
                                </button>
                            </div>
                        </div>

                        {/* RIGHT CONTENT (Dynamic) */}
                        <div className="relative z-10 flex-1 flex flex-col min-w-0 bg-black/20 backdrop-blur-sm">
                            {/* Header Mobile Only */}
                            <div className="md:hidden flex justify-between items-center p-4 border-b border-white/5">
                                <h3 className="text-white font-bold">{SECTIONS.find(s => s.id === activeTab)?.label}</h3>
                                <button onClick={onClose}><X size={24} className="text-gray-400" /></button>
                            </div>

                            {/* Desktop Header */}
                            <div className="hidden md:flex justify-between items-center p-8 pb-4">
                                <div>
                                    <h2 className="text-2xl font-bold text-white mb-1">
                                        {SECTIONS.find(s => s.id === activeTab)?.label}
                                    </h2>
                                    <p className="text-sm text-gray-500">{t('settings_title')}</p>
                                </div>
                                <button onClick={onClose} className="p-2 hover:bg-white/10 rounded-full transition-colors">
                                    <X size={24} className="text-gray-400" />
                                </button>
                            </div>

                            {/* Scrollable Content Area */}
                            <div className="flex-1 overflow-y-auto p-6 md:p-8 scrollbar-hide">
                                {renderContent()}
                            </div>
                        </div>

                    </motion.div>
                </>
            )}
        </AnimatePresence>
    );
}

// Utility Component for Toggles
function ToggleItem({ title, description, active, onClick }: { title: string, description: string, active: boolean, onClick: () => void }) {
    return (
        <div className="flex items-center justify-between p-4 rounded-xl hover:bg-white/5 transition-colors cursor-pointer group" onClick={onClick}>
            <div>
                <h4 className="text-white text-sm font-medium mb-1 group-hover:text-[#00f2ea] transition-colors">{title}</h4>
                <p className="text-xs text-gray-500 max-w-[80%]">{description}</p>
            </div>
            <div className={`w-12 h-6 rounded-full relative transition-colors duration-300 ${active ? 'bg-[#00f2ea]' : 'bg-white/10'}`}>
                <div className={`absolute top-1 w-4 h-4 rounded-full bg-white shadow-md transition-all duration-300 ${active ? 'left-7' : 'left-1'}`} />
            </div>
        </div>
    );
}


