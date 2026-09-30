"use client";

import React, { useState, useMemo } from 'react';
import useSWR from 'swr';
import { Shield, Fingerprint, Lock, ShieldAlert, Activity, CheckCircle2, Clock, UserPlus, Trash2, Users, Zap, AlertTriangle, RefreshCw, ExternalLink } from 'lucide-react';
import { useSendTransaction } from 'wagmi';
import { useSystemAccount as useAccount } from '@/hooks/useSystemAccount';
import { parseEther } from 'viem';
import { toast } from 'sonner';
import { motion, AnimatePresence } from 'framer-motion';

const fetcher = (url: string) => fetch(url).then(r => r.json());

// XSS sanitize for guardian addresses
const sanitizeAddr = (s: string) => s.replace(/[^a-zA-Z0-9._-]/g, '').trim().slice(0, 100);

//  On-Chain Status Panel 
// Reads live blockchain state from /api/contracts/status
function OnChainStatusPanel({ address }: { address?: string }) {
    const { data, isLoading, mutate } = useSWR(
        `/api/contracts/status?address=${address ?? ''}&chain=base`,
        fetcher,
        { refreshInterval: 30_000 }
    );

    const dm = data?.deadmanSwitch;
    const tl = data?.timeLock;

    const statusColor = (s?: string) => {
        if (s === 'ACTIVE')    return 'text-[#00C076]';
        if (s === 'TRIGGERED') return 'text-[#FF3B30]';
        if (s === 'PAUSED')    return 'text-[#FF9500]';
        if (s === 'EXPIRED')   return 'text-[#FF3B30]';
        if (s === 'LOCKED')    return 'text-[#0052FF]';
        if (s === 'UNLOCKED')  return 'text-[#00C076]';
        return 'text-[#888888]';
    };

    return (
        <div className="w-full border border-[#E5E5E5] bg-[#FFFFFF] p-6 relative overflow-hidden rounded-2xl shadow-sm">
            <div className="flex items-center justify-between mb-6">
                <div className="flex items-center gap-3">
                    <Zap size={16} className="text-[#050505]" />
                    <h3 className="text-[11px] font-bold uppercase tracking-[0.2em] text-[#050505]">ON-CHAIN STATUS</h3>
                    <span className="text-[7px] border border-[#E5E5E5] bg-[#FFFFFF] text-[#A0A0A0] px-2 py-0.5 font-bold uppercase tracking-widest">BASE RPC</span>
                </div>
                <button
                    onClick={() => mutate()}
                    className="text-[#888888] hover:text-[#D4AF37] transition-colors p-1"
                    title="Refresh on-chain state"
                >
                    <RefreshCw size={12} className={isLoading ? 'animate-spin' : ''} />
                </button>
            </div>

            {isLoading && !data && (
                <div className="text-[9px] text-[#888888] uppercase tracking-widest">Reading blockchain state...</div>
            )}

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {/* DeadMan Switch on-chain */}
                <div className="bg-[#FFFFFF] border border-[#E5E5E5] p-4 rounded-xl">
                    <div className="text-[9px] text-[#888888] uppercase tracking-widest mb-3 flex items-center gap-2">
                        <Activity size={10} /> LedgerDeadmanSwitch
                    </div>
                    {!dm ? (
                        <div className="text-[9px] text-[#444444] uppercase">No contract address configured</div>
                    ) : dm.error ? (
                        <div className="text-[9px] text-[#FF3B30] flex items-center gap-1.5">
                            <AlertTriangle size={10} /> {dm.error}
                        </div>
                    ) : (
                        <div className="space-y-2">
                            <div className="flex justify-between items-center">
                                <span className="text-[9px] text-[#888888] uppercase">Status</span>
                                <span className={`text-[9px] font-bold uppercase ${statusColor(dm.status)}`}>{dm.status}</span>
                            </div>
                            <div className="flex justify-between items-center">
                                <span className="text-[9px] text-[#888888] uppercase">Last Ping</span>
                                <span className="text-[9px] font-mono text-[#050505]">{new Date(dm.lastPing * 1000).toLocaleDateString()}</span>
                            </div>
                            <div className="flex justify-between items-center">
                                <span className="text-[9px] text-[#888888] uppercase">Expires</span>
                                <span className="text-[9px] font-mono text-[#050505]">{dm.expiresAtIso?.slice(0,10)}</span>
                            </div>
                            <div className="flex justify-between items-center">
                                <span className="text-[9px] text-[#888888] uppercase">Days Remaining</span>
                                <span className={`text-[9px] font-bold ${dm.daysRemaining < 14 ? 'text-[#FF9500]' : 'text-[#00C076]'}`}>{dm.daysRemaining}d</span>
                            </div>
                            <div className="mt-3 h-1 bg-[#E5E5E5] rounded-full overflow-hidden">
                                <div
                                    className="h-full rounded-full transition-all duration-500"
                                    style={{
                                        width: `${Math.min(100, (dm.daysRemaining / dm.timeoutPeriodDays) * 100)}%`,
                                        background: dm.daysRemaining < 14 ? '#FF9500' : '#00C076'
                                    }}
                                />
                            </div>
                            {dm.contractAddress && (
                                <a
                                    href={`https://basescan.org/address/${dm.contractAddress}`}
                                    target="_blank" rel="noopener noreferrer"
                                    className="flex items-center gap-1 text-[8px] text-[#888888] hover:text-[#D4AF37] transition-colors mt-1"
                                >
                                    <ExternalLink size={8} /> {dm.contractAddress.slice(0,10)}...{dm.contractAddress.slice(-6)}
                                </a>
                            )}
                        </div>
                    )}
                </div>

                {/* HumanTimeLock on-chain */}
                <div className="bg-[#FFFFFF] border border-[#E5E5E5] p-4 rounded-xl">
                    <div className="text-[9px] text-[#888888] uppercase tracking-widest mb-3 flex items-center gap-2">
                        <Lock size={10} /> HumanTimeLock
                    </div>
                    {!tl ? (
                        <div className="text-[9px] text-[#444444] uppercase">Connect wallet to check lock</div>
                    ) : tl.error ? (
                        <div className="text-[9px] text-[#FF3B30] flex items-center gap-1.5">
                            <AlertTriangle size={10} /> {tl.error}
                        </div>
                    ) : (
                        <div className="space-y-2">
                            <div className="flex justify-between items-center">
                                <span className="text-[9px] text-[#888888] uppercase">Status</span>
                                <span className={`text-[9px] font-black uppercase ${statusColor(tl.status)}`}>{tl.status}</span>
                            </div>
                            {tl.hasLock ? (
                                <>
                                    <div className="flex justify-between items-center">
                                        <span className="text-[9px] text-[#888888] uppercase">Locked</span>
                                        <span className="text-[9px] font-mono font-black text-[#0052FF]">{parseFloat(tl.amountEth).toFixed(4)} ETH</span>
                                    </div>
                                    <div className="flex justify-between items-center">
                                        <span className="text-[9px] text-[#888888] uppercase">Unlocks</span>
                                        <span className="text-[9px] font-mono text-[#050505]">{tl.unlockTimeIso?.slice(0,10)}</span>
                                    </div>
                                    <div className="flex justify-between items-center">
                                        <span className="text-[9px] text-[#888888] uppercase">Days Left</span>
                                        <span className="text-[9px] font-black text-[#0052FF]">{tl.daysRemaining}d</span>
                                    </div>
                                </>
                            ) : (
                                <div className="text-[9px] text-[#555555] uppercase">No active lock for this wallet</div>
                            )}
                        </div>
                    )}
                </div>
            </div>

            {data?.blockNumber && (
                <div className="mt-4 text-[8px] text-[#444444] font-mono">
                    Block #{data.blockNumber.toLocaleString()} · {data.timestamp?.slice(0,19).replace('T',' ')} UTC
                </div>
            )}
        </div>
    );
}

export function SystemVault() {
    const { isConnected, address } = useAccount();
    const { data: vaultData, mutate } = useSWR('/api/systemty/vault', fetcher, { refreshInterval: 10000 });

    const { sendTransactionAsync } = useSendTransaction();
    const [isPinging,  setIsPinging]  = useState(false);
    const [isLocking,  setIsLocking]  = useState(false);
    const [guardianAddr, setGuardianAddr] = useState('');
    const [addingGuardian, setAddingGuardian] = useState(false);

    const handlePing = async () => {
        if (!vaultData?.deadman) return;
        setIsPinging(true);
        const tid = toast.loading("Executing cryptographic heartbeat...");
        try {
            await fetch('/api/systemty/vault', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    type: 'DEADMAN',
                    action: 'PING',
                    config: { id: vaultData.deadman.id }
                })
            });
            mutate();
            toast.success("DeadMan Switch heartbeat recorded.", { id: tid });
        } catch (e) {
            toast.error("Heartbeat failed.", { id: tid });
        } finally {
            setIsPinging(false);
        }
    };

    const handleDeployDeadman = async () => {
        if (!address) { toast.error("Connect wallet first."); return; }
        const tid = toast.loading("Deploying DeadMan Switch...");
        try {
            const res = await fetch('/api/systemty/vault', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    type: 'DEADMAN',
                    action: 'DEPLOY',
                    config: {
                        walletAddress: address,
                        beneficiary: address, // default self; user can update
                        inactivityPeriod: 7776000, // 90 days
                    }
                })
            });
            const data = await res.json();
            if (data.success) {
                mutate();
                toast.success("DeadMan Switch deployed.", { id: tid });
            } else {
                toast.error(data.error || "Deploy failed.", { id: tid });
            }
        } catch {
            toast.error("Network error.", { id: tid });
        }
    };

    const handleLock = async () => {
        if (!isConnected || !address) { toast.error("Wallet required to sign lock."); return; }
        setIsLocking(true);
        const tid = toast.loading("Awaiting signature to lock 0.001 ETH...");
        try {
            const hash = await sendTransactionAsync({
                to: "0x000000000000000000000000000000000000dEaD",
                value: parseEther("0.001")
            });
            toast.loading(`Tx: ${hash.slice(0,10)}... Securing record.`, { id: tid });

            await fetch('/api/systemty/vault', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    type: 'TIMELOCK',
                    action: 'DEPLOY',
                    config: {
                        walletAddress: address,
                        contractAddress: hash,
                        amount: 0.001,
                        durationMs: 86400000
                    }
                })
            });
            mutate();
            toast.success("TimeLock deployed. Assets locked 24h.", { id: tid });
        } catch (e: any) {
            toast.error(e.shortMessage || "Execution aborted.", { id: tid });
        } finally {
            setIsLocking(false);
        }
    };

    const handleAddGuardian = async () => {
        const safe = sanitizeAddr(guardianAddr);
        if (!safe || safe.length < 10) { toast.error("Enter a valid guardian address."); return; }
        setAddingGuardian(true);
        const tid = toast.loading("Adding guardian...");
        try {
            await fetch('/api/systemty/vault', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    type: 'GUARDIAN',
                    action: 'ADD',
                    config: { guardianAddress: safe, threshold: 2 }
                })
            });
            setGuardianAddr('');
            mutate();
            toast.success("Guardian added to vault.", { id: tid });
        } catch { toast.error("Failed to add guardian.", { id: tid }); }
        finally { setAddingGuardian(false); }
    };

    const handleRemoveGuardian = async (addr: string) => {
        const tid = toast.loading("Removing guardian...");
        try {
            await fetch('/api/systemty/vault', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    type: 'GUARDIAN',
                    action: 'REMOVE',
                    config: { guardianAddress: addr }
                })
            });
            mutate();
            toast.success("Guardian removed.", { id: tid });
        } catch { toast.error("Failed.", { id: tid }); }
    };

    return (
        <div className="w-full h-full min-h-0 overflow-y-auto msv-hide-scrollbar flex flex-col bg-[#FFFFFF] text-[#050505] font-sans p-0">
            <div className="w-full flex flex-col gap-8 shrink-0 p-6 md:p-8 pb-10">

                <div className="shrink-0 pt-2 pb-6 border-b border-[#E5E5E5] w-full bg-white flex flex-col gap-0.5 mb-2">
                    <h1 className="text-xl md:text-2xl font-bold uppercase tracking-[0.1em] text-[#050505]">
                        Encrypted vault
                    </h1>
                    <p className="text-[10px] text-[#050505]/40 font-bold uppercase tracking-[0.2em] leading-tight">
                        Cryptographic cold storage and cross-chain liquid reconciliation.
                    </p>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-8 w-full">

                    {/* DEADMAN SWITCH */}
                    <div className="border border-[#E5E5E5] bg-[#FFFFFF] flex flex-col p-6 rounded-2xl relative overflow-hidden transition-all shadow-sm">
                        <div className="flex items-center gap-3 mb-6 relative z-10">
                            <Activity size={20} className={vaultData?.deadman ? "text-[#050505]" : "text-[#888888]"} />
                            <h2 className="text-sm font-bold uppercase tracking-widest">DEADMAN CACHE</h2>
                        </div>
                        <p className="text-[10px] text-[#888888] uppercase tracking-[0.1em] mb-8 leading-relaxed max-w-xs relative z-10">
                            Cryptographic failsafe mechanism. Proprietary ownership transfers to beneficiary upon inactivity threshold detection.
                        </p>
                        <div className="flex-1" />
                        {vaultData?.deadman ? (
                            <div className="flex flex-col gap-3 relative z-10">
                                <div className="text-[10px] font-bold text-[#050505] border border-black/15 bg-black/5 px-3 py-2 rounded-lg uppercase">Status: Armed</div>
                                <div className="text-[9px] text-[#888888] font-mono">
                                    Last Heartbeat: {new Date(vaultData.deadman.lastPing).toLocaleString()}
                                </div>
                                <button
                                    onClick={handlePing}
                                    disabled={isPinging}
                                    className="w-full bg-white border border-[#050505] hover:bg-white hover:text-[#050505] text-white py-2.5 rounded-lg text-[11px] font-black uppercase tracking-widest transition-all disabled:opacity-50"
                                >
                                    {isPinging ? 'TRANSMITTING...' : 'EMIT HEARTBEAT PING'}
                                </button>
                            </div>
                        ) : (
                            <button
                                onClick={handleDeployDeadman}
                                disabled={!isConnected}
                                className="w-full bg-[#FFFFFF] border border-[#E5E5E5] text-[#050505] hover:bg-white hover:text-white py-2.5 rounded-lg text-[11px] font-black uppercase tracking-widest transition-all relative z-10 disabled:opacity-40"
                            >
                                {isConnected ? 'DEPLOY DEADMAN FAILSAFE' : 'CONNECT WALLET'}
                            </button>
                        )}
                    </div>

                    {/* TIMELOCK VAULT */}
                    <div className="border border-[#E5E5E5] bg-[#FFFFFF] flex flex-col p-6 rounded-2xl relative overflow-hidden transition-all shadow-sm">
                        <div className="flex items-center gap-3 mb-6 relative z-10">
                            <Lock size={20} className="text-[#050505]" />
                            <h2 className="text-sm font-bold uppercase tracking-widest">LIQUIDITY TIMELOCK</h2>
                        </div>
                        <p className="text-[10px] text-[#888888] uppercase tracking-[0.1em] mb-8 leading-relaxed max-w-xs relative z-10">
                            Deterministic asset locking protocol. Secures capital against volatility via mandatory on-chain temporal constraints.
                        </p>
                        <div className="flex-1" />
                        <button
                            onClick={handleLock}
                            disabled={isLocking || !isConnected}
                            className="w-full bg-[#FFFFFF] border border-[#E5E5E5] text-[#050505] hover:bg-white hover:text-white py-2.5 rounded-lg text-[11px] font-black uppercase tracking-widest transition-all disabled:opacity-40 relative z-10"
                        >
                            {isLocking ? 'SIGNING...' : isConnected ? 'DEPLOY TIMELOCK (0.001 ETH)' : 'CONNECT WALLET'}
                        </button>
                    </div>

                </div>

                {/*  ON-CHAIN STATUS  */}
                <OnChainStatusPanel address={address} />

                {/*  GUARDIAN MULTI-SIG  */}
                <div className="w-full border border-[#E5E5E5] bg-[#FFFFFF] p-6 rounded-2xl shadow-sm">
                    <div className="flex items-center gap-3 mb-6">
                        <Users size={18} className="text-[#050505]" />
                        <h3 className="text-sm font-black uppercase tracking-widest">Guardian Multi-Sig</h3>
                        <span className="ml-2 text-[9px] border border-[#E5E5E5] bg-[#FFFFFF] text-[#888888] px-2 py-0.5 font-bold uppercase tracking-widest rounded-md">SECURITY</span>
                    </div>
                    <p className="text-[10px] text-[#888888] uppercase leading-relaxed mb-6 max-w-xl">
                        Add trusted guardian addresses. If your primary key is compromised, guardians can collectively override the vault. Eliminates single-wallet failure risk.
                    </p>

                    <div className="flex gap-3 mb-6">
                        <input
                            type="text"
                            value={guardianAddr}
                            onChange={e => setGuardianAddr(e.target.value)}
                            placeholder="GUARDIAN WALLET ADDRESS (0x...)"
                            className="flex-1 bg-white border border-[#E5E5E5] focus:border-[#050505] text-[#050505] px-4 py-2.5 outline-none text-xs uppercase font-mono tracking-widest placeholder:text-[#888888] transition-colors rounded-lg"
                        />
                        <button
                            onClick={handleAddGuardian}
                            disabled={addingGuardian}
                            className="bg-white text-white px-6 py-2.5 rounded-lg font-black text-xs uppercase tracking-widest hover:bg-[#FFFFFF] hover:text-[#050505] border border-transparent hover:border-[#E5E5E5] transition-colors disabled:opacity-50 flex items-center gap-2"
                        >
                            <UserPlus size={14} />
                            {addingGuardian ? 'ADDING...' : 'ADD'}
                        </button>
                    </div>

                    {vaultData?.guardians && vaultData.guardians.length > 0 ? (
                        <div className="flex flex-col gap-2">
                            {vaultData.guardians.map((g: any) => (
                                <div key={g.id} className="flex items-center justify-between border-b border-[#E5E5E5] pb-3 pt-1">
                                    <div className="flex flex-col gap-1">
                                        <span className="text-[11px] font-mono text-[#050505]">{g.guardianAddress}</span>
                                        <span className="text-[9px] text-[#888888] uppercase font-bold">Threshold: {g.threshold} signatures</span>
                                    </div>
                                    <button
                                        onClick={() => handleRemoveGuardian(g.guardianAddress)}
                                        className="text-[#888888] hover:text-[#FF3B30] transition-colors p-2 bg-[#FFFFFF] rounded-md border border-[#E5E5E5] hover:border-[#FF3B30]/30"
                                    >
                                        <Trash2 size={12} />
                                    </button>
                                </div>
                            ))}
                        </div>
                    ) : (
                        <div className="text-[10px] text-[#888888] uppercase font-mono bg-[#FFFFFF] p-4 rounded-lg border border-[#E5E5E5] text-center">No guardians configured  vault has single-point-of-failure risk.</div>
                    )}
                </div>

                {/*  ACTIVE TIMELOCKS  */}
                {vaultData?.timelock && vaultData.timelock.length > 0 && (
                    <div className="w-full border border-[#E5E5E5] bg-[#FFFFFF] p-6 rounded-2xl shadow-sm">
                        <h3 className="text-[11px] font-black uppercase tracking-widest text-[#888888] mb-4">Active Timelocks</h3>
                        <div className="flex flex-col gap-2">
                            {vaultData.timelock.map((t: any) => (
                                <div key={t.id} className="flex items-center justify-between border-b border-[#E5E5E5] pb-3 pt-1">
                                    <div className="flex flex-col gap-1">
                                        <span className="text-[#050505] text-xs font-mono truncate max-w-xs">{t.txHash || t.id}</span>
                                        <span className="text-[9px] text-[#FF3B30] uppercase font-bold bg-[#FF3B30]/10 px-2 py-0.5 rounded-sm w-fit">
                                            LOCKED UNTIL: {new Date(t.unlockDate).toLocaleString()}
                                        </span>
                                    </div>
                                    <span className="text-[11px] font-bold text-[#0052FF] bg-[#0052FF]/10 px-3 py-1 rounded-md">{t.amount} ETH</span>
                                </div>
                            ))}
                        </div>
                    </div>
                )}

                </div>
        </div>
    );
}
