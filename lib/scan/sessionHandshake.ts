/**
 * Desktop ↔ mobile session QR handshake (extracted from QRScannerModal).
 */

export type SessionHandshakeResult =
  | { ok: true; cleanup?: () => void }
  | { ok: false; message: string; needsWallet?: boolean };

export async function completeSessionHandshake(
  decodedText: string,
  getAddress: () => string | null,
  signMessageAsync?: (args: { message: string }) => Promise<string>,
  connector?: any,
  visualPin?: string
): Promise<SessionHandshakeResult> {
  let uuid: string | null = null;
  let ephemeralPub: string | null = null;
  let isECDH = false;

  try {
    const url = new URL(decodedText.trim());
    // NEW STATELESS FORMAT: ?s=UUID&p=Base64PubKey
    const shortUuid = url.searchParams.get('s');
    if (shortUuid) {
      uuid = shortUuid;
      // We read the public key directly from the URL to avoid server dependency issues on Edge/Railway
      const pParam = url.searchParams.get('p');
      if (!pParam) {
        return { ok: false, message: 'Invalid QR format. Missing public key.' };
      }
      ephemeralPub = pParam;
      isECDH = url.searchParams.get('ecdh') === '1';
    } else {
      // LEGACY FORMAT: pub embedded in URL params
      uuid = url.searchParams.get('uuid') || url.searchParams.get('session');
      // IMPORTANT: searchParams.get() already URL-decodes the value.
      // Do NOT wrap with decodeURIComponent() — that causes double-decoding
      // which corrupts the base64url-encoded public key.
      const rawPub = url.searchParams.get('pub') || url.searchParams.get('ekey');
      ephemeralPub = rawPub ?? null;
      isECDH = url.searchParams.get('ecdh') === '1';
      const exp = url.searchParams.get('exp');
      if (exp && Date.now() > parseInt(exp, 10)) {
        return { ok: false, message: 'QR code has expired. Please refresh it on the desktop terminal.' };
      }
    }
  } catch {
    try {
      const parsed = JSON.parse(decodedText);
      uuid = parsed.uuid ?? null;
      ephemeralPub = parsed.ephemeralPub ?? parsed.pub ?? null;
      isECDH = parsed.isECDH ?? false;
    } catch {
      return {
        ok: false,
        message:
          'Invalid QR code. Please scan the QR code displayed on the Humanity Ledger desktop site.',
      };
    }
  }

  if (!uuid || !ephemeralPub) {
    return { ok: false, message: 'Invalid session data. Please refresh the desktop QR code.' };
  }

  // ────────────────────────────────────────────────────────────────
  // STEP 1: Robustly resolve the wallet address from multiple sources
  // Priority: wagmi hook > export-jwt payload > system_handshake cookie
  // ────────────────────────────────────────────────────────────────
  const wagmiAddr = getAddress();

  // Try export-jwt first — gives us both the JWT and the address from the server
  let jwt: string | null = null;
  let jwtAddress: string | null = null;
  let hasValidSession = false;

  try {
    const exportRes = await fetch('/api/auth/export-jwt', { credentials: 'include', cache: 'no-store' });
    if (exportRes.ok) {
      const exportData = await exportRes.json();
      if (exportData.authenticated) {
        hasValidSession = true;
        jwtAddress = exportData.address;
      }
      if (exportData.jwt) {
        jwt = exportData.jwt;
        // Extract address from JWT payload to verify it matches the current wallet
        try {
          const parts = jwt!.split('.');
          if (parts.length === 3) {
            const payload = JSON.parse(atob(parts[1].replace(/-/g, '+').replace(/_/g, '/')));
            jwtAddress = (payload.sub || payload.address || '').toLowerCase() || null;
          }
        } catch { /* non-fatal */ }
      }
    }
  } catch {
    /* server mint path */
  }

  // Determine the authoritative address
  let resolvedAddress: string | null = wagmiAddr ? wagmiAddr.toLowerCase() : null;

  // 1. Verify if the server already recognizes our session (via HttpOnly cookies)
  // We CANNOT check document.cookie for human_session because it is HttpOnly.
  try {
    const checkRes = await fetch('/api/auth/verify-session', { cache: 'no-store', credentials: 'include' });
    if (checkRes.ok) {
      const data = await checkRes.json();
      if (data.authenticated && data.user?.address) {
        hasValidSession = true;
        jwtAddress = data.user.address.toLowerCase();
        
        // If wagmiAddr doesn't match the server session, we must re-mint
        if (resolvedAddress && jwtAddress !== resolvedAddress) {
          console.warn(`[QR:Handshake] Wallet mismatch: server=${jwtAddress} wagmi=${resolvedAddress}. Re-minting.`);
          hasValidSession = false;
        } else {
          resolvedAddress = jwtAddress;
        }
      }
    }
  } catch (e) {
    console.warn('[QR:Handshake] Error verifying session with server:', e);
  }

  // If we have a wagmi address but no valid session on the server, mint a fresh one via SIWE
  if (!hasValidSession && resolvedAddress) {
    if (!signMessageAsync) {
      console.error('[QR:Handshake] Missing signMessageAsync function for secure SIWE verification.');
    } else {
      try {
        // [QUANTUM AEGIS] Real SIWE Signature Generation
        const nonceRes = await fetch('/api/auth/nonce', { cache: 'no-store' });
        if (nonceRes.ok) {
          const { nonce } = await nonceRes.json();
          const message = `Authenticate to Humanity Ledger.\n\nNonce: ${nonce}`;
          
          let signature = '';
          try {
            signature = await signMessageAsync({ message });
          } catch (signErr: any) {
            const errMsg = signErr?.message?.toLowerCase() || '';
            if (errMsg.includes('connector not connected') || errMsg.includes('not connected')) {
              console.warn('[QR:Handshake] Wagmi signMessage failed. Bypassing via raw EIP-1193 provider...');
              try {
                const provider = (await connector?.getProvider()) as any;
                if (!provider?.request) throw new Error("No provider request method");
                const hexMessage = '0x' + Array.from(new TextEncoder().encode(message)).map(b => b.toString(16).padStart(2, '0')).join('');
                signature = await provider.request({
                  method: 'personal_sign',
                  params: [hexMessage, resolvedAddress]
                });
              } catch (fallbackErr) {
                 throw signErr;
              }
            } else {
              throw signErr;
            }
          }

          const sigRes = await fetch('/api/auth/system-verify', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ address: resolvedAddress, message, signature, nonce, _qrHandshake: true }),
            credentials: 'include',
          });
          
          if (sigRes.ok) {
            const data = await sigRes.json();
            jwt = data.jwt ?? null;
            hasValidSession = true;
          } else {
            return { ok: false, message: 'Server rejected cryptographic signature.' };
          }
        } else {
          return { ok: false, message: 'Failed to retrieve nonce from server.' };
        }
      } catch (err) {
        console.error('[QR:Handshake] SIWE verification failed during handshake recovery:', err);
        return { ok: false, message: 'Failed to verify wallet signature. Please try again.' };
      }
    }
  }

  if (!hasValidSession && !resolvedAddress) {
    return {
      ok: false,
      message: 'Wallet not connected. Connect your wallet first, then scan the QR code.',
      needsWallet: true,
    };
  }

  // ATOMIC SECURITY: If we still don't have a valid session after the SIWE attempt, abort the handshake.
  if (!hasValidSession) {
    return {
      ok: false,
      message: 'A cryptographically signed session is required to link devices. Please sign the message in your wallet.',
      needsWallet: true,
    };
  }

  // ────────────────────────────────────────────────────────────────
  // STEP 2: Generate ECDH keypair, encrypt payload, POST to server
  // ────────────────────────────────────────────────────────────────
  const { generateX25519KeyPair, deriveSharedSecret, encryptAESGCM } = await import('@/lib/web-crypto');
  const mobilePair = await generateX25519KeyPair();
  // [VISUAL PIN HKDF] Pass the PIN to derive a unique session key
  // If PIN is wrong/missing the desktop will fail to decrypt the AES-GCM payload
  const shared = await deriveSharedSecret(mobilePair.privateKey, ephemeralPub, isECDH, visualPin);

  // A one-time claim code, readable only by the computer that shows this QR
  // code and its PIN. The server keeps the new session until the computer
  // presents the code (see app/api/auth/qr-mobile-link). No session token
  // travels in this message.
  void jwt;
  const claimBytes = crypto.getRandomValues(new Uint8Array(32));
  const claim = Array.from(claimBytes, b => b.toString(16).padStart(2, '0')).join('');
  const claimHash = Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256', new TextEncoder().encode(claim))))
    .map(b => b.toString(16).padStart(2, '0')).join('');
  let payloadStr = JSON.stringify({ claim });
  try {
    const normAddr = resolvedAddress;
    const seed = normAddr ? localStorage.getItem(`ledger_chat_seed_${normAddr}`) : null;
    const vault = localStorage.getItem('system_vault_v1');
    payloadStr = JSON.stringify({ claim, seed, vault });
  } catch { /* storage unavailable: send the claim alone */ }

  const encrypted = await encryptAESGCM(shared, payloadStr);
  const postBody: Record<string, unknown> = {
    uuid,
    desktopPub: ephemeralPub,
    encryptedPayload: encrypted.encryptedPayload,
    iv: encrypted.iv,
    tag: encrypted.tag,
    mobilePub: mobilePair.publicKey,
    claimHash,
  };

  const res = await fetch('/api/auth/qr-mobile-link', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(postBody),
    credentials: 'include',
  });

  if (!res.ok) {
    const errBody = await res.json().catch(() => ({}));
    const errText = (errBody as { error?: string }).error || 'Handshake failed';
    if (res.status === 401) {
      return {
        ok: false,
        message: 'Wallet not connected. Connect your wallet first, then scan the QR code.',
        needsWallet: true,
      };
    }
    return { ok: false, message: `Handshake error: ${errText}. Please try again.` };
  }

  // ────────────────────────────────────────────────────────────────
  // STEP 3: Optional seed sync back from desktop
  // ────────────────────────────────────────────────────────────────
  let seedAttempts = 0;
  const pollSeed = setInterval(async () => {
    seedAttempts++;
    if (seedAttempts > 10) {
      clearInterval(pollSeed);
      return;
    }
    try {
      const sRes = await fetch(`/api/auth/qr-sync-seed?uuid=${uuid}`, {
        credentials: 'include',
        cache: 'no-store',
      });
      if (sRes.ok) {
        const sData = await sRes.json();
        if (sData.encryptedSeed && sData.iv) {
          clearInterval(pollSeed);
          const { decryptAESGCM } = await import('@/lib/web-crypto');
          const decryptedRaw = await decryptAESGCM(shared, sData.encryptedSeed, sData.iv);
          try {
            const payload = JSON.parse(decryptedRaw);
            const finalAddr = resolvedAddress;
            if (finalAddr) {
              if (payload.seed) localStorage.setItem(`ledger_chat_seed_${finalAddr}`, payload.seed);
              if (payload.vault) localStorage.setItem('system_vault_v1', payload.vault);
            }
          } catch {
            if (resolvedAddress) {
              localStorage.setItem(`ledger_chat_seed_${resolvedAddress}`, decryptedRaw);
            }
          }
        }
      }
    } catch {
      /* ignore */
    }
  }, 1000);

  // Return cleanup so callers can clear the interval on component unmount
  // (prevents ghost polling after the scan page is navigated away from)
  return { ok: true, cleanup: () => clearInterval(pollSeed) };
}
