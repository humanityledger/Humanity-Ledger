'use client';

import React, { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Bell, Lock, X, Check, CheckCheck, ExternalLink, Trash2 } from 'lucide-react';
import {
  getZkNotifications,
  markNotificationsRead,
  getUnreadCount,
  getNotificationIconAndColor,
  ZkNotification
} from '@/lib/zk/zkNotifications';

export function ZkNotificationBell({ className = '' }: { className?: string }) {
  const [open, setOpen] = useState(false);
  const [notifications, setNotifications] = useState<ZkNotification[]>([]);
  const [unread, setUnread] = useState(0);
  const panelRef = useRef<HTMLDivElement>(null);

  const refresh = () => {
    const notifs = getZkNotifications();
    setNotifications(notifs);
    setUnread(getUnreadCount());
  };

  useEffect(() => {
    refresh();
    const handler = () => refresh();
    window.addEventListener('ledger_zk_notification', handler);
    return () => window.removeEventListener('ledger_zk_notification', handler);
  }, []);

  useEffect(() => {
    if (!open) return;
    const handler = (e: MouseEvent) => {
      if (panelRef.current && !panelRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [open]);

  const handleOpen = () => {
    setOpen(o => !o);
    if (!open) {
      setTimeout(() => {
        markNotificationsRead();
        setUnread(0);
      }, 1000);
    }
  };

  const handleClearAll = () => {
    if (typeof window !== 'undefined') {
      localStorage.removeItem('ledger_zk_notifications');
    }
    refresh();
  };

  const relativeTime = (ts: number) => {
    const diff = Date.now() - ts;
    if (diff < 60_000) return 'just now';
    if (diff < 3_600_000) return `${Math.floor(diff / 60_000)}m ago`;
    if (diff < 86_400_000) return `${Math.floor(diff / 3_600_000)}h ago`;
    return `${Math.floor(diff / 86_400_000)}d ago`;
  };

  return (
    <div className={`relative ${className}`} ref={panelRef}>
      <button
        onClick={handleOpen}
        className="relative w-9 h-9 flex items-center justify-center rounded-full hover:bg-black/5 transition"
        aria-label="zk.money notifications"
      >
        <Bell size={18} className="text-gray-600" strokeWidth={2} />
        {unread > 0 && (
          <span className="absolute top-0.5 right-0.5 w-4 h-4 bg-[#15171c] text-white text-[12px] font-semibold rounded-full flex items-center justify-center leading-none">
            {unread > 9 ? '9+' : unread}
          </span>
        )}
      </button>

      <AnimatePresence>
        {open && (
          <motion.div
            initial={{ opacity: 0, y: 8, scale: 0.97 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 8, scale: 0.97 }}
            transition={{ type: 'spring', stiffness: 380, damping: 30 }}
            className="absolute right-0 top-full mt-2 w-[360px] bg-white rounded-3xl shadow-2xl border border-black/[0.08] overflow-hidden z-[9999]"
          >
            {/* Header */}
            <div className="px-4 py-3 border-b border-black/[0.06] flex items-center justify-between bg-[#f7f8fa]">
              <div className="flex items-center gap-2">
                <Lock size={14} className="text-[#15171c]" strokeWidth={2.5} />
                <span className="text-[13px] font-semibold text-gray-900">zk.money Alerts</span>
                {unread > 0 && (
                  <span className="text-[12px] font-semibold bg-black/5 text-[#15171c] px-2 py-0.5 rounded-full">
                    {unread} new
                  </span>
                )}
              </div>
              <div className="flex items-center gap-1">
                {notifications.length > 0 && (
                  <button onClick={handleClearAll} className="p-1.5 hover:bg-black/5 rounded-lg text-gray-400 hover:text-[#d93036] transition">
                    <Trash2 size={13} />
                  </button>
                )}
                <button onClick={() => setOpen(false)} className="p-1.5 hover:bg-black/5 rounded-lg text-gray-400 transition">
                  <X size={13} />
                </button>
              </div>
            </div>

            {/* Notification List */}
            <div className="max-h-[440px] overflow-y-auto">
              {notifications.length === 0 ? (
                <div className="text-center py-12 flex flex-col items-center gap-2">
                  <Lock size={28} strokeWidth={1.5} className="text-gray-300" />
                  <p className="text-[13px] text-gray-400 font-semibold">No zk.money alerts yet</p>
                  <p className="text-[12.5px] text-gray-300 max-w-xs">Send or receive private payments to see activity here</p>
                </div>
              ) : (
                <div className="divide-y divide-black/[0.04]">
                  {notifications.map(notif => {
                    const { emoji, color } = getNotificationIconAndColor(notif.type);
                    return (
                      <div
                        key={notif.id}
                        className={`flex items-start gap-3 px-4 py-3 hover:bg-[#f7f8fa] transition ${!notif.read ? 'bg-black/[0.02]' : ''}`}
                      >
                        <span className="text-[18px] leading-none mt-0.5 flex-shrink-0">{emoji}</span>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-start justify-between gap-2">
                            <span className="text-[12px] font-semibold text-gray-900 leading-tight">{notif.title}</span>
                            <span className="text-[12px] text-gray-400 font-medium flex-shrink-0">{relativeTime(notif.timestamp)}</span>
                          </div>
                          <p className="text-[12.5px] text-gray-500 mt-0.5 leading-relaxed">{notif.body}</p>
                          {notif.link && (
                            <a
                              href={notif.link}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="mt-1 text-[12px] font-semibold flex items-center gap-0.5 hover:underline"
                              style={{ color }}
                            >
                              View on AztecScan <ExternalLink size={9} />
                            </a>
                          )}
                        </div>
                        {!notif.read && <span className="w-1.5 h-1.5 rounded-full bg-[#15171c] mt-1 flex-shrink-0" />}
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
