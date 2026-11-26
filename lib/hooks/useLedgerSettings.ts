'use client';
/**
 * Subscribes a component to the settings engine (lib/wallet/SettingsEnginePXE.ts).
 * Lives here, not in the old components/terminal/LedgerChatSettings.tsx, so the
 * settings screen and the chat never pull that legacy UI into their bundles.
 */
import { useEffect, useState } from 'react';
import { pxeEngine, DEFAULT_PXE_SETTINGS, type LedgerProtocolSettings } from '@/lib/wallet/SettingsEnginePXE';

export function useLedgerSettings(address: string) {
  const [settings, setSettings] = useState<LedgerProtocolSettings>(DEFAULT_PXE_SETTINGS);
  const [isLoaded, setIsLoaded] = useState(false);

  useEffect(() => {
    if (!address) return;
    return pxeEngine.subscribe(address, (next) => {
      setSettings(next);
      setIsLoaded(true);
    });
  }, [address]);

  const updateSetting = async <K extends keyof LedgerProtocolSettings>(key: K, value: LedgerProtocolSettings[K]) => {
    await pxeEngine.mutate(address, key, value);
  };
  const updateBatch = async (mutations: Partial<LedgerProtocolSettings>) => {
    await pxeEngine.mutateBatch(address, mutations);
  };
  return { settings, updateSetting, updateBatch, isLoaded };
}
