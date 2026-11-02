'use client';
import React, { useState, useEffect, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Bookmark, Search, Copy, Trash2, X, Clock, Tag,
  MessageSquare, Heart, Image as ImgIcon, FileText, Filter
} from 'lucide-react';
import { toast } from 'sonner';

interface SavedMessage {
  id: string;
  content: string;
  source: string;
  savedAt: string;
  tags: string[];
  type: 'text' | 'image' | 'poll' | 'payment';
}

const DEMO_SAVED: SavedMessage[] = [
  {
    id: '1',
    content: 'The key to building on Aztec is understanding how the PXE (Private Execution Environment) handles state transitions. Each note commitment is stored off-chain but verified on-chain.',
    source: 'DeFi Builders Community',
    savedAt: new Date(Date.now() - 1000 * 60 * 30).toISOString(),
    tags: ['tech', 'aztec'],
    type: 'text',
  },
  {
    id: '2',
    content: 'Token gating with ERC-721 requires you to verify ownership at access time, not just at join time. The Noir circuit for this does a Merkle proof over the holders set.',
    source: 'NFT Alpha Group',
    savedAt: new Date(Date.now() - 1000 * 60 * 60 * 3).toISOString(),
    tags: ['nft', 'tech'],
    type: 'text',
  },
  {
    id: '3',
    content: 'https://humanidfi.com/join/abc123 — Invite link for the Builders community',
    source: 'Direct Message',
    savedAt: new Date(Date.now() - 1000 * 60 * 60 * 24).toISOString(),
    tags: ['links'],
    type: 'text',
  },
  {
    id: '4',
    content: '__PAYMENT__::{"amount":"0.5","token":"ETH","txHash":"0x1234abcd","to":"0xabc..."}',
    source: 'Payment received',
    savedAt: new Date(Date.now() - 1000 * 60 * 60 * 48).toISOString(),
    tags: ['payments'],
    type: 'payment',
  },
];

function timeAgo(iso: string) {
  const diff = Date.now() - new Date(iso).getTime();
  const m = Math.floor(diff / 60000);
  if (m < 60) return `${m}m ago`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h ago`;
  return `${Math.floor(h / 24)}d ago`;
}

export default function SavedMessagesPage() {
  const [saved, setSaved] = useState<SavedMessage[]>(DEMO_SAVED);
  const [searchQuery, setSearchQuery] = useState('');
  const [activeTag, setActiveTag] = useState<string | null>(null);
  const [addingTag, setAddingTag] = useState<string | null>(null);
  const [newTag, setNewTag] = useState('');

  const allTags = Array.from(new Set(saved.flatMap(s => s.tags)));

  const filtered = saved.filter(s => {
    const matchSearch = !searchQuery || s.content.toLowerCase().includes(searchQuery.toLowerCase()) || s.source.toLowerCase().includes(searchQuery.toLowerCase());
    const matchTag = !activeTag || s.tags.includes(activeTag);
    return matchSearch && matchTag;
  });

  const deleteSaved = (id: string) => {
    setSaved(prev => prev.filter(s => s.id !== id));
    toast.success('Removed from saved');
  };

  const copyContent = (content: string) => {
    navigator.clipboard.writeText(content);
    toast.success('Copied to clipboard');
  };

  const addTag = (id: string) => {
    if (!newTag.trim()) return;
    setSaved(prev => prev.map(s => s.id === id ? { ...s, tags: [...new Set([...s.tags, newTag.trim()])] } : s));
    setNewTag('');
    setAddingTag(null);
    toast.success('Tag added');
  };

  const removeTag = (id: string, tag: string) => {
    setSaved(prev => prev.map(s => s.id === id ? { ...s, tags: s.tags.filter(t => t !== tag) } : s));
  };

  const getIcon = (type: SavedMessage['type']) => {
    if (type === 'image') return ImgIcon;
    if (type === 'poll') return FileText;
    if (type === 'payment') return Heart;
    return MessageSquare;
  };

  return (
    <div className="min-h-screen bg-[#F2F2F7]">
      {/* Header */}
      <div className="bg-white/95 backdrop-blur-md border-b border-black/[0.06] sticky top-0 z-20">
        <div className="max-w-2xl mx-auto px-4 py-4">
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center gap-2">
              <div className="w-8 h-8 rounded-2xl bg-[#25D366]/10 flex items-center justify-center">
                <Bookmark size={15} className="text-[#25D366]" />
              </div>
              <div>
                <h1 className="text-[17px] font-black text-[#1C1C1E]">Saved Messages</h1>
                <p className="text-[11px] text-black/35 font-medium">{saved.length} saved items</p>
              </div>
            </div>
          </div>

          {/* Search */}
          <div className="flex items-center gap-2 bg-[#F2F2F7] rounded-2xl px-4 py-2.5">
            <Search size={14} className="text-black/30 shrink-0" />
            <input
              value={searchQuery}
              onChange={e => setSearchQuery(e.target.value)}
              placeholder="Search saved messages..."
              className="bg-transparent flex-1 text-[14px] outline-none placeholder:text-black/30"
            />
            {searchQuery && (
              <button onClick={() => setSearchQuery('')} className="text-black/30 hover:text-black/60">
                <X size={14} />
              </button>
            )}
          </div>
        </div>
      </div>

      <div className="max-w-2xl mx-auto px-4 py-4">
        {/* Tag filters */}
        {allTags.length > 0 && (
          <div className="flex gap-2 overflow-x-auto pb-2 mb-4">
            <button onClick={() => setActiveTag(null)}
              className={`px-3.5 py-1.5 rounded-full text-[12px] font-bold whitespace-nowrap transition-colors shrink-0 ${!activeTag ? 'bg-[#1C1C1E] text-white' : 'bg-white text-black/50 border border-black/10 hover:border-black/20'}`}>
              All
            </button>
            {allTags.map(tag => (
              <button key={tag} onClick={() => setActiveTag(activeTag === tag ? null : tag)}
                className={`px-3.5 py-1.5 rounded-full text-[12px] font-bold whitespace-nowrap transition-colors shrink-0 ${activeTag === tag ? 'bg-[#25D366] text-white' : 'bg-white text-black/50 border border-black/10 hover:border-black/20'}`}>
                #{tag}
              </button>
            ))}
          </div>
        )}

        {/* Empty state */}
        {filtered.length === 0 && (
          <div className="flex flex-col items-center justify-center py-24 text-center">
            <div className="w-16 h-16 rounded-full bg-[#25D366]/10 flex items-center justify-center mb-4">
              <Bookmark size={22} className="text-[#25D366]" />
            </div>
            <p className="text-[17px] font-black text-[#1C1C1E] mb-2">
              {searchQuery ? 'No results found' : 'Nothing saved yet'}
            </p>
            <p className="text-[14px] text-black/40">
              {searchQuery ? 'Try a different search term' : 'Long-press any message and tap "Save" to bookmark it.'}
            </p>
          </div>
        )}

        {/* Saved messages list */}
        <div className="space-y-3">
          <AnimatePresence>
            {filtered.map(item => {
              const Icon = getIcon(item.type);
              const isPayment = item.content.startsWith('__PAYMENT__::');
              let paymentData: any = null;
              if (isPayment) {
                try { paymentData = JSON.parse(item.content.replace('__PAYMENT__::', '')); } catch {}
              }

              return (
                <motion.div
                  key={item.id}
                  layout
                  initial={{ opacity: 0, y: 8 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, x: -20 }}
                  className="bg-white rounded-3xl p-5 shadow-sm border border-black/[0.05]"
                >
                  {/* Meta row */}
                  <div className="flex items-center justify-between mb-3">
                    <div className="flex items-center gap-2">
                      <div className="w-6 h-6 rounded-lg bg-[#25D366]/10 flex items-center justify-center">
                        <Icon size={12} className="text-[#25D366]" />
                      </div>
                      <span className="text-[12px] font-bold text-black/40 truncate max-w-[150px]">
                        {item.source}
                      </span>
                    </div>
                    <div className="flex items-center gap-1">
                      <span className="text-[11px] text-black/25 font-medium">{timeAgo(item.savedAt)}</span>
                      <button onClick={() => copyContent(item.content)}
                        className="p-1.5 rounded-lg hover:bg-black/5 text-black/25 hover:text-black/60 transition-colors ml-1">
                        <Copy size={12} />
                      </button>
                      <button onClick={() => deleteSaved(item.id)}
                        className="p-1.5 rounded-lg hover:bg-red-50 text-black/25 hover:text-red-500 transition-colors">
                        <Trash2 size={12} />
                      </button>
                    </div>
                  </div>

                  {/* Content */}
                  {isPayment && paymentData ? (
                    <div className="flex items-center gap-3 bg-[#25D366]/8 rounded-2xl px-4 py-3">
                      <div className="w-8 h-8 rounded-full bg-[#25D366]/20 flex items-center justify-center shrink-0">
                        <Heart size={14} className="text-[#25D366]" />
                      </div>
                      <div>
                        <p className="text-[14px] font-black text-[#1C1C1E]">{paymentData.amount} {paymentData.token} received</p>
                        <p className="text-[11px] text-black/40 font-mono">{paymentData.txHash?.slice(0, 20)}…</p>
                      </div>
                    </div>
                  ) : (
                    <p className="text-[14px] text-[#1C1C1E] leading-relaxed line-clamp-4">
                      {item.content}
                    </p>
                  )}

                  {/* Tags */}
                  <div className="flex flex-wrap gap-1.5 mt-3">
                    {item.tags.map(tag => (
                      <div key={tag} className="flex items-center gap-1 px-2.5 py-1 bg-[#F2F2F7] rounded-full group">
                        <span className="text-[11px] font-bold text-black/50">#{tag}</span>
                        <button onClick={() => removeTag(item.id, tag)}
                          className="opacity-0 group-hover:opacity-100 transition-opacity text-black/30 hover:text-red-500">
                          <X size={10} />
                        </button>
                      </div>
                    ))}

                    {addingTag === item.id ? (
                      <form onSubmit={e => { e.preventDefault(); addTag(item.id); }} className="flex items-center gap-1">
                        <input
                          value={newTag}
                          onChange={e => setNewTag(e.target.value)}
                          autoFocus
                          placeholder="tag name"
                          className="w-20 px-2 py-0.5 text-[11px] bg-[#F2F2F7] rounded-full outline-none border border-[#25D366]/30 font-bold text-black/60"
                        />
                        <button type="submit" className="text-[#25D366] text-[11px] font-bold">Add</button>
                        <button type="button" onClick={() => setAddingTag(null)} className="text-black/30 text-[11px]">Cancel</button>
                      </form>
                    ) : (
                      <button onClick={() => setAddingTag(item.id)}
                        className="flex items-center gap-1 px-2.5 py-1 border border-dashed border-black/15 rounded-full text-[11px] font-bold text-black/30 hover:border-[#25D366]/40 hover:text-[#25D366] transition-colors">
                        <Tag size={9} /> Add tag
                      </button>
                    )}
                  </div>
                </motion.div>
              );
            })}
          </AnimatePresence>
        </div>
      </div>
    </div>
  );
}
