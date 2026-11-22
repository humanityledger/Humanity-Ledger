'use client';

/**
 * Tells the person when their private wallet finds an incoming payment (lib/payments/incoming.ts):
 * an in-app notice with the amount, and, while the app is in the background, a system notification
 * without it. Payment requests are announced like any message, as "Payment request"
 * (lib/aztec/agreement-message.ts agreementPreview), through the chat's own notifications.
 */

import { useEffect } from 'react';
import { toast } from 'sonner';
import { getPrivateWallet } from '@/lib/aztec/wallet/client';
import { formatUnits } from '@/lib/aztec/wallet/amounts';
import { AZTEC_WALLET_CONFIG } from '@/lib/aztec/wallet/config';
import { notificationEngine } from '@/lib/wallet/NotificationEngine';
import { incomingWords, takeNewIncoming } from '@/lib/payments/incoming';

export function IncomingPaymentNotifier({ muted = false, hideContent = false }: { muted?: boolean; hideContent?: boolean }) {
  useEffect(() => {
    const wallet = getPrivateWallet();
    return wallet.subscribe((s) => {
      if (s.phase !== 'ready' || !s.aztecAddress) return;
      const store = typeof localStorage === 'undefined' ? null : localStorage;
      for (const a of takeNewIncoming(s.aztecAddress, s.activity, store)) {
        const t = AZTEC_WALLET_CONFIG.tokens.find((x) => x.key === a.token);
        const amountText = t && a.amount ? `${formatUnits(BigInt(a.amount), t.decimals, t.decimals)} ${t.symbol}` : null;
        const words = incomingWords(hideContent ? null : amountText);
        toast.success(words.toast);
        if (!muted) void notificationEngine.notifyLocal('Ledger Chat', words.system, `payment-${a.id}`, hideContent).catch(() => undefined);
      }
    });
  }, [muted, hideContent]);
  return null;
}

export default IncomingPaymentNotifier;
