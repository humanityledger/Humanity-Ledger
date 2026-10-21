// lib/chat/readReceipts.ts
export interface ReadReceipt {
  messageId: string;
  readAt: string;
  readerAddress: string;
}

export function encodeReadReceipt(receipt: ReadReceipt): string {
  return JSON.stringify({ type: 'read-receipt', ...receipt });
}
