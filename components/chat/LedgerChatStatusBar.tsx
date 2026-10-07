"use client";
import React, { useState, useEffect, useRef, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import type { LocalContact } from '@/lib/wallet/localAddressBook';

interface LedgerStatus {
  peerAddress: string;
  text: string;
  emoji: string;
  postedAt: number;
  expiresAt: number;
}

const STATUS_EMOJIS = ['😊','🔥','💡','👀','🐋','⚡','🎯','✅','🚀','💎','🌊','🦁'];

function getStatusKey(address: string) {
  return `ledger_statuses_${address.toLowerCase()}`;
}

function loadStatuses(address: string): LedgerStatus[] {
  if (typeof window === 'undefined') return [];
  try {
    const raw = localStorage.getItem(getStatusKey(address));
    if (!raw) return [];
    const all: LedgerStatus[] = JSON.parse(raw);
    const now = Date.now();
    return all.filter(s => s.expiresAt > now);
  } catch {
    return [];
  }
}

function saveMyStatus(address: string, status: LedgerStatus) {
  if (typeof window === 'undefined') return;
  try {
    const existing = loadStatuses(address);
    const myStatuses = existing.filter(s => s.peerAddress === address.toLowerCase());
    // Keep at most 5 of my own statuses
    const trimmed = [status, ...myStatuses].slice(0, 5);
    const others = existing.filter(s => s.peerAddress !== address.toLowerCase());
    localStorage.setItem(getStatusKey(address), JSON.stringify([...trimmed, ...others]));
  } catch {}
}

function AddressAvatar({ address, size = 40, showSaved = false }: { address: string; size?: number; showSaved?: boolean }) {
  const [savedAvatar, setSavedAvatar] = React.useState<string>(() => {
    if (typeof window === 'undefined') return '';
    return localStorage.getItem('ledger_avatar') || '';
  });
  
  React.useEffect(() => {
    const handler = (e: any) => {
      if (e.detail?.avatarUrl) setSavedAvatar(e.detail.avatarUrl);
    };
    window.addEventListener('ledger_settings_update', handler);
    return () => window.removeEventListener('ledger_settings_update', handler);
  }, []);

  const initials = address.slice(2, 4).toUpperCase();
  const hue = parseInt(address.slice(2, 8), 16) % 360;

  if (showSaved && savedAvatar) {
    return (
      <div style={{ width: size, height: size, borderRadius: '50%', overflow: 'hidden', flexShrink: 0 }}>
        <img src={savedAvatar} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
      </div>
    );
  }

  return (
    <div
      style={{
        width: size,
        height: size,
        borderRadius: '50%',
        background: `hsl(${hue},65%,45%)`,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        color: 'white',
        fontWeight: 900,
        fontSize: size * 0.28,
        flexShrink: 0,
      }}
    >
      {initials}
    </div>
  );
}

interface LedgerChatStatusBarProps {
  address: string;
  contacts: LocalContact[];
}

export function LedgerChatStatusBar({ address, contacts }: LedgerChatStatusBarProps) {
  const [statuses, setStatuses] = useState<LedgerStatus[]>([]);
  const [showAddModal, setShowAddModal] = useState(false);
  const [showViewModal, setShowViewModal] = useState<LedgerStatus | null>(null);
  const [newStatusText, setNewStatusText] = useState('');
  const [selectedEmoji, setSelectedEmoji] = useState('🐋');
  const progressTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const [viewProgress, setViewProgress] = useState(0);

  useEffect(() => {
    setStatuses(loadStatuses(address));
  }, [address]);

  const handlePostStatus = () => {
    if (!newStatusText.trim()) return;
    const now = Date.now();
    const newStatus: LedgerStatus = {
      peerAddress: address.toLowerCase(),
      text: newStatusText.trim(),
      emoji: selectedEmoji,
      postedAt: now,
      expiresAt: now + 24 * 60 * 60 * 1000,
    };
    saveMyStatus(address, newStatus);
    setStatuses(loadStatuses(address));
    setShowAddModal(false);
    setNewStatusText('');
  };

  const handleViewStatus = (status: LedgerStatus) => {
    setShowViewModal(status);
    setViewProgress(0);
    let elapsed = 0;
    progressTimerRef.current = setInterval(() => {
      elapsed += 100;
      const pct = Math.min((elapsed / 5000) * 100, 100);
      setViewProgress(pct);
      if (elapsed >= 5000) {
        clearInterval(progressTimerRef.current!);
        setShowViewModal(null);
      }
    }, 100);
  };

  useEffect(() => {
    return () => {
      if (progressTimerRef.current) clearInterval(progressTimerRef.current);
    };
  }, []);

  const closeViewModal = () => {
    if (progressTimerRef.current) clearInterval(progressTimerRef.current);
    setShowViewModal(null);
  };

  // Build the list: My status first, then contacts who have statuses
  const myStatuses = statuses.filter(s => s.peerAddress === address.toLowerCase());
  const contactStatusMap = new Map<string, LedgerStatus>();
  statuses.forEach(s => {
    if (s.peerAddress !== address.toLowerCase()) {
      contactStatusMap.set(s.peerAddress, s);
    }
  });

  const contactsWithStatus = contacts.filter(c => contactStatusMap.has(c.peerAddress.toLowerCase()));

  return (
    <>
      <div className="w-full overflow-x-auto scrollbar-hide bg-white border-b border-black/5">
        <div className="flex items-center gap-4 px-4 py-3 min-w-0" style={{ width: 'max-content' }}>
          {/* My Status */}
          <button
            onClick={() => setShowAddModal(true)}
            className="flex flex-col items-center gap-1.5 shrink-0"
          >
            <div className="relative">
              <div
                className={`w-[50px] h-[50px] rounded-full flex items-center justify-center border-2 ${myStatuses.length > 0 ? 'border-[#1c7aff]' : 'border-black/20 border-dashed'}`}
              >
                <AddressAvatar address={address} size={42} showSaved={true} />
              </div>
              <div className="absolute -bottom-0.5 -right-0.5 w-5 h-5 bg-[#1c7aff] rounded-full border-2 border-white flex items-center justify-center">
                <span className="text-white text-[10px] font-black leading-none">+</span>
              </div>
            </div>
            <span className="text-[10px] font-bold text-black/50 max-w-[50px] truncate">My Status</span>
          </button>

          {/* Contacts with Statuses */}
          {contactsWithStatus.map(contact => {
            const status = contactStatusMap.get(contact.peerAddress.toLowerCase())!;
            return (
              <button
                key={contact.peerAddress}
                onClick={() => handleViewStatus(status)}
                className="flex flex-col items-center gap-1.5 shrink-0"
              >
                <div className="relative">
                  <div
                    className="w-[50px] h-[50px] rounded-full flex items-center justify-center border-2 border-[#30d158]"
                    style={{
                      background: `conic-gradient(#30d158 ${((Date.now() - status.postedAt) / (24 * 60 * 60 * 1000)) * 360}deg, #e5e5ea 0deg)`,
                      padding: 2,
                    }}
                  >
                    <AddressAvatar address={contact.peerAddress} size={42} />
                  </div>
                  <div className="absolute -bottom-0.5 -right-0.5 text-[14px]">{status.emoji}</div>
                </div>
                <span className="text-[10px] font-bold text-black/50 max-w-[50px] truncate">
                  {contact.name.split(' ')[0]}
                </span>
              </button>
            );
          })}
        </div>
      </div>

      {/* Add Status Modal */}
      <AnimatePresence>
        {showAddModal && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-[99999] bg-black/50 backdrop-blur-sm flex items-end justify-center"
            onClick={() => setShowAddModal(false)}
          >
            <motion.div
              initial={{ y: 100, opacity: 0 }}
              animate={{ y: 0, opacity: 1 }}
              exit={{ y: 100, opacity: 0 }}
              transition={{ type: 'spring', stiffness: 300, damping: 30 }}
              className="bg-white w-full max-w-lg rounded-t-[24px] p-6 border-t-4 border-black"
              onClick={e => e.stopPropagation()}
            >
              <h3 className="text-[18px] font-black uppercase tracking-tight mb-4">Post Status</h3>
              <input
                autoFocus
                value={newStatusText}
                onChange={e => setNewStatusText(e.target.value)}
                onKeyDown={e => e.key === 'Enter' && handlePostStatus()}
                placeholder="What's happening?"
                maxLength={120}
                className="w-full bg-[#f5f5f7] rounded-xl px-4 py-3 text-[15px] font-medium text-black placeholder:text-black/30 outline-none mb-4"
              />
              <div className="flex flex-wrap gap-2 mb-5">
                {STATUS_EMOJIS.map(e => (
                  <button
                    key={e}
                    onClick={() => setSelectedEmoji(e)}
                    className={`text-[24px] w-10 h-10 flex items-center justify-center rounded-xl transition-all ${selectedEmoji === e ? 'bg-black scale-110 shadow-lg' : 'bg-black/5 hover:bg-black/10'}`}
                  >
                    {e}
                  </button>
                ))}
              </div>
              <div className="flex gap-3">
                <button
                  onClick={() => setShowAddModal(false)}
                  className="flex-1 h-12 rounded-xl bg-black/5 text-black font-bold text-[14px]"
                >
                  Cancel
                </button>
                <button
                  onClick={handlePostStatus}
                  disabled={!newStatusText.trim()}
                  className="flex-1 h-12 rounded-xl bg-black text-white font-bold text-[14px] disabled:opacity-30"
                >
                  Post {selectedEmoji}
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* View Status Overlay */}
      <AnimatePresence>
        {showViewModal && (
          <motion.div
            initial={{ opacity: 0, scale: 0.96 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.96 }}
            className="fixed inset-0 z-[99999] bg-black flex flex-col items-center justify-center"
            onClick={closeViewModal}
          >
            {/* Progress Bar */}
            <div className="absolute top-0 left-0 right-0 h-[3px] bg-white/20">
              <div
                className="h-full bg-white transition-none"
                style={{ width: `${viewProgress}%` }}
              />
            </div>
            {/* Close */}
            <button
              className="absolute top-6 right-6 text-white/60 hover:text-white text-2xl font-black"
              onClick={closeViewModal}
            >
              ✕
            </button>
            {/* Status Content */}
            <div className="flex flex-col items-center gap-6 px-8 max-w-sm text-center">
              <AddressAvatar address={showViewModal.peerAddress} size={80} />
              <div className="text-[60px]">{showViewModal.emoji}</div>
              <p className="text-white text-[22px] font-black leading-tight">{showViewModal.text}</p>
              <p className="text-white/40 text-[12px] font-mono">
                {new Date(showViewModal.postedAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
              </p>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
}
