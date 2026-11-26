/**
 * Default disappearing timer for new messages (Settings → Privacy). A chat's
 * own timer wins over it. One list for the picker, the schema check and the
 * sender, so every option offered is also enforced.
 */
export const AUTO_DELETE_OPTIONS = ['off', '1 hour', '24 hours', '1 week', '1 month', '1 year'] as const;
export type AutoDeleteTimer = typeof AUTO_DELETE_OPTIONS[number];

const SECONDS: Record<string, number> = {
  '1 hour': 3_600, '24 hours': 86_400, '1 week': 604_800, '1 month': 2_592_000, '1 year': 31_536_000,
  // per-chat timer values (lib/sync/lww.ts DISAPPEARING)
  '5s': 5, '10s': 10, '30s': 30, '1m': 60, '5m': 300, '1h': 3_600, '24h': 86_400, '7d': 604_800, '90d': 7_776_000,
  '1 day': 86_400,
};

export function timerSeconds(v: unknown): number {
  return typeof v === 'string' ? SECONDS[v] ?? 0 : 0;
}

/** The burn seconds for a new message: the chat's own timer, else the global default. */
export function sendBurnSeconds(chatTimer: unknown, globalTimer: unknown): number {
  const chat = timerSeconds(chatTimer);
  return chat > 0 ? chat : timerSeconds(globalTimer);
}

export function isAutoDeleteTimer(v: unknown): v is AutoDeleteTimer {
  return typeof v === 'string' && (AUTO_DELETE_OPTIONS as readonly string[]).includes(v);
}
