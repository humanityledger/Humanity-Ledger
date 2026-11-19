/**
 * Delivery diagnostics, local to the browser (19 November 2026: messages between two wallets did
 * not arrive and nothing showed where they stopped).
 *
 * Every step of the path a direct message takes (client ready, stream open or closed, each
 * message received, where it went or why it was dropped, each send) is one event in a ring of the
 * last 300, printed to the console as `[XMTP] <kind> {...}` and readable at
 * `window.__hlDelivery.dump()` or on /chat?debug=delivery. Never the content of a message, never a
 * full address or inbox id: ids are shortened to 6 + 4 characters.
 */
export type DiagDetail = Record<string, string | number | boolean | null | undefined>;
export interface DiagEvent { t: number; kind: string; detail?: DiagDetail }

const MAX = 300;
const ring: DiagEvent[] = [];
const listeners = new Set<() => void>();

/** First 6 and last 4 characters: enough to tell two ids apart, not enough to identify anyone. */
export function short(id: unknown): string {
  const s = typeof id === 'string' ? id : id == null ? '' : String(id);
  return s.length > 12 ? `${s.slice(0, 6)}…${s.slice(-4)}` : s;
}

export function diag(kind: string, detail?: DiagDetail): void {
  ring.push({ t: Date.now(), kind, detail });
  if (ring.length > MAX) ring.shift();
  try { console.info('[XMTP]', kind, detail ?? ''); } catch { /* console unavailable */ }
  for (const f of listeners) { try { f(); } catch { /* a listener must not break delivery */ } }
}

export function diagEvents(): DiagEvent[] { return ring.slice(); }

export function onDiag(f: () => void): () => void {
  listeners.add(f);
  return () => { listeners.delete(f); };
}

/** The events as plain text, one per line, to paste into a report. */
export function diagText(): string {
  return ring
    .map((e) => `${new Date(e.t).toISOString().slice(11, 23)} ${e.kind} ${e.detail ? JSON.stringify(e.detail) : ''}`)
    .join('\n');
}

if (typeof window !== 'undefined') {
  (window as unknown as { __hlDelivery?: unknown }).__hlDelivery = { events: diagEvents, dump: diagText };
}
