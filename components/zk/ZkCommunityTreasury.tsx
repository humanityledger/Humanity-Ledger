'use client';

import { isZkEnabled } from '@/lib/features/zk';

import React from 'react';
import { Shield, Lock } from 'lucide-react';

// ─── Props ───────────────────────────────────────────────────────────────────

interface ZkCommunityTreasuryProps {
  communityId: string;
  communityName: string;
  isAdmin?: boolean;
  currentUserAddress?: string;
}

// ─── Main Component ──────────────────────────────────────────────────────────

function ZkCommunityTreasuryInner({
  communityId,
  communityName,
}: ZkCommunityTreasuryProps) {
  return (
    <div className="space-y-5">
      {/* ── Coming Soon Card ── */}
      <div className="bg-[#15171c] rounded-3xl p-8 text-white border border-black/10 shadow-sm flex flex-col items-center justify-center gap-5 text-center min-h-[260px]">
        <div className="w-14 h-14 rounded-2xl bg-white/10 flex items-center justify-center">
          <Lock size={26} className="text-white" strokeWidth={2} />
        </div>
        <div className="space-y-2">
          <h2 className="text-xl font-bold text-white tracking-tight">
            Community Treasury — coming soon
          </h2>
          <p className="text-[13px] text-white/60 max-w-sm leading-relaxed">
            Multi-party treasury on Aztec will be available after the community
            escrow contract is deployed to the network.
          </p>
        </div>
        <div className="bg-white/5 border border-white/10 rounded-2xl px-5 py-3 text-left space-y-1 w-full max-w-xs">
          <div className="text-[11px] text-white/40 font-semibold uppercase tracking-wider">Community</div>
          <div className="text-[15px] font-bold text-white">{communityName}</div>
          <div className="text-[11px] font-mono text-white/40 break-all">{communityId}</div>
        </div>
      </div>

      {/* ── Footer Protocol Notice ── */}
      <div className="flex items-center justify-center gap-2 py-3 text-[12px] text-[#727a88]">
        <Shield size={13} className="text-[#15171c]" />
        <span>Community treasury powered by Aztec Network zero-knowledge proofs.</span>
      </div>
    </div>
  );
}

// The flag check lives here, not inside ZkCommunityTreasuryInner: an early return before
// hooks breaks the rules of hooks (react-hooks/rules-of-hooks).
export function ZkCommunityTreasury(props: Parameters<typeof ZkCommunityTreasuryInner>[0]) {
  if (!isZkEnabled) return null;
  return <ZkCommunityTreasuryInner {...props} />;
}
