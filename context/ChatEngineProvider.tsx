"use client";
import React, { createContext, useContext, useState } from 'react';

// LocalMessage shape — defined inline to avoid importing idb (which breaks SSR)
export interface LocalMessage {
  id: string;
  peerAddress: string;
  senderAddress: string;
  content: string;
  sentAt: number;
  status: 'sending' | 'sent' | 'failed';
  isMine: boolean;
  isZkVerified?: boolean;
  type?: 'text' | 'voice' | 'payment' | 'system';
  senderInboxId?: string;
  conversationId?: string;
  burnAtNs?: number;
  sentAtNs?: bigint | number;
  reactions?: any[];
  isPinned?: boolean;
  isDestructing?: boolean;
}

interface ChatEngineContextType {
  messages: LocalMessage[];
  sendMessage: (peer: string, content: string) => Promise<void>;
  startCall: (peer: string, isVideo: boolean) => Promise<void>;
  endCall: () => void;
  syncEngine: null;
  rtcEngine: null;
  activePeer: string;
  setActivePeer: (peer: string) => void;
}

const ChatEngineContext = createContext<ChatEngineContextType>({
  messages: [],
  sendMessage: async () => {},
  startCall: async () => {},
  endCall: () => {},
  syncEngine: null,
  rtcEngine: null,
  activePeer: '',
  setActivePeer: () => {},
});

/**
 * ChatEngineProvider — lightweight context passthrough.
 *
 * IMPORTANT: No heavy imports (idb, ChatSyncEngine, WebRTCEngine, XMTP) here.
 * Those all use browser-only APIs (IndexedDB, PeerJS, WebRTC, WASM) that
 * crash Next.js SSR when imported at module level, causing a blank page.
 * LedgerChat.tsx handles all engine initialization inside useEffect (client-only).
 */
export function ChatEngineProvider({ children }: { children: React.ReactNode }) {
  const [activePeer, setActivePeer] = useState<string>('');

  return (
    <ChatEngineContext.Provider value={{
      messages: [],
      sendMessage: async () => {},
      startCall: async () => {},
      endCall: () => {},
      syncEngine: null,
      rtcEngine: null,
      activePeer,
      setActivePeer,
    }}>
      {children}
    </ChatEngineContext.Provider>
  );
}

export const useChatEngine = () => useContext(ChatEngineContext);