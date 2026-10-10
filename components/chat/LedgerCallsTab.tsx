'use client';
import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Phone, Video, Star, PhoneIncoming, PhoneOutgoing,
  PhoneMissed, Lock, Search, Plus, X, MessageCircle
} from 'lucide-react';

interface CallRecord {
  id: string;
  peerAddress: string;
  peerName?: string;
  type: 'voice' | 'video';
  direction: 'incoming' | 'outgoing';
  missed?: boolean;
  duration?: number;
  timestamp: number;
}

interface Contact {
  peerAddress: string;
  name?: string;
}

interface LedgerCallsTabProps {
  callHistory: CallRecord[];
  myAddress: string;
  contacts: Contact[];
  onStartCall: (address: string, type: 'voice' | 'video') => void;
  onOpenChat: (address: string) => void;
  onNew: () => void;
  onSchedule: () => void;
  onKeypad: () => void;
  onFavorites: () => void;
}

const AVATAR_COLORS = ['#25D366','#34C759','#FF9500','#FF3B30','#AF52DE','#FF2D55'];
const avatarColor = (addr: string) => AVATAR_COLORS[parseInt(addr?.slice(2,4) || '0', 16) % AVATAR_COLORS.length];
const initials = (name: string | undefined, addr: string) => name ? name.slice(0,2).toUpperCase() : addr ? addr.slice(2,4).toUpperCase() : '??';
const shortAddr = (addr: string) => addr ? `${addr.slice(0, 6)}...${addr.slice(-4)}` : '';

const formatDuration = (seconds: number) => {
  if (seconds < 60) return `${seconds}s`;
  return `${Math.floor(seconds / 60)}:${String(seconds % 60).padStart(2, '0')}`;
};

const formatTime = (ts: number) => {
  const d = new Date(ts);
  const now = new Date();
  const diff = now.getTime() - ts;
  if (diff < 86400000 && d.getDate() === now.getDate()) return d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  if (diff < 172800000) return 'Yesterday';
  return d.toLocaleDateString([], { month: 'short', day: 'numeric' });
};

// Favorite addresses stored locally
const getFavorites = (): string[] => {
  try { return JSON.parse(localStorage.getItem('ledger_call_favorites') || '[]'); } catch { return []; }
};
const saveFavorites = (favs: string[]) => {
  try { localStorage.setItem('ledger_call_favorites', JSON.stringify(favs)); } catch {}
};

export const LedgerCallsTab: React.FC<LedgerCallsTabProps> = ({
  callHistory, myAddress, contacts, onStartCall, onOpenChat
}) => {
  const [showNewCall, setShowNewCall] = useState(false);
  const [contactSearch, setContactSearch] = useState('');
  const [showFavorites, setShowFavorites] = useState(false);
  const [favorites, setFavorites] = useState<string[]>(getFavorites);

  const filteredContacts = contacts.filter(c => {
    const q = contactSearch.toLowerCase();
    return (c.name?.toLowerCase().includes(q) || c.peerAddress.toLowerCase().includes(q));
  });

  const favoriteContacts = contacts.filter(c => favorites.includes(c.peerAddress.toLowerCase()));

  const toggleFavorite = (addr: string) => {
    const key = addr.toLowerCase();
    const next = favorites.includes(key) ? favorites.filter(f => f !== key) : [...favorites, key];
    setFavorites(next);
    saveFavorites(next);
  };

  return (
    <div className="flex-1 overflow-y-auto flex flex-col bg-[#F2F2F7]">
      {/* Action Row: only New Call + Favorites */}
      <div className="bg-white mb-2 px-4 py-3">
        <div className="flex gap-3">
          <button
            onClick={() => setShowNewCall(true)}
            className="flex-1 flex flex-col items-center gap-1.5 py-2"
          >
            <div className="w-[46px] h-[46px] rounded-2xl bg-[#25D366]/10 flex items-center justify-center text-[#25D366]">
              <Plus size={20} />
            </div>
            <span className="text-[11px] font-semibold text-[#25D366]">New Call</span>
          </button>
          <button
            onClick={() => setShowFavorites(v => !v)}
            className="flex-1 flex flex-col items-center gap-1.5 py-2"
          >
            <div className={`w-[46px] h-[46px] rounded-2xl flex items-center justify-center ${showFavorites ? 'bg-[#FF9500]' : 'bg-[#FF9500]/10'}`}>
              <Star size={20} className={showFavorites ? 'text-white' : 'text-[#FF9500]'} />
            </div>
            <span className="text-[11px] font-semibold text-[#FF9500]">Favourites</span>
          </button>
        </div>
      </div>

      {/* Favorites Panel */}
      <AnimatePresence>
        {showFavorites && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            className="overflow-hidden bg-white mb-2"
          >
            <div className="px-4 py-2 border-b border-black/[0.04]">
              <p className="text-[13px] font-semibold uppercase tracking-wider text-[#6D6D72]">Favourites</p>
            </div>
            {favoriteContacts.length === 0 ? (
              <div className="px-4 py-6 text-center">
                <Star size={28} className="mx-auto text-[#C7C7CC] mb-2" />
                <p className="text-[14px] text-[#8E8E93]">No favourites yet.</p>
                <p className="text-[12px] text-[#C7C7CC] mt-1">Tap ★ next to a contact in New Call to add.</p>
              </div>
            ) : (
              <div className="flex gap-4 px-4 py-3 overflow-x-auto">
                {favoriteContacts.map(c => (
                  <div key={c.peerAddress} className="flex flex-col items-center gap-1.5 shrink-0">
                    <div
                      className="w-[54px] h-[54px] rounded-full flex items-center justify-center text-white font-bold text-lg cursor-pointer"
                      style={{ background: avatarColor(c.peerAddress) }}
                      onClick={() => onOpenChat(c.peerAddress)}
                    >
                      {initials(c.name, c.peerAddress)}
                    </div>
                    <p className="text-[11px] text-[#1C1C1E] font-medium max-w-[60px] truncate text-center">
                      {c.name || shortAddr(c.peerAddress)}
                    </p>
                  </div>
                ))}
              </div>
            )}
          </motion.div>
        )}
      </AnimatePresence>

      {/* Recent Calls */}
      <div className="bg-white flex-1">
        <div className="px-4 py-2">
          <p className="text-[13px] font-semibold uppercase tracking-wider text-[#6D6D72]">Recent</p>
        </div>

        {callHistory.length === 0 ? (
          <div className="py-16 flex flex-col items-center gap-3 px-8">
            <div className="w-16 h-16 rounded-full bg-[#F2F2F7] flex items-center justify-center">
              <Phone size={28} className="text-[#8E8E93]" />
            </div>
            <p className="text-[15px] font-semibold text-[#1C1C1E] text-center">No Recent Calls</p>
            <p className="text-[13px] text-[#8E8E93] text-center">Your recent calls will appear here.</p>
            <button
              onClick={() => setShowNewCall(true)}
              className="mt-2 px-6 py-3 bg-[#25D366] text-white font-bold rounded-2xl text-[15px]"
            >
              Start a Call
            </button>
          </div>
        ) : callHistory.map((call) => (
          <button
            key={call.id}
            onClick={() => onOpenChat(call.peerAddress)}
            className="w-full flex items-center gap-3 px-4 py-3 border-b border-black/[0.04] hover:bg-[#F9F9F9] text-left active:bg-[#F2F2F7]"
          >
            <div className="w-[46px] h-[46px] rounded-full flex items-center justify-center text-white font-bold text-lg shrink-0"
              style={{ background: avatarColor(call.peerAddress) }}>
              {initials(call.peerName, call.peerAddress)}
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-[16px] font-semibold text-[#1C1C1E] truncate">{call.peerName || shortAddr(call.peerAddress)}</p>
              <div className="flex items-center gap-1.5 mt-0.5">
                {call.missed ? <PhoneMissed size={13} className="text-[#FF3B30]" /> :
                  call.direction === 'incoming' ? <PhoneIncoming size={13} className="text-[#34C759]" /> :
                  <PhoneOutgoing size={13} className="text-[#25D366]" />}
                <span className={`text-[13px] ${call.missed ? 'text-[#FF3B30]' : 'text-[#8E8E93]'}`}>
                  {call.missed ? 'Missed' : call.direction === 'incoming' ? 'Incoming' : 'Outgoing'}
                  {call.type === 'video' ? ' Video' : ''}
                  {call.duration ? ` · ${formatDuration(call.duration)}` : ''}
                </span>
              </div>
            </div>
            <div className="flex flex-col items-end gap-1.5 shrink-0">
              <span className="text-[12px] text-[#8E8E93]">{formatTime(call.timestamp)}</span>
              <button
                onClick={e => { e.stopPropagation(); onStartCall(call.peerAddress, call.type); }}
                className="w-8 h-8 rounded-full bg-[#25D366]/10 flex items-center justify-center"
              >
                {call.type === 'video' ? <Video size={15} className="text-[#25D366]" /> : <Phone size={15} className="text-[#25D366]" />}
              </button>
            </div>
          </button>
        ))}

        <div className="px-4 py-6 flex items-center justify-center gap-2">
          <Lock size={12} className="text-[#8E8E93]" />
          <p className="text-[12px] text-[#8E8E93] text-center">Your calls are end-to-end encrypted</p>
        </div>
      </div>

      {/* New Call Modal — full-screen contact picker */}
      <AnimatePresence>
        {showNewCall && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 bg-black/40 flex items-end md:items-center justify-center"
            onClick={() => setShowNewCall(false)}
          >
            <motion.div
              initial={{ y: 60, opacity: 0 }}
              animate={{ y: 0, opacity: 1 }}
              exit={{ y: 60, opacity: 0 }}
              transition={{ type: 'spring', damping: 28, stiffness: 320 }}
              onClick={e => e.stopPropagation()}
              className="bg-white w-full max-w-md rounded-t-3xl md:rounded-3xl overflow-hidden shadow-2xl max-h-[85vh] flex flex-col"
            >
              {/* Header */}
              <div className="flex items-center justify-between px-5 py-4 border-b border-black/[0.06]">
                <h2 className="text-[17px] font-black text-[#1C1C1E]">New Call</h2>
                <button onClick={() => setShowNewCall(false)} className="w-8 h-8 rounded-full bg-black/5 flex items-center justify-center">
                  <X size={16} />
                </button>
              </div>

              {/* Search */}
              <div className="px-4 py-3 border-b border-black/[0.04]">
                <div className="flex items-center gap-2 bg-[#F2F2F7] rounded-xl px-3 py-2.5">
                  <Search size={16} className="text-[#8E8E93] shrink-0" />
                  <input
                    autoFocus
                    value={contactSearch}
                    onChange={e => setContactSearch(e.target.value)}
                    placeholder="Search contacts..."
                    className="flex-1 bg-transparent text-[15px] outline-none text-[#1C1C1E] placeholder:text-[#8E8E93]"
                  />
                </div>
              </div>

              {/* Contact list */}
              <div className="flex-1 overflow-y-auto">
                {filteredContacts.length === 0 ? (
                  <div className="py-12 flex flex-col items-center gap-2 px-6">
                    <Search size={32} className="text-[#C7C7CC]" />
                    <p className="text-[14px] text-[#8E8E93] text-center">
                      {contacts.length === 0 ? 'No contacts yet. Send someone a message first.' : 'No contacts match.'}
                    </p>
                  </div>
                ) : filteredContacts.map(c => (
                  <div
                    key={c.peerAddress}
                    className="flex items-center gap-3 px-4 py-3 border-b border-black/[0.04] hover:bg-[#F9F9F9]"
                  >
                    <div
                      className="w-[46px] h-[46px] rounded-full flex items-center justify-center text-white font-bold text-lg shrink-0"
                      style={{ background: avatarColor(c.peerAddress) }}
                    >
                      {initials(c.name, c.peerAddress)}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-[15px] font-semibold text-[#1C1C1E] truncate">{c.name || shortAddr(c.peerAddress)}</p>
                      <p className="text-[12px] text-[#8E8E93] truncate">{shortAddr(c.peerAddress)}</p>
                    </div>
                    {/* Actions: Message, Voice, Video, Favourite */}
                    <div className="flex items-center gap-2 shrink-0">
                      <button
                        onClick={() => { onOpenChat(c.peerAddress); setShowNewCall(false); }}
                        className="w-9 h-9 rounded-full bg-black/5 flex items-center justify-center hover:bg-black/10"
                        title="Message"
                      >
                        <MessageCircle size={17} className="text-[#1C1C1E]" />
                      </button>
                      <button
                        onClick={() => { onStartCall(c.peerAddress, 'voice'); setShowNewCall(false); }}
                        className="w-9 h-9 rounded-full bg-[#34C759]/10 flex items-center justify-center hover:bg-[#34C759]/20"
                        title="Voice Call"
                      >
                        <Phone size={17} className="text-[#34C759]" />
                      </button>
                      <button
                        onClick={() => { onStartCall(c.peerAddress, 'video'); setShowNewCall(false); }}
                        className="w-9 h-9 rounded-full bg-[#25D366]/10 flex items-center justify-center hover:bg-[#25D366]/20"
                        title="Video Call"
                      >
                        <Video size={17} className="text-[#25D366]" />
                      </button>
                      <button
                        onClick={() => toggleFavorite(c.peerAddress)}
                        className="w-9 h-9 rounded-full flex items-center justify-center"
                        title="Favourite"
                      >
                        <Star
                          size={17}
                          className={favorites.includes(c.peerAddress.toLowerCase()) ? 'text-[#FF9500] fill-[#FF9500]' : 'text-[#C7C7CC]'}
                        />
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};
