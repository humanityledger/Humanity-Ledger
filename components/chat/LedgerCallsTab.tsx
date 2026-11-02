'use client';
import React, { useState } from 'react';
import {
  Phone, Video, Star, PhoneIncoming, PhoneOutgoing, PhoneMissed, Lock, Plus, MessageCircle,
} from 'lucide-react';
import { PeerAvatar, SectionLabel, EmptyState, PrimaryButton, IconButton, SearchField, Sheet, shortAddr } from './ui/kit';

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

const formatDuration = (seconds: number) => {
  if (seconds < 60) return `${seconds} s`;
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  const s = String(seconds % 60).padStart(2, '0');
  return h > 0 ? `${h}:${String(m).padStart(2, '0')}:${s}` : `${m}:${s}`;
};

const formatTime = (ts: number) => {
  const d = new Date(ts);
  const now = new Date();
  const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime();
  if (ts >= startOfToday) return d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  if (ts >= startOfToday - 86400000) return 'Yesterday';
  return d.toLocaleDateString([], { month: 'short', day: 'numeric' });
};

const getFavorites = (): string[] => {
  try { return JSON.parse(localStorage.getItem('ledger_call_favorites') || '[]'); } catch { return []; }
};
const saveFavorites = (favs: string[]) => {
  try { localStorage.setItem('ledger_call_favorites', JSON.stringify(favs)); } catch {}
};

export const LedgerCallsTab: React.FC<LedgerCallsTabProps> = ({ callHistory, contacts, onStartCall, onOpenChat }) => {
  const [showNewCall, setShowNewCall] = useState(false);
  const [contactSearch, setContactSearch] = useState('');
  const [favorites, setFavorites] = useState<string[]>(getFavorites);

  const nameOf = (addr: string, fallback?: string) =>
    fallback || contacts.find(c => c.peerAddress.toLowerCase() === addr.toLowerCase())?.name || shortAddr(addr);

  const q = contactSearch.trim().toLowerCase();
  const filteredContacts = contacts.filter(c => !q || c.name?.toLowerCase().includes(q) || c.peerAddress.toLowerCase().includes(q));
  const favoriteContacts = contacts.filter(c => favorites.includes(c.peerAddress.toLowerCase()));

  const toggleFavorite = (addr: string) => {
    const key = addr.toLowerCase();
    const next = favorites.includes(key) ? favorites.filter(f => f !== key) : [...favorites, key];
    setFavorites(next);
    saveFavorites(next);
  };

  return (
    <div className="flex-1 overflow-y-auto flex flex-col bg-white">
      <div className="px-4 pt-3 pb-1">
        <button
          type="button"
          onClick={() => setShowNewCall(true)}
          className="w-full flex items-center gap-3 px-3 py-2.5 rounded-xl hover:bg-[#f7f8fa] transition-colors text-left"
        >
          <span className="w-11 h-11 rounded-full bg-[#15171c] text-white flex items-center justify-center shrink-0" aria-hidden="true">
            <Plus size={20} strokeWidth={2} />
          </span>
          <span className="text-[15.5px] font-medium text-[#15171c]">New call</span>
        </button>
      </div>

      {favoriteContacts.length > 0 && (
        <>
          <SectionLabel>Favourites</SectionLabel>
          <div className="flex gap-4 px-4 pb-2 overflow-x-auto">
            {favoriteContacts.map(c => (
              <button
                type="button"
                key={c.peerAddress}
                onClick={() => onStartCall(c.peerAddress, 'voice')}
                className="flex flex-col items-center gap-1.5 shrink-0 w-16"
                aria-label={`Call ${c.name || shortAddr(c.peerAddress)}`}
              >
                <PeerAvatar address={c.peerAddress} name={c.name} size={52} />
                <span className="text-[12.5px] text-[#15171c] max-w-full truncate">{c.name || shortAddr(c.peerAddress)}</span>
              </button>
            ))}
          </div>
        </>
      )}

      <SectionLabel>Recent</SectionLabel>
      {callHistory.length === 0 ? (
        <EmptyState
          icon={<Phone size={20} strokeWidth={1.8} />}
          title="No calls yet"
          text="Calls you make and receive will show up here."
          action={<PrimaryButton onClick={() => setShowNewCall(true)}>Start a call</PrimaryButton>}
        />
      ) : (
        <ul className="px-2">
          {callHistory.map(call => {
            const label = call.missed ? 'Missed' : call.direction === 'incoming' ? 'Incoming' : 'Outgoing';
            const DirIcon = call.missed ? PhoneMissed : call.direction === 'incoming' ? PhoneIncoming : PhoneOutgoing;
            return (
              <li key={call.id}>
                <div className="flex items-center gap-3 px-2 py-2 rounded-xl hover:bg-[#f7f8fa] transition-colors">
                  <button type="button" onClick={() => onOpenChat(call.peerAddress)} className="flex items-center gap-3 flex-1 min-w-0 text-left">
                    <PeerAvatar address={call.peerAddress} name={call.peerName} size={44} />
                    <span className="flex-1 min-w-0">
                      <span className={`block text-[15.5px] font-medium truncate ${call.missed ? 'text-[#d93036]' : 'text-[#15171c]'}`}>
                        {nameOf(call.peerAddress, call.peerName)}
                      </span>
                      <span className="flex items-center gap-1.5 mt-0.5 text-[13.5px] text-[#727a88]">
                        <DirIcon size={13} strokeWidth={2} className={call.missed ? 'text-[#d93036]' : 'text-[#727a88]'} aria-hidden="true" />
                        <span>{label} {call.type === 'video' ? 'video call' : 'call'}</span>
                        {call.duration ? <span className="tabular-nums">, {formatDuration(call.duration)}</span> : null}
                      </span>
                    </span>
                  </button>
                  <span className="text-[13px] text-[#a3a9b4] tabular-nums shrink-0">{formatTime(call.timestamp)}</span>
                  <IconButton
                    label={call.type === 'video' ? 'Video call' : 'Voice call'}
                    onClick={() => onStartCall(call.peerAddress, call.type)}
                  >
                    {call.type === 'video' ? <Video size={18} strokeWidth={1.8} /> : <Phone size={18} strokeWidth={1.8} />}
                  </IconButton>
                </div>
              </li>
            );
          })}
        </ul>
      )}

      <p className="mt-auto px-4 py-6 flex items-center justify-center gap-1.5 text-[13px] text-[#a3a9b4]">
        <Lock size={12} strokeWidth={2} aria-hidden="true" /> Calls are encrypted end to end
      </p>

      <Sheet open={showNewCall} onClose={() => setShowNewCall(false)} title="New call">
        <div className="px-4 pb-2">
          <SearchField value={contactSearch} onChange={setContactSearch} placeholder="Search contacts" autoFocus />
        </div>
        {filteredContacts.length === 0 ? (
          <EmptyState
            icon={<MessageCircle size={20} strokeWidth={1.8} />}
            title={contacts.length === 0 ? 'No contacts yet' : 'No matches'}
            text={contacts.length === 0 ? 'Send someone a message first, then you can call them from here.' : 'Try another name or address.'}
          />
        ) : (
          <ul className="px-2 pb-3">
            {filteredContacts.map(c => {
              const fav = favorites.includes(c.peerAddress.toLowerCase());
              return (
                <li key={c.peerAddress} className="flex items-center gap-3 px-2 py-2 rounded-xl hover:bg-[#f7f8fa]">
                  <PeerAvatar address={c.peerAddress} name={c.name} size={42} />
                  <span className="flex-1 min-w-0">
                    <span className="block text-[15px] font-medium text-[#15171c] truncate">{c.name || shortAddr(c.peerAddress)}</span>
                    <span className="block text-[13px] text-[#727a88] truncate tabular-nums">{shortAddr(c.peerAddress)}</span>
                  </span>
                  <IconButton label="Message" onClick={() => { onOpenChat(c.peerAddress); setShowNewCall(false); }}>
                    <MessageCircle size={18} strokeWidth={1.8} />
                  </IconButton>
                  <IconButton label="Voice call" onClick={() => { onStartCall(c.peerAddress, 'voice'); setShowNewCall(false); }}>
                    <Phone size={18} strokeWidth={1.8} />
                  </IconButton>
                  <IconButton label="Video call" onClick={() => { onStartCall(c.peerAddress, 'video'); setShowNewCall(false); }}>
                    <Video size={18} strokeWidth={1.8} />
                  </IconButton>
                  <IconButton label={fav ? 'Remove from favourites' : 'Add to favourites'} onClick={() => toggleFavorite(c.peerAddress)} aria-pressed={fav}>
                    <Star size={18} strokeWidth={1.8} className={fav ? 'fill-[#15171c]' : 'text-[#a3a9b4]'} />
                  </IconButton>
                </li>
              );
            })}
          </ul>
        )}
      </Sheet>
    </div>
  );
};
