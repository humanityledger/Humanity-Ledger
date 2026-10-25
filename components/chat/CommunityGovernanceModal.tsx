'use client';

import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Vote, Plus, CheckCircle2, XCircle, Clock, ChevronRight, X, Shield, Check } from 'lucide-react';
import { toast } from 'sonner';

interface CommunityGovernanceProps {
  communityId: string;
  communityName: string;
  myAddress: string;
}

export function CommunityGovernanceView({ communityId, communityName, myAddress }: CommunityGovernanceProps) {
  const [proposals, setProposals] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [votingId, setVotingId] = useState<string | null>(null);

  const fetchProposals = async () => {
    try {
      setLoading(true);
      const res = await fetch(`/api/chat/communities/${communityId}/proposals`);
      if (res.ok) {
        const data = await res.json();
        setProposals(data.proposals || []);
      }
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchProposals();
  }, [communityId]);

  const handleCreateProposal = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim() || !description.trim()) {
      toast.error('Title and description are required');
      return;
    }

    try {
      setSubmitting(true);
      const res = await fetch(`/api/chat/communities/${communityId}/proposals`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          title: title.trim(),
          description: description.trim(),
          creatorAddress: myAddress
        })
      });

      if (res.ok) {
        toast.success('Proposal submitted successfully');
        setTitle('');
        setDescription('');
        setShowCreateModal(false);
        fetchProposals();
      } else {
        const err = await res.json();
        toast.error(err.error || 'Failed to submit proposal');
      }
    } catch (err: any) {
      toast.error(err.message || 'Error submitting proposal');
    } finally {
      setSubmitting(false);
    }
  };

  const handleVote = async (proposalId: string, choice: 'FOR' | 'AGAINST') => {
    try {
      setVotingId(proposalId);
      const res = await fetch(`/api/chat/communities/${communityId}/proposals`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'VOTE',
          proposalId,
          voterAddress: myAddress,
          vote: choice
        })
      });

      if (res.ok) {
        toast.success(`Vote cast: ${choice}`);
        fetchProposals();
      } else {
        const err = await res.json();
        toast.error(err.error || 'Failed to record vote');
      }
    } catch (err: any) {
      toast.error(err.message || 'Error recording vote');
    } finally {
      setVotingId(null);
    }
  };

  return (
    <div className="max-w-3xl mx-auto px-4 py-5 pb-28 space-y-5">
      {/* ── GOVERNANCE HEADER ── */}
      <div className="bg-white rounded-3xl p-6 shadow-sm border border-black/[0.06] flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
        <div className="flex items-center gap-4">
          <div className="w-12 h-12 rounded-2xl bg-[#15171c] text-white flex items-center justify-center shrink-0 shadow-sm">
            <Vote size={20} strokeWidth={2} />
          </div>
          <div>
            <div className="flex items-center gap-2 mb-1">
              <span className="text-[11px] font-semibold uppercase tracking-wider text-[#727a88] bg-[#f2f4f7] px-2.5 py-0.5 rounded-full">
                Consensus Engine
              </span>
              <span className="text-[11px] font-semibold text-[#15171c] bg-black/5 px-2.5 py-0.5 rounded-full flex items-center gap-1">
                <Shield size={11} /> 1 Wallet = 1 Vote
              </span>
            </div>
            <h2 className="text-xl md:text-2xl font-bold text-[#15171c] tracking-tight">
              {communityName} Governance
            </h2>
            <p className="text-[13px] text-[#727a88] mt-0.5">
              Decentralized decision making. Submit and vote on proposals directly on-chain.
            </p>
          </div>
        </div>

        <button
          onClick={() => setShowCreateModal(true)}
          className="px-5 py-2.5 bg-[#15171c] hover:bg-black text-white text-xs font-semibold rounded-xl transition-all active:scale-95 flex items-center gap-1.5 shadow-sm shrink-0"
        >
          <Plus size={15} /> New Proposal
        </button>
      </div>

      {/* ── PROPOSALS LIST ── */}
      {loading ? (
        <div className="space-y-4">
          {[1, 2].map(i => (
            <div key={i} className="bg-white rounded-3xl p-6 border border-black/[0.06] shadow-sm animate-pulse space-y-3">
              <div className="h-4 bg-black/5 rounded-lg w-1/4" />
              <div className="h-5 bg-black/5 rounded-lg w-3/4" />
              <div className="h-3 bg-black/5 rounded-lg w-full" />
              <div className="h-8 bg-black/5 rounded-xl w-full" />
            </div>
          ))}
        </div>
      ) : proposals.length === 0 ? (
        <div className="bg-white rounded-3xl p-12 text-center border border-black/[0.06] shadow-sm space-y-3">
          <div className="w-12 h-12 rounded-2xl bg-[#f2f4f7] flex items-center justify-center mx-auto text-[#15171c]">
            <Vote size={22} strokeWidth={1.75} />
          </div>
          <h3 className="text-[17px] font-bold text-[#15171c]">No active proposals</h3>
          <p className="text-[13px] text-[#727a88] max-w-sm mx-auto leading-relaxed">
            Proposals allow community members to submit, discuss, and vote on collective decisions.
          </p>
          <button
            onClick={() => setShowCreateModal(true)}
            className="mt-3 px-5 py-2.5 bg-[#15171c] hover:bg-black text-white text-xs font-semibold rounded-xl transition-all active:scale-95 inline-flex items-center gap-1.5 shadow-sm"
          >
            <Plus size={14} /> Create the first proposal
          </button>
        </div>
      ) : (
        <div className="space-y-4">
          {proposals.map((proposal) => {
            const totalVotes = (proposal.votesFor || 0) + (proposal.votesAgainst || 0);
            const forPct = totalVotes > 0 ? Math.round((proposal.votesFor / totalVotes) * 100) : 50;
            const againstPct = totalVotes > 0 ? 100 - forPct : 50;
            const hasVoted = proposal.votes?.some(
              (v: any) => v.voterAddress?.toLowerCase() === myAddress?.toLowerCase()
            );

            return (
              <div
                key={proposal.id}
                className="bg-white rounded-3xl p-6 border border-black/[0.06] shadow-sm space-y-4"
              >
                <div className="flex items-start justify-between gap-4">
                  <div>
                    <span className="text-[11px] font-semibold uppercase tracking-wider px-2.5 py-0.5 rounded-full bg-[#f2f4f7] text-[#15171c] inline-block mb-2 border border-black/[0.04]">
                      {proposal.status || 'ACTIVE'}
                    </span>
                    <h3 className="text-lg font-bold text-[#15171c] leading-snug">
                      {proposal.question || proposal.title}
                    </h3>
                  </div>
                  <div className="text-right text-[12px] font-medium text-[#727a88] shrink-0 flex items-center gap-1.5">
                    <Clock size={13} />
                    <span>{new Date(proposal.votingEndsAt).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}</span>
                  </div>
                </div>

                <p className="text-[14px] text-[#15171c]/75 leading-relaxed">
                  {proposal.description}
                </p>

                {/* ── Monochrome Voting Bar ── */}
                <div className="space-y-2 pt-2">
                  <div className="flex justify-between text-xs font-semibold">
                    <span className="text-[#15171c] flex items-center gap-1.5 font-mono">
                      <CheckCircle2 size={13} /> For ({forPct}%)
                    </span>
                    <span className="text-[#727a88] flex items-center gap-1.5 font-mono">
                      <XCircle size={13} /> Against ({againstPct}%)
                    </span>
                  </div>
                  <div className="h-2.5 w-full bg-[#f2f4f7] rounded-full overflow-hidden flex border border-black/[0.03]">
                    <div style={{ width: `${forPct}%` }} className="bg-[#15171c] transition-all" />
                    <div style={{ width: `${againstPct}%` }} className="bg-[#d0d5dd] transition-all" />
                  </div>
                  <div className="text-[11px] font-medium text-[#727a88] text-right font-mono">
                    Total votes: {totalVotes}
                  </div>
                </div>

                {/* ── Vote Actions ── */}
                <div className="pt-3 flex items-center justify-between border-t border-black/[0.04]">
                  <span className="text-[12px] font-mono text-[#727a88]">
                    Proposed by {proposal.creatorAddress?.slice(0, 6)}...{proposal.creatorAddress?.slice(-4)}
                  </span>

                  {hasVoted ? (
                    <span className="text-xs font-semibold text-[#15171c] bg-black/5 px-3 py-1.5 rounded-xl border border-black/[0.04] flex items-center gap-1">
                      <Check size={12} /> Vote Submitted
                    </span>
                  ) : (
                    <div className="flex items-center gap-2">
                      <button
                        onClick={() => handleVote(proposal.id, 'FOR')}
                        disabled={votingId === proposal.id}
                        className="px-4 py-2 bg-[#15171c] hover:bg-black text-white text-xs font-semibold rounded-xl transition-all active:scale-95 disabled:opacity-50 shadow-sm"
                      >
                        Vote For
                      </button>
                      <button
                        onClick={() => handleVote(proposal.id, 'AGAINST')}
                        disabled={votingId === proposal.id}
                        className="px-4 py-2 bg-[#f2f4f7] hover:bg-[#e4e7ec] text-[#15171c] text-xs font-semibold rounded-xl border border-black/[0.05] transition-all active:scale-95 disabled:opacity-50"
                      >
                        Vote Against
                      </button>
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* ── CREATE PROPOSAL MODAL ── */}
      <AnimatePresence>
        {showCreateModal && (
          <div className="fixed inset-0 z-50 bg-black/40 backdrop-blur-sm flex items-center justify-center p-4">
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="bg-white rounded-3xl max-w-lg w-full p-6 shadow-2xl border border-black/10 space-y-4"
            >
              <div className="flex items-center justify-between border-b border-black/[0.05] pb-3">
                <h3 className="text-lg font-bold text-[#15171c]">Create Governance Proposal</h3>
                <button
                  onClick={() => setShowCreateModal(false)}
                  className="p-1 rounded-full hover:bg-black/5 text-[#727a88] hover:text-[#15171c] transition-colors"
                >
                  <X size={18} />
                </button>
              </div>

              <form onSubmit={handleCreateProposal} className="space-y-4">
                <div>
                  <label className="text-[11px] font-semibold uppercase tracking-wider text-[#727a88] block mb-1.5">
                    Question / Title
                  </label>
                  <input
                    type="text"
                    value={title}
                    onChange={(e) => setTitle(e.target.value)}
                    placeholder="e.g. Approve communal treasury grant for developer docs"
                    className="w-full px-4 py-3 bg-[#f2f4f7] rounded-xl outline-none text-sm font-semibold text-[#15171c] border border-transparent focus:border-[#15171c] focus:bg-white transition-all placeholder:text-[#a3a9b4]"
                  />
                </div>

                <div>
                  <label className="text-[11px] font-semibold uppercase tracking-wider text-[#727a88] block mb-1.5">
                    Description & Specifications
                  </label>
                  <textarea
                    rows={4}
                    value={description}
                    onChange={(e) => setDescription(e.target.value)}
                    placeholder="Provide full context, rationale, and consequences of passing this proposal..."
                    className="w-full px-4 py-3 bg-[#f2f4f7] rounded-xl outline-none text-sm text-[#15171c] resize-none border border-transparent focus:border-[#15171c] focus:bg-white transition-all placeholder:text-[#a3a9b4]"
                  />
                </div>

                <div className="flex gap-2 pt-2">
                  <button
                    type="button"
                    onClick={() => setShowCreateModal(false)}
                    className="flex-1 py-3 bg-[#f2f4f7] hover:bg-[#e5e9ee] text-[#15171c] font-semibold rounded-xl text-sm transition-colors"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={submitting}
                    className="flex-1 py-3 bg-[#15171c] hover:bg-black text-white font-semibold rounded-xl text-sm transition-all active:scale-95 disabled:opacity-50 shadow-sm"
                  >
                    {submitting ? 'Submitting...' : 'Submit Proposal'}
                  </button>
                </div>
              </form>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}
