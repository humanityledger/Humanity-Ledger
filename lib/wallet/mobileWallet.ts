/**
 * lib/wallet/mobileWallet.ts
 *
 * Mobile wallet detection and deep linking helpers for iOS Safari and Android Chrome.
 * Resolves the appropriate deep link / universal link for the user's active wallet
 * (MetaMask, Trust Wallet, Rainbow, Coinbase Wallet, Zerion, Phantom, OKX, Bitget, etc.)
 * and handles app redirection and wake reconnection.
 */
import { safeNativeWalletLink } from '@/lib/auth/wallet-links';

export interface MobileWalletInfo {
  name: string;
  deepLink: string;
}

export function isMobileDevice(): boolean {
  if (typeof window === 'undefined') return false;
  const ua = navigator.userAgent || navigator.vendor || (window as any).opera || '';
  return /android|webos|iphone|ipad|ipod|blackberry|iemobile|opera mini/i.test(ua);
}

/**
 * Inspects localStorage to retrieve the active WalletConnect v2 session peer metadata.
 */
function getWalletConnectPeerInfo(): { name?: string; native?: string; universal?: string } | null {
  if (typeof window === 'undefined' || !window.localStorage) return null;
  try {
    for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i);
      if (key && (key.startsWith('wc@2') || key.includes('session') || key.includes('walletconnect'))) {
        const raw = localStorage.getItem(key);
        if (raw && (raw.includes('"peer"') || raw.includes('"metadata"'))) {
          const parsed = JSON.parse(raw);
          const sessions = Array.isArray(parsed)
            ? parsed
            : parsed?.session
            ? [parsed.session]
            : typeof parsed === 'object' && parsed !== null
            ? Object.values(parsed)
            : [];
          for (const s of sessions) {
            const peer = (s as any)?.peer?.metadata || (s as any)?.metadata;
            if (peer?.name || peer?.redirect) {
              return {
                name: peer.name,
                native: peer.redirect?.native,
                universal: peer.redirect?.universal,
              };
            }
          }
        }
      }
    }
  } catch {}
  return null;
}

/**
 * Resolves the connected mobile wallet's display name and native deep link scheme.
 */
export function detectConnectedMobileWallet(connectorName?: string): MobileWalletInfo {
  if (typeof window === 'undefined') {
    return { name: 'Wallet', deepLink: 'metamask://' };
  }

  // 1. Check direct connector name / ID
  const lowerConnector = (connectorName || '').toLowerCase().trim();

  // 2. Check WalletConnect peer metadata in localStorage
  const peerInfo = getWalletConnectPeerInfo();
  const peerName = (peerInfo?.name || '').toLowerCase();

  // 3. Check wagmi recent connector and AppKit storage
  const wagmiRecent = (
    localStorage.getItem('wagmi.recentConnectorId') ||
    localStorage.getItem('@w3m/connected_wallet_name') ||
    ''
  ).toLowerCase();

  // 4. Check stored preference in sessionStorage / localStorage
  const storedPref = (
    sessionStorage.getItem('preferred_mobile_wallet') ||
    localStorage.getItem('preferred_mobile_wallet') ||
    ''
  ).toLowerCase();

  const combined = `${lowerConnector} ${peerName} ${wagmiRecent} ${storedPref}`;

  // Trust Wallet
  if (combined.includes('trust') || lowerConnector.includes('com.trustwallet.app')) {
    return { name: 'Trust Wallet', deepLink: peerInfo?.native || 'trust://' };
  }

  // Rainbow
  if (combined.includes('rainbow') || lowerConnector.includes('me.rainbow')) {
    return { name: 'Rainbow', deepLink: peerInfo?.native || 'rainbow://' };
  }

  // Coinbase Wallet
  if (combined.includes('coinbase') || lowerConnector.includes('coinbasewalletsdk')) {
    return { name: 'Coinbase Wallet', deepLink: peerInfo?.native || 'cbwallet://' };
  }

  // Zerion
  if (combined.includes('zerion')) {
    return { name: 'Zerion', deepLink: peerInfo?.native || 'zerion://' };
  }

  // Phantom
  if (combined.includes('phantom')) {
    return { name: 'Phantom', deepLink: peerInfo?.native || 'phantom://' };
  }

  // OKX
  if (combined.includes('okx')) {
    return { name: 'OKX Wallet', deepLink: peerInfo?.native || 'okx://' };
  }

  // Bitget
  if (combined.includes('bitget') || combined.includes('bitkeep')) {
    return { name: 'Bitget Wallet', deepLink: peerInfo?.native || 'bitkeep://' };
  }

  // 1inch
  if (combined.includes('1inch') || combined.includes('oneinch')) {
    return { name: '1inch', deepLink: peerInfo?.native || 'oneinch://' };
  }

  // Binance Web3
  if (combined.includes('binance') || combined.includes('bnc')) {
    return { name: 'Binance Wallet', deepLink: peerInfo?.native || 'bnc://' };
  }

  // MetaMask
  if (combined.includes('metamask') || lowerConnector.includes('io.metamask') || lowerConnector.includes('metamask')) {
    return { name: 'MetaMask', deepLink: peerInfo?.native || 'metamask://' };
  }

  // If WalletConnect has a peer native redirect, use it directly
  if (peerInfo?.native) {
    return { name: peerInfo.name || 'Wallet App', deepLink: peerInfo.native };
  }

  // Default fallback
  return { name: 'Wallet App', deepLink: 'metamask://' };
}

/**
 * Triggers the native deep link to open the wallet application on mobile.
 */
export function openMobileWalletApp(connectorName?: string): void {
  if (typeof window === 'undefined') return;
  const { deepLink } = detectConnectedMobileWallet(connectorName);
  // The peer's redirect comes from the wallet's own session metadata: only an app scheme is followed.
  const href = safeNativeWalletLink(deepLink) ?? 'metamask://';
  try {
    window.location.href = href;
  } catch (err) {
    console.warn('[MobileWallet] Failed to open deep link:', err);
  }
}
