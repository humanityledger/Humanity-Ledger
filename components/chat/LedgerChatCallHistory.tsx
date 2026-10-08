"use client";
import React, { useState, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Phone, Video, X, PhoneIncoming, PhoneOutgoing, PhoneMissed } from 'lucide-react';
import type { CallRecord } from '@/lib/wallet/callHistory';

interface LedgerChatCallHistoryProps {
  callHistory: CallRecord[];
  address: string;
  onCallBack: (addr: string, type: 'audio' | 'video') => void;
  onClose: () => void;
  getDisplayName: (addr: string) => string;
}

function AddressAvatar({ address, size = 40 }: { address: string; size?: number }) {
  const initials = address?.slice(2, 4).toUpperCase() ?? '??';
  const hue = address ? parseInt(address.slice(2, 8), 16) % 360 : 180;
  return (
    <div
      style={{
        width: size,
        height: size,
        borderRadius: '50%',
        background: `hsl(${hue},65%,45%)`,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        color: 'white',
        fontWeight: 900,
        fontSize: size * 0.28,
        flexShrink: 0,
      }}
    >
      {initials}
    </div>
  );
}

function formatDuration(seconds: number): string {
  if (seconds <= 0) return '';
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  return `${m}:${String(s).padStart(2, '0')}`;
}

function formatRelativeTime(timestamp: number): string {
  const now = Date.now();
  const diff = now - timestamp;
  const mins = Math.floor(diff / 60_000);
  if (mins < 1) return 'Just now';
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  const days = Math.floor(hrs / 24);
  if (days < 7) return `${days}d ago`;
  return new Date(timestamp).toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
}

function getDateHeader(timestamp: number): string {
  const d = new Date(timestamp);
  const today = new Date();
  const yesterday = new Date(today);
  yesterday.setDate(today.getDate() - 1);
  if (d.toDateString() === today.toDateString()) return 'Today';
  if (d.toDateString() === yesterday.toDateString()) return 'Yesterday';
  return d.toLocaleDateString(undefined, { weekday: 'long', month: 'long', day: 'numeric' });
}

type CallGroup = { header: string; calls: CallRecord[] };

function groupCallsByDate(calls: CallRecord[]): CallGroup[] {
  const groups: CallGroup[] = [];
  const seen = new Map<string, CallGroup>();
  for (const call of calls) {
    const header = getDateHeader(call.timestamp);
    if (!seen.has(header)) {
      const group: CallGroup = { header, calls: [] };
      seen.set(header, group);
      groups.push(group);
    }
    seen.get(header)!.calls.push(call);
  }
  return groups;
}

export function LedgerChatCallHistory({
  callHistory,
  address,
  onCallBack,
  onClose,
  getDisplayName,
}: LedgerChatCallHistoryProps) {
  const [selectedCall, setSelectedCall] = useState<CallRecord | null>(null);
  const groups = groupCallsByDate(callHistory);

  const handleCallBack = useCallback((type: 'audio' | 'video') => {
    if (!selectedCall) return;
    onCallBack(selectedCall.peerAddress, type);
    setSelectedCall(null);
    onClose();
  }, [selectedCall, onCallBack, onClose]);

  return (
    <motion.div
      initial={{ x: '100%' }}
      animate={{ x: 0 }}
      exit={{ x: '100%' }}
      transition={{ type: 'spring', stiffness: 320, damping: 32 }}
      className="absolute inset-0 z-50 bg-white flex flex-col"
    >
      {/* Header */}
      <div className="flex items-center gap-3 px-4 h-[68px] border-b border-black/8 shrink-0">
        <button onClick={onClose} className="p-2 rounded-full hover:bg-black/5 transition-colors">
          <X size={18} className="text-black" />
        </button>
        <h2 className="text-[18px] font-black tracking-tight text-black flex-1">Calls</h2>
      </div>

      {/* Body */}
      <div className="flex-1 overflow-y-auto">
        {callHistory.length === 0 && (
          <div className="flex flex-col items-center justify-center h-full gap-4 text-black/30 px-8">
            <span className="text-6xl">🐋</span>
            <p className="text-[15px] font-medium text-center">
              No calls yet.<br />Start a call to see it here.
            </p>
          </div>
        )}

        {groups.map((group, gi) => (
          <div key={gi}>
            <div className="sticky top-0 px-4 py-2 bg-[#f5f5f7] border-b border-black/5 z-10">
              <span className="text-[11px] font-black uppercase tracking-widest text-black/40">
                {group.header}
              </span>
            </div>
            {group.calls.map(call => {
              const isMissed = call.status === 'missed';
              const isIncoming = call.direction === 'incoming';
              const isOutgoing = call.direction === 'outgoing';
              const displayName = getDisplayName(call.peerAddress);

              return (
                <button
                  key={call.id}
                  onClick={() => setSelectedCall(call)}
                  className="w-full flex items-center gap-3 px-4 py-3 border-b border-black/5 hover:bg-black/2 transition-colors active:bg-black/5 text-left"
                >
                  <AddressAvatar address={call.peerAddress} size={44} />
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between gap-2">
                      <span className={`text-[15px] font-bold truncate ${isMissed ? 'text-red-500' : 'text-black'}`}>
                        {displayName}
                      </span>
                      <span className="text-[11px] font-mono text-black/30 shrink-0">
                        {formatRelativeTime(call.timestamp)}
                      </span>
                    </div>
                    <div className="flex items-center gap-1.5 mt-0.5">
                      {/* Direction icon */}
                      {isMissed ? (
                        <PhoneMissed size={12} className="text-red-500 shrink-0" />
                      ) : isIncoming ? (
                        <PhoneIncoming size={12} className="text-[#30d158] shrink-0" />
                      ) : (
                        <PhoneOutgoing size={12} className="text-black/40 shrink-0" />
                      )}
                      {/* Call type */}
                      {call.type === 'video' ? (
                        <Video size={12} className="text-black/40 shrink-0" />
                      ) : (
                        <Phone size={12} className="text-black/40 shrink-0" />
                      )}
                      <span className={`text-[12px] font-medium ${isMissed ? 'text-red-500' : 'text-black/40'}`}>
                        {isMissed ? 'Missed' : isIncoming ? 'Incoming' : 'Outgoing'}
                        {call.durationSeconds > 0 && ` · ${formatDuration(call.durationSeconds)}`}
                      </span>
                    </div>
                  </div>
                  {/* Call-back icon */}
                  <div className="text-[#25D366] shrink-0">
                    {call.type === 'video' ? <Video size={18} /> : <Phone size={18} />}
                  </div>
                </button>
              );
            })}
          </div>
        ))}
      </div>

      {/* Call-back Action Sheet */}
      <AnimatePresence>
        {selectedCall && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-[100] bg-black/50 flex items-end justify-center"
            onClick={() => setSelectedCall(null)}
          >
            <motion.div
              initial={{ y: 100 }}
              animate={{ y: 0 }}
              exit={{ y: 100 }}
              transition={{ type: 'spring', stiffness: 320, damping: 32 }}
              className="bg-white w-full max-w-lg rounded-t-[24px] overflow-hidden border-t-4 border-black"
              onClick={e => e.stopPropagation()}
            >
              <div className="p-5 border-b border-black/8">
                <div className="flex items-center gap-3">
                  <AddressAvatar address={selectedCall.peerAddress} size={44} />
                  <div>
                    <p className="text-[17px] font-black text-black">{getDisplayName(selectedCall.peerAddress)}</p>
                    <p className="text-[11px] font-mono text-black/40 mt-0.5">
                      {selectedCall.peerAddress.slice(0, 10)}...{selectedCall.peerAddress.slice(-6)}
                    </p>
                  </div>
                </div>
              </div>
              <div className="p-4 flex flex-col gap-3">
                <button
                  onClick={() => handleCallBack('audio')}
                  className="w-full h-14 flex items-center justify-center gap-3 bg-[#30d158] text-white rounded-2xl font-black text-[15px] uppercase tracking-wide active:scale-[0.98] transition-transform"
                >
                  <Phone size={20} />
                  Audio Call
                </button>
                <button
                  onClick={() => handleCallBack('video')}
                  className="w-full h-14 flex items-center justify-center gap-3 bg-[#25D366] text-white rounded-2xl font-black text-[15px] uppercase tracking-wide active:scale-[0.98] transition-transform"
                >
                  <Video size={20} />
                  Video Call
                </button>
                <button
                  onClick={() => setSelectedCall(null)}
                  className="w-full h-12 flex items-center justify-center bg-black/5 text-black/60 rounded-2xl font-bold text-[14px]"
                >
                  Cancel
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  );
}
