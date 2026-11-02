"use client";

import { useAccount } from 'wagmi';
import { useState, useEffect, useRef } from 'react';
import { useWalletStore } from '@/lib/store/wallet-store';
import { getAddress } from 'viem';

/**
 * [Cryptographic HANDSHAKE] Account Bridge — Hardware-Bound Persistence Edition
 *
 * Priority ladder:
 *   0. Nuclear Disconnect Guard (explicit user logout)
 *   1. Local system wallet (privateKey in memory — just unlocked OR auto-unlocked)
 *   1b. Session-restored system wallet (address in sessionStorage — page reload, read-only)
 *   2. Direct Wagmi connection (MetaMask / WalletConnect / AppKit)
 *   3. QR Handshake cookie (system_handshake=0x...)
 *   4. Disconnected fallback
 *
 * Auto-Unlock Engine (Revolut-style infinite persistence):
 *   On every page load, if the vault has an encryptedVault + passwordHash but no
 *   privateKey in memory (cleared by security on page unload), we silently call
 *   autoUnlockVault(). This decrypts the vault using a CryptoKey stored in IndexedDB
 *   (non-extractable, hardware-bound) and restores the privateKey to memory in
 *   milliseconds — before the user sees any UI. The session NEVER expires unless the
 *   user explicitly deletes their wallet.
 *
 * Network request policy:
 *   - /api/auth/session: polled only for non-system users (ZK/SIWE flow)
 *   - Cookie poll (1s): only when no wagmi AND no system wallet in memory
 */

//  Module-level singletons to prevent duplicate polls across re-renders 
let globalIsPolling = false;
let globalIsZkVerified = false;
let globalPollId: ReturnType<typeof setInterval> | null = null;
const listeners = new Set<(v: boolean) => void>();

const startGlobalPolling = () => {
    if (typeof window === 'undefined' || globalIsPolling || globalIsZkVerified) return;
    globalIsPolling = true;

    const check = async () => {
        if (globalIsZkVerified) {
            if (globalPollId) { clearInterval(globalPollId); globalPollId = null; }
            return;
        }
        try {
            const res = await fetch('/api/auth/session');
            if (!res.ok) return;
            const data = await res.json();
            if (data?.user?.isZkVerified) {
                globalIsZkVerified = true;
                if (globalPollId) { clearInterval(globalPollId); globalPollId = null; }
                listeners.forEach(fn => fn(true));
            }
        } catch {}
    };

    check();
    globalPollId = setInterval(check, 15_000);
};

//  SSR-safe storage helpers 
function safeSessionGet(key: string): string | null {
    try {
        return typeof window !== 'undefined' ? sessionStorage.getItem(key) : null;
    } catch {
        return null;
    }
}

//  Cookie parser — accepts 0x wallet addresses AND email_ OAuth identifiers 
function readHandshakeCookie(): string | null {
    if (typeof document === 'undefined') return null;
    try {
        // Priority A: 0x wallet address (MetaMask / WalletConnect / QR)
        const walletMatch = document.cookie.match(/system_handshake=(0x[0-9a-fA-F]{40,})/i);
        if (walletMatch?.[1]) {
            try { return getAddress(walletMatch[1]); } catch { return walletMatch[1].toLowerCase(); }
        }
        // Priority B: email_ OAuth identifier (Google OAuth / Email OTP via NextAuth)
        const emailMatch = document.cookie.match(/system_handshake=(email_[^;\s]+)/);
        if (emailMatch?.[1]) return emailMatch[1];
        return null;
    } catch {
        return null;
    }
}

//  Hook 
export function useSystemAccount() {
    const wagmiAccount = useAccount();
    const storeAddress = useWalletStore(s => s.address);
    const storePrivateKey = useWalletStore(s => s.privateKey);
    const storePasswordHash = useWalletStore(s => s.passwordHash);
    const storeEncryptedVault = useWalletStore(s => s.encryptedVault);
    const autoUnlockVault = useWalletStore(s => s.autoUnlockVault);


    const [handshakeAddress, setHandshakeAddress] = useState<string | null>(null);
    const [sessionAddress, setSessionAddress]     = useState<string | null>(null);
    const [isSessionUnlocked, setIsSessionUnlocked] = useState(false);
    const [isZkVerified, setIsZkVerified]         = useState(globalIsZkVerified);
    const [isChecking, setIsChecking]             = useState(true);
    // Track auto-unlock so we don't run it twice
    const autoUnlockRan = useRef(false);
    // Track QD daily login earn so it fires once per day per address
    const qdEarnRan = useRef<string>('');

    // [QD TOKENOMICS] Fire daily login earn event when wallet is connected
    useEffect(() => {
        const address = wagmiAccount.address || storeAddress;
        if (!address || typeof address !== 'string' || address.startsWith('email_')) return;
        const today = new Date().toDateString();
        const key = `${address}_${today}`;
        if (qdEarnRan.current === key) return;
        qdEarnRan.current = key;
        // Fire in background — non-blocking
        fetch('/api/qds/earn', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            credentials: 'include',
            body: JSON.stringify({ address: address.toLowerCase(), event: 'DAILY_LOGIN' }),
        }).catch(() => {});
    }, [wagmiAccount.address, storeAddress]);

    // [CRITICAL FIX] Absolute Firewall for Logout Loops
    // Wagmi sometimes auto-reconnects on page load if IndexedDB clearing fails.
    // If the guard is active, we FORCE the UI to show disconnected.
    // IMPORTANT: The guard ONLY kills wagmi/session state — it NEVER touches
    // ledger_hw_session_token (IDB-based), which is the hardware-bound key that
    // must survive logout so the user can re-login without re-creating a wallet.
    const isGuarded = typeof window !== 'undefined' && (
        safeSessionGet('__disconnected__') === '1' ||
        (typeof localStorage !== 'undefined' && localStorage.getItem('__disconnected__') === '1')
    );

    //  Mount effect: storage reads + hardware-bound auto-unlock 
    useEffect(() => {
        const run = async () => {
            // === Step 0: Handle Logout Guard ===
            // MOBILE FIX: If wagmi has successfully reconnected (WalletConnect session restored
            // after tab kill on iOS/Android), clear the stale __disconnected__ guard so the
            // user is not blocked. The guard is only meaningful when explicitly logged out.
            if (wagmiAccount.isConnected) {
                try { localStorage.removeItem('__disconnected__'); } catch {}
                try { sessionStorage.removeItem('__disconnected__'); } catch {}
            }

            // Purge wagmi/session tokens. Do NOT touch ledger_hw_session_token — that
            // must survive so the user can log back in without re-creating a wallet.
            if (isGuarded && !wagmiAccount.isConnected) {
                try { localStorage.removeItem('system_session_v2'); } catch {}
                try { sessionStorage.removeItem('system_wallet_addr'); } catch {}
                try { sessionStorage.removeItem('portfolio_unlocked'); } catch {}
                // Guard is consumed ONLY on explicit re-login in CoreAuthGate/ConnectPage.
                setIsChecking(false);
                return; // Do not restore any session while guard is active.
            }

            // === Step 1: Hardware-Bound Auto-Unlock (Revolut-style) ===
            if (!autoUnlockRan.current && storePasswordHash && storeEncryptedVault && !storePrivateKey) {
                autoUnlockRan.current = true;
                try {
                    const unlocked = await autoUnlockVault();
                    if (unlocked) {
                        console.log('[useSystemAccount] Hardware auto-unlock SUCCESS.');
                    } else {
                        console.warn('[useSystemAccount] Hardware auto-unlock FAILED — user will need to enter password.');
                    }
                } catch (e) {
                    console.warn('[useSystemAccount] Hardware auto-unlock error:', e);
                }
            }

            // === Step 2: Restore system_session_v2 (EIP-712 sign-up flow) ===
            try {
                const raw = localStorage.getItem('system_session_v2');
                if (raw) {
                    const parsed = JSON.parse(raw);
                    if (parsed?.exp > Date.now() && parsed?.wallet) {
                        const addr: string = parsed.wallet;
                        if (addr.startsWith('0x') && addr.length === 42) {
                            try {
                                sessionStorage.setItem('system_wallet_addr', addr.toLowerCase());
                                sessionStorage.setItem('portfolio_unlocked', 'true');
                            } catch {}
                        }
                    }
                }
            } catch {}

            // === Step 3: Read sessionStorage (client only) ===
            const sessAddr = safeSessionGet('system_wallet_addr');
            if (sessAddr && sessAddr.startsWith('0x') && sessAddr.length === 42) {
                setSessionAddress(sessAddr);
            }
            const unlocked = safeSessionGet('portfolio_unlocked') === 'true';
            setIsSessionUnlocked(unlocked);

            // === Step 4: Read handshake cookie ===
            setHandshakeAddress(readHandshakeCookie());

            // === Step 5: ZK verification listener ===
            const listener = (v: boolean) => setIsZkVerified(v);
            listeners.add(listener);

            // === Step 6: ZK polling — only for non-system users ===
            if (!storePrivateKey) {
                startGlobalPolling();
            }

            setIsChecking(false);

            // === Step 7: Cookie poll — only when not already authenticated ===
            let cookiePoll: ReturnType<typeof setInterval> | null = null;
            const alreadyRestored = safeSessionGet('portfolio_unlocked') === 'true';
            if (!wagmiAccount.isConnected && !storePrivateKey && !alreadyRestored) {
                cookiePoll = setInterval(() => {
                    setHandshakeAddress(readHandshakeCookie());
                }, 1_000);
            }

            return () => {
                if (cookiePoll) clearInterval(cookiePoll);
                listeners.delete(listener);
            };
        };

        // Safety fallback: Never allow isChecking to stay true indefinitely
        const fallbackTimer = setTimeout(() => {
            setIsChecking(false);
        }, 3000);

        const cleanup = run();

        return () => {
            clearTimeout(fallbackTimer);
            cleanup.then(clean => {
                if (clean && typeof clean === 'function') clean();
            });
        };
    // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [wagmiAccount.isConnected, storePrivateKey, storePasswordHash, storeEncryptedVault]);

    //  Priority 0: Nuclear Disconnect Guard 
    if (isGuarded) {
        return {
            address: undefined,
            isConnected: false,
            isConnecting: false,
            isReconnecting: false,
            isDisconnected: true,
            status: 'disconnected' as const,
            chain: undefined,
            chainId: 1,
            connector: undefined,
            isSystemHandshake: false,
            isLocalSystemWallet: false,
            needsWalletReconnect: false,
            isZkVerified: false,
            isChecking: false,
        };
    }

    //  Priority 1: Direct Wagmi connection (WalletConnect / MetaMask / any injected wallet)
    // ABSOLUTE PRIORITY: a live external wallet connection always wins over any
    // cached or in-memory Humanity Ledger local-wallet state.
    if (wagmiAccount.isConnected) {
        // Clear any stale QR/handshake cookie — when MetaMask is live, the cookie
        // must not interfere with the error message path in LedgerChat.tsx
        if (typeof document !== 'undefined') {
            try {
                document.cookie = 'system_handshake=; Max-Age=0; path=/; SameSite=Lax';
            } catch {}
        }
        return {
            address: wagmiAccount.address,
            isConnected: true,
            isConnecting: wagmiAccount.isConnecting,
            isReconnecting: wagmiAccount.isReconnecting,
            isDisconnected: false,
            status: 'connected' as const,
            connector: wagmiAccount.connector,
            chainId: wagmiAccount.chainId,
            chain: wagmiAccount.chain,
            isSystemHandshake: false,
            isLocalSystemWallet: false,
            needsWalletReconnect: false,
            isZkVerified,
            isChecking: false,
        };
    }

    //  Priority 2: Local system wallet (privateKey live in memory) 
    // Only reached when there is NO active external wallet connection.
    // This fires after autoUnlockVault() succeeds — zero user friction.
    if (storeAddress && storePrivateKey) {
        return {
            address: storeAddress as `0x${string}`,
            isConnected: true,
            isConnecting: false,
            isReconnecting: false,
            isDisconnected: false,
            status: 'connected' as const,
            chain: undefined,
            chainId: 1,
            connector: undefined,
            isSystemHandshake: false,
            isLocalSystemWallet: true,
            needsWalletReconnect: false,
            isZkVerified,
            isChecking: false,
        };
    }

    //  Priority 3: Session-restored system wallet (address in sessionStorage) 
    // privateKey is not in memory — read-only portfolio display until auto-unlock completes.
    // Only reached when there is NO active external Wagmi/WalletConnect connection.

    const sessionRestoredAddr = sessionAddress || storeAddress;
    if (sessionRestoredAddr && isSessionUnlocked) {
        return {
            address: sessionRestoredAddr as `0x${string}`,
            isConnected: true,
            isConnecting: false,
            isReconnecting: false,
            isDisconnected: false,
            status: 'connected' as const,
            chain: undefined,
            chainId: 1,
            connector: undefined,
            isSystemHandshake: false,
            isLocalSystemWallet: true,
            needsWalletReconnect: false,
            isZkVerified,
            isChecking: false,
        };
    }

    //  Priority 4: QR Handshake / OAuth cookie 
    if (handshakeAddress) {
        const isEmailAuth = handshakeAddress.startsWith('email_');
        return {
            // For email_ auth, address is the email identifier; for 0x, it's the wallet
            address: isEmailAuth ? handshakeAddress as any : handshakeAddress as `0x${string}`,
            isConnected: true,
            isConnecting: false,
            isReconnecting: false,
            isDisconnected: false,
            status: 'connected' as const,
            chain: undefined,
            chainId: 1,
            connector: undefined,
            isSystemHandshake: !isEmailAuth,
            isLocalSystemWallet: false,
            isEmailAuth,
            needsWalletReconnect: !isEmailAuth && !wagmiAccount.isConnected,
            isZkVerified,
            isChecking: false,
        };
    }

    //  Priority 5: Disconnected / connecting fallback 
    // isChecking stays true while auto-unlock is in progress to prevent flash of login UI
    return {
        address: wagmiAccount.address,
        isConnected: false,
        isConnecting: wagmiAccount.isConnecting,
        isReconnecting: wagmiAccount.isReconnecting,
        isDisconnected: wagmiAccount.isDisconnected,
        status: wagmiAccount.status,
        connector: wagmiAccount.connector,
        chainId: wagmiAccount.chainId,
        chain: wagmiAccount.chain,
        isSystemHandshake: false,
        isLocalSystemWallet: false,
        needsWalletReconnect: false,
        isZkVerified,
        isChecking,
    };
}


