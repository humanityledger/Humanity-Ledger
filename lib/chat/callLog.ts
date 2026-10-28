/**
 * lib/chat/callLog.ts
 *
 * Turns the call signals already sent through a conversation into call-log
 * entries, the "Missed voice call" / "Outgoing video call · 2:31" lines both
 * people see in the chat.
 *
 * No new messages are needed: __CALL_OFFER__, __CALL_ANSWER__, __CALL_HANGUP__
 * and __CALL_DECLINE__ already travel over the same end-to-end encrypted XMTP
 * conversation, so both sides (and every device of each side) hold the same
 * signals and derive the same log, including for calls made before this
 * existed. The chat used to drop those signals and show nothing.
 *
 * Pure and deterministic given `now`, so it is unit-tested.
 */

export type CallKind = 'audio' | 'video';
export type CallStatus = 'ringing' | 'ongoing' | 'answered' | 'missed' | 'declined';

export interface CallSignal {
  id: string;
  content: string;
  /** Milliseconds since epoch. */
  sentAtMs: number;
  /** True when sent by this account (from any of its devices). */
  fromMe: boolean;
  senderInboxId?: string;
}

export interface CallEntry {
  /** Stable id: the offer's message id, so updates replace the same bubble. */
  id: string;
  callerIsMe: boolean;
  callerInboxId?: string;
  kind: CallKind;
  status: CallStatus;
  startedAtMs: number;
  answeredAtMs?: number;
  endedAtMs?: number;
  durationSec?: number;
}

export const CALL_LOG_PREFIX = '__CALL_LOG__';
/** An unanswered offer older than this counts as missed (callers give up at 45 s). */
export const RING_TIMEOUT_MS = 60_000;
/** An answered call with no hang-up older than this is treated as finished. */
const ONGOING_LIMIT_MS = 4 * 60 * 60 * 1000;

export function isCallSignal(content: unknown): content is string {
  return typeof content === 'string' && content.startsWith('__CALL_') && !content.startsWith(CALL_LOG_PREFIX);
}

function kindOf(offer: string): CallKind {
  return /:video\s*$/.test(offer) ? 'video' : 'audio';
}

/**
 * Build the call log from a conversation's signals. Signals may come in any
 * order and may repeat (stream + history); they are sorted and de-duplicated.
 */
export function deriveCallLog(signals: CallSignal[], now = Date.now()): CallEntry[] {
  const seen = new Set<string>();
  const sorted = signals
    .filter(s => isCallSignal(s.content) && !seen.has(s.id) && (seen.add(s.id), true))
    .sort((a, b) => a.sentAtMs - b.sentAtMs || a.id.localeCompare(b.id));

  const entries: CallEntry[] = [];
  let open: CallEntry | null = null;

  const close = (e: CallEntry) => {
    if (e.status === 'ringing' || e.status === 'ongoing') {
      // Re-judge with the clock: a session that never got its end signal.
      if (e.answeredAtMs != null) {
        e.status = now - e.answeredAtMs < ONGOING_LIMIT_MS ? 'ongoing' : 'answered';
      } else {
        e.status = now - e.startedAtMs < RING_TIMEOUT_MS ? 'ringing' : 'missed';
      }
    }
    entries.push(e);
  };

  for (const s of sorted) {
    const c = s.content;
    if (c.startsWith('__CALL_OFFER__')) {
      if (open) close(open);
      open = {
        id: s.id,
        callerIsMe: s.fromMe,
        callerInboxId: s.senderInboxId,
        kind: kindOf(c),
        status: 'ringing',
        startedAtMs: s.sentAtMs,
      };
      continue;
    }
    if (!open) continue; // a signal with no call to belong to

    if (c.startsWith('__CALL_ANSWER__')) {
      // Only the callee answers; the first answer wins (another device may answer too).
      if (s.fromMe !== open.callerIsMe && open.answeredAtMs == null && open.status === 'ringing') {
        open.answeredAtMs = s.sentAtMs;
        open.status = 'ongoing';
      }
    } else if (c === '__CALL_DECLINE__') {
      if (open.answeredAtMs == null) {
        open.status = 'declined';
        open.endedAtMs = s.sentAtMs;
        entries.push(open);
        open = null;
      }
    } else if (c === '__CALL_HANGUP__') {
      open.endedAtMs = s.sentAtMs;
      if (open.answeredAtMs != null) {
        open.status = 'answered';
        open.durationSec = Math.max(0, Math.round((s.sentAtMs - open.answeredAtMs) / 1000));
      } else {
        open.status = 'missed';
      }
      entries.push(open);
      open = null;
    }
  }
  if (open) close(open);
  return entries;
}

export function encodeCallEntry(e: CallEntry): string {
  return CALL_LOG_PREFIX + JSON.stringify(e);
}

export function decodeCallEntry(content: unknown): CallEntry | null {
  if (typeof content !== 'string' || !content.startsWith(CALL_LOG_PREFIX)) return null;
  try {
    const e = JSON.parse(content.slice(CALL_LOG_PREFIX.length));
    return e && typeof e.id === 'string' ? (e as CallEntry) : null;
  } catch {
    return null;
  }
}

export function formatDuration(sec: number): string {
  const h = Math.floor(sec / 3600);
  const m = Math.floor((sec % 3600) / 60);
  const s = sec % 60;
  return h > 0 ? `${h}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}` : `${m}:${String(s).padStart(2, '0')}`;
}

/** The line shown in the chat and in the conversation list. */
export function callEntryLabel(e: CallEntry): string {
  const what = e.kind === 'video' ? 'video call' : 'voice call';
  switch (e.status) {
    case 'ringing': return e.callerIsMe ? 'Calling…' : `Incoming ${what}…`;
    case 'ongoing': return 'Call in progress';
    case 'declined': return e.callerIsMe ? `${capital(what)} declined` : `Declined ${what}`;
    case 'missed': return e.callerIsMe ? `${capital(what)}, no answer` : `Missed ${what}`;
    case 'answered': return `${e.callerIsMe ? 'Outgoing' : 'Incoming'} ${what}`;
  }
}

function capital(s: string) { return s.charAt(0).toUpperCase() + s.slice(1); }

/** Chat messages for a conversation's call log, ready to merge by id. */
export function callLogMessages(
  entries: CallEntry[],
  opts: { conversationId: string; selfInboxId: string; peerInboxId?: string },
) {
  return entries.map(e => ({
    id: `call-${e.id}`,
    senderInboxId: e.callerIsMe ? opts.selfInboxId : (e.callerInboxId || opts.peerInboxId || 'peer'),
    content: encodeCallEntry(e),
    sentAtNs: e.startedAtMs, // milliseconds, like every message in the chat
    conversationId: opts.conversationId,
    isCallLog: true,
  }));
}
