'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Shield, ArrowUpRight, ArrowDownLeft, RefreshCw, X,
  ExternalLink, QrCode, Lock, TrendingUp, Clock, ChevronDown,
  ChevronUp, Wifi, WifiOff, AlertCircle, CheckCircle,
} from 'lucide-react';
import {
  getShieldedBalances,
  getZkTransactionHistory,
  calculatePrivacyScore,
  getNotesByAddress,
  syncBalanceFromAztec,
  resolveZkTag,
  formatAmount,
  formatUSDValue,
  relativeTime,
  ZkShieldedBalance,
  ZkTransactionRecord,
  ZkNote,
  ZkPrivacyAnalysis,
  AZTEC_EXPLORER,
} from '@/lib/zk/zkMoney';
import { getIdentity, resolveDisplayName, getAvatarColor, getInitials } from '@/lib/zk/zkIdentity';

// ─── Props ─────────────────────────────────────────────────────────────────────

interface ZkWalletPanelProps {
  address: string;
  onClose: () => void;
  onShield?: () => void;
  onUnshield?: () => void;
  onSend?: () => void;
  className?: string;
}

// ─── Sub-components ────────────────────────────────────────────────────────────

function TokenCard({
  symbol,
  balance,
  usdValue,
  emoji,
  delay,
}: {
  symbol: string;
  balance: string;
  usdValue: string;
  emoji: string;
  delay: number;
}) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay, duration: 0.3 }}
      className="bg-white rounded-2xl p-4 shadow-sm border border-black/[0.04] flex items-center gap-3"
    >
      <div className="w-11 h-11 rounded-full flex items-center justify-center text-xl"
        style={{ background: 'linear-gradient(135deg, #efeae2, #EBE5DC)' }}>
        {emoji}
      </div>
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-1.5">
          <span className="text-xs font-semibold text-gray-500 uppercase tracking-wide">zk{symbol}</span>
          <span className="flex items-center gap-0.5 text-[10px] font-medium text-[#25D366] bg-[#25D366]/10 px-1.5 py-0.5 rounded-full">
            <Shield size={8} strokeWidth={2.5} /> Private
          </span>
        </div>
        <div className="text-[17px] font-bold text-gray-900 leading-tight mt-0.5">
          {balance}
        </div>
        <div className="text-[11px] text-gray-400 mt-0.5">{usdValue}</div>
      </div>
    </motion.div>
  );
}

function ActionButton({
  icon: Icon,
  label,
  onClick,
  color = '#25D366',
}: {
  icon: React.ElementType;
  label: string;
  onClick?: () => void;
  color?: string;
}) {
  return (
    <button
      onClick={onClick}
      className="flex flex-col items-center gap-1.5 p-3 rounded-2xl active:scale-95 transition-transform"
      style={{ background: `${color}15` }}
    >
      <div className="w-10 h-10 rounded-full flex items-center justify-center"
        style={{ background: color }}>
        <Icon size={18} className="text-white" strokeWidth={2} />
      </div>
      <span className="text-[11px] font-semibold text-gray-700">{label}</span>
    </button>
  );
}

function PrivacyRing({ score }: { score: number }) {
  const color = score >= 70 ? '#25D366' : score >= 40 ? '#FF9500' : '#FF3B30';
  const deg   = Math.round((score / 100) * 360);
  return (
    <div className="relative w-16 h-16 flex items-center justify-center">
      <div
        className="absolute inset-0 rounded-full"
        style={{
          background: `conic-gradient(${color} 0deg, ${color} ${deg}deg, #EBE5DC ${deg}deg, #EBE5DC 360deg)`,
        }}
      />
      <div className="absolute inset-2 rounded-full bg-white flex items-center justify-center">
        <span className="text-[13px] font-bold" style={{ color }}>{score}</span>
      </div>
    </div>
  );
}

function NoteStatusBadge({ status }: { status: ZkNote['status'] }) {
  const map: Record<ZkNote['status'], { label: string; color: string; bg: string }> = {
    pending:   { label: 'Pending',   color: '#FF9500', bg: '#FF9500/10' },
    settled:   { label: 'Settled',   color: '#25D366', bg: '#25D366/10' },
    spent:     { label: 'Spent',     color: '#8E8E93', bg: '#8E8E93/10' },
    nullified: { label: 'Nullified', color: '#FF3B30', bg: '#FF3B30/10' },
  };
  const { label, color } = map[status];
  return (
    <span
      className="text-[10px] font-semibold px-2 py-0.5 rounded-full"
      style={{ color, background: `${color}20` }}
    >
      {label}
    </span>
  );
}

// ─── Main Component ────────────────────────────────────────────────────────────

export function ZkWalletPanel({ address, onClose, onShield, onUnshield, onSend, className }: ZkWalletPanelProps) {
  const [balance,     setBalance]     = useState<ZkShieldedBalance>(getShieldedBalances(address));
  const [history,     setHistory]     = useState<ZkTransactionRecord[]>([]);
  const [notes,       setNotes]       = useState<ZkNote[]>([]);
  const [privacy,     setPrivacy]     = useState<ZkPrivacyAnalysis | null>(null);
  const [syncing,     setSyncing]     = useState(false);
  const [syncOk,      setSyncOk]      = useState<boolean | null>(null);
  const [showNotes,   setShowNotes]   = useState(false);
  const [showPrivacy, setShowPrivacy] = useState(false);

  const identity = getIdentity(address);
  const handle   = resolveZkTag(address);
  const displayName = resolveDisplayName(address);
  const avatarColor = getAvatarColor(address);
  const initials = identity ? getInitials(identity) : handle.slice(3, 5).toUpperCase();

  // Total USD value
  const totalUSD = (() => {
    const dai  = parseFloat(balance.dai.replace(/,/g, ''))  || 0;
    const usdc = parseFloat(balance.usdc.replace(/,/g, '')) || 0;
    const eth  = parseFloat(balance.eth.replace(/,/g, ''))  || 0;
    return (dai + usdc + eth * 2650).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  })();

  const refresh = useCallback(() => {
    setBalance(getShieldedBalances(address));
    setHistory(getZkTransactionHistory(address).slice(0, 20));
    setNotes(getNotesByAddress(address).slice(0, 20));

    const lastTx = getZkTransactionHistory(address)[0];
    if (lastTx) {
      setPrivacy(calculatePrivacyScore(lastTx));
    }
  }, [address]);

  useEffect(() => {
    refresh();
    const handler = () => refresh();
    window.addEventListener('ledger_zk_balance_updated', handler);
    window.addEventListener('ledger_zk_payment_sent', handler);
    window.addEventListener('ledger_zk_note_settled', handler);
    return () => {
      window.removeEventListener('ledger_zk_balance_updated', handler);
      window.removeEventListener('ledger_zk_payment_sent', handler);
      window.removeEventListener('ledger_zk_note_settled', handler);
    };
  }, [refresh]);

  const handleSync = async () => {
    setSyncing(true);
    setSyncOk(null);
    try {
      const synced = await syncBalanceFromAztec(address);
      setBalance(synced);
      setSyncOk(true);
    } catch {
      setSyncOk(false);
    } finally {
      setSyncing(false);
      setTimeout(() => setSyncOk(null), 3000);
    }
  };

  return (
    <motion.div
      initial={{ opacity: 0, x: 40 }}
      animate={{ opacity: 1, x: 0 }}
      exit={{ opacity: 0, x: 40 }}
      transition={{ type: 'spring', stiffness: 320, damping: 30 }}
      className={`flex flex-col h-full bg-[#f0f2f5] ${className ?? ''}`}
      style={{ fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif' }}
    >
      {/* ── Header ── */}
      <div className="flex-shrink-0 bg-white px-4 pt-5 pb-4 border-b border-black/[0.06]">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-3">
            {/* Avatar */}
            <div
              className="w-11 h-11 rounded-full flex items-center justify-center text-white font-bold text-sm shadow-sm"
              style={{ background: avatarColor }}
            >
              {initials}
            </div>
            <div>
              <div className="flex items-center gap-1.5">
                <span className="font-semibold text-gray-900 text-[15px]">{displayName}</span>
                {identity?.verified && (
                  <CheckCircle size={13} className="text-[#25D366]" strokeWidth={2.5} />
                )}
              </div>
              <div className="text-[12px] text-gray-400 font-medium">{handle}</div>
            </div>
          </div>
          <button
            onClick={onClose}
            className="w-8 h-8 flex items-center justify-center rounded-full bg-black/5 hover:bg-black/10 transition-colors"
          >
            <X size={16} className="text-gray-600" />
          </button>
        </div>

        {/* Total balance pill */}
        <div className="flex items-center gap-2 bg-[#25D366]/10 rounded-2xl px-4 py-3">
          <Shield size={16} className="text-[#25D366]" strokeWidth={2} />
          <div>
            <div className="text-[11px] text-[#25D366] font-semibold uppercase tracking-wide">Total Shielded Balance</div>
            <div className="text-[20px] font-bold text-gray-900">≈ ${totalUSD}</div>
          </div>
          <div className="ml-auto">
            <button
              onClick={handleSync}
              disabled={syncing}
              className="flex items-center gap-1.5 text-[11px] font-medium text-[#00a884] bg-[#00a884]/10 px-3 py-1.5 rounded-full hover:bg-[#00a884]/20 transition-colors disabled:opacity-60"
            >
              <RefreshCw size={11} className={syncing ? 'animate-spin' : ''} />
              {syncing ? 'Syncing…' : 'Sync'}
            </button>
          </div>
        </div>

        {syncOk === true && (
          <div className="mt-2 flex items-center gap-1.5 text-[11px] text-[#25D366] font-medium">
            <Wifi size={11} /> Synced from Aztec Network
          </div>
        )}
        {syncOk === false && (
          <div className="mt-2 flex items-center gap-1.5 text-[11px] text-orange-500 font-medium">
            <WifiOff size={11} /> Aztec node unreachable — using local cache
          </div>
        )}
      </div>

      {/* ── Scrollable content ── */}
      <div className="flex-1 overflow-y-auto overscroll-contain px-4 py-4 space-y-4">

        {/* Token balances */}
        <div className="space-y-2.5">
          <TokenCard symbol="DAI"  balance={balance.dai}  usdValue={`≈ $${balance.dai}`}  emoji="◈" delay={0.05} />
          <TokenCard symbol="USDC" balance={balance.usdc} usdValue={`≈ $${balance.usdc}`} emoji="$" delay={0.10} />
          <TokenCard symbol="ETH"  balance={balance.eth}  usdValue={formatUSDValue(balance.eth, 'ETH')} emoji="Ξ" delay={0.15} />
        </div>

        {/* Actions */}
        <div className="grid grid-cols-4 gap-2">
          <ActionButton icon={Shield}         label="Shield"   onClick={onShield}   color="#25D366" />
          <ActionButton icon={ArrowDownLeft}  label="Unshield" onClick={onUnshield} color="#00a884" />
          <ActionButton icon={ArrowUpRight}   label="Send"     onClick={onSend}     color="#128C7E" />
          <ActionButton icon={QrCode}         label="Receive"  color="#34C759"      />
        </div>

        {/* Privacy Score */}
        {privacy && (
          <div className="bg-white rounded-2xl shadow-sm border border-black/[0.04] overflow-hidden">
            <button
              className="w-full flex items-center gap-3 px-4 py-3"
              onClick={() => setShowPrivacy(v => !v)}
            >
              <Lock size={16} className="text-[#25D366]" strokeWidth={2} />
              <span className="font-semibold text-gray-800 text-[14px] flex-1 text-left">Privacy Score</span>
              <PrivacyRing score={privacy.score} />
              {showPrivacy ? <ChevronUp size={14} className="text-gray-400" /> : <ChevronDown size={14} className="text-gray-400" />}
            </button>
            <AnimatePresence>
              {showPrivacy && (
                <motion.div
                  initial={{ height: 0, opacity: 0 }}
                  animate={{ height: 'auto', opacity: 1 }}
                  exit={{ height: 0, opacity: 0 }}
                  transition={{ duration: 0.2 }}
                  className="overflow-hidden"
                >
                  <div className="px-4 pb-4 space-y-3">
                    <div className="grid grid-cols-3 gap-2 text-center">
                      {[
                        { label: 'Anonymity Set', value: `${privacy.anonymitySetSize} wallets` },
                        { label: 'Note Age',      value: `${privacy.noteAge} blocks` },
                        { label: 'Risk Level',    value: privacy.riskLevel.charAt(0).toUpperCase() + privacy.riskLevel.slice(1) },
                      ].map(({ label, value }) => (
                        <div key={label} className="bg-[#f0f2f5] rounded-xl p-2">
                          <div className="text-[10px] text-gray-400 font-medium">{label}</div>
                          <div className="text-[12px] font-bold text-gray-800 mt-0.5">{value}</div>
                        </div>
                      ))}
                    </div>
                    <div className="space-y-1.5">
                      {privacy.suggestions.map((s, i) => (
                        <div key={i} className="flex items-start gap-2 text-[11px] text-gray-500">
                          <AlertCircle size={11} className="mt-0.5 text-orange-400 flex-shrink-0" />
                          <span>{s}</span>
                        </div>
                      ))}
                    </div>
                    <a
                      href="https://aztec.network"
                      target="_blank"
                      rel="noopener noreferrer"
                      className="flex items-center gap-1 text-[10px] text-[#25D366] font-medium"
                    >
                      <ExternalLink size={9} /> Powered by Aztec Network
                    </a>
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        )}

        {/* Transaction History */}
        <div className="bg-white rounded-2xl shadow-sm border border-black/[0.04] overflow-hidden">
          <div className="px-4 py-3 border-b border-black/[0.04] flex items-center justify-between">
            <div className="flex items-center gap-2">
              <TrendingUp size={15} className="text-[#25D366]" strokeWidth={2} />
              <span className="font-semibold text-gray-800 text-[14px]">Recent Transactions</span>
            </div>
            <span className="text-[11px] text-gray-400">{history.length} records</span>
          </div>

          {history.length === 0 ? (
            <div className="py-8 flex flex-col items-center gap-3 text-gray-400">
              <Shield size={28} strokeWidth={1.5} className="text-gray-300" />
              <span className="text-[13px]">No shielded transactions yet</span>
              <span className="text-[11px] text-center text-gray-300 max-w-[160px]">
                Send your first private payment to get started
              </span>
            </div>
          ) : (
            <div className="divide-y divide-black/[0.04]">
              {history.map((tx, i) => {
                const isSent = tx.direction === 'sent';
                return (
                  <div key={tx.txHash + i} className="flex items-center gap-3 px-4 py-3">
                    <div
                      className="w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0"
                      style={{ background: isSent ? '#FF3B30/15' : '#25D366/15' }}
                    >
                      {isSent
                        ? <ArrowUpRight size={14} className="text-red-400" />
                        : <ArrowDownLeft size={14} className="text-[#25D366]" />
                      }
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="text-[13px] font-semibold text-gray-800 truncate">
                        {isSent ? `To ${tx.recipientTag}` : `From ${tx.senderTag}`}
                      </div>
                      <div className="flex items-center gap-1.5 mt-0.5">
                        <Clock size={9} className="text-gray-300" />
                        <span className="text-[10px] text-gray-400">{relativeTime(tx.timestamp)}</span>
                        <span className="text-gray-200">·</span>
                        <span className="text-[10px] text-gray-400">Score: {tx.privacyScore}</span>
                      </div>
                    </div>
                    <div className="flex flex-col items-end gap-1 flex-shrink-0">
                      <span
                        className="text-[13px] font-bold"
                        style={{ color: isSent ? '#FF3B30' : '#25D366' }}
                      >
                        {isSent ? '-' : '+'}{tx.amount} {tx.token}
                      </span>
                      <a
                        href={tx.aztecExplorerUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        onClick={e => e.stopPropagation()}
                        className="text-[9px] text-[#00a884] flex items-center gap-0.5"
                      >
                        <ExternalLink size={8} /> AztecScan
                      </a>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* Note Lifecycle */}
        <div className="bg-white rounded-2xl shadow-sm border border-black/[0.04] overflow-hidden">
          <button
            className="w-full flex items-center gap-2 px-4 py-3"
            onClick={() => setShowNotes(v => !v)}
          >
            <Lock size={15} className="text-[#00a884]" strokeWidth={2} />
            <span className="font-semibold text-gray-800 text-[14px] flex-1 text-left">
              Shielded Notes ({notes.length})
            </span>
            {showNotes ? <ChevronUp size={14} className="text-gray-400" /> : <ChevronDown size={14} className="text-gray-400" />}
          </button>
          <AnimatePresence>
            {showNotes && (
              <motion.div
                initial={{ height: 0, opacity: 0 }}
                animate={{ height: 'auto', opacity: 1 }}
                exit={{ height: 0, opacity: 0 }}
                transition={{ duration: 0.2 }}
                className="overflow-hidden"
              >
                {notes.length === 0 ? (
                  <div className="px-4 pb-4 text-[12px] text-gray-400">No notes yet</div>
                ) : (
                  <div className="divide-y divide-black/[0.04]">
                    {notes.map(note => (
                      <div key={note.id} className="flex items-center gap-3 px-4 py-2.5">
                        <span className="text-[12px] font-semibold text-gray-700">{note.amount} {note.token}</span>
                        <NoteStatusBadge status={note.status} />
                        <span className="ml-auto text-[10px] text-gray-400">{relativeTime(note.timestamp)}</span>
                      </div>
                    ))}
                  </div>
                )}
              </motion.div>
            )}
          </AnimatePresence>
        </div>

        {/* Receive section */}
        <div className="bg-white rounded-2xl shadow-sm border border-black/[0.04] p-4">
          <div className="flex items-center gap-2 mb-3">
            <QrCode size={15} className="text-[#25D366]" strokeWidth={2} />
            <span className="font-semibold text-gray-800 text-[14px]">Receive Shielded Payment</span>
          </div>
          <div className="border-2 border-dashed border-[#EBE5DC] rounded-2xl p-6 flex flex-col items-center gap-3">
            <Shield size={32} className="text-[#EBE5DC]" strokeWidth={1.5} />
            <div className="text-center">
              <div className="text-[13px] font-semibold text-gray-700">{handle}</div>
              <div className="text-[10px] text-gray-400 mt-0.5">Share your zk handle to receive private payments</div>
            </div>
            <button
              onClick={() => {
                navigator.clipboard?.writeText(handle);
              }}
              className="text-[11px] font-semibold text-[#25D366] bg-[#25D366]/10 px-4 py-2 rounded-full"
            >
              Copy Handle
            </button>
          </div>
        </div>

        {/* Footer */}
        <div className="flex items-center justify-center gap-2 py-2">
          <Shield size={11} className="text-gray-300" />
          <span className="text-[10px] text-gray-400">
            Powered by <a href="https://aztec.network" target="_blank" rel="noopener noreferrer" className="text-[#25D366] font-medium">Aztec Network</a>
            {' · '}
            <a href="https://aztecscan.xyz" target="_blank" rel="noopener noreferrer" className="text-[#25D366] font-medium">AztecScan</a>
          </span>
        </div>
      </div>
    </motion.div>
  );
}
