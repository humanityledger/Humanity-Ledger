/**
 * lib/chat/meeting.ts — scheduled calls.
 *
 * A scheduled call is an ordinary end to end encrypted message in the chat:
 * a short JSON invitation after a fixed prefix. Both people see it as a card
 * with the time in their own time zone, a button to add it to their calendar
 * (an .ics file made on the device) and, from ten minutes before the start
 * until the end, a button to join, which starts a normal Ledger Chat call.
 *
 * Nothing about the meeting is stored on a server. Each device keeps its own
 * list of upcoming calls, built from the invitations it has sent or seen, so
 * the Calls tab can show them and remind the user when one starts.
 */

export const MEETING_PREFIX = '__MEETING__::';
export const MEETING_JOIN_EVENT = 'ledger:join-meeting';
export const MEETINGS_EVENT = 'ledger_meetings_updated';

/** How early the Join button lights up. */
export const JOIN_EARLY_MS = 10 * 60 * 1000;
export const MIN_DURATION_MIN = 5;
export const MAX_DURATION_MIN = 8 * 60;
export const MAX_TITLE = 80;
export const MAX_NOTE = 280;

export type MeetingKind = 'voice' | 'video';

export interface MeetingInvite {
  v: 1;
  id: string;
  title: string;
  /** Start, ms since the epoch (UTC). */
  startsAt: number;
  durationMin: number;
  kind: MeetingKind;
  note?: string;
}

export type MeetingPhase = 'upcoming' | 'joinable' | 'live' | 'ended';

const clean = (s: unknown, max: number) =>
  typeof s === 'string'
    ? Array.from(s, (c) => (c.charCodeAt(0) < 32 || c.charCodeAt(0) === 127 ? ' ' : c))
        .join('')
        .replace(/\s+/g, ' ')
        .trim()
        .slice(0, max)
    : '';

export function newMeetingId(now = Date.now()): string {
  const rnd =
    typeof crypto !== 'undefined' && typeof crypto.getRandomValues === 'function'
      ? Array.from(crypto.getRandomValues(new Uint8Array(6)), (b) => b.toString(16).padStart(2, '0')).join('')
      : Math.random().toString(16).slice(2, 14);
  return `m${now.toString(36)}${rnd}`;
}

/** Validates and normalises an invitation; null when it is not usable. */
export function normaliseMeeting(input: unknown): MeetingInvite | null {
  if (!input || typeof input !== 'object') return null;
  const m = input as Record<string, unknown>;
  const title = clean(m.title, MAX_TITLE);
  const note = clean(m.note, MAX_NOTE);
  const startsAt = typeof m.startsAt === 'number' ? Math.round(m.startsAt) : NaN;
  const durationMin = typeof m.durationMin === 'number' ? Math.round(m.durationMin) : NaN;
  const kind = m.kind === 'video' ? 'video' : m.kind === 'voice' ? 'voice' : null;
  const id = typeof m.id === 'string' && /^[a-z0-9]{6,40}$/i.test(m.id) ? m.id : null;
  if (!id || !title || !kind) return null;
  // Years 2000 to 2200: anything else is a broken or hostile value.
  if (!Number.isFinite(startsAt) || startsAt < 946_684_800_000 || startsAt > 7_258_118_400_000) return null;
  if (!Number.isFinite(durationMin) || durationMin < MIN_DURATION_MIN || durationMin > MAX_DURATION_MIN) return null;
  return { v: 1, id, title, startsAt, durationMin, kind, ...(note ? { note } : {}) };
}

export function encodeMeeting(invite: MeetingInvite): string {
  const m = normaliseMeeting(invite);
  if (!m) throw new Error('Invalid meeting');
  return MEETING_PREFIX + JSON.stringify(m);
}

export function parseMeeting(content: unknown): MeetingInvite | null {
  if (typeof content !== 'string' || !content.startsWith(MEETING_PREFIX)) return null;
  if (content.length > 2000) return null;
  try {
    return normaliseMeeting(JSON.parse(content.slice(MEETING_PREFIX.length)));
  } catch {
    return null;
  }
}

export const isMeetingMessage = (content: unknown): boolean => parseMeeting(content) !== null;

export function meetingEndsAt(m: MeetingInvite): number {
  return m.startsAt + m.durationMin * 60_000;
}

export function meetingPhase(m: MeetingInvite, now = Date.now()): MeetingPhase {
  if (now >= meetingEndsAt(m)) return 'ended';
  if (now >= m.startsAt) return 'live';
  if (now >= m.startsAt - JOIN_EARLY_MS) return 'joinable';
  return 'upcoming';
}

export function meetingPreview(m: MeetingInvite): string {
  return `${m.kind === 'video' ? 'Video' : 'Voice'} call scheduled: ${m.title}`;
}

/** "Fri 14 Nov, 18:30 to 19:00" in the reader's own time zone. */
export function describeMeetingTime(m: MeetingInvite, locale?: string): string {
  const s = new Date(m.startsAt);
  const e = new Date(meetingEndsAt(m));
  const day = s.toLocaleDateString(locale, { weekday: 'short', day: 'numeric', month: 'short' });
  const t = (d: Date) => d.toLocaleTimeString(locale, { hour: '2-digit', minute: '2-digit' });
  return `${day}, ${t(s)} to ${t(e)}`;
}

/** Human countdown: "in 25 min", "in 3 h", "in 2 days", "now", "ended". */
export function describeCountdown(m: MeetingInvite, now = Date.now()): string {
  const phase = meetingPhase(m, now);
  if (phase === 'ended') return 'Ended';
  if (phase === 'live') return 'Happening now';
  const mins = Math.max(1, Math.round((m.startsAt - now) / 60_000));
  if (mins < 60) return `In ${mins} min`;
  const hours = Math.round(mins / 60);
  if (hours < 48) return `In ${hours} h`;
  return `In ${Math.round(hours / 24)} days`;
}

/* ── Calendar file ─────────────────────────────────────────────────────── */

const icsDate = (t: number) => new Date(t).toISOString().replace(/[-:]/g, '').replace(/\.\d{3}/, '');
const icsText = (s: string) => s.replace(/\\/g, '\\\\').replace(/;/g, '\\;').replace(/,/g, '\\,').replace(/\r?\n/g, '\\n');

/** Folds a content line at 75 octets, as RFC 5545 asks. */
function fold(line: string): string {
  const out: string[] = [];
  let rest = line;
  while (new TextEncoder().encode(rest).length > 75) {
    let cut = 75;
    while (new TextEncoder().encode(rest.slice(0, cut)).length > 75) cut--;
    out.push(rest.slice(0, cut));
    rest = ' ' + rest.slice(cut);
  }
  out.push(rest);
  return out.join('\r\n');
}

export function buildIcs(m: MeetingInvite, withName?: string, now = Date.now()): string {
  const who = withName ? ` with ${withName}` : '';
  const lines = [
    'BEGIN:VCALENDAR',
    'VERSION:2.0',
    'PRODID:-//Humanity Ledger//Ledger Chat//EN',
    'CALSCALE:GREGORIAN',
    'METHOD:PUBLISH',
    'BEGIN:VEVENT',
    `UID:${m.id}@ledgerchat.org`,
    `DTSTAMP:${icsDate(now)}`,
    `DTSTART:${icsDate(m.startsAt)}`,
    `DTEND:${icsDate(meetingEndsAt(m))}`,
    `SUMMARY:${icsText(m.title)}`,
    `DESCRIPTION:${icsText(
      `Ledger Chat ${m.kind} call${who}. Open Ledger Chat and press Join in the conversation.${m.note ? `\n\n${m.note}` : ''}`,
    )}`,
    'LOCATION:Ledger Chat',
    'URL:https://ledgerchat.org/chat',
    'BEGIN:VALARM',
    'ACTION:DISPLAY',
    `DESCRIPTION:${icsText(m.title)}`,
    'TRIGGER:-PT10M',
    'END:VALARM',
    'END:VEVENT',
    'END:VCALENDAR',
  ];
  return lines.map(fold).join('\r\n') + '\r\n';
}

/* ── This device's list of upcoming calls ──────────────────────────────── */

export interface StoredMeeting {
  invite: MeetingInvite;
  /** Lower-case address of the other person. */
  peer: string;
  fromMe: boolean;
}

const storeKey = (owner: string) => `ledger_meetings_${owner.toLowerCase()}`;

export function loadMeetings(owner: string | null | undefined): StoredMeeting[] {
  if (!owner || typeof localStorage === 'undefined') return [];
  try {
    const raw = JSON.parse(localStorage.getItem(storeKey(owner)) || '[]');
    if (!Array.isArray(raw)) return [];
    const out: StoredMeeting[] = [];
    for (const r of raw) {
      const invite = normaliseMeeting(r?.invite);
      if (invite && typeof r.peer === 'string' && /^0x[0-9a-f]{40}$/.test(r.peer)) out.push({ invite, peer: r.peer, fromMe: !!r.fromMe });
    }
    return out;
  } catch {
    return [];
  }
}

/** Adds or updates a call; forgets calls that ended more than a day ago. Returns true when the list changed. */
export function rememberMeeting(owner: string, peer: string, invite: MeetingInvite, fromMe: boolean, now = Date.now()): boolean {
  const list = loadMeetings(owner);
  const p = peer.toLowerCase();
  const existing = list.find((x) => x.invite.id === invite.id && x.peer === p);
  const fresh = list.filter((x) => meetingEndsAt(x.invite) > now - 86_400_000);
  if (existing && fresh.length === list.length) return false;
  const next = existing ? fresh : [...fresh, { invite, peer: p, fromMe }];
  try {
    localStorage.setItem(storeKey(owner), JSON.stringify(next));
  } catch {
    return false;
  }
  if (typeof window !== 'undefined') window.dispatchEvent(new CustomEvent(MEETINGS_EVENT, { detail: { owner: owner.toLowerCase() } }));
  return true;
}

export function forgetMeeting(owner: string, id: string) {
  const next = loadMeetings(owner).filter((x) => x.invite.id !== id);
  try {
    localStorage.setItem(storeKey(owner), JSON.stringify(next));
  } catch {
    /* ignore */
  }
  if (typeof window !== 'undefined') window.dispatchEvent(new CustomEvent(MEETINGS_EVENT, { detail: { owner: owner.toLowerCase() } }));
}

/** Calls that have not ended yet, soonest first. */
export function upcomingMeetings(list: StoredMeeting[], now = Date.now()): StoredMeeting[] {
  return list.filter((x) => meetingPhase(x.invite, now) !== 'ended').sort((a, b) => a.invite.startsAt - b.invite.startsAt);
}
