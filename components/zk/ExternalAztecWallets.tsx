'use client';

/**
 * "Other Aztec wallets on this device": a one-tap scan for wallets that speak @aztec-labs/wallet-sdk
 * (lib/aztec/wallet/external-sdk.ts). It lists what answers and connects nothing; the wallet built
 * into Ledger Chat stays the one this app uses.
 */

import React, { useState } from 'react';
import { Search } from 'lucide-react';
import { useT } from '@/lib/i18n/client';
import { chainInfoForNetwork, discoverExternalAztecWallets, type ExternalAztecWallet } from '@/lib/aztec/wallet/external-sdk';
import { AZTEC_WALLET_CONFIG } from '@/lib/aztec/wallet/config';

export function ExternalAztecWallets() {
  const t = useT();
  const [state, setState] = useState<'idle' | 'scanning' | 'done'>('idle');
  const [found, setFound] = useState<ExternalAztecWallet[]>([]);
  const scan = async () => {
    setState('scanning');
    try {
      const network = AZTEC_WALLET_CONFIG.network === 'mainnet' ? 'mainnet' : 'testnet';
      setFound(await discoverExternalAztecWallets({ chainInfo: await chainInfoForNetwork(network) }));
    } catch {
      setFound([]);
    } finally {
      setState('done');
    }
  };
  return (
    <div className="flex flex-col gap-2">
      <div className="flex flex-wrap items-center gap-2">
        <span className="text-[13px] text-[#475061]">{t('Other Aztec wallets on this device')}</span>
        <button type="button" onClick={scan} disabled={state === 'scanning'} className="inline-flex items-center gap-1.5 min-h-[40px] px-3 rounded-xl border border-[#d0d5dd] text-[13px] font-medium text-[#15171c] hover:bg-[#f2f4f7] disabled:opacity-50">
          <Search size={14} aria-hidden="true" />{state === 'scanning' ? t('Looking…') : t('Look for wallets')}
        </button>
      </div>
      {state === 'done' && (found.length ? (
        <ul className="flex flex-col gap-1" role="status">
          {found.map((w) => <li key={w.id} className="text-[13px] text-[#15171c]">{w.name} <span className="text-[#727a88]">· {t(w.type === 'extension' ? 'browser extension' : 'web wallet')}</span></li>)}
        </ul>
      ) : <p className="text-[12.5px] text-[#727a88]" role="status">{t('No Aztec wallet extension answered. Ledger Chat’s built-in wallet works without one.')}</p>)}
    </div>
  );
}
