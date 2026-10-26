'use client';

import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Shield, Lock, CheckCircle, Clock, AlertTriangle,
  X, ChevronDown, ChevronUp, ExternalLink,
} from 'lucide-react';
import {
  ZkEscrowState, ZkMilestone,
  releaseMilestone, disputeEscrow, cancelEscrow,
  getAztecExplorerTxUrl, relativeTime,
  formatAmount,
} from '@/lib/zk/zkMoney';

// ─── Props ─────────────────────────────────────────────────────────────────────

interface ZkEscrowCardProps {
  escrow: ZkEscrowState;
  currentUserTag: string;   // e.g. "zk:alice"
  onUpdate?: (updated: ZkEscrowState) => void;
  className?: string;
}

// ─── Status Badge ──────────────────────────────────────────────────────────────

function EscrowStatusBadge({ status }: { status: ZkEscrowState['status'] }) {
  const map: Record<ZkEscrowState['status'], { label: string; color: string }> = {
    locked:             { label: 'Locked',             color: '#15171c' },
    released:           { label: 'Released',           color: '#15171c' },
    partially_released: { label: 'Partially Released', color: '#007AFF' },
    completed:          { label: 'Completed',          color: '#15171c' },
    disputed:           { label: 'Disputed',           color: '#FF9500' },
    cancelled:          { label: 'Cancelled',          color: '#FF3B30' },
  };
  const { label, color } = map[status];
  return (
    <span
      className="text-[12px] font-semibold px-2.5 py-0.5 rounded-full"
      style={{ color, background: `${color}20` }}
    >
      {label}
    </span>
  );
}

// ─── Milestone Row ─────────────────────────────────────────────────────────────

function MilestoneRow({
  milestone,
  isRecipient,
  onApprove,
}: {
  key?: React.Key;
  milestone: ZkMilestone;
  isRecipient: boolean;
  onApprove: () => void;
}) {
  const statusConfig = {
    pending:  { icon: Clock,         color: '#FF9500', label: 'Pending'  },
    approved: { icon: CheckCircle,   color: '#15171c', label: 'Approved' },
    released: { icon: CheckCircle,   color: '#15171c', label: 'Released' },
    rejected: { icon: X,             color: '#FF3B30', label: 'Rejected' },
  };
  const { icon: Icon, color, label } = statusConfig[milestone.status];

  return (
    <div className="flex items-center gap-3 py-2.5 px-3 bg-[#f2f4f7] rounded-xl">
      <Icon size={14} style={{ color }} className="flex-shrink-0" strokeWidth={2.5} />
      <div className="flex-1 min-w-0">
        <div className="text-[12px] font-semibold text-gray-800 truncate">{milestone.description}</div>
        <div className="text-[12px] text-gray-400">{milestone.amount} zk{/* token from parent */}</div>
      </div>
      <div className="flex items-center gap-2 flex-shrink-0">
        <span className="text-[12px] font-semibold" style={{ color }}>{label}</span>
        {isRecipient && milestone.status === 'pending' && (
          <button
            onClick={onApprove}
            className="py-1 px-3 rounded-lg text-[12.5px] font-semibold text-white"
            style={{ background: '#15171c' }}
          >
            Release
          </button>
        )}
      </div>
    </div>
  );
}

// ─── Main Component ────────────────────────────────────────────────────────────

export function ZkEscrowCard({ escrow: initialEscrow, currentUserTag, onUpdate, className }: ZkEscrowCardProps) {
  const [escrow,          setEscrow]          = useState(initialEscrow);
  const [showMilestones,  setShowMilestones]  = useState(false);
  const [confirming,      setConfirming]      = useState<'dispute' | 'cancel' | null>(null);

  const isSender    = escrow.senderTag === currentUserTag;
  const isRecipient = escrow.recipientTag === currentUserTag;

  const msLeft    = escrow.expiresAt - Date.now();
  const daysLeft  = Math.max(0, Math.floor(msLeft / 86_400_000));
  const progress  = escrow.milestones.length === 0 ? 0 :
    Math.round((escrow.milestones.filter(m => m.status === 'approved').length / escrow.milestones.length) * 100);

  const handleReleaseMilestone = (milestoneId: string) => {
    const updated = releaseMilestone(escrow.id, milestoneId);
    if (updated) { setEscrow(updated); onUpdate?.(updated); }
  };

  const handleDispute = () => {
    const updated = disputeEscrow(escrow.id);
    if (updated) { setEscrow(updated); onUpdate?.(updated); setConfirming(null); }
  };

  const handleCancel = () => {
    const updated = cancelEscrow(escrow.id);
    if (updated) { setEscrow(updated); onUpdate?.(updated); setConfirming(null); }
  };

  return (
    <div
      className={`bg-white rounded-2xl border border-black/[0.06] overflow-hidden shadow-sm ${className ?? ''}`}
      style={{ fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif' }}
    >
      {/* Header */}
      <div className="flex items-center gap-3 px-4 py-3 border-b border-black/[0.04]">
        <div
          className="w-9 h-9 rounded-full flex items-center justify-center"
          style={{ background: '#15171c' }}
        >
          <Lock size={15} className="text-white" strokeWidth={2} />
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <span className="font-semibold text-gray-900 text-[14px]">Shielded Escrow</span>
            <EscrowStatusBadge status={escrow.status} />
          </div>
          <div className="text-[12px] text-gray-400 truncate">
            {escrow.senderTag} → {escrow.recipientTag}
          </div>
        </div>
        <div className="text-right flex-shrink-0">
          <div className="text-[15px] font-semibold text-gray-900">{escrow.amount}</div>
          <div className="text-[12px] text-gray-400">zk{escrow.token}</div>
        </div>
      </div>

      {/* Body */}
      <div className="px-4 py-3 space-y-3">
        {/* Progress bar */}
        {escrow.milestones.length > 0 && (
          <div>
            <div className="flex justify-between text-[12px] text-gray-400 mb-1.5">
              <span>Milestones complete</span>
              <span className="font-semibold text-gray-700">{progress}%</span>
            </div>
            <div className="h-2 bg-[#f7f8fa] rounded-full overflow-hidden">
              <motion.div
                className="h-full rounded-full"
                style={{ background: '#15171c' }}
                initial={{ width: 0 }}
                animate={{ width: `${progress}%` }}
                transition={{ duration: 0.5, ease: 'easeOut' }}
              />
            </div>
          </div>
        )}

        {/* Conditions */}
        <div className="bg-[#f2f4f7] rounded-xl px-3 py-2.5">
          <div className="text-[12px] text-gray-400 font-semibold mb-1">Conditions</div>
          <p className="text-[12px] text-gray-700 leading-relaxed">{escrow.conditions}</p>
        </div>

        {/* Meta row */}
        <div className="flex items-center justify-between text-[12px] text-gray-400">
          <span className="flex items-center gap-1">
            <Clock size={9} />
            {daysLeft > 0 ? `Expires in ${daysLeft}d` : 'Expired'}
          </span>
          <span>{relativeTime(escrow.createdAt)}</span>
          {escrow.txHash && (
            <a
              href={getAztecExplorerTxUrl(escrow.txHash)}
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center gap-0.5 text-[#15171c]"
              onClick={e => e.stopPropagation()}
            >
              <ExternalLink size={9} /> AztecScan
            </a>
          )}
        </div>

        {/* Milestones toggle */}
        {escrow.milestones.length > 0 && (
          <>
            <button
              onClick={() => setShowMilestones(v => !v)}
              className="w-full flex items-center justify-between py-2 text-[12px] font-semibold text-gray-700"
            >
              <span>Milestones ({escrow.milestones.length})</span>
              {showMilestones ? <ChevronUp size={13} className="text-gray-400" /> : <ChevronDown size={13} className="text-gray-400" />}
            </button>
            <AnimatePresence>
              {showMilestones && (
                <motion.div
                  initial={{ height: 0, opacity: 0 }}
                  animate={{ height: 'auto', opacity: 1 }}
                  exit={{ height: 0, opacity: 0 }}
                  transition={{ duration: 0.2 }}
                  className="overflow-hidden space-y-1.5"
                >
                  {escrow.milestones.map(ms => (
                    <MilestoneRow
                      key={ms.id}
                      milestone={ms}
                      isRecipient={isRecipient}
                      onApprove={() => handleReleaseMilestone(ms.id)}
                    />
                  ))}
                </motion.div>
              )}
            </AnimatePresence>
          </>
        )}

        {/* Actions */}
        {escrow.status === 'locked' && (isSender || isRecipient) && (
          <div className="flex gap-2 pt-1">
            {confirming === 'dispute' ? (
              <>
                <button onClick={() => setConfirming(null)}
                  className="flex-1 py-2 rounded-xl text-[12px] font-semibold bg-[#f2f4f7] text-gray-600">
                  Cancel
                </button>
                <button onClick={handleDispute}
                  className="flex-1 py-2 rounded-xl text-[12px] font-semibold text-white bg-orange-500">
                  Confirm Dispute
                </button>
              </>
            ) : confirming === 'cancel' ? (
              <>
                <button onClick={() => setConfirming(null)}
                  className="flex-1 py-2 rounded-xl text-[12px] font-semibold bg-[#f2f4f7] text-gray-600">
                  Keep Escrow
                </button>
                <button onClick={handleCancel}
                  className="flex-1 py-2 rounded-xl text-[12px] font-semibold text-white bg-[#e5484d]">
                  Confirm Cancel
                </button>
              </>
            ) : (
              <>
                {isSender && (
                  <button onClick={() => setConfirming('cancel')}
                    className="flex-1 py-2 rounded-xl text-[12.5px] font-semibold bg-[#f2f4f7] text-[#d93036]">
                    Cancel
                  </button>
                )}
                <button onClick={() => setConfirming('dispute')}
                  className="flex-1 py-2 rounded-xl text-[12.5px] font-semibold bg-orange-50 text-orange-600">
                  Dispute
                </button>
                {isRecipient && escrow.milestones.length === 0 && (
                  <button onClick={() => handleReleaseMilestone('full')}
                    className="flex-1 py-2 rounded-xl text-[12.5px] font-semibold text-white"
                    style={{ background: '#15171c' }}>
                    Release All
                  </button>
                )}
              </>
            )}
          </div>
        )}

        {/* Settled confirmation */}
        {escrow.status === 'released' && (
          <div className="flex items-center gap-2 bg-[#15171c]/10 rounded-xl px-3 py-2.5">
            <CheckCircle size={14} className="text-[#15171c]" strokeWidth={2.5} />
            <span className="text-[12px] font-semibold text-[#15171c]">
              Escrow released — funds transferred via Aztec note
            </span>
          </div>
        )}
      </div>
    </div>
  );
}
