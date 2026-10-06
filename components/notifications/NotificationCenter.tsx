"use client";

import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Bell, Check, X, ShieldAlert, BadgePercent, MessageCircle, Info } from 'lucide-react';
import { useAccount } from 'wagmi';
import useSWR, { mutate } from 'swr';

const fetcher = (url: string) => fetch(url).then(r => r.json());

export default function NotificationCenter() {
    const { address } = useAccount();
    const [isOpen, setIsOpen] = useState(false);
    
    // Fetch real notifications from API
    const { data, error } = useSWR(
        address ? `/api/user/notifications?address=${address}` : null, 
        fetcher, 
        { refreshInterval: 30000 }
    );

    const notifications = data?.notifications || [];
    const unreadCount = notifications.filter((n: any) => !n.read).length;

    const getIcon = (type: string) => {
        switch(type) {
            case 'security': return <ShieldAlert size={16} className="text-red-500" />;
            case 'transaction': return <BadgePercent size={16} className="text-green-500" />;
            case 'social': return <MessageCircle size={16} className="text-[#25D366]" />;
            case 'system': return <Info size={16} className="text-[#25D366]" />;
            default: return <Bell size={16} className="text-gray-500" />;
        }
    };

    const markAllRead = async () => {
        try {
            await fetch('/api/user/notifications', {
                method: 'PUT',
                body: JSON.stringify({ read: true, address })
            });
            mutate(`/api/user/notifications?address=${address}`);
        } catch (e) {
            console.error(e);
        }
    };

    const getTimeLabel = (dateString: string) => {
        const date = new Date(dateString);
        const now = new Date();
        const diffInMinutes = Math.floor((now.getTime() - date.getTime()) / (1000 * 60));
        
        if (diffInMinutes < 1) return 'Just now';
        if (diffInMinutes < 60) return `${diffInMinutes}m ago`;
        
        const diffInHours = Math.floor(diffInMinutes / 60);
        if (diffInHours < 24) return `${diffInHours}h ago`;
        
        return date.toLocaleDateString();
    };

    return (
        <div className="relative">
            {/* Bell Trigger */}
            <button 
                onClick={() => setIsOpen(!isOpen)}
                className="relative p-2.5 rounded-full bg-white/50 border border-[#1F1F1F]/5 text-[#1F1F1F]/70 hover:bg-white hover:shadow-md transition-all active:scale-95"
            >
                <Bell size={20} />
                {unreadCount > 0 && (
                    <span className="absolute top-0 right-0 w-3 h-3 bg-red-500 border-2 border-[#EAEADF] rounded-full" />
                )}
            </button>

            {/* Dropdown Panel */}
            <AnimatePresence>
                {isOpen && (
                    <>
                        {/* Backdrop to close */}
                        <div className="fixed inset-0 z-40" onClick={() => setIsOpen(false)} />

                        <motion.div 
                            initial={{ opacity: 0, y: 10, scale: 0.95 }}
                            animate={{ opacity: 1, y: 0, scale: 1 }}
                            exit={{ opacity: 0, y: 10, scale: 0.95 }}
                            className="absolute right-0 mt-4 w-80 md:w-96 bg-white rounded-3xl shadow-2xl border border-[#1F1F1F]/5 z-50 overflow-hidden"
                        >
                            {/* Header */}
                            <div className="p-4 border-b border-[#1F1F1F]/5 flex justify-between items-center bg-[#FFFFFF]">
                                <h3 className="font-bold text-[#1F1F1F]">Notifications</h3>
                                <div className="text-xs text-[#1F1F1F]/40 font-mono">
                                    {unreadCount} unread
                                </div>
                            </div>

                            {/* List */}
                            <div className="max-h-[400px] overflow-y-auto custom-scrollbar">
                                {!data && !error ? (
                                    <div className="p-12 text-center text-[#1F1F1F]/20">
                                        <Bell size={32} className="mx-auto mb-2 animate-pulse" />
                                        <p className="text-sm">Loading...</p>
                                    </div>
                                ) : notifications.length === 0 ? (
                                    <div className="p-12 text-center text-[#1F1F1F]/40 text-sm">
                                        <Bell size={32} className="mx-auto mb-2 opacity-20" />
                                        No new notifications
                                    </div>
                                ) : (
                                    notifications.map((n: any) => (
                                        <div 
                                            key={n.id} 
                                            className={`p-4 border-b border-[#1F1F1F]/5 hover:bg-[#FFFFFF] transition-colors relative group ${!n.read ? 'bg-blue-50/30' : ''}`}
                                        >
                                            <div className="flex gap-3">
                                                <div className={`mt-1 w-8 h-8 rounded-full bg-white border border-[#1F1F1F]/5 flex items-center justify-center shadow-sm shrink-0`}>
                                                    {getIcon(n.type)}
                                                </div>
                                                <div className="flex-1 min-w-0">
                                                    <div className="flex justify-between items-start">
                                                        <h4 className={`text-sm ${!n.read ? 'font-bold text-[#1F1F1F]' : 'font-medium text-[#1F1F1F]/70'}`}>
                                                            {n.title}
                                                        </h4>
                                                        <span className="text-[10px] text-[#1F1F1F]/40 whitespace-nowrap ml-2">
                                                            {getTimeLabel(n.createdAt)}
                                                        </span>
                                                    </div>
                                                    <p className="text-xs text-[#1F1F1F]/60 mt-0.5 leading-relaxed line-clamp-2">
                                                        {n.message}
                                                    </p>
                                                </div>
                                            </div>
                                            
                                            {/* Unread Dot */}
                                            {!n.read && (
                                                <div className="absolute top-1/2 right-3 -translate-y-1/2 w-2 h-2 bg-[#25D366] rounded-full" />
                                            )}
                                        </div>
                                    ))
                                )}
                            </div>

                            {/* Footer */}
                            <div className="p-3 bg-[#FFFFFF] border-t border-[#1F1F1F]/5 text-center">
                                <button 
                                    onClick={markAllRead}
                                    disabled={unreadCount === 0}
                                    className="text-xs font-bold text-[#1F1F1F]/50 hover:text-[#1F1F1F] transition-colors disabled:opacity-30"
                                >
                                    Mark all as read
                                </button>
                            </div>
                        </motion.div>
                    </>
                )}
            </AnimatePresence>
        </div>
    );
}


