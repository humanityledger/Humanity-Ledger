"use client";

import React from 'react';
import { X, Bookmark, Trash2, ArrowUpRight } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { toast } from 'sonner';

interface SavedMessage {
  id: string;
  content: string;
  savedAt: number;
}

interface SavedMessagesModalProps {
  isOpen: boolean;
  onClose: () => void;
  savedMessages: SavedMessage[];
  onRemove: (id: string) => void;
  onJumpToMessage?: (id: string) => void;
}

export const SavedMessagesModal: React.FC<SavedMessagesModalProps> = ({
  isOpen,
  onClose,
  savedMessages,
  onRemove,
  onJumpToMessage,
}) => {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-[200] bg-black/40 backdrop-blur-sm flex items-center justify-center p-4" onClick={onClose}>
      <motion.div
        initial={{ opacity: 0, scale: 0.95, y: 10 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.95, y: 10 }}
        className="w-full max-w-lg bg-white rounded-3xl shadow-2xl border border-black/[0.08] flex flex-col overflow-hidden max-h-[85vh]"
        onClick={e => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-black/[0.06] shrink-0">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-xl bg-[#15171c] text-white flex items-center justify-center">
              <Bookmark size={16} strokeWidth={2} />
            </div>
            <div>
              <h3 className="text-[17px] font-semibold text-[#15171c]">Saved Messages</h3>
              <p className="text-[12px] text-[#727a88]">{savedMessages.length} bookmarked message{savedMessages.length !== 1 ? 's' : ''}</p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="w-8 h-8 flex items-center justify-center rounded-full hover:bg-black/5 text-black/50 transition-colors"
          >
            <X size={18} />
          </button>
        </div>

        {/* List */}
        <div className="flex-1 overflow-y-auto p-4 space-y-2.5">
          {savedMessages.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-16 text-center text-[#727a88]">
              <div className="w-12 h-12 rounded-2xl bg-[#f2f4f7] flex items-center justify-center mb-3 text-[#15171c]/40">
                <Bookmark size={24} />
              </div>
              <p className="text-[15px] font-medium text-[#15171c]">No saved messages</p>
              <p className="text-[13px] text-[#727a88] mt-1 max-w-xs">
                Right-click or hold any message and tap &quot;Save message&quot; to bookmark it locally on this device.
              </p>
            </div>
          ) : (
            savedMessages.map(msg => (
              <div
                key={msg.id}
                className="group p-4 bg-[#f9fafb] hover:bg-[#f2f4f7] rounded-2xl border border-black/[0.04] transition-all flex flex-col gap-2"
              >
                <div className="flex items-center justify-between">
                  <span className="text-[11px] font-mono text-[#727a88]">
                    {new Date(msg.savedAt).toLocaleDateString()} · {new Date(msg.savedAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                  </span>
                  <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                    {onJumpToMessage && (
                      <button
                        type="button"
                        onClick={() => { onJumpToMessage(msg.id); onClose(); }}
                        className="p-1.5 rounded-lg hover:bg-white text-black/60 transition-colors"
                        title="Jump to message"
                      >
                        <ArrowUpRight size={15} />
                      </button>
                    )}
                    <button
                      type="button"
                      onClick={() => onRemove(msg.id)}
                      className="p-1.5 rounded-lg hover:bg-rose-50 text-rose-600 transition-colors"
                      title="Remove bookmark"
                    >
                      <Trash2 size={15} />
                    </button>
                  </div>
                </div>
                <p className="text-[14px] text-[#15171c] leading-relaxed whitespace-pre-wrap select-text break-words">
                  {msg.content.replace(/^__URGENT__::/, '[URGENT] ').replace(/^__REPLY__.*?__::/, '')}
                </p>
              </div>
            ))
          )}
        </div>
      </motion.div>
    </div>
  );
};
