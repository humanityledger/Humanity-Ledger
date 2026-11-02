"use client";

import React from 'react';
import { X, Command } from 'lucide-react';
import { motion } from 'framer-motion';

interface KeyboardShortcutsModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const KeyboardShortcutsModal: React.FC<KeyboardShortcutsModalProps> = ({
  isOpen,
  onClose,
}) => {
  if (!isOpen) return null;

  const SHORTCUTS = [
    { section: 'NAVIGATION & SEARCH', items: [
      { keys: ['⌘ / Ctrl', 'K'], label: 'Open conversation search' },
      { keys: ['Esc'], label: 'Close modals, menus, and search' },
      { keys: ['⌘ / Ctrl', '/'], label: 'Open keyboard shortcuts guide' },
    ]},
    { section: 'MESSAGING & COMPOSITION', items: [
      { keys: ['Enter'], label: 'Send message' },
      { keys: ['Shift', 'Enter'], label: 'Insert new line' },
      { keys: ['/'], label: 'Open slash commands autocomplete' },
    ]},
    { section: 'NATIVE SLASH COMMANDS', items: [
      { keys: ['/me <act>'], label: 'Third-person action formatting' },
      { keys: ['/urgent'], label: 'Send high-priority urgent alert' },
      { keys: ['/code'], label: 'Format message as syntax code block' },
      { keys: ['/shrug'], label: 'Append shrug ¯\\_(ツ)_/¯' },
      { keys: ['/price'], label: 'Live crypto price oracle' },
      { keys: ['/gas'], label: 'Live Ethereum network gas fees' },
      { keys: ['/online', '/away'], label: 'Instantly update presence state' },
      { keys: ['/clear'], label: 'Clear current chat display buffer' },
    ]},
  ];

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
              <Command size={16} strokeWidth={2} />
            </div>
            <div>
              <h3 className="text-[17px] font-semibold text-[#15171c]">Keyboard Shortcuts</h3>
              <p className="text-[12px] text-[#727a88]">Swiss precision navigation</p>
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

        {/* Shortcuts list */}
        <div className="flex-1 overflow-y-auto p-6 space-y-6">
          {SHORTCUTS.map(group => (
            <div key={group.section} className="space-y-2.5">
              <p className="text-[11px] font-mono font-bold tracking-wider text-[#727a88] uppercase">{group.section}</p>
              <div className="space-y-1.5 bg-[#f9fafb] p-3 rounded-2xl border border-black/[0.04]">
                {group.items.map((item, idx) => (
                  <div key={idx} className="flex items-center justify-between py-1 px-1">
                    <span className="text-[13.5px] font-medium text-[#15171c]">{item.label}</span>
                    <div className="flex items-center gap-1 shrink-0">
                      {item.keys.map(k => (
                        <kbd key={k} className="px-2 py-0.5 text-[11px] font-mono font-semibold bg-white border border-black/[0.1] rounded-lg shadow-sm text-[#15171c]">
                          {k}
                        </kbd>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      </motion.div>
    </div>
  );
};
