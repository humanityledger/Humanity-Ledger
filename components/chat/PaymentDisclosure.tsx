'use client';
/**
 * What a private payment reveals and what its fee can be, before "Send privately"
 * (lib/payments/disclosure.ts). Plain list in a white card: no badges.
 */
import React from 'react';
import type { Disclosure } from '@/lib/payments/disclosure';
import { useT } from '@/lib/i18n/client';

export function PaymentDisclosure({ d }: { d: Disclosure }) {
  const t = useT();
  return (
    <section data-testid="payment-disclosure" aria-label={t("What this payment reveals")} className="rounded-xl lg-card p-3 space-y-2 text-[12.5px] leading-snug text-[#4a505c]">
      <div>
        <p className="font-semibold text-[#15171c]">{t("Stays between the two of you")}</p>
        <ul className="mt-1 space-y-0.5">
          {d.private.map((s) => (
            <li key={s}>· {s}</li>
          ))}
        </ul>
      </div>
      <div>
        <p className="font-semibold text-[#15171c]">{t("Anyone can see")}</p>
        <ul className="mt-1 space-y-0.5">
          {d.public.map((s) => (
            <li key={s}>· {s}</li>
          ))}
        </ul>
      </div>
      <p data-testid="payment-fee">{d.fee}</p>
      {d.feeProblem && (
        <p role="status" data-testid="fee-problem" className="rounded-lg bg-[#fdf3f2] border border-[#f3d4d0] px-2.5 py-1.5 text-[#7a2d24]">
          {d.feeProblem}
        </p>
      )}
    </section>
  );
}
