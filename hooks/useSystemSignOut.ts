"use client";

import { useCallback } from 'react';
import { useDisconnect } from 'wagmi';
import { signOut } from 'next-auth/react';
import { useWalletStore } from '@/lib/store/wallet-store';
import { useUIStore } from '@/lib/store/ui-store';

/**
 * [Cryptographic SYSTEM LOGOUT]
 * Secures the local session. Locks the wallet vault but PRESERVES the encrypted 
 * blob so the user can log in again with their Humanity Ledger password.
 */
export function useSystemSignOut() {
    const { disconnect, disconnectAsync } = useDisconnect();

    const nuclearDisconnect = useCallback(async () => {
        console.log('%c[System] Initiating System Logout...', 'color:#FF3B30;font-weight:bold');

        try {
            // STEP 0 — IMMEDIATELY reset isLinked in-memory store (sync).
            // This MUST happen before any async work so LinkedGate cannot re-link
            // during the WalletConnect/wagmi disconnect window.
            try { useUIStore.getState().setLinked(false); } catch {}

            // STEP 0b — Set __disconnected__ guard IMMEDIATELY (sync, before anything async).
            // [FIX] Also write to localStorage so the guard survives the hard reload
            // that happens via window.location.replace('/'). Without this, sessionStorage
            // was cleared in STEP 3 and then window.location.replace('/') reloaded the
            // page without the guard — causing useSystemAccount to immediately re-restore
            // the session from system_session_v2, making it impossible to log out.
            try {
                sessionStorage.setItem('__disconnected__', '1');
                localStorage.setItem('__disconnected__', '1');
                sessionStorage.removeItem('portfolio_unlocked');
                sessionStorage.removeItem('system_wallet_addr');
            } catch (e) {}
            
            // STEP 1 — Nuke ALL cookies synchronously.
            try {
                const cookies = document.cookie.split(";");
                for (let i = 0; i < cookies.length; i++) {
                    const cookie = cookies[i];
                    const eqPos = cookie.indexOf("=");
                    const name = eqPos > -1 ? cookie.substr(0, eqPos).trim() : cookie.trim();

                    if (name.toLowerCase().startsWith('ledger_chat_pin_')) continue;

                    document.cookie = `${name}=;expires=Thu, 01 Jan 1970 00:00:00 GMT;path=/;SameSite=Lax`;
                    document.cookie = `${name}=;expires=Thu, 01 Jan 1970 00:00:00 GMT;path=/;domain=${window.location.hostname};SameSite=Lax`;
                    document.cookie = `${name}=;expires=Thu, 01 Jan 1970 00:00:00 GMT;path=/;domain=.${window.location.hostname};SameSite=Lax`;
                    document.cookie = `${name}=;expires=Thu, 01 Jan 1970 00:00:00 GMT;path=${window.location.pathname};SameSite=Lax`;
                }
            } catch (e) {
                console.warn('[System:Logout] Cookie purge failed:', e);
            }

            // STEP 1.5 — [FASE 7] Memory Sovereignty (Cryptographic Wiping)
            // Prevent Cold-Boot / Memory Dump attacks by actively overwriting critical keys
            // with cryptographic noise before they are handed to the garbage collector.
            try {
                const keysToWipe = ['system_session_v2', 'system_vault_v1', 'system_handshake'];
                keysToWipe.forEach(key => {
                    if (localStorage.getItem(key)) {
                        const noise = new Uint8Array(64);
                        crypto.getRandomValues(noise);
                        localStorage.setItem(key, btoa(String.fromCharCode(...noise)));
                    }
                });
            } catch(e) {
                console.warn('[System:Logout] Memory wiping failed', e);
            }

            // STEP 2 — Clear LocalStorage (includes system_session_v2 which feeds auto-restore).
            try {
                const targets = [
                    'system_handshake',
                    'system_session_v2',   // MUST be cleared — this is what auto-restores sessions
                    'system_vault_v1',
                    'system_pending_wakeup',
                    'system_wallet_addr',  // Extra guard
                    'hl.link.self.v1',     // this computer's channel to the phone (lib/link/channel.ts)
                ];
                targets.forEach(t => localStorage.removeItem(t));
                // Failsafe: also nuke via direct key in case the key was stored differently
                try { localStorage.removeItem('system_session_v2'); } catch {}

                Object.keys(localStorage).forEach(key => {
                    const lower = key.toLowerCase();
                    if (lower.startsWith('ledger_chat_pin_')) return;
                    if (lower.includes('ledger_chat_history_')) return;
                    if (lower.includes('ledger_xmtp')) return;
                    if (lower.includes('ledger-system-wallet-registry')) return; // PROTECT ALL WALLET VERSIONS
                    if (lower.includes('system_account') || lower.includes('system_keystore')) return; // PROTECT ALL SYSTEM ACCOUNTS
                    // CRITICAL: The hardware-bound session token enables Revolut-style auto-unlock.
                    // Must survive disconnect so user doesn't need to re-enter password on next visit.
                    if (lower.includes('ledger_hw_session_token')) return;

                    // Nuke EVERYTHING else. If clearing browsing history works, this will mimic it precisely.
                    localStorage.removeItem(key);
                });

                // SECURITY [PIN-GATE]: Explicitly nuke ALL enclave clearance tokens so the
                // PIN gate is ALWAYS shown after sign-out. Even if other localStorage keys
                // survived the purge loop above, these must be gone.
                // This prevents seed-phrase attackers from bypassing the PIN gate.
                const ENCLAVE_CLEARANCE_KEYS = [
                    '__enclave_clearance_v2__',
                    'ledger_enclave_clearance',
                    'ledger_enclave_ts',
                    '__enclave_fp__',
                    'ledger_account_already_created',
                    'ledger_pin_configured',
                    'ledger_onboarded_global',
                ];
                ENCLAVE_CLEARANCE_KEYS.forEach(k => { try { localStorage.removeItem(k); } catch {} });
                // Also nuke per-address clearance keys
                Object.keys(localStorage).forEach(key => {
                    const lower = key.toLowerCase();
                    if (
                        lower.startsWith('ledger_account_created_') ||
                        lower.startsWith('ledger_enclave_cleared_') ||
                        lower.startsWith('ledger_onboarded_')
                    ) {
                        try { localStorage.removeItem(key); } catch {}
                    }
                });

                // Set explicit flag: PIN must be verified on next login (survives to next page load)
                try { localStorage.setItem('ledger_pin_required_after_logout', '1'); } catch {}

            } catch (e) {
                console.warn('[System:Logout] LocalStorage purge failed:', e);
            }

            // STEP 3 — Clear full SessionStorage (preserve sw_nuclear_purge_v4 and the guard).
            try {
                const swNuclearPurgeFlag = sessionStorage.getItem('sw_nuclear_purge_v4');
                sessionStorage.clear();
                // [FIX] Re-set the disconnect guard after clear() — it was being wiped
                sessionStorage.setItem('__disconnected__', '1');
                // Also ensure it's in localStorage for cross-reload persistence
                localStorage.setItem('__disconnected__', '1');
                if (swNuclearPurgeFlag) {
                    sessionStorage.setItem('sw_nuclear_purge_v4', swNuclearPurgeFlag);
                }
            } catch (e) {}

            // STEP 4 — Nuke IndexedDB (WalletConnect/wagmi persist session here).
            try {
                if (window.indexedDB && typeof window.indexedDB.databases === 'function') {
                    const dbs = await window.indexedDB.databases();
                    dbs.forEach(db => {
                        if (db.name) {
                            const lower = db.name.toLowerCase();
                            if (
                                lower.includes('xmtp') ||
                                // (A 'Ledger Chatsecurestore' entry here never matched a lowercased name, so that store was
                                // always wiped on sign-out. Kept that way on purpose: the more restrictive behaviour.)
                                lower.includes('ledger_chat_history') ||
                                // CRITICAL: Preserve the hardware-bound Revolut-style persistence key.
                                // Deleting this would destroy the non-extractable AES-GCM CryptoKey
                                // that auto-unlocks the vault on every page load. Users would need
                                // to re-enter their password after EVERY disconnect — exactly the
                                // problem we are solving.
                                lower.includes('ledgerquantumpersistence')
                            ) {
                                return;
                            }
                            window.indexedDB.deleteDatabase(db.name);
                        }
                    });
                } else if (window.indexedDB) {
                    // Safari/iOS fallback
                    // HumanityLedgerChatDB: local chat history (may hold agreement invitations); wiped on every path.
                    ['walletconnect-v2', 'w3m-core-storage', 'w3m-storage', 'wagmi-cache', 'HumanityLedgerChatDB'].forEach(name => {
                        try { window.indexedDB.deleteDatabase(name); } catch(e) {}
                    });
                }
            } catch (e) {
                console.warn('[System:Logout] IndexedDB purge failed:', e);
            }


            // STEP 5 — Disconnect Wagmi.
            // [FIX] WalletConnect requires up to ~2s to close the socket cleanly.
            // 100ms was always timing out, leaving wagmi in 'connected' state,
            // which caused LinkedGate to immediately re-link the user.
            try {
                if (disconnectAsync) {
                    await Promise.race([
                        disconnectAsync(),
                        new Promise(resolve => setTimeout(resolve, 2000)) // WalletConnect needs up to 2s
                    ]);
                } else if (disconnect) {
                    disconnect();
                    // Give sync disconnect a moment to propagate
                    await new Promise(resolve => setTimeout(resolve, 300));
                }
            } catch (e) {
                console.warn('[System:Logout] Wagmi disconnect failed:', e);
            }

            // STEP 6 — NextAuth SignOut (awaited with timeout to guarantee cookie clearance).
            // [FIX] Increased from 1500ms to 5000ms — 1.5s was too short on slow connections.
            try {
                await Promise.race([
                    signOut({ redirect: false }),
                    new Promise(resolve => setTimeout(resolve, 5000))
                ]);
            } catch (e) {}

            // STEP 6b — Call server-side /api/auth/logout to clear httpOnly cookies.
            // CRITICAL: ledger_session and human_session are httpOnly=true, meaning JavaScript
            // CANNOT clear them via document.cookie. Without this call, the server-side cookies
            // remain valid and the middleware re-authenticates the user on every page load —
            // making it impossible to log out.
            //
            // [FIX] Increased timeout from 1500ms to 8000ms. The old 1500ms timeout fired before
            // the server responded on slow connections, causing the fetch to be abandoned
            // mid-flight — the Set-Cookie headers (which clear ledger_session) were never received
            // by the browser. Result: users stayed logged in after clicking Disconnect.
            // [FIX] Added one retry on network error for reliability.
            const doLogoutFetch = async () => {
                const res = await fetch('/api/auth/logout', {
                    method: 'POST',
                    credentials: 'include',
                    headers: { 'Content-Type': 'application/json' },
                });
                return res;
            };
            try {
                await Promise.race([
                    doLogoutFetch().catch(async (firstErr) => {
                        console.warn('[System:Logout] First logout attempt failed, retrying...', firstErr);
                        return doLogoutFetch(); // one retry
                    }),
                    new Promise(resolve => setTimeout(resolve, 8000)) // raised from 1500ms
                ]);
            } catch (e) {
                console.warn('[System:Logout] Server logout call failed (non-fatal):', e);
            }


            // STEP 7 — Lock local wallet vault.
            try {
                useWalletStore.getState().lockVault();
            } catch (e) {}

            // STEP 8 — Unregister service workers to avoid stale cache bugs.
            if ('serviceWorker' in navigator) {
                try {
                    const registrations = await navigator.serviceWorker.getRegistrations();
                    for (let registration of registrations) {
                        await registration.unregister();
                    }
                } catch (e) {}
            }
            
            // STEP 8b — Stop the private Aztec wallet (drops its signing key, claim secrets and PXE handle),
            // then delete its on-device stores (PXE keys, contract secrets, notes): see lib/aztec/wallet/wipe.ts.
            // JS cannot zeroize bigints; the redirect below discards the heap.
            try {
                const { getPrivateWallet } = await import('@/lib/aztec/wallet/client');
                await Promise.race([getPrivateWallet().disconnect(), new Promise(resolve => setTimeout(resolve, 2000))]);
                const { wipeLocalAztecStores } = await import('@/lib/aztec/wallet/wipe');
                const wiped = await Promise.race([
                    wipeLocalAztecStores(),
                    new Promise<{ deleted: string[]; failed: string[] }>(resolve => setTimeout(() => resolve({ deleted: [], failed: ['(timed out)'] }), 4000)),
                ]);
                // Counts only, never store names in logs. Survives the redirect for the connect page to show.
                if (wiped.failed.length) sessionStorage.setItem('hl.aztec.wipe_incomplete', String(wiped.failed.length));
            } catch (e) {}

            // STEP 9 — Hard clear cache using caches API if available.
            try {
                if ('caches' in window) {
                    const cacheKeys = await caches.keys();
                    for (const key of cacheKeys) {
                        await caches.delete(key);
                    }
                }
            } catch (e) {}
        } catch (e) {
            console.error('[System:Logout] Critical exception:', e);
        } finally {
            // STEP 10 — Hard redirect to connect page. Wipes all in-memory React state.
            console.log('%c[System] Session Locked. Redirecting to /connect', 'color:#00A36C');
            window.location.replace('/connect');
            
            // Fallback in case window.location.replace hangs for some reason
            setTimeout(() => {
                window.location.href = '/connect';
            }, 500);
        }
    }, [disconnect, disconnectAsync]);

    return { nuclearDisconnect };
}
