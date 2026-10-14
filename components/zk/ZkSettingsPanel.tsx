'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Shield, Settings, ChevronRight, Eye, EyeOff, Copy, Check,
  ExternalLink, RefreshCw, AlertTriangle, Zap, Lock, Key,
  BarChart3, Layers, Waves, FileText, Terminal, QrCode,
  X, Sparkles, Globe, ArrowUpRight, ArrowDownLeft, Clock, Cpu, Server
} from 'lucide-react';
import { getShieldedBalances, syncBalanceFromAztec, calculatePrivacyScore, getZkTransactionHistory, ZkShieldedBalance } from '@/lib/zk/zkMoney';
import { getIdentity, createIdentity, updateIdentity, ZkIdentity } from '@/lib/zk/zkIdentity';
import { deriveAztecKeySet, checkAztecNodeStatus } from '@/lib/zk/aztecPxe';
import { getUserStreams } from '@/lib/zk/zkStreaming';
import { getUserInvoices } from '@/lib/zk/zkInvoice';
import { ZkBridgePortal } from './ZkBridgePortal';
import { ZkTerminal } from './ZkTerminal';
import { ZkPrivacyScore } from './ZkPrivacyScore';
import { ZkStreamManager } from './ZkStreamManager';
import { ZkShieldModal } from './ZkShieldModal';
import { ZkMpcCeremony } from './ZkMpcCeremony';
import { ZkSequencerDashboard } from './ZkSequencerDashboard';

interface ZkSettingsPanelProps {
  userAddress: string;
  onClose: () => void;
}

type SettingsTab = 'overview' | 'identity' | 'keys' | 'privacy' | 'streams' | 'bridge' | 'mpc' | 'sequencer' | 'devtools';

export function ZkSettingsPanel({ userAddress, onClose }: ZkSettingsPanelProps) {
  const [tab, setTab] = useState<SettingsTab>('overview');
  const [identity, setIdentity] = useState<ZkIdentity | null>(null);
  const [balances, setBalances] = useState<ZkShieldedBalance>({ DAI: '0', USDC: '0', ETH: '0' });
  const [syncing, setSyncing] = useState(false);
  const [nodeStatus, setNodeStatus] = useState<any>(null);
  const [showKeys, setShowKeys] = useState(false);
  const [copied, setCopied] = useState<string | null>(null);
  const [editingHandle, setEditingHandle] = useState(false);
  const [newHandle, setNewHandle] = useState('');
  const [shieldMode, setShieldMode] = useState<'shield' | 'unshield' | null>(null);

  const keySet = deriveAztecKeySet(userAddress);
  const txHistory = getZkTransactionHistory(userAddress);
  const streams = getUserStreams(userAddress);
  const invoices = getUserInvoices(userAddress);

  const loadData = useCallback(async () => {
    const id = getIdentity(userAddress);
    setIdentity(id);
    setBalances(getShieldedBalances(userAddress));
    const status = await checkAztecNodeStatus();
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
      const b = await syncBalanceFromAztec(userAddress);
      setBalances(b);
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

  const totalUSD = (parseFloat(balances.DAI || '0') + parseFloat(balances.USDC || '0') + parseFloat(balances.ETH || '0') * 3200).toFixed(2);

  const tabs: Array<{ key: SettingsTab; label: string; icon: React.ReactNode }> = [
    { key: 'overview', label: 'Overview', icon: <BarChart3 size={15} /> },
    { key: 'identity', label: 'Identity', icon: <Shield size={15} /> },
    { key: 'keys', label: 'Crypto Keys', icon: <Key size={15} /> },
    { key: 'privacy', label: 'Privacy', icon: <Lock size={15} /> },
    { key: 'streams', label: 'Streams', icon: <Waves size={15} /> },
    { key: 'bridge', label: 'Bridge', icon: <Layers size={15} /> },
    { key: 'mpc', label: 'MPC Setup', icon: <Cpu size={15} /> },
    { key: 'sequencer', label: 'Sequencer & V6', icon: <Server size={15} /> },
    { key: 'devtools', label: 'Dev Console', icon: <Terminal size={15} /> },
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
        <div className="w-56 bg-[#FAFAFA] border-r border-black/[0.06] flex flex-col">
          {/* Header */}
          <div className="p-5 border-b border-black/[0.06]">
            <div className="flex items-center gap-2 mb-1">
              <div className="w-8 h-8 rounded-2xl bg-gradient-to-br from-[#25D366] to-[#128C7E] flex items-center justify-center">
                <Shield size={16} className="text-white" strokeWidth={2.5} />
              </div>
              <div>
                <span className="text-[13px] font-black text-gray-900">zk.money</span>
                <span className="text-[9px] font-semibold text-gray-400 block leading-tight">Aztec Network</span>
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
                    ? 'bg-[#25D366]/10 text-[#25D366]'
                    : 'text-gray-600 hover:bg-black/5 hover:text-gray-900'
                }`}
              >
                <span className={tab === t.key ? 'text-[#25D366]' : 'text-gray-400'}>{t.icon}</span>
                {t.label}
                {tab === t.key && <ChevronRight size={13} className="ml-auto text-[#25D366]" />}
              </button>
            ))}
          </nav>

          {/* Node Status Indicator */}
          <div className="p-4 border-t border-black/[0.06]">
            <div className="flex items-center gap-2 text-[11px]">
              <span className={`w-2 h-2 rounded-full ${nodeStatus?.status === 'synced' ? 'bg-[#25D366] animate-pulse' : 'bg-amber-500'}`} />
              <span className="text-gray-500 font-medium">
                {nodeStatus?.status === 'synced' ? `Block #${nodeStatus.rollupBlockNumber}` : 'Connecting...'}
              </span>
            </div>
            <div className="text-[10px] text-gray-400 mt-0.5">Aztec Mainnet Rollup</div>
          </div>
        </div>

        {/* Right Content */}
        <div className="flex-1 flex flex-col overflow-hidden">
          {/* Close Button */}
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
            {/* ─── Overview Tab ──────────────────────────────────────────────── */}
            {tab === 'overview' && (
              <div className="space-y-5">
                {/* Balance Cards */}
                <div>
                  <div className="flex items-center justify-between mb-3">
                    <h3 className="text-[13px] font-bold text-gray-700">Shielded Balances</h3>
                    <button
                      onClick={handleSync}
                      disabled={syncing}
                      className="flex items-center gap-1.5 text-[11px] font-bold text-[#25D366] hover:text-[#20ba59] transition"
                    >
                      <RefreshCw size={12} className={syncing ? 'animate-spin' : ''} />
                      Sync from Aztec
                    </button>
                  </div>

                  <div className="grid grid-cols-3 gap-3">
                    {[
                      { token: 'DAI', balance: balances.DAI, icon: '🟡', usd: parseFloat(balances.DAI || '0') },
                      { token: 'USDC', balance: balances.USDC, icon: '🔵', usd: parseFloat(balances.USDC || '0') },
                      { token: 'ETH', balance: balances.ETH, icon: '💎', usd: parseFloat(balances.ETH || '0') * 3200 },
                    ].map(({ token, balance, icon, usd }) => (
                      <div key={token} className="bg-[#FAFAFA] border border-black/[0.06] rounded-2xl p-4">
                        <div className="flex items-center gap-1.5 mb-2">
                          <span className="text-base">{icon}</span>
                          <span className="text-[11px] font-bold text-gray-500">zk{token}</span>
                        </div>
                        <div className="text-[18px] font-black text-gray-900 font-mono leading-tight">{parseFloat(balance || '0').toFixed(token === 'ETH' ? 4 : 2)}</div>
                        <div className="text-[11px] text-gray-400 mt-0.5">≈ ${usd.toFixed(2)} USD</div>
                      </div>
                    ))}
                  </div>

                  {/* Total */}
                  <div className="mt-3 bg-gradient-to-r from-[#25D366]/10 to-[#128C7E]/10 border border-[#25D366]/20 rounded-2xl p-4 flex items-center justify-between">
                    <div>
                      <span className="text-[11px] font-bold text-gray-500 uppercase tracking-wider">Total Private Portfolio</span>
                      <div className="text-[22px] font-black text-gray-900 font-mono">${totalUSD}</div>
                    </div>
                    <div className="flex items-center gap-2">
                      <button
                        onClick={() => setShieldMode('shield')}
                        className="flex items-center gap-1.5 px-3 py-2 bg-[#25D366] text-white text-[12px] font-bold rounded-xl hover:bg-[#20ba59] transition"
                      >
                        <ArrowDownLeft size={13} /> Shield
                      </button>
                      <button
                        onClick={() => setShieldMode('unshield')}
                        className="flex items-center gap-1.5 px-3 py-2 bg-[#f0f2f5] text-gray-700 text-[12px] font-bold rounded-xl hover:bg-[#e4e6eb] transition"
                      >
                        <ArrowUpRight size={13} /> Unshield
                      </button>
                    </div>
                  </div>
                </div>

                {/* Activity Stats */}
                <div>
                  <h3 className="text-[13px] font-bold text-gray-700 mb-3">Activity Summary</h3>
                  <div className="grid grid-cols-4 gap-3">
                    {[
                      { label: 'Total Txs', value: txHistory.length },
                      { label: 'Active Streams', value: streams.outgoing.filter(s => s.status === 'active').length + streams.incoming.filter(s => s.status === 'active').length },
                      { label: 'Invoices', value: invoices.issued.length + invoices.received.length },
                      { label: 'Privacy Score', value: calculatePrivacyScore({ txHash: '0x', senderTag: 'x', recipientTag: 'x', amount: '0', token: 'DAI', status: 'settled', timestamp: Date.now(), noteId: 'x', aztecExplorerUrl: '' }).score },
                    ].map(({ label, value }) => (
                      <div key={label} className="bg-[#FAFAFA] border border-black/[0.06] rounded-2xl p-3 text-center">
                        <div className="text-[20px] font-black text-gray-900">{value}</div>
                        <div className="text-[10px] text-gray-400 font-semibold mt-0.5">{label}</div>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Recent Transactions */}
                <div>
                  <h3 className="text-[13px] font-bold text-gray-700 mb-3">Recent Private Transactions</h3>
                  {txHistory.length === 0 ? (
                    <div className="text-center py-8 text-gray-400">
                      <Shield size={28} strokeWidth={1.5} className="mx-auto mb-2 text-gray-300" />
                      <p className="text-[13px]">No transactions yet. Send your first shielded payment!</p>
                    </div>
                  ) : (
                    <div className="space-y-2">
                      {txHistory.slice(0, 5).map((tx, i) => (
                        <div key={i} className="flex items-center justify-between bg-[#FAFAFA] border border-black/[0.06] rounded-xl px-4 py-2.5">
                          <div className="flex items-center gap-2.5">
                            <div className="w-8 h-8 rounded-full bg-[#25D366]/10 flex items-center justify-center text-[#25D366]">
                              <Shield size={14} />
                            </div>
                            <div>
                              <div className="text-[12px] font-bold text-gray-900">{tx.recipientTag}</div>
                              <div className="text-[10px] text-gray-400 font-mono">{new Date(tx.timestamp).toLocaleDateString()}</div>
                            </div>
                          </div>
                          <div className="text-right">
                            <div className="text-[13px] font-bold text-red-500 font-mono">-{tx.amount} {tx.token}</div>
                            <a
                              href={tx.aztecExplorerUrl}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="text-[10px] text-[#25D366] hover:underline flex items-center gap-0.5 justify-end"
                            >
                              AztecScan <ExternalLink size={9} />
                            </a>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            )}

            {/* ─── Identity Tab ──────────────────────────────────────────────── */}
            {tab === 'identity' && (
              <div className="space-y-5">
                {/* Current Identity Card */}
                <div className="bg-gradient-to-br from-[#1C1C1E] to-[#2C2C2E] rounded-2xl p-5 text-white">
                  <div className="flex items-center gap-3 mb-4">
                    <div className="w-12 h-12 rounded-2xl bg-[#25D366]/20 flex items-center justify-center">
                      <Shield size={22} className="text-[#25D366]" strokeWidth={2.5} />
                    </div>
                    <div>
                      <div className="text-[16px] font-black text-white">{identity?.zkHandle || 'Not registered'}</div>
                      <div className="text-[11px] text-white/50 font-mono">Humanity Ledger Sovereign Identity</div>
                    </div>
                    {identity?.verified && (
                      <span className="ml-auto text-[10px] font-bold bg-[#25D366]/20 text-[#25D366] px-2 py-0.5 rounded-full border border-[#25D366]/30">
                        ✓ Verified
                      </span>
                    )}
                  </div>
                  <div className="space-y-2 text-[11px] font-mono text-white/60">
                    <div className="flex justify-between">
                      <span className="text-white/40">EVM Address</span>
                      <span>{userAddress.slice(0, 10)}...{userAddress.slice(-6)}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-white/40">Aztec Address</span>
                      <span className="text-[#25D366]">{keySet.aztecAddress.slice(0, 16)}...{keySet.aztecAddress.slice(-6)}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-white/40">Reputation</span>
                      <span className="text-amber-400">{identity?.reputationScore || 0} pts</span>
                    </div>
                  </div>
                </div>

                {/* Edit Handle */}
                <div className="bg-[#FAFAFA] border border-black/[0.06] rounded-2xl p-4">
                  <h3 className="text-[13px] font-bold text-gray-900 mb-3">zk.money Handle</h3>
                  {editingHandle ? (
                    <div className="space-y-3">
                      <div className="flex items-center gap-2">
                        <span className="text-[13px] font-bold text-[#25D366]">zk:</span>
                        <input
                          type="text"
                          value={newHandle}
                          onChange={e => setNewHandle(e.target.value.toLowerCase().replace(/[^a-z0-9_.-]/g, ''))}
                          placeholder="yourhandle"
                          className="flex-1 bg-white border border-black/[0.08] rounded-xl px-3 py-2 text-[13px] font-mono outline-none focus:border-[#25D366]"
                          maxLength={32}
                          autoFocus
                        />
                      </div>
                      <div className="text-[11px] text-gray-400">3–32 chars, lowercase letters, numbers, _.-</div>
                      <div className="flex gap-2">
                        <button
                          onClick={handleSaveHandle}
                          disabled={!newHandle.match(/^[a-z0-9_.-]{3,32}$/)}
                          className="flex-1 py-2 bg-[#25D366] text-white text-[12px] font-bold rounded-xl hover:bg-[#20ba59] transition disabled:opacity-50"
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
                        <div className="text-[11px] text-gray-400 mt-0.5">Your public zk.money identity</div>
                      </div>
                      <button
                        onClick={() => { setEditingHandle(true); setNewHandle(identity?.zkHandle?.replace('zk:', '') || ''); }}
                        className="px-3 py-1.5 bg-[#25D366]/10 text-[#25D366] text-[11px] font-bold rounded-lg hover:bg-[#25D366]/20 transition"
                      >
                        {identity ? 'Edit' : 'Register'}
                      </button>
                    </div>
                  )}
                </div>

                {/* Identity Details */}
                <div className="space-y-2">
                  {[
                    { label: 'Display Name', value: identity?.displayName || '—', editable: true },
                    { label: 'ENS Name', value: identity?.ensName || '—', editable: false },
                    { label: 'Total Transactions', value: identity?.totalTransactions?.toString() || '0', editable: false },
                    { label: 'Created', value: identity ? new Date(identity.createdAt).toLocaleDateString() : '—', editable: false },
                  ].map(({ label, value }) => (
                    <div key={label} className="flex items-center justify-between bg-[#FAFAFA] border border-black/[0.06] rounded-xl px-4 py-2.5">
                      <span className="text-[12px] text-gray-500 font-medium">{label}</span>
                      <span className="text-[12px] font-semibold text-gray-900 font-mono">{value}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* ─── Keys Tab ────────────────────────────────────────────────────── */}
            {tab === 'keys' && (
              <div className="space-y-4">
                <div className="bg-amber-50 border border-amber-200 rounded-2xl p-4 flex items-start gap-3">
                  <AlertTriangle size={16} className="text-amber-600 mt-0.5 flex-shrink-0" />
                  <div className="text-[12px] text-amber-800">
                    <strong>Private keys are derived client-side only.</strong> They are never transmitted to any server. These keys control your shielded Aztec notes.
                  </div>
                </div>

                <button
                  onClick={() => setShowKeys(!showKeys)}
                  className="flex items-center gap-2 px-4 py-2 bg-[#f0f2f5] rounded-xl text-[12px] font-bold text-gray-700 hover:bg-[#e4e6eb] transition"
                >
                  {showKeys ? <EyeOff size={14} /> : <Eye size={14} />}
                  {showKeys ? 'Hide Sensitive Keys' : 'Reveal Cryptographic Keys'}
                </button>

                <div className="space-y-3">
                  {[
                    { label: 'Master Secret Key (sk_m)', desc: 'Root derivation key for all Aztec keys', key: 'sk', value: keySet.masterSecretKey },
                    { label: 'Nullifier Secret Key (nsk_m)', desc: 'Used to compute note nullifiers (prevents double spend)', key: 'nsk', value: keySet.nullifierSecretKey },
                    { label: 'Incoming Viewing Key (ivsk_m)', desc: 'Allows scanning blocks for notes sent to you', key: 'ivsk', value: keySet.incomingViewingKey },
                    { label: 'Outgoing Viewing Key (ovsk_m)', desc: 'Allows auditing outgoing transactions', key: 'ovsk', value: keySet.outgoingViewingKey },
                    { label: 'Nullifier Public Key (Np_k)', desc: 'Used by senders to encrypt notes for you', key: 'npk', value: keySet.nullifierPublicKey },
                    { label: 'Shielded Aztec Address', desc: 'Your fully private payment address on Aztec', key: 'aztec_addr', value: keySet.aztecAddress },
                  ].map(({ label, desc, key, value }) => (
                    <div key={key} className="bg-[#FAFAFA] border border-black/[0.06] rounded-2xl p-4">
                      <div className="flex items-start justify-between mb-2">
                        <div>
                          <div className="text-[12px] font-bold text-gray-900">{label}</div>
                          <div className="text-[10px] text-gray-400 mt-0.5">{desc}</div>
                        </div>
                        <button
                          onClick={() => handleCopy(value, key)}
                          className="w-7 h-7 rounded-lg flex items-center justify-center hover:bg-[#25D366]/10 text-gray-400 hover:text-[#25D366] transition"
                        >
                          {copied === key ? <Check size={13} className="text-[#25D366]" /> : <Copy size={13} />}
                        </button>
                      </div>
                      <div className="font-mono text-[11px] text-gray-600 bg-white border border-black/[0.05] rounded-xl px-3 py-2 break-all">
                        {showKeys ? value : value.slice(0, 10) + '•'.repeat(40) + value.slice(-4)}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* ─── Privacy Tab ─────────────────────────────────────────────────── */}
            {tab === 'privacy' && (
              <div className="space-y-5">
                <ZkPrivacyScore address={userAddress} />

                <div className="bg-[#FAFAFA] border border-black/[0.06] rounded-2xl p-4 space-y-3">
                  <h3 className="text-[13px] font-bold text-gray-900">Privacy Configuration</h3>

                  {[
                    { label: 'Shield new payments automatically', desc: 'Auto-shield any received token to Aztec', enabled: true },
                    { label: 'Enforce anonymity set minimum', desc: 'Wait for ≥5 other notes before spending', enabled: true },
                    { label: 'Rotate spending keys quarterly', desc: 'Derive fresh note keys every 90 days', enabled: false },
                    { label: 'Tor relay for PXE calls', desc: 'Route Aztec node queries through Tor (slower)', enabled: false },
                    { label: 'Encrypted local note cache', desc: 'Store notes with AES-256 encryption locally', enabled: true },
                  ].map(({ label, desc, enabled }) => (
                    <div key={label} className="flex items-center justify-between py-2 border-b border-black/[0.04] last:border-0">
                      <div>
                        <div className="text-[12px] font-semibold text-gray-900">{label}</div>
                        <div className="text-[10px] text-gray-400 mt-0.5">{desc}</div>
                      </div>
                      <div
                        className={`w-10 h-5.5 rounded-full relative cursor-pointer transition-colors ${enabled ? 'bg-[#25D366]' : 'bg-gray-200'}`}
                        style={{ minWidth: 40, height: 22 }}
                      >
                        <div className={`absolute top-0.5 w-[18px] h-[18px] rounded-full bg-white shadow transition-transform ${enabled ? 'translate-x-[20px]' : 'translate-x-0.5'}`} />
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* ─── Streams Tab ─────────────────────────────────────────────────── */}
            {tab === 'streams' && (
              <ZkStreamManager
                userAddress={userAddress}
                userTag={identity?.zkHandle}
              />
            )}

            {/* ─── Bridge Tab ──────────────────────────────────────────────────── */}
            {tab === 'bridge' && (
              <ZkBridgePortal userAddress={userAddress} />
            )}

            {/* ─── MPC Ceremony Coordinator Tab ───────────────────────────────── */}
            {tab === 'mpc' && (
              <ZkMpcCeremony userAddress={userAddress} className="border-0 shadow-none" />
            )}

            {/* ─── Sequencer & V6 Dashboard Tab ────────────────────────────────── */}
            {tab === 'sequencer' && (
              <ZkSequencerDashboard userAddress={userAddress} className="border-0 shadow-none" />
            )}

            {/* ─── Dev Console Tab ─────────────────────────────────────────────── */}
            {tab === 'devtools' && (
              <ZkTerminal userAddress={userAddress} className="h-[500px]" />
            )}
          </div>
        </div>
      </motion.div>

      {/* Shield/Unshield Modal */}
      <AnimatePresence>
        {shieldMode && (
          <ZkShieldModal
            address={userAddress}
            mode={shieldMode}
            onClose={() => setShieldMode(null)}
            onSuccess={() => { setShieldMode(null); handleSync(); }}
          />
        )}
      </AnimatePresence>
    </div>
  );
}
