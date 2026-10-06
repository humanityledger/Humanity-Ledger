"use client";

import React, { useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { ChevronDown, Bell, Eye, EyeOff, Settings, Globe, Crown, X } from 'lucide-react';
import Link from 'next/link';
import { useAppKit } from '@reown/appkit/react';
import { useAccount } from 'wagmi';
import { useLanguage } from '@/src/context/LanguageContext';
import { useUIStore } from '@/lib/store/ui-store';
import useSWR, { mutate } from 'swr';

const fetcher = (url: string) => fetch(url).then(r => r.json());

export function DropdownNav() {
    const [isOpen, setIsOpen] = useState(false);
    const [showNotifications, setShowNotifications] = useState(false);
    const { t, language, toggleLanguage } = useLanguage();
    const { isStealthMode, toggleStealthMode } = useUIStore();
    const appKit = useAppKit();
    const { address, isConnected } = useAccount();
    const [mounted, setMounted] = useState(false);

    useEffect(() => {
        setMounted(true);
    }, []);

    // Fetch notifications
    const { data } = useSWR(`/api/user/notifications?address=${address || ''}`, fetcher, { refreshInterval: 30000 });
    const notifications = data?.notifications || [];
    const unreadCount = notifications.filter((n: any) => !n.read).length;

    const navLinks = [
        { name: t('nav.functions'), href: '/funciones', icon: null },
        { name: 'LEDGER', href: '/vip', icon: <Crown size={16} className="text-[#D4AF37]" />, isVIP: true },
        { name: t('nav.developer'), href: '/developer', icon: null },
        { name: t('nav.human_card'), href: '/wallet', icon: null },
        { name: t('nav.support'), href: '/soporte', icon: null },
    ];

    const markAllRead = async () => {
        try {
            await fetch('/api/user/notifications', {
                method: 'PUT',
                body: JSON.stringify({ read: true, address })
            });
            mutate(`/api/user/notifications?address=${address || ''}`);
        } catch (e) {
            console.error(e);
        }
    };

    return (
        <>
            <div className="relative z-50">
                {/* Trigger Button - always visible with elegant animation */}
                <motion.button
                    onClick={() => setIsOpen(!isOpen)}
                    className="group inline-flex items-center gap-2 px-6 py-3 rounded-full border border-white/20 bg-white/10 backdrop-blur-xl hover:bg-white/20 transition-all shadow-lg hover:shadow-2xl"
                    whileHover={{ scale: 1.05 }}
                    whileTap={{ scale: 0.95 }}
                    animate={{ 
                        backgroundColor: isOpen ? 'rgba(255, 255, 255, 0.25)' : 'rgba(255, 255, 255, 0.1)',
                    }}
                    transition={{ duration: 0.3 }}
                >
                    <span className="text-lg font-black tracking-tight text-[#1F1F1F] ">
                        Humanity Ledger
                    </span>
                    <motion.div
                        animate={{ rotate: isOpen ? 180 : 0 }}
                        transition={{ duration: 0.3, ease: "easeInOut" }}
                    >
                        <ChevronDown className="w-5 h-5 text-[#1F1F1F] " />
                    </motion.div>
                </motion.button>



                {/* Dropdown Menu */}
                <AnimatePresence>
                    {isOpen && (
                        <>
                            {/* Transparent Backdrop to detect click outside - NO BLUR here to keep button sharp */}
                            <div 
                                className="fixed inset-0 z-40 bg-black/5" 
                                onClick={() => setIsOpen(false)} 
                            />

                            {/* Menu Panel - Absolute below button, Glassmorphic Rectangle */}
                            <motion.div
                                initial={{ opacity: 0, y: -10, scale: 0.95 }}
                                animate={{ opacity: 1, y: 0, scale: 1 }}
                                exit={{ opacity: 0, y: -10, scale: 0.95 }}
                                transition={{ duration: 0.25, ease: [0.4, 0, 0.2, 1] }}
                                className="absolute top-full mt-4 left-1/2 -translate-x-1/2 w-80 bg-white/80  backdrop-blur-2xl rounded-3xl shadow-2xl border border-white/20  overflow-hidden z-50 pointer-events-auto"
                            >
                                {/* Exit Button / Header */}
                                <div className="p-4 border-b border-gray-200  flex justify-between items-center">
                                    <h3 className="text-[10px] font-black uppercase tracking-[0.2em] text-gray-400">Quick Navigation</h3>
                                    <button
                                        onClick={() => setIsOpen(false)}
                                        className="p-1.5 rounded-full hover:bg-gray-100  transition-colors"
                                    >
                                        <X size={16} className="text-gray-400" />
                                    </button>
                                </div>

                                {/* Navigation Links */}
                                <div className="p-4 space-y-1">
                                    {navLinks.map((link) => (
                                        <Link
                                            key={link.href}
                                            href={link.href}
                                            onClick={() => setIsOpen(false)}
                                            className={`flex items-center gap-3 px-4 py-3 rounded-xl transition-all ${
                                                link.isVIP
                                                    ? 'bg-gradient-to-r from-black to-gray-800 text-white hover:scale-[1.02] shadow-lg'
                                                    : 'hover:bg-gray-100  text-[#1F1F1F] '
                                            }`}
                                        >
                                            <div className="w-5 flex justify-center">{link.icon}</div>
                                            <span className="font-bold text-sm tracking-tight">{link.name}</span>
                                        </Link>
                                    ))}
                                </div>

                                {/* Divider */}
                                <div className="h-px bg-gradient-to-r from-transparent via-gray-200  to-transparent" />

                                {/* Utility Buttons Grid */}
                                <div className="p-4">
                                    <div className="grid grid-cols-2 gap-2">
                                        {/* Notifications */}
                                        <button
                                            onClick={() => {
                                                setShowNotifications(true);
                                                setIsOpen(false);
                                            }}
                                            className="relative flex flex-col items-center justify-center gap-1 p-3 rounded-2xl bg-gray-50  hover:bg-gray-100  transition-all border border-transparent hover:border-gray-200 "
                                        >
                                            <div className="relative">
                                                <Bell size={18} className="text-[#1F1F1F] " />
                                                {unreadCount > 0 && (
                                                    <span className="absolute -top-1 -right-1 w-2.5 h-2.5 bg-red-500 rounded-full border-2 border-white " />
                                                )}
                                            </div>
                                            <span className="text-[10px] font-black uppercase tracking-wider text-gray-500">Alertas</span>
                                        </button>

                                        {/* Stealth Mode */}
                                        <button
                                            onClick={toggleStealthMode}
                                            className="flex flex-col items-center justify-center gap-1 p-3 rounded-2xl bg-gray-50  hover:bg-gray-100  transition-all border border-transparent hover:border-gray-200 "
                                        >
                                            {isStealthMode ? <EyeOff size={18} /> : <Eye size={18} />}
                                            <span className="text-[10px] font-black uppercase tracking-wider text-gray-500">
                                                {isStealthMode ? 'Visible' : 'Ocultar'}
                                            </span>
                                        </button>

                                        {/* Settings */}
                                        <Link
                                            href="/settings"
                                            onClick={() => setIsOpen(false)}
                                            className="flex flex-col items-center justify-center gap-1 p-3 rounded-2xl bg-gray-50  hover:bg-gray-100  transition-all border border-transparent hover:border-gray-200 "
                                        >
                                            <Settings size={18} className="text-[#1F1F1F] " />
                                            <span className="text-[10px] font-black uppercase tracking-wider text-gray-500">Config</span>
                                        </Link>

                                        {/* Language */}
                                        <button
                                            onClick={toggleLanguage}
                                            className="flex flex-col items-center justify-center gap-1 p-3 rounded-2xl bg-gray-50  hover:bg-gray-100  transition-all border border-transparent hover:border-gray-200 "
                                        >
                                            <Globe size={18} className="text-[#1F1F1F] " />
                                            <span className="text-[10px] font-black uppercase tracking-wider text-gray-500">
                                                {language}
                                            </span>
                                        </button>
                                    </div>
                                </div>

                                {/* Connect Button */}
                                <div className="p-4 pt-0">
                                    <button
                                        onClick={() => {
                                            appKit.open();
                                            setIsOpen(false);
                                        }}
                                        className="w-full bg-[#1F1F1F]   text-white px-6 py-4 rounded-2xl font-black text-xs uppercase tracking-[0.2em] hover:scale-[1.02] active:scale-95 transition-all shadow-xl flex items-center justify-center gap-3"
                                    >
                                        {isConnected ? (
                                            <>
                                                <div className="w-2 h-2 rounded-full bg-green-500 animate-pulse" />
                                                <span className="font-mono">{address?.slice(0, 6)}...{address?.slice(-4)}</span>
                                            </>
                                        ) : (
                                            t('nav.start')
                                        )}
                                    </button>
                                </div>
                            </motion.div>
                        </>
                    )}
                </AnimatePresence>
            </div>

            {/* Notifications Modal - Portaled to avoid positioning bugs */}
            {mounted && showNotifications && createPortal(
                <AnimatePresence mode="wait">
                    <div className="fixed inset-0 z-[1000] isolate">
                        <motion.div
                            initial={{ opacity: 0 }}
                            animate={{ opacity: 1 }}
                            exit={{ opacity: 0 }}
                            className="absolute inset-0 bg-black/40 backdrop-blur-sm"
                            onClick={() => setShowNotifications(false)}
                        />
                        <motion.div
                            initial={{ opacity: 0, x: 100 }}
                            animate={{ opacity: 1, x: 0 }}
                            exit={{ opacity: 0, x: 100 }}
                            transition={{ duration: 0.3, ease: "easeOut" }}
                            className="absolute right-4 top-4 bottom-4 w-[calc(100%-2rem)] max-w-96 bg-white  rounded-3xl shadow-2xl border border-white/20 overflow-hidden flex flex-col"
                        >
                            <div className="p-4 border-b border-gray-100  flex justify-between items-center bg-gray-50/50 ">
                                <h3 className="font-bold text-gray-900 ">Notificaciones</h3>
                                {unreadCount > 0 && (
                                    <button 
                                        onClick={markAllRead}
                                        className="text-xs text-blue-600 hover:text-blue-700 font-medium px-3 py-1 rounded-full bg-blue-50 hover:bg-blue-100 transition-colors"
                                    >
                                        Marcar leídas
                                    </button>
                                )}
                            </div>

                            <div className="flex-1 overflow-y-auto p-4 custom-scrollbar">
                                {!data ? (
                                    <div className="flex flex-col items-center justify-center h-full text-gray-400">
                                        <div className="w-8 h-8 border-2 border-[#25D366] border-t-transparent rounded-full animate-spin mb-2" />
                                        Loading...
                                    </div>
                                ) : notifications.length === 0 ? (
                                    <div className="flex flex-col items-center justify-center h-full text-gray-400">
                                        <Bell size={32} className="opacity-40 mb-2" />
                                        <p>No hay notificaciones</p>
                                    </div>
                                ) : (
                                    <div className="space-y-3">
                                        {notifications.map((n: any) => (
                                            <div 
                                                key={n.id} 
                                                className={`p-4 rounded-xl border transition-all ${
                                                    !n.read 
                                                        ? 'bg-blue-50/50  border-blue-100 ' 
                                                        : 'bg-gray-50/50  border-gray-100 '
                                                }`}
                                            >
                                                <h4 className={`text-sm mb-1 ${!n.read ? 'font-bold' : 'font-medium'} text-gray-900 `}>
                                                    {n.title}
                                                </h4>
                                                <p className="text-xs text-gray-600  mb-2 leading-relaxed">
                                                    {n.message}
                                                </p>
                                                <span className="text-[10px] text-gray-400 font-medium">
                                                    {new Date(n.createdAt).toLocaleString()}
                                                </span>
                                            </div>
                                        ))}
                                    </div>
                                )}
                            </div>
                        </motion.div>
                    </div>
                </AnimatePresence>,
                document.body
            )}
        </>
    );
}



