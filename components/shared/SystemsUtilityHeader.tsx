"use client";

import React from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Bell, User, Zap } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { useSystemAccount } from '@/hooks/useSystemAccount';
import { useSystemSignOut } from '@/hooks/useSystemSignOut';
import { useUIStore } from '@/lib/store/ui-store';
import { useSettingsStore } from '@/lib/store/useSettingsStore';
import { CurrencySwitcher } from './CurrencySwitcher';
import { useAztecNative } from '@/context/AztecNativeContext';
import Link from 'next/link';

//  IVORY SYSTEMS UTILITY HEADER 
// Perfectly visible on cream/ivory background
export function SystemsUtilityHeader() {
    const { address, isConnected } = useSystemAccount();
    const { activePanel, setActivePanel } = useUIStore();
    const { nuclearDisconnect } = useSystemSignOut();
    const router = useRouter();
    const { balance, aztecAddress } = useAztecNative();

    const icons: any[] = [];

    const truncateAddress = (addr: string) => `${addr.slice(0, 6)}...${addr.slice(-4)}`;

    const [isDropdownOpen, setIsDropdownOpen] = React.useState(false);
    const dropdownRef = React.useRef<HTMLDivElement>(null);
    const setSettingsOpen = useSettingsStore(state => state.setSettingsOpen);

    return (
        <div className="flex items-center gap-3 relative" ref={dropdownRef}>

            {/* Utility icon buttons */}
            <div className="flex items-center gap-1">
                {icons.map((item, i) => (
                    <motion.button
                        key={i}
                        whileHover={{ scale: 1.08 }}
                        whileTap={{ scale: 0.92 }}
                        onClick={() => setActivePanel(activePanel === item.id ? null : item.id as any)}
                        className="relative w-8 h-8 flex items-center justify-center rounded-lg transition-all"
                        style={{
                            background: activePanel === item.id ? 'rgba(0,0,0,0.08)' : 'transparent',
                            color: activePanel === item.id ? 'rgba(0,0,0,0.8)' : 'rgba(0,0,0,0.35)',
                        }}
                        title={item.label}
                    >
                        <item.icon size={15} strokeWidth={activePanel === item.id ? 2.5 : 1.8} />
                    </motion.button>
                ))}
            </div>

            {/* Separator */}
            <div className="w-px h-5" style={{ background: 'rgba(0,0,0,0.1)' }} />

            {/* Wallet Connection Pill */}
            <div className="relative">
                <motion.button
                    whileHover={{ scale: 1.02 }}
                    whileTap={{ scale: 0.97 }}
                    onClick={(e) => {
                        e.preventDefault();
                        e.stopPropagation();
                        if (!isConnected) {
                            router.push('/connect');
                        }
                    }}
                    className="flex items-center gap-2.5 pl-3.5 pr-1.5 py-1.5 rounded-full transition-all border cursor-pointer group"
                    style={{
                        background: isConnected ? 'rgba(0,0,0,0.07)' : 'rgba(0,0,0,0.04)',
                        borderColor: isDropdownOpen ? 'rgba(0,0,0,0.2)' : 'rgba(0,0,0,0.1)',
                        boxShadow: isDropdownOpen ? '0 2px 12px rgba(0,0,0,0.08)' : '0 1px 3px rgba(0,0,0,0.04)',
                    }}
                >
                    <div className="flex flex-col items-start leading-none text-left">
                        <span
                            className="font-mono text-[9px] font-black uppercase tracking-widest"
                            style={{ color: 'rgba(0,0,0,0.75)' }}
                        >
                            {isConnected && address ? truncateAddress(address) : 'Disconnected'}
                        </span>
                        <span
                            className="font-mono text-[7px] font-bold uppercase tracking-widest mt-0.5"
                            style={{ color: 'rgba(0,0,0,0.35)' }}
                        >
                            {isConnected ? 'Connected Wallet' : 'Connect your Wallet'}
                        </span>
                    </div>
                    <div
                        className="w-7 h-7 rounded-full flex items-center justify-center transition-all"
                        style={{
                            background: isDropdownOpen ? 'rgba(0,0,0,0.88)' : 'rgba(0,0,0,0.08)',
                            color: isDropdownOpen ? '#F7F2EA' : 'rgba(0,0,0,0.5)',
                        }}
                    >
                        <User size={12} />
                    </div>
                </motion.button>

                {/* Removed Ivory Dropdown in favor of Global Settings drawer */}
            </div>

            {isConnected && (
                <button
                    onClick={(e) => {
                        e.preventDefault();
                        e.stopPropagation();
                        nuclearDisconnect();
                    }}
                    className="ml-2 px-4 py-2 bg-red-50 text-red-600 border border-red-100 rounded-full text-[9px] font-black uppercase tracking-widest hover:bg-red-100 transition-colors shadow-sm hidden md:block"
                >
                    Disconnect
                </button>
            )}

            {isConnected && (
                <Link
                    href="/scan"
                    className="ml-2 xl:hidden flex items-center justify-center w-8 h-8 rounded-full bg-black text-white hover:scale-105 transition-transform"
                    title="Scan QR Code"
                >
                    <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M3 7V5a2 2 0 0 1 2-2h2"></path><path d="M17 3h2a2 2 0 0 1 2 2v2"></path><path d="M21 17v2a2 2 0 0 1-2 2h-2"></path><path d="M7 21H5a2 2 0 0 1-2-2v-2"></path></svg>
                </Link>
            )}
        </div>
    );
}

