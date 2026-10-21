// lib/chat/scheduled.ts
export interface ScheduledMessage {
  id: string;
  recipientAddress: string;
  content: string;
  deliverAt: number;
}
