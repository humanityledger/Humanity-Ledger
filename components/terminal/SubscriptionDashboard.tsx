"use client";

import React, { useEffect, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Check, X, Zap, Shield, Database, Activity, Globe, Key, TrendingUp, BarChart3, ExternalLink, RefreshCw, CreditCard, Clock, Calendar, Crown } from 'lucide-react';
import { NODE_TIERS, PlanTier, PlanConfig } from '@/lib/node_infrastructure/tiers';
import { useSystemAccount } from '@/hooks/useSystemAccount';

// ── Owner wallet that has permanent, unlimited access ──────────────────────────
const OWNER_WALLET = '0x78831c25c86ea2a78a6127fc2ccb95e612d87b4a';

interface SessionData {
    authenticated: boolean;
    user: {
        id: string;
        email: string;
        tier: string;
        walletAddress: string;
        subscription: {
            id: string;
            tier: string;
            status: string;
            expiresAt: string | null;
            createdAt: string;
            updatedAt: string;
        } | null;
        transactions: Array<{
            id: string;
            type: string;
            amount: number;
            timestamp: string;
            status: string;
            hash?: string;
        }>;
    } | null;
}

function formatDate(dateStr: string | null | undefined): string {
    if (!dateStr) return '—';
    return new Date(dateStr).toLocaleDateString('en-US', {
        year: 'numeric',
        month: 'short',
        day: 'numeric',
    });
}

function formatCents(cents: number): string {
    return `$${(cents / 100).toLocaleString('en-US', { minimumFractionDigits: 2 })}`;
}

function getTierKey(tierStr: string): PlanTier {
    const map: Record<string, PlanTier> = {
        FREE: PlanTier.FREE,
        LIGHT: PlanTier.LIGHT_NODE,
        LIGHT_NODE: PlanTier.LIGHT_NODE,
        FULL: PlanTier.FULL_NODE,
        FULL_NODE: PlanTier.FULL_NODE,
        ARCHIVE: PlanTier.ARCHIVE_PROVER,
        ARCHIVE_PROVER: PlanTier.ARCHIVE_PROVER,
        CRYPTOGRAPHIC: PlanTier.ARCHIVE_PROVER,
        HUMAN: PlanTier.ARCHIVE_PROVER,
    };
    return map[tierStr?.toUpperCase()] ?? PlanTier.FREE;
}

// ── Status badge ───────────────────────────────────────────────────────────────
function StatusBadge({ status }: { status: string }) {
    const cfg: Record<string, { label: string; cls: string }> = {
        ACTIVE: { label: 'ACTIVE', cls: 'bg-emerald-500/10 text-emerald-600 border-emerald-500/20' },
        TRIALING: { label: 'TRIAL', cls: 'bg-[#25D366]/10 text-emerald-600 border-[#25D366]/20' },
        PAST_DUE: { label: 'PAST DUE', cls: 'bg-amber-500/10 text-amber-600 border-amber-500/20' },
        CANCELLED: { label: 'CANCELLED', cls: 'bg-red-500/10 text-red-500 border-red-500/20' },
        VIP: { label: 'PERMANENT ACCESS', cls: 'bg-purple-500/10 text-purple-600 border-purple-500/20' },
    };
    const c = cfg[status?.toUpperCase()] ?? { label: status ?? 'UNKNOWN', cls: 'bg-black/5 text-black/50 border-black/10' };
    return (
        <span className={`inline-flex items-center gap-1.5 text-[9px] font-black uppercase tracking-widest px-2.5 py-1 rounded-full border ${c.cls}`}>
            <span className="w-1.5 h-1.5 rounded-full bg-current animate-pulse" />
            {c.label}
        </span>
    );
}

// ── Metric card ────────────────────────────────────────────────────────────────
function MetricCard({ icon: Icon, label, value, sub }: { icon: any; label: string; value: string; sub?: string }) {
    return (
        <div className="rounded-2xl border border-black/8 bg-white p-5 flex flex-col gap-2 hover:border-black/15 hover:shadow-sm transition-all">
            <div className="flex items-center gap-2 text-black/40">
                <Icon size={13} />
                <span className="text-[10px] font-black uppercase tracking-widest">{label}</span>
            </div>
            <span className="text-2xl font-black text-[#050505] tracking-tight leading-none">{value}</span>
            {sub && <span className="text-[11px] text-black/40 font-medium">{sub}</span>}
        </div>
    );
}

// ── Feature row ────────────────────────────────────────────────────────────────
function FeatureRow({ label, active, value }: { label: string; active: boolean; value?: string }) {
    return (
        <div className={`flex items-center justify-between py-3 border-b border-black/5 last:border-0 ${active ? '' : 'opacity-40'}`}>
            <div className="flex items-center gap-3">
                {active
                    ? <Check size={12} className="text-emerald-500 shrink-0" />
                    : <X size={12} className="text-black/30 shrink-0" />}
                <span className="text-[12px] font-medium text-[#050505]">{label}</span>
            </div>
            {value && <span className="text-[11px] font-mono font-black text-black/50">{value}</span>}
        </div>
    );
}

// ── Manage sub button ──────────────────────────────────────────────────────────
function ManageButton({ tier, onUpgrade }: { tier: string; onUpgrade: () => void }) {
    const [loading, setLoading] = useState(false);

    const openPortal = async () => {
        setLoading(true);
        try {
            const res = await fetch('/api/payments/customer-portal', { method: 'POST', credentials: 'include' });
            const data = await res.json();
            if (data.url) window.open(data.url, '_blank');
            else alert(data.error || 'Could not open billing portal. Contact support.');
        } catch (e) {
            alert('Network error opening billing portal.');
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="flex gap-3 flex-wrap">
            <button
                onClick={openPortal}
                disabled={loading}
                className="flex items-center gap-2 px-5 py-2.5 rounded-xl border border-black/10 bg-white text-[#050505] text-[10px] font-black uppercase tracking-widest hover:bg-black/5 active:scale-[0.98] transition-all disabled:opacity-50"
            >
                <CreditCard size={12} />
                {loading ? 'Opening...' : 'Manage Billing'}
            </button>
        </div>
    );
}

// ── Invoice row ────────────────────────────────────────────────────────────────
function InvoiceRow({ tx }: { tx: { id: string; amount: number; timestamp: string; status: string; hash?: string } }) {
    return (
        <div className="flex items-center justify-between py-3.5 border-b border-black/5 last:border-0 gap-3">
            <div className="flex flex-col gap-0.5 min-w-0">
                <span className="text-[11px] font-mono font-black text-[#050505] truncate">{tx.hash ? `Tx: ${tx.hash.slice(0, 12)}...` : `Payment #${tx.id.slice(0, 8)}`}</span>
                <span className="text-[10px] text-black/40 font-medium">{formatDate(tx.timestamp)}</span>
            </div>
            <div className="flex items-center gap-3 shrink-0">
                <span className={`text-[9px] font-black uppercase tracking-widest px-2 py-0.5 rounded-full border ${tx.status === 'CONFIRMED' ? 'bg-emerald-500/10 text-emerald-600 border-emerald-500/20' : 'bg-amber-500/10 text-amber-600 border-amber-500/20'}`}>
                    {tx.status}
                </span>
                <span className="text-[13px] font-mono font-black text-[#050505]">{formatCents(tx.amount || 0)}</span>
            </div>
        </div>
    );
}

// ── Main Component ─────────────────────────────────────────────────────────────
export function SubscriptionDashboard() {
    const { address } = useSystemAccount();
    const [session, setSession] = useState<SessionData | null>(null);
    const [loading, setLoading] = useState(true);
    const [refreshing, setRefreshing] = useState(false);
    const [loadingTier, setLoadingTier] = useState<string | null>(null);
    const [usage, setUsage] = useState<any>(null);

    const isOwner = address?.toLowerCase() === OWNER_WALLET;

    const loadSession = async (silent = false) => {
        if (!silent) setLoading(true);
        else setRefreshing(true);
        try {
            // Auto-provision permanent access for the owner wallet
            const currentAddr = address?.toLowerCase();
            if (currentAddr === OWNER_WALLET) {
                await fetch('/api/payments/provision-owner', { method: 'POST', credentials: 'include' }).catch(() => {});
            }
            const res = await fetch('/api/auth/session', { cache: 'no-store', credentials: 'include' });
            if (res.ok) {
                setSession(await res.json());
                const usageRes = await fetch('/api/user/usage', { cache: 'no-store', credentials: 'include' });
                if (usageRes.ok) {
                    setUsage(await usageRes.json());
                }
            }
        } finally {
            setLoading(false);
            setRefreshing(false);
        }
    };

    useEffect(() => { loadSession(); }, [address]);

    const user = session?.user;
    const tierKey = getTierKey(user?.tier || 'FREE');
    const plan: PlanConfig = NODE_TIERS[tierKey];
    const sub = user?.subscription;
    const transactions = user?.transactions || [];

    // Effective status for owner
    const effectiveStatus = isOwner ? 'VIP' : (sub?.status ?? (user ? 'FREE' : 'NOT_CONNECTED'));
    const effectiveTierName = isOwner ? 'Archive Prover (VIP ∞)' : plan.name;

    const handleSubscription = async (tier: string) => {
        if (!address) { alert('Please connect your wallet first.'); return; }
        setLoadingTier(tier);
        try {
            const response = await fetch('/api/payments/checkout', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                credentials: 'include',
                body: JSON.stringify({ tier, isAnnual: false, userId: address }),
            });
            const data = await response.json();
            if (data.url) window.location.href = data.url;
            else throw new Error(data.error || 'Failed to start checkout');
        } catch (error: any) {
            alert(`Checkout error: ${error.message}`);
        } finally {
            setLoadingTier(null);
        }
    };

    if (loading) {
        return (
            <div className="w-full h-full flex items-center justify-center p-8 min-h-[400px]">
                <div className="w-6 h-6 border-2 border-[#050505] border-t-transparent rounded-full animate-spin" />
            </div>
        );
    }

    if (!user && !isOwner) {
        return (
            <div className="w-full flex flex-col items-center justify-center p-12 gap-4 min-h-[400px]">
                <Shield size={32} className="text-black/20" />
                <h2 className="text-xl font-black text-[#050505]">Session Required</h2>
                <p className="text-sm text-black/50 text-center max-w-xs">Connect your wallet and sign in to access your subscription dashboard.</p>
            </div>
        );
    }

    return (
        <div className="w-full h-full overflow-y-auto p-4 md:p-8 space-y-8 bg-[#F5F5F5]">

            {/* Header / Plan Section like Google AI Studio */}
            <div className="space-y-3">
                <h2 className="text-lg font-black text-[#050505]">Plan</h2>
                <div className="rounded-2xl border border-black/5 bg-white p-5 flex flex-col md:flex-row md:items-center justify-between gap-4">
                    <div>
                        <h3 className="text-[15px] font-black text-[#050505]">Your Plan: {effectiveTierName}</h3>
                        <p className="text-[13px] text-black/50 mt-1">
                            {isOwner 
                                ? "This wallet has permanent VIP access to all network features."
                                : "This account is subject to the limits and features of the currently active tier."
                            }
                        </p>
                    </div>
                    {!isOwner && (
                        <ManageButton tier={tierKey} onUpgrade={() => loadSession(true)} />
                    )}
                </div>
            </div>

            {/* VIP banner */}
            <div className="flex items-start justify-between gap-4 flex-wrap">
                <div>
                    <div className="flex items-center gap-2 mb-1">
                        <BarChart3 size={14} className="text-black/40" />
                        <span className="text-[10px] font-black uppercase tracking-widest text-black/40">Subscription Dashboard</span>
                    </div>
                    <h1 className="text-2xl font-black text-[#050505] tracking-tight">{effectiveTierName}</h1>
                    <div className="flex items-center gap-2 mt-2 flex-wrap">
                        <StatusBadge status={effectiveStatus} />
                        {isOwner && (
                            <span className="inline-flex items-center gap-1.5 text-[9px] font-black uppercase tracking-widest px-2.5 py-1 rounded-full border bg-amber-500/10 text-amber-600 border-amber-500/20">
                                <Crown size={9} />
                                Owner
                            </span>
                        )}
                    </div>
                </div>
                <button
                    onClick={() => loadSession(true)}
                    disabled={refreshing}
                    className="flex items-center gap-2 px-4 py-2 rounded-xl border border-black/10 text-[10px] font-black uppercase tracking-widest text-black/50 hover:text-[#050505] hover:bg-black/5 active:scale-[0.98] transition-all disabled:opacity-50"
                >
                    <RefreshCw size={12} className={refreshing ? 'animate-spin' : ''} />
                    Refresh
                </button>
            </div>

            {/* Quotas Section */}
            <div className="space-y-4">
                <div className="space-y-1.5">
                    <h2 className="text-lg font-black text-[#050505]">Network Quotas</h2>
                    <p className="text-[13px] text-black/50 max-w-3xl">
                        Within your active plan, usage is constrained by daily limits. Quota is consumed for every Digital Product Passport (DPP) created on the network. Your limits will automatically reset at UTC midnight.
                    </p>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    
                    {/* DPP Quota Card */}
                    <div className="rounded-2xl border border-black/5 bg-white p-6 flex flex-col justify-between min-h-[140px]">
                        <div className="flex items-center gap-2 text-[#050505] mb-6">
                            <Activity size={16} />
                            <span className="font-bold text-[14px]">Daily DPP Creation Limit</span>
                        </div>
                        
                        <div className="flex items-end justify-between gap-4">
                            <div>
                                <h4 className="text-[14px] font-bold text-[#050505]">Daily Limit</h4>
                                <p className="text-[12px] text-black/50 mt-1">
                                    {plan.limits.requestsPerDay === -1 
                                        ? "You have unlimited DPP creation." 
                                        : `You have used ${usage?.todayPassports || 0} of your ${plan.limits.requestsPerDay.toLocaleString()} daily passports.`
                                    }
                                </p>
                            </div>
                            <div className="flex items-center gap-3 shrink-0">
                                {plan.limits.requestsPerDay === -1 ? (
                                    <span className="text-xl font-bold text-emerald-600">∞</span>
                                ) : (
                                    <>
                                        <span className="text-[15px] font-bold text-[#050505]">
                                            {Math.round(((usage?.todayPassports || 0) / plan.limits.requestsPerDay) * 100)}%
                                        </span>
                                        <div className="relative flex items-center justify-center w-8 h-8">
                                            <svg className="transform -rotate-90 w-8 h-8">
                                                <circle cx="16" cy="16" r="12" stroke="currentColor" strokeWidth="4" fill="transparent" className="text-black/10" />
                                                <circle cx="16" cy="16" r="12" stroke="currentColor" strokeWidth="4" fill="transparent" 
                                                    strokeDasharray={2 * Math.PI * 12} 
                                                    strokeDashoffset={(2 * Math.PI * 12) - (((usage?.todayPassports || 0) / plan.limits.requestsPerDay) * (2 * Math.PI * 12))} 
                                                    className="text-emerald-500" 
                                                    strokeLinecap="round" 
                                                />
                                            </svg>
                                        </div>
                                    </>
                                )}
                            </div>
                        </div>
                    </div>

                    {/* API Keys Quota Card */}
                    <div className="rounded-2xl border border-black/5 bg-white p-6 flex flex-col justify-between min-h-[140px]">
                        <div className="flex items-center gap-2 text-[#050505] mb-6">
                            <Key size={16} />
                            <span className="font-bold text-[14px]">API Keys Limit</span>
                        </div>
                        
                        <div className="flex items-end justify-between gap-4">
                            <div>
                                <h4 className="text-[14px] font-bold text-[#050505]">Total Keys</h4>
                                <p className="text-[12px] text-black/50 mt-1">
                                    {plan.limits.maxApiKeys === -1 
                                        ? "You have unlimited API Keys." 
                                        : `You can create up to ${plan.limits.maxApiKeys} API relay keys.`
                                    }
                                </p>
                            </div>
                            <div className="flex items-center gap-3 shrink-0">
                                {plan.limits.maxApiKeys === -1 ? (
                                    <span className="text-xl font-bold text-emerald-600">∞</span>
                                ) : (
                                    <>
                                        <span className="text-[15px] font-bold text-[#050505]">
                                            0%
                                        </span>
                                        <div className="relative flex items-center justify-center w-8 h-8">
                                            <svg className="transform -rotate-90 w-8 h-8">
                                                <circle cx="16" cy="16" r="12" stroke="currentColor" strokeWidth="4" fill="transparent" className="text-black/10" />
                                                <circle cx="16" cy="16" r="12" stroke="currentColor" strokeWidth="4" fill="transparent" 
                                                    strokeDasharray={2 * Math.PI * 12} 
                                                    strokeDashoffset={2 * Math.PI * 12} 
                                                    className="text-emerald-500" 
                                                    strokeLinecap="round" 
                                                />
                                            </svg>
                                        </div>
                                    </>
                                )}
                            </div>
                        </div>
                    </div>

                </div>
            </div>

            {/* Plan + billing details */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">

                {/* Current plan card */}
                <div className="rounded-2xl border border-black/8 bg-white p-6 space-y-4">
                    <div className="flex items-center gap-2 mb-1">
                        <Zap size={13} className="text-black/40" />
                        <p className="text-[10px] font-black uppercase tracking-widest text-black/40">Current Plan</p>
                    </div>

                    <div className="flex items-baseline gap-2">
                        <span className="text-3xl font-black text-[#050505]">
                            {isOwner ? '∞' : `$${(plan.priceMetrics.monthly / 100).toLocaleString('en-US', { minimumFractionDigits: 0 })}`}
                        </span>
                        {!isOwner && <span className="text-[11px] text-black/40 font-mono uppercase">/mo</span>}
                    </div>

                    <div className="space-y-0">
                        <FeatureRow label="REST API Access" active={true} />
                        <FeatureRow label="WebSocket Streams" active={plan.features.webSockets} />
                        <FeatureRow label="Supply Chain ERP Integration" active={plan.features.fixProtocol} />
                        <FeatureRow label="Advanced Audit Trails" active={plan.features.darkPoolDetection} />
                        <FeatureRow label="Digital Product Passports" active={plan.features.heikinAshiSignals} />
                        <FeatureRow label="CSV / Parquet Export" active={plan.features.csvExport} />
                        <FeatureRow label="IP Whitelist & HMAC" active={plan.features.hmacRequired} />
                    </div>
                </div>

                {/* Billing status card */}
                <div className="rounded-2xl border border-black/8 bg-white p-6 space-y-5">
                    <div className="flex items-center gap-2 mb-1">
                        <Calendar size={13} className="text-black/40" />
                        <p className="text-[10px] font-black uppercase tracking-widest text-black/40">Billing Status</p>
                    </div>

                    <div className="space-y-3">
                        {[
                            { label: 'Plan', value: effectiveTierName },
                            { label: 'Status', value: <StatusBadge status={effectiveStatus} /> },
                            {
                                label: 'Renews / Expires',
                                value: isOwner ? 'Never (Permanent)' : (sub?.expiresAt ? formatDate(sub.expiresAt) : '—')
                            },
                            {
                                label: 'Member Since',
                                value: sub?.createdAt ? formatDate(sub.createdAt) : formatDate(new Date().toISOString())
                            },
                            {
                                label: 'Wallet',
                                value: <span className="font-mono text-[11px]">{(user?.walletAddress || address || '').slice(0, 8)}...{(user?.walletAddress || address || '').slice(-6)}</span>
                            }
                        ].map(({ label, value }) => (
                            <div key={label} className="flex justify-between items-center border-b border-black/5 pb-3 last:border-0 last:pb-0 gap-2">
                                <span className="text-[11px] text-black/50 font-medium shrink-0">{label}</span>
                                <span className="text-[11px] font-black text-[#050505] text-right">{value}</span>
                            </div>
                        ))}
                    </div>

                    {!isOwner && (
                        <div className="pt-2">
                            <ManageButton tier={tierKey} onUpgrade={() => {}} />
                        </div>
                    )}
                </div>
            </div>


            {/* Invoice history */}
            <div className="rounded-2xl border border-black/8 bg-white p-6">
                <div className="flex items-center gap-2 mb-4">
                    <Clock size={13} className="text-black/40" />
                    <p className="text-[10px] font-black uppercase tracking-widest text-black/40">Payment History</p>
                </div>
                {transactions.length === 0 ? (
                    <div className="py-8 flex flex-col items-center gap-2 text-center">
                        <CreditCard size={24} className="text-black/15" />
                        <p className="text-[12px] text-black/40 font-medium">
                            {isOwner ? 'Owner access granted — no payment required.' : 'No payments on record yet.'}
                        </p>
                        {isOwner && (
                            <p className="text-[11px] text-black/30">Your wallet holds permanent VIP access to all features.</p>
                        )}
                    </div>
                ) : (
                    <div>
                        {transactions.map(tx => <InvoiceRow key={tx.id} tx={tx} />)}
                    </div>
                )}
            </div>

        </div>
    );
}

