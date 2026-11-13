/**
 * lib/chat/optimistic-send.ts
 *
 * A sent message shows in the chat at once, with what is really happening to it:
 *
 *   sending  → shown the moment Send is tapped (same tick, no network wait), clock icon
 *   sent     → XMTP returned the message id (lib/xmtp/client.ts sendMessage), one tick
 *   failed   → "Not sent"
 *
 * The composer is never blocked while a message is on its way: sends go through one queue, in
 * the order they were typed, so a second message does not wait for the first to be confirmed
 * before it appears, and never overtakes it on the network. Nothing here changes what is sent or
 * how (MLS and the XMTP SDK are untouched); it only decides what the chat shows meanwhile.
 */

export type SendStatus = 'sending' | 'sent' | 'delivered' | 'read' | 'scheduled';

export interface OptimisticMessage {
  id: string;
  senderInboxId: string;
  content: string;
  burnAtNs?: number;
  sentAtNs: number;
  conversationId: string;
  status: SendStatus;
  failed?: boolean;
  error?: string;
}

let seq = 0;

/** Unique even for two messages sent in the same millisecond. */
export function newOptimisticId(now = Date.now()): string {
  seq = (seq + 1) % 1_000_000;
  return `optimistic-${now}-${seq}`;
}

export function isOptimisticId(id: unknown): boolean {
  return typeof id === 'string' && id.startsWith('optimistic-');
}

export function optimisticMessage(input: Omit<OptimisticMessage, 'status' | 'sentAtNs'> & { sentAtNs?: number }): OptimisticMessage {
  return { ...input, sentAtNs: input.sentAtNs ?? Date.now(), status: 'sending' };
}

/** Appends without re-sorting the whole list: a new message is almost always the newest. */
export function insertOptimistic<T extends { sentAtNs: number }>(prev: T[], msg: T): T[] {
  const last = prev[prev.length - 1];
  if (!last || last.sentAtNs <= msg.sentAtNs) return [...prev, msg];
  return [...prev, msg].sort((a, b) => a.sentAtNs - b.sentAtNs);
}

/**
 * The network accepted the message: the optimistic copy takes its real id and turns "sent".
 * If the stream already delivered the real message, the copy is dropped instead (no duplicate).
 */
export function confirmOptimistic<T extends { id: string; status?: string }>(prev: T[], optimisticId: string, realId: string): T[] {
  if (prev.some((m) => m.id === realId)) return prev.filter((m) => m.id !== optimisticId);
  return prev.map((m) => (m.id === optimisticId ? { ...m, id: realId, status: m.status && m.status !== 'sending' ? m.status : 'sent' } : m));
}

export function failOptimistic<T extends { id: string }>(prev: T[], optimisticId: string, error: string): T[] {
  return prev.map((m) => (m.id === optimisticId ? { ...m, failed: true, error } : m));
}

/** What the tick next to one of our messages means, for screen readers and its tooltip. */
export function sendStatusLabel(status: string | undefined, opts: { failed?: boolean; readReceipts?: boolean } = {}): string {
  if (opts.failed) return 'Not sent';
  if (status === 'sending') return 'Sending';
  if (status === 'scheduled') return 'Scheduled';
  if (status === 'read' && opts.readReceipts !== false) return 'Read';
  if (status === 'delivered') return 'Delivered';
  return 'Sent';
}

/**
 * Runs sends one after the other, in the order they were queued. A failed send does not stop
 * the ones behind it. Returns the task's own result (or its error) to the caller.
 */
export function createSendQueue() {
  let tail: Promise<unknown> = Promise.resolve();
  let pending = 0;
  return {
    run<T>(task: () => Promise<T>): Promise<T> {
      pending++;
      const result = tail.then(task, task);
      tail = result.then(
        () => { pending--; },
        () => { pending--; },
      );
      return result;
    },
    get pending() {
      return pending;
    },
  };
}
