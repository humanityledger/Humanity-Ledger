'use client';

/**
 * Which fee rail this build uses on the connected Aztec network, and what that means for privacy.
 * Read from the real configuration (lib/aztec/fees.ts, lib/aztec/private-fees.ts, wallet config);
 * nothing here enables anything. On Alpha the account pays its own Fee Juice and the fee payer is
 * public (audit item A-05); the PrivateFPC route exists in code and is off unless the operator
 * builds with NEXT_PUBLIC_AZTEC_PRIVATE_FEES=on.
 */

import React from 'react';
import { EyeOff, Eye } from 'lucide-react';
import { useT } from '@/lib/i18n/client';
import { SPONSORED_FPC, type FeeNetwork } from '@/lib/aztec/fees';
import { PRIVATE_FEES_BUILD_ON } from '@/lib/aztec/private-fees';
import { AZTEC_WALLET_CONFIG } from '@/lib/aztec/wallet/config';

export type FeeRail = 'fee-juice' | 'private-fpc' | 'sponsored-fpc';

/** The rail for a network and build: pure, for the badge and its tests. */
export function feeRailFor(network: FeeNetwork | string | undefined, privateFeesOn: boolean = PRIVATE_FEES_BUILD_ON): FeeRail {
  if (network === 'testnet' && SPONSORED_FPC.testnet) return 'sponsored-fpc';
  if (privateFeesOn) return 'private-fpc';
  return 'fee-juice';
}

export interface AztecFeeBadgeProps {
  network?: FeeNetwork | string;
  /** Adds the one-line explanation under the badge. */
  explain?: boolean;
  className?: string;
}

export function AztecFeeBadge({ network = AZTEC_WALLET_CONFIG.network, explain = false, className = '' }: AztecFeeBadgeProps) {
  const t = useT();
  const rail = feeRailFor(network);
  const label = rail === 'sponsored-fpc' ? t('Sponsored FPC (test network)') : rail === 'private-fpc' ? t('PrivateFPC (enabled in this build)') : t('Fee Juice (Aztec Alpha)');
  const shielded = rail === 'private-fpc';
  const text = rail === 'sponsored-fpc'
    ? t('On the test network a sponsor contract pays the fee. Test funds only.')
    : shielded
      ? t('Fees are paid through the PrivateFPC, so the fee payer is not your account. This route is under review before it is turned on for everyone.')
      : t('Your account pays its own fee in Fee Juice. The fee payer is public, so the network can link your transactions to each other (not to your name).');
  const Icon = shielded ? EyeOff : Eye;
  return (
    <div className={`flex flex-col gap-1 ${className}`}>
      <span className="inline-flex items-center gap-1.5 self-start rounded-full border border-[#d0d5dd] bg-white px-2.5 py-1 text-[12.5px] font-medium text-[#15171c]" title={text}>
        <Icon size={13} aria-hidden="true" />{t('Fees')}: {label}
      </span>
      {explain && <p className="text-[12.5px] leading-snug text-[#475061]">{text}</p>}
    </div>
  );
}
