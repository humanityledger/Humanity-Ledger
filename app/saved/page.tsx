'use client';

/**
 * Saved messages – the messages this account bookmarked in Ledger Chat.
 *
 * They are read from this browser's storage, under the same key the chat
 * writes (LedgerChatV2 toggleSaveMessage: ledger_saved_msgs_<address>). There
 * is no server copy and no sample data: an account with nothing saved sees an
 * empty state.
 *
 * Messages that carry secrets (encrypted-attachment keys, agreement
 * invitations) are shown by their label only, never as raw text, and cannot be
 * copied from here.
 */

import React, { useCallback, useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { ArrowLeft, Bookmark, Copy, Search, Trash2 } from 'lucide-react';
import { toast } from 'sonner';
import { useAccount } from 'wagmi';

import { parseAttachmentMessage, attachmentPreview } from '@/lib/chat/remote-attachment';
import { agreementMessageKind, agreementPreview } from '@/lib/aztec/agreement-message';

export interface SavedMessage {
  id: string;
  content: string;
  /** Milliseconds since the epoch. */
  savedAt: number;
}

const storageKey = (address: string) => `ledger_saved_msgs_${address.toLowerCase()}`;

function readSaved(address: string): SavedMessage[] {
  try {
    const raw = JSON.parse(localStorage.getItem(storageKey(address)) || '[]');
    if (!Array.isArray(raw)) return [];
    return raw.filter((item): item is SavedMessage => (
      typeof item === 'object' &&
      item !== null &&
      typeof item.id === 'string' &&
      typeof item.content === 'string'
    ));
  } catch {
    return [];
  }
}

export default function SavedMessagesPage() {
  const { address, isConnected } = useAccount();
  const [messages, setMessages] = useState<SavedMessage[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  const reload = useCallback(() => {
    if (!address) {
      setMessages([]);
      return;
    }
    setMessages(readSaved(address));
  }, [address]);

  useEffect(() => {
    reload();
  }, [reload]);

  const removeSaved = useCallback((id: string) => {
    if (!address) return;
    const next = messages.filter(m => m.id !== id);
    setMessages(next);
    try {
      localStorage.setItem(storageKey(address), JSON.stringify(next));
      toast.success('Removed from saved messages');
    } catch {
      toast.error('Failed to update storage');
    }
  }, [address, messages]);

  const filtered = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    if (!q) return messages;
    return messages.filter(m => m.content.toLowerCase().includes(q));
  }, [messages, searchQuery]);

  const renderContent = (content: string) => {
    const att = parseAttachmentMessage(content);
    if (att) {
      return (
        <span className="italic text-[#4a505c]">
          {attachmentPreview(att)}
        </span>
      );
    }

    const agrKind = agreementMessageKind(content);
    if (agrKind) {
      return (
        <span className="italic text-[#4a505c]">
          {agreementPreview(agrKind)}
        </span>
      );
    }

    return <span>{content}</span>;
  };

  const handleCopy = (content: string) => {
    if (parseAttachmentMessage(content) || agreementMessageKind(content)) {
      toast.info('Encrypted message references cannot be copied to clipboard');
      return;
    }
    navigator.clipboard.writeText(content);
    toast.success('Copied to clipboard');
  };

  return (
    <div className="min-h-screen bg-[#fafbfc] text-[#15171c] px-4 py-8 md:py-12">
      <main className="max-w-3xl mx-auto space-y-6">
        <header className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 pb-4 border-b border-[#eceef2]">
          <div className="flex items-center gap-3">
            <Link
              href="/"
              className="p-2 -ml-2 rounded-xl text-[#4a505c] hover:text-[#15171c] hover:bg-black/5 transition"
              aria-label="Back to chat"
            >
              <ArrowLeft size={20} />
            </Link>
            <div>
              <h1 className="text-2xl font-bold tracking-tight flex items-center gap-2">
                <Bookmark size={24} className="text-[#10b981]" aria-hidden="true" />
                Saved Messages
              </h1>
              <p className="text-sm text-[#667085] mt-0.5">
                Private bookmarks stored locally in this browser.
              </p>
            </div>
          </div>
          {mounted && isConnected && (
            <div className="relative">
              <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-[#858d9d]" />
              <input
                type="text"
                placeholder="Search saved..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full sm:w-64 pl-9 pr-3 py-1.5 rounded-xl border border-[#eceef2] bg-white text-sm focus:outline-none focus:ring-2 focus:ring-[#10b981]/20 focus:border-[#10b981]"
              />
            </div>
          )}
        </header>

        {!mounted ? (
          <div className="py-20 text-center text-[#667085] text-sm">
            Loading bookmarks...
          </div>
        ) : !isConnected ? (
          <div className="rounded-3xl border border-[#eceef2] bg-white p-10 text-center space-y-3">
            <Bookmark size={36} className="mx-auto text-[#858d9d]" />
            <h2 className="text-lg font-semibold text-[#15171c]">Connect your wallet</h2>
            <p className="text-sm text-[#667085] max-w-sm mx-auto">
              Saved messages are tied to your wallet address and stored encrypted in your local browser session.
            </p>
            <div className="pt-2">
              <Link
                href="/"
                className="inline-flex items-center justify-center px-4 py-2 rounded-xl bg-[#15171c] text-white text-sm font-medium hover:bg-black transition"
              >
                Go to Ledger Chat
              </Link>
            </div>
          </div>
        ) : filtered.length === 0 ? (
          <div className="rounded-3xl border border-[#eceef2] bg-white p-12 text-center space-y-3">
            <Bookmark size={40} className="mx-auto text-[#858d9d] stroke-[1.5]" />
            <h2 className="text-base font-semibold text-[#15171c]">
              {searchQuery ? 'No matching bookmarks' : 'No saved messages yet'}
            </h2>
            <p className="text-sm text-[#667085] max-w-md mx-auto">
              {searchQuery
                ? 'Try searching with different keywords.'
                : 'Bookmark important messages in Ledger Chat by selecting "Save message" in the message context menu.'}
            </p>
            {!searchQuery && (
              <div className="pt-2">
                <Link
                  href="/"
                  className="inline-flex items-center justify-center px-4 py-2 rounded-xl bg-[#15171c] text-white text-sm font-medium hover:bg-black transition"
                >
                  Return to Chat
                </Link>
              </div>
            )}
          </div>
        ) : (
          <div className="space-y-3">
            {filtered.map((item) => (
              <article
                key={item.id}
                className="rounded-2xl border border-[#eceef2] bg-white p-4 hover:border-[#d0d5dd] transition group"
              >
                <div className="flex items-start justify-between gap-4">
                  <div className="space-y-1.5 flex-1 min-w-0">
                    <div className="text-sm text-[#15171c] break-words whitespace-pre-wrap leading-relaxed">
                      {renderContent(item.content)}
                    </div>
                    {item.savedAt ? (
                      <time className="block text-[11px] text-[#858d9d]">
                        {new Date(item.savedAt).toLocaleDateString(undefined, {
                          month: 'short',
                          day: 'numeric',
                          hour: '2-digit',
                          minute: '2-digit',
                        })}
                      </time>
                    ) : null}
                  </div>
                  <div className="flex items-center gap-1 opacity-80 group-hover:opacity-100 transition">
                    <button
                      type="button"
                      onClick={() => handleCopy(item.content)}
                      className="p-1.5 rounded-lg text-[#667085] hover:text-[#15171c] hover:bg-[#f2f4f7] transition"
                      title="Copy content"
                      aria-label="Copy message"
                    >
                      <Copy size={15} />
                    </button>
                    <button
                      type="button"
                      onClick={() => removeSaved(item.id)}
                      className="p-1.5 rounded-lg text-[#667085] hover:text-[#d93036] hover:bg-[#fef3f2] transition"
                      title="Remove bookmark"
                      aria-label="Remove bookmark"
                    >
                      <Trash2 size={15} />
                    </button>
                  </div>
                </div>
              </article>
            ))}
          </div>
        )}
      </main>
    </div>
  );
}
