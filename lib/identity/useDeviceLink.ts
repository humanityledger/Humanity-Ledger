import { useState, useCallback } from 'react';

export interface DeviceLinkState {
  status: 'idle' | 'generating' | 'waiting' | 'claimed' | 'importing' | 'success' | 'error';
  linkToken?: string;
  linkUrl?: string;
  error?: string;
}

export function useDeviceLink(walletAddress: string) {
  const [state, setState] = useState<DeviceLinkState>({ status: 'idle' });

  const generateLink = useCallback(async () => {
    setState({ status: 'generating' });
    try {
      // Build the settings bundle
      const bundle: Record<string, any> = {
        wallet: walletAddress,
        version: 1,
        createdAt: Date.now(),
        settings: {}
      };
      for (let i = 0; i < localStorage.length; i++) {
        const k = localStorage.key(i)!;
        if (
          k.startsWith('ledger_settings_') ||
          k === 'ledger_avatar' ||
          k === 'ledger_display_name_' + walletAddress.toLowerCase() ||
          k === 'ledger_humanity_identity'
        ) {
          bundle.settings[k] = localStorage.getItem(k);
        }
      }
      const bundleStr = btoa(JSON.stringify(bundle));

      // Upload bundle to server (encrypted reference)
      const res = await fetch('/api/device/link', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'create', bundle: bundleStr })
      });
      const data = await res.json();
      if (!data.token) throw new Error('Failed to create link');

      const baseUrl = typeof window !== 'undefined'
        ? (window.location.protocol === 'file:' ? 'https://humanidfi.com' : window.location.origin)
        : 'https://humanidfi.com';
      const linkUrl = `${baseUrl}/chat/link?token=${data.token}&action=device`;

      setState({ status: 'waiting', linkToken: data.token, linkUrl });
      return linkUrl;
    } catch (e: any) {
      setState({ status: 'error', error: e.message });
      return null;
    }
  }, [walletAddress]);

  const importLink = useCallback(async (token: string) => {
    setState({ status: 'importing' });
    try {
      const res = await fetch('/api/device/link', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'claim', token })
      });
      if (!res.ok) throw new Error('Token expired or invalid');
      const data = await res.json();
      const bundle = JSON.parse(atob(data.bundle));
      
      // Apply settings from bundle
      for (const [k, v] of Object.entries(bundle.settings || {})) {
        localStorage.setItem(k, v as string);
      }
      setState({ status: 'success' });
      setTimeout(() => window.location.reload(), 1500);
    } catch (e: any) {
      setState({ status: 'error', error: e.message });
    }
  }, []);

  return { state, generateLink, importLink };
}
