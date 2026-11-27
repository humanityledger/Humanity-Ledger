import { describe, it, expect } from 'vitest';
import { readFileSync } from 'fs';
import path from 'path';
import {
  MODERATION_SETTINGS, PERMISSION_DEFAULTS, PERMISSION_SETTINGS, ROW_HELP, SLOW_MODE_HELP, SLOW_MODE_OPTIONS, ENFORCEMENT_NOTE_MLS,
  checkPost, effectivePermissions, encodePin, encodeUnpin, mayPinFor, pinnedIds, rankIn, spamIds,
} from '@/lib/communities/settings';
import { manageRows } from '@/components/communities/CommunityManage';

const root = path.resolve(__dirname, '../../..');
const read = (p: string) => readFileSync(path.join(root, p), 'utf8');
const A = '0x' + 'a'.repeat(40), B = '0x' + 'b'.repeat(40), O = '0x' + 'c'.repeat(40);
const community = { ownerAddress: O, members: [{ walletAddress: A, role: 'MEMBER' }, { walletAddress: B, role: 'MODERATOR' }] };

describe('community settings: defaults and what is shown', () => {
  it('a community without a permissions row shows the database defaults, not everything off', () => {
    expect(effectivePermissions(null)).toEqual(PERMISSION_DEFAULTS);
    expect(effectivePermissions({ sendMedia: false, slowModeSeconds: 60, junk: 1 } as any)).toMatchObject({ sendMessages: true, sendMedia: false, slowModeSeconds: 60 });
    // Same defaults as prisma/schema.prisma CommunityPermission.
    const model = read('prisma/schema.prisma').match(/model CommunityPermission \{[\s\S]*?\n\}/)![0];
    for (const [k, v] of Object.entries(PERMISSION_DEFAULTS)) expect(model).toMatch(new RegExp(`${k}\\s+\\w+\\s+@default\\(${v}\\)`));
  });
  it('every setting and every Manage row has an explanation, in every language', () => {
    const rows = manageRows({ isOwner: true, isAdmin: true }).concat(manageRows({ isOwner: false, isAdmin: false }));
    for (const r of rows) expect(ROW_HELP[r.view], r.view).toBeTruthy();
    const strings = [
      ...PERMISSION_SETTINGS.flatMap((s) => [s.label, s.help]), ...MODERATION_SETTINGS.flatMap((s) => [s.label, s.help]),
      ...Object.values(ROW_HELP), ...SLOW_MODE_OPTIONS.map(([, l]) => l), SLOW_MODE_HELP, ENFORCEMENT_NOTE_MLS,
    ];
    for (const lang of ['es', 'de', 'ru', 'zh']) {
      const dict = JSON.parse(read(`lib/i18n/messages/${lang}.json`));
      for (const s of strings) expect(dict[s], `${lang}: ${s}`).toBeTruthy();
    }
  });
});

describe('community settings: applied by every app', () => {
  const p = effectivePermissions(null);
  it('posting rules: members follow them, owner/admins/moderators are not limited', () => {
    expect(checkPost({ ...p, sendMessages: false }, 'MEMBER', 'text', 'hi', null).ok).toBe(false);
    expect(checkPost({ ...p, sendMessages: false }, 'MODERATOR', 'text', 'hi', null).ok).toBe(true);
    expect(checkPost({ ...p, sendMedia: false }, 'MEMBER', 'media', '', null).ok).toBe(false);
    expect(checkPost({ ...p, sendPolls: false }, 'MEMBER', 'poll', '', null).ok).toBe(false);
    expect(checkPost({ ...p, embedLinks: false }, 'MEMBER', 'text', 'see https://x.io', null).ok).toBe(false);
    expect(checkPost({ ...p, embedLinks: false }, 'MEMBER', 'text', 'no link here', null).ok).toBe(true);
    expect(checkPost(p, null, 'text', 'hi', null).ok).toBe(false);
  });
  it('slow mode counts from the member’s last post', () => {
    const now = 1_000_000;
    const r = checkPost({ ...p, slowModeSeconds: 60 }, 'MEMBER', 'text', 'x', now - 20_000, now);
    expect(r.ok).toBe(false);
    expect(r.waitSec).toBe(40);
    expect(checkPost({ ...p, slowModeSeconds: 60 }, 'MEMBER', 'text', 'x', now - 61_000, now).ok).toBe(true);
    expect(checkPost({ ...p, slowModeSeconds: 60 }, 'ADMIN', 'text', 'x', now - 1_000, now).ok).toBe(true);
  });
  it('spam filter hides repeats within 10 minutes and link floods, never privileged posts', () => {
    const rank = (a: string) => rankIn(community, a);
    const ids = spamIds([
      { id: '1', content: 'Buy now', authorAddress: A, createdAt: 0 },
      { id: '2', content: 'buy   NOW', authorAddress: A, createdAt: 60_000 },
      { id: '3', content: 'Buy now', authorAddress: A, createdAt: 30 * 60_000 },
      { id: '4', content: 'a https://1.io https://2.io https://3.io https://4.io', authorAddress: A, createdAt: 1 },
      { id: '5', content: 'Buy now', authorAddress: B, createdAt: 2 },
      { id: '6', content: 'Buy now', authorAddress: B, createdAt: 3 },
    ], rank);
    expect([...ids].sort()).toEqual(['2', '4']);
  });
  it('pins are group messages; pins from people who may not pin are ignored', () => {
    const may = (a: string) => mayPinFor(p, rankIn(community, a));
    const msgs = [
      { id: 'm1', content: encodePin('p1'), authorAddress: B, createdAt: 1 },
      { id: 'm2', content: encodePin('p2'), authorAddress: A, createdAt: 2 }, // a member, pinning not allowed
      { id: 'm3', content: encodePin('p3'), authorAddress: O, createdAt: 3 },
      { id: 'm4', content: encodeUnpin('p1'), authorAddress: O, createdAt: 4 },
    ];
    expect(pinnedIds(msgs, may)).toEqual(['p3']);
    expect(pinnedIds(msgs, (a) => mayPinFor({ ...p, pinMessages: true }, rankIn(community, a)))).toEqual(['p2', 'p3'].reverse());
  });
});

describe('community security (27/11/2026 review)', () => {
  it('members API: rank hierarchy, no role overwrite through POST, join requests', () => {
    const r = read('app/api/chat/communities/[id]/members/route.ts');
    expect(r).toMatch(/RANK\[role\] >= RANK\[actor\]/);
    expect(r).toMatch(/RANK\[current\] >= RANK\[actor\] \|\| RANK\[role\] >= RANK\[actor\]/);
    expect(r).toMatch(/You can only remove someone below you\./);
    expect(r).not.toMatch(/upsert\(/);
    expect(r).toMatch(/body\?\.request === true/);
  });
  it('settings writes never answer ok when nothing was saved', () => {
    const r = read('app/api/chat/communities/route.ts');
    expect(r).not.toMatch(/\} catch \{\}\s*\n\s*return NextResponse\.json\(\{ ok: true \}\);/);
    expect(r).toMatch(/code: 'UNKNOWN_ACTION'/);
    expect(r).toMatch(/Not saved\. Try again in a moment\./);
    expect(r).toMatch(/code: 'MAIN_CHANNEL'/);
    expect(r).toMatch(/Only the owner can delete this community/);
  });
  it('members may change name and description only when changeInfo allows it', () => {
    const r = read('app/api/chat/communities/[id]/route.ts');
    expect(r).toMatch(/perms\?\.changeInfo !== true \|\| !onlyInfo/);
  });
  it('the retired join-by-id route refuses in its own handler', () => {
    const r = read('app/api/communities/[slug]/join/route.ts');
    expect(r).toMatch(/status: 410/);
    expect(r).not.toMatch(/prisma/);
  });
  it('join links wait for approval when the community asks for it', () => {
    const r = read('app/api/chat/communities/join/route.ts');
    expect(r).toMatch(/requireApproval === true[\s\S]*addJoinRequest[\s\S]*PENDING_APPROVAL/);
    expect(read('components/terminal/LedgerChatV2.tsx')).toMatch(/data\.status === 'PENDING_APPROVAL'/);
    expect(read('components/chat/LedgerCommunitiesTab.tsx')).toMatch(/d\?\.status === 'PENDING_APPROVAL'/);
  });
  it('creating a community never waits on the network for its first group', () => {
    const g = read('lib/xmtp/groups.ts');
    expect(g).toMatch(/validatedIdentifiers\.length === 0[\s\S]*newGroupOptimistic/);
    expect(g).not.toMatch(/The group may still be on its way/);
  });
  it('admins other than the owner can remove people from the encrypted group', () => {
    const m = read('lib/communities/mls.ts');
    expect(m).toMatch(/async function grantAdmins/);
    expect(m).toMatch(/removeMembersByIdentifiers\(ids\(remove\)\)/);
  });
  it('the reader applies the rules to what it sends', () => {
    const r = read('components/communities/CommunityReader.tsx');
    expect(r).toMatch(/if \(body && !retryId && !allowed\(kindOf\(body\), body\)\) return;/);
    expect(r).toMatch(/if \(!allowed\('media'\)\) return;/);
    expect(r).toMatch(/spamIds\(/);
  });
});
