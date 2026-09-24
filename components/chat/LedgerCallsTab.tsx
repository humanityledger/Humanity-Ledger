'use client';
import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Phone, Video, Calendar, Hash, Star, ArrowLeft, PhoneIncoming, PhoneOutgoing,
  PhoneMissed, Lock, ChevronRight, Search, Plus
} from 'lucide-react';

interface CallRecord {
  id: string;
  peerAddress: string;
  peerName?: string;
  type: 'voice' | 'video';
  direction: 'incoming' | 'outgoing';
  missed?: boolean;
  duration?: number;
  timestamp: number;
}

interface LedgerCallsTabProps {
  callHistory: CallRecord[];
  myAddress: string;
  onStartCall: (address: string, type: 'voice' | 'video') => void;
  onOpenChat: (address: string) => void;
}

const AVATAR_COLORS = ['#007AFF','#34C759','#FF9500','#FF3B30','#AF52DE','#FF2D55'];
const avatarColor = (addr: string) => AVATAR_COLORS[parseInt(addr?.slice(2,4) || '0', 16) % AVATAR_COLORS.length];
const initials = (name: string | undefined, addr: string) => name ? name.slice(0,2).toUpperCase() : addr ? addr.slice(2,4).toUpperCase() : '??';
const shortAddr = (addr: string) => addr ? `${addr.slice(0, 6)}...${addr.slice(-4)}` : '';

const formatDuration = (seconds: number) => {
  if (seconds < 60) return `${seconds}s`;
  return `${Math.floor(seconds / 60)}:${String(seconds % 60).padStart(2, '0')}`;
};

const formatTime = (ts: number) => {
  const d = new Date(ts);
  const now = new Date();
  const diff = now.getTime() - ts;
  if (diff < 86400000 && d.getDate() === now.getDate()) return d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  if (diff < 172800000) return 'Yesterday';
  return d.toLocaleDateString([], { month: 'short', day: 'numeric' });
};

interface CallQuickActionsProps {
  onNew: () => void;
  onSchedule: () => void;
  onKeypad: () => void;
  onFavorites: () => void;
}

export const LedgerCallsTab: React.FC<LedgerCallsTabProps & CallQuickActionsProps> = ({
  callHistory, myAddress, onStartCall, onOpenChat, onNew, onSchedule, onKeypad, onFavorites
}) => {
  const [showKeypad, setShowKeypad] = useState(false);
  const [dialInput, setDialInput] = useState('');

  const keypadKeys = ['1','2','3','4','5','6','7','8','9','*','0','#'];

  return (
    <div className="flex-1 overflow-y-auto flex flex-col bg-[#F2F2F7]">
      {/* Quick Action Row */}
      <div className="bg-white mb-2 px-4 py-3">
        <div className="flex gap-3">
          {[
            { icon: <Plus size={20} />, label: 'New Call', action: onNew, color: '#007AFF' },
            { icon: <Calendar size={20} />, label: 'Schedule', action: onSchedule, color: '#007AFF' },
            { icon: <Hash size={20} />, label: 'Keypad', action: () => setShowKeypad(v => !v), color: '#007AFF' },
            { icon: <Star size={20} />, label: 'Favourites', action: onFavorites, color: '#007AFF' },
          ].map(({ icon, label, action, color }) => (
            <button
              key={label}
              onClick={action}
              className="flex-1 flex flex-col items-center gap-1.5 py-2"
            >
              <div className="w-[46px] h-[46px] rounded-2xl bg-[#007AFF]/10 flex items-center justify-center" style={{ color }}>
                {icon}
              </div>
              <span className="text-[11px] font-semibold text-[#007AFF]">{label}</span>
            </button>
          ))}
        </div>
      </div>

      {/* Keypad */}
      <AnimatePresence>
        {showKeypad && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            className="overflow-hidden bg-white mb-2 border-b border-black/[0.06]"
          >
            <div className="px-4 py-4">
              <div className="flex items-center justify-between mb-4 min-h-[40px]">
                <span className="text-[28px] font-light text-[#1C1C1E] tracking-widest font-mono flex-1 text-center">{dialInput || '·'}</span>
                {dialInput && (
                  <button onClick={() => setDialInput(d => d.slice(0,-1))} className="text-[#8E8E93] p-2">
                    <ArrowLeft size={20} />
                  </button>
                )}
              </div>
              <div className="grid grid-cols-3 gap-3 mb-4">
                {keypadKeys.map(k => (
                  <button
                    key={k}
                    onClick={() => setDialInput(d => d + k)}
                    className="h-[60px] rounded-2xl bg-[#F2F2F7] flex items-center justify-center text-[22px] font-semibold text-[#1C1C1E] hover:bg-[#E5E5EA] active:scale-95 transition-all"
                  >
                    {k}
                  </button>
                ))}
              </div>
              <div className="flex gap-3">
                <button
                  onClick={() => { if (dialInput) { onStartCall(dialInput, 'voice'); setShowKeypad(false); setDialInput(''); } }}
                  className="flex-1 py-3 bg-[#34C759] rounded-2xl flex items-center justify-center gap-2 text-white font-semibold"
                >
                  <Phone size={20} /> Call
                </button>
                <button
                  onClick={() => { if (dialInput) { onStartCall(dialInput, 'video'); setShowKeypad(false); setDialInput(''); } }}
                  className="flex-1 py-3 bg-[#007AFF] rounded-2xl flex items-center justify-center gap-2 text-white font-semibold"
                >
                  <Video size={20} /> Video
                </button>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Recent Calls */}
      <div className="bg-white flex-1">
        <div className="px-4 py-2">
          <p className="text-[13px] font-semibold uppercase tracking-wider text-[#6D6D72]">Recent</p>
        </div>

        {callHistory.length === 0 ? (
          <div className="py-16 flex flex-col items-center gap-3 px-8">
            <div className="w-16 h-16 rounded-full bg-[#F2F2F7] flex items-center justify-center">
              <Phone size={28} className="text-[#8E8E93]" />
            </div>
            <p className="text-[15px] font-semibold text-[#1C1C1E] text-center">No Recent Calls</p>
            <p className="text-[13px] text-[#8E8E93] text-center">Your recent calls will appear here.</p>
          </div>
        ) : callHistory.map((call, i) => (
          <button
            key={call.id}
            onClick={() => onOpenChat(call.peerAddress)}
            className="w-full flex items-center gap-3 px-4 py-3 border-b border-black/[0.04] hover:bg-[#F9F9F9] text-left active:bg-[#F2F2F7]"
          >
            <div className="w-[46px] h-[46px] rounded-full flex items-center justify-center text-white font-bold text-lg shrink-0"
              style={{ background: avatarColor(call.peerAddress) }}>
              {initials(call.peerName, call.peerAddress)}
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-[16px] font-semibold text-[#1C1C1E] truncate">{call.peerName || shortAddr(call.peerAddress)}</p>
              <div className="flex items-center gap-1.5 mt-0.5">
                {call.missed ? <PhoneMissed size={13} className="text-[#FF3B30]" /> :
                  call.direction === 'incoming' ? <PhoneIncoming size={13} className="text-[#34C759]" /> :
                  <PhoneOutgoing size={13} className="text-[#007AFF]" />}
                <span className={`text-[13px] ${call.missed ? 'text-[#FF3B30]' : 'text-[#8E8E93]'}`}>
                  {call.missed ? 'Missed' : call.direction === 'incoming' ? 'Incoming' : 'Outgoing'}
                  {call.type === 'video' ? ' Video' : ''}
                  {call.duration ? ` · ${formatDuration(call.duration)}` : ''}
                </span>
              </div>
            </div>
            <div className="flex flex-col items-end gap-1.5 shrink-0">
              <span className="text-[12px] text-[#8E8E93]">{formatTime(call.timestamp)}</span>
              <button
                onClick={e => { e.stopPropagation(); onStartCall(call.peerAddress, call.type); }}
                className="w-8 h-8 rounded-full bg-[#007AFF]/10 flex items-center justify-center"
              >
                {call.type === 'video' ? <Video size={15} className="text-[#007AFF]" /> : <Phone size={15} className="text-[#007AFF]" />}
              </button>
            </div>
          </button>
        ))}

        {/* E2E Encryption notice */}
        <div className="px-4 py-6 flex items-center justify-center gap-2">
          <Lock size={12} className="text-[#8E8E93]" />
          <p className="text-[12px] text-[#8E8E93] text-center">Your personal calls are end-to-end encrypted</p>
        </div>
      </div>
    </div>
  );
};
