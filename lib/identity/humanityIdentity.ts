/**
 * HumanityIdentity — Canonical identity layer.
 * Decouples the logical identity from the wallet address (signing key).
 * 
 * One identityId maps to N wallet addresses.
 * This allows key rotation, multi-device, and social recovery without
 * losing conversation history.
 * 
 * PROTOCOL_SPEC §III: "SIWE es solo para bootstrap."
 */

export interface HumanityIdentity {
  identityId: string;      // UUID v4 — stable, device-independent
  primaryWallet: string;   // current primary signing wallet
  linkedWallets: string[]; // all wallets ever linked
  createdAt: number;       // timestamp ms
  version: 1;
}

const IDENTITY_KEY = 'ledger_humanity_identity';

export function getOrCreateIdentity(walletAddress: string): HumanityIdentity {
  if (typeof window === 'undefined') throw new Error('Client-only');
  const stored = localStorage.getItem(IDENTITY_KEY);
  if (stored) {
    try {
      const identity: HumanityIdentity = JSON.parse(stored);
      // If this wallet is already linked, return as-is
      if (
        identity.primaryWallet.toLowerCase() === walletAddress.toLowerCase() ||
        identity.linkedWallets.map(w => w.toLowerCase()).includes(walletAddress.toLowerCase())
      ) {
        return identity;
      }
      // New wallet connected — link it to existing identity (key rotation)
      const updated: HumanityIdentity = {
        ...identity,
        primaryWallet: walletAddress,
        linkedWallets: [...new Set([...identity.linkedWallets, walletAddress])]
      };
      localStorage.setItem(IDENTITY_KEY, JSON.stringify(updated));
      return updated;
    } catch {
      // Corrupted — regenerate
    }
  }
  // First time — generate new canonical identity
  const identity: HumanityIdentity = {
    identityId: crypto.randomUUID(),
    primaryWallet: walletAddress,
    linkedWallets: [walletAddress],
    createdAt: Date.now(),
    version: 1
  };
  localStorage.setItem(IDENTITY_KEY, JSON.stringify(identity));
  return identity;
}

export function getIdentity(): HumanityIdentity | null {
  if (typeof window === 'undefined') return null;
  const stored = localStorage.getItem(IDENTITY_KEY);
  if (!stored) return null;
  try { return JSON.parse(stored); } catch { return null; }
}

export function exportIdentityBundle(encryptionKey?: string): string {
  const identity = getIdentity();
  if (!identity) throw new Error('No identity to export');
  // Export all ledger_ settings together with identity
  const bundle: Record<string, any> = { identity };
  for (let i = 0; i < localStorage.length; i++) {
    const k = localStorage.key(i)!;
    if (k.startsWith('ledger_') && !k.startsWith('ledger_cleared_')) {
      bundle[k] = localStorage.getItem(k);
    }
  }
  const json = JSON.stringify(bundle);
  return btoa(json); // Base64 encoded bundle for QR / copy-paste transfer
}

export function importIdentityBundle(base64Bundle: string): boolean {
  try {
    const json = atob(base64Bundle);
    const bundle = JSON.parse(json);
    if (!bundle.identity?.identityId) return false;
    for (const [k, v] of Object.entries(bundle)) {
      if (k === 'identity') {
        localStorage.setItem(IDENTITY_KEY, JSON.stringify(v));
      } else if (k.startsWith('ledger_')) {
        localStorage.setItem(k, v as string);
      }
    }
    return true;
  } catch {
    return false;
  }
}
