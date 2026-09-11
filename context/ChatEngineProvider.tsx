"use client";
import React, { createContext, useContext, useState } from 'react';
import { ChatSyncEngine } from '@/lib/engine/ChatSyncEngine';
import { WebRTCEngine } from '@/lib/engine/WebRTCEngine';
import { LocalMessage } from '@/lib/sync/chatDatabase';

interface ChatEngineContextType {
  messages: LocalMessage[];
  sendMessage: (peer: string, content: string) => Promise<void>;
  startCall: (peer: string, isVideo: boolean) => Promise<void>;
  endCall: () => void;
  syncEngine: ChatSyncEngine | null;
  rtcEngine: WebRTCEngine | null;
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
 * ChatEngineProvider — lightweight context wrapper.
 *
 * IMPORTANT: XMTP client initialization is intentionally NOT done here.
 * LedgerChat.tsx handles its own XMTP init with the correct wagmi signer
 * (which requires MetaMask interaction). Initializing XMTP here with a
 * plain address string caused an invalid/hung connection attempt that
 * completely froze the page (browser "La pagina no responde").
 */
export function ChatEngineProvider({ children }: { children: React.ReactNode }) {
  const [activePeer, setActivePeer] = useState<string>('');
  const [messages] = useState<LocalMessage[]>([]);

  return (
    <ChatEngineContext.Provider value={{
      messages,
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