"use client";

import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { 
    X, Camera, Save, User, Fingerprint, Loader2, 
    Palette, Shield, Zap, EyeOff, Globe, DollarSign 
} from 'lucide-react';
import { toast } from 'sonner';

interface UserProfileModalProps {
    isOpen: boolean;
    onClose: () => void;
}

export function UserProfileModal({ isOpen, onClose }: UserProfileModalProps) {
    const [address, setAddress] = useState<string | null>(null);
    const [isConnected, setIsConnected] = useState(false);
    const [activeTab, setActiveTab] = useState<'identity' | 'preferences' | 'security'>('identity');

    useEffect(() => {
        const match = document.cookie.match(/system_handshake=(0x[0-9a-fA-F]{40,})/i);
        const addr = match?.[1]?.toLowerCase() ?? null;
        setAddress(addr);
        setIsConnected(!!addr);
    }, [isOpen]);

    const [isLoading, setIsLoading] = useState(false);
    const [isSaving, setIsSaving] = useState(false);
    const [imgError, setImgError] = useState(false);

    // Form State
    const [displayName, setDisplayName] = useState('');
    const [avatarUrl, setAvatarUrl] = useState('');
    const [bio, setBio] = useState('');
    
    // Preferences
    const [theme, setTheme] = useState('light');
    const [currency, setCurrency] = useState('USD');
    const [language, setLanguage] = useState('en-US');
    const [displayUnit, setDisplayUnit] = useState('FIAT');
    
    // Security / Attesting
    const [gasPreset, setGasPreset] = useState('STANDARD');
    const [mevProtection, setMevProtection] = useState(false);
    const [stealthMode, setStealthMode] = useState(false);

    useEffect(() => {
        if (isOpen && address) {
            fetchProfile();
        } else if (!isOpen) {
            setActiveTab('identity'); // Reset tab on close
        }
    }, [isOpen, address]);

    // Reset image error state when url changes to prevent permanent error state while typing
    useEffect(() => {
        setImgError(false);
    }, [avatarUrl]);

    const fetchProfile = async () => {
        setIsLoading(true);
        try {
            const res = await fetch(`/api/user/profile?walletAddress=${address}`);
            const data = await res.json();
            if (data.success && data.data) {
                setDisplayName(data.data.displayName || '');
                setAvatarUrl(data.data.avatarUrl || '');
                setBio(data.data.bio || '');
                setTheme(data.data.theme || 'light');
                setCurrency(data.data.currency || 'USD');
                setLanguage(data.data.language || 'en-US');
                setDisplayUnit(data.data.displayUnit || 'FIAT');
                setGasPreset(data.data.gasPreset || 'STANDARD');
                setMevProtection(data.data.mevProtection ?? false);
                setStealthMode(data.data.stealthMode ?? false);
            }
        } catch (e) {
            console.error('Failed to fetch profile', e);
        } finally {
            setIsLoading(false);
        }
    };

    const handleSave = async () => {
        if (!address) {
            toast.error("Connect wallet to save profile.");
            return;
        }

        setIsSaving(true);
        const tid = toast.loading("Encrypting and saving configuration...");
        try {
            const res = await fetch('/api/user/profile', {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    walletAddress: address,
                    displayName, avatarUrl, bio,
                    theme, currency, language, displayUnit,
                    gasPreset, mevProtection, stealthMode
                })
            });
            const data = await res.json();
            if (data.success) {
                toast.success("Configuration fully synchronized.", { id: tid });
                onClose();
            } else {
                toast.error(data.error || "Failed to update profile.", { id: tid });
            }
        } catch (e) {
            toast.error("Network error.", { id: tid });
        } finally {
            setIsSaving(false);
        }
    };

    if (!isOpen) return null;

    const tabs = [
        { id: 'identity', label: 'Identity', icon: Fingerprint },
        { id: 'preferences', label: 'Preferences', icon: Palette },
        { id: 'security', label: 'Terminal', icon: Shield }
    ] as const;

    return (
        <AnimatePresence>
            <motion.div 
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                className="fixed inset-0 z-[200] flex items-center justify-center p-4 bg-black/40 backdrop-blur-md"
            >
                <motion.div 
                    initial={{ y: 30, scale: 0.96, opacity: 0 }}
                    animate={{ y: 0, scale: 1, opacity: 1 }}
                    exit={{ y: 20, scale: 0.96, opacity: 0 }}
                    transition={{ type: "spring", damping: 25, stiffness: 300 }}
                    className="w-full max-w-2xl bg-white border border-[#E5E5E5] shadow-2xl overflow-hidden relative flex flex-col md:flex-row"
                    style={{ minHeight: "500px", borderRadius: "16px" }}
                >
                    {/* Left Sidebar Tabs */}
                    <div className="w-full md:w-[220px] bg-[#FFFFFF] border-b md:border-b-0 md:border-r border-[#E5E5E5] flex flex-col">
                        <div className="p-6 pb-2 flex items-center justify-between">
                            <h2 className="text-[11px] font-black uppercase tracking-[0.2em] text-[#050505]">
                                Configuration
                            </h2>
                            <button onClick={onClose} className="md:hidden p-1 text-[#888888] hover:text-[#050505] transition-colors">
                                <X size={16} />
                            </button>
                        </div>
                        
                        <div className="flex-1 px-3 py-4 flex flex-row md:flex-col gap-1 overflow-x-auto no-scrollbar">
                            {tabs.map(tab => {
                                const active = activeTab === tab.id;
                                const Icon = tab.icon;
                                return (
                                    <button
                                        key={tab.id}
                                        onClick={() => setActiveTab(tab.id)}
                                        className={`flex items-center gap-3 px-4 py-3 rounded-xl transition-all whitespace-nowrap ${
                                            active 
                                            ? 'bg-black text-white shadow-md shadow-black/10' 
                                            : 'text-[#666666] hover:bg-black/5 hover:text-black'
                                        }`}
                                    >
                                        <Icon size={16} className={active ? "text-white" : "text-[#888888]"} />
                                        <span className="text-[11px] font-black uppercase tracking-widest">
                                            {tab.label}
                                        </span>
                                    </button>
                                );
                            })}
                        </div>
                    </div>

                    {/* Main Content Area */}
                    <div className="flex-1 flex flex-col bg-white relative">
                        <button onClick={onClose} className="hidden md:flex absolute top-4 right-4 p-2 text-[#888888] hover:bg-[#F5F5F5] hover:text-[#050505] rounded-full transition-colors z-10">
                            <X size={18} />
                        </button>

                        <div className="flex-1 p-8 overflow-y-auto">
                            {!isConnected ? (
                                <div className="h-full flex flex-col items-center justify-center space-y-4">
                                    <User size={48} className="text-[#E5E5E5]" />
                                    <p className="text-[11px] font-black uppercase tracking-[0.2em] text-[#888888]">
                                        WALLET CONNECTION REQUIRED
                                    </p>
                                </div>
                            ) : isLoading ? (
                                <div className="h-full flex items-center justify-center">
                                    <Loader2 className="animate-spin text-[#888888]" size={32} />
                                </div>
                            ) : (
                                <AnimatePresence mode="wait">
                                    <motion.div
                                        key={activeTab}
                                        initial={{ opacity: 0, x: 10 }}
                                        animate={{ opacity: 1, x: 0 }}
                                        exit={{ opacity: 0, x: -10 }}
                                        transition={{ duration: 0.2 }}
                                        className="space-y-8"
                                    >
                                        {/*  TAB: IDENTITY  */}
                                        {activeTab === 'identity' && (
                                            <div className="space-y-6">
                                                <div className="flex flex-col sm:flex-row items-center gap-6">
                                                    <div className="relative group shrink-0">
                                                        <div className="w-24 h-24 rounded-full border border-[#E5E5E5] overflow-hidden bg-[#FFFFFF] flex items-center justify-center shadow-inner">
                                                            {avatarUrl && !imgError ? (
                                                                <img 
                                                                    src={avatarUrl} 
                                                                    alt="Avatar" 
                                                                    className="w-full h-full object-cover" 
                                                                    onError={() => setImgError(true)}
                                                                />
                                                            ) : (
                                                                <User size={32} className="text-[#888888]" />
                                                            )}
                                                        </div>
                                                    </div>
                                                    <div className="w-full">
                                                        <label className="block text-[9px] font-black uppercase tracking-[0.2em] text-[#888888] mb-2">Avatar URL</label>
                                                        <input 
                                                            type="text" 
                                                            value={avatarUrl}
                                                            onChange={(e) => setAvatarUrl(e.target.value)}
                                                            placeholder="https://example.com/avatar.png"
                                                            className="w-full p-3.5 bg-[#FFFFFF] border border-[#E5E5E5] rounded-xl text-[13px] text-[#050505] font-mono focus:border-black focus:bg-white focus:ring-4 focus:ring-black/5 outline-none transition-all placeholder:text-[#BBBBBB]"
                                                        />
                                                    </div>
                                                </div>

                                                <div>
                                                    <label className="block text-[9px] font-black uppercase tracking-[0.2em] text-[#888888] mb-2">KYC Name</label>
                                                    <input 
                                                        type="text" 
                                                        value={displayName}
                                                        onChange={(e) => setDisplayName(e.target.value)}
                                                        placeholder="KYC Identity"
                                                        maxLength={50}
                                                        className="w-full p-3.5 bg-[#FFFFFF] border border-[#E5E5E5] rounded-xl text-[14px] text-[#050505] font-bold focus:border-black focus:bg-white focus:ring-4 focus:ring-black/5 outline-none transition-all placeholder:text-[#BBBBBB]"
                                                    />
                                                </div>
                                                <div>
                                                    <label className="block text-[9px] font-black uppercase tracking-[0.2em] text-[#888888] mb-2">Cryptographic Status / Bio</label>
                                                    <textarea 
                                                        value={bio}
                                                        onChange={(e) => setBio(e.target.value)}
                                                        placeholder="Enter your cryptographic status..."
                                                        maxLength={250}
                                                        className="w-full p-3.5 bg-[#FFFFFF] border border-[#E5E5E5] rounded-xl text-[13px] text-[#050505] font-mono h-24 resize-none focus:border-black focus:bg-white focus:ring-4 focus:ring-black/5 outline-none transition-all placeholder:text-[#BBBBBB]"
                                                    />
                                                </div>
                                            </div>
                                        )}

                                        {/*  TAB: PREFERENCES  */}
                                        {activeTab === 'preferences' && (
                                            <div className="space-y-6">
                                                <div className="grid grid-cols-2 gap-4">
                                                    <div>
                                                        <label className="block text-[9px] font-black uppercase tracking-[0.2em] text-[#888888] mb-2">Theme</label>
                                                        <select value={theme} onChange={e => setTheme(e.target.value)} className="w-full p-3.5 bg-[#FFFFFF] border border-[#E5E5E5] rounded-xl text-[13px] text-[#050505] font-bold focus:border-black outline-none appearance-none cursor-pointer">
                                                            <option value="light">Light (Ivory)</option>
                                                            <option value="dark">Dark (Ink)</option>
                                                            <option value="system">System Default</option>
                                                        </select>
                                                    </div>
                                                    <div>
                                                        <label className="block text-[9px] font-black uppercase tracking-[0.2em] text-[#888888] mb-2">Language</label>
                                                        <div className="relative">
                                                            <Globe size={14} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-[#888888]" />
                                                            <select value={language} onChange={e => setLanguage(e.target.value)} className="w-full p-3.5 pl-10 bg-[#FFFFFF] border border-[#E5E5E5] rounded-xl text-[13px] text-[#050505] font-bold focus:border-black outline-none appearance-none cursor-pointer">
                                                                <option value="en-US">English (US)</option>
                                                                <option value="es-ES">Español (ES)</option>
                                                            </select>
                                                        </div>
                                                    </div>
                                                </div>

                                                <div className="grid grid-cols-2 gap-4">
                                                    <div>
                                                        <label className="block text-[9px] font-black uppercase tracking-[0.2em] text-[#888888] mb-2">Base Currency</label>
                                                        <div className="relative">
                                                            <DollarSign size={14} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-[#888888]" />
                                                            <select value={currency} onChange={e => setCurrency(e.target.value)} className="w-full p-3.5 pl-10 bg-[#FFFFFF] border border-[#E5E5E5] rounded-xl text-[13px] text-[#050505] font-bold focus:border-black outline-none appearance-none cursor-pointer">
                                                                <option value="USD">USD ($)</option>
                                                                <option value="EUR">EUR ()</option>
                                                                <option value="GBP">GBP (£)</option>
                                                            </select>
                                                        </div>
                                                    </div>
                                                    <div>
                                                        <label className="block text-[9px] font-black uppercase tracking-[0.2em] text-[#888888] mb-2">Display Unit</label>
                                                        <select value={displayUnit} onChange={e => setDisplayUnit(e.target.value)} className="w-full p-3.5 bg-[#FFFFFF] border border-[#E5E5E5] rounded-xl text-[13px] text-[#050505] font-bold focus:border-black outline-none appearance-none cursor-pointer">
                                                            <option value="FIAT">Fiat (USD)</option>
                                                            <option value="BTC">Bitcoin (BTC)</option>
                                                            <option value="ETH">Ethereum (ETH)</option>
                                                        </select>
                                                    </div>
                                                </div>
                                            </div>
                                        )}

                                        {/*  TAB: SECURITY  */}
                                        {activeTab === 'security' && (
                                            <div className="space-y-6">
                                                <div>
                                                    <label className="block text-[9px] font-black uppercase tracking-[0.2em] text-[#888888] mb-2">Network Gas Preset</label>
                                                    <div className="grid grid-cols-3 gap-2">
                                                        {['ECONOMY', 'STANDARD', 'FAST'].map(preset => (
                                                            <button
                                                                key={preset}
                                                                onClick={() => setGasPreset(preset)}
                                                                className={`py-3 rounded-xl border text-[11px] font-black uppercase tracking-widest transition-all ${
                                                                    gasPreset === preset 
                                                                    ? 'bg-black text-white border-black' 
                                                                    : 'bg-[#FFFFFF] border-[#E5E5E5] text-[#888888] hover:border-black hover:text-black'
                                                                }`}
                                                            >
                                                                {preset}
                                                            </button>
                                                        ))}
                                                    </div>
                                                </div>

                                                <div className="space-y-3">
                                                    <button onClick={() => setMevProtection(!mevProtection)} className="w-full flex items-center justify-between p-4 rounded-xl border border-[#E5E5E5] hover:bg-[#FFFFFF] transition-colors">
                                                        <div className="flex items-center gap-3">
                                                            <div className={`p-2 rounded-lg ${mevProtection ? 'bg-emerald-50 text-emerald-500' : 'bg-gray-50 text-gray-400'}`}>
                                                                <Zap size={18} />
                                                            </div>
                                                            <div className="text-left">
                                                                <p className="text-[13px] font-bold text-[#050505]">MEV Protection</p>
                                                                <p className="text-[10px] text-[#888888]">Route transactions via Flashbots/Private RPCs</p>
                                                            </div>
                                                        </div>
                                                        <div className={`w-10 h-6 rounded-full p-1 transition-colors ${mevProtection ? 'bg-emerald-500' : 'bg-[#E5E5E5]'}`}>
                                                            <motion.div animate={{ x: mevProtection ? 16 : 0 }} className="w-4 h-4 bg-white rounded-full shadow-sm" />
                                                        </div>
                                                    </button>

                                                    <button onClick={() => setStealthMode(!stealthMode)} className="w-full flex items-center justify-between p-4 rounded-xl border border-[#E5E5E5] hover:bg-[#FFFFFF] transition-colors">
                                                        <div className="flex items-center gap-3">
                                                            <div className={`p-2 rounded-lg ${stealthMode ? 'bg-purple-50 text-purple-500' : 'bg-gray-50 text-gray-400'}`}>
                                                                <EyeOff size={18} />
                                                            </div>
                                                            <div className="text-left">
                                                                <p className="text-[13px] font-bold text-[#050505]">Stealth Mode</p>
                                                                <p className="text-[10px] text-[#888888]">Obfuscate exact balances and active positions</p>
                                                            </div>
                                                        </div>
                                                        <div className={`w-10 h-6 rounded-full p-1 transition-colors ${stealthMode ? 'bg-purple-500' : 'bg-[#E5E5E5]'}`}>
                                                            <motion.div animate={{ x: stealthMode ? 16 : 0 }} className="w-4 h-4 bg-white rounded-full shadow-sm" />
                                                        </div>
                                                    </button>
                                                </div>
                                            </div>
                                        )}
                                    </motion.div>
                                </AnimatePresence>
                            )}
                        </div>

                        {/* Footer / Save Button */}
                        <div className="p-6 border-t border-[#E5E5E5] bg-white flex justify-end">
                            <button
                                onClick={handleSave}
                                disabled={!isConnected || isSaving}
                                className="bg-white text-white px-8 py-3.5 rounded-xl text-[11px] font-black uppercase tracking-[0.2em] hover:bg-black/80 hover:shadow-lg hover:shadow-black/10 active:scale-[0.98] transition-all disabled:opacity-50 flex items-center gap-2"
                            >
                                {isSaving ? <Loader2 size={16} className="animate-spin" /> : <Save size={16} />}
                                {isSaving ? 'SYNCING STATE...' : 'SAVE CONFIGURATION'}
                            </button>
                        </div>
                    </div>
                </motion.div>
            </motion.div>
        </AnimatePresence>
    );
}
