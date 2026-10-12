'use client';

import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Vote, Plus, CheckCircle2, XCircle, Clock, ChevronRight, X } from 'lucide-react';
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
        toast.success('Proposal created successfully');
        setTitle('');
        setDescription('');
        setShowCreateModal(false);
        fetchProposals();
      } else {
        const err = await res.json();
        toast.error(err.error || 'Failed to create proposal');
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
    <div className="max-w-3xl mx-auto p-4 md:p-6 space-y-6 pb-28">
      {/* Governance Header */}
      <div className="bg-white rounded-3xl p-6 shadow-sm border border-black/5 flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2 text-[#25D366] text-xs font-bold uppercase tracking-wider mb-1">
            <Vote size={14} /> Community Governance
          </div>
          <h2 className="text-xl md:text-2xl font-black text-[#1C1C1E]">
            {communityName} Proposals
          </h2>
          <p className="text-sm text-black/50 mt-1">
            Decentralized decision making. Every member wallet holds 1 vote.
          </p>
        </div>

        <button
          onClick={() => setShowCreateModal(true)}
          className="px-5 py-3 bg-[#1C1C1E] text-white text-sm font-bold rounded-2xl hover:bg-black transition-transform active:scale-95 flex items-center gap-2 shadow-sm shrink-0"
        >
          <Plus size={16} /> New Proposal
        </button>
      </div>

      {/* Proposals List */}
      {loading ? (
        <div className="flex justify-center py-12">
          <div className="w-8 h-8 border-3 border-[#25D366] border-t-transparent rounded-full animate-spin" />
        </div>
      ) : proposals.length === 0 ? (
        <div className="bg-white rounded-3xl p-12 text-center border border-black/5 shadow-sm space-y-3">
          <Vote size={40} className="mx-auto text-black/20" />
          <h3 className="text-lg font-bold text-[#1C1C1E]">No active proposals</h3>
          <p className="text-sm text-black/40 max-w-sm mx-auto">
            Proposals allow community members to submit and vote on collective decisions.
          </p>
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
                className="bg-white rounded-3xl p-6 border border-black/5 shadow-sm space-y-4"
              >
                <div className="flex items-start justify-between gap-4">
                  <div>
                    <span className="text-[11px] font-bold px-2.5 py-1 bg-[#25D366]/10 text-[#25D366] rounded-full inline-block mb-2">
                      {proposal.status}
                    </span>
                    <h3 className="text-lg font-bold text-[#1C1C1E] leading-snug">
                      {proposal.question}
                    </h3>
                  </div>
                  <div className="text-right text-xs text-black/40 shrink-0 flex items-center gap-1">
                    <Clock size={12} />
                    <span>{new Date(proposal.votingEndsAt).toLocaleDateString()}</span>
                  </div>
                </div>

                <p className="text-sm text-black/60 leading-relaxed">
                  {proposal.description}
                </p>

                {/* Voting Bar */}
                <div className="space-y-1.5 pt-2">
                  <div className="flex justify-between text-xs font-bold">
                    <span className="text-[#25D366] flex items-center gap-1">
                      <CheckCircle2 size={12} /> For ({forPct}%)
                    </span>
                    <span className="text-red-500 flex items-center gap-1">
                      <XCircle size={12} /> Against ({againstPct}%)
                    </span>
                  </div>
                  <div className="h-2.5 w-full bg-[#F2F2F7] rounded-full overflow-hidden flex">
                    <div style={{ width: `${forPct}%` }} className="bg-[#25D366] transition-all" />
                    <div style={{ width: `${againstPct}%` }} className="bg-red-500 transition-all" />
                  </div>
                  <div className="text-[11px] text-black/40 text-right">
                    Total votes: {totalVotes}
                  </div>
                </div>

                {/* Vote Actions */}
                <div className="pt-2 flex items-center justify-between border-t border-black/5">
                  <span className="text-xs text-black/40">
                    By {proposal.creatorAddress?.slice(0, 6)}...{proposal.creatorAddress?.slice(-4)}
                  </span>

                  {hasVoted ? (
                    <span className="text-xs font-bold text-[#25D366] bg-[#25D366]/10 px-3 py-1.5 rounded-xl">
                      Vote Submitted
                    </span>
                  ) : (
                    <div className="flex items-center gap-2">
                      <button
                        onClick={() => handleVote(proposal.id, 'FOR')}
                        disabled={votingId === proposal.id}
                        className="px-4 py-2 bg-[#25D366] text-white text-xs font-bold rounded-xl hover:bg-[#20be5b] transition-transform active:scale-95 disabled:opacity-50"
                      >
                        Vote For
                      </button>
                      <button
                        onClick={() => handleVote(proposal.id, 'AGAINST')}
                        disabled={votingId === proposal.id}
                        className="px-4 py-2 bg-red-500 text-white text-xs font-bold rounded-xl hover:bg-red-600 transition-transform active:scale-95 disabled:opacity-50"
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

      {/* Create Proposal Modal */}
      <AnimatePresence>
        {showCreateModal && (
          <div className="fixed inset-0 z-50 bg-black/40 backdrop-blur-sm flex items-center justify-center p-4">
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="bg-white rounded-3xl max-w-lg w-full p-6 shadow-2xl border border-black/10 space-y-4"
            >
              <div className="flex items-center justify-between">
                <h3 className="text-lg font-bold text-[#1C1C1E]">Create Governance Proposal</h3>
                <button
                  onClick={() => setShowCreateModal(false)}
                  className="p-1 rounded-full hover:bg-black/5 text-black/40"
                >
                  <X size={20} />
                </button>
              </div>

              <form onSubmit={handleCreateProposal} className="space-y-4">
                <div>
                  <label className="text-xs font-bold uppercase tracking-wider text-black/50 block mb-1">
                    Question / Title
                  </label>
                  <input
                    type="text"
                    value={title}
                    onChange={(e) => setTitle(e.target.value)}
                    placeholder="e.g. Approve community treasury allocation"
                    className="w-full px-4 py-3 bg-[#F2F2F7] rounded-xl outline-none text-sm font-medium focus:ring-2 focus:ring-[#25D366]"
                  />
                </div>

                <div>
                  <label className="text-xs font-bold uppercase tracking-wider text-black/50 block mb-1">
                    Description & Specifications
                  </label>
                  <textarea
                    rows={4}
                    value={description}
                    onChange={(e) => setDescription(e.target.value)}
                    placeholder="Provide full context, rationale, and consequences of passing this proposal..."
                    className="w-full px-4 py-3 bg-[#F2F2F7] rounded-xl outline-none text-sm font-medium resize-none focus:ring-2 focus:ring-[#25D366]"
                  />
                </div>

                <div className="flex gap-2 pt-2">
                  <button
                    type="button"
                    onClick={() => setShowCreateModal(false)}
                    className="flex-1 py-3 bg-[#F2F2F7] text-black/70 font-bold rounded-xl text-sm"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={submitting}
                    className="flex-1 py-3 bg-[#25D366] text-white font-bold rounded-xl text-sm hover:bg-[#20be5b] transition-transform active:scale-95 disabled:opacity-50"
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
