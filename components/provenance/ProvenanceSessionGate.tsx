'use client';

import Link from 'next/link';
import { ArrowLeft, Loader2, ShieldCheck } from 'lucide-react';
import React, { useState, useEffect, useCallback } from 'react';
import { useSystemAccount } from '@/hooks/useSystemAccount';

// ─────────────────────────────────────────────────────────────────────────────
// ProvenanceSessionGate — P2-C.1 Studio Pilot (Step 3: Shadow Mode)
// ─────────────────────────────────────────────────────────────────────────────
//
// Authentication priority:
//   1. Server-side JWT (ledger_session / human_session) via /api/auth/verify-session
//   2. Live wagmi wallet connection (address present = wallet connected in browser)
//
// P2-C.1 additions (SHADOW mode):
//   - /api/auth/verify-session now also returns `humanityIdentity` if a
//     humanity_session cookie is present. This data is logged for observability
//     to detect identity mismatches between the legacy and SIWE identity systems.
//   - In SHADOW mode: the gate still authorizes based on legacy identity.
//     The humanityIdentity is only logged (no behaviour change for the user).
//   - In PILOT/LIVE mode (future): The gate will enforce humanity_session first.
//
// Destructive write operations within each module perform their own SIWE
// re-authentication at the action level (Option D in API routes).
// ─────────────────────────────────────────────────────────────────────────────

interface VerifySessionResponse {
  authenticated: boolean;
  user?: { address: string; tier: string };
  humanityIdentity?: { address: string; sessionId: string } | null;
}

export function ProvenanceSessionGate({ children }: { children: React.ReactNode }) {
  // null = loading, true = authenticated, false = not authenticated
  const [authState, setAuthState] = useState<null | boolean>(null);
  const { address, isConnected } = useSystemAccount();
  const [isAuthenticating, setIsAuthenticating] = useState(false);

  const handleManualSiwe = useCallback(async () => {
    if (!address) return;
    try {
      setIsAuthenticating(true);
      const { signMessage } = await import('@wagmi/core');
      const { config } = await import('@/lib/wagmi-config');

      const resNonce = await fetch('/api/siwe/nonce');
      const nonce = await resNonce.text();

      const { SiweMessage } = await import('siwe');
      const message = new SiweMessage({
        domain: window.location.host,
        address: address as string,
        statement: 'Sign in to Ledger Alert Network',
        uri: window.location.origin,
        version: '1',
        chainId: 1,
        nonce,
      });

      // Mobile Safari / Chrome Deep Link Helper
      const isMobile = /android|webos|iphone|ipad|ipod|blackberry|iemobile|opera mini/i.test(
        navigator.userAgent.toLowerCase()
      );
      if (isMobile) {
        setTimeout(() => { window.location.href = 'wc://'; }, 50);
      }

      const signature = await signMessage(config as any, {
        message: message.prepareMessage(),
      });

      if (isMobile) {
        await new Promise(r => setTimeout(r, 400));
      }

      const verifyRes = await fetch('/api/siwe/verify', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ message: message.prepareMessage(), signature }),
      });

      if (verifyRes.ok) {
        setAuthState(true);
      } else {
        alert('Signature verification failed. Please try again.');
      }
    } catch (e) {
      console.error('[ProvenanceSessionGate] SIWE sign-in error:', e);
    } finally {
      setIsAuthenticating(false);
    }
  }, [address]);

  useEffect(() => {
    let cancelled = false;

    async function checkSession() {
      // Fast path: wallet connected — attempt server session verification
      if (isConnected) {
        try {
          const res = await fetch('/api/auth/verify-session', { cache: 'no-store', credentials: 'include' });
          if (!cancelled && res.ok) {
            const data: VerifySessionResponse = await res.json();
            if (data.authenticated) {
              // ── P2-C.1 SHADOW: Log identity adapter telemetry ─────────────
              // In SHADOW mode, this is purely observational. Zero behaviour change.
              if (data.humanityIdentity) {
                const legacyAddr = data.user?.address?.toLowerCase();
                const humanityAddr = data.humanityIdentity.address.toLowerCase();
                if (legacyAddr && humanityAddr && legacyAddr !== humanityAddr) {
                  console.warn(
                    '[ProvenanceSessionGate:SHADOW] Identity mismatch:',
                    `legacy=${legacyAddr}`,
                    `humanity=${humanityAddr}`,
                    `sessionId=${data.humanityIdentity.sessionId}`
                  );
                } else if (legacyAddr && humanityAddr) {
                  console.info(
                    '[ProvenanceSessionGate:SHADOW] Identities matched:',
                    legacyAddr,
                    `sessionId=${data.humanityIdentity.sessionId}`
                  );
                }
              }
              setAuthState(true);
              return;
            }
          }
        } catch {
          // Server session check failed — still allow read access if connected
        }
        // Wallet is connected but no server session — allow read access
        // Write operations enforce their own SIWE re-auth at the action level
        if (!cancelled) setAuthState(true);
        return;
      }

      // Slow path: check SIWE session for non-wallet users
      try {
        const res = await fetch('/api/siwe/session', { cache: 'no-store' });
        if (cancelled) return;
        if (res.ok) {
          const data = await res.json();
          if (data.address && (!address || data.address.toLowerCase() === address.toLowerCase())) {
            setAuthState(true);
            return;
          }
        }
        setAuthState(false);
      } catch {
        if (!cancelled) setAuthState(false);
      }
    }

    checkSession();
    return () => { cancelled = true; };
  }, [isConnected, address]);

  // ── Loading state ─────────────────────────────────────────────────────────
  if (authState === null || isAuthenticating) {
    return (
      <div className="h-full w-full flex-1 bg-[#FFFFFF] flex items-center justify-center">
        <Loader2 size={20} className="animate-spin text-black/30" />
      </div>
    );
  }

  // ── Not authenticated ─────────────────────────────────────────────────────
  if (!authState) {
    return (
      <div className="h-full w-full flex-1 bg-[#FFFFFF] text-[#050505] flex flex-col px-6 pt-[calc(1.5rem+env(safe-area-inset-top))] pb-[calc(2rem+env(safe-area-inset-bottom))]">
        <div className="flex-1 flex flex-col justify-center max-w-sm mx-auto text-center gap-4">
          <div className="flex justify-center mb-2">
            <ShieldCheck size={32} className="text-black/20" />
          </div>
          <h1 className="text-xl font-black tracking-tight">
            {isConnected ? 'Verify Identity' : 'Connect your wallet'}
          </h1>
          <p className="text-sm text-black/60 leading-relaxed">
            {isConnected
              ? 'Please sign the message in your wallet to verify your identity and enable write access to the Studio Provenance database.'
              : 'Connect your wallet to access the Humanity Ledger terminal and all its modules.'}
          </p>

          {isConnected ? (
            <button
              onClick={handleManualSiwe}
              className="w-full py-4 rounded-2xl bg-white text-[#FFFFFF] text-sm font-bold uppercase tracking-widest mt-4 flex items-center justify-center gap-2 hover:bg-black/90 active:scale-95 transition-all shadow-lg"
            >
              Sign Secure Connection
            </button>
          ) : (
            <div className="mt-4 w-full">
              {/* @ts-ignore */}
              <appkit-button />
            </div>
          )}
        </div>
      </div>
    );
  }

  return <>{children}</>;
}
