// @ts-nocheck
"use client";
/**
 * ScheduleMessageSheet — lets the user pick a future date/time to send a message
 */

import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Clock, X, Calendar, Send } from 'lucide-react';

interface ScheduleMessageSheetProps {
  isOpen: boolean;
  onSchedule: (date: Date) => void;
  onClose: () => void;
}

// Quick presets
const QUICK_OPTIONS = [
  { label: 'In 5 min',    getValue: () => new Date(Date.now() + 5 * 60 * 1000) },
  { label: 'In 30 min',   getValue: () => new Date(Date.now() + 30 * 60 * 1000) },
  { label: 'In 1 hour',   getValue: () => new Date(Date.now() + 60 * 60 * 1000) },
  { label: 'Tomorrow 9am',getValue: () => { const d = new Date(); d.setDate(d.getDate()+1); d.setHours(9,0,0,0); return d; } },
  { label: 'Tonight 8pm', getValue: () => { const d = new Date(); d.setHours(20,0,0,0); if (d < new Date()) d.setDate(d.getDate()+1); return d; } },
];

export function ScheduleMessageSheet({ isOpen, onSchedule, onClose }: ScheduleMessageSheetProps) {
  // Default: 1 hour from now
  const defaultDate = new Date(Date.now() + 60 * 60 * 1000);
  const toLocalInput = (d: Date) => {
    const pad = (n: number) => String(n).padStart(2, '0');
    return `${d.getFullYear()}-${pad(d.getMonth()+1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
  };

  const [selectedDateStr, setSelectedDateStr] = useState(toLocalInput(defaultDate));

  const handleConfirm = () => {
    const date = new Date(selectedDateStr);
    if (isNaN(date.getTime()) || date <= new Date()) {
      alert('Please select a future time.');
      return;
    }
    onSchedule(date);
    onClose();
  };

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
                <div className="w-10 h-10 rounded-2xl bg-[#1c7aff]/10 flex items-center justify-center">
                  <Clock size={20} className="text-[#1c7aff]" />
                </div>
                <div>
                  <p className="text-[16px] font-black text-[#1C1C1E]">Schedule Message</p>
                  <p className="text-[12px] text-black/40 font-medium">Send at a specific time</p>
                </div>
              </div>
              <button
                onClick={onClose}
                className="w-8 h-8 rounded-full bg-[#F2F2F7] flex items-center justify-center"
              >
                <X size={16} className="text-black/50" />
              </button>
            </div>

            <div className="px-6 flex flex-col gap-4 pb-2">
              {/* Quick presets */}
              <div>
                <p className="text-[11px] font-black uppercase tracking-widest text-black/30 mb-2">Quick Options</p>
                <div className="flex flex-wrap gap-2">
                  {QUICK_OPTIONS.map((opt) => (
                    <button
                      key={opt.label}
                      onClick={() => setSelectedDateStr(toLocalInput(opt.getValue()))}
                      className="px-3 py-1.5 rounded-xl bg-[#F2F2F7] hover:bg-[#1c7aff] hover:text-white text-[#1C1C1E] text-[13px] font-bold transition-all"
                    >
                      {opt.label}
                    </button>
                  ))}
                </div>
              </div>

              {/* Custom datetime */}
              <div>
                <p className="text-[11px] font-black uppercase tracking-widest text-black/30 mb-2">Custom Time</p>
                <div className="flex items-center gap-2 bg-[#F2F2F7] rounded-2xl p-3">
                  <Calendar size={18} className="text-[#1c7aff] shrink-0" />
                  <input
                    type="datetime-local"
                    value={selectedDateStr}
                    min={toLocalInput(new Date(Date.now() + 60000))}
                    onChange={(e) => setSelectedDateStr(e.target.value)}
                    className="flex-1 bg-transparent text-[14px] font-semibold text-[#1C1C1E] outline-none"
                  />
                </div>
              </div>

              {/* Confirm */}
              <button
                onClick={handleConfirm}
                className="w-full flex items-center justify-center gap-2 py-4 rounded-2xl bg-[#1c7aff] text-white font-black text-[15px] active:scale-[0.98] transition-all"
              >
                <Send size={16} />
                Schedule Message
              </button>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
