"use client";
import React, { useState, useCallback, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { X, Image as ImageIcon, Smile, Type, Download } from 'lucide-react';

// ─── Status Types ────────────────────────────────────────────────────────────

type StatusBackgroundType = 'color' | 'gradient' | 'image';

interface StatusComposerProps {
  address: string;
  onClose: () => void;
  onPost: (status: { text: string; bg: string; emoji?: string; isImage?: boolean; imageUrl?: string }) => void;
}

const GRADIENT_PRESETS = [
  'linear-gradient(135deg, #25D366 0%, #a855f7 100%)',
  'linear-gradient(135deg, #f97316 0%, #ec4899 100%)',
  'linear-gradient(135deg, #14b8a6 0%, #06b6d4 100%)',
  'linear-gradient(135deg, #10b981 0%, #059669 100%)',
  'linear-gradient(135deg, #6366f1 0%, #8b5cf6 100%)',
  'linear-gradient(135deg, #f59e0b 0%, #ef4444 100%)',
];

const SOLID_PRESETS = [
  '#000000', '#1c1c1e', '#25D366', '#30d158',
  '#ff3b30', '#ff9500', '#af52de', '#636366',
];

const EMOJI_STICKERS = ['🐋', '🌊', '⚡', '🔐', '🌐', '💎', '🚀', '🎭', '🦁', '🌙', '☀️', '🔥'];

export function LedgerChatStatusComposer({ address, onClose, onPost }: StatusComposerProps) {
  const [text, setText] = useState('');
  const [bgType, setBgType] = useState<StatusBackgroundType>('gradient');
  const [selectedBg, setSelectedBg] = useState(GRADIENT_PRESETS[0]);
  const [selectedEmoji, setSelectedEmoji] = useState<string | undefined>();
  const [imageUrl, setImageUrl] = useState('');
  const [showEmojiPicker, setShowEmojiPicker] = useState(false);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  const handlePost = useCallback(() => {
    if (!text.trim() && !imageUrl) return;
    onPost({
      text: text.trim(),
      bg: bgType === 'image' ? imageUrl : selectedBg,
      emoji: selectedEmoji,
      isImage: bgType === 'image',
      imageUrl: bgType === 'image' ? imageUrl : undefined,
    });
    onClose();
  }, [text, selectedBg, selectedEmoji, imageUrl, bgType, onClose, onPost]);

  const background = bgType === 'image' && imageUrl
    ? `url(${imageUrl}) center/cover`
    : selectedBg;

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="fixed inset-0 z-[9999] bg-black/80 flex items-end justify-center"
      onClick={onClose}
    >
      <motion.div
        initial={{ y: 100 }}
        animate={{ y: 0 }}
        exit={{ y: 100 }}
        transition={{ type: 'spring', stiffness: 300, damping: 30 }}
        className="w-full max-w-lg bg-white rounded-t-[28px] overflow-hidden"
        onClick={e => e.stopPropagation()}
      >
        {/* Preview */}
        <div
          className="relative h-56 flex items-center justify-center"
          style={{ background }}
        >
          <button
            onClick={onClose}
            className="absolute top-4 right-4 w-8 h-8 bg-black/30 rounded-full flex items-center justify-center"
          >
            <X size={16} className="text-white" />
          </button>

          {selectedEmoji && (
            <div className="absolute top-4 left-4 text-4xl">{selectedEmoji}</div>
          )}

          {text ? (
            <p className="text-white text-[22px] font-black text-center px-6 leading-tight drop-shadow-lg max-w-full">
              {text}
            </p>
          ) : (
            <p className="text-white/40 text-[15px] font-medium">Your status preview</p>
          )}
        </div>

        {/* Controls */}
        <div className="p-4 bg-white">
          {/* Text input */}
          <textarea
            ref={textareaRef}
            value={text}
            onChange={(e) => setText(e.target.value)}
            placeholder="What's happening..."
            maxLength={280}
            rows={2}
            className="w-full resize-none text-[15px] font-medium text-black bg-[#f5f5f7] rounded-xl p-3 focus:outline-none focus:ring-2 focus:ring-black/20 mb-3"
          />

          {/* Background Type Toggle */}
          <div className="flex items-center gap-2 mb-3">
            {(['color', 'gradient', 'image'] as StatusBackgroundType[]).map(t => (
              <button
                key={t}
                onClick={() => setBgType(t)}
                className={`flex-1 py-1.5 rounded-lg text-[11px] font-black uppercase tracking-wider transition-all ${bgType === t ? 'bg-black text-white' : 'bg-black/5 text-black/50 hover:bg-black/10'}`}
              >
                {t}
              </button>
            ))}
          </div>

          {/* Color/Gradient Picker */}
          {bgType === 'color' && (
            <div className="flex items-center gap-2 flex-wrap mb-3">
              {SOLID_PRESETS.map(c => (
                <button
                  key={c}
                  onClick={() => setSelectedBg(c)}
                  className={`w-8 h-8 rounded-full border-2 transition-all ${selectedBg === c ? 'border-black scale-110' : 'border-transparent'}`}
                  style={{ background: c }}
                />
              ))}
            </div>
          )}

          {bgType === 'gradient' && (
            <div className="flex items-center gap-2 flex-wrap mb-3">
              {GRADIENT_PRESETS.map((g, i) => (
                <button
                  key={i}
                  onClick={() => setSelectedBg(g)}
                  className={`w-10 h-10 rounded-xl border-2 transition-all ${selectedBg === g ? 'border-black scale-110' : 'border-transparent'}`}
                  style={{ background: g }}
                />
              ))}
            </div>
          )}

          {bgType === 'image' && (
            <input
              type="url"
              value={imageUrl}
              onChange={(e) => setImageUrl(e.target.value)}
              placeholder="Paste image URL..."
              className="w-full text-[13px] font-mono bg-[#f5f5f7] rounded-xl p-3 focus:outline-none mb-3"
            />
          )}

          {/* Emoji sticker row */}
          <div className="flex items-center gap-2 mb-4 overflow-x-auto pb-1 no-scrollbar">
            {EMOJI_STICKERS.map(e => (
              <button
                key={e}
                onClick={() => setSelectedEmoji(selectedEmoji === e ? undefined : e)}
                className={`shrink-0 text-2xl w-9 h-9 rounded-xl flex items-center justify-center transition-all ${selectedEmoji === e ? 'bg-black/10 scale-110' : 'hover:bg-black/5'}`}
              >
                {e}
              </button>
            ))}
          </div>

          {/* Post button */}
          <button
            onClick={handlePost}
            disabled={!text.trim() && bgType !== 'image'}
            className="w-full h-14 rounded-2xl bg-black text-white font-black text-[15px] uppercase tracking-wider disabled:opacity-30 active:scale-[0.98] transition-all"
          >
            Post Status · {280 - text.length} left
          </button>
        </div>
      </motion.div>
    </motion.div>
  );
}
