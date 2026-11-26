'use client';
/** Shown at the top of a chat held by the G8 privacy shield. */
import React, { useEffect, useState } from 'react';
import { ShieldAlert } from 'lucide-react';
import { useT } from '@/lib/i18n/client';
import { acceptRequest, dismissRequest, isQuarantined, QUARANTINE_EVENT } from '@/lib/g8/quarantine';

export function RequestBanner({ owner, peer, onBlock }: { owner: string | null | undefined; peer: string | null | undefined; onBlock?: () => void }) {
  const t = useT();
  const [held, setHeld] = useState(false);
  useEffect(() => {
    const f = () => setHeld(!!owner && !!peer && isQuarantined(owner, peer));
    f();
    window.addEventListener(QUARANTINE_EVENT, f);
    return () => window.removeEventListener(QUARANTINE_EVENT, f);
  }, [owner, peer]);
  if (!held || !owner || !peer) return null;
  return (
    <div className="flex justify-center px-4 pt-2">
      <div role="status" className="max-w-[460px] w-full rounded-[14px] border border-[#f1d9b5] bg-[#fffaf2] px-4 py-3">
        <div className="flex items-start gap-2.5">
          <ShieldAlert size={16} className="text-[#a35a00] shrink-0 mt-[2px]" aria-hidden="true" />
          <div className="min-w-0">
            <p className="text-[13.5px] font-semibold text-[#15171c]">{t('Message request')}</p>
            <p className="text-[13px] text-[#4a4f59] leading-snug mt-0.5">{t('You have not talked to this person before. Their calls do not ring and their messages do not alert you until you accept.')}</p>
          </div>
        </div>
        <div className="flex gap-2 mt-3">
          <button type="button" onClick={() => acceptRequest(owner, peer)} className="flex-1 min-h-[40px] rounded-xl bg-[#15171c] text-white text-[13.5px] font-semibold">{t('Accept')}</button>
          <button type="button" onClick={() => dismissRequest(owner, peer)} className="flex-1 min-h-[40px] rounded-xl bg-white border border-[#e6e8ec] text-[#15171c] text-[13.5px] font-semibold">{t('Dismiss')}</button>
          {onBlock && <button type="button" onClick={onBlock} className="min-h-[40px] px-3 rounded-xl bg-white border border-[#f3c9c9] text-[#d93036] text-[13.5px] font-semibold">{t('Block')}</button>}
        </div>
      </div>
    </div>
  );
}
