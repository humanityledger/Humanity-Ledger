'use client';

import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Lock,
  CheckCircle,
  ExternalLink,
  X,
  Sparkles,
  Waves,
  Plus,
  Clock,
  ArrowDownLeft
} from 'lucide-react';
import {
  ZkPaymentStream,
  getUserStreams,
  calculateStreamProgress,
  withdrawFromStream,
  cancelStream,
  createShieldedStream
} from '@/lib/zk/zkStreaming';

interface ZkStreamManagerProps {
  userAddress: string;
  userTag?: string;
  defaultRecipient?: string;
  onClose?: () => void;
  onStreamCreated?: (stream: any) => void;
  className?: string;
}

export function ZkStreamManager({ userAddress, userTag, defaultRecipient, onClose, onStreamCreated, className = '' }: ZkStreamManagerProps) {
  const [tab, setTab] = useState<'incoming' | 'outgoing'>('outgoing');
  const [streams, setStreams] = useState<{ outgoing: ZkPaymentStream[]; incoming: ZkPaymentStream[] }>({
    outgoing: [],
    incoming: [],
  });
  const [showCreateModal, setShowCreateModal] = useState(Boolean(defaultRecipient));
  const [ticker, setTicker] = useState(0);

  // Form State for new stream
  const [recipientTag, setRecipientTag] = useState(defaultRecipient || '');
  const [depositAmount, setDepositAmount] = useState('50');
  const [token, setToken] = useState<'DAI' | 'USDC' | 'ETH'>('DAI');
  const [durationDays, setDurationDays] = useState(7);
  const [memo, setMemo] = useState('Freelance ongoing settlement');

  const refreshStreams = () => {
    setStreams(getUserStreams(userAddress));
  };

  useEffect(() => {
    refreshStreams();
    const handleUpdate = () => refreshStreams();
    window.addEventListener('ledger_zk_stream_updated', handleUpdate);
    return () => window.removeEventListener('ledger_zk_stream_updated', handleUpdate);
  }, [userAddress]);

  // Real-time ticking effect for continuous money streaming progress
  useEffect(() => {
    const interval = setInterval(() => {
      setTicker(t => t + 1);
    }, 500);
    return () => clearInterval(interval);
  }, []);

  const handleCreateStream = (e: React.FormEvent) => {
    e.preventDefault();
    if (!recipientTag || !depositAmount) return;

    const newStream = createShieldedStream({
      senderTag: userTag || `zk:${userAddress.slice(2, 8)}`,
      recipientTag: recipientTag.startsWith('zk:') ? recipientTag : `zk:${recipientTag}`,
      senderAddress: userAddress || '0x0',
      recipientAddress: recipientTag.startsWith('0x') ? recipientTag : '',
      token,
      depositAmount,
      durationSeconds: durationDays * 86400,
      memo,
    });

    if (onStreamCreated) {
      onStreamCreated(newStream);
    }

    setShowCreateModal(false);
    refreshStreams();
  };

  const activeList = tab === 'outgoing' ? streams.outgoing : streams.incoming;

  return (
    <div className={`bg-white rounded-3xl border border-black/[0.08] shadow-xl overflow-hidden flex flex-col ${className}`}>
      {/* Header */}
      <div className="bg-[#f2f4f7] px-6 py-4 flex items-center justify-between border-b border-black/[0.06]">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-2xl bg-[#15171c]/10 flex items-center justify-center text-[#15171c]">
            <Waves size={18} strokeWidth={2.5} />
          </div>
          <div>
            <h2 className="text-[15px] font-semibold text-gray-900 leading-tight">Shielded Payment Streams</h2>
            <p className="text-[12.5px] text-gray-500">Continuous private payments on Aztec</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={() => setShowCreateModal(true)}
            className="flex items-center gap-1.5 px-3 py-1.5 bg-[#15171c] text-white text-[12px] font-semibold rounded-xl hover:bg-[#000000] transition shadow-xs"
          >
            <Plus size={14} /> New Stream
          </button>
          {onClose && (
            <button
              onClick={onClose}
              className="w-8 h-8 rounded-full flex items-center justify-center hover:bg-black/5 text-gray-400 hover:text-gray-700 transition"
            >
              <X size={18} />
            </button>
          )}
        </div>
      </div>

      {/* Tabs */}
      <div className="px-6 pt-4 flex gap-2">
        <button
          onClick={() => setTab('outgoing')}
          className={`flex items-center gap-2 px-4 py-2 text-[12px] font-semibold rounded-xl transition ${
            tab === 'outgoing'
              ? 'bg-[#15171c] text-white shadow-xs'
              : 'bg-[#f2f4f7] text-gray-600 hover:bg-[#e4e6eb]'
          }`}
        >
          Outgoing ({streams.outgoing.length})
        </button>
        <button
          onClick={() => setTab('incoming')}
          className={`flex items-center gap-2 px-4 py-2 text-[12px] font-semibold rounded-xl transition ${
            tab === 'incoming'
              ? 'bg-[#15171c] text-white shadow-xs'
              : 'bg-[#f2f4f7] text-gray-600 hover:bg-[#e4e6eb]'
          }`}
        >
          Incoming ({streams.incoming.length})
        </button>
      </div>

      {/* Stream List */}
      <div className="p-6 space-y-3 overflow-y-auto max-h-[460px]">
        {activeList.length === 0 ? (
          <div className="text-center py-12 flex flex-col items-center gap-2 text-gray-400">
            <Waves size={32} strokeWidth={1.5} className="text-gray-300" />
            <p className="text-[13px] font-semibold text-gray-500">No active {tab} streams</p>
            <p className="text-[12.5px] text-gray-400 max-w-xs">
              Stream zkDAI privately by the second to creators, community channels, or freelance contributors.
            </p>
          </div>
        ) : (
          activeList.map(stream => (
            <StreamCard
              key={stream.id}
              stream={stream}
              userAddress={userAddress}
              isIncoming={tab === 'incoming'}
              onRefresh={refreshStreams}
            />
          ))
        )}
      </div>

      {/* Create Stream Modal */}
      <AnimatePresence>
        {showCreateModal && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-xs">
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="bg-white rounded-3xl p-6 w-full max-w-md shadow-2xl border border-black/[0.08] space-y-4"
            >
              <div className="flex items-center justify-between">
                <h3 className="text-[16px] font-semibold text-gray-900 flex items-center gap-2">
                  <Waves size={18} className="text-[#15171c]" /> Start Shielded Stream
                </h3>
                <button
                  onClick={() => setShowCreateModal(false)}
                  className="w-7 h-7 rounded-full flex items-center justify-center hover:bg-black/5 text-gray-400"
                >
                  <X size={16} />
                </button>
              </div>

              <form onSubmit={handleCreateStream} className="space-y-3">
                <div>
                  <label className="text-[12.5px] font-semibold text-gray-500">Recipient Handle</label>
                  <input
                    type="text"
                    required
                    value={recipientTag}
                    onChange={e => setRecipientTag(e.target.value)}
                    placeholder="zk:alice or 0x..."
                    className="w-full mt-1 bg-[#f2f4f7] border border-black/[0.06] rounded-xl px-3 py-2 text-[13px] tabular-nums outline-none focus:border-[#15171c]"
                  />
                </div>

                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <label className="text-[12.5px] font-semibold text-gray-500">Deposit Amount</label>
                    <input
                      type="number"
                      required
                      value={depositAmount}
                      onChange={e => setDepositAmount(e.target.value)}
                      className="w-full mt-1 bg-[#f2f4f7] border border-black/[0.06] rounded-xl px-3 py-2 text-[14px] font-semibold outline-none focus:border-[#15171c]"
                    />
                  </div>
                  <div>
                    <label className="text-[12.5px] font-semibold text-gray-500">Asset</label>
                    <select
                      value={token}
                      onChange={e => setToken(e.target.value as any)}
                      className="w-full mt-1 bg-[#f2f4f7] border border-black/[0.06] rounded-xl px-3 py-2 text-[13px] font-semibold outline-none"
                    >
                      <option value="DAI">zkDAI</option>
                      <option value="USDC">zkUSDC</option>
                      <option value="ETH">zkETH</option>
                    </select>
                  </div>
                </div>

                <div>
                  <label className="text-[12.5px] font-semibold text-gray-500">Duration</label>
                  <div className="grid grid-cols-3 gap-1.5 mt-1">
                    {[
                      { label: '24 Hours', days: 1 },
                      { label: '7 Days', days: 7 },
                      { label: '30 Days', days: 30 },
                    ].map(d => (
                      <button
                        type="button"
                        key={d.days}
                        onClick={() => setDurationDays(d.days)}
                        className={`py-1.5 text-[12.5px] font-semibold rounded-lg transition ${
                          durationDays === d.days
                            ? 'bg-[#15171c] text-white shadow-xs'
                            : 'bg-[#f2f4f7] text-gray-600 hover:bg-[#e4e6eb]'
                        }`}
                      >
                        {d.label}
                      </button>
                    ))}
                  </div>
                </div>

                <div>
                  <label className="text-[12.5px] font-semibold text-gray-500">Memo / Purpose</label>
                  <input
                    type="text"
                    value={memo}
                    onChange={e => setMemo(e.target.value)}
                    placeholder="e.g. Freelance sprint settlement"
                    className="w-full mt-1 bg-[#f2f4f7] border border-black/[0.06] rounded-xl px-3 py-2 text-[12px] outline-none focus:border-[#15171c]"
                  />
                </div>

                <div className="bg-[#15171c]/10 p-3 rounded-xl flex items-start gap-2">
                  <Lock size={14} className="text-[#15171c] mt-0.5 flex-shrink-0" />
                  <p className="text-[12.5px] text-gray-700 leading-tight">
                    Flow rate: <span className="font-semibold text-gray-900">{(parseFloat(depositAmount || '0') / (durationDays * 86400)).toFixed(6)} {token}/sec</span>. Recipient withdraws continuously in real-time.
                  </p>
                </div>

                <button
                  type="submit"
                  className="w-full py-3 bg-[#15171c] text-white text-[13px] font-semibold rounded-xl hover:bg-[#000000] transition shadow-sm"
                >
                  Confirm & Launch Shielded Stream
                </button>
              </form>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}

// ─── Stream Card Subcomponent ────────────────────────────────────────────────

function StreamCard({
  stream,
  userAddress,
  isIncoming,
  onRefresh,
}: {
  key?: React.Key;
  stream: ZkPaymentStream;
  userAddress: string;
  isIncoming: boolean;
  onRefresh: () => void;
}) {
  const [withdrawing, setWithdrawing] = useState(false);
  const progress = calculateStreamProgress(stream);

  const handleWithdraw = async () => {
    setWithdrawing(true);
    try {
      withdrawFromStream(stream.id, userAddress);
      onRefresh();
    } finally {
      setWithdrawing(false);
    }
  };

  const handleCancel = () => {
    cancelStream(stream.id, userAddress);
    onRefresh();
  };

  return (
    <div className="bg-[#f7f8fa] border border-black/[0.06] rounded-2xl p-4 space-y-3 hover:border-black/[0.12] transition">
      <div className="flex items-start justify-between">
        <div>
          <div className="flex items-center gap-1.5">
            <span className="text-[13px] font-semibold text-gray-900">
              {isIncoming ? stream.senderTag : stream.recipientTag}
            </span>
            <span
              className={`text-[12px] font-semibold px-2 py-0.5 rounded-full ${
                stream.status === 'active'
                  ? 'bg-[#15171c]/20 text-[#15171c]'
                  : stream.status === 'completed'
                  ? 'bg-blue-100 text-blue-600'
                  : 'bg-red-100 text-red-600'
              }`}
            >
              {stream.status}
            </span>
          </div>
          <p className="text-[12.5px] text-gray-500 mt-0.5">{stream.memo}</p>
        </div>

        <div className="text-right">
          <span className="text-[14px] tabular-nums font-semibold text-gray-900 block">
            {progress.formattedStreamed} / {stream.depositAmount} {stream.token}
          </span>
          <span className="text-[12px] text-gray-400 font-medium">
            {progress.percentCompleted.toFixed(1)}% delivered
          </span>
        </div>
      </div>

      {/* Animated Live Progress Bar */}
      <div className="w-full bg-black/5 rounded-full h-2 overflow-hidden relative">
        <div
          className="bg-gradient-to-r from-[#15171c] to-[#3A3A3C] h-full transition-all duration-500"
          style={{ width: `${progress.percentCompleted}%` }}
        />
      </div>

      <div className="flex items-center justify-between pt-1">
        <div className="flex items-center gap-1 text-[12.5px] text-gray-400">
          <Clock size={12} />
          <span>
            {progress.timeRemainingSeconds > 0
              ? `${Math.ceil(progress.timeRemainingSeconds / 3600)}h remaining`
              : 'Completed'}
          </span>
        </div>

        <div className="flex items-center gap-2">
          {isIncoming && stream.status === 'active' && (
            <button
              onClick={handleWithdraw}
              disabled={withdrawing || progress.withdrawableAmount <= 0.0001}
              className={`flex items-center gap-1 px-3 py-1 text-[12.5px] font-semibold rounded-lg transition ${
                progress.withdrawableAmount > 0.0001
                  ? 'bg-[#15171c] text-white hover:bg-[#000000]'
                  : 'bg-gray-200 text-gray-400 cursor-not-allowed'
              }`}
            >
              <ArrowDownLeft size={12} /> Withdraw ({progress.formattedWithdrawable})
            </button>
          )}

          {!isIncoming && stream.status === 'active' && (
            <button
              onClick={handleCancel}
              className="text-[12.5px] font-semibold text-[#d93036] hover:text-red-700 transition"
            >
              Cancel Stream
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
