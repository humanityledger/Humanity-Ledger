'use client';

import { isZkEnabled } from '@/lib/features/zk';

import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Lock, Info, ChevronDown, ChevronUp, ExternalLink, ArrowRight
} from 'lucide-react';

const AZTEC_EXPLORER = 'https://aztecscan.xyz';

interface ZkPrivacyScoreProps {
  address: string;
  txHash?: string;
  className?: string;
  onExploreNotes?: () => void;
  onShieldMore?: () => void;
}

function truncateAddress(addr: string): string {
  if (!addr || addr.length < 10) return addr;
  return `${addr.slice(0, 6)}…${addr.slice(-4)}`;
}

function ZkPrivacyScoreInner({
  address,
  txHash,
  className = '',
  onExploreNotes,
  onShieldMore
}: ZkPrivacyScoreProps) {
  const [expanded, setExpanded] = useState(false);

  const txUrl = txHash
    ? `${AZTEC_EXPLORER}/tx-effect/${txHash.replace('0x', '')}`
    : null;

  return (
    <div
      className={`bg-white rounded-3xl border border-black/[0.06] shadow-sm overflow-hidden text-[#111b21] ${className}`}
      style={{ fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif' }}
    >
      {/* Header Bar */}
      <div className="p-4 bg-gradient-to-r from-gray-50/80 to-white flex items-center justify-between border-b border-black/[0.04]">
        <div className="flex items-center gap-3">
          <div
            className="w-10 h-10 rounded-2xl flex items-center justify-center shadow-sm"
            style={{ background: '#1C1C1E10' }}
          >
            <Lock size={20} style={{ color: '#1C1C1E' }} strokeWidth={2.2} />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <span className="text-[14px] font-bold tracking-tight">Aztec Privacy Rating</span>
              <span
                className="text-[10px] font-bold px-2 py-0.5 rounded-full uppercase tracking-wider"
                style={{ background: '#1C1C1E0F', color: '#1C1C1E' }}
              >
                On-chain
              </span>
            </div>
            <p className="text-[11px] text-gray-500 font-medium">
              {truncateAddress(address)}
            </p>
          </div>
        </div>

        {/* Score placeholder + expand toggle */}
        <div className="flex items-center gap-3">
          <div className="relative w-11 h-11 flex items-center justify-center">
            <svg className="w-full h-full -rotate-90" viewBox="0 0 36 36">
              <path
                className="text-gray-100"
                strokeWidth="3.5"
                stroke="currentColor"
                fill="none"
                d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831"
              />
            </svg>
            <span className="absolute text-[9px] font-black" style={{ color: '#1C1C1E' }}>
              N/A
            </span>
          </div>

          <button
            onClick={() => setExpanded(!expanded)}
            className="w-8 h-8 rounded-full bg-black/5 hover:bg-black/10 flex items-center justify-center transition-colors text-gray-600"
          >
            {expanded ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
          </button>
        </div>
      </div>

      {/* Summary row */}
      <div className="px-4 py-3 border-b border-black/[0.04] flex items-center gap-2 text-[12px] text-gray-500">
        <Info size={13} className="shrink-0 text-gray-400" />
        <span>
          Privacy Score: <strong className="text-gray-700">N/A</strong>
          {txHash ? (
            <>
              {' — tx '}
              <a
                href={txUrl!}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-0.5 text-[#1C1C1E] font-semibold underline underline-offset-2"
              >
                {txHash.slice(0, 10)}…{txHash.slice(-6)}
                <ExternalLink size={11} />
              </a>
            </>
          ) : (
            ' — no transaction selected'
          )}
        </span>
      </div>

      {/* Collapsible detail */}
      <AnimatePresence>
        {expanded && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.25 }}
            className="overflow-hidden"
          >
            <div className="p-4 space-y-4">
              {/* Pending notice */}
              <div className="bg-[#f0f2f5] rounded-2xl p-4 space-y-2">
                <p className="text-[12px] font-semibold text-gray-700 leading-relaxed">
                  Full anonymity metrics will be computed from the on-chain anonymity set when
                  the Aztec node indexer is connected.
                </p>
                <p className="text-[11px] text-gray-500 leading-relaxed">
                  Once the indexer is live, scores will reflect your real anonymity-set size,
                  note maturity, and nullifier age — no simulated values.
                </p>
              </div>

              {/* Address */}
              <div className="bg-[#f0f2f5] rounded-2xl p-3 flex items-center justify-between text-[12px]">
                <span className="text-gray-500 font-medium">Your Aztec Address</span>
                <span className="font-mono font-bold text-gray-900">{truncateAddress(address)}</span>
              </div>

              {/* Footer actions */}
              <div className="flex gap-2 pt-1">
                {onShieldMore && (
                  <button
                    onClick={onShieldMore}
                    className="flex-1 py-2.5 px-3 bg-[#1C1C1E] hover:bg-black text-white text-[12px] font-bold rounded-xl flex items-center justify-center gap-1.5 transition-colors"
                  >
                    Shield More Notes <ArrowRight size={14} />
                  </button>
                )}
                <a
                  href={AZTEC_EXPLORER}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="py-2.5 px-3 bg-gray-100 hover:bg-gray-200 text-gray-700 text-[12px] font-semibold rounded-xl flex items-center justify-center gap-1 transition-colors"
                >
                  AztecScan <ExternalLink size={12} />
                </a>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

// The flag check lives here, not inside ZkPrivacyScoreInner: an early return before
// hooks breaks the rules of hooks (react-hooks/rules-of-hooks).
export function ZkPrivacyScore(props: Parameters<typeof ZkPrivacyScoreInner>[0]) {
  if (!isZkEnabled) return null;
  return <ZkPrivacyScoreInner {...props} />;
}
