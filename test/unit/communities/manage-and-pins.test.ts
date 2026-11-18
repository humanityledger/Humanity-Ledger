/**
 * Communities: one screen to enter, one to start, one to talk, and Manage as rows.
 * Pins: a post is pinned only when a person chooses Pin (docs/CLAUDE_OPUS_MANAGE_UI.md, sections 2 and 3).
 */
import { describe, it, expect } from 'vitest';
import fs from 'node:fs';
import { createRequire } from 'node:module';
import { manageRows, canPin } from '@/components/communities/CommunityManage';

const read = (p: string) => fs.readFileSync(p, 'utf8');
/** Source without comments: the headers name the old chrome to say it is gone. */
const code = (p: string) => read(p).replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '');
const require_ = createRequire(import.meta.url);

describe('Manage', () => {
  it('a member sees the rows every member has, then Leave; no admin rows', () => {
    const rows = manageRows({ isOwner: false, isAdmin: false }).map((r) => r.label);
    expect(rows).toEqual(['Pinned posts', 'Members', 'Invite', 'Apps', 'Governance', 'Leave this community']);
  });

  it('an admin also sees the admin rows, and Leave; never Delete', () => {
    const rows = manageRows({ isOwner: false, isAdmin: true }).map((r) => r.label);
    expect(rows).toEqual([
      'Pinned posts', 'Members', 'Invite', 'Name and description', 'Channels', 'Permissions',
      'Moderation and slow mode', 'Privacy and discovery', 'Apps', 'Analytics', 'Governance', 'Leave this community',
    ]);
  });

  it('the owner sees Delete and not Leave', () => {
    const rows = manageRows({ isOwner: true, isAdmin: true }).map((r) => r.label);
    expect(rows.at(-1)).toBe('Delete this community');
    expect(rows).not.toContain('Leave this community');
  });

  it('has no communityMls switch, no hash, no contract address, and no old chrome', () => {
    const src = code('components/communities/CommunityManage.tsx');
    expect(src).not.toMatch(/communityMls\s*[:=]|UPDATE_MLS|createSecureGroup\(/);
    expect(src).not.toMatch(/0x[0-9a-fA-F]{40,}/);
    for (const old of ["'Posts'", "'Chat'", "'More'", 'Chat & Channels', 'View Members', 'Search messages', 'Pinned Messages', 'Write a post']) {
      expect(src.includes(old), old).toBe(false);
    }
  });

  it('the old community surface is gone and the chat opens Manage instead', () => {
    for (const f of ['CommunityView', 'CommunityChatView', 'CommunitySettingsPanel', 'CommunityMemberPanel', 'CommunityMessageReactions', 'RichPostEditor']) {
      expect(fs.existsSync(`components/chat/${f}.tsx`), f).toBe(false);
    }
    const chat = read('components/terminal/LedgerChatV2.tsx');
    expect(chat).toMatch(/communityManage \? \(\s*<CommunityManage/);
    expect(chat).not.toMatch(/<CommunityView\b/);
  });

  it('the reading screen has one field and Send is its only action', () => {
    const src = read('components/communities/CommunityReader.tsx');
    expect(src).toContain("export const VISIBILITY_SENTENCE = 'People in this community can read what you write here. It is not a private conversation.';");
    const form = src.slice(src.indexOf('<form'), src.indexOf('</form>'));
    expect(form.match(/<button/g)?.length).toBe(1);
    expect(form).toMatch(/type="submit"[\s\S]*Send/);
    expect((src.match(/<textarea/g) || []).length).toBe(1);
    // A failed post stays, says why, and offers Try again and Remove.
    expect(src).toMatch(/Try again<\/button>[\s\S]*Remove<\/button>/);
    // Pins are a Manage row, not a second feed here.
    expect(code('components/communities/CommunityReader.tsx')).not.toMatch(/pinned/i);
  });

  it('Start one asks for a name and whether it is private, then opens it; joining opens it too', () => {
    const src = read('components/chat/LedgerCommunitiesTab.tsx');
    const sheet = src.slice(src.indexOf('title="New community"'), src.indexOf('title="Join a community"'));
    expect(sheet).toContain('Name');
    expect(sheet).toContain('Is it private?');
    expect(sheet).not.toMatch(/Description/);
    expect(src).toMatch(/const id: string \| undefined = d\?\.community\?\.id;[\s\S]*if \(id\) onOpenCommunity\(id\);/);
    expect(src.match(/onOpenCommunity\(id\)/g)?.length).toBe(2);
  });
});

describe('pins', () => {
  it('only the owner, an admin, or a member where members may pin can pin', () => {
    expect(canPin({ isOwner: true, isAdmin: true, isMember: true }, false)).toBe(true);
    expect(canPin({ isOwner: false, isAdmin: true, isMember: true }, false)).toBe(true);
    expect(canPin({ isOwner: false, isAdmin: false, isMember: true }, false)).toBe(false);
    expect(canPin({ isOwner: false, isAdmin: false, isMember: true }, true)).toBe(true);
    expect(canPin({ isOwner: false, isAdmin: false, isMember: false }, true)).toBe(false);
  });

  it('sending stores the post unpinned; only PIN_MESSAGE sets pinnedAt, and Unpin clears it without deleting', () => {
    const posts = read('app/api/chat/communities/[id]/posts/route.ts');
    expect(posts).toMatch(/pinnedAt: null,\s*pinnedBy: null,/);
    const route = read('app/api/chat/communities/route.ts');
    expect(route).toMatch(/action === 'PIN_MESSAGE' \|\| action === 'UNPIN_MESSAGE'/);
    expect(route).toMatch(/data: pin \? \{ pinnedAt: new Date\(\), pinnedBy: me \} : \{ pinnedAt: null, pinnedBy: null \}/);
    const pinBlock = route.slice(route.indexOf("action === 'PIN_MESSAGE' ||"), route.indexOf("const [member, owned] = await Promise.all(["));
    expect(pinBlock).not.toMatch(/communityPost\.delete/);
    expect(pinBlock).toMatch(/where: \{ id: messageId, communityId \}/);
  });

  it('the pinned list asks the server for pinned posts only, and an empty answer empties it', () => {
    const posts = read('app/api/chat/communities/[id]/posts/route.ts');
    expect(posts).toMatch(/pinnedOnly \? \{ pinnedAt: \{ not: null \} \} : \{\}/);
    const manage = read('components/communities/CommunityManage.tsx');
    expect(manage).toContain('/posts?pinned=1');
    // The list is always replaced, so nothing from a previous fetch survives an empty answer.
    expect(manage).toMatch(/setPinned\(pins\);/);
    expect(manage).not.toMatch(/if \(pins\.length > 0\) setPinned/);
    expect(manage).toContain('No pinned posts.');
  });

  it('the schema and an additive migration add the pin columns, nullable', () => {
    const schema = read('prisma/schema.prisma');
    const model = schema.slice(schema.indexOf('model CommunityPost {'), schema.indexOf('}', schema.indexOf('model CommunityPost {')));
    expect(model).toMatch(/pinnedAt\s+DateTime\?/);
    expect(model).toMatch(/pinnedBy\s+String\?/);
    const sql = read('prisma/migrations/20261117120000_community_post_pins/migration.sql');
    expect(sql).toContain('ALTER TABLE "CommunityPost" ADD COLUMN "pinnedAt" TIMESTAMP(3);');
    expect(sql).toContain('ALTER TABLE "CommunityPost" ADD COLUMN "pinnedBy" TEXT;');
    expect(sql).not.toMatch(/DROP|DELETE|UPDATE "CommunityPost"/i);
    const { extractObjects } = require_('../../../lib/db/migration-inspect.js');
    const o = extractObjects(sql);
    expect(o.unverifiable).toEqual([]);
    expect(o.columns.map((c: { column: string }) => c.column).sort()).toEqual(['pinnedAt', 'pinnedBy']);
  });

  it('permissions save only real columns, and slow mode saves', () => {
    const route = read('app/api/chat/communities/route.ts');
    expect(route).toMatch(/PERMISSION_FLAGS\.has\(k\)/);
    expect(route).toMatch(/k === 'slowModeSeconds' && typeof v === 'number' && SLOW_MODE_SECONDS\.includes\(v\)/);
  });
});

describe('opening a community', () => {
  it('counts only relations Community has: no posts relation, so posts are counted separately', () => {
    const schema = read('prisma/schema.prisma');
    const model = schema.slice(schema.indexOf('model Community {'), schema.indexOf('}', schema.indexOf('model Community {')));
    expect(model).not.toMatch(/^\s+posts\s/m);
    const route = read('app/api/chat/communities/[id]/route.ts');
    expect(route).toMatch(/_count: \{ select: \{ members: true, channels: true \} \}/);
    expect(route).not.toMatch(/_count: \{ select: \{[^}]*posts/);
    expect(route).toMatch(/communityPost\s*\.count\(\{ where: \{ communityId: community\.id \} \}\)/);
    expect(route).toMatch(/community\._count\?\.members \?\?/);
  });

  it('the owner manages settings even without an ADMIN row; admins can reset the invite link', () => {
    const route = read('app/api/chat/communities/route.ts');
    expect(route).toMatch(/if \(!isOwner && \(!member \|\| member\.role !== 'ADMIN'\)\)/);
    const manage = read('components/communities/CommunityManage.tsx');
    expect(manage).toMatch(/action: 'REVOKE_LINK', communityId/);
    expect(manage).toMatch(/data-testid="invite-reset"/);
    expect(manage).toMatch(/flex-1 flex flex-col w-full h-full min-w-0 min-h-0 bg-white/);
  });
});
