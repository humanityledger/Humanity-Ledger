import { describe, it, expect } from 'vitest';
import { readFileSync } from 'fs';
import path from 'path';
import { encodePollClose, encodeReaction, encodeReply, encodeUnreact, isPollClosed, plainSnippet, searchPosts, tallyReactions, unwrap, encodeForward } from '@/lib/communities/interactions';
import { buildMediaIndex, encodePoll, isControlMessage, parsePoll } from '@/lib/communities/media-index';
import { medianMs, recordTiming } from '@/lib/perf/client-timings';

const read = (p: string) => readFileSync(path.resolve(__dirname, '../../..', p), 'utf8');
const A = '0x' + 'a'.repeat(40), B = '0x' + 'b'.repeat(40);

describe('Phase 2 interactions', () => {
  it('reactions: one per member per post, toggling and "-" remove, unsafe text ignored', () => {
    const m = (content: string, authorAddress: string) => ({ id: content, content, authorAddress });
    const t = tallyReactions([
      m(encodeReaction('p1', '👍'), A), m(encodeReaction('p1', '❤️'), A), // A changes to ❤️
      m(encodeReaction('p1', '👍'), B), m(encodeReaction('p1', '👍'), B), // B toggles off
      m(encodeReaction('p2', '😂'), B), m(encodeUnreact('p2'), B),
      m(encodeReaction('p3', '<img>'), A),
    ], A);
    expect([...t.get('p1')!.counts]).toEqual([['❤️', 1]]);
    expect(t.get('p1')!.mine).toBe('❤️');
    expect(t.has('p2') || t.has('p3')).toBe(false);
  });
  it('replies and forwards unwrap in either order; snippets never show attachment JSON', () => {
    const r = encodeReply('id1', 'hello __:: world', 'my answer');
    expect(unwrap(r)).toEqual({ body: 'my answer', reply: { id: 'id1', snippet: 'hello world' } });
    expect(unwrap(encodeForward('Team', r)).forwardedFrom).toBe('Team');
    expect(plainSnippet('{"type":"hl.attachment","kind":"image","filename":"a.jpg"}')).toBe('Photo');
    expect(plainSnippet(encodePoll('Lunch?', ['a', 'b'], 'x'))).toBe('Poll: Lunch?');
    // A reply carrying a link is still indexed as a link.
    expect(buildMediaIndex([{ id: '1', content: encodeReply('x', 's', 'see https://aztec.network') }]).links.length).toBe(1);
  });
  it('polls: hide flag round-trips; only the author closes; close is a control message', () => {
    expect(parsePoll(encodePoll('Q', ['a', 'b'], 'p', { hideResults: true }))?.hideResults).toBe(true);
    expect(parsePoll(encodePoll('Q', ['a', 'b'], 'p'))?.hideResults).toBeUndefined();
    const msgs = [{ id: '1', content: encodePollClose('p'), authorAddress: B }];
    expect(isPollClosed(msgs, 'p', A)).toBe(false);
    expect(isPollClosed([{ id: '2', content: encodePollClose('p'), authorAddress: A }], 'p', A)).toBe(true);
    expect(isControlMessage(encodePollClose('p'))).toBe(true);
  });
  it('search runs on the device over text, files and names', () => {
    const posts = [{ id: '1', content: 'Meetup on Friday', authorAddress: A }, { id: '2', content: '{"type":"hl.attachment","kind":"file","filename":"budget.xlsx"}', authorAddress: B }];
    expect(searchPosts(posts, 'friday').map((p) => p.id)).toEqual(['1']);
    expect(searchPosts(posts, 'BUDGET').map((p) => p.id)).toEqual(['2']);
    expect(searchPosts(posts, 'ana', (a) => (a === A ? 'Ana' : undefined)).map((p) => p.id)).toEqual(['1']);
  });
  it('client timings keep a median on the device', () => {
    recordTiming('voice.encrypt+upload', 100); recordTiming('voice.encrypt+upload', 300); recordTiming('voice.encrypt+upload', 200);
    expect(medianMs('voice.encrypt+upload')).toBe(200);
  });
  it('wiring: reader records voice, reacts, replies, forwards and searches through the MLS group only', () => {
    const r = read('components/communities/CommunityReader.tsx');
    expect(r).toMatch(/getUserMedia\(\{ audio/);
    expect(r).toMatch(/isVoiceNote: true, durationSec/);
    expect(r).toMatch(/encodeReply\(replyTo\.id/);
    expect(r).toMatch(/searchPosts\(posts, query, nameFor\)/);
    expect(r).toMatch(/recordTiming\('attachment\.encrypt\+upload'/);
    expect(read('components/terminal/LedgerChatV2.tsx')).toMatch(/onForward=\{\(content\) => setForwardMsg\(/);
  });
});
