'use client';

import { isZkEnabled } from '@/lib/features/zk';

import React from 'react';
import { Landmark } from 'lucide-react';

// ─── Props ───────────────────────────────────────────────────────────────────

interface ZkCommunityTreasuryProps {
  communityId: string;
  communityName: string;
  isAdmin?: boolean;
  currentUserAddress?: string;
}

// ─── Main Component ──────────────────────────────────────────────────────────

/**
 * The community treasury has no contract on any network yet, so this panel states that and
 * nothing else: no balance, no placeholder figures.
 */
function ZkCommunityTreasuryInner({ communityId, communityName }: ZkCommunityTreasuryProps) {
  return (
    <section className="bg-white rounded-2xl border border-[#E4E7EC]">
      <header className="flex items-center gap-3 px-5 py-4 border-b border-[#E4E7EC]">
        <Landmark size={18} strokeWidth={1.5} className="text-[#15171C] shrink-0" />
        <div className="min-w-0">
          <h2 className="text-[14px] font-semibold text-[#15171C]">Treasury</h2>
          <p className="text-[13px] text-[#727A88] truncate">{communityName}</p>
        </div>
        <span className="ml-auto inline-flex items-center gap-1.5 text-[12px] font-medium text-[#475061]">
          <span className="w-1.5 h-1.5 rounded-full bg-[#A3A9B4]" aria-hidden />
          Not deployed
        </span>
      </header>
      <div className="px-5 py-5 space-y-3">
        <p className="text-[13px] leading-relaxed text-[#475061] max-w-prose">
          No community treasury contract is deployed on Aztec Alpha or on the test network. This
          community holds no funds through Ledger Chat. Balances will appear here only after a
          treasury contract is deployed and recorded with its transaction hash.
        </p>
        <dl className="grid grid-cols-[auto_1fr] gap-x-4 gap-y-1 text-[13px]">
          <dt className="text-[#727A88]">Community ID</dt>
          <dd className="font-mono text-[12px] text-[#15171C] break-all">{communityId}</dd>
        </dl>
      </div>
    </section>
  );
}

// The flag check lives here, not inside ZkCommunityTreasuryInner: an early return before
// hooks breaks the rules of hooks (react-hooks/rules-of-hooks).
export function ZkCommunityTreasury(props: Parameters<typeof ZkCommunityTreasuryInner>[0]) {
  if (!isZkEnabled) return null;
  return <ZkCommunityTreasuryInner {...props} />;
}
