"use client";

import React, { useState, useEffect, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { X, ShieldCheck, Check, UserX, Bell, Inbox } from 'lucide-react';
import { toast } from 'sonner';

interface ContactRequest {
  id: string;
  fromAddress: string;
  toAddress: string;
  status: string;
  createdAt: string;
  user: {
    address: string;
    nickname: string;
    avatarUrl: string | null;
    isVerified: boolean;
    tier: string;
  };
}

interface ContactRequestsPanelProps {
  myAddress: string;
  onClose: () => void;
  onAccepted?: (peerAddress: string, nickname: string) => void;
}

export function ContactRequestsPanel({ myAddress, onClose, onAccepted }: ContactRequestsPanelProps) {
  const [requests, setRequests] = useState<ContactRequest[]>([]);
  const [loading, setLoading] = useState(true);
  // [FIX] Use a Set so multiple requests can be independently in-flight
  // without race conditions unlocking each other's buttons.
  const [processingIds, setProcessingIds] = useState<Set<string>>(new Set());

  const loadRequests = useCallback(async () => {
    try {
      const res = await fetch('/api/chat/contacts/request?direction=incoming', {
        headers: { 'x-web3-address': myAddress },
      });
      if (!res.ok) return;
      const data = await res.json();
      setRequests(data.requests ?? []);
    } catch {
      // Silently ignore — panel will just show empty
    } finally {
      setLoading(false);
    }
  }, [myAddress]);

  useEffect(() => {
    loadRequests();
  }, [loadRequests]);

  const handleAction = async (request: ContactRequest, action: 'accept' | 'reject') => {
    // [FIX] Add to Set rather than overwriting so concurrent actions don't interfere
    setProcessingIds(prev => new Set(prev).add(request.id));
    try {
      const res = await fetch(`/api/chat/contacts/request/${action}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'x-web3-address': myAddress },
        body: JSON.stringify({ requestId: request.id }),
      });
      const data = await res.json();

      if (!res.ok) {
        toast.error(data.error || `Failed to ${action} request`);
        return;
      }

      // Optimistically remove from list
      setRequests(prev => prev.filter(r => r.id !== request.id));

      if (action === 'accept') {
        toast.success(`You're now connected with ${request.user.nickname}!`);
        // [FIX] Pass nickname so the parent can persist it to local contacts
        onAccepted?.(request.fromAddress, request.user.nickname);
      } else {
        toast.success('Request declined.');
      }
    } catch {
      toast.error('Network error. Please try again.');
    } finally {
      // [FIX] Remove from Set rather than nulling the whole state
      setProcessingIds(prev => {
        const next = new Set(prev);
        next.delete(request.id);
        return next;
      });
    }
  };

  const hueFor = (addr: string) => parseInt(addr.slice(2, 8), 16) % 360;

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="fixed inset-0 z-[100001] bg-black/60 backdrop-blur-md flex items-center justify-center p-4"
      onClick={onClose}
    >
      <motion.div
        initial={{ scale: 0.95, y: 20 }}
        animate={{ scale: 1, y: 0 }}
        exit={{ scale: 0.95, y: 20 }}
        onClick={e => e.stopPropagation()}
        className="w-full max-w-md bg-white rounded-[28px] overflow-hidden shadow-2xl flex flex-col max-h-[75vh]"
      >
        {/* Header */}
        <div className="p-5 border-b border-black/5 bg-[#f9f9fb] flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Bell size={20} className="text-[#1c7aff]" />
            <div>
              <h2 className="text-[17px] font-black text-black">Contact Requests</h2>
              {requests.length > 0 && (
                <p className="text-[11px] text-black/40 mt-0.5">
                  {requests.length} pending request{requests.length !== 1 ? 's' : ''}
                </p>
              )}
            </div>
          </div>
          <button onClick={onClose} className="p-2 hover:bg-black/5 rounded-full transition-colors">
            <X size={18} className="text-black/50" />
          </button>
        </div>

        {/* List */}
        <div className="flex-1 overflow-y-auto">
          <AnimatePresence mode="popLayout">
            {loading ? (
              <div className="flex items-center justify-center p-12">
                <div className="w-7 h-7 border-4 border-[#1c7aff]/20 border-t-[#1c7aff] rounded-full animate-spin" />
              </div>
            ) : requests.length === 0 ? (
              <motion.div
                key="empty"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                className="flex flex-col items-center justify-center p-12 text-center gap-3"
              >
                <Inbox size={42} className="text-black/15" />
                <p className="text-[14px] font-semibold text-black/35">No pending requests</p>
                <p className="text-[12px] text-black/25">When someone searches and connects with you, their request will appear here.</p>
              </motion.div>
            ) : (
              requests.map(req => {
                const hue = hueFor(req.user.address);
                const initials = req.user.nickname.replace('@', '').slice(0, 2).toUpperCase();
                const isProcessing = processingIds.has(req.id);

                return (
                  <motion.div
                    key={req.id}
                    layout
                    initial={{ opacity: 0, x: -20 }}
                    animate={{ opacity: 1, x: 0 }}
                    exit={{ opacity: 0, x: 20, height: 0 }}
                    className="flex items-center gap-3 p-4 border-b border-black/[0.05] last:border-b-0"
                  >
                    {/* Avatar */}
                    <div
                      className="w-12 h-12 rounded-full flex items-center justify-center text-white font-black text-[15px] shrink-0"
                      style={{ background: `hsl(${hue},60%,48%)` }}
                    >
                      {initials}
                    </div>

                    {/* Info */}
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-1">
                        <span className="text-[14px] font-bold text-black truncate">{req.user.nickname}</span>
                        {req.user.isVerified && <ShieldCheck size={12} className="text-[#30d158] shrink-0" />}
                      </div>
                      <p className="text-[11px] text-black/40 mt-0.5 truncate">{req.user.address.slice(0,8)}…{req.user.address.slice(-6)}</p>
                      <p className="text-[11px] text-black/30 mt-0.5">wants to connect with you</p>
                    </div>

                    {/* Action buttons */}
                    <div className="flex gap-2 shrink-0">
                      <button
                        onClick={() => handleAction(req, 'accept')}
                        disabled={isProcessing}
                        className="w-9 h-9 bg-[#1c7aff] hover:bg-blue-600 text-white rounded-full flex items-center justify-center transition-colors disabled:opacity-50"
                        title="Accept"
                      >
                        {isProcessing ? (
                          <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                        ) : (
                          <Check size={16} />
                        )}
                      </button>
                      <button
                        onClick={() => handleAction(req, 'reject')}
                        disabled={isProcessing}
                        className="w-9 h-9 bg-zinc-100 hover:bg-red-50 hover:text-red-500 text-zinc-500 rounded-full flex items-center justify-center transition-colors disabled:opacity-50"
                        title="Decline"
                      >
                        <UserX size={15} />
                      </button>
                    </div>
                  </motion.div>
                );
              })
            )}
          </AnimatePresence>
        </div>
      </motion.div>
    </motion.div>
  );
}
