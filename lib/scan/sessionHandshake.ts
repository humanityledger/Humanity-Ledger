/**
 * Desktop ↔ mobile session QR handshake: the phone side of "link a computer"
 * (WhatsApp Web / Signal Desktop model, see lib/auth/linkedDevices.ts).
 *
 * The phone never links anything on its own: callers first show the person what is asking
 * (previewLink: "Chrome on macOS, 12:31") and call completeSessionHandshake only after an
 * explicit "Link this computer". The handshake sends the computer, encrypted to its key,
 * a one-time claim code plus the channel key the two devices use for signing requests.
 */
import { addPeer, newChannelKey, newDeviceId } from '@/lib/link/channel';

export interface LinkPreview { ok: true; label: string; expiresAt: number | null }

/** uuid of a session QR (…/connect?s=<uuid>&p=…), or null. */
export function sessionQrUuid(decodedText: string): string | null {
  try {
    const u = new URL(decodedText.trim());
    const s = u.searchParams.get('s') || u.searchParams.get('uuid') || u.searchParams.get('session');
    return s && /^[0-9a-z-]{6,64}$/i.test(s) && (u.searchParams.get('p') || u.searchParams.get('pub')) ? s : null;
  } catch {
    return null;
  }
}

/** What computer is asking to be linked, for the approval screen. Requires this phone's session. */
export async function previewLink(decodedText: string): Promise<LinkPreview | { ok: false; message: string; needsWallet?: boolean }> {
  const uuid = sessionQrUuid(decodedText);
  if (!uuid) return { ok: false, message: 'This is not a Ledger Chat sign-in code. On your computer open ledgerchat.org and scan the code shown there.' };
  const r = await fetch(`/api/auth/link?uuid=${encodeURIComponent(uuid)}`, { credentials: 'include', cache: 'no-store' }).catch(() => null);
  if (!r) return { ok: false, message: 'No connection. Check your internet and try again.' };
  if (r.status === 401) return { ok: false, message: 'Sign in on this phone with your wallet first, then scan the code again.', needsWallet: true };
  const j = await r.json().catch(() => ({}));
  if (!r.ok) return { ok: false, message: j.error || 'This code has expired. Refresh it on the computer.' };
  return { ok: true, label: String(j.label || 'A computer'), expiresAt: typeof j.expiresAt === 'number' ? j.expiresAt : null };
}

/**
 * `ledger_chat_seed_<address>` and `system_vault_v1` were copied between
 * devices by the QR handshake and stored in plain localStorage, but nothing
 * in the app reads them (XMTP uses its own key, lib/xmtp/client.ts). A secret
 * nobody needs is only exposure: they are no longer sent, received or kept,
 * and leftovers are removed. Never throws.
 */
export function purgeLegacyHandshakeSecrets(storage: Pick<Storage, 'length' | 'key' | 'removeItem'> | undefined = typeof localStorage !== 'undefined' ? localStorage : undefined): number {
  if (!storage) return 0;
  try {
    const doomed: string[] = [];
    for (let i = 0; i < storage.length; i++) {
      const k = storage.key(i);
      if (k && (k === 'system_vault_v1' || k.startsWith('ledger_chat_seed_'))) doomed.push(k);
    }
    doomed.forEach((k) => storage.removeItem(k));
    return doomed.length;
  } catch {
    return 0;
  }
}

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
  if (!visualPin) {
    try { visualPin = new URL(decodedText.trim()).searchParams.get('pin') || undefined; } catch { /* JSON format */ }
  }
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
  // The claim, this computer's device id and the channel key for its signing requests
  // (lib/link/channel.ts). No seed or vault leaves this device (purgeLegacyHandshakeSecrets).
  const deviceId = newDeviceId();
  const channelKey = newChannelKey();
  const payloadStr = JSON.stringify({ claim, deviceId, channelKey, wallet: resolvedAddress });
  purgeLegacyHandshakeSecrets();

  const encrypted = await encryptAESGCM(shared, payloadStr);
  const postBody: Record<string, unknown> = {
    uuid,
    desktopPub: ephemeralPub,
    encryptedPayload: encrypted.encryptedPayload,
    iv: encrypted.iv,
    tag: encrypted.tag,
    mobilePub: mobilePair.publicKey,
    claimHash,
    deviceId,
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

  // This phone keeps the channel key, to read and answer the computer's signing requests.
  const linked = await res.json().catch(() => ({}));
  addPeer(deviceId, { key: channelKey, label: String((linked as { label?: string }).label || 'Computer'), linkedAt: Date.now() });

  // STEP 3 (seed sync back from the desktop) is removed: the seed it carried
  // was never used, and storing it in plain localStorage was only exposure.

  // Return cleanup so callers can clear the interval on component unmount
  // (prevents ghost polling after the scan page is navigated away from)
  return { ok: true, cleanup: () => {} };
}
