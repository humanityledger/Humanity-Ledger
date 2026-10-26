'use client';

import { isZkEnabled } from '@/lib/features/zk';

import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Shield, TrendingUp, ArrowUpRight, ArrowDownLeft,
  Gift, Award, Briefcase, ChevronDown, ChevronUp,
  ExternalLink, Plus, X, CheckCircle, Lock, Coins,
  Clock, Check
} from 'lucide-react';
import {
  getCommunityTreasury, addToTreasury, withdrawFromTreasury,
  type ZkCommunityTreasury as ZkCommunityTreasuryModel, SupportedToken,
} from '@/lib/zk/zkMoney';
import {
  getCommunityTips, getOpenBounties, claimBounty,
  createBounty, sendTip, ZkTip, ZkBounty,
  getCommunityStats, ZkCommunityStats,
} from '@/lib/zk/zkCommunityPayments';

// ─── Props ───────────────────────────────────────────────────────────────────

interface ZkCommunityTreasuryProps {
  communityId: string;
  communityName: string;
  isAdmin?: boolean;
  currentUserAddress?: string;
}

// ─── Toast ───────────────────────────────────────────────────────────────────

function Toast({ message, onClose }: { message: string; onClose: () => void }) {
  useEffect(() => {
    const t = setTimeout(onClose, 3500);
    return () => clearTimeout(t);
  }, [onClose]);

  return (
    <motion.div
      initial={{ opacity: 0, y: 24 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: 24 }}
      className="fixed bottom-6 right-6 z-[9999] flex items-center gap-2 bg-[#15171c] text-white text-[13px] font-semibold px-4 py-3 rounded-2xl shadow-2xl border border-white/10"
    >
      <Check size={14} className="text-white" />
      {message}
    </motion.div>
  );
}

// ─── Bounty Card ─────────────────────────────────────────────────────────────

function BountyCard({ bounty, onClaim }: { bounty: ZkBounty; onClaim: () => void }) {
  const msLeft = bounty.expiresAt - Date.now();
  const daysLeft = Math.max(0, Math.floor(msLeft / 86_400_000));

  return (
    <div className="bg-white rounded-2xl border border-black/[0.06] p-5 shadow-sm space-y-4">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0 flex-1">
          <h4 className="font-semibold text-[#15171c] text-[15px] leading-snug">{bounty.title}</h4>
          {bounty.description && (
            <p className="text-[13px] text-[#727a88] mt-1 leading-relaxed">{bounty.description}</p>
          )}
        </div>
        <div className="shrink-0 bg-[#f2f4f7] text-[#15171c] border border-black/[0.04] font-mono font-bold text-[14px] px-3.5 py-2 rounded-xl text-center">
          {bounty.reward} <span className="text-[11px] font-semibold text-[#727a88]">{bounty.token}</span>
        </div>
      </div>

      {bounty.skills && bounty.skills.length > 0 && (
        <div className="flex flex-wrap gap-1.5">
          {bounty.skills.map(s => (
            <span key={s} className="text-[11px] font-medium bg-[#f2f4f7] text-[#15171c] px-2.5 py-0.5 rounded-full border border-black/[0.03]">
              {s}
            </span>
          ))}
        </div>
      )}

      <div className="flex items-center justify-between pt-2 border-t border-black/[0.04]">
        <span className="text-[12px] font-medium text-[#727a88] flex items-center gap-1.5">
          <Clock size={12} />
          {daysLeft > 0 ? `${daysLeft} days remaining` : 'Expired'}
        </span>
        <button
          onClick={onClaim}
          disabled={daysLeft === 0}
          className="py-2 px-4 rounded-xl text-[12px] font-semibold text-white bg-[#15171c] hover:bg-black disabled:opacity-40 transition-all active:scale-95"
        >
          Claim Bounty
        </button>
      </div>
    </div>
  );
}

// ─── Main Component ──────────────────────────────────────────────────────────

export function ZkCommunityTreasury({
  communityId,
  communityName,
  isAdmin = false,
  currentUserAddress = '',
}: ZkCommunityTreasuryProps) {
  if (!isZkEnabled) return null;
  const [treasury, setTreasury] = useState<ZkCommunityTreasuryModel>(getCommunityTreasury(communityId));
  const [stats, setStats] = useState<ZkCommunityStats>(getCommunityStats(communityId));
  const [tips, setTips] = useState<ZkTip[]>(getCommunityTips(communityId).slice(0, 10));
  const [bounties, setBounties] = useState<ZkBounty[]>(getOpenBounties(communityId));
  const [toast, setToast] = useState('');

  // Deposit form
  const [depAmount, setDepAmount] = useState('');
  const [depToken, setDepToken] = useState<SupportedToken>('DAI');

  // Withdraw form
  const [wdAmount, setWdAmount] = useState('');
  const [wdToken, setWdToken] = useState<SupportedToken>('DAI');
  const [wdNote, setWdNote] = useState('');

  // Bounty creation
  const [showBountyForm, setShowBountyForm] = useState(false);
  const [bTitle, setBTitle] = useState('');
  const [bDesc, setBDesc] = useState('');
  const [bReward, setBReward] = useState('');
  const [bToken, setBToken] = useState<SupportedToken>('DAI');
  const [bSkills, setBSkills] = useState('');

  // Section toggles
  const [showWithdraw, setShowWithdraw] = useState(false);
  const [showTippers, setShowTippers] = useState(false);

  const refresh = () => {
    setTreasury(getCommunityTreasury(communityId));
    setStats(getCommunityStats(communityId));
    setTips(getCommunityTips(communityId).slice(0, 10));
    setBounties(getOpenBounties(communityId));
  };

  useEffect(() => {
    refresh();
    const handler = () => refresh();
    window.addEventListener('ledger_zk_treasury_updated', handler);
    window.addEventListener('ledger_zk_tip_sent', handler);
    window.addEventListener('ledger_zk_bounty_created', handler);
    window.addEventListener('ledger_zk_bounty_claimed', handler);
    return () => {
      window.removeEventListener('ledger_zk_treasury_updated', handler);
      window.removeEventListener('ledger_zk_tip_sent', handler);
      window.removeEventListener('ledger_zk_bounty_created', handler);
      window.removeEventListener('ledger_zk_bounty_claimed', handler);
    };
  }, [communityId]);

  const handleDeposit = () => {
    const amt = parseFloat(depAmount);
    if (!amt || amt <= 0) return;
    addToTreasury(communityId, amt, depToken);
    setDepAmount('');
    setToast(`Deposited ${amt} zk${depToken} to treasury`);
    refresh();
  };

  const handleWithdraw = () => {
    if (!isAdmin) return;
    const amt = parseFloat(wdAmount);
    if (!amt || amt <= 0) return;
    withdrawFromTreasury(communityId, amt, wdToken, wdNote);
    setWdAmount(''); setWdNote('');
    setToast(`Withdrew ${amt} zk${wdToken} from treasury`);
    refresh();
  };

  const handleClaimBounty = (bountyId: string) => {
    if (!currentUserAddress) return;
    claimBounty(bountyId, currentUserAddress);
    setToast('Bounty claimed! Awaiting poster verification.');
    refresh();
  };

  const handleCreateBounty = () => {
    if (!bTitle || !bReward || parseFloat(bReward) <= 0) return;
    createBounty({
      communityId,
      postedBy: currentUserAddress || 'zk:admin',
      title: bTitle,
      description: bDesc,
      reward: bReward,
      token: bToken,
      skills: bSkills ? bSkills.split(',').map(s => s.trim()).filter(Boolean) : [],
    });
    setBTitle(''); setBDesc(''); setBReward(''); setBSkills('');
    setShowBountyForm(false);
    setToast(`Bounty "${bTitle}" posted`);
    refresh();
  };

  const TOKENS: SupportedToken[] = ['DAI', 'USDC', 'ETH'];

  return (
    <div className="space-y-5">
      {/* ── HEADER CARD ── */}
      <div className="bg-white rounded-3xl p-6 shadow-sm border border-black/[0.06] flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
        <div className="flex items-center gap-4">
          <div className="w-12 h-12 rounded-2xl bg-[#15171c] text-white flex items-center justify-center shrink-0 shadow-sm">
            <Lock size={20} strokeWidth={2} />
          </div>
          <div>
            <div className="flex items-center gap-2 mb-1">
              <span className="text-[11px] font-semibold uppercase tracking-wider text-[#727a88] bg-[#f2f4f7] px-2.5 py-0.5 rounded-full">
                Shielded Vault
              </span>
              <span className="text-[11px] font-semibold text-[#15171c] bg-black/5 px-2.5 py-0.5 rounded-full flex items-center gap-1">
                <Shield size={11} /> Aztec Alpha
              </span>
            </div>
            <h2 className="text-xl md:text-2xl font-bold text-[#15171c] tracking-tight">
              {communityName} Treasury
            </h2>
            <p className="text-[13px] text-[#727a88] mt-0.5">
              Zero-knowledge vault for communal balances, grants, and confidential bounties.
            </p>
          </div>
        </div>

        {isAdmin && (
          <button
            onClick={() => setShowWithdraw(v => !v)}
            className="px-4 py-2.5 bg-[#f2f4f7] hover:bg-[#e6eaee] text-[#15171c] text-xs font-semibold rounded-xl border border-black/[0.05] transition-all active:scale-95 flex items-center gap-1.5 shrink-0"
          >
            <ArrowUpRight size={14} />
            <span>Manage Withdrawals</span>
          </button>
        )}
      </div>

      {/* ── BALANCES GRID ── */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        {[
          { symbol: 'DAI', val: treasury.balance.dai, label: 'zkDAI Note' },
          { symbol: 'USDC', val: treasury.balance.usdc, label: 'zkUSDC Note' },
          { symbol: 'ETH', val: treasury.balance.eth, label: 'zkETH Note' },
        ].map(({ symbol, val, label }) => (
          <div key={symbol} className="bg-white rounded-2xl p-5 border border-black/[0.06] shadow-sm text-center">
            <span className="text-[11px] font-semibold uppercase tracking-wider text-[#727a88] block mb-1">
              {label}
            </span>
            <div className="text-2xl font-bold font-mono text-[#15171c] tracking-tight">
              {val || '0.00'}
            </div>
            <span className="text-[11px] font-medium text-[#727a88] block mt-1">
              {symbol}
            </span>
          </div>
        ))}
      </div>

      {/* ── STATS ROW ── */}
      <div className="bg-white rounded-2xl shadow-sm border border-black/[0.06] p-5">
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          {[
            { label: 'Total Inflow', value: `${treasury.totalInflow.toFixed(2)} DAI` },
            { label: 'Total Outflow', value: `${treasury.totalOutflow.toFixed(2)} DAI` },
            { label: 'Active Bounties', value: String(stats.activeBounties) },
            { label: 'Tip Volume', value: `$${stats.totalVolume} USD` },
          ].map(({ label, value }) => (
            <div key={label} className="space-y-0.5">
              <span className="text-[11px] font-medium text-[#727a88] block">{label}</span>
              <span className="text-[16px] font-bold font-mono text-[#15171c] block">{value}</span>
            </div>
          ))}
        </div>
      </div>

      {/* ── DEPOSIT CARD ── */}
      <div className="bg-white rounded-2xl shadow-sm border border-black/[0.06] p-5 space-y-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <ArrowDownLeft size={16} className="text-[#15171c]" strokeWidth={2} />
            <h3 className="font-semibold text-[#15171c] text-[15px]">Deposit to Treasury</h3>
          </div>
          <span className="text-[11px] font-semibold text-[#727a88]">No public link to your wallet</span>
        </div>

        <div className="flex gap-2">
          {TOKENS.map(t => (
            <button
              key={t}
              onClick={() => setDepToken(t)}
              className={`flex-1 py-2 rounded-xl text-xs font-semibold transition-all ${
                depToken === t
                  ? 'bg-[#15171c] text-white shadow-sm'
                  : 'bg-[#f2f4f7] text-[#727a88] hover:text-[#15171c] hover:bg-[#e7ebef]'
              }`}
            >
              {t}
            </button>
          ))}
        </div>

        <div className="flex gap-2">
          <input
            type="number"
            min="0"
            step="any"
            placeholder="0.00"
            value={depAmount}
            onChange={e => setDepAmount(e.target.value)}
            className="flex-1 bg-[#f2f4f7] rounded-xl px-4 py-3 text-[15px] font-mono font-bold text-[#15171c] outline-none border border-transparent focus:border-[#15171c] focus:bg-white transition-all placeholder:text-[#a3a9b4]"
          />
          <button
            onClick={handleDeposit}
            disabled={!depAmount || parseFloat(depAmount) <= 0}
            className="px-6 py-3 rounded-xl font-semibold text-sm text-white bg-[#15171c] hover:bg-black disabled:opacity-40 transition-all active:scale-95 shadow-sm shrink-0"
          >
            Deposit
          </button>
        </div>
      </div>

      {/* ── WITHDRAW (ADMIN ONLY) ── */}
      {isAdmin && (
        <div className="bg-white rounded-2xl shadow-sm border border-black/[0.06] overflow-hidden">
          <button
            onClick={() => setShowWithdraw(v => !v)}
            className="w-full flex items-center justify-between p-5 hover:bg-[#f2f4f7]/50 transition-colors text-left"
          >
            <div className="flex items-center gap-2.5">
              <ArrowUpRight size={16} className="text-[#15171c]" strokeWidth={2} />
              <span className="font-semibold text-[#15171c] text-[15px]">Withdraw Funds (Admin)</span>
            </div>
            {showWithdraw ? <ChevronUp size={16} className="text-[#727a88]" /> : <ChevronDown size={16} className="text-[#727a88]" />}
          </button>

          <AnimatePresence>
            {showWithdraw && (
              <motion.div
                initial={{ height: 0, opacity: 0 }}
                animate={{ height: 'auto', opacity: 1 }}
                exit={{ height: 0, opacity: 0 }}
                transition={{ duration: 0.2 }}
                className="overflow-hidden border-t border-black/[0.04]"
              >
                <div className="p-5 space-y-3 bg-[#f7f8fa]">
                  <div className="flex gap-2">
                    {TOKENS.map(t => (
                      <button
                        key={t}
                        onClick={() => setWdToken(t)}
                        className={`flex-1 py-2 rounded-xl text-xs font-semibold transition-all ${
                          wdToken === t
                            ? 'bg-[#15171c] text-white shadow-sm'
                            : 'bg-white text-[#727a88] hover:text-[#15171c] border border-black/[0.04]'
                        }`}
                      >
                        {t}
                      </button>
                    ))}
                  </div>

                  <input
                    type="number"
                    min="0"
                    placeholder="Amount to withdraw"
                    value={wdAmount}
                    onChange={e => setWdAmount(e.target.value)}
                    className="w-full bg-white rounded-xl px-4 py-3 text-[14px] font-mono font-bold text-[#15171c] outline-none border border-black/[0.06] focus:border-[#15171c] transition-all"
                  />

                  <input
                    type="text"
                    placeholder="Reason or proposal reference (optional)"
                    value={wdNote}
                    onChange={e => setWdNote(e.target.value)}
                    className="w-full bg-white rounded-xl px-4 py-3 text-[13px] text-[#15171c] outline-none border border-black/[0.06] focus:border-[#15171c] transition-all"
                  />

                  <button
                    onClick={handleWithdraw}
                    disabled={!wdAmount || parseFloat(wdAmount) <= 0}
                    className="w-full py-3 rounded-xl font-semibold text-sm text-white bg-[#15171c] hover:bg-black disabled:opacity-40 transition-all active:scale-95 shadow-sm"
                  >
                    Confirm Withdrawal
                  </button>
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      )}

      {/* ── TOP TIPPERS ACCORDION ── */}
      {tips.length > 0 && (
        <div className="bg-white rounded-2xl shadow-sm border border-black/[0.06] overflow-hidden">
          <button
            onClick={() => setShowTippers(v => !v)}
            className="w-full flex items-center justify-between p-5 hover:bg-[#f2f4f7]/50 transition-colors text-left"
          >
            <div className="flex items-center gap-2.5">
              <Gift size={16} className="text-[#15171c]" strokeWidth={2} />
              <span className="font-semibold text-[#15171c] text-[15px]">Top Supporters</span>
              <span className="text-[11px] font-semibold bg-[#f2f4f7] text-[#727a88] px-2.5 py-0.5 rounded-full">
                {tips.length} tips
              </span>
            </div>
            {showTippers ? <ChevronUp size={16} className="text-[#727a88]" /> : <ChevronDown size={16} className="text-[#727a88]" />}
          </button>

          <AnimatePresence>
            {showTippers && (
              <motion.div
                initial={{ height: 0, opacity: 0 }}
                animate={{ height: 'auto', opacity: 1 }}
                exit={{ height: 0, opacity: 0 }}
                transition={{ duration: 0.2 }}
                className="overflow-hidden border-t border-black/[0.04]"
              >
                <div className="divide-y divide-black/[0.04]">
                  {stats.topContributors.slice(0, 5).map((c, i) => (
                    <div key={c.zkHandle + i} className="flex items-center justify-between px-5 py-3">
                      <div className="flex items-center gap-3">
                        <span className="w-5 h-5 rounded-full bg-[#f2f4f7] flex items-center justify-center text-[11px] font-mono font-bold text-[#727a88]">
                          {i + 1}
                        </span>
                        <span className="font-mono text-[13px] font-semibold text-[#15171c]">{c.zkHandle}</span>
                      </div>
                      <span className="text-[13px] font-mono font-bold text-[#15171c]">{c.amount} {c.token}</span>
                    </div>
                  ))}
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      )}

      {/* ── BOUNTIES SECTION ── */}
      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Briefcase size={16} className="text-[#15171c]" strokeWidth={2} />
            <h3 className="font-semibold text-[#15171c] text-[15px]">
              Open Bounties ({bounties.length})
            </h3>
          </div>
          {isAdmin && (
            <button
              onClick={() => setShowBountyForm(v => !v)}
              className="flex items-center gap-1.5 text-xs font-semibold bg-[#15171c] hover:bg-black text-white px-3.5 py-2 rounded-xl transition-all active:scale-95 shadow-sm"
            >
              <Plus size={14} /> New Bounty
            </button>
          )}
        </div>

        {/* Bounty creation form */}
        <AnimatePresence>
          {showBountyForm && (
            <motion.div
              initial={{ height: 0, opacity: 0 }}
              animate={{ height: 'auto', opacity: 1 }}
              exit={{ height: 0, opacity: 0 }}
              transition={{ duration: 0.25 }}
              className="overflow-hidden"
            >
              <div className="bg-white rounded-2xl border border-black/[0.06] p-5 shadow-sm space-y-3">
                <input
                  type="text"
                  placeholder="Bounty title (e.g. Audit smart contract, Create landing illustration)"
                  value={bTitle}
                  onChange={e => setBTitle(e.target.value)}
                  className="w-full bg-[#f2f4f7] rounded-xl px-4 py-2.5 text-[14px] font-semibold text-[#15171c] outline-none border border-transparent focus:border-[#15171c] focus:bg-white transition-all placeholder:text-[#a3a9b4]"
                />
                <textarea
                  placeholder="Full scope and specifications..."
                  value={bDesc}
                  onChange={e => setBDesc(e.target.value)}
                  rows={3}
                  className="w-full bg-[#f2f4f7] rounded-xl px-4 py-2.5 text-[13px] text-[#15171c] outline-none border border-transparent focus:border-[#15171c] focus:bg-white transition-all resize-none placeholder:text-[#a3a9b4]"
                />
                <div className="flex gap-2">
                  <input
                    type="number"
                    placeholder="Reward amount"
                    value={bReward}
                    onChange={e => setBReward(e.target.value)}
                    className="flex-1 bg-[#f2f4f7] rounded-xl px-4 py-2.5 text-[14px] font-mono font-bold text-[#15171c] outline-none border border-transparent focus:border-[#15171c] focus:bg-white transition-all placeholder:text-[#a3a9b4]"
                  />
                  {TOKENS.map(t => (
                    <button
                      key={t}
                      onClick={() => setBToken(t)}
                      className={`px-4 py-2.5 rounded-xl text-xs font-semibold transition-all ${
                        bToken === t
                          ? 'bg-[#15171c] text-white shadow-sm'
                          : 'bg-[#f2f4f7] text-[#727a88] hover:text-[#15171c]'
                      }`}
                    >
                      {t}
                    </button>
                  ))}
                </div>
                <input
                  type="text"
                  placeholder="Required skills (e.g. TypeScript, Solidity, Noir) — comma separated"
                  value={bSkills}
                  onChange={e => setBSkills(e.target.value)}
                  className="w-full bg-[#f2f4f7] rounded-xl px-4 py-2 text-[12px] text-[#15171c] outline-none border border-transparent focus:border-[#15171c] focus:bg-white transition-all placeholder:text-[#a3a9b4]"
                />
                <div className="flex justify-end gap-2 pt-1">
                  <button
                    onClick={() => setShowBountyForm(false)}
                    className="px-4 py-2 rounded-xl text-xs font-semibold text-[#727a88] hover:bg-black/5"
                  >
                    Cancel
                  </button>
                  <button
                    onClick={handleCreateBounty}
                    disabled={!bTitle || !bReward}
                    className="px-5 py-2 rounded-xl font-semibold text-xs text-white bg-[#15171c] hover:bg-black disabled:opacity-40 transition-all active:scale-95 shadow-sm"
                  >
                    Publish Bounty
                  </button>
                </div>
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        {bounties.length === 0 ? (
          <div className="bg-white rounded-2xl border border-black/[0.06] py-12 flex flex-col items-center justify-center gap-2 text-center p-6 shadow-sm">
            <div className="w-12 h-12 rounded-2xl bg-[#f2f4f7] flex items-center justify-center mb-1 text-[#15171c]">
              <Briefcase size={22} strokeWidth={1.75} />
            </div>
            <h4 className="text-[15px] font-semibold text-[#15171c]">No active bounties</h4>
            <p className="text-[13px] text-[#727a88] max-w-xs">
              Community bounties allow members to fund and earn from tasks privately.
            </p>
          </div>
        ) : (
          <div className="space-y-3">
            {bounties.map(b => (
              <BountyCard
                key={b.id}
                bounty={b}
                onClaim={() => handleClaimBounty(b.id)}
              />
            ))}
          </div>
        )}
      </div>

      {/* ── FOOTER PROTOCOL NOTICE ── */}
      <div className="flex items-center justify-center gap-2 py-3 text-[12px] text-[#727a88]">
        <Shield size={13} className="text-[#15171c]" />
        <span>Confidential balances powered by Aztec Network zero-knowledge proofs.</span>
      </div>

      {/* Toast */}
      <AnimatePresence>
        {toast && <Toast message={toast} onClose={() => setToast('')} />}
      </AnimatePresence>
    </div>
  );
}
