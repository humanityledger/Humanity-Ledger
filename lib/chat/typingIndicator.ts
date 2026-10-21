// lib/chat/typingIndicator.ts
export interface TypingSignal {
  senderAddress: string;
  isTyping: boolean;
  expiresAt: number;
}
