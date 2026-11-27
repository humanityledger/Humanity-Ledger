import { describe, it, expect } from 'vitest';
import { readFileSync } from 'fs';
import path from 'path';
import { buildMediaIndex, classifyPost, encodePoll, encodeVote, isControlMessage, parsePoll, searchMedia, tallyVotes } from '@/lib/communities/media-index';
import { assignableRoles, can, canActOn, roleOf } from '@/lib/communities/roles';
import { encodeAttachmentMessage } from '@/lib/chat/remote-attachment';
import { glyphSeedForName, waitForClient } from '@/components/communities/CreateCommunitySheet';

const root = path.resolve(__dirname, '../../..');
const read = (p: string) => readFileSync(path.join(root, p), 'utf8');
const H = (n: number) => 'ab'.repeat(n);
const att = (kind: 'image' | 'video' | 'audio' | 'file', filename: string, extra: Record<string, unknown> = {}) => encodeAttachmentMessage({
  kind, url: `/api/chat/attachments/${'c'.repeat(32)}`, contentDigest: H(32), secret: H(32), salt: H(32), nonce: H(12), contentLength: 2048, mimeType: kind === 'file' ? 'application/pdf' : `${kind}/x`, filename, ...extra,
} as any);
const A = '0x' + 'a'.repeat(40), B = '0x' + 'b'.repeat(40), C = '0x' + 'c'.repeat(40), D = '0x' + 'd'.repeat(40);

describe('Shared Media index (built on the device)', () => {
  it('sorts every message format into its tab', () => {
    const posts = [
      { id: '1', content: att('image', 'beach.jpg'), createdAt: 1 },
      { id: '2', content: att('video', 'clip.mp4'), createdAt: 2 },
      { id: '3', content: att('file', 'deck.pdf'), createdAt: 3 },
      { id: '4', content: att('audio', 'voice-note.webm', { durationSec: 4 }), createdAt: 4 },
      { id: '5', content: att('audio', 'song.mp3'), createdAt: 5 },
      { id: '6', content: '[GIF]https://media.example/x.gif', createdAt: 6 },
      { id: '7', content: encodePoll('Lunch?', ['Pizza', 'Sushi'], 'p1'), createdAt: 7 },
      { id: '8', content: 'read https://aztec.network/docs and https://github.com/x. ok', createdAt: 8 },
      { id: '9', content: encodeVote('p1', 1), createdAt: 9 },
      { id: '10', content: '[GIF]javascript:alert(1)', createdAt: 10 },
    ];
    const idx = buildMediaIndex(posts);
    expect(idx.media.map((x) => x.id)).toEqual(['2', '1']); // newest first
    expect(idx.files.map((x) => x.id)).toEqual(['3']);
    expect(idx.voice.map((x) => x.id)).toEqual(['4']);
    expect(idx.music.map((x) => x.id)).toEqual(['5']);
    expect(idx.gifs.map((x) => x.id)).toEqual(['6']);
    expect(idx.polls.map((x) => x.id)).toEqual(['7']);
    expect(idx.links.map((x: any) => x.host)).toEqual(['aztec.network', 'github.com']);
    expect(searchMedia(idx.links, 'github').length).toBe(1);
    expect(searchMedia(idx.files, 'DECK').length).toBe(1);
    expect(classifyPost({ id: 'x', content: '__REACT__abc' })).toEqual([]);
  });

  it('polls: strict parse, one vote per member (their last), unknown options ignored', () => {
    expect(parsePoll(encodePoll('Q', ['a']))).toBeNull();
    expect(parsePoll('__POLL__id__::Q__::a|b')).toEqual({ pollId: 'id', question: 'Q', options: ['a', 'b'] });
    const msgs = [
      { content: encodeVote('p', 0), authorAddress: A }, { content: encodeVote('p', 1), authorAddress: A },
      { content: encodeVote('p', 1), authorAddress: B }, { content: encodeVote('p', 7), authorAddress: C },
      { content: encodeVote('other', 0), authorAddress: D }, { content: encodeVote('p', 0) },
    ];
    expect(tallyVotes(msgs, 'p', 2).counts).toEqual([0, 2]);
    expect(isControlMessage(encodeVote('p', 0))).toBe(true);
    expect(isControlMessage('hello')).toBe(false);
  });
});

describe('roles', () => {
  const c = { ownerAddress: A, members: [{ walletAddress: B, role: 'ADMIN' }, { walletAddress: C, role: 'MODERATOR' }, { walletAddress: D, role: 'MEMBER' }] };
  it('owner > admin > moderator > member, and nobody acts on the owner or on an equal', () => {
    expect([A, B, C, D].map((x) => roleOf(x, c))).toEqual(['OWNER', 'ADMIN', 'MODERATOR', 'MEMBER']);
    expect(roleOf('0x' + 'e'.repeat(40), c)).toBeNull();
    expect(can('MEMBER', 'removeMember')).toBe(false);
    expect(can('OWNER', 'deleteCommunity') && !can('ADMIN', 'deleteCommunity')).toBe(true);
    expect(canActOn('ADMIN', 'OWNER', 'removeMember')).toBe(false);
    expect(canActOn('ADMIN', 'ADMIN', 'removeMember')).toBe(false);
    expect(canActOn('MODERATOR', 'MEMBER', 'removeMember')).toBe(true);
    expect(canActOn('MODERATOR', 'MEMBER', 'promote')).toBe(false);
    expect(assignableRoles('OWNER')).toEqual(['ADMIN', 'MODERATOR', 'MEMBER']);
    expect(assignableRoles('ADMIN')).toEqual(['MODERATOR', 'MEMBER']);
    expect(assignableRoles('MEMBER')).toEqual([]);
  });
});

describe('creation', () => {
  it('waits for encrypted messaging to start instead of failing', async () => {
    let n = 0; const client = { conversations: {} };
    expect(await waitForClient(() => (++n > 3 ? client : undefined), 2000, 5)).toBe(client);
    expect(await waitForClient(() => undefined, 30, 5)).toBeNull();
  });
  it('a community gets a stable 10 × 10 mosaic from its name', () => {
    expect(glyphSeedForName('Madrid builders')).toBe(glyphSeedForName('  madrid BUILDERS '));
    expect(glyphSeedForName('a')).toMatch(/^0x[0-9a-f]{40}$/);
    expect(glyphSeedForName('a') === glyphSeedForName('b')).toBe(false);
  });
});

describe('wiring', () => {
  it('the community screen opens Shared Media, Members and member profiles; votes never show as posts', () => {
    const r = read('components/communities/CommunityReader.tsx');
    expect(r).toMatch(/<CommunityMediaSheet /);
    expect(r).toMatch(/<MembersPanel /);
    expect(r).toMatch(/<MemberSheet[\s\S]*onPay=\{onPay\}/);
    expect(r).toMatch(/setOpenMember\(p\.authorAddress!\.toLowerCase\(\)\)/);
    expect(r).toMatch(/!isControlMessage\(x\.content\)/);
    expect(r).toMatch(/prepareAttachmentMessage\(file/);
    expect(read('components/terminal/LedgerChatV2.tsx')).toMatch(/onPay=\{\(addr\) => \{[\s\S]*setShowZkModal\(true\)/);
  });
  it('admin actions only for someone who outranks the member; the server checks again', () => {
    const m = read('components/communities/MemberSheet.tsx');
    expect(m).toMatch(/canActOn\(myRole, role, 'promote'\) \|\| canActOn\(myRole, role, 'removeMember'\)/);
    expect(read('app/api/chat/communities/[id]/members/route.ts')).toMatch(/isAdminOrOwner/);
  });
  it('mobile: sheets use the dynamic viewport and safe areas', () => {
    for (const f of ['CommunityMediaSheet', 'MemberSheet', 'CreateCommunitySheet', 'PostBody']) {
      const s = read(`components/communities/${f}.tsx`);
      expect(s).toMatch(/dvh/);
      expect(s).toMatch(/env\(safe-area-inset-(bottom|top)\)/);
    }
  });
});
