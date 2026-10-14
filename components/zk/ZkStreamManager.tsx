'use client';

import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Waves,
  Play,
  Pause,
  XCircle,
  ArrowDownLeft,
  Plus,
  Clock,
  Shield,
  CheckCircle,
  ExternalLink,
  X,
  Sparkles
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
  onClose?: () => void;
  className?: string;
}

export function ZkStreamManager({ userAddress, userTag, onClose, className = '' }: ZkStreamManagerProps) {
  const [tab, setTab] = useState<'incoming' | 'outgoing'>('outgoing');
  const [streams, setStreams] = useState<{ outgoing: ZkPaymentStream[]; incoming: ZkPaymentStream[] }>({
    outgoing: [],
    incoming: [],
  });
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [ticker, setTicker] = useState(0);

  // Form State for new stream
  const [recipientTag, setRecipientTag] = useState('');
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

    createShieldedStream({
      senderTag: userTag || `zk:${userAddress.slice(2, 8)}`,
      recipientTag: recipientTag.startsWith('zk:') ? recipientTag : `zk:${recipientTag}`,
      senderAddress: userAddress,
      recipientAddress: recipientTag.startsWith('0x') ? recipientTag : undefined,
      token,
      depositAmount,
      durationSeconds: durationDays * 86400,
      memo,
    });

    setShowCreateModal(false);
    refreshStreams();
  };

  const activeList = tab === 'outgoing' ? streams.outgoing : streams.incoming;

  return (
    <div className={`bg-white rounded-3xl border border-black/[0.08] shadow-xl overflow-hidden flex flex-col ${className}`}>
      {/* Header */}
      <div className="bg-[#f0f2f5] px-6 py-4 flex items-center justify-between border-b border-black/[0.06]">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-2xl bg-[#25D366]/10 flex items-center justify-center text-[#25D366]">
            <Waves size={18} strokeWidth={2.5} />
          </div>
          <div>
            <h2 className="text-[15px] font-bold text-gray-900 leading-tight">Shielded Payment Streams</h2>
            <p className="text-[11px] text-gray-500">Continuous private payments on Aztec</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={() => setShowCreateModal(true)}
            className="flex items-center gap-1.5 px-3 py-1.5 bg-[#25D366] text-white text-[12px] font-bold rounded-xl hover:bg-[#20ba59] transition shadow-xs"
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
          className={`flex items-center gap-2 px-4 py-2 text-[12px] font-bold rounded-xl transition ${
            tab === 'outgoing'
              ? 'bg-[#25D366] text-white shadow-xs'
              : 'bg-[#f0f2f5] text-gray-600 hover:bg-[#e4e6eb]'
          }`}
        >
          Outgoing ({streams.outgoing.length})
        </button>
        <button
          onClick={() => setTab('incoming')}
          className={`flex items-center gap-2 px-4 py-2 text-[12px] font-bold rounded-xl transition ${
            tab === 'incoming'
              ? 'bg-[#25D366] text-white shadow-xs'
              : 'bg-[#f0f2f5] text-gray-600 hover:bg-[#e4e6eb]'
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
            <p className="text-[11px] text-gray-400 max-w-xs">
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
                <h3 className="text-[16px] font-bold text-gray-900 flex items-center gap-2">
                  <Waves size={18} className="text-[#25D366]" /> Start Shielded Stream
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
                  <label className="text-[11px] font-semibold text-gray-500 uppercase">Recipient Handle</label>
                  <input
                    type="text"
                    required
                    value={recipientTag}
                    onChange={e => setRecipientTag(e.target.value)}
                    placeholder="zk:alice or 0x..."
                    className="w-full mt-1 bg-[#f0f2f5] border border-black/[0.06] rounded-xl px-3 py-2 text-[13px] font-mono outline-none focus:border-[#25D366]"
                  />
                </div>

                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <label className="text-[11px] font-semibold text-gray-500 uppercase">Deposit Amount</label>
                    <input
                      type="number"
                      required
                      value={depositAmount}
                      onChange={e => setDepositAmount(e.target.value)}
                      className="w-full mt-1 bg-[#f0f2f5] border border-black/[0.06] rounded-xl px-3 py-2 text-[14px] font-bold outline-none focus:border-[#25D366]"
                    />
                  </div>
                  <div>
                    <label className="text-[11px] font-semibold text-gray-500 uppercase">Asset</label>
                    <select
                      value={token}
                      onChange={e => setToken(e.target.value as any)}
                      className="w-full mt-1 bg-[#f0f2f5] border border-black/[0.06] rounded-xl px-3 py-2 text-[13px] font-bold outline-none"
                    >
                      <option value="DAI">zkDAI</option>
                      <option value="USDC">zkUSDC</option>
                      <option value="ETH">zkETH</option>
                    </select>
                  </div>
                </div>

                <div>
                  <label className="text-[11px] font-semibold text-gray-500 uppercase">Duration</label>
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
                        className={`py-1.5 text-[11px] font-bold rounded-lg transition ${
                          durationDays === d.days
                            ? 'bg-[#25D366] text-white shadow-xs'
                            : 'bg-[#f0f2f5] text-gray-600 hover:bg-[#e4e6eb]'
                        }`}
                      >
                        {d.label}
                      </button>
                    ))}
                  </div>
                </div>

                <div>
                  <label className="text-[11px] font-semibold text-gray-500 uppercase">Memo / Purpose</label>
                  <input
                    type="text"
                    value={memo}
                    onChange={e => setMemo(e.target.value)}
                    placeholder="e.g. Freelance sprint settlement"
                    className="w-full mt-1 bg-[#f0f2f5] border border-black/[0.06] rounded-xl px-3 py-2 text-[12px] outline-none focus:border-[#25D366]"
                  />
                </div>

                <div className="bg-[#25D366]/10 p-3 rounded-xl flex items-start gap-2">
                  <Shield size={14} className="text-[#25D366] mt-0.5 flex-shrink-0" />
                  <p className="text-[11px] text-gray-700 leading-tight">
                    Flow rate: <span className="font-bold text-gray-900">{(parseFloat(depositAmount || '0') / (durationDays * 86400)).toFixed(6)} {token}/sec</span>. Recipient withdraws continuously in real-time.
                  </p>
                </div>

                <button
                  type="submit"
                  className="w-full py-3 bg-[#25D366] text-white text-[13px] font-bold rounded-xl hover:bg-[#20ba59] transition shadow-sm"
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
    <div className="bg-[#FAFAFA] border border-black/[0.06] rounded-2xl p-4 space-y-3 hover:border-black/[0.12] transition">
      <div className="flex items-start justify-between">
        <div>
          <div className="flex items-center gap-1.5">
            <span className="text-[13px] font-bold text-gray-900">
              {isIncoming ? stream.senderTag : stream.recipientTag}
            </span>
            <span
              className={`text-[9px] font-bold px-2 py-0.5 rounded-full uppercase ${
                stream.status === 'active'
                  ? 'bg-[#25D366]/20 text-[#25D366]'
                  : stream.status === 'completed'
                  ? 'bg-blue-100 text-blue-600'
                  : 'bg-red-100 text-red-600'
              }`}
            >
              {stream.status}
            </span>
          </div>
          <p className="text-[11px] text-gray-500 mt-0.5">{stream.memo}</p>
        </div>

        <div className="text-right">
          <span className="text-[14px] font-mono font-bold text-gray-900 block">
            {progress.formattedStreamed} / {stream.depositAmount} {stream.token}
          </span>
          <span className="text-[10px] text-gray-400 font-medium">
            {progress.percentCompleted.toFixed(1)}% delivered
          </span>
        </div>
      </div>

      {/* Animated Live Progress Bar */}
      <div className="w-full bg-black/5 rounded-full h-2 overflow-hidden relative">
        <div
          className="bg-gradient-to-r from-[#25D366] to-[#128C7E] h-full transition-all duration-500"
          style={{ width: `${progress.percentCompleted}%` }}
        />
      </div>

      <div className="flex items-center justify-between pt-1">
        <div className="flex items-center gap-1 text-[11px] text-gray-400">
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
              className={`flex items-center gap-1 px-3 py-1 text-[11px] font-bold rounded-lg transition ${
                progress.withdrawableAmount > 0.0001
                  ? 'bg-[#25D366] text-white hover:bg-[#20ba59]'
                  : 'bg-gray-200 text-gray-400 cursor-not-allowed'
              }`}
            >
              <ArrowDownLeft size={12} /> Withdraw ({progress.formattedWithdrawable})
            </button>
          )}

          {!isIncoming && stream.status === 'active' && (
            <button
              onClick={handleCancel}
              className="text-[11px] font-bold text-red-500 hover:text-red-700 transition"
            >
              Cancel Stream
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
