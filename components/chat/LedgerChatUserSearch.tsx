"use client";

import React, { useState, useEffect, useRef, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Search, X, UserPlus, ShieldCheck, MapPin, Check, Clock, MessageCircle } from 'lucide-react';
import { getLocalContacts, saveLocalContact } from '@/lib/wallet/localAddressBook';
import { toast } from 'sonner';

interface LedgerChatUserSearchProps {
  myAddress: string;
  onClose: () => void;
  onAddContact: (address: string) => void;
}

interface SearchUser {
  address: string;
  nickname: string;
  name: string;
  country: string;
  isVerified?: boolean;
  tier?: string;
}

type RequestStatus = 'none' | 'sending' | 'pending' | 'accepted';

const TIER_BADGE: Record<string, { label: string; color: string }> = {
  GENESIS:    { label: 'Genesis',    color: 'text-purple-600 bg-purple-50 border-purple-200' },
  SOVEREIGN:  { label: 'Sovereign',  color: 'text-indigo-600 bg-indigo-50 border-indigo-200' },
  AMBASSADOR: { label: 'Ambassador', color: 'text-amber-600 bg-amber-50 border-amber-200' },
  PRO:        { label: 'Pro',        color: 'text-emerald-600 bg-emerald-50 border-emerald-200' },
  EXPLORER:   { label: 'Explorer',   color: 'text-gray-500 bg-gray-50 border-gray-200' },
};

export function LedgerChatUserSearch({ myAddress, onClose, onAddContact }: LedgerChatUserSearchProps) {
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<SearchUser[]>([]);
  const [isSearching, setIsSearching] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [requestStatuses, setRequestStatuses] = useState<Record<string, RequestStatus>>({});
  const inputRef = useRef<HTMLInputElement>(null);
  const abortRef = useRef<AbortController | null>(null);

  useEffect(() => {
    inputRef.current?.focus();
  }, []);

  const performSearch = useCallback(async (q: string) => {
    if (!q) {
      setResults([]);
      setIsSearching(false);
      return;
    }

    abortRef.current?.abort();
    abortRef.current = new AbortController();

    setIsSearching(true);
    setError(null);

    try {
      const res = await fetch(
        `/api/chat/users/search?q=${encodeURIComponent(q)}`,
        { signal: abortRef.current.signal }
      );

      if (!res.ok) throw new Error('Search failed');

      const data = await res.json();
      // Filter out self
      const filtered = (data.users ?? []).filter(
        (u: SearchUser) => u.address.toLowerCase() !== myAddress?.toLowerCase()
      );
      setResults(filtered);
    } catch (err: any) {
      if (err.name === 'AbortError') return;
      setError('Search unavailable — check your connection.');
      setResults([]);
    } finally {
      setIsSearching(false);
    }
  }, [myAddress]);

  useEffect(() => {
    const timer = setTimeout(() => performSearch(query), 400);
    return () => clearTimeout(timer);
  }, [query, performSearch]);

  // Send a contact request (Instagram-style)
  const handleSendRequest = async (user: SearchUser) => {
    const addr = user.address.toLowerCase();
    setRequestStatuses(prev => ({ ...prev, [addr]: 'sending' }));

    try {
      const res = await fetch('/api/chat/contacts/request', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'x-web3-address': myAddress },
        body: JSON.stringify({ toAddress: addr }),
      });
      const data = await res.json();

      if (!res.ok) {
        toast.error(data.error || 'Could not send request');
        setRequestStatuses(prev => ({ ...prev, [addr]: 'none' }));
        return;
      }

      if (data.status === 'ALREADY_CONNECTED') {
        // Already contacts — open chat immediately
        saveLocalContact(myAddress, { peerAddress: addr, name: user.nickname || user.name, avatar: '' });
        onAddContact(addr);
        onClose();
        return;
      }

      if (data.status === 'SENT' || data.status === 'ALREADY_PENDING') {
        setRequestStatuses(prev => ({ ...prev, [addr]: 'pending' }));
        toast.success(data.status === 'ALREADY_PENDING'
          ? 'Request already sent — waiting for them to accept.'
          : `Request sent to ${user.nickname || user.name}!`
        );
      }
    } catch {
      toast.error('Network error — please try again.');
      setRequestStatuses(prev => ({ ...prev, [addr]: 'none' }));
    }
  };

  const tierInfo = (tier?: string) => TIER_BADGE[tier ?? 'EXPLORER'] ?? TIER_BADGE.EXPLORER;

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="fixed inset-0 z-[100000] bg-black/60 backdrop-blur-md flex items-center justify-center p-4"
      onClick={onClose}
    >
      <motion.div
        initial={{ scale: 0.95, y: 20 }}
        animate={{ scale: 1, y: 0 }}
        exit={{ scale: 0.95, y: 20 }}
        onClick={e => e.stopPropagation()}
        className="w-full max-w-lg bg-white rounded-[32px] overflow-hidden shadow-2xl flex flex-col max-h-[80vh]"
      >
        {/* Header Search Bar */}
        <div className="p-6 border-b border-black/5 bg-[#f9f9fb] flex flex-col gap-4">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-xl font-black text-black">Find People</h2>
              <p className="text-[12px] text-black/40 mt-0.5">Search by @username or 0x wallet address</p>
            </div>
            <button onClick={onClose} className="p-2 hover:bg-black/5 rounded-full transition-colors">
              <X size={20} className="text-black/50" />
            </button>
          </div>

          <div className="relative">
            <Search size={18} className="absolute left-4 top-1/2 -translate-y-1/2 text-[#25D366]" />
            <input
              ref={inputRef}
              type="text"
              value={query}
              onChange={e => setQuery(e.target.value)}
              placeholder="@username or 0x address..."
              className="w-full bg-white border-2 border-[#25D366]/20 focus:border-[#25D366] rounded-2xl py-3.5 pl-11 pr-4 text-[16px] font-semibold text-black outline-none transition-all shadow-sm placeholder:font-normal placeholder:text-black/35"
            />
            {query.length > 0 && (
              <button
                onClick={() => setQuery('')}
                className="absolute right-3 top-1/2 -translate-y-1/2 p-1 rounded-full hover:bg-black/5 transition-colors"
              >
                <X size={14} className="text-black/40" />
              </button>
            )}
          </div>
        </div>

        {/* Results Area */}
        <div className="flex-1 overflow-y-auto bg-white min-h-[280px]">
          <AnimatePresence mode="wait">
            {isSearching ? (
              <motion.div
                key="loading"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                className="h-full flex flex-col items-center justify-center gap-4 text-[#25D366] p-8"
              >
                <div className="w-8 h-8 border-4 border-[#25D366]/20 border-t-[#25D366] rounded-full animate-spin" />
                <p className="text-[13px] font-semibold text-black/40">Searching network...</p>
              </motion.div>
            ) : error ? (
              <motion.div
                key="error"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                className="h-full flex flex-col items-center justify-center gap-3 p-8 text-center"
              >
                <span className="text-3xl">⚠️</span>
                <p className="text-[13px] font-medium text-red-500">{error}</p>
              </motion.div>
            ) : query.length === 0 ? (
              <motion.div
                key="empty"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                className="h-full flex flex-col items-center justify-center gap-3 text-black/30 p-8 text-center"
              >
                <Search size={44} className="opacity-20" />
                <p className="text-[14px] font-medium">Type a name or address to search the network.</p>
                <p className="text-[12px] text-black/25">You can search with <strong className="font-semibold">@username</strong> or paste a wallet address.</p>
              </motion.div>
            ) : results.length === 0 ? (
              <motion.div
                key="no-results"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                className="h-full flex flex-col items-center justify-center gap-3 p-8 text-center"
              >
                <span className="text-4xl">🐋</span>
                <p className="text-[14px] font-medium text-black/50">No users found for "<strong>{query}</strong>"</p>
                <p className="text-[12px] text-black/30">Try searching by wallet address (0x...) or exact username.</p>
              </motion.div>
            ) : (
              <motion.div
                key="results"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                className="p-4 space-y-2"
              >
                {results.map(user => {
                  const tier = tierInfo(user.tier);
                  const initials = user.nickname.replace('@', '').slice(0, 2).toUpperCase();
                  const hue = parseInt(user.address.slice(2, 8), 16) % 360;
                  const addr = user.address.toLowerCase();
                  const reqStatus = requestStatuses[addr] ?? 'none';

                  return (
                    <div
                      key={user.address}
                      className="flex items-center justify-between p-4 rounded-2xl border border-black/[0.06] hover:border-[#25D366]/30 hover:bg-[#25D366]/[0.03] transition-all group"
                    >
                      <div className="flex items-center gap-3 min-w-0">
                        {/* Avatar */}
                        <div
                          className="w-11 h-11 rounded-full flex items-center justify-center text-white font-black text-[15px] shadow-sm shrink-0"
                          style={{ background: `hsl(${hue},60%,48%)` }}
                        >
                          {initials}
                        </div>
                        <div className="flex flex-col min-w-0">
                          <div className="flex items-center gap-1.5">
                            <span className="text-[15px] font-bold text-black truncate">{user.nickname}</span>
                            {user.isVerified && (
                              <div title="ZK Verified">
                                <ShieldCheck size={13} className="text-[#30d158] shrink-0" />
                              </div>
                            )}
                          </div>
                          <div className="flex items-center gap-2 mt-0.5">
                            {user.country && user.country !== 'Unknown' && (
                              <span className="flex items-center gap-0.5 text-[11px] text-black/40">
                                <MapPin size={9} />
                                {user.country}
                              </span>
                            )}
                            <span className={`text-[9px] font-bold uppercase tracking-wide px-1.5 py-0.5 rounded border ${tier.color}`}>
                              {tier.label}
                            </span>
                          </div>
                        </div>
                      </div>

                      {/* Dynamic action button */}
                      {reqStatus === 'accepted' ? (
                        <button
                          onClick={() => { onAddContact(user.address); onClose(); }}
                          className="flex items-center gap-1.5 px-3.5 py-2 bg-[#30d158] text-white rounded-full font-bold text-[12px] shadow-sm shrink-0 ml-2"
                        >
                          <MessageCircle size={14} />
                          <span>Message</span>
                        </button>
                      ) : reqStatus === 'pending' ? (
                        <div className="flex items-center gap-1.5 px-3.5 py-2 bg-zinc-100 text-zinc-500 rounded-full font-bold text-[12px] shrink-0 ml-2">
                          <Clock size={14} />
                          <span>Pending</span>
                        </div>
                      ) : reqStatus === 'sending' ? (
                        <div className="flex items-center gap-1.5 px-3.5 py-2 bg-[#25D366]/10 text-[#25D366] rounded-full font-bold text-[12px] shrink-0 ml-2">
                          <div className="w-3 h-3 border-2 border-[#25D366]/30 border-t-[#25D366] rounded-full animate-spin" />
                          <span>Sending...</span>
                        </div>
                      ) : (
                        <button
                          onClick={() => handleSendRequest(user)}
                          className="flex items-center gap-1.5 px-3.5 py-2 bg-[#25D366] hover:bg-emerald-600 text-white rounded-full font-bold text-[12px] transition-colors shadow-sm shrink-0 ml-2"
                        >
                          <UserPlus size={14} />
                          <span>Connect</span>
                        </button>
                      )}
                    </div>
                  );
                })}
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </motion.div>
    </motion.div>
  );
}

