// lib/chat/forward.ts
export interface ForwardedMessageMarker {
  isForwarded: true;
  originalAuthor?: string;
}
