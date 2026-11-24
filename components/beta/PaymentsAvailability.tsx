'use client';
/**
 * Settings > Payments: what works today, in the settings style. Public tips on Ethereum mainnet,
 * private payments on Aztec Alpha in cUSDC: for everyone once that is on, otherwise the closed cUSDC beta for invited people, whose line
 * comes from /api/beta/cusdc/status (lib/beta/gate.ts betaSummary) and links to /beta.
 */
import React, { useEffect, useState } from 'react';
import Link from 'next/link';
import { ChevronRight, Lock, Send, ShieldCheck } from 'lucide-react';
import { betaApplies } from '@/lib/beta/cusdc-beta-client';
import { CUSDC_PUBLIC } from '@/lib/aztec/wallet/config';
import { PRIVATE_ASSET } from '@/lib/payments/private-asset';
import { betaSummary, type GateStatus } from '@/lib/beta/gate';
import { useT } from '@/lib/i18n/client';

function Line({ icon, label, sub, value, href }: { icon: React.ReactNode; label: string; sub: string; value: string; href?: string }) {
  const inner = (
    <div className="flex items-start gap-3 py-3.5 border-b border-black/[0.04] last:border-0">
      <span className="mt-0.5 text-[#15171c]">{icon}</span>
      <span className="flex-1 min-w-0">
        <span className="block text-[15px] font-medium text-[#15171c]">{label}</span>
        <span className="block text-[12.5px] leading-snug text-[#727a88] mt-0.5">{sub}</span>
      </span>
      <span className="text-[13px] text-[#727a88] whitespace-nowrap">{value}</span>
      {href && <ChevronRight size={16} className="mt-0.5 text-[#c0c4cc]" aria-hidden />}
    </div>
  );
  return href ? <Link href={href} className="block hover:bg-[#F7F8FA] -mx-4 px-4">{inner}</Link> : inner;
}

export function PaymentsAvailability() {
  const t = useT();
  const applies = betaApplies();
  const [status, setStatus] = useState<GateStatus | null>(null);
  const [flags, setFlags] = useState<{ signedOut?: boolean; failed?: boolean }>({});
  useEffect(() => {
    if (!applies) return;
    let live = true;
    fetch('/api/beta/cusdc/status', { credentials: 'include', cache: 'no-store' })
      .then(async (r) => {
        if (!live) return;
        if (r.status === 401) setFlags({ signedOut: true });
        else if (!r.ok) setFlags({ failed: true });
        else setStatus(await r.json());
      })
      .catch(() => live && setFlags({ failed: true }));
    return () => {
      live = false;
    };
  }, [applies]);
  const beta = betaSummary(status, { applies, ...flags });

  return (
    <div className="mb-6" data-testid="payments-availability">
      <p className="text-[13px] font-medium text-[#727a88] px-1 mb-1.5">{t("What works today")}</p>
      <div className="bg-white rounded-2xl border border-[#e6e8ec] overflow-hidden px-4">
        <Line icon={<Send size={18} />} label={t("Public tips")} sub={t("ETH, USDC or USDT on Ethereum mainnet, from your Ethereum wallet. Public on the blockchain.")} value={t("Available")} />
        {CUSDC_PUBLIC ? (
          <Line icon={<Lock size={18} />} label={t("Private payments")} sub={t("On Aztec Alpha in {phrase}. The network fee is Fee Juice from your own account.", { phrase: PRIVATE_ASSET.phrase })} value={t("Alpha")} />
        ) : (
          <Line icon={<ShieldCheck size={18} />} label={t("Private cUSDC payments")} sub={t(beta.sub)} value={beta.value} href={applies ? '/beta' : undefined} />
        )}
      </div>
      <p className="text-[12.5px] text-[#727a88] px-1 mt-2 leading-relaxed">{t("Aztec Alpha has no external audit, and each private payment has a cap.")}</p>
    </div>
  );
}
