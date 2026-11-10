'use client';
import React, { useEffect, useState } from 'react';
import { currentDeviceHints, provingMemoryAtRisk, PROVING_MEMORY_WARNING } from '@/lib/aztec/wallet/device';

/** Non-blocking warning shown before a step that proves on this device (R-16). */
export function ProvingMemoryNote() {
  const [risk, setRisk] = useState(false);
  useEffect(() => setRisk(provingMemoryAtRisk(currentDeviceHints())), []);
  if (!risk) return null;
  return (
    <p role="note" className="text-[12.5px] leading-snug text-[#7a4a00] bg-[#fff6e5] border border-[#f3dfb5] rounded-xl px-3 py-2">
      {PROVING_MEMORY_WARNING}
    </p>
  );
}
