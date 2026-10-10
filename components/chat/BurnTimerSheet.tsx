// @ts-nocheck
"use client";
/**
 * BurnTimerSheet — bottom drawer to select disappearing message timer
 * Shows: OFF, 5s, 10s, 30s, 1min, 5min, 1hr, 1 day
 */

import React from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Flame, X } from 'lucide-react';

const TIMER_OPTIONS = [
  { label: 'Off',     value: null,    desc: 'Messages stay forever' },
  { label: '5s',      value: 5,       desc: 'Burns in 5 seconds' },
  { label: '10s',     value: 10,      desc: 'Burns in 10 seconds' },
  { label: '30s',     value: 30,      desc: 'Burns in 30 seconds' },
  { label: '1 min',   value: 60,      desc: 'Burns in 1 minute' },
  { label: '5 min',   value: 300,     desc: 'Burns in 5 minutes' },
  { label: '1 hour',  value: 3600,    desc: 'Burns in 1 hour' },
  { label: '1 day',   value: 86400,   desc: 'Burns in 24 hours' },
];

interface BurnTimerSheetProps {
  isOpen: boolean;
  currentTimer: number | null;
  onSelect: (seconds: number | null) => void;
  onClose: () => void;
}

export function BurnTimerSheet({ isOpen, currentTimer, onSelect, onClose }: BurnTimerSheetProps) {
  return (
    <AnimatePresence>
      {isOpen && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="fixed inset-0 z-[500] bg-black/40 backdrop-blur-sm flex items-end justify-center"
          onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}
        >
          <motion.div
            initial={{ y: '100%' }}
            animate={{ y: 0 }}
            exit={{ y: '100%' }}
            transition={{ type: 'spring', stiffness: 350, damping: 32 }}
            className="w-full max-w-lg bg-white rounded-t-[32px] pb-safe"
            style={{ paddingBottom: 'max(1.5rem, env(safe-area-inset-bottom))' }}
          >
            {/* Handle */}
            <div className="flex justify-center pt-3 pb-1">
              <div className="w-10 h-1 rounded-full bg-black/10" />
            </div>

            {/* Header */}
            <div className="flex items-center justify-between px-6 py-4">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-2xl bg-red-50 flex items-center justify-center">
                  <Flame size={20} className="text-red-500" />
                </div>
                <div>
                  <p className="text-[16px] font-black text-[#1C1C1E]">Disappearing Messages</p>
                  <p className="text-[12px] text-black/40 font-medium">Messages auto-delete after being read</p>
                </div>
              </div>
              <button
                onClick={onClose}
                className="w-8 h-8 rounded-full bg-[#F2F2F7] flex items-center justify-center"
              >
                <X size={16} className="text-black/50" />
              </button>
            </div>

            {/* Options */}
            <div className="px-4 flex flex-col gap-1">
              {TIMER_OPTIONS.map((opt) => {
                const isActive = opt.value === currentTimer;
                return (
                  <button
                    key={opt.label}
                    onClick={() => { onSelect(opt.value); onClose(); }}
                    className={`w-full flex items-center justify-between px-4 py-3.5 rounded-2xl transition-all ${
                      isActive
                        ? 'bg-red-500 text-white'
                        : 'bg-[#F2F2F7] hover:bg-[#E5E5EA] text-[#1C1C1E]'
                    }`}
                  >
                    <div className="flex items-center gap-3">
                      {opt.value ? (
                        <Flame size={18} className={isActive ? 'text-white' : 'text-red-400'} />
                      ) : (
                        <div className="w-[18px] h-[18px] rounded-full border-2 border-current opacity-30" />
                      )}
                      <span className="text-[15px] font-bold">{opt.label}</span>
                    </div>
                    <span className={`text-[12px] font-medium ${isActive ? 'text-white/70' : 'text-black/40'}`}>
                      {opt.desc}
                    </span>
                  </button>
                );
              })}
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
