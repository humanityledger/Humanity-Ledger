// lib/chat/store.ts
export interface ChatState {
  activePeer: string | null;
  messages: Record<string, any[]>;
  unreadCounts: Record<string, number>;
}
