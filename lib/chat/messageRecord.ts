/**
 * One shape for every chat message, whatever its source (live stream,
 * history, local store, optimistic send, server fallback). Every field is
 * created in the same order with a primitive default, never omitted or
 * deleted, so V8 and JavaScriptCore keep one hidden class/structure for all
 * messages and the hot loops (filter, sort, render) stay monomorphic.
 * Fields this factory does not know are appended after the fixed ones.
 */
export interface ChatMessageRecord {
  id: string;
  conversationId: string;
  senderAddress: string;
  senderInboxId: string;
  content: string;
  sentAtNs: number;
  status: string;
  isMe: boolean;
  burnAtNs: number | undefined;
  [extra: string]: unknown;
}

const FIXED = new Set(['id', 'conversationId', 'senderAddress', 'senderInboxId', 'content', 'sentAtNs', 'status', 'isMe', 'burnAtNs']);

export function createChatMessageRecord(input: Record<string, unknown>): ChatMessageRecord {
  const rec: ChatMessageRecord = {
    id: String(input.id ?? ''),
    conversationId: String(input.conversationId ?? ''),
    senderAddress: String(input.senderAddress ?? ''),
    senderInboxId: String(input.senderInboxId ?? ''),
    content: typeof input.content === 'string' ? input.content : String(input.content ?? ''),
    sentAtNs: typeof input.sentAtNs === 'number' && Number.isFinite(input.sentAtNs) ? input.sentAtNs : Number(input.sentAtNs) || 0,
    status: String(input.status ?? 'delivered'),
    isMe: !!input.isMe,
    burnAtNs: typeof input.burnAtNs === 'number' ? input.burnAtNs : undefined,
  };
  for (const k in input) if (!FIXED.has(k)) rec[k] = input[k];
  return rec;
}
