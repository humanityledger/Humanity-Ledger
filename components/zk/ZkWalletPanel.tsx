'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Lock, ArrowDownToLine, ArrowUpFromLine, Send, QrCode, RefreshCw, X,
  ExternalLink, TrendingUp, Clock, ChevronDown, ChevronUp, Wifi, WifiOff,
  AlertCircle, CheckCircle, Copy, Check, Sparkles, Layers
} from 'lucide-react';
import { QRCodeSVG } from 'qrcode.react';
import { toast } from 'sonner';
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
  SupportedToken,
} from '@/lib/zk/zkMoney';
import { getIdentity, resolveDisplayName, getAvatarColor, getInitials } from '@/lib/zk/zkIdentity';
import { ZkShieldModal } from './ZkShieldModal';
import { ZkMoneyModal } from '../chat/ZkMoneyModal';

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
      className="bg-white rounded-2xl p-4 shadow-sm border border-black/[0.04] flex items-center gap-3.5"
    >
      <div
        className="w-11 h-11 rounded-full flex items-center justify-center text-lg font-bold shadow-inner"
        style={{ background: 'linear-gradient(135deg, #F4F4F6, #E5E5EA)', color: '#1C1C1E' }}
      >
        {emoji}
      </div>
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2">
          <span className="text-xs font-bold text-gray-700 tracking-wide">zk{symbol}</span>
          <span className="inline-flex items-center gap-1 text-[10px] font-semibold text-[#00a884] bg-[#00a884]/10 px-2 py-0.5 rounded-full">
            <span className="w-1.5 h-1.5 rounded-full bg-[#00a884]" /> Private
          </span>
        </div>
        <div className="text-[17px] font-extrabold text-gray-900 leading-tight mt-0.5 font-mono">
          {balance}
        </div>
        <div className="text-[11px] text-gray-400 font-medium mt-0.5">{usdValue}</div>
      </div>
    </motion.div>
  );
}

function ActionButton({
  icon: Icon,
  label,
  sublabel,
  onClick,
  color = '#00a884',
}: {
  icon: React.ElementType;
  label: string;
  sublabel?: string;
  onClick?: () => void;
  color?: string;
}) {
  return (
    <button
      onClick={onClick}
      type="button"
      className="flex flex-col items-center justify-center gap-1.5 p-3 rounded-2xl active:scale-95 transition-all duration-200 border border-black/[0.03] shadow-sm hover:shadow-md"
      style={{ background: '#FFFFFF' }}
    >
      <div
        className="w-10 h-10 rounded-full flex items-center justify-center text-white shadow-sm"
        style={{ background: color }}
      >
        <Icon size={18} strokeWidth={2.2} />
      </div>
      <span className="text-[12px] font-bold text-gray-800 leading-tight">{label}</span>
      {sublabel && (
        <span className="text-[9px] text-gray-400 font-medium leading-none">{sublabel}</span>
      )}
    </button>
  );
}

function PrivacyRing({ score }: { score: number }) {
  const color = score >= 70 ? '#00a884' : score >= 40 ? '#FF9500' : '#FF3B30';
  const deg   = Math.round((score / 100) * 360);
  return (
    <div className="relative w-14 h-14 flex items-center justify-center">
      <div
        className="absolute inset-0 rounded-full"
        style={{
          background: `conic-gradient(${color} 0deg, ${color} ${deg}deg, #E5E5EA ${deg}deg, #E5E5EA 360deg)`,
        }}
      />
      <div className="absolute inset-1.5 rounded-full bg-white flex items-center justify-center shadow-inner">
        <span className="text-[12px] font-extrabold font-mono" style={{ color }}>{score}</span>
      </div>
    </div>
  );
}

function NoteStatusBadge({ status }: { status: ZkNote['status'] }) {
  const map: Record<ZkNote['status'], { label: string; color: string; bg: string }> = {
    pending:   { label: 'Pending',   color: '#FF9500', bg: '#FF9500/10' },
    settled:   { label: 'Settled',   color: '#00a884', bg: '#00a884/10' },
    spent:     { label: 'Spent',     color: '#8E8E93', bg: '#8E8E93/10' },
    nullified: { label: 'Nullified', color: '#FF3B30', bg: '#FF3B30/10' },
  };
  const { label, color } = map[status];
  return (
    <span
      className="text-[10px] font-bold px-2 py-0.5 rounded-full"
      style={{ color, background: `${color}18` }}
    >
      {label}
    </span>
  );
}

// ─── Main Component ────────────────────────────────────────────────────────────

export function ZkWalletPanel({
  address,
  onClose,
  onShield,
  onUnshield,
  onSend,
  className
}: ZkWalletPanelProps) {
  const [balance, setBalance] = useState<ZkShieldedBalance>(() => getShieldedBalances(address));
  const [history, setHistory] = useState<ZkTransactionRecord[]>([]);
  const [notes, setNotes] = useState<ZkNote[]>([]);
  const [privacy, setPrivacy] = useState<ZkPrivacyAnalysis | null>(null);
  const [syncing, setSyncing] = useState(false);
  const [syncOk, setSyncOk] = useState<boolean | null>(null);
  const [showNotes, setShowNotes] = useState(false);
  const [showPrivacy, setShowPrivacy] = useState(false);
  const [copiedHandle, setCopiedHandle] = useState(false);
  const [copiedAddress, setCopiedAddress] = useState(false);

  // Native self-contained modal states
  const [activeInternalModal, setActiveInternalModal] = useState<'shield' | 'unshield' | 'send' | 'receive' | null>(null);

  const identity = getIdentity(address);
  const handle = resolveZkTag(address);
  const displayName = resolveDisplayName(address);
  const avatarColor = getAvatarColor(address);
  const initials = identity ? getInitials(identity) : handle.slice(3, 5).toUpperCase();

  // Total USD value computed from real shielded balances
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
      toast.success('Shielded balance synchronized with Aztec network');
    } catch {
      setSyncOk(false);
      toast.error('Could not reach Aztec sequencer; using secure local PXE state');
    } finally {
      setSyncing(false);
      setTimeout(() => setSyncOk(null), 3000);
    }
  };

  const copyToClipboard = (text: string, type: 'handle' | 'address') => {
    if (!text) return;
    navigator.clipboard?.writeText(text);
    if (type === 'handle') {
      setCopiedHandle(true);
      setTimeout(() => setCopiedHandle(false), 2000);
      toast.success('Zk handle copied to clipboard');
    } else {
      setCopiedAddress(true);
      setTimeout(() => setCopiedAddress(false), 2000);
      toast.success('EVM address copied to clipboard');
    }
  };

  // Button actions trigger parent handlers if provided, or open native modal directly
  const handleShieldClick = () => {
    if (onShield) onShield();
    else setActiveInternalModal('shield');
  };

  const handleUnshieldClick = () => {
    if (onUnshield) onUnshield();
    else setActiveInternalModal('unshield');
  };

  const handleSendClick = () => {
    if (onSend) onSend();
    else setActiveInternalModal('send');
  };

  const handleReceiveClick = () => {
    setActiveInternalModal('receive');
  };

  return (
    <>
      <motion.div
        initial={{ opacity: 0, x: 40 }}
        animate={{ opacity: 1, x: 0 }}
        exit={{ opacity: 0, x: 40 }}
        transition={{ type: 'spring', stiffness: 320, damping: 30 }}
        className={`flex flex-col h-full bg-[#F4F4F6] text-gray-900 ${className ?? ''}`}
        style={{ fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif' }}
      >
        {/* ── Header ── */}
        <div className="flex-shrink-0 bg-white px-5 pt-5 pb-4 border-b border-black/[0.06] shadow-sm">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-3">
              {/* Avatar */}
              <div
                className="w-11 h-11 rounded-full flex items-center justify-center text-white font-extrabold text-sm shadow-sm"
                style={{ background: avatarColor }}
              >
                {initials}
              </div>
              <div>
                <div className="flex items-center gap-1.5">
                  <span className="font-bold text-gray-900 text-[15px]">{displayName}</span>
                  {identity?.verified && (
                    <CheckCircle size={13} className="text-[#00a884]" strokeWidth={2.5} />
                  )}
                </div>
                <div className="text-[12px] text-gray-400 font-mono font-medium">{handle}</div>
              </div>
            </div>
            <button
              onClick={onClose}
              type="button"
              className="w-8 h-8 flex items-center justify-center rounded-full bg-black/5 hover:bg-black/10 transition-colors"
            >
              <X size={16} className="text-gray-600" />
            </button>
          </div>

          {/* Total balance card (no weird shields, clean executive privacy styling) */}
          <div className="bg-gradient-to-br from-[#1C1C1E] to-[#2C2C2E] rounded-2xl p-4 text-white shadow-md">
            <div className="flex items-center justify-between mb-1">
              <div className="flex items-center gap-1.5 text-[11px] font-bold text-[#25D366] uppercase tracking-wider">
                <Lock size={12} strokeWidth={2.5} />
                <span>Total Shielded Balance</span>
              </div>
              <button
                onClick={handleSync}
                disabled={syncing}
                type="button"
                className="flex items-center gap-1 text-[11px] font-semibold text-white/80 bg-white/10 hover:bg-white/20 px-2.5 py-1 rounded-full transition-colors disabled:opacity-50"
              >
                <RefreshCw size={11} className={syncing ? 'animate-spin' : ''} />
                <span>{syncing ? 'Syncing…' : 'Sync'}</span>
              </button>
            </div>
            <div className="text-[26px] font-black tracking-tight font-mono text-white mt-1">
              ≈ ${totalUSD}
            </div>
            <div className="text-[11px] text-white/50 mt-1 flex items-center gap-1.5 font-medium">
              <span className="w-1.5 h-1.5 rounded-full bg-[#25D366]" />
              Client-side UltraPlonk Protected · Zero Knowledge
            </div>
          </div>

          {syncOk === true && (
            <div className="mt-2.5 flex items-center gap-1.5 text-[11px] text-[#00a884] font-semibold">
              <Wifi size={12} /> Synced from Aztec Mainnet Sequencer
            </div>
          )}
          {syncOk === false && (
            <div className="mt-2.5 flex items-center gap-1.5 text-[11px] text-amber-600 font-semibold">
              <WifiOff size={12} /> Offline cache active — Local PXE secure
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

          {/* Action buttons (Executive Swiss UI — clean functional icons) */}
          <div className="grid grid-cols-4 gap-2">
            <ActionButton
              icon={ArrowDownToLine}
              label="Shield"
              sublabel="L1→ZK"
              onClick={handleShieldClick}
              color="#00a884"
            />
            <ActionButton
              icon={ArrowUpFromLine}
              label="Unshield"
              sublabel="ZK→L1"
              onClick={handleUnshieldClick}
              color="#128C7E"
            />
            <ActionButton
              icon={Send}
              label="Send"
              sublabel="Private"
              onClick={handleSendClick}
              color="#008069"
            />
            <ActionButton
              icon={QrCode}
              label="Receive"
              sublabel="QR / Tag"
              onClick={handleReceiveClick}
              color="#075E54"
            />
          </div>

          {/* Privacy Score */}
          {privacy && (
            <div className="bg-white rounded-2xl shadow-sm border border-black/[0.04] overflow-hidden">
              <button
                type="button"
                className="w-full flex items-center gap-3 px-4 py-3 text-left"
                onClick={() => setShowPrivacy(v => !v)}
              >
                <Lock size={16} className="text-[#00a884]" strokeWidth={2.2} />
                <span className="font-bold text-gray-800 text-[14px] flex-1">Privacy Score</span>
                <PrivacyRing score={privacy.score} />
                {showPrivacy ? <ChevronUp size={16} className="text-gray-400" /> : <ChevronDown size={16} className="text-gray-400" />}
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
                          <div key={label} className="bg-[#F4F4F6] rounded-xl p-2.5">
                            <div className="text-[10px] text-gray-400 font-semibold uppercase">{label}</div>
                            <div className="text-[12px] font-extrabold text-gray-800 mt-0.5">{value}</div>
                          </div>
                        ))}
                      </div>
                      <div className="space-y-1.5">
                        {privacy.suggestions.map((s, i) => (
                          <div key={i} className="flex items-start gap-2 text-[11px] text-gray-600">
                            <AlertCircle size={12} className="mt-0.5 text-amber-500 flex-shrink-0" />
                            <span>{s}</span>
                          </div>
                        ))}
                      </div>
                      <a
                        href="https://aztec.network"
                        target="_blank"
                        rel="noopener noreferrer"
                        className="flex items-center gap-1 text-[10px] text-[#00a884] font-bold"
                      >
                        <ExternalLink size={10} /> Powered by Aztec Network
                      </a>
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>
            </div>
          )}

          {/* Transaction History */}
          <div className="bg-white rounded-2xl shadow-sm border border-black/[0.04] overflow-hidden">
            <div className="px-4 py-3.5 border-b border-black/[0.04] flex items-center justify-between">
              <div className="flex items-center gap-2">
                <TrendingUp size={16} className="text-[#00a884]" strokeWidth={2.2} />
                <span className="font-bold text-gray-900 text-[14px]">Recent Transactions</span>
              </div>
              <span className="text-[11px] text-gray-400 font-semibold">{history.length} records</span>
            </div>

            {history.length === 0 ? (
              <div className="py-8 flex flex-col items-center gap-2 text-gray-400">
                <div className="w-12 h-12 rounded-full bg-gray-100 flex items-center justify-center">
                  <Clock size={20} strokeWidth={2} className="text-gray-400" />
                </div>
                <span className="text-[13px] font-bold text-gray-700">No shielded transactions yet</span>
                <span className="text-[11px] text-center text-gray-400 max-w-[200px]">
                  All private transfers made via zk.money will appear here
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
                        style={{ background: isSent ? '#FF3B3015' : '#00a88415' }}
                      >
                        {isSent ? (
                          <ArrowUpFromLine size={14} className="text-red-500" />
                        ) : (
                          <ArrowDownToLine size={14} className="text-[#00a884]" />
                        )}
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="text-[13px] font-bold text-gray-800 truncate">
                          {isSent ? `To ${tx.recipientTag}` : `From ${tx.senderTag}`}
                        </div>
                        <div className="flex items-center gap-1.5 mt-0.5">
                          <Clock size={10} className="text-gray-300" />
                          <span className="text-[10px] text-gray-400 font-medium">{relativeTime(tx.timestamp)}</span>
                          <span className="text-gray-200">·</span>
                          <span className="text-[10px] text-[#00a884] font-semibold">Score: {tx.privacyScore}</span>
                        </div>
                      </div>
                      <div className="flex flex-col items-end gap-1 flex-shrink-0">
                        <span
                          className="text-[13px] font-extrabold font-mono"
                          style={{ color: isSent ? '#FF3B30' : '#00a884' }}
                        >
                          {isSent ? '-' : '+'}{tx.amount} {tx.token}
                        </span>
                        <a
                          href={tx.aztecExplorerUrl}
                          target="_blank"
                          rel="noopener noreferrer"
                          onClick={e => e.stopPropagation()}
                          className="text-[9px] text-[#00a884] font-semibold flex items-center gap-0.5 hover:underline"
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

          {/* Shielded Notes (UTXO) */}
          <div className="bg-white rounded-2xl shadow-sm border border-black/[0.04] overflow-hidden">
            <button
              type="button"
              className="w-full flex items-center gap-2.5 px-4 py-3 text-left"
              onClick={() => setShowNotes(v => !v)}
            >
              <Layers size={16} className="text-[#00a884]" strokeWidth={2.2} />
              <span className="font-bold text-gray-800 text-[14px] flex-1">
                Shielded Notes ({notes.length})
              </span>
              {showNotes ? <ChevronUp size={16} className="text-gray-400" /> : <ChevronDown size={16} className="text-gray-400" />}
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
                    <div className="px-4 pb-4 text-[12px] text-gray-400 font-medium">No active notes</div>
                  ) : (
                    <div className="divide-y divide-black/[0.04]">
                      {notes.map(note => (
                        <div key={note.id} className="flex items-center gap-3 px-4 py-2.5 font-mono">
                          <span className="text-[12px] font-bold text-gray-800">{note.amount} {note.token}</span>
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

          {/* Receive section with REAL interactive QR Code */}
          <div className="bg-white rounded-2xl shadow-sm border border-black/[0.04] p-5">
            <div className="flex items-center gap-2 mb-3">
              <QrCode size={16} className="text-[#00a884]" strokeWidth={2.2} />
              <span className="font-bold text-gray-900 text-[14px]">Receive Shielded Payment</span>
            </div>
            <div className="border border-gray-100 bg-[#FAFAFA] rounded-2xl p-5 flex flex-col items-center gap-3.5">
              <div className="bg-white p-3 rounded-2xl shadow-sm border border-black/[0.06]">
                <QRCodeSVG value={handle} size={110} level="M" />
              </div>
              <div className="text-center">
                <div className="text-[14px] font-extrabold text-gray-900 font-mono tracking-wide">{handle}</div>
                <div className="text-[11px] text-gray-400 mt-0.5">Share your zk handle to receive private payments</div>
              </div>
              <button
                type="button"
                onClick={() => copyToClipboard(handle, 'handle')}
                className="flex items-center gap-1.5 text-[11px] font-bold text-[#00a884] bg-[#00a884]/10 hover:bg-[#00a884]/20 px-4 py-2 rounded-full transition-colors"
              >
                {copiedHandle ? <Check size={13} /> : <Copy size={13} />}
                <span>{copiedHandle ? 'Handle Copied!' : 'Copy Handle'}</span>
              </button>
            </div>
          </div>

          {/* Footer */}
          <div className="flex items-center justify-center gap-2 py-2">
            <Lock size={12} className="text-gray-400" />
            <span className="text-[11px] text-gray-400 font-medium">
              Powered by{' '}
              <a href="https://aztec.network" target="_blank" rel="noopener noreferrer" className="text-[#00a884] font-bold hover:underline">
                Aztec Network
              </a>
              {' · '}
              <a href="https://aztecscan.xyz" target="_blank" rel="noopener noreferrer" className="text-[#00a884] font-bold hover:underline">
                AztecScan
              </a>
            </span>
          </div>
        </div>
      </motion.div>

      {/* ── Internal Modals: Shield / Unshield ── */}
      <AnimatePresence>
        {(activeInternalModal === 'shield' || activeInternalModal === 'unshield') && (
          <ZkShieldModal
            address={address}
            mode={activeInternalModal}
            onClose={() => setActiveInternalModal(null)}
            onSuccess={() => {
              setActiveInternalModal(null);
              refresh();
            }}
          />
        )}
      </AnimatePresence>

      {/* ── Internal Modal: Send ── */}
      <AnimatePresence>
        {activeInternalModal === 'send' && (
          <ZkMoneyModal
            isOpen={true}
            onClose={() => setActiveInternalModal(null)}
            myAddress={address}
            onSuccess={() => {
              setActiveInternalModal(null);
              refresh();
            }}
          />
        )}
      </AnimatePresence>

      {/* ── Internal Modal: Dedicated Receive Modal ── */}
      <AnimatePresence>
        {activeInternalModal === 'receive' && (
          <div className="fixed inset-0 z-[600] flex items-center justify-center bg-black/50 backdrop-blur-sm p-4">
            <motion.div
              initial={{ opacity: 0, scale: 0.95, y: 16 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 16 }}
              className="bg-white rounded-3xl shadow-2xl border border-black/[0.08] w-full max-w-sm overflow-hidden p-6 text-gray-900"
            >
              <div className="flex items-center justify-between mb-4">
                <div className="flex items-center gap-2">
                  <div className="w-8 h-8 rounded-full bg-[#00a884]/15 flex items-center justify-center">
                    <QrCode size={18} className="text-[#00a884]" />
                  </div>
                  <div>
                    <h3 className="text-base font-extrabold text-gray-900">Receive Shielded Payment</h3>
                    <p className="text-[11px] text-gray-400 font-medium">Aztec Sovereign Zero-Knowledge Note</p>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => setActiveInternalModal(null)}
                  className="w-7 h-7 rounded-full bg-gray-100 hover:bg-gray-200 flex items-center justify-center transition-colors"
                >
                  <X size={15} className="text-gray-600" />
                </button>
              </div>

              <div className="flex flex-col items-center gap-4 my-2">
                <div className="bg-white p-3.5 rounded-2xl shadow-sm border border-gray-100">
                  <QRCodeSVG value={handle} size={160} level="H" includeMargin={true} />
                </div>

                <div className="w-full bg-[#F4F4F6] rounded-2xl p-3.5 text-center">
                  <div className="text-[11px] font-bold text-gray-400 uppercase tracking-wide">Your ZK Handle</div>
                  <div className="text-base font-extrabold text-gray-900 font-mono mt-0.5">{handle}</div>
                  <button
                    type="button"
                    onClick={() => copyToClipboard(handle, 'handle')}
                    className="mt-2.5 w-full flex items-center justify-center gap-1.5 py-2 px-3 rounded-xl bg-[#00a884] hover:bg-[#008069] text-white text-xs font-bold transition-colors shadow-sm"
                  >
                    {copiedHandle ? <Check size={14} /> : <Copy size={14} />}
                    <span>{copiedHandle ? 'Copied to Clipboard!' : 'Copy Handle'}</span>
                  </button>
                </div>

                {address && (
                  <div className="w-full bg-[#F4F4F6] rounded-2xl p-3 text-center">
                    <div className="text-[10px] font-bold text-gray-400 uppercase tracking-wide">EVM Address</div>
                    <div className="text-xs font-mono text-gray-700 truncate mt-0.5">{address}</div>
                    <button
                      type="button"
                      onClick={() => copyToClipboard(address, 'address')}
                      className="mt-2 text-[11px] font-bold text-[#00a884] hover:underline flex items-center justify-center gap-1 mx-auto"
                    >
                      {copiedAddress ? <Check size={12} /> : <Copy size={12} />}
                      <span>{copiedAddress ? 'Address Copied' : 'Copy Address'}</span>
                    </button>
                  </div>
                )}
              </div>

              <div className="mt-4 pt-3 border-t border-gray-100 text-center text-[11px] text-gray-400">
                Incoming shielded payments generate private UltraPlonk commitments settled directly on Aztec Network.
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </>
  );
}
