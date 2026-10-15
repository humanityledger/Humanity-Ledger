'use client';

import React, { useState, useEffect, useRef, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { X, Search, Lock, CheckCircle, Clock, Users, Star } from 'lucide-react';
import { formatZkTag, resolveIdentity, ZkIdentityRecord } from '@/lib/zk/zkMoney';
import { getAllIdentities, getRecentContacts, resolveDisplayName, getAvatarColor, getInitials, ZkIdentity } from '@/lib/zk/zkIdentity';

// ─── Props ─────────────────────────────────────────────────────────────────────

interface ZkRecipientPickerProps {
  senderAddress: string;
  onSelect: (handle: string, identity?: ZkIdentity | null) => void;
  onClose: () => void;
}

// ─── Contact Row ───────────────────────────────────────────────────────────────

function ContactRow({
  identity,
  onSelect,
  verified,
}: {
  key?: React.Key;
  identity: ZkIdentity;
  onSelect: () => void;
  verified?: boolean;
}) {
  const color    = getAvatarColor(identity.address);
  const initials = getInitials(identity);

  return (
    <button
      onClick={onSelect}
      className="w-full flex items-center gap-3 px-4 py-3 hover:bg-[#f0f2f5] transition-colors text-left"
    >
      <div
        className="w-10 h-10 rounded-full flex items-center justify-center text-white font-bold text-sm flex-shrink-0"
        style={{ background: color }}
      >
        {initials}
      </div>
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-1.5">
          <span className="font-semibold text-gray-900 text-[14px] truncate">
            {identity.displayName || identity.zkHandle}
          </span>
          {identity.verified && (
            <CheckCircle size={12} className="text-[#1C1C1E] flex-shrink-0" strokeWidth={2.5} />
          )}
        </div>
        <div className="text-[11px] text-gray-400 truncate">{identity.zkHandle}</div>
      </div>
      <div className="flex flex-col items-end gap-1 flex-shrink-0">
        <div className="flex items-center gap-1">
          <Star size={9} className="text-yellow-400" fill="#FACC15" />
          <span className="text-[10px] text-gray-400">{identity.reputationScore}</span>
        </div>
        {identity.totalTransactions > 0 && (
          <span className="text-[9px] text-gray-300">{identity.totalTransactions} txs</span>
        )}
      </div>
    </button>
  );
}

// ─── Main Component ────────────────────────────────────────────────────────────

export function ZkRecipientPicker({ senderAddress, onSelect, onClose }: ZkRecipientPickerProps) {
  const [tab,           setTab]           = useState<'contacts' | 'recent' | 'search'>('contacts');
  const [query,         setQuery]         = useState('');
  const [searching,     setSearching]     = useState(false);
  const [searchResult,  setSearchResult]  = useState<ZkIdentityRecord | null | 'not-found'>('not-found');
  const [contacts,      setContacts]      = useState<ZkIdentity[]>([]);
  const [recents,       setRecents]       = useState<ZkIdentity[]>([]);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    const all = getAllIdentities().filter(i => i.address !== senderAddress.toLowerCase());
    setContacts(all);
    setRecents(getRecentContacts(senderAddress, 10));
  }, [senderAddress]);

  useEffect(() => {
    if (tab === 'search') {
      setTimeout(() => inputRef.current?.focus(), 100);
    }
  }, [tab]);

  const doSearch = useCallback(async (q: string) => {
    if (!q.trim()) { setSearchResult('not-found'); return; }
    setSearching(true);
    try {
      const result = await resolveIdentity(q.trim());
      setSearchResult(result ?? 'not-found');
    } catch {
      setSearchResult('not-found');
    } finally {
      setSearching(false);
    }
  }, []);

  useEffect(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current);
    if (!query.trim()) { setSearchResult('not-found'); return; }
    debounceRef.current = setTimeout(() => doSearch(query), 300);
    return () => { if (debounceRef.current) clearTimeout(debounceRef.current); };
  }, [query, doSearch]);

  // Escape to close
  useEffect(() => {
    const handler = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [onClose]);

  const isValidAddress = /^0x[0-9a-fA-F]{40}$/.test(query.trim());
  const isValidHandle  = /^zk:[a-z0-9_.-]{3,32}$/.test(query.trim());

  const tabs: Array<{ id: 'contacts' | 'recent' | 'search'; label: string; icon: React.ElementType }> = [
    { id: 'contacts', label: 'Contacts',  icon: Users  },
    { id: 'recent',   label: 'Recent',    icon: Clock  },
    { id: 'search',   label: 'Search',    icon: Search },
  ];

  return (
    <div
      className="fixed inset-0 z-50 flex items-end sm:items-center justify-center"
      style={{ backdropFilter: 'blur(8px)', background: 'rgba(0,0,0,0.45)' }}
      onClick={onClose}
    >
      <motion.div
        initial={{ opacity: 0, y: 56, scale: 0.95 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        exit={{ opacity: 0, y: 56, scale: 0.95 }}
        transition={{ type: 'spring', stiffness: 340, damping: 30 }}
        className="bg-white w-full max-w-md rounded-t-3xl sm:rounded-3xl overflow-hidden shadow-2xl"
        style={{ maxHeight: '80vh', display: 'flex', flexDirection: 'column' }}
        onClick={e => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center gap-3 px-5 py-4 border-b border-black/[0.06] flex-shrink-0">
          <Lock size={18} className="text-[#1C1C1E]" strokeWidth={2} />
          <h2 className="font-bold text-gray-900 text-[16px] flex-1">Select Recipient</h2>
          <button onClick={onClose} className="w-8 h-8 flex items-center justify-center rounded-full bg-black/5">
            <X size={15} className="text-gray-600" />
          </button>
        </div>

        {/* Tabs */}
        <div className="flex gap-1 px-4 py-3 bg-[#f0f2f5] flex-shrink-0">
          {tabs.map(({ id, label, icon: Icon }) => (
            <button
              key={id}
              onClick={() => setTab(id)}
              className="flex-1 flex items-center justify-center gap-1.5 py-2 rounded-xl text-[12px] font-semibold transition-all"
              style={{
                background: tab === id ? '#fff' : 'transparent',
                color: tab === id ? '#1C1C1E' : '#9CA3AF',
                boxShadow: tab === id ? '0 1px 4px rgba(0,0,0,0.08)' : 'none',
              }}
            >
              <Icon size={12} />
              {label}
            </button>
          ))}
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto overscroll-contain">
          <AnimatePresence mode="wait">
            {/* Contacts */}
            {tab === 'contacts' && (
              <motion.div key="contacts" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
                {contacts.length === 0 ? (
                  <div className="py-12 flex flex-col items-center gap-3 text-gray-400">
                    <Users size={32} strokeWidth={1.5} className="text-gray-300" />
                    <span className="text-[13px]">No contacts yet</span>
                    <span className="text-[11px] text-gray-300 text-center max-w-[180px]">
                      Contacts appear when someone registers their zk identity
                    </span>
                  </div>
                ) : (
                  <div className="divide-y divide-black/[0.04]">
                    {contacts.map(c => (
                      <ContactRow
                        key={c.address}
                        identity={c}
                        onSelect={() => onSelect(c.zkHandle, c)}
                      />
                    ))}
                  </div>
                )}
              </motion.div>
            )}

            {/* Recent */}
            {tab === 'recent' && (
              <motion.div key="recent" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
                {recents.length === 0 ? (
                  <div className="py-12 flex flex-col items-center gap-3 text-gray-400">
                    <Clock size={32} strokeWidth={1.5} className="text-gray-300" />
                    <span className="text-[13px]">No recent contacts</span>
                  </div>
                ) : (
                  <div className="divide-y divide-black/[0.04]">
                    {recents.map(c => (
                      <ContactRow
                        key={c.address}
                        identity={c}
                        onSelect={() => onSelect(c.zkHandle, c)}
                      />
                    ))}
                  </div>
                )}
              </motion.div>
            )}

            {/* Search */}
            {tab === 'search' && (
              <motion.div key="search" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="p-4 space-y-4">
                {/* Search input */}
                <div className="relative">
                  <Search size={15} className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400" />
                  <input
                    ref={inputRef}
                    type="text"
                    placeholder="zk:handle or 0x address…"
                    value={query}
                    onChange={e => setQuery(e.target.value)}
                    className="w-full bg-[#f0f2f5] rounded-2xl pl-10 pr-4 py-3 text-[14px] text-gray-900 outline-none border-2 border-transparent focus:border-[#1C1C1E] transition-colors"
                  />
                </div>

                {/* Search results */}
                {searching && (
                  <div className="flex items-center gap-2 text-[12px] text-gray-400">
                    <motion.div
                      className="w-3 h-3 border-2 border-[#1C1C1E] border-t-transparent rounded-full"
                      animate={{ rotate: 360 }}
                      transition={{ duration: 0.8, repeat: Infinity, ease: 'linear' }}
                    />
                    Resolving identity…
                  </div>
                )}

                {!searching && query && searchResult && searchResult !== 'not-found' && (
                  <div className="bg-[#f0f2f5] rounded-2xl overflow-hidden">
                    <div className="px-4 py-2 bg-[#1C1C1E]/10 border-b border-[#1C1C1E]/20 flex items-center gap-1.5">
                      <CheckCircle size={12} className="text-[#1C1C1E]" />
                      <span className="text-[11px] text-[#1C1C1E] font-semibold">Verified by Humanity Ledger</span>
                    </div>
                    <button
                      onClick={() => onSelect(searchResult.zkHandle, null)}
                      className="w-full flex items-center gap-3 px-4 py-3 hover:bg-black/5 transition-colors text-left"
                    >
                      <div
                        className="w-10 h-10 rounded-full flex items-center justify-center text-white font-bold"
                        style={{ background: '#1C1C1E' }}
                      >
                        {searchResult.zkHandle.slice(3, 5).toUpperCase()}
                      </div>
                      <div>
                        <div className="font-semibold text-gray-900 text-[14px]">{searchResult.zkHandle}</div>
                        <div className="text-[11px] text-gray-400">{searchResult.aztecAddress?.slice(0, 20)}…</div>
                      </div>
                    </button>
                  </div>
                )}

                {!searching && query && (searchResult === 'not-found' || !searchResult) && isValidAddress && (
                  <div className="space-y-2">
                    <div className="flex items-center gap-2 text-[11px] text-gray-400 bg-[#f0f2f5] rounded-xl px-3 py-2">
                      <Lock size={11} />
                      Unknown address — will derive Aztec handle automatically
                    </div>
                    <button
                      onClick={() => onSelect(formatZkTag(query), null)}
                      className="w-full py-3 rounded-2xl font-semibold text-[14px] text-white"
                      style={{ background: '#1C1C1E' }}
                    >
                      Send to {query.slice(0, 8)}…
                    </button>
                  </div>
                )}

                {!searching && query && (searchResult === 'not-found' || !searchResult) && isValidHandle && !isValidAddress && (
                  <div className="space-y-2">
                    <div className="flex items-center gap-2 text-[11px] text-gray-600 bg-black/[0.04] rounded-xl px-3 py-2">
                      <Lock size={11} />
                      Handle not yet registered — confirm to send anyway
                    </div>
                    <button
                      onClick={() => onSelect(query, null)}
                      className="w-full py-3 rounded-2xl font-semibold text-[14px] text-white"
                      style={{ background: '#1C1C1E' }}
                    >
                      Send to {query}
                    </button>
                  </div>
                )}
              </motion.div>
            )}
          </AnimatePresence>
        </div>

        {/* Footer */}
        <div className="flex-shrink-0 px-5 py-3 border-t border-black/[0.04] bg-[#f0f2f5]">
          <p className="text-center text-[10px] text-gray-400">
            <Lock size={9} className="inline mr-1" />
            Recipients receive payments privately — amounts are hidden on-chain via Aztec
          </p>
        </div>
      </motion.div>
    </div>
  );
}
