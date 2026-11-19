"use client";

import { useEffect } from 'react';
import { useSystemAccount } from '@/hooks/useSystemAccount';
import { useWalletStore } from '@/lib/store/wallet-store';
import { useAccount, useDisconnect } from 'wagmi';

/**
 * WalletConnectionBridge
 * 
 * Synchronizes the external Wagmi/RainbowKit connection with the internal 
 * System Wallet Store. This ensures that when a user connects their 
 * wallet via the UI, the entire portfolio system recognizes the identity.
 */
export function WalletConnectionBridge() {
    const { address, isConnected } = useSystemAccount();
    const syncAddress = useWalletStore(state => state.syncAddress);
    const wagmiAccount = useAccount();
    const { disconnect } = useDisconnect();

    // [REMOVED] 15s Force disconnect loop. It causes AppKit to freeze if the user takes longer than 15s to enter their password in MetaMask.

    useEffect(() => {
        // [REVIEWED] Extract handshake address from cookie with strict validation
        const cookies = document.cookie.split('; ');
        const handshakeCookie = cookies.find(row => row.trim().startsWith('system_handshake=0x'));
        const handshakeAddress = handshakeCookie ? handshakeCookie.split('=')[1]?.trim().toLowerCase() : null;
        
        if (isConnected && address) {
            // Priority 1: Direct Web3 Connection (MetaMask/Rainbow/AppKit)
            syncAddress(address.toLowerCase());
        } else if (handshakeAddress && handshakeAddress.startsWith('0x')) {
            // Priority 2: System Handshake (QR Link)
            syncAddress(handshakeAddress);
        } else {
            // State: Purged/Disconnected
            syncAddress(null);
        }
    }, [isConnected, address, syncAddress]);

    //  [COSMIC BRIDGE] Real-Time Autologin Listener 
    // GUARD: Only open SSE when actively waiting for a QR handshake.
    // Prevents a persistent connection being held open on mobile for every user
    // who already has a system wallet or is connected via MetaMask/WalletConnect.
    useEffect(() => {
        if (isConnected) return; // Already logged in  no SSE needed

        // Check for pending QR session before opening SSE
        let pendingSession: string | null = null;
        try { pendingSession = sessionStorage.getItem('pending_qr_session'); } catch {}
        if (!pendingSession) return; // No QR in flight  skip SSE entirely

        const eventSource = new EventSource('/api/ledger-stream');
        
        eventSource.addEventListener('auth-complete', (e: any) => {
            try {
                const data = JSON.parse(e.data);
                const currentSessionId = sessionStorage.getItem('pending_qr_session');
                
                if (data.socketId === currentSessionId && data.address) {
                    console.log(`[Handshake:Success] Relay received for ${data.address}`);
                    
                    // 1. Set the cookie for persistent auth
                    document.cookie = `system_handshake=${data.address.toLowerCase()}; path=/; max-age=604800; samesite=lax`;
                    
                    // 2. Trigger the sync in the store
                    syncAddress(data.address.toLowerCase());
                    
                    // 3. Emit global event for UI transitions (ConnectWalletModal)
                    window.dispatchEvent(new CustomEvent('system:auth_success', { 
                        detail: { address: data.address } 
                    }));

                    // 4. Cleanup  close stream immediately, session is done
                    sessionStorage.removeItem('pending_qr_session');
                    eventSource.close();
                }
            } catch (err) {
                console.error('[Handshake:RelayError]', err);
            }
        });

        return () => eventSource.close();
    }, [isConnected, syncAddress]);

    // This component is a pure logic bridge - it renders nothing.
    return null;
}
