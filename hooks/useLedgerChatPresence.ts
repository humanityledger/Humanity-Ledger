// hooks/useLedgerChatPresence.ts
// Network-backed presence system

import { useState, useEffect, useRef, useCallback } from 'react';

export interface PeerPresence {
  status: 'online' | 'away' | 'offline';
  lastSeen: number | null;
  isTyping: boolean;
  peer: string | null;
}

const HEARTBEAT_INTERVAL_MS = 15_000; 
const AWAY_THRESHOLD_MS = 45_000;     
const OFFLINE_THRESHOLD_MS = 90_000;  

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
    // Typing indicator is not supported over DB polling due to rate limits
  }, []);

  const evaluatePeerStatus = useCallback(async () => {
    if (!activePeerRef.current || !myAddress) {
      setPeerStatus({ status: 'offline', lastSeen: null, isTyping: false, peer: null });
      return;
    }

    try {
      const res = await fetch('/api/chat/presence', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          address: myAddress,
          peerAddress: activePeerRef.current,
          // Your "Last seen" choice; the server applies it both ways.
          visibility: (() => { try { return localStorage.getItem('ledger_privacy_last_seen') || 'contacts'; } catch { return 'contacts'; } })(),
        })
      });
      
      if (res.ok) {
        const data = await res.json();
        const lastSeen = data.lastActiveAt;
        if (!lastSeen) {
          // Hidden by their (or your) "Last seen" setting, or simply away:
          // show nothing rather than a stale time from an earlier poll.
          setPeerStatus({ status: 'offline', lastSeen: null, isTyping: false, peer: activePeerRef.current });
          return;
        }

        const age = Date.now() - lastSeen;
        if (age < AWAY_THRESHOLD_MS) {
          setPeerStatus({ status: 'online', lastSeen, isTyping: false, peer: activePeerRef.current });
        } else if (age < OFFLINE_THRESHOLD_MS) {
          setPeerStatus({ status: 'away', lastSeen, isTyping: false, peer: activePeerRef.current });
        } else {
          setPeerStatus({ status: 'offline', lastSeen, isTyping: false, peer: activePeerRef.current });
        }
      } else {
        // Not mutual contacts (403) or signed out: never show another chat's status.
        setPeerStatus({ status: 'offline', lastSeen: null, isTyping: false, peer: activePeerRef.current });
      }
    } catch (e) {
      // Ignore network errors for presence
    }
  }, [myAddress]);

  useEffect(() => {
    if (!myAddress) return;

    evaluatePeerStatus();
    const heartbeatInterval = setInterval(evaluatePeerStatus, HEARTBEAT_INTERVAL_MS);

    return () => {
      clearInterval(heartbeatInterval);
    };
  }, [myAddress, evaluatePeerStatus]);

  // Re-evaluate when activePeer changes
  useEffect(() => {
    evaluatePeerStatus();
  }, [activePeer, evaluatePeerStatus]);

  return { peerStatus, broadcastTyping };
}
