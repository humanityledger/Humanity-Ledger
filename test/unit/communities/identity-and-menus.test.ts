import { describe, expect, it, vi } from 'vitest';
import fs from 'node:fs';

const { findMany } = vi.hoisted(() => ({ findMany: vi.fn() }));
vi.mock('@/lib/prisma', () => ({ prisma: { user: { findMany } } }));

import { cleanName, memberNames } from '@/lib/communities/member-names';
import { authorLabel, shortWallet } from '@/components/communities/CommunityReader';

const read = (p: string) => fs.readFileSync(p, 'utf8');
const A = '0x1111111111111111111111111111111111111111';
const B = '0x2222222222222222222222222222222222222222';

describe('who wrote a community post', () => {
  it('your saved name first, then their Ledger Chat name, then the wallet; a name always shows the wallet beside it', () => {
    expect(authorLabel({ id: '1', authorAddress: A }, B, () => 'Ana (work)')).toEqual({ name: 'Ana (work)', wallet: shortWallet(A), mine: false });
    expect(authorLabel({ id: '1', authorAddress: A, authorName: 'Ana' }, B)).toEqual({ name: 'Ana', wallet: '0x1111…1111', mine: false });
    expect(authorLabel({ id: '1', authorAddress: A, authorName: null }, B)).toEqual({ name: '0x1111…1111', wallet: '', mine: false });
    expect(authorLabel({ id: '1', authorAddress: B, authorName: 'Me' }, B)).toEqual({ name: 'You', wallet: '0x2222…2222', mine: true });
  });

  it('a Ledger Chat name is never the default, never a control character, at most 40 characters', () => {
    expect(cleanName('Ledger User', null)).toBeNull();
    expect(cleanName('Ledger User', 'Ana')).toBe('Ana');
    expect(cleanName('  Ana‮  Ruiz ', null)).toBe('Ana Ruiz');
    expect(cleanName('x'.repeat(60), null)).toHaveLength(40);
    expect(cleanName('', '')).toBeNull();
  });

  it('names are looked up for valid wallets only, in one query, and a failed query gives no names', async () => {
    findMany.mockResolvedValueOnce([{ walletAddress: A, chatName: 'Ana', displayName: null }, { walletAddress: B, chatName: 'Ledger User', displayName: null }]);
    const names = await memberNames([A, A.toUpperCase().replace('0X', '0x'), 'not-a-wallet', null, B]);
    expect(findMany).toHaveBeenCalledTimes(1);
    expect(findMany.mock.calls[0][0].where.walletAddress.in).toEqual([A, B]);
    expect(Object.fromEntries(names)).toEqual({ [A]: 'Ana' });
    findMany.mockRejectedValueOnce(new Error('db down'));
    expect((await memberNames([A])).size).toBe(0);
  });

  it('the posts and members APIs send the names', () => {
    expect(read('app/api/chat/communities/[id]/posts/route.ts')).toMatch(/authorName: names\.get\(/);
    expect(read('app/api/chat/communities/[id]/members/route.ts')).toMatch(/name: names\.get\(/);
  });
});

describe('right click in communities', () => {
  it('posts and community rows open their own menu (the browser menu is blocked app-wide)', () => {
    const reader = read('components/communities/CommunityReader.tsx');
    expect(reader).toMatch(/useContextMenuTrigger\(onMenu\)/);
    expect(reader).toMatch(/'Copy text'/);
    expect(reader).toMatch(/'Message privately'/);
    // Pasting into the post field keeps the browser's own menu.
    expect(reader).toMatch(/data-allow-context/);
    const tab = read('components/chat/LedgerCommunitiesTab.tsx');
    expect(tab).toMatch(/useContextMenuTrigger\(setMenu\)/);
    expect(tab).toMatch(/'Copy invite link'/);
  });
});

describe('swipe on a conversation', () => {
  it('settles closed, open left or open right; closes on tap, outside tap, scroll and Escape; one open row', () => {
    const src = read('components/chat/SwipeableConversationRow.tsx');
    expect(src).toMatch(/if \(RIGHT_W && projected > RIGHT_W \* 0\.5\) settle\("right"\);\s*else if \(LEFT_W && projected < -LEFT_W \* 0\.5\) settle\("left"\);\s*else settle\(null\);/);
    expect(src).toMatch(/document\.addEventListener\("pointerdown", onDown, true\)/);
    expect(src).toMatch(/document\.addEventListener\("scroll", onScroll, true\)/);
    expect(src).toMatch(/e\.key === "Escape"/);
    expect(src).toMatch(/if \(closeOpenRow && closeOpenRow !== close\) closeOpenRow\(\);/);
    // The island is never wider than the gap the row uncovers.
    expect(src).toMatch(/Math\.max\(BTN \* 0\.6, capsule \* r\)/);
  });
});
