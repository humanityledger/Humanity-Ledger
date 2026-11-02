"use client";

import React, { useMemo, useCallback, useRef, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Search, X, ChevronUp, ChevronDown } from "lucide-react";

export interface SearchableMessage {
  id: string;
  content: string;
  sentAt?: Date | number;
}

interface InChatSearchProps {
  open: boolean;
  messages: SearchableMessage[];
  onClose: () => void;
  /** Called when a match is selected — parent should scroll to this message ID */
  onNavigate: (messageId: string) => void;
}

// Escapes special regex characters in the query string
function escapeRegex(str: string) {
  return str.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

/**
 * Highlights occurrences of `query` inside `text` and returns an array of
 * React nodes with highlighted spans.
 */
export function highlightMatches(text: string, query: string): React.ReactNode {
  if (!query.trim()) return text;
  const parts = text.split(new RegExp(`(${escapeRegex(query)})`, "gi"));
  return parts.map((part, i) =>
    part.toLowerCase() === query.toLowerCase() ? (
      <mark
        key={i}
        className="bg-yellow-300 text-[#15171c] rounded-[2px] px-[1px]"
      >
        {part}
      </mark>
    ) : (
      part
    )
  );
}

export function InChatSearch({
  open,
  messages,
  onClose,
  onNavigate,
}: InChatSearchProps) {
  const [query, setQuery] = React.useState("");
  const [currentIdx, setCurrentIdx] = React.useState(0);
  const inputRef = useRef<HTMLInputElement>(null);

  // Focus input when panel opens
  useEffect(() => {
    if (open) {
      setTimeout(() => inputRef.current?.focus(), 80);
      setQuery("");
      setCurrentIdx(0);
    }
  }, [open]);

  // Filtered match IDs (most-recent first)
  const matchIds = useMemo<string[]>(() => {
    if (!query.trim()) return [];
    const q = query.toLowerCase();
    return messages
      .filter((m) =>
        typeof m.content === "string" && m.content.toLowerCase().includes(q)
      )
      .map((m) => m.id);
  }, [messages, query]);

  const total = matchIds.length;

  // Navigate through results
  const navigate = useCallback(
    (dir: 1 | -1) => {
      if (total === 0) return;
      const next = (currentIdx + dir + total) % total;
      setCurrentIdx(next);
      onNavigate(matchIds[next]);
    },
    [currentIdx, matchIds, onNavigate, total]
  );

  // Keyboard shortcuts inside the search bar
  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      if (e.key === "Escape") { onClose(); return; }
      if (e.key === "Enter") navigate(e.shiftKey ? -1 : 1);
    },
    [navigate, onClose]
  );

  // Notify parent of first match whenever query changes
  useEffect(() => {
    if (matchIds.length > 0) {
      setCurrentIdx(0);
      onNavigate(matchIds[0]);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [matchIds]);

  return (
    <AnimatePresence>
      {open && (
        <motion.div
          className="flex items-center gap-2 px-3 py-2 bg-white border-b border-[#e4e7ec] shadow-sm"
          initial={{ opacity: 0, y: -12 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -10 }}
          transition={{ type: "spring", stiffness: 420, damping: 30 }}
        >
          <Search size={15} strokeWidth={2} className="text-[#a3a9b4] shrink-0" />

          <input
            ref={inputRef}
            type="search"
            placeholder="Search in this chat…"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onKeyDown={handleKeyDown}
            className="flex-1 bg-transparent text-[14px] text-[#15171c] placeholder-[#a3a9b4] outline-none min-w-0"
            aria-label="Search messages"
          />

          {/* Result counter */}
          {query.trim() && (
            <span className="text-[12px] text-[#727a88] tabular-nums shrink-0 min-w-[50px] text-center">
              {total === 0 ? "No results" : `${currentIdx + 1} / ${total}`}
            </span>
          )}

          {/* Up / Down navigation */}
          <div className="flex gap-0.5">
            <button
              type="button"
              disabled={total === 0}
              onClick={() => navigate(-1)}
              className="w-7 h-7 rounded-lg flex items-center justify-center text-[#475061] disabled:opacity-30 hover:bg-[#f2f4f7] transition-colors"
              aria-label="Previous match"
            >
              <ChevronUp size={15} strokeWidth={2} />
            </button>
            <button
              type="button"
              disabled={total === 0}
              onClick={() => navigate(1)}
              className="w-7 h-7 rounded-lg flex items-center justify-center text-[#475061] disabled:opacity-30 hover:bg-[#f2f4f7] transition-colors"
              aria-label="Next match"
            >
              <ChevronDown size={15} strokeWidth={2} />
            </button>
          </div>

          {/* Close */}
          <button
            type="button"
            onClick={onClose}
            className="w-7 h-7 rounded-full flex items-center justify-center text-[#475061] hover:bg-[#f2f4f7] transition-colors"
            aria-label="Close search"
          >
            <X size={15} strokeWidth={2} />
          </button>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
