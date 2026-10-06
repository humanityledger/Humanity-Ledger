"use client";

import React, { useState, useEffect, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { X, Skull, Heart, Shield, AlertCircle, Loader2, ExternalLink, CheckCircle2, Lock } from 'lucide-react';
import { useAccount, usePublicClient, useWalletClient } from 'wagmi';
import { parseAbi } from 'viem';

// ─── Contract ABI (only functions we need) ──────────────────────────────────
const DEADMAN_ABI = parseAbi([
  'function ping() external',
  'function proposeBackupWallet(address newBackup) external',
  'function confirmBackupWallet() external',
  'function secondsUntilExpiry() external view returns (uint256)',
  'function getStatus() external view returns (address _owner, address _backup, uint256 _lastPing, uint256 _timeoutPeriod, uint256 _expiresAt, bool _triggered, bool _paused)',
]);

// ─── On-chain contract address ────────────────────────────────────────────────
const CONTRACT_ADDRESS = (process.env.NEXT_PUBLIC_DEADMAN_CONTRACT_ADDRESS || '') as `0x${string}`;

interface Status {
  _owner: string;
  _backup: string;
  _lastPing: bigint;
  _timeoutPeriod: bigint;
  _expiresAt: bigint;
  _triggered: boolean;
  _paused: boolean;
}

interface DeadMansSwitchModalProps {
  isOpen: boolean;
  onClose: () => void;
}

function formatCountdown(seconds: bigint): string {
  const s = Number(seconds);
  if (s <= 0) return 'EXPIRED';
  const d = Math.floor(s / 86400);
  const h = Math.floor((s % 86400) / 3600);
  const m = Math.floor((s % 3600) / 60);
  if (d > 0) return `${d}d ${h}h remaining`;
  if (h > 0) return `${h}h ${m}m remaining`;
  return `${m}m remaining`;
}

export default function DeadMansSwitchModal({ isOpen, onClose }: DeadMansSwitchModalProps) {
  const { address: walletAddress, isConnected } = useAccount();
  const publicClient = usePublicClient();
  const { data: walletClient } = useWalletClient();

  const [status, setStatus] = useState<Status | null>(null);
  const [loading, setLoading] = useState(false);
  const [txHash, setTxHash] = useState<string | null>(null);
  const [txSuccess, setTxSuccess] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [newBackup, setNewBackup] = useState('');
  const [secondsLeft, setSecondsLeft] = useState<bigint>(0n);
  const [view, setView] = useState<'heartbeat' | 'change_backup'>('heartbeat');

  const fetchStatus = useCallback(async () => {
    if (!publicClient || !CONTRACT_ADDRESS) return;
    try {
      const result = await publicClient.readContract({
        address: CONTRACT_ADDRESS,
        abi: DEADMAN_ABI,
        functionName: 'getStatus',
      });
      const [_owner, _backup, _lastPing, _timeoutPeriod, _expiresAt, _triggered, _paused] = result as [string, string, bigint, bigint, bigint, boolean, boolean];
      setStatus({ _owner, _backup, _lastPing, _timeoutPeriod, _expiresAt, _triggered, _paused });

      const secs = await publicClient.readContract({
        address: CONTRACT_ADDRESS,
        abi: DEADMAN_ABI,
        functionName: 'secondsUntilExpiry',
      });
      setSecondsLeft(secs as bigint);
    } catch (e: any) {
      setError('Unable to read on-chain state. Check contract address.');
    }
  }, [publicClient]);

  useEffect(() => {
    if (isOpen) {
      setError(null);
      setTxHash(null);
      setTxSuccess(null);
      fetchStatus();
    }
  }, [isOpen, fetchStatus]);

  const writeContract = async (functionName: string, args: any[] = []) => {
    if (!walletClient || !publicClient || !CONTRACT_ADDRESS) {
      setError('Wallet not connected or contract address missing.');
      return;
    }
    setLoading(true);
    setError(null);
    setTxHash(null);
    setTxSuccess(null);
    try {
      const { request } = await (publicClient as any).simulateContract({
        address: CONTRACT_ADDRESS,
        abi: DEADMAN_ABI,
        functionName: functionName as any,
        args: args as any,
        account: walletAddress,
      });
      const hash = await walletClient.writeContract(request as any);
      setTxHash(hash);
      await publicClient.waitForTransactionReceipt({ hash });
      setTxSuccess('Transaction confirmed on-chain!');
      fetchStatus();
    } catch (e: any) {
      const msg = e?.shortMessage || e?.message || 'Transaction failed.';
      setError(msg);
    } finally {
      setLoading(false);
    }
  };

  const handlePing = () => writeContract('ping');
  const handlePropose = () => {
    if (!/^0x[0-9a-fA-F]{40}$/.test(newBackup)) {
      setError('Invalid Ethereum address format.');
      return;
    }
    writeContract('proposeBackupWallet', [newBackup as `0x${string}`]);
  };
  const handleConfirm = () => writeContract('confirmBackupWallet');

  const isOwner = walletAddress && status?._owner
    ? walletAddress.toLowerCase() === status._owner.toLowerCase()
    : false;

  const expiryDate = status?._expiresAt
    ? new Date(Number(status._expiresAt) * 1000).toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' })
    : '—';

  const lastPingDate = status?._lastPing
    ? new Date(Number(status._lastPing) * 1000).toLocaleDateString()
    : '—';

  return (
    <AnimatePresence>
      {isOpen && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm p-4"
          onClick={onClose}
        >
          <motion.div
            initial={{ scale: 0.9, opacity: 0, y: 20 }}
            animate={{ scale: 1, opacity: 1, y: 0 }}
            exit={{ scale: 0.9, opacity: 0, y: 20 }}
            transition={{ type: 'spring', damping: 25, stiffness: 300 }}
            onClick={(e) => e.stopPropagation()}
            className="relative w-full max-w-md bg-gradient-to-br from-zinc-950 via-red-950/30 to-zinc-950 border border-red-500/20 rounded-2xl p-6 shadow-2xl"
          >
            {/* Header */}
            <div className="flex items-center justify-between mb-6">
              <div className="flex items-center gap-3">
                <div className="p-2 bg-red-500/10 rounded-xl border border-red-500/20">
                  <Skull className="text-red-400" size={22} />
                </div>
                <div>
                  <h2 className="text-lg font-black text-white tracking-tight">Dead Man's Switch</h2>
                  <p className="text-xs text-white/40">Non-Custodial Inheritance · On-Chain</p>
                </div>
              </div>
              <button onClick={onClose} className="p-1.5 rounded-lg bg-white/5 hover:bg-white/10 transition-colors">
                <X size={16} className="text-white/60" />
              </button>
            </div>

            {/* Contract not configured */}
            {!CONTRACT_ADDRESS && (
              <div className="flex items-start gap-3 p-4 bg-amber-500/10 border border-amber-500/20 rounded-xl mb-4">
                <AlertCircle className="text-amber-400 shrink-0 mt-0.5" size={16} />
                <p className="text-amber-300 text-xs leading-relaxed">
                  <strong>Configuration needed:</strong> Set <code className="bg-white/10 px-1 rounded">NEXT_PUBLIC_DEADMAN_CONTRACT_ADDRESS</code> to enable on-chain interaction.
                </p>
              </div>
            )}

            {/* Not connected */}
            {!isConnected && (
              <div className="flex items-start gap-3 p-4 bg-[#25D366]/10 border border-[#25D366]/20 rounded-xl mb-4">
                <Lock className="text-blue-400 shrink-0 mt-0.5" size={16} />
                <p className="text-blue-300 text-xs">Connect your wallet to interact with the on-chain switch.</p>
              </div>
            )}

            {/* Status card */}
            {status && (
              <div className="space-y-2 mb-5">
                {status._triggered && (
                  <div className="flex items-center gap-2 p-3 bg-orange-500/10 border border-orange-500/30 rounded-xl">
                    <AlertCircle className="text-orange-400 shrink-0" size={14} />
                    <p className="text-orange-300 text-xs font-bold">Switch has already triggered. Inheritance forwarded.</p>
                  </div>
                )}
                {status._paused && (
                  <div className="flex items-center gap-2 p-3 bg-yellow-500/10 border border-yellow-500/30 rounded-xl">
                    <AlertCircle className="text-yellow-400 shrink-0" size={14} />
                    <p className="text-yellow-300 text-xs font-bold">Contract is paused by owner.</p>
                  </div>
                )}

                <div className="grid grid-cols-2 gap-2">
                  <div className="p-3 bg-white/3 border border-white/8 rounded-xl">
                    <p className="text-white/40 text-[10px] uppercase tracking-wider mb-1">Status</p>
                    <p className={`text-sm font-bold ${status._triggered ? 'text-orange-400' : status._paused ? 'text-yellow-400' : 'text-green-400'}`}>
                      {status._triggered ? 'TRIGGERED' : status._paused ? 'PAUSED' : 'ACTIVE'}
                    </p>
                  </div>
                  <div className="p-3 bg-white/3 border border-white/8 rounded-xl">
                    <p className="text-white/40 text-[10px] uppercase tracking-wider mb-1">Time Remaining</p>
                    <p className={`text-xs font-bold font-mono ${secondsLeft <= 0n ? 'text-red-400' : 'text-white'}`}>
                      {formatCountdown(secondsLeft)}
                    </p>
                  </div>
                  <div className="p-3 bg-white/3 border border-white/8 rounded-xl col-span-2">
                    <p className="text-white/40 text-[10px] uppercase tracking-wider mb-1">Beneficiary (Backup Wallet)</p>
                    <p className="text-white text-xs font-mono break-all">{status._backup}</p>
                  </div>
                  <div className="p-3 bg-white/3 border border-white/8 rounded-xl">
                    <p className="text-white/40 text-[10px] uppercase tracking-wider mb-1">Last Heartbeat</p>
                    <p className="text-white text-xs">{lastPingDate}</p>
                  </div>
                  <div className="p-3 bg-white/3 border border-white/8 rounded-xl">
                    <p className="text-white/40 text-[10px] uppercase tracking-wider mb-1">Switch Fires On</p>
                    <p className="text-white text-xs">{expiryDate}</p>
                  </div>
                </div>
              </div>
            )}

            {/* Owner actions */}
            {isOwner && !status?._triggered && (
              <div className="space-y-2">
                <div className="flex gap-1 mb-3 bg-white/5 p-1 rounded-lg">
                  <button
                    onClick={() => setView('heartbeat')}
                    className={`flex-1 py-1.5 text-xs font-bold rounded-md transition-all ${view === 'heartbeat' ? 'bg-white/10 text-white' : 'text-white/40 hover:text-white/60'}`}
                  >
                    Heartbeat
                  </button>
                  <button
                    onClick={() => setView('change_backup')}
                    className={`flex-1 py-1.5 text-xs font-bold rounded-md transition-all ${view === 'change_backup' ? 'bg-white/10 text-white' : 'text-white/40 hover:text-white/60'}`}
                  >
                    Change Backup
                  </button>
                </div>

                {view === 'heartbeat' && (
                  <button
                    onClick={handlePing}
                    disabled={loading || status?._paused}
                    className="w-full py-3 bg-green-600 hover:bg-green-500 disabled:bg-white/10 disabled:text-white/30 rounded-xl font-bold text-white text-sm flex items-center justify-center gap-2 transition-all"
                  >
                    {loading ? <Loader2 className="animate-spin" size={16} /> : <Heart size={16} />}
                    {loading ? 'Signing transaction…' : "I'm Alive — Reset Timer (ping)"}
                  </button>
                )}

                {view === 'change_backup' && (
                  <div className="space-y-2">
                    <input
                      type="text"
                      value={newBackup}
                      onChange={(e) => setNewBackup(e.target.value)}
                      placeholder="New backup address (0x...)"
                      className="w-full px-3 py-2.5 bg-white/5 border border-white/10 rounded-xl text-white text-xs placeholder-white/30 focus:outline-none focus:border-white/30"
                    />
                    <button
                      onClick={handlePropose}
                      disabled={loading || !newBackup}
                      className="w-full py-2.5 bg-blue-600 hover:bg-[#25D366] disabled:bg-white/10 disabled:text-white/30 rounded-xl font-bold text-white text-sm flex items-center justify-center gap-2 transition-all"
                    >
                      {loading ? <Loader2 className="animate-spin" size={16} /> : <Shield size={16} />}
                      {loading ? 'Signing…' : 'Propose New Backup (step 1/2)'}
                    </button>
                    <button
                      onClick={handleConfirm}
                      disabled={loading}
                      className="w-full py-2.5 bg-white/8 hover:bg-white/12 disabled:bg-white/5 disabled:text-white/20 rounded-xl font-bold text-white/60 text-xs flex items-center justify-center gap-2 transition-all"
                    >
                      Confirm After 72h Cooldown (step 2/2)
                    </button>
                  </div>
                )}
              </div>
            )}

            {/* TX feedback */}
            {txHash && (
              <div className="mt-3 flex items-center gap-2 p-3 bg-white/5 border border-white/10 rounded-xl">
                <Loader2 className="text-blue-400 animate-spin shrink-0" size={14} />
                <div className="flex-1 min-w-0">
                  <p className="text-white/60 text-xs">Pending confirmation…</p>
                  <a
                    href={`https://polygonscan.com/tx/${txHash}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-blue-400 text-xs font-mono hover:underline flex items-center gap-1 truncate"
                  >
                    {txHash.slice(0, 20)}… <ExternalLink size={10} />
                  </a>
                </div>
              </div>
            )}
            {txSuccess && (
              <div className="mt-3 flex items-center gap-2 p-3 bg-green-500/10 border border-green-500/20 rounded-xl">
                <CheckCircle2 className="text-green-400 shrink-0" size={14} />
                <p className="text-green-300 text-xs font-bold">{txSuccess}</p>
              </div>
            )}
            {error && (
              <div className="mt-3 flex items-start gap-2 p-3 bg-red-500/10 border border-red-500/20 rounded-xl">
                <AlertCircle className="text-red-400 shrink-0 mt-0.5" size={14} />
                <p className="text-red-300 text-xs">{error}</p>
              </div>
            )}

            {/* Security note */}
            <div className="mt-4 pt-4 border-t border-white/5">
              <p className="text-white/25 text-[9px] leading-relaxed">
                Non-custodial protocol. No server handles your funds. All actions require your wallet signature and execute directly on-chain via <code>LedgerDeadmanSwitch.sol</code> (Ownable2Step · ReentrancyGuard · Pausable · 72h backup cooldown).
              </p>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}

