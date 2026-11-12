import { describe, expect, it } from 'vitest';
import {
  MEETING_PREFIX,
  buildIcs,
  describeCountdown,
  encodeMeeting,
  meetingPhase,
  meetingPreview,
  normaliseMeeting,
  parseMeeting,
  upcomingMeetings,
  type MeetingInvite,
} from '@/lib/chat/meeting';

const START = Date.UTC(2026, 10, 14, 17, 30); // 14 Nov 2026, 17:30 UTC
const invite: MeetingInvite = { v: 1, id: 'mabc123def', title: 'Weekly sync', startsAt: START, durationMin: 30, kind: 'video' };

describe('scheduled calls: the invitation', () => {
  it('round-trips through the message text', () => {
    const text = encodeMeeting(invite);
    expect(text.startsWith(MEETING_PREFIX)).toBe(true);
    expect(parseMeeting(text)).toEqual(invite);
  });

  it('rejects broken or hostile invitations', () => {
    expect(parseMeeting('hello')).toBeNull();
    expect(parseMeeting(MEETING_PREFIX + '{not json')).toBeNull();
    expect(parseMeeting(MEETING_PREFIX + JSON.stringify({ ...invite, durationMin: 1 }))).toBeNull();
    expect(parseMeeting(MEETING_PREFIX + JSON.stringify({ ...invite, durationMin: 10_000 }))).toBeNull();
    expect(parseMeeting(MEETING_PREFIX + JSON.stringify({ ...invite, kind: 'screen' }))).toBeNull();
    expect(parseMeeting(MEETING_PREFIX + JSON.stringify({ ...invite, title: '   ' }))).toBeNull();
    expect(parseMeeting(MEETING_PREFIX + JSON.stringify({ ...invite, id: '../etc' }))).toBeNull();
    expect(parseMeeting(MEETING_PREFIX + JSON.stringify({ ...invite, startsAt: 1 }))).toBeNull();
    expect(parseMeeting(MEETING_PREFIX + 'x'.repeat(3000))).toBeNull();
  });

  it('cleans titles: control characters, extra space, length', () => {
    const m = normaliseMeeting({ ...invite, title: '  Plan\n\tthe   launch\u0007 ' + 'x'.repeat(200) });
    expect(m?.title.startsWith('Plan the launch')).toBe(true);
    expect(m!.title.length).toBeLessThanOrEqual(80);
  });

  it('opens Join ten minutes before and closes it at the end', () => {
    expect(meetingPhase(invite, START - 11 * 60_000)).toBe('upcoming');
    expect(meetingPhase(invite, START - 9 * 60_000)).toBe('joinable');
    expect(meetingPhase(invite, START + 60_000)).toBe('live');
    expect(meetingPhase(invite, START + 30 * 60_000)).toBe('ended');
    expect(describeCountdown(invite, START - 25 * 60_000)).toBe('In 25 min');
    expect(describeCountdown(invite, START + 1)).toBe('Happening now');
  });

  it('previews as a call, never as raw JSON', () => {
    expect(meetingPreview(invite)).toBe('Video call scheduled: Weekly sync');
  });
});

describe('scheduled calls: calendar file', () => {
  const ics = buildIcs({ ...invite, title: 'Sync; budget, Q4', note: 'Line one\nLine two' }, 'Maya', START - 86_400_000);

  it('is a valid VEVENT in UTC with CRLF line ends', () => {
    expect(ics).toContain('BEGIN:VCALENDAR\r\n');
    expect(ics).toContain('DTSTART:20261114T173000Z');
    expect(ics).toContain('DTEND:20261114T180000Z');
    expect(ics).toContain('UID:mabc123def@ledgerchat.org');
    expect(ics).toContain('TRIGGER:-PT10M');
    expect(ics.endsWith('END:VCALENDAR\r\n')).toBe(true);
  });

  it('escapes text and folds long lines', () => {
    expect(ics).toContain('SUMMARY:Sync\\; budget\\, Q4');
    expect(ics).toContain('Line one\\nLine two');
    for (const line of ics.split('\r\n')) expect(new TextEncoder().encode(line).length).toBeLessThanOrEqual(75);
  });
});

describe('scheduled calls: upcoming list', () => {
  it('keeps calls that have not ended, soonest first', () => {
    const later = { ...invite, id: 'mlater0001', startsAt: START + 86_400_000 };
    const done = { ...invite, id: 'mdone00001', startsAt: START - 86_400_000 };
    const list = [later, invite, done].map((i) => ({ invite: i, peer: '0x' + 'a'.repeat(40), fromMe: true }));
    expect(upcomingMeetings(list, START - 60_000).map((x) => x.invite.id)).toEqual(['mabc123def', 'mlater0001']);
  });
});
