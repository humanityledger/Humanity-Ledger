'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Settings, ChevronRight, Eye, EyeOff, Copy, Check,
  ExternalLink, RefreshCw, AlertTriangle, Zap, Lock, Key,
  BarChart3, Layers, Waves, FileText, QrCode,
  X, Sparkles, Globe, ArrowUpRight, ArrowDownLeft, Clock, Server,
  Loader2, CheckCircle,
} from 'lucide-react';
import { getIdentity, createIdentity, updateIdentity, type ZkIdentity } from '@/lib/zk/zkIdentity';
import { getPrivateWallet, type WalletSnapshot, type TokenBalance } from '@/lib/aztec/wallet/client';
import type { Activity } from '@/lib/aztec/wallet/history';
import { AZTEC_WALLET_CONFIG } from '@/lib/aztec/wallet/config';
import { ZkBridgePortal } from './ZkBridgePortal';
import { ZkPrivacyScore } from './ZkPrivacyScore';
import { ZkStreamManager } from './ZkStreamManager';
import { ZkWalletPanel } from './ZkWalletPanel';
import { ZkSequencerDashboard } from './ZkSequencerDashboard';

// ─── Props ─────────────────────────────────────────────────────────────────────

interface ZkSettingsPanelProps {
  userAddress: string;
  onClose: () => void;
}

type SettingsTab = 'overview' | 'identity' | 'keys' | 'privacy' | 'streams' | 'bridge' | 'sequencer';

// ─── Helpers ───────────────────────────────────────────────────────────────────

/** Format base-unit token amount to human-readable string. */
function fmtUnits(units: bigint, decimals: number): string {
  const divisor = 10n ** BigInt(decimals);
  const whole = units / divisor;
  const frac = units % divisor;
  if (frac === 0n) return whole.toString();
  const fracStr = frac.toString().padStart(decimals, '0').replace(/0+$/, '');
  return `${whole}.${fracStr}`;
}

/** Approximate USD value from token balance (rough, for display only). */
function approxUsd(bal: TokenBalance): number {
  const amount = Number(fmtUnits(bal.privateUnits + bal.publicUnits, bal.decimals));
  if (bal.key === 'ETH') return amount * 3200;
  return amount; // USDC, DAI ≈ $1
}

/** Relative time label for an Activity timestamp. */
function relTime(ts: number): string {
  const diff = Date.now() - ts;
  if (diff < 60_000) return 'just now';
  if (diff < 3_600_000) return `${Math.floor(diff / 60_000)}m ago`;
  if (diff < 86_400_000) return `${Math.floor(diff / 3_600_000)}h ago`;
  return `${Math.floor(diff / 86_400_000)}d ago`;
}

/** Aztec explorer transaction URL for the configured network. */
function aztecExplorerTx(txHash: string): string {
  const net = AZTEC_WALLET_CONFIG.network === 'mainnet' ? 'alpha' : 'testnet';
  return `https://aztec-explorer.vercel.app/${net}/tx/${txHash}`;
}

// ─── Activity Kind Badge ───────────────────────────────────────────────────────

function ActivityKindLabel({ kind, status }: { kind: Activity['kind']; status: Activity['status'] }) {
  const labels: Record<Activity['kind'], string> = {
    send: 'Sent',
    receive: 'Received',
    shield: 'Shielded',
    unshield: 'Unshielded',
    faucet: 'Faucet',
    deploy: 'Account Created',
  };
  const color = status === 'failed' ? 'text-red-500' : status === 'proving' || status === 'pending' ? 'text-orange-500' : 'text-[#1C1C1E]';
  return <span className={`text-[12px] font-bold ${color}`}>{labels[kind] ?? kind}</span>;
}

// ─── Node Status ───────────────────────────────────────────────────────────────

type NodeStatus = { synced: boolean; label: string };

async function fetchNodeStatus(): Promise<NodeStatus> {
  try {
    const res = await fetch('/api/aztec/node-status', { cache: 'no-store' });
    if (!res.ok) return { synced: false, label: 'Offline' };
    const data = await res.json();
    if (data?.blockNumber) return { synced: true, label: `Block #${data.blockNumber}` };
    if (data?.synced) return { synced: true, label: 'Synced' };
    return { synced: false, label: 'Connecting…' };
  } catch {
    // Fallback: check wallet phase
    const phase = getPrivateWallet().state.phase;
    return { synced: phase === 'ready', label: phase === 'ready' ? 'Connected' : 'Connecting…' };
  }
}

// ─── Main Component ────────────────────────────────────────────────────────────

export function ZkSettingsPanel({ userAddress, onClose }: ZkSettingsPanelProps) {
  const [tab, setTab] = useState<SettingsTab>('overview');

  // Identity (localStorage-based handle/name metadata — not financial data)
  const [identity, setIdentity] = useState<ZkIdentity | null>(null);
  const [editingHandle, setEditingHandle] = useState(false);
  const [newHandle, setNewHandle] = useState('');

  // Wallet state from the real Aztec wallet singleton
  const [walletState, setWalletState] = useState<WalletSnapshot>(() =>
    typeof window === 'undefined'
      ? { phase: 'idle', balances: [], activity: [], busy: false }
      : getPrivateWallet().state,
  );

  const [syncing, setSyncing] = useState(false);
  const [nodeStatus, setNodeStatus] = useState<NodeStatus>({ synced: false, label: 'Connecting…' });
  const [copied, setCopied] = useState<string | null>(null);
  const [shieldSheet, setShieldSheet] = useState<'shield' | 'unshield' | null>(null);

  // Subscribe to real wallet state
  useEffect(() => getPrivateWallet().subscribe(setWalletState), []);

  const loadData = useCallback(async () => {
    setIdentity(getIdentity(userAddress));
    const status = await fetchNodeStatus();
    setNodeStatus(status);
  }, [userAddress]);

  useEffect(() => {
    loadData();
    const handler = () => loadData();
    window.addEventListener('ledger_zk_balance_updated', handler);
    return () => window.removeEventListener('ledger_zk_balance_updated', handler);
  }, [loadData]);

  const handleSync = async () => {
    setSyncing(true);
    try {
      await getPrivateWallet().refresh();
    } finally {
      setSyncing(false);
    }
  };

  const handleCopy = (text: string, key: string) => {
    navigator.clipboard?.writeText(text).catch(() => {});
    setCopied(key);
    setTimeout(() => setCopied(null), 2000);
  };

  const handleSaveHandle = () => {
    if (!newHandle || !newHandle.match(/^[a-z0-9_.-]{3,32}$/)) return;
    const fullHandle = `zk:${newHandle}`;
    if (identity) {
      updateIdentity(userAddress, { zkHandle: fullHandle });
    } else {
      createIdentity(userAddress, fullHandle);
    }
    setIdentity(getIdentity(userAddress));
    setEditingHandle(false);
  };

  // Derive display values from real wallet state
  const realBalances = walletState.balances;
  const realActivity = walletState.activity;
  const totalUSD = realBalances.reduce((sum, b) => sum + approxUsd(b), 0).toFixed(2);
  const activeAztecAddress = walletState.aztecAddress;
  const walletReady = walletState.phase === 'ready';

  const tabs: Array<{ key: SettingsTab; label: string; icon: React.ReactNode }> = [
    { key: 'overview',  label: 'Overview',       icon: <BarChart3 size={15} /> },
    { key: 'identity',  label: 'Identity',        icon: <Lock size={15} /> },
    { key: 'keys',      label: 'Crypto Keys',     icon: <Key size={15} /> },
    { key: 'privacy',   label: 'Privacy',         icon: <Lock size={15} /> },
    { key: 'streams',   label: 'Streams',         icon: <Waves size={15} /> },
    { key: 'bridge',    label: 'Network fees',    icon: <Layers size={15} /> },
    { key: 'sequencer', label: 'Sequencer & V6',  icon: <Server size={15} /> },
  ];

  return (
    <div className="fixed inset-0 z-[9999] flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm">
      <motion.div
        initial={{ opacity: 0, scale: 0.95, y: 16 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.95, y: 16 }}
        transition={{ type: 'spring', stiffness: 380, damping: 30 }}
        className="bg-white rounded-3xl shadow-2xl border border-black/[0.08] w-full max-w-4xl max-h-[90vh] flex overflow-hidden"
      >
        {/* Left Sidebar */}
        <div className="w-56 shrink-0 bg-[#FAFAFA] border-r border-black/[0.06] flex flex-col">
          {/* Header */}
          <div className="p-5 border-b border-black/[0.06]">
            <div className="flex items-center gap-2 mb-1">
              <div className="w-8 h-8 rounded-xl bg-[#1C1C1E] flex items-center justify-center">
                <Lock size={16} className="text-white" strokeWidth={2.2} />
              </div>
              <div>
                <span className="text-[13px] font-black text-gray-900">Private Wallet</span>
                <span className="text-[9px] font-semibold text-gray-400 block leading-tight">Aztec Network v6</span>
              </div>
            </div>
          </div>

          {/* Nav Items */}
          <nav className="flex-1 py-3 space-y-0.5 px-2">
            {tabs.map(t => (
              <button
                key={t.key}
                onClick={() => setTab(t.key)}
                className={`w-full flex items-center gap-2.5 px-3 py-2.5 rounded-xl text-left text-[13px] font-semibold transition ${
                  tab === t.key
                    ? 'bg-[#1C1C1E] text-white'
                    : 'text-gray-600 hover:bg-black/5 hover:text-gray-900'
                }`}
              >
                <span className={tab === t.key ? 'text-white' : 'text-gray-400'}>{t.icon}</span>
                {t.label}
                {tab === t.key && <ChevronRight size={13} className="ml-auto text-white/60" />}
              </button>
            ))}
          </nav>

          {/* Node Status Indicator */}
          <div className="p-4 border-t border-black/[0.06]">
            <div className="flex items-center gap-2 text-[11px]">
              <span className={`w-2 h-2 rounded-full ${nodeStatus.synced ? 'bg-emerald-500' : 'bg-gray-400'}`} />
              <span className="text-gray-600 font-medium">{nodeStatus.label}</span>
            </div>
            <div className="text-[10px] text-gray-400 mt-0.5">
              {AZTEC_WALLET_CONFIG.network === 'mainnet' ? 'Aztec Alpha Mainnet' : 'Aztec Test Network'}
            </div>
          </div>
        </div>

        {/* Right Content */}
        <div className="flex-1 flex flex-col overflow-hidden">
          {/* Header row */}
          <div className="flex items-center justify-between px-6 py-4 border-b border-black/[0.06]">
            <h2 className="text-[16px] font-black text-gray-900">
              {tabs.find(t => t.key === tab)?.label}
            </h2>
            <button
              onClick={onClose}
              className="w-8 h-8 rounded-full flex items-center justify-center hover:bg-black/5 text-gray-400 hover:text-gray-700 transition"
            >
              <X size={18} />
            </button>
          </div>

          <div className="flex-1 overflow-y-auto p-6">

            {/* ─── Overview Tab ─────────────────────────────────────────── */}
            {tab === 'overview' && (
              <div className="space-y-5">
                {/* Wallet not open notice */}
                {!walletReady && (
                  <div className="bg-amber-50 border border-amber-200 rounded-2xl p-4 flex items-start gap-3">
                    <AlertTriangle size={16} className="text-amber-600 mt-0.5 flex-shrink-0" />
                    <div className="text-[12px] text-amber-900 leading-relaxed">
                      <strong>Private Wallet not open.</strong> Open your Private Wallet from the chat header
                      to see real Aztec balances and transaction history.
                      {walletState.phase === 'error' && walletState.error && (
                        <span className="block mt-1 text-red-700">{walletState.error}</span>
                      )}
                    </div>
                  </div>
                )}

                {/* Balance Cards */}
                <div>
                  <div className="flex items-center justify-between mb-3">
                    <h3 className="text-[13px] font-bold text-gray-700">Private Balances</h3>
                    <button
                      onClick={handleSync}
                      disabled={syncing || !walletReady}
                      className="flex items-center gap-1.5 text-[11px] font-bold text-black/70 hover:text-black transition disabled:opacity-50"
                    >
                      {syncing
                        ? <Loader2 size={12} className="animate-spin" />
                        : <RefreshCw size={12} />
                      }
                      Sync from Aztec
                    </button>
                  </div>

                  {realBalances.length > 0 ? (
                    <div className="grid grid-cols-3 gap-3">
                      {realBalances.map(bal => (
                        <div key={bal.key} className="bg-[#FAFAFA] border border-black/[0.06] rounded-2xl p-4">
                          <div className="flex items-center gap-1.5 mb-2">
                            <span className="text-[11px] font-bold text-gray-700 bg-black/5 px-2 py-0.5 rounded-md font-mono">
                              {bal.symbol}
                            </span>
                          </div>
                          <div className="text-[18px] font-black text-gray-900 font-mono leading-tight">
                            {fmtUnits(bal.privateUnits, bal.decimals)}
                          </div>
                          <div className="text-[11px] text-gray-400 mt-0.5">private</div>
                          {bal.publicUnits > 0n && (
                            <div className="text-[10px] text-orange-500 mt-0.5 font-medium">
                              +{fmtUnits(bal.publicUnits, bal.decimals)} public (shield to privatize)
                            </div>
                          )}
                        </div>
                      ))}
                    </div>
                  ) : (
                    <div className="grid grid-cols-3 gap-3">
                      {(['USDC', 'DAI', 'ETH'] as const).map(sym => (
                        <div key={sym} className="bg-[#FAFAFA] border border-black/[0.06] rounded-2xl p-4 opacity-40">
                          <div className="text-[11px] font-bold text-gray-500 bg-black/5 px-2 py-0.5 rounded-md font-mono inline-block mb-2">{sym}</div>
                          <div className="text-[18px] font-black text-gray-300 font-mono">—</div>
                          <div className="text-[11px] text-gray-300 mt-0.5">wallet not open</div>
                        </div>
                      ))}
                    </div>
                  )}

                  {/* Total + action buttons */}
                  <div className="mt-3 bg-[#FAFAFA] border border-black/[0.06] rounded-2xl p-4 flex items-center justify-between">
                    <div>
                      <span className="text-[11px] font-bold text-gray-500 uppercase tracking-wider">Total Private Portfolio</span>
                      <div className="text-[22px] font-black text-gray-900 font-mono">
                        {walletReady ? `$${totalUSD}` : '—'}
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      <button
                        onClick={() => setShieldSheet('shield')}
                        disabled={!walletReady}
                        className="flex items-center gap-1.5 px-3.5 py-2 bg-[#1C1C1E] text-white text-[12px] font-semibold rounded-xl hover:bg-black transition disabled:opacity-40"
                      >
                        <ArrowDownLeft size={13} /> Shield
                      </button>
                      <button
                        onClick={() => setShieldSheet('unshield')}
                        disabled={!walletReady}
                        className="flex items-center gap-1.5 px-3.5 py-2 bg-[#F2F2F7] text-gray-700 text-[12px] font-semibold rounded-xl hover:bg-[#E5E5EA] transition border border-black/[0.04] disabled:opacity-40"
                      >
                        <ArrowUpRight size={13} /> Unshield
                      </button>
                    </div>
                  </div>
                </div>

                {/* Activity Stats */}
                <div>
                  <h3 className="text-[13px] font-bold text-gray-700 mb-3">Activity</h3>
                  <div className="grid grid-cols-3 gap-3">
                    {[
                      { label: 'Total Txs', value: walletReady ? realActivity.length : '—' },
                      {
                        label: 'Settled',
                        value: walletReady
                          ? realActivity.filter(a => a.status === 'settled').length
                          : '—',
                      },
                      {
                        label: 'Pending',
                        value: walletReady
                          ? realActivity.filter(a => a.status === 'pending' || a.status === 'proving').length
                          : '—',
                      },
                    ].map(({ label, value }) => (
                      <div key={label} className="bg-[#FAFAFA] border border-black/[0.06] rounded-2xl p-3 text-center">
                        <div className="text-[20px] font-black text-gray-900">{value}</div>
                        <div className="text-[10px] text-gray-400 font-semibold mt-0.5">{label}</div>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Recent Activity */}
                <div>
                  <h3 className="text-[13px] font-bold text-gray-700 mb-3">Recent Private Transactions</h3>
                  {!walletReady ? (
                    <div className="text-center py-8 text-gray-400">
                      <Lock size={24} strokeWidth={1.5} className="mx-auto mb-2 text-gray-300" />
                      <p className="text-[13px]">Open your Private Wallet to view transaction history.</p>
                    </div>
                  ) : realActivity.length === 0 ? (
                    <div className="text-center py-8 text-gray-400">
                      <Lock size={24} strokeWidth={1.5} className="mx-auto mb-2 text-gray-300" />
                      <p className="text-[13px]">No private transactions yet.</p>
                    </div>
                  ) : (
                    <div className="space-y-2">
                      {realActivity.slice(0, 8).map((tx) => (
                        <div key={tx.id} className="flex items-center justify-between bg-[#FAFAFA] border border-black/[0.06] rounded-xl px-4 py-2.5">
                          <div className="flex items-center gap-2.5">
                            <div className="w-8 h-8 rounded-full bg-black/5 flex items-center justify-center text-gray-700">
                              {tx.status === 'proving' || tx.status === 'pending'
                                ? <Loader2 size={14} className="animate-spin" />
                                : tx.status === 'failed'
                                ? <AlertTriangle size={14} className="text-red-500" />
                                : <Lock size={14} />
                              }
                            </div>
                            <div>
                              <ActivityKindLabel kind={tx.kind} status={tx.status} />
                              {tx.counterparty && (
                                <div className="text-[10px] text-gray-400 font-mono">
                                  {tx.counterparty.slice(0, 10)}…{tx.counterparty.slice(-6)}
                                </div>
                              )}
                              <div className="text-[10px] text-gray-400">{relTime(tx.createdAt)}</div>
                            </div>
                          </div>
                          <div className="text-right">
                            {tx.amount && tx.token && (
                              <div className={`text-[13px] font-bold font-mono ${tx.kind === 'send' || tx.kind === 'shield' || tx.kind === 'unshield' ? 'text-gray-900' : 'text-emerald-600'}`}>
                                {tx.kind === 'receive' ? '+' : ''}{tx.amount} {tx.token}
                              </div>
                            )}
                            {tx.txHash && (
                              <a
                                href={aztecExplorerTx(tx.txHash)}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="text-[10px] text-black/70 hover:underline flex items-center gap-0.5 justify-end"
                              >
                                AztecScan <ExternalLink size={9} />
                              </a>
                            )}
                            {tx.status === 'failed' && tx.error && (
                              <div className="text-[10px] text-red-500 max-w-[120px] truncate">{tx.error}</div>
                            )}
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            )}

            {/* ─── Identity Tab ─────────────────────────────────────────── */}
            {tab === 'identity' && (
              <div className="space-y-5">
                {/* Identity Card */}
                <div className="bg-white border border-black/[0.08] rounded-2xl p-5 text-[#1C1C1E] shadow-sm">
                  <div className="flex items-center gap-3 mb-4">
                    <div className="w-12 h-12 rounded-2xl bg-black/5 flex items-center justify-center">
                      <Lock size={22} className="text-[#1C1C1E]" strokeWidth={2.2} />
                    </div>
                    <div>
                      <div className="text-[16px] font-black text-[#1C1C1E]">{identity?.zkHandle || 'Not registered'}</div>
                      <div className="text-[11px] text-black/50 font-mono">Humanity Ledger Confidential Identity</div>
                    </div>
                    {identity?.verified && (
                      <span className="ml-auto text-[10px] font-bold bg-black/5 text-[#1C1C1E] px-2 py-0.5 rounded-full border border-black/10">
                        ✓ Verified
                      </span>
                    )}
                  </div>
                  <div className="space-y-2 text-[11px] font-mono text-black/60">
                    <div className="flex justify-between">
                      <span className="text-black/40">EVM Address</span>
                      <span>{userAddress.slice(0, 10)}…{userAddress.slice(-6)}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-black/40">Aztec Address</span>
                      <span className="text-black/80">
                        {activeAztecAddress
                          ? `${activeAztecAddress.slice(0, 14)}…${activeAztecAddress.slice(-6)}`
                          : 'Open Private Wallet to derive'}
                      </span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-black/40">Wallet Phase</span>
                      <span className={`font-bold ${walletReady ? 'text-emerald-700' : 'text-orange-600'}`}>
                        {walletState.phase}
                      </span>
                    </div>
                    {activeAztecAddress && (
                      <div className="flex justify-between items-center">
                        <span className="text-black/40">Copy Aztec Address</span>
                        <button
                          onClick={() => handleCopy(activeAztecAddress, 'aztec')}
                          className="flex items-center gap-1 text-black/70 hover:text-black transition"
                        >
                          {copied === 'aztec' ? <Check size={12} /> : <Copy size={12} />}
                          {copied === 'aztec' ? 'Copied' : 'Copy'}
                        </button>
                      </div>
                    )}
                  </div>
                </div>

                {/* Edit Handle */}
                <div className="bg-[#FAFAFA] border border-black/[0.06] rounded-2xl p-4">
                  <h3 className="text-[13px] font-bold text-gray-900 mb-3">Display Handle</h3>
                  {editingHandle ? (
                    <div className="space-y-3">
                      <div className="flex items-center gap-2">
                        <span className="text-[13px] font-bold text-[#1C1C1E]">zk:</span>
                        <input
                          type="text"
                          value={newHandle}
                          onChange={e => setNewHandle(e.target.value.toLowerCase().replace(/[^a-z0-9_.-]/g, ''))}
                          placeholder="yourhandle"
                          className="flex-1 bg-white border border-black/[0.08] rounded-xl px-3 py-2 text-[13px] font-mono outline-none focus:border-black/30"
                          maxLength={32}
                          autoFocus
                        />
                      </div>
                      <div className="text-[11px] text-gray-400">3–32 chars, lowercase letters, numbers, _.-</div>
                      <div className="flex gap-2">
                        <button
                          onClick={handleSaveHandle}
                          disabled={!newHandle.match(/^[a-z0-9_.-]{3,32}$/)}
                          className="flex-1 py-2 bg-[#1C1C1E] text-white text-[12px] font-bold rounded-xl hover:bg-black transition disabled:opacity-50 shadow-sm"
                        >
                          Confirm Handle
                        </button>
                        <button
                          onClick={() => setEditingHandle(false)}
                          className="px-4 py-2 bg-[#f0f2f5] text-gray-600 text-[12px] font-bold rounded-xl"
                        >
                          Cancel
                        </button>
                      </div>
                    </div>
                  ) : (
                    <div className="flex items-center justify-between">
                      <div>
                        <div className="text-[14px] font-bold text-gray-900 font-mono">{identity?.zkHandle || 'Not set'}</div>
                        <div className="text-[11px] text-gray-400 mt-0.5">Your confidential identity label (local only)</div>
                      </div>
                      <button
                        onClick={() => { setEditingHandle(true); setNewHandle(identity?.zkHandle?.replace('zk:', '') || ''); }}
                        className="px-3 py-1.5 bg-black/5 text-[#1C1C1E] text-[11px] font-bold rounded-lg hover:bg-black/10 transition"
                      >
                        {identity ? 'Edit' : 'Register'}
                      </button>
                    </div>
                  )}
                </div>

                {/* Identity Details */}
                <div className="space-y-2">
                  {[
                    { label: 'Display Name', value: identity?.displayName || '—' },
                    { label: 'ENS Name', value: identity?.ensName || '—' },
                    { label: 'Created', value: identity ? new Date(identity.createdAt).toLocaleDateString() : '—' },
                  ].map(({ label, value }) => (
                    <div key={label} className="flex items-center justify-between bg-[#FAFAFA] border border-black/[0.06] rounded-xl px-4 py-2.5">
                      <span className="text-[12px] text-gray-500 font-medium">{label}</span>
                      <span className="text-[12px] font-semibold text-gray-900 font-mono">{value}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* ─── Keys / Security Tab ───────────────────────────────────── */}
            {tab === 'keys' && (
              <div className="space-y-4">
                <div className="bg-emerald-50 border border-emerald-200 rounded-2xl p-4 flex items-start gap-3">
                  <Lock size={16} className="text-emerald-700 mt-0.5 flex-shrink-0" />
                  <div className="text-[12px] text-emerald-900 leading-relaxed">
                    <strong>Zero-Custody Cryptographic Enclave:</strong> Aztec keys (sk_m, nsk_m, ivsk_m) are derived
                    exclusively in local Web Worker memory and never exposed to the DOM or transmitted over the network.
                  </div>
                </div>

                <div className="space-y-3">
                  <div className="bg-[#FAFAFA] border border-black/[0.06] rounded-2xl p-4 space-y-2">
                    <div className="flex items-center justify-between">
                      <div className="text-[13px] font-bold text-gray-900">Encrypted Storage at Rest (OPFS)</div>
                      <span className="text-[10.5px] font-bold bg-emerald-100 text-emerald-800 px-2 py-0.5 rounded-full border border-emerald-200">
                        AES-256 Encrypted
                      </span>
                    </div>
                    <p className="text-[11.5px] text-gray-500 leading-normal">
                      Local PXE notes and account database are encrypted using SQLCipher over Origin Private File System (OPFS).
                      Keys are derived via HKDF-SHA256 from your wallet signature — never stored in plaintext.
                    </p>
                    <div className="font-mono text-[11px] text-gray-700 bg-white border border-black/[0.05] rounded-xl px-3 py-2">
                      Store info string: hl/aztec/v1/store (32-byte derived key)
                    </div>
                  </div>

                  <div className="bg-[#FAFAFA] border border-black/[0.06] rounded-2xl p-4 space-y-2">
                    <div className="flex items-center justify-between">
                      <div className="text-[13px] font-bold text-gray-900">Proving Bundle Integrity</div>
                      <span className="text-[10.5px] font-bold bg-black/5 text-[#1C1C1E] px-2 py-0.5 rounded-full border border-black/10">
                        UltraHonk BN254
                      </span>
                    </div>
                    <p className="text-[11.5px] text-gray-500 leading-normal">
                      Client-side proofs use Barretenberg 5.3.0 with SHA-256 verification keys pinned against on-chain contract verifiers.
                    </p>
                    <div className="flex items-center justify-between pt-1">
                      <span className="text-[11px] font-mono text-gray-600">Verification endpoint: /api/security/integrity</span>
                      <a
                        href="/api/security/integrity"
                        target="_blank"
                        rel="noreferrer"
                        className="text-[11.5px] font-semibold text-[#15171c] hover:underline flex items-center gap-1"
                      >
                        Inspect Manifest <ExternalLink size={12} />
                      </a>
                    </div>
                  </div>

                  <div className="bg-[#FAFAFA] border border-black/[0.06] rounded-2xl p-4 space-y-2">
                    <div className="text-[13px] font-bold text-gray-900">G7 Address Proof</div>
                    <p className="text-[11.5px] text-gray-500 leading-normal">
                      Peers prove control of their Aztec address via a Schnorr signature over the DM binding statement
                      (hl/aztec-binding/v1 | address | signerInboxId | dm:recipientInboxId). This prevents relay substitution attacks.
                    </p>
                    <div className={`text-[11px] font-semibold px-3 py-1.5 rounded-xl inline-block ${walletReady ? 'bg-emerald-100 text-emerald-800' : 'bg-gray-100 text-gray-500'}`}>
                      {walletReady ? '✓ Proof capability available (wallet open)' : 'Open Private Wallet to generate proofs'}
                    </div>
                  </div>

                  <div className="bg-[#FAFAFA] border border-black/[0.06] rounded-2xl p-4 space-y-2">
                    <div className="text-[13px] font-bold text-gray-900">Memory and Storage Hygiene</div>
                    <p className="text-[11.5px] text-gray-500 leading-normal">
                      Upon session sign-out, all local OPFS stores and IndexedDB message caches are purged via the secure wipe routine.
                      In-memory signing keys are zeroed when the wallet disconnects.
                    </p>
                  </div>
                </div>
              </div>
            )}

            {/* ─── Privacy Tab ──────────────────────────────────────────── */}
            {tab === 'privacy' && (
              <div className="space-y-5">
                <ZkPrivacyScore address={userAddress} />

                <div className="bg-[#FAFAFA] border border-black/[0.06] rounded-2xl p-4 space-y-3">
                  <h3 className="text-[13px] font-bold text-gray-900">Privacy Architecture</h3>
                  {[
                    {
                      label: 'Private note storage',
                      desc: 'Token notes are stored encrypted in the local PXE, never on our server',
                      enabled: true,
                    },
                    {
                      label: 'Zero-knowledge proofs',
                      desc: 'All private transfers are proven locally on this device via Barretenberg',
                      enabled: true,
                    },
                    {
                      label: 'OPFS encrypted store',
                      desc: 'PXE state encrypted at rest using HKDF-derived key from your signature',
                      enabled: true,
                    },
                    {
                      label: 'Rotate spending keys quarterly',
                      desc: 'Derive fresh note keys every 90 days (manual, requires new wallet connect)',
                      enabled: false,
                    },
                    {
                      label: 'Tor relay for PXE calls',
                      desc: 'Route Aztec node queries through Tor (slower; not yet integrated)',
                      enabled: false,
                    },
                  ].map(({ label, desc, enabled }) => (
                    <div key={label} className="flex items-center justify-between py-2 border-b border-black/[0.04] last:border-0">
                      <div>
                        <div className="text-[12px] font-semibold text-gray-900">{label}</div>
                        <div className="text-[10px] text-gray-400 mt-0.5">{desc}</div>
                      </div>
                      <div
                        className={`w-10 rounded-full relative ${enabled ? 'bg-[#1C1C1E]' : 'bg-gray-200'}`}
                        style={{ minWidth: 40, height: 22 }}
                      >
                        <div className={`absolute top-0.5 w-[18px] h-[18px] rounded-full bg-white shadow transition-transform ${enabled ? 'translate-x-[20px]' : 'translate-x-0.5'}`} />
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* ─── Streams Tab ──────────────────────────────────────────── */}
            {tab === 'streams' && (
              <ZkStreamManager
                userAddress={userAddress}
                userTag={identity?.zkHandle}
              />
            )}

            {/* ─── Bridge / Fee Juice Tab ───────────────────────────────── */}
            {tab === 'bridge' && (
              <ZkBridgePortal userAddress={userAddress} />
            )}

            {/* ─── Sequencer & V6 Tab ──────────────────────────────────── */}
            {tab === 'sequencer' && (
              <ZkSequencerDashboard userAddress={userAddress} className="border-0 shadow-none" />
            )}
          </div>
        </div>
      </motion.div>

      {/* Shield / Unshield via real ZkWalletPanel */}
      <AnimatePresence>
        {shieldSheet && (
          <ZkWalletPanel
            address={userAddress}
            initialSheet={shieldSheet}
            onClose={() => setShieldSheet(null)}
            onPaymentSent={() => { setShieldSheet(null); handleSync(); }}
          />
        )}
      </AnimatePresence>
    </div>
  );
}
