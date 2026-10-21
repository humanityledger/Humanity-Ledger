'use client';

import { isZkEnabled } from '@/lib/features/zk';

import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Shield, TrendingUp, ArrowUpRight, ArrowDownLeft,
  Gift, Award, Briefcase, ChevronDown, ChevronUp,
  ExternalLink, Plus, X, CheckCircle,
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

// â”€â”€â”€ Props â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

interface ZkCommunityTreasuryProps {
  communityId: string;
  communityName: string;
  isAdmin?: boolean;
  currentUserAddress?: string;
}

// â”€â”€â”€ Toast â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

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
      className="fixed bottom-6 right-6 z-[9999] flex items-center gap-2 bg-gray-900 text-white text-[13px] font-semibold px-4 py-3 rounded-2xl shadow-2xl"
    >
      <CheckCircle size={14} className="text-[#1C1C1E]" />
      {message}
    </motion.div>
  );
}

// â”€â”€â”€ Bounty Card â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

function BountyCard({ bounty, onClaim }: { key?: React.Key; bounty: ZkBounty; onClaim: () => void }) {
  const msLeft = bounty.expiresAt - Date.now();
  const daysLeft = Math.max(0, Math.floor(msLeft / 86_400_000));

  return (
    <div className="bg-white rounded-2xl border border-black/[0.06] p-4 space-y-3">
      <div className="flex items-start justify-between gap-2">
        <div>
          <h4 className="font-bold text-gray-900 text-[14px]">{bounty.title}</h4>
          <p className="text-[11px] text-gray-500 mt-0.5 leading-relaxed">{bounty.description}</p>
        </div>
        <div className="flex-shrink-0 bg-[#1C1C1E]/10 text-[#1C1C1E] font-bold text-[13px] px-3 py-1.5 rounded-xl text-center">
          {bounty.reward}<br />
          <span className="text-[9px] font-medium">{bounty.token}</span>
        </div>
      </div>
      {bounty.skills && bounty.skills.length > 0 && (
        <div className="flex flex-wrap gap-1.5">
          {bounty.skills.map(s => (
            <span key={s} className="text-[10px] font-medium bg-[#f0f2f5] text-gray-600 px-2 py-0.5 rounded-full">{s}</span>
          ))}
        </div>
      )}
      <div className="flex items-center justify-between">
        <span className="text-[10px] text-gray-400">
          {daysLeft > 0 ? `Expires in ${daysLeft}d` : 'Expired'}
        </span>
        <button
          onClick={onClaim}
          disabled={daysLeft === 0}
          className="py-1.5 px-4 rounded-xl text-[12px] font-bold text-white disabled:opacity-40"
          style={{ background: '#1C1C1E' }}
        >
          Claim Bounty
        </button>
      </div>
    </div>
  );
}

// â”€â”€â”€ Main Component â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

export function ZkCommunityTreasury({
  communityId,
  communityName,
  isAdmin = false,
  currentUserAddress = '',
}: ZkCommunityTreasuryProps) {
  if (!isZkEnabled) return null;
  const [treasury,   setTreasury]   = useState<ZkCommunityTreasuryModel>(getCommunityTreasury(communityId));
  const [stats,      setStats]      = useState<ZkCommunityStats>(getCommunityStats(communityId));
  const [tips,       setTips]       = useState<ZkTip[]>(getCommunityTips(communityId).slice(0, 10));
  const [bounties,   setBounties]   = useState<ZkBounty[]>(getOpenBounties(communityId));
  const [toast,      setToast]      = useState('');

  // Deposit form
  const [depAmount, setDepAmount] = useState('');
  const [depToken,  setDepToken]  = useState<SupportedToken>('DAI');

  // Withdraw form
  const [wdAmount, setWdAmount] = useState('');
  const [wdToken,  setWdToken]  = useState<SupportedToken>('DAI');
  const [wdNote,   setWdNote]   = useState('');

  // Bounty creation
  const [showBountyForm, setShowBountyForm] = useState(false);
  const [bTitle,  setBTitle]  = useState('');
  const [bDesc,   setBDesc]   = useState('');
  const [bReward, setBReward] = useState('');
  const [bToken,  setBToken]  = useState<SupportedToken>('DAI');
  const [bSkills, setBSkills] = useState('');

  // Section toggles
  const [showWithdraw, setShowWithdraw] = useState(false);
  const [showTippers,  setShowTippers]  = useState(false);

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
    setToast(`Deposited ${amt} zk${depToken} to treasury!`);
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
    setToast('Bounty claimed! Await payment from poster.');
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
    setToast(`Bounty "${bTitle}" posted!`);
    refresh();
  };

  const TOKENS: SupportedToken[] = ['DAI', 'USDC', 'ETH'];

  return (
    <div
      className="bg-[#f0f2f5] rounded-3xl overflow-hidden"
      style={{ fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif' }}
    >
      {/* Header */}
      <div className="bg-white px-5 py-4 border-b border-black/[0.06]">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-full flex items-center justify-center"
            style={{ background: '#1C1C1E' }}>
            <Shield size={18} className="text-white" strokeWidth={2} />
          </div>
          <div>
            <h2 className="font-bold text-gray-900 text-[16px]">Community Treasury</h2>
            <span className="text-[11px] font-semibold text-[#1C1C1E] bg-[#1C1C1E]/10 px-2 py-0.5 rounded-full">
              {communityName}
            </span>
          </div>
        </div>
      </div>

      <div className="p-4 space-y-3">

        {/* Balance Cards */}
        <div className="grid grid-cols-3 gap-2">
          {([
            { symbol: 'DAI',  val: treasury.balance.dai,  emoji: 'â—ˆ' },
            { symbol: 'USDC', val: treasury.balance.usdc, emoji: '$' },
            { symbol: 'ETH',  val: treasury.balance.eth,  emoji: 'Îž' },
          ] as const).map(({ symbol, val, emoji }) => (
            <div key={symbol} className="bg-white rounded-2xl p-3 text-center shadow-sm border border-black/[0.04]">
              <div className="text-xl mb-1">{emoji}</div>
              <div className="text-[13px] font-bold text-gray-900">{val}</div>
              <div className="text-[9px] text-gray-400 font-semibold uppercase">zk{symbol}</div>
            </div>
          ))}
        </div>

        {/* Stats row */}
        <div className="bg-white rounded-2xl shadow-sm border border-black/[0.04] px-4 py-3">
          <div className="grid grid-cols-2 gap-3">
            {[
              { label: 'Total Inflow',   value: `${treasury.totalInflow.toFixed(2)} DAI` },
              { label: 'Total Outflow',  value: `${treasury.totalOutflow.toFixed(2)} DAI` },
              { label: 'Active Bounties', value: String(stats.activeBounties) },
              { label: 'Tip Volume',     value: `$${stats.totalVolume}` },
            ].map(({ label, value }) => (
              <div key={label}>
                <div className="text-[10px] text-gray-400 font-medium">{label}</div>
                <div className="text-[13px] font-bold text-gray-900">{value}</div>
              </div>
            ))}
          </div>
        </div>

        {/* Deposit */}
        <div className="bg-white rounded-2xl shadow-sm border border-black/[0.04] p-4 space-y-3">
          <div className="flex items-center gap-2">
            <ArrowDownLeft size={15} className="text-[#1C1C1E]" strokeWidth={2} />
            <span className="font-semibold text-gray-800 text-[14px]">Deposit to Treasury</span>
          </div>
          <div className="flex gap-1.5">
            {TOKENS.map(t => (
              <button key={t} onClick={() => setDepToken(t)}
                className="flex-1 py-1.5 rounded-xl text-[11px] font-semibold transition-all"
                style={{ background: depToken === t ? '#1C1C1E' : '#f0f2f5', color: depToken === t ? '#fff' : '#6B7280' }}>
                {t}
              </button>
            ))}
          </div>
          <div className="flex gap-2">
            <input
              type="number" min="0" step="any" placeholder="Amount"
              value={depAmount} onChange={e => setDepAmount(e.target.value)}
              className="flex-1 bg-[#f0f2f5] rounded-xl px-3 py-2.5 text-[14px] font-bold text-gray-900 outline-none border-2 border-transparent focus:border-[#1C1C1E] transition-colors"
            />
            <button onClick={handleDeposit}
              disabled={!depAmount || parseFloat(depAmount) <= 0}
              className="px-4 py-2.5 rounded-xl font-bold text-[13px] text-white disabled:opacity-50"
              style={{ background: '#1C1C1E' }}>
              Deposit
            </button>
          </div>
        </div>

        {/* Withdraw (admin only) */}
        {isAdmin && (
          <div className="bg-white rounded-2xl shadow-sm border border-black/[0.04] overflow-hidden">
            <button
              onClick={() => setShowWithdraw(v => !v)}
              className="w-full flex items-center gap-2 px-4 py-3"
            >
              <ArrowUpRight size={15} className="text-orange-500" strokeWidth={2} />
              <span className="font-semibold text-gray-800 text-[14px] flex-1 text-left">Withdraw (Admin)</span>
              {showWithdraw ? <ChevronUp size={14} className="text-gray-400" /> : <ChevronDown size={14} className="text-gray-400" />}
            </button>
            <AnimatePresence>
              {showWithdraw && (
                <motion.div
                  initial={{ height: 0, opacity: 0 }}
                  animate={{ height: 'auto', opacity: 1 }}
                  exit={{ height: 0, opacity: 0 }}
                  transition={{ duration: 0.2 }}
                  className="overflow-hidden"
                >
                  <div className="px-4 pb-4 space-y-2.5">
                    <div className="flex gap-1.5">
                      {TOKENS.map(t => (
                        <button key={t} onClick={() => setWdToken(t)}
                          className="flex-1 py-1.5 rounded-xl text-[11px] font-semibold"
                          style={{ background: wdToken === t ? '#FF9500' : '#f0f2f5', color: wdToken === t ? '#fff' : '#6B7280' }}>
                          {t}
                        </button>
                      ))}
                    </div>
                    <input
                      type="number" min="0" placeholder="Amount"
                      value={wdAmount} onChange={e => setWdAmount(e.target.value)}
                      className="w-full bg-[#f0f2f5] rounded-xl px-3 py-2.5 text-[14px] font-bold outline-none border-2 border-transparent focus:border-orange-400 transition-colors"
                    />
                    <input
                      type="text" placeholder="Reason / note (optional)"
                      value={wdNote} onChange={e => setWdNote(e.target.value)}
                      className="w-full bg-[#f0f2f5] rounded-xl px-3 py-2.5 text-[13px] outline-none border-2 border-transparent focus:border-orange-400 transition-colors"
                    />
                    <button onClick={handleWithdraw}
                      disabled={!wdAmount || parseFloat(wdAmount) <= 0}
                      className="w-full py-2.5 rounded-xl font-bold text-[13px] text-white disabled:opacity-50 bg-orange-500">
                      Withdraw from Treasury
                    </button>
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        )}

        {/* Top Tippers */}
        {tips.length > 0 && (
          <div className="bg-white rounded-2xl shadow-sm border border-black/[0.04] overflow-hidden">
            <button onClick={() => setShowTippers(v => !v)} className="w-full flex items-center gap-2 px-4 py-3">
              <Gift size={15} className="text-[#1C1C1E]" strokeWidth={2} />
              <span className="font-semibold text-gray-800 text-[14px] flex-1 text-left">Top Tippers</span>
              <span className="text-[10px] text-gray-400">{tips.length} tips</span>
              {showTippers ? <ChevronUp size={14} className="text-gray-400" /> : <ChevronDown size={14} className="text-gray-400" />}
            </button>
            <AnimatePresence>
              {showTippers && (
                <motion.div
                  initial={{ height: 0, opacity: 0 }}
                  animate={{ height: 'auto', opacity: 1 }}
                  exit={{ height: 0, opacity: 0 }}
                  transition={{ duration: 0.2 }}
                  className="overflow-hidden"
                >
                  <div className="divide-y divide-black/[0.04]">
                    {stats.topContributors.slice(0, 5).map((c, i) => (
                      <div key={c.zkHandle + i} className="flex items-center gap-3 px-4 py-2.5">
                        <span className="text-[11px] font-bold text-gray-400 w-4">#{i + 1}</span>
                        <span className="font-medium text-gray-800 text-[13px] flex-1 truncate">{c.zkHandle}</span>
                        <span className="text-[12px] font-bold text-[#1C1C1E]">{c.amount} {c.token}</span>
                      </div>
                    ))}
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        )}

        {/* Bounties */}
        <div className="space-y-2">
          <div className="flex items-center justify-between px-1">
            <div className="flex items-center gap-2">
              <Briefcase size={14} className="text-[#1C1C1E]" strokeWidth={2} />
              <span className="font-semibold text-gray-800 text-[14px]">Open Bounties ({bounties.length})</span>
            </div>
            {isAdmin && (
              <button
                onClick={() => setShowBountyForm(v => !v)}
                className="flex items-center gap-1 text-[11px] font-semibold text-[#1C1C1E] bg-[#1C1C1E]/10 px-3 py-1.5 rounded-full"
              >
                <Plus size={11} /> New Bounty
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
                <div className="bg-white rounded-2xl border border-black/[0.06] p-4 space-y-2.5">
                  <input type="text" placeholder="Bounty title *" value={bTitle} onChange={e => setBTitle(e.target.value)}
                    className="w-full bg-[#f0f2f5] rounded-xl px-3 py-2.5 text-[13px] font-medium outline-none border-2 border-transparent focus:border-[#1C1C1E] transition-colors" />
                  <textarea placeholder="Description" value={bDesc} onChange={e => setBDesc(e.target.value)} rows={2}
                    className="w-full bg-[#f0f2f5] rounded-xl px-3 py-2 text-[12px] outline-none border-2 border-transparent focus:border-[#1C1C1E] transition-colors resize-none" />
                  <div className="flex gap-2">
                    <input type="number" placeholder="Reward *" value={bReward} onChange={e => setBReward(e.target.value)}
                      className="flex-1 bg-[#f0f2f5] rounded-xl px-3 py-2.5 text-[13px] font-bold outline-none border-2 border-transparent focus:border-[#1C1C1E] transition-colors" />
                    {TOKENS.map(t => (
                      <button key={t} onClick={() => setBToken(t)}
                        className="px-3 py-2.5 rounded-xl text-[11px] font-bold transition-all"
                        style={{ background: bToken === t ? '#1C1C1E' : '#f0f2f5', color: bToken === t ? '#fff' : '#6B7280' }}>
                        {t}
                      </button>
                    ))}
                  </div>
                  <input type="text" placeholder="Skills (comma separated, optional)" value={bSkills} onChange={e => setBSkills(e.target.value)}
                    className="w-full bg-[#f0f2f5] rounded-xl px-3 py-2 text-[12px] outline-none border-2 border-transparent focus:border-[#1C1C1E] transition-colors" />
                  <div className="flex gap-2">
                    <button onClick={() => setShowBountyForm(false)}
                      className="flex-1 py-2.5 rounded-xl font-semibold text-[12px] bg-[#f0f2f5] text-gray-600">
                      Cancel
                    </button>
                    <button onClick={handleCreateBounty}
                      disabled={!bTitle || !bReward}
                      className="flex-1 py-2.5 rounded-xl font-bold text-[12px] text-white disabled:opacity-50"
                      style={{ background: '#1C1C1E' }}>
                      Post Bounty
                    </button>
                  </div>
                </div>
              </motion.div>
            )}
          </AnimatePresence>

          {bounties.length === 0 ? (
            <div className="bg-white rounded-2xl border border-black/[0.06] py-8 flex flex-col items-center gap-2 text-gray-400">
              <Briefcase size={24} strokeWidth={1.5} className="text-gray-300" />
              <span className="text-[12px]">No open bounties</span>
            </div>
          ) : (
            <div className="space-y-2">
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

        {/* Aztec attribution */}
        <div className="flex items-center justify-center gap-1.5 py-1">
          <Shield size={10} className="text-gray-300" />
          <span className="text-[10px] text-gray-400">
            Shielded by <a href="https://aztec.network" target="_blank" rel="noopener noreferrer" className="text-[#1C1C1E] font-medium">Aztec Network</a>
          </span>
        </div>
      </div>

      {/* Toast */}
      <AnimatePresence>
        {toast && <Toast message={toast} onClose={() => setToast('')} />}
      </AnimatePresence>
    </div>
  );
}

