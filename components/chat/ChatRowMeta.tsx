/**
 * Discreet indicators for a row of the Chats list, drawn in-house (no icon library).
 *
 * - RowLock: shown only on direct-message rows. Direct messages are end-to-end encrypted with MLS
 *   through XMTP. Community and group rows get no lock, because their posts are stored on our
 *   server (communityMls is off).
 * - RowTicks: the state of the last message *you* sent in that chat: a clock while it is sending,
 *   one tick when sent, two when delivered, two in green when read (only with read receipts on).
 *   Nothing is shown when the last message is not yours or its state is unknown.
 */
import React from 'react';
import { sendStatusLabel } from '@/lib/chat/optimistic-send';

export function RowLock() {
  return (
    <svg width={11} height={11} viewBox="0 0 12 12" fill="none" role="img" aria-label="End-to-end encrypted" className="shrink-0 text-[#8a909c]">
      <title>End-to-end encrypted (MLS)</title>
      <rect x="2.25" y="5.25" width="7.5" height="5.5" rx="1.25" stroke="currentColor" strokeWidth="1.3" />
      <path d="M4 5.25V3.9a2 2 0 0 1 4 0v1.35" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" />
    </svg>
  );
}

export type RowTickState = 'sending' | 'scheduled' | 'sent' | 'delivered' | 'read';

/** Which glyph a status draws, or null for none. Exported for the tests. */
export function rowTickGlyph(status: string | undefined, readReceipts: boolean): 'clock' | 'one' | 'two' | 'read' | null {
  if (status === 'sending' || status === 'scheduled') return 'clock';
  if (status === 'sent') return 'one';
  if (status === 'delivered') return 'two';
  if (status === 'read') return readReceipts ? 'read' : 'two';
  return null;
}

export function RowTicks({ status, readReceipts }: { status?: string; readReceipts: boolean }) {
  const g = rowTickGlyph(status, readReceipts);
  if (!g) return null;
  const label = sendStatusLabel(status, { readReceipts });
  const color = g === 'read' ? 'text-[#10B981]' : 'text-[#8a909c]';
  return (
    <svg width={16} height={11} viewBox="0 0 16 11" fill="none" role="img" aria-label={label} className={`shrink-0 ${color}`}>
      <title>{label}</title>
      {g === 'clock' ? (
        <>
          <circle cx="8" cy="5.5" r="4.25" stroke="currentColor" strokeWidth="1.2" />
          <path d="M8 3.2v2.5l1.6 1" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" />
        </>
      ) : (
        <>
          <path d="M1.5 5.8l2.6 2.6L9.5 2.6" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round" />
          {g !== 'one' && <path d="M7.4 8.1l.3.3L13.6 2.6" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round" />}
        </>
      )}
    </svg>
  );
}
