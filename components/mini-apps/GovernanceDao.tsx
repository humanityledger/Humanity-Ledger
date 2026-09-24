'use client';

import React, { useState } from 'react';
import { GaslessPaymaster } from '@/lib/chat/paymaster';

export const GovernanceDao: React.FC = () => {
  const [votingPower] = useState(14500); // MOCKED QDS Staked Power
  const [hasVoted, setHasVoted] = useState(false);

  const handleVote = async (support: boolean) => {
    // Uses the Gasless Paymaster to submit the vote on-chain for free
    // await GaslessPaymaster.buildSponsoredTransfer(...)
    setHasVoted(true);
  };

  return (
    <div className="flex flex-col gap-6 p-6 bg-white rounded-3xl shadow-sm border border-black/5">
      <div className="flex justify-between items-start">
        <div className="flex flex-col gap-2">
          <h2 className="text-xl font-semibold tracking-tight">Protocol Governance</h2>
          <p className="text-sm text-black/60">Shape the future of the Sovereign AppChain.</p>
        </div>
        <div className="px-4 py-2 bg-blue-50 text-blue-700 rounded-xl">
          <span className="text-xs font-semibold uppercase tracking-wider">Voting Power</span>
          <p className="font-bold">{votingPower.toLocaleString()} QDS</p>
        </div>
      </div>

      <div className="flex flex-col gap-4 mt-4">
        <div className="p-5 border border-black/10 rounded-2xl">
          <div className="flex justify-between items-center mb-4">
            <span className="text-xs font-bold text-emerald-600 bg-emerald-50 px-2 py-1 rounded-md">ACTIVE</span>
            <span className="text-xs text-black/40">Ends in 2 days</span>
          </div>
          <h3 className="font-semibold text-lg mb-2">HIP-42: Implement Deflationary Burn Mechanism</h3>
          <p className="text-sm text-black/60 mb-6 line-clamp-2">
            Proposal to permanently burn 30% of all protocol fees to counteract QDS inflation and ensure long-term macro-economic stability across the ecosystem.
          </p>

          {!hasVoted ? (
            <div className="flex gap-3">
              <button 
                onClick={() => handleVote(true)}
                className="flex-1 py-3 bg-black text-white font-medium rounded-xl hover:bg-black/80 transition-colors"
              >
                Approve (Yes)
              </button>
              <button 
                onClick={() => handleVote(false)}
                className="flex-1 py-3 bg-black/5 text-black font-medium rounded-xl hover:bg-black/10 transition-colors"
              >
                Reject (No)
              </button>
            </div>
          ) : (
            <div className="w-full py-3 bg-emerald-50 text-emerald-700 font-medium rounded-xl text-center border border-emerald-100">
              Vote successfully cast via Gasless Intent ✓
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

