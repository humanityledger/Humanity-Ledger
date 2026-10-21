// lib/realtime/pubsub.ts
// Redis pub/sub broker for multi-replica SSE distribution
export interface RealtimeMessage {
  channel: string;
  payload: any;
  timestamp: number;
}
