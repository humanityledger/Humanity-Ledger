// hooks/useLedgerChatPresence.ts
// Network-backed presence system

import { useState, useEffect, useRef, useCallback } from 'react';

export interface PeerPresence {
  /** online = a Ledger Chat window of theirs is open in the foreground right now. */
  status: 'online' | 'offline';
  lastSeen: number | null;
  isTyping: boolean;
  peer: string | null;
}

/** Foreground heartbeat. "Online" lasts ONLINE_WINDOW_MS (30 s) on the server, so 10 s keeps it steady. */
const HEARTBEAT_INTERVAL_MS = 10_000;

type ClientState = 'active' | 'background' | 'leaving';

const lastSeenChoice = () => {
  try { return localStorage.getItem('ledger_privacy_last_seen') || 'contacts'; } catch { return 'contacts'; }
};
const isForeground = () => typeof document === 'undefined' || document.visibilityState === 'visible';

/**
 * Presence, WhatsApp rules:
 *  - "Online" only while this person has Ledger Chat open in the foreground. A window in the
 *    background, a locked phone or a closed tab says "leaving" at once, so "Online" does not linger.
 *  - Otherwise "Last seen today at 10:42", kept 30 days; nothing when either side hides it.
 *  - Background windows do not refresh their own presence; they only read the open chat.
 */
export function useLedgerChatPresence(myAddress: string, activePeer: string | null) {
  const [peerStatus, setPeerStatus] = useState<PeerPresence>({
    status: 'offline',
    lastSeen: null,
    isTyping: false,
    peer: activePeer,
  });

  const activePeerRef = useRef(activePeer);
  activePeerRef.current = activePeer;

  const broadcastTyping = useCallback(() => {
    // Typing travels over XMTP (see LedgerChatV2), not this endpoint.
  }, []);

  const post = useCallback(async (state: ClientState, keepalive = false) => {
    if (!myAddress) return;
    const peer = activePeerRef.current;
    try {
      const res = await fetch('/api/chat/presence', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        keepalive,
        body: JSON.stringify({ peerAddress: state === 'leaving' ? undefined : peer, state, visibility: lastSeenChoice() }),
      });
      if (state === 'leaving' || !peer) {
        if (!peer) setPeerStatus({ status: 'offline', lastSeen: null, isTyping: false, peer: null });
        return;
      }
      if (peer !== activePeerRef.current) return; // the chat changed while this was in flight
      if (!res.ok) {
        // Not mutual contacts (403) or signed out: never show another chat's status.
        setPeerStatus({ status: 'offline', lastSeen: null, isTyping: false, peer });
        return;
      }
      const data = await res.json();
      const lastSeen = typeof data.lastActiveAt === 'number' ? data.lastActiveAt : null;
      setPeerStatus({ status: lastSeen && data.online ? 'online' : 'offline', lastSeen, isTyping: false, peer });
    } catch {
      // Network blip: keep what is shown; the next beat corrects it.
    }
  }, [myAddress]);

  useEffect(() => {
    if (!myAddress) return;
    let timer: ReturnType<typeof setInterval> | null = null;
    const beat = () => post(isForeground() ? 'active' : 'background');
    const start = () => { if (!timer) { beat(); timer = setInterval(beat, HEARTBEAT_INTERVAL_MS); } };
    const stop = () => { if (timer) { clearInterval(timer); timer = null; } };
    const onVisibility = () => {
      if (document.visibilityState === 'visible') start();
      else { stop(); post('leaving', true); }
    };
    const onLeave = () => { stop(); post('leaving', true); };
    if (document.visibilityState === 'visible') start(); else post('background');
    document.addEventListener('visibilitychange', onVisibility);
    window.addEventListener('pagehide', onLeave);
    return () => {
      stop();
      document.removeEventListener('visibilitychange', onVisibility);
      window.removeEventListener('pagehide', onLeave);
    };
  }, [myAddress, post]);

  // A different chat opened: show nothing stale, ask at once.
  useEffect(() => {
    setPeerStatus({ status: 'offline', lastSeen: null, isTyping: false, peer: activePeer });
    if (activePeer) post(isForeground() ? 'active' : 'background');
  }, [activePeer, post]);

  return { peerStatus, broadcastTyping };
}
