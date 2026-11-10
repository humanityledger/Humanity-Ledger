'use client';
/**
 * Explicit risk acknowledgement shown before any agreement on Aztec Alpha (G2, G4).
 * Both boxes start unchecked on every mount; the policy refuses without them.
 */
import React from 'react';
import type { RiskAcknowledgement } from '@/lib/aztec/chat-agreements';

export const NO_ACK: RiskAcknowledgement = { unaudited: false, publicFeePayer: false };

export function AlphaRiskAck({ value, onChange, disabled, kind = 'agreement' }: { value: RiskAcknowledgement; onChange: (v: RiskAcknowledgement) => void; disabled?: boolean; kind?: 'agreement' | 'payment' }) {
  const row = 'flex items-start gap-2 text-[12.5px] text-[#4a505c] leading-snug';
  return (
    <fieldset className="rounded-2xl border border-[#f5d3c4] bg-[#fdf0eb] p-3 space-y-2" disabled={disabled}>
      <legend className="sr-only">Risks on Aztec Alpha</legend>
      <label className={row}>
        <input type="checkbox" className="mt-0.5" checked={value.unaudited} onChange={(e) => onChange({ ...value, unaudited: e.target.checked })} />
        <span>{kind === 'payment' ? 'This app has no external security audit.' : 'These contracts have no external security audit.'} Real funds can be lost. Use only an amount you can afford to lose.</span>
      </label>
      <label className={row}>
        <input type="checkbox" className="mt-0.5" checked={value.publicFeePayer} onChange={(e) => onChange({ ...value, publicFeePayer: e.target.checked })} />
        <span>My account pays the network fee publicly, so my transactions can be linked to each other. Amounts and parties stay private.</span>
      </label>
    </fieldset>
  );
}

export const acked = (v: RiskAcknowledgement) => v.unaudited && v.publicFeePayer;
