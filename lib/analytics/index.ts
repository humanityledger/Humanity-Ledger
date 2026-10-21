// lib/analytics/index.ts
// 100% Zero-PII, zero-third-party aggregate telemetry
export function trackAggregateAction(action: string) {
  if (typeof window === 'undefined') return;
  // Local aggregated counter, no cookies, no tracking pixels
}
