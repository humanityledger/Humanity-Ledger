// lib/chat/reactions.ts
export interface ReactionPayload {
  referenceMessageId: string;
  action: 'added' | 'removed';
  content: string; // emoji
  schema: 'unicode';
}
