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

/** Foreground heartbeat. "Online" lasts ONLINE_WINDOW_MS (30 s) on the server, so 15 s + jitter keeps it steady at 33% lower RPS. */
const HEARTBEAT_INTERVAL_MS = 15_000;
const HEARTBEAT_MAX_BACKOFF_MS = 60_000;

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

  const failuresRef = useRef(0);

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
        failuresRef.current = 0;
        return;
      }
      if (peer !== activePeerRef.current) return; // the chat changed while this was in flight
      if (!res.ok) {
        // Not mutual contacts (403) or signed out: never show another chat's status.
        setPeerStatus({ status: 'offline', lastSeen: null, isTyping: false, peer });
        if (res.status >= 500 || res.status === 429) {
          failuresRef.current = Math.min(3, failuresRef.current + 1);
        }
        return;
      }
      failuresRef.current = 0;
      const data = await res.json();
      const lastSeen = typeof data.lastActiveAt === 'number' ? data.lastActiveAt : null;
      setPeerStatus({ status: lastSeen && data.online ? 'online' : 'offline', lastSeen, isTyping: false, peer });
    } catch {
      // Network blip: keep what is shown and apply backoff on next beat.
      failuresRef.current = Math.min(3, failuresRef.current + 1);
    }
  }, [myAddress]);

  useEffect(() => {
    if (!myAddress) return;
    let timer: ReturnType<typeof setTimeout> | null = null;
    let stopped = false;

    const scheduleNext = () => {
      if (stopped || !isForeground()) return;
      const backoff = failuresRef.current > 0
        ? Math.min(HEARTBEAT_MAX_BACKOFF_MS, HEARTBEAT_INTERVAL_MS * 2 ** (failuresRef.current - 1))
        : HEARTBEAT_INTERVAL_MS;
      const jitter = Math.floor(Math.random() * 2500);
      timer = setTimeout(() => {
        void runBeat();
      }, backoff + jitter);
    };

    const runBeat = async () => {
      if (stopped || !isForeground()) return;
      await post('active');
      scheduleNext();
    };

    const stop = () => {
      if (timer) {
        clearTimeout(timer);
        timer = null;
      }
    };
    const start = () => {
      if (timer) return;
      void runBeat();
    };
    const onVisibility = () => {
      if (document.visibilityState === 'visible') {
        failuresRef.current = 0;
        start();
      } else {
        stop();
        void post('leaving', true);
      }
    };
    const onLeave = () => { stop(); void post('leaving', true); };
    if (document.visibilityState === 'visible') start(); else void post('background');
    document.addEventListener('visibilitychange', onVisibility);
    window.addEventListener('pagehide', onLeave);
    return () => {
      stopped = true;
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
