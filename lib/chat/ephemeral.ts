// lib/chat/ephemeral.ts
export interface DisappearingMessageConfig {
  timerSeconds: number; // 30s, 5m, 1h, 24h
  enabled: boolean;
}
