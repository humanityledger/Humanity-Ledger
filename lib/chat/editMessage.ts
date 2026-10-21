// lib/chat/editMessage.ts
export interface EditedMessagePayload {
  originalMessageId: string;
  newContent: string;
  editedAt: string;
}
