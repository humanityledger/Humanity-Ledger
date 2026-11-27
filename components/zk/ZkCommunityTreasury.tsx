'use client';

import { isZkEnabled, isZkMainnet } from '@/lib/features/zk';

import React, { useEffect, useState } from 'react';
import { FileText, Landmark, Link2 } from 'lucide-react';
import { useT } from '@/lib/i18n/client';
import { AztecFeeBadge } from '@/components/zk/AztecFeeBadge';

// ─── Props ───────────────────────────────────────────────────────────────────

interface ZkCommunityTreasuryProps {
  communityId: string;
  communityName: string;
  isAdmin?: boolean;
  currentUserAddress?: string;
  /** Opens Governance with a treasury proposal drafted (Manage passes it through Analytics). */
  onDraftProposal?: (p: { title: string; description: string }) => void;
}

const AZTEC_ADDRESS = /^0x[0-9a-fA-F]{64}$/;
const linkKey = (communityId: string) => `hl_community_treasury_link_v1_${communityId}`;

// ─── Main Component ──────────────────────────────────────────────────────────

/**
 * The community treasury has no contract on any network yet, so this panel says so and shows no
 * balance and no placeholder figure. What it does offer:
 * - the fee rail and network this build uses (AztecFeeBadge);
 * - the cUSDC limitation that matters for a treasury (audit item A-02);
 * - linking, on this device only, the address of a treasury or multisig contract the community
 *   deployed itself, to inspect on a node; Ledger Chat reads no balance from it;
 * - drafting a treasury proposal in Governance, so spending is decided by a member vote first.
 */
function ZkCommunityTreasuryInner({ communityId, communityName, isAdmin, onDraftProposal }: ZkCommunityTreasuryProps) {
  const t = useT();
  const [linked, setLinked] = useState<string | null>(null);
  const [draft, setDraft] = useState('');
  const [editing, setEditing] = useState(false);
  useEffect(() => {
    try { setLinked(window.localStorage.getItem(linkKey(communityId))); } catch { setLinked(null); }
  }, [communityId]);
  const valid = AZTEC_ADDRESS.test(draft.trim());
  const save = () => {
    if (!valid) return;
    try { window.localStorage.setItem(linkKey(communityId), draft.trim().toLowerCase()); } catch { /* this device only */ }
    setLinked(draft.trim().toLowerCase()); setEditing(false); setDraft('');
  };
  const unlink = () => {
    try { window.localStorage.removeItem(linkKey(communityId)); } catch { /* this device only */ }
    setLinked(null);
  };

  return (
    <section className="bg-white rounded-2xl border border-[#E4E7EC]">
      <header className="flex flex-wrap items-center gap-3 px-5 py-4 border-b border-[#E4E7EC]">
        <Landmark size={18} strokeWidth={1.5} className="text-[#15171C] shrink-0" />
        <div className="min-w-0">
          <h2 className="text-[14px] font-semibold text-[#15171C]">{t("Treasury")}</h2>
          <p className="text-[13px] text-[#727A88] truncate">{communityName} · {isZkMainnet ? t('Aztec Alpha') : t('Aztec test network')}</p>
        </div>
        <span className="ml-auto inline-flex items-center gap-1.5 text-[12px] font-medium text-[#475061]">
          {t("{0}Not deployed", { 0: <span className="w-1.5 h-1.5 rounded-full bg-[#A3A9B4]" aria-hidden /> })}</span>
      </header>
      <div className="px-5 py-5 space-y-4">
        <p className="text-[13px] leading-relaxed text-[#475061] max-w-prose">
          {t("No community treasury contract is deployed on Aztec Alpha or on the test network. This community holds no funds through Ledger Chat. Balances will appear here only after a treasury contract is deployed and recorded with its transaction hash.")}
        </p>
        <AztecFeeBadge explain />
        <p className="text-[12.5px] leading-snug text-[#475061] border-l-2 border-[#d0d5dd] pl-3 max-w-prose">
          {t('cUSDC uses the AIP-20 token, which moves private funds with transfer_private_to_private. Escrows and payment streams need transfer_in_private, so they cannot hold cUSDC until a contract update that waits for the external review.')}
        </p>

        <div className="rounded-xl border border-[#E4E7EC] p-4 space-y-2">
          <p className="text-[13px] font-semibold text-[#15171C] flex items-center gap-1.5"><Link2 size={14} aria-hidden="true" />{t('Treasury contract')}</p>
          {linked && !editing ? (
            <>
              <p className="font-mono text-[12px] break-all text-[#15171C]">{linked}</p>
              <p className="text-[12.5px] text-[#475061]">{t('Contract linked on this device. Ledger Chat does not read its balance: inspect it on an Aztec node or explorer.')}</p>
              {isAdmin && <button type="button" onClick={unlink} className="min-h-[44px] px-3 rounded-xl text-[13px] font-medium text-[#c0362c] hover:bg-[#fdeeec]">{t('Unlink')}</button>}
            </>
          ) : isAdmin ? (
            <>
              <p className="text-[12.5px] text-[#475061]">{t('If the community deployed its own treasury or multisig contract, link its Aztec address to keep it at hand. Only this device remembers it.')}</p>
              <div className="flex flex-wrap gap-2">
                <input value={draft} onChange={(e) => { setDraft(e.target.value); setEditing(true); }} placeholder={t('Aztec contract address')} aria-label={t('Aztec contract address')} spellCheck={false}
                  className="flex-1 min-w-[220px] min-h-[44px] rounded-xl border border-[#d0d5dd] px-3 font-mono text-[12.5px] outline-none focus:border-[#15171c]" />
                <button type="button" disabled={!valid} onClick={save} className="min-h-[44px] px-4 rounded-xl bg-[#15171c] text-white text-[13px] font-medium disabled:opacity-40">{t('Link')}</button>
              </div>
              {draft && !valid && <p className="text-[12px] text-[#c0362c]" role="alert">{t('An Aztec address is 0x followed by 64 hexadecimal characters.')}</p>}
            </>
          ) : (
            <p className="text-[12.5px] text-[#475061]">{t('No treasury contract linked.')}</p>
          )}
        </div>

        {onDraftProposal && (
          <button
            type="button"
            onClick={() => onDraftProposal({
              title: t('Treasury: allocate funds to '),
              description: t('Amount and asset:\n\nRecipient (Aztec address):\n\nPurpose:\n\nThe treasury contract that would pay it:\n\nHow it will be reported back to the community:'),
            })}
            className="inline-flex items-center gap-2 min-h-[44px] px-4 rounded-xl border border-[#15171c] text-[13.5px] font-medium text-[#15171c] hover:bg-[#f2f4f7]"
          >
            <FileText size={15} aria-hidden="true" />{t('Draft a treasury proposal in Governance')}
          </button>
        )}
        <p className="text-[12px] text-[#727a88]">{t('Private swaps (Nemi) are in your wallet: open the private wallet from your profile.')}</p>

        <dl className="grid grid-cols-[auto_1fr] gap-x-4 gap-y-1 text-[13px]">
          <dt className="text-[#727A88]">{t("Community ID")}</dt>
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
