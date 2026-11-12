/**
 * lib/chat/scheduled.ts — messages written now and sent later.
 *
 * A scheduled message is stored on this device with the chat it belongs to,
 * and sent from this device when its time comes. It used to be a bare
 * setTimeout that sent to whichever chat was open at that moment (so it could
 * reach the wrong person) and vanished on reload.
 *
 * Messages are end to end encrypted on the device, so no server can send them
 * on the user's behalf: if Ledger Chat is closed at the chosen time, the
 * message goes the next time it is opened. The interface says so.
 */

export interface ScheduledMessage {
  id: string;
  /** Lower-case Ethereum address of the chat it belongs to. */
  peer: string;
  /** Final message text, wrappers included, exactly as it will be sent. */
  content: string;
  /** When to send, ms since the epoch. */
  sendAt: number;
  createdAt: number;
  /** Failed send attempts so far. */
  attempts?: number;
}

/** Furthest ahead a message may be scheduled. */
export const MAX_SCHEDULE_AHEAD_MS = 366 * 24 * 60 * 60 * 1000;
/** Nearest: a minute, so "now" is never a schedule. */
export const MIN_SCHEDULE_AHEAD_MS = 60 * 1000;

export const SCHEDULED_EVENT = 'ledger_scheduled_updated';

const storageKey = (owner: string) => `ledger_scheduled_${owner.toLowerCase()}`;

function isScheduled(x: unknown): x is ScheduledMessage {
  if (!x || typeof x !== 'object') return false;
  const m = x as Record<string, unknown>;
  return (
    typeof m.id === 'string' &&
    typeof m.peer === 'string' &&
    /^0x[0-9a-f]{40}$/.test(m.peer) &&
    typeof m.content === 'string' &&
    m.content.length > 0 &&
    typeof m.sendAt === 'number' &&
    Number.isFinite(m.sendAt) &&
    typeof m.createdAt === 'number'
  );
}

/** Why a time cannot be used, or null when it can. */
export function scheduleTimeError(sendAt: number, now = Date.now()): string | null {
  if (!Number.isFinite(sendAt)) return 'Choose a date and time.';
  if (sendAt < now + MIN_SCHEDULE_AHEAD_MS) return 'Choose a time at least a minute from now.';
  if (sendAt > now + MAX_SCHEDULE_AHEAD_MS) return 'Choose a time within the next year.';
  return null;
}

export function loadScheduled(owner: string | null | undefined): ScheduledMessage[] {
  if (!owner || typeof localStorage === 'undefined') return [];
  try {
    const raw = JSON.parse(localStorage.getItem(storageKey(owner)) || '[]');
    return Array.isArray(raw) ? raw.filter(isScheduled).sort((a, b) => a.sendAt - b.sendAt) : [];
  } catch {
    return [];
  }
}

function save(owner: string, list: ScheduledMessage[]) {
  try {
    if (list.length) localStorage.setItem(storageKey(owner), JSON.stringify(list));
    else localStorage.removeItem(storageKey(owner));
  } catch {
    /* storage full or blocked: the list still lives in memory for this session */
  }
  if (typeof window !== 'undefined') {
    window.dispatchEvent(new CustomEvent(SCHEDULED_EVENT, { detail: { owner: owner.toLowerCase(), list } }));
  }
}

export function addScheduled(
  owner: string,
  input: { peer: string; content: string; sendAt: number },
  now = Date.now(),
): ScheduledMessage[] {
  const item: ScheduledMessage = {
    id: `sched_${now.toString(36)}_${Math.random().toString(36).slice(2, 8)}`,
    peer: input.peer.toLowerCase(),
    content: input.content,
    sendAt: input.sendAt,
    createdAt: now,
  };
  if (!isScheduled(item)) throw new Error('Invalid scheduled message');
  const list = [...loadScheduled(owner), item].sort((a, b) => a.sendAt - b.sendAt);
  save(owner, list);
  return list;
}

export function removeScheduled(owner: string, id: string): ScheduledMessage[] {
  const list = loadScheduled(owner).filter((m) => m.id !== id);
  save(owner, list);
  return list;
}

export function markAttempt(owner: string, id: string): ScheduledMessage[] {
  const list = loadScheduled(owner).map((m) => (m.id === id ? { ...m, attempts: (m.attempts ?? 0) + 1 } : m));
  save(owner, list);
  return list;
}

/** Messages whose time has come, oldest first. */
export function dueScheduled(list: ScheduledMessage[], now = Date.now()): ScheduledMessage[] {
  return list.filter((m) => m.sendAt <= now).sort((a, b) => a.sendAt - b.sendAt);
}

export function scheduledForPeer(list: ScheduledMessage[], peer: string | null | undefined): ScheduledMessage[] {
  if (!peer) return [];
  const p = peer.toLowerCase();
  return list.filter((m) => m.peer === p);
}

/** "Today at 18:30", "Tomorrow at 09:00" or "Fri 14 Nov at 09:00", in the reader's locale. */
export function describeSendTime(sendAt: number, now = Date.now(), locale?: string): string {
  const d = new Date(sendAt);
  const time = d.toLocaleTimeString(locale, { hour: '2-digit', minute: '2-digit' });
  const startOf = (t: number) => {
    const x = new Date(t);
    x.setHours(0, 0, 0, 0);
    return x.getTime();
  };
  const days = Math.round((startOf(sendAt) - startOf(now)) / 86_400_000);
  if (days === 0) return `Today at ${time}`;
  if (days === 1) return `Tomorrow at ${time}`;
  const date = d.toLocaleDateString(locale, { weekday: 'short', day: 'numeric', month: 'short', ...(d.getFullYear() !== new Date(now).getFullYear() ? { year: 'numeric' } : {}) });
  return `${date} at ${time}`;
}
