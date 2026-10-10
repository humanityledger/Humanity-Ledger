'use client';
import React, { useState, useEffect, useRef, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Heart, Pin, Search, X, Smile, Trash2, Check, ChevronRight,
  MessageSquare, AlertCircle, ChevronDown
} from 'lucide-react';
import { toast } from 'sonner';

// ─── CONSTANTS ────────────────────────────────────────────────────────────────

const EMOJI_LIST = [
  '❤️','🔥','👏','😂','😮','😢','👍','👎','🚀','💯',
  '🎉','😍','🤔','😅','🙌','💪','🌟','✅','❌','🔑',
  '😎','🥳','🤝','👀','💡','⚡','🎯','🏆','💎','🌈',
];

const REACTION_COLORS: Record<string, string> = {
  '❤️': '#FF3B30', '🔥': '#FF9500', '👏': '#FFCC00', '😂': '#34C759',
  '😮': '#007AFF', '😢': '#5856D6', '👍': '#25D366', '🚀': '#AF52DE',
};

// ─── TYPES ────────────────────────────────────────────────────────────────────

interface Reaction {
  emoji: string;
  count: number;
  mine: boolean;
  addresses: string[];
}

interface PinnedMessage {
  id: string;
  content: string;
  authorAddress: string;
  createdAt: string;
  pinnedAt?: string;
  pinnedBy?: string;
}

// ─── EMOJI PICKER ─────────────────────────────────────────────────────────────

function EmojiPickerPopup({ onSelect, onClose }: { onSelect: (e: string) => void; onClose: () => void }) {
  useEffect(() => {
    const h = (e: MouseEvent) => {
      if (!(e.target as Element)?.closest('[data-emoji-picker]')) onClose();
    };
    setTimeout(() => document.addEventListener('mousedown', h), 50);
    return () => document.removeEventListener('mousedown', h);
  }, [onClose]);

  return (
    <motion.div
      data-emoji-picker
      initial={{ opacity: 0, scale: 0.88, y: 6 }}
      animate={{ opacity: 1, scale: 1, y: 0 }}
      exit={{ opacity: 0, scale: 0.88, y: 6 }}
      transition={{ duration: 0.15 }}
      className="absolute bottom-full mb-2 left-0 z-[9999] bg-white/95 backdrop-blur-xl border border-black/8 rounded-2xl shadow-2xl p-2.5"
    >
      <div className="grid grid-cols-6 gap-1">
        {EMOJI_LIST.slice(0, 24).map(emoji => (
          <button
            key={emoji}
            onClick={() => { onSelect(emoji); onClose(); }}
            className="w-9 h-9 rounded-xl flex items-center justify-center text-xl hover:bg-[#F2F2F7] transition-colors active:scale-90"
          >
            {emoji}
          </button>
        ))}
      </div>
    </motion.div>
  );
}

// ─── MESSAGE REACTION BAR ─────────────────────────────────────────────────────

export function MessageReactionBar({
  messageId,
  myAddress,
  communityId,
  isMe = false,
}: {
  messageId: string;
  myAddress: string;
  communityId: string;
  isMe?: boolean;
}) {
  const [reactions, setReactions] = useState<Record<string, Reaction>>({});
  const [showPicker, setShowPicker] = useState(false);
  const [loading, setLoading] = useState<string | null>(null);

  const toggleReaction = useCallback(async (emoji: string) => {
    setLoading(emoji);
    setReactions(prev => {
      const existing = prev[emoji];
      if (existing) {
        if (existing.mine) {
          // Remove
          const newCount = existing.count - 1;
          if (newCount <= 0) {
            const next = { ...prev };
            delete next[emoji];
            return next;
          }
          return { ...prev, [emoji]: { ...existing, count: newCount, mine: false } };
        } else {
          return { ...prev, [emoji]: { ...existing, count: existing.count + 1, mine: true } };
        }
      }
      return { ...prev, [emoji]: { emoji, count: 1, mine: true, addresses: [myAddress] } };
    });

    try {
      await fetch('/api/chat/communities', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json', 'x-web3-address': myAddress, 'x-verified-session-address': myAddress },
        body: JSON.stringify({ action: 'REACT_MESSAGE', messageId, emoji, communityId, walletAddress: myAddress }),
      });
    } catch {
      // Optimistic update stays even on error for better UX
    } finally {
      setLoading(null);
    }
  }, [myAddress, communityId, messageId]);

  const hasReactions = Object.keys(reactions).length > 0;

  return (
    <div className={`flex items-center gap-1 flex-wrap mt-1 relative ${isMe ? 'justify-end' : 'justify-start'}`}>
      <AnimatePresence>
        {Object.values(reactions).map(r => (
          <motion.button
            key={r.emoji}
            initial={{ scale: 0, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            exit={{ scale: 0, opacity: 0 }}
            onClick={() => toggleReaction(r.emoji)}
            className={`flex items-center gap-1 px-2 py-0.5 rounded-full border text-[12px] transition-all active:scale-90 ${
              r.mine
                ? 'bg-[#25D366]/10 border-[#25D366]/40 text-[#25D366]'
                : 'bg-white border-black/10 text-[#1C1C1E] hover:bg-[#F2F2F7]'
            } ${loading === r.emoji ? 'opacity-50' : ''}`}
          >
            <span>{r.emoji}</span>
            <span className="font-bold">{r.count}</span>
          </motion.button>
        ))}
      </AnimatePresence>

      {/* Add reaction button */}
      <div className="relative">
        <button
          onClick={() => setShowPicker(p => !p)}
          className="w-7 h-7 rounded-full border border-black/10 bg-white flex items-center justify-center text-black/30 hover:text-[#25D366] hover:border-[#25D366]/30 hover:bg-[#25D366]/5 transition-all text-[14px]"
        >
          <Smile size={13} />
        </button>
        <AnimatePresence>
          {showPicker && (
            <EmojiPickerPopup onSelect={toggleReaction} onClose={() => setShowPicker(false)} />
          )}
        </AnimatePresence>
      </div>
    </div>
  );
}

// ─── PINNED MESSAGES PANEL ────────────────────────────────────────────────────

export function PinnedMessagesPanel({
  communityId,
  myAddress,
  isAdmin = false,
  onClose,
  onJumpTo,
}: {
  communityId: string;
  myAddress: string;
  isAdmin?: boolean;
  onClose: () => void;
  onJumpTo: (messageId: string) => void;
}) {
  const [pins, setPins] = useState<PinnedMessage[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      try {
        const res = await fetch(`/api/chat/communities/posts?communityId=${communityId}&pinned=true`, {
          headers: { 'x-web3-address': myAddress },
        });
        if (res.ok) {
          const d = await res.json();
          setPins(d.posts || []);
        }
      } catch {}
      setLoading(false);
    })();
  }, [communityId, myAddress]);

  const unpin = async (messageId: string) => {
    try {
      const res = await fetch('/api/chat/communities', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json', 'x-web3-address': myAddress, 'x-verified-session-address': myAddress },
        body: JSON.stringify({ action: 'UNPIN_MESSAGE', communityId, messageId }),
      });
      if (res.ok) {
        setPins(prev => prev.filter(p => p.id !== messageId));
        toast.success('Message unpinned');
      }
    } catch { toast.error('Failed to unpin'); }
  };

  const addr = (a: string) => `${a?.slice(0, 6)}...${a?.slice(-4)}`;
  const preview = (c: string) => {
    if (c.startsWith('__PAYMENT__::')) return '💸 Crypto payment';
    if (c.startsWith('__AUDIO__')) return '🎤 Voice message';
    if (c.startsWith('__MEDIA__')) return '📷 Media';
    if (c.startsWith('__POLL__')) return '📊 Poll';
    return c.replace(/<[^>]+>/g, '').slice(0, 80);
  };

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="fixed inset-0 z-[9990] bg-black/40 backdrop-blur-sm flex items-center justify-end"
      onClick={e => { if (e.target === e.currentTarget) onClose(); }}
    >
      <motion.div
        initial={{ x: '100%' }}
        animate={{ x: 0 }}
        exit={{ x: '100%' }}
        transition={{ type: 'spring', stiffness: 340, damping: 34 }}
        className="h-full w-full max-w-[380px] bg-white flex flex-col shadow-2xl"
        onClick={e => e.stopPropagation()}
      >
        {/* Header */}
        <div className="h-[64px] px-5 border-b border-black/5 flex items-center justify-between shrink-0">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-amber-50 flex items-center justify-center">
              <Pin size={18} className="text-amber-500" />
            </div>
            <div>
              <p className="text-[15px] font-bold text-[#1C1C1E]">Pinned Messages</p>
              <p className="text-[11px] text-black/40">{pins.length} pinned</p>
            </div>
          </div>
          <button onClick={onClose} className="w-8 h-8 rounded-full bg-[#F2F2F7] flex items-center justify-center text-black/40 hover:text-black transition-colors">
            <X size={16} />
          </button>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto py-3">
          {loading ? (
            <div className="flex items-center justify-center py-16">
              <div className="w-7 h-7 border-2 border-[#25D366] border-t-transparent rounded-full animate-spin" />
            </div>
          ) : pins.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-20 text-center px-8">
              <div className="w-16 h-16 rounded-2xl bg-amber-50 flex items-center justify-center mb-4">
                <Pin size={28} className="text-amber-400" />
              </div>
              <p className="text-[15px] font-bold text-[#1C1C1E]">No pinned messages</p>
              <p className="text-[13px] text-black/40 mt-1">Right-click any message to pin it</p>
            </div>
          ) : (
            <div className="space-y-2 px-3">
              {pins.map((pin, idx) => (
                <motion.div
                  key={pin.id}
                  initial={{ opacity: 0, x: 20 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: idx * 0.05 }}
                  className="bg-[#FAFAFA] rounded-2xl p-4 border border-black/5 group relative"
                >
                  <div className="flex items-start gap-3">
                    <div className="w-8 h-8 rounded-full bg-[#25D366]/15 flex items-center justify-center text-[10px] font-black text-[#25D366] shrink-0">
                      {(pin.authorAddress || '??').slice(2, 4).toUpperCase()}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-1">
                        <span className="text-[11px] font-mono font-bold text-black/50">{addr(pin.authorAddress)}</span>
                        <span className="text-[10px] text-black/30">
                          {new Date(pin.createdAt).toLocaleDateString('en', { month: 'short', day: 'numeric' })}
                        </span>
                      </div>
                      <p className="text-[13px] text-[#1C1C1E] leading-relaxed line-clamp-3">{preview(pin.content)}</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-2 mt-3 pt-2 border-t border-black/5">
                    <button
                      onClick={() => { onJumpTo(pin.id); onClose(); }}
                      className="flex items-center gap-1.5 text-[12px] font-bold text-[#25D366] hover:text-[#128C7E] transition-colors"
                    >
                      <ChevronRight size={13} /> Jump to message
                    </button>
                    {isAdmin && (
                      <button
                        onClick={() => unpin(pin.id)}
                        className="ml-auto flex items-center gap-1 text-[11px] font-bold text-red-400 hover:text-red-600 transition-colors"
                      >
                        <Trash2 size={12} /> Unpin
                      </button>
                    )}
                  </div>
                </motion.div>
              ))}
            </div>
          )}
        </div>
      </motion.div>
    </motion.div>
  );
}

// ─── TYPING INDICATOR ─────────────────────────────────────────────────────────

export function TypingIndicator({ addresses }: { addresses: string[] }) {
  if (addresses.length === 0) return null;
  const addr = (a: string) => `${a?.slice(0, 6)}...${a?.slice(-4)}`;
  const label = addresses.length === 1
    ? `${addr(addresses[0])} is typing`
    : addresses.length === 2
    ? `${addr(addresses[0])} and ${addr(addresses[1])} are typing`
    : `${addresses.length} people are typing`;

  return (
    <motion.div
      initial={{ opacity: 0, y: 6 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: 6 }}
      className="flex items-center gap-2 px-4 py-1.5"
    >
      <div className="flex gap-0.5 items-end">
        {[0, 1, 2].map(i => (
          <div
            key={i}
            className="w-1.5 h-1.5 rounded-full bg-black/30"
            style={{ animation: `typingBounce 1.2s ${i * 0.2}s ease-in-out infinite` }}
          />
        ))}
      </div>
      <span className="text-[11px] text-black/40 font-medium">{label}</span>
      <style>{`
        @keyframes typingBounce {
          0%, 60%, 100% { transform: translateY(0); opacity: 0.4; }
          30% { transform: translateY(-4px); opacity: 1; }
        }
      `}</style>
    </motion.div>
  );
}

// ─── MESSAGE SEARCH PANEL ─────────────────────────────────────────────────────

export function MessageSearchPanel({
  communityId,
  myAddress,
  onClose,
  onSelect,
}: {
  communityId: string;
  myAddress: string;
  onClose: () => void;
  onSelect: (msg: any) => void;
}) {
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [searched, setSearched] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const debounceRef = useRef<ReturnType<typeof setTimeout>>();

  useEffect(() => { inputRef.current?.focus(); }, []);

  useEffect(() => {
    clearTimeout(debounceRef.current);
    if (!query.trim()) { setResults([]); setSearched(false); return; }
    debounceRef.current = setTimeout(async () => {
      setLoading(true);
      try {
        const res = await fetch(
          `/api/chat/communities/posts?communityId=${communityId}&q=${encodeURIComponent(query)}&limit=50`,
          { headers: { 'x-web3-address': myAddress } }
        );
        if (res.ok) {
          const d = await res.json();
          setResults(d.posts || []);
        }
      } catch {}
      setLoading(false);
      setSearched(true);
    }, 300);
    return () => clearTimeout(debounceRef.current);
  }, [query, communityId, myAddress]);

  const highlight = (text: string, q: string) => {
    if (!q) return text;
    const plain = text.replace(/<[^>]+>/g, '');
    const idx = plain.toLowerCase().indexOf(q.toLowerCase());
    if (idx === -1) return plain.slice(0, 100);
    const start = Math.max(0, idx - 30);
    const end = Math.min(plain.length, idx + q.length + 50);
    const before = plain.slice(start, idx);
    const match = plain.slice(idx, idx + q.length);
    const after = plain.slice(idx + q.length, end);
    return (
      <span>
        {start > 0 && '...'}
        {before}
        <mark className="bg-[#25D366]/20 text-[#1C1C1E] rounded px-0.5">{match}</mark>
        {after}
        {end < plain.length && '...'}
      </span>
    );
  };

  const addr = (a: string) => `${a?.slice(0, 6)}...${a?.slice(-4)}`;

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="fixed inset-0 z-[9990] bg-black/40 backdrop-blur-sm flex flex-col items-center justify-start pt-12 px-4"
      onClick={e => { if (e.target === e.currentTarget) onClose(); }}
    >
      <motion.div
        initial={{ scale: 0.94, opacity: 0, y: -20 }}
        animate={{ scale: 1, opacity: 1, y: 0 }}
        exit={{ scale: 0.94, opacity: 0 }}
        className="w-full max-w-lg bg-white rounded-3xl shadow-2xl overflow-hidden flex flex-col max-h-[80vh]"
        onClick={e => e.stopPropagation()}
      >
        {/* Search header */}
        <div className="px-4 py-3 border-b border-black/5 flex items-center gap-3">
          <div className="w-8 h-8 rounded-full bg-[#F2F2F7] flex items-center justify-center text-black/40">
            <Search size={16} />
          </div>
          <input
            ref={inputRef}
            value={query}
            onChange={e => setQuery(e.target.value)}
            placeholder="Search messages..."
            className="flex-1 text-[15px] outline-none text-[#1C1C1E] placeholder:text-black/30 bg-transparent"
          />
          {query && (
            <button onClick={() => setQuery('')} className="text-black/30 hover:text-black/60 transition-colors">
              <X size={16} />
            </button>
          )}
          <button onClick={onClose} className="w-7 h-7 rounded-full bg-[#F2F2F7] flex items-center justify-center text-black/40 hover:text-black">
            <X size={14} />
          </button>
        </div>

        {/* Results */}
        <div className="flex-1 overflow-y-auto">
          {loading && (
            <div className="flex items-center justify-center py-10">
              <div className="w-6 h-6 border-2 border-[#25D366] border-t-transparent rounded-full animate-spin" />
            </div>
          )}
          {!loading && searched && results.length === 0 && (
            <div className="flex flex-col items-center justify-center py-12 text-center">
              <AlertCircle size={32} className="text-black/20 mb-3" />
              <p className="text-[14px] font-bold text-[#1C1C1E]">No results for "{query}"</p>
              <p className="text-[12px] text-black/40 mt-1">Try different keywords</p>
            </div>
          )}
          {!loading && results.length > 0 && (
            <div>
              <p className="text-[11px] font-bold text-black/30 px-4 py-2 uppercase tracking-widest">
                {results.length} result{results.length !== 1 ? 's' : ''}
              </p>
              {results.map((msg, idx) => (
                <button
                  key={msg.id}
                  onClick={() => { onSelect(msg); onClose(); }}
                  className="w-full px-4 py-3 flex items-start gap-3 hover:bg-[#F2F2F7] transition-colors text-left border-b border-black/[0.04] last:border-0"
                >
                  <div className="w-8 h-8 rounded-full bg-[#25D366]/15 flex items-center justify-center text-[10px] font-black text-[#25D366] shrink-0 mt-0.5">
                    {(msg.authorAddress || '??').slice(2, 4).toUpperCase()}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-0.5">
                      <span className="text-[11px] font-mono font-bold text-black/50">{addr(msg.authorAddress)}</span>
                      <span className="text-[10px] text-black/30">
                        {new Date(msg.createdAt).toLocaleDateString('en', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })}
                      </span>
                    </div>
                    <p className="text-[13px] text-[#1C1C1E] leading-relaxed">
                      {highlight(msg.content || '', query)}
                    </p>
                  </div>
                  <ChevronRight size={14} className="text-black/20 shrink-0 mt-1" />
                </button>
              ))}
            </div>
          )}
          {!query && (
            <div className="flex flex-col items-center justify-center py-12 text-center opacity-50">
              <Search size={32} className="text-black/20 mb-3" />
              <p className="text-[14px] font-medium text-black/40">Type to search messages</p>
            </div>
          )}
        </div>
      </motion.div>
    </motion.div>
  );
}
