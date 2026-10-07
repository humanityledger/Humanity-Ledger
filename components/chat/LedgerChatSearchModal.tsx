"use client";
import React, { useState, useCallback, useRef, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { X, Search, ChevronLeft, ChevronRight, MessageSquare } from 'lucide-react';

// ─── Types ────────────────────────────────────────────────────────────────────
interface Message {
  id: string;
  content: string;
  sentAtNs: number;
  senderInboxId: string;
}

interface LedgerChatSearchModalProps {
  messages: Message[];
  onClose: () => void;
  onJumpTo: (id: string) => void;
  getDisplayName: (addr: string) => string;
  clientInboxId: string;
}

// ─── Helpers ──────────────────────────────────────────────────────────────────
function highlightMatch(text: string, query: string): React.ReactNode {
  if (!query) return text;
  const idx = text.toLowerCase().indexOf(query.toLowerCase());
  if (idx === -1) return text;
  return (
    <>
      {text.slice(0, idx)}
      <mark className="bg-yellow-200 text-black rounded px-0.5">{text.slice(idx, idx + query.length)}</mark>
      {text.slice(idx + query.length)}
    </>
  );
}

function formatTime(ns: number): string {
  const d = new Date(ns);
  return d.toLocaleString(undefined, { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' });
}

// ─── Component ────────────────────────────────────────────────────────────────
export function LedgerChatSearchModal({
  messages,
  onClose,
  onJumpTo,
  getDisplayName,
  clientInboxId,
}: LedgerChatSearchModalProps) {
  const [query, setQuery] = useState('');
  const [currentIndex, setCurrentIndex] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    inputRef.current?.focus();
  }, []);

  // Filter messages that match query
  const matches = query.trim().length >= 2
    ? messages.filter(m =>
        typeof m.content === 'string' &&
        !m.content.startsWith('__') &&
        m.content.toLowerCase().includes(query.toLowerCase())
      )
    : [];

  const totalMatches = matches.length;

  const jumpTo = useCallback((match: Message) => {
    onJumpTo(match.id);
    onClose();
  }, [onJumpTo, onClose]);

  const handlePrev = () => {
    setCurrentIndex(i => Math.max(0, i - 1));
  };

  const handleNext = () => {
    setCurrentIndex(i => Math.min(totalMatches - 1, i + 1));
  };

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="absolute inset-0 z-[60] bg-white flex flex-col"
    >
      {/* Search Header */}
      <div className="flex items-center gap-2 px-4 py-3 border-b border-black/8 bg-[#f5f5f7] shrink-0">
        <div className="flex-1 flex items-center gap-2 bg-white rounded-xl px-3 py-2 shadow-sm border border-black/5">
          <Search size={16} className="text-black/30 shrink-0" />
          <input
            ref={inputRef}
            type="text"
            value={query}
            onChange={(e) => { setQuery(e.target.value); setCurrentIndex(0); }}
            placeholder="Search messages..."
            className="flex-1 bg-transparent text-[14px] font-medium text-black placeholder:text-black/30 focus:outline-none"
          />
          {query && (
            <button onClick={() => setQuery('')} className="text-black/30 hover:text-black/60 transition-colors">
              <X size={14} />
            </button>
          )}
        </div>
        <button onClick={onClose} className="text-[14px] font-bold text-[#25D366] hover:text-[#128C7E] shrink-0 ml-1">
          Cancel
        </button>
      </div>

      {/* Navigation Toolbar */}
      {query.trim().length >= 2 && (
        <div className="flex items-center justify-between px-4 py-2 bg-[#f5f5f7] border-b border-black/5 shrink-0">
          <span className="text-[12px] font-bold text-black/50">
            {totalMatches === 0 ? 'No results' : `${currentIndex + 1} of ${totalMatches}`}
          </span>
          <div className="flex items-center gap-1">
            <button
              onClick={handlePrev}
              disabled={currentIndex === 0 || totalMatches === 0}
              className="w-8 h-8 flex items-center justify-center rounded-full hover:bg-black/10 disabled:opacity-30 transition-colors"
            >
              <ChevronLeft size={18} />
            </button>
            <button
              onClick={handleNext}
              disabled={currentIndex >= totalMatches - 1 || totalMatches === 0}
              className="w-8 h-8 flex items-center justify-center rounded-full hover:bg-black/10 disabled:opacity-30 transition-colors"
            >
              <ChevronRight size={18} />
            </button>
          </div>
        </div>
      )}

      {/* Results */}
      <div className="flex-1 overflow-y-auto">
        {query.trim().length < 2 && (
          <div className="flex flex-col items-center justify-center h-full gap-4 text-black/30">
            <MessageSquare size={48} className="opacity-30" />
            <p className="text-[15px] font-medium text-center">
              Type at least 2 characters<br />to search messages
            </p>
          </div>
        )}

        {query.trim().length >= 2 && totalMatches === 0 && (
          <div className="flex flex-col items-center justify-center h-full gap-4 text-black/30">
            <Search size={48} className="opacity-30" />
            <p className="text-[15px] font-medium text-center">
              No messages found for<br />"<strong className="text-black/60">{query}</strong>"
            </p>
          </div>
        )}

        <div className="divide-y divide-black/5">
          {matches.map((msg, i) => {
            const isActive = i === currentIndex;
            const isSelf = msg.senderInboxId === clientInboxId;
            const previewText = typeof msg.content === 'string'
              ? msg.content.replace(/^__REPLY__[^_]+__::/, '').replace(/^__[A-Z_]+__/, '')
              : '[attachment]';

            return (
              <button
                key={msg.id}
                onClick={() => jumpTo(msg)}
                className={`w-full flex items-start gap-3 px-4 py-3.5 text-left transition-colors ${isActive ? 'bg-[#25D366]/8' : 'hover:bg-black/3'}`}
              >
                {/* Sender avatar */}
                <div
                  className="w-9 h-9 rounded-full flex items-center justify-center text-[11px] font-black text-white shrink-0 mt-0.5"
                  style={{ background: isSelf ? '#25D366' : `hsl(${parseInt(msg.senderInboxId.slice(0, 6) || '0', 16) % 360},65%,45%)` }}
                >
                  {isSelf ? 'Me' : msg.senderInboxId.slice(0, 2).toUpperCase()}
                </div>

                <div className="flex-1 min-w-0">
                  <div className="flex items-center justify-between gap-2 mb-0.5">
                    <span className="text-[13px] font-black text-black">
                      {isSelf ? 'You' : getDisplayName(msg.senderInboxId)}
                    </span>
                    <span className="text-[11px] text-black/40 font-mono shrink-0">
                      {formatTime(msg.sentAtNs)}
                    </span>
                  </div>
                  <p className="text-[13px] text-black/70 leading-snug line-clamp-2">
                    {highlightMatch(previewText, query)}
                  </p>
                </div>

                {isActive && (
                  <div className="w-2 h-2 rounded-full bg-[#25D366] shrink-0 mt-2" />
                )}
              </button>
            );
          })}
        </div>
      </div>
    </motion.div>
  );
}

