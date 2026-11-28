/**
 * Communities V2 upgrade (27 Nov 2026): channels in the reader, full-width Manage views, channel
 * names, invite QR, governance labels and rules, analytics helpers. Pure functions are tested by
 * value; screens by the invariants their source must keep.
 */
import { describe, it, expect } from 'vitest';
import fs from 'node:fs';
import {
  activeUniqueAddresses, activityByDay, fillInsight, generateOperationalInsights, hourlyActivityMatrix, periodGrowthPct,
  postsByDay, toCsv, topContributors, memberGrowthByMonth,
} from '@/lib/communities/analytics';
import { effectiveStatus, forumDraft, percentages, quorumFor, roleIn, tally, durationDays } from '@/lib/communities/governance';
import { pickChannel, readerChannels } from '@/components/communities/CommunityReader';
import { channelNameProblem, channelSlug, isWideView } from '@/components/communities/CommunityManage';
import { untranslated } from '../../helpers/untranslated';

const read = (p: string) => fs.readFileSync(p, 'utf8');
const code = (p: string) => read(p).replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '');
const NOW = Date.UTC(2026, 10, 27, 12, 0, 0);
const day = (n: number) => NOW - n * 86_400_000;

describe('reader: every channel can be opened', () => {
  it('lists only channels with an encrypted group in an MLS community', () => {
    const c = { channels: [{ id: 'a', name: 'general', xmtpGroupId: 'AbC' }, { id: 'b', name: 'dev', xmtpGroupId: null }, { id: 'c', name: 'news', xmtpGroupId: 'def' }] };
    expect(readerChannels(c, true).map((x) => x.id)).toEqual(['a', 'c']);
    expect(readerChannels(c, false).map((x) => x.id)).toEqual(['a', 'b', 'c']);
  });
  it('opens the channel asked for, keeps the current one, else the first', () => {
    const list = readerChannels({ channels: [{ id: 'a', name: 'g', xmtpGroupId: 'x' }, { id: 'b', name: 'h', xmtpGroupId: 'y' }] }, true);
    expect(pickChannel(list, null, 'b')).toBe('b');
    expect(pickChannel(list, 'a', 'b')).toBe('a');
    expect(pickChannel(list, null, 'zzz')).toBe('a');
    expect(pickChannel([], null, 'b')).toBeNull();
  });
  it('the screen has a channel bar, a recovery button for waiting members, and still one field', () => {
    const src = untranslated(read('components/communities/CommunityReader.tsx'));
    expect((src.match(/<textarea/g) || []).length).toBe(1);
    expect(src).toMatch(/channels\.length > 1 &&[\s\S]{0,200}aria-label="Channels"/);
    expect(src).toMatch(/aria-pressed=\{on\}/);
    expect(src).toContain('Check encrypted access now');
    expect(src).toMatch(/const mlsGroup = mlsOn \? activeChannel\?\.xmtpGroupId \?\? null : null;/);
    expect(src).toMatch(/resolveGroupForClient\(xmtpClient, mlsGroup\)/);
    expect(code('components/communities/CommunityReader.tsx')).not.toMatch(/pinned/i);
  });
  it('the posts API filters by channel without touching the pinned query', () => {
    const src = read('app/api/chat/communities/[id]/posts/route.ts');
    expect(src).toMatch(/if \(!pinnedOnly && wantedChannel\)/);
    expect(src).toMatch(/pinnedOnly \? \{ pinnedAt: \{ not: null \} \} : \{\}/);
  });
  it('group ids are matched without regard to case', () => {
    expect(read('lib/xmtp/groups.ts')).toMatch(/String\(g\?\.id \?\? ''\)\.toLowerCase\(\) === target/);
  });
});

describe('Manage: wide views and channels', () => {
  it('Apps, Analytics and Governance leave the 720 px reading column', () => {
    expect(isWideView('apps')).toBe(true);
    expect(isWideView('analytics')).toBe(true);
    expect(isWideView('governance')).toBe(true);
    expect(isWideView('members')).toBe(false);
    const src = read('components/communities/CommunityManage.tsx');
    const apps = src.indexOf('<CommunityApps communityId');
    expect(apps).toBeGreaterThan(-1);
    expect(apps).toBeLessThan(src.indexOf('max-w-[720px]'));
    expect(src.slice(src.indexOf('{wide && view === \'apps\''), apps)).toContain('flex-1 min-h-0 w-full flex flex-col');
    expect(src).not.toMatch(/\$\{card\} overflow-hidden`\}>\s*\{view === 'apps'/);
  });
  it('channel names: 2 to 32 lowercase letters, digits or hyphens, not taken', () => {
    expect(channelSlug('  Anuncios Generales ')).toBe('anuncios-generales');
    expect(channelSlug('Dev!!')).toBe('dev');
    expect(channelNameProblem('dev', [])).toBeNull();
    expect(channelNameProblem('a', [])).toMatch(/2 to 32/);
    expect(channelNameProblem('-dev', [])).toMatch(/starting with/);
    expect(channelNameProblem('dev', ['Dev'])).toMatch(/already exists/);
    expect(channelNameProblem('', [])).toBeNull();
  });
  it('channel rows show encryption, a sync count with repair, and Open; progress has no spinner', () => {
    const src = read('components/communities/CommunityManage.tsx');
    expect(src).toMatch(/<Lock size=/);
    expect(src).toMatch(/groupMemberAddresses\(xmtpClient, groupId\)/);
    expect(src).toMatch(/restoreChannel\(xmtpClient, groupId, community, me, isAdmin\)/);
    expect(src).toMatch(/onOpen\(c\.id\)/);
    expect(src).toMatch(/animate-\[hl-indeterminate/);
    expect(src).not.toMatch(/\banimate-spin\b/);
  });
  it('invite: the branded QR, a PNG export, the short code, share, and the inline reset confirmation', () => {
    const src = read('components/communities/CommunityManage.tsx');
    expect(src).toMatch(/import \{ BrandedQr, loadQrLogo \} from '@\/components\/chat\/profile\/BrandedQr'/);
    expect(src).toMatch(/drawBrandedQr\(ctx, link/);
    expect(src).toMatch(/ledgerchat-invite-/);
    expect(src).toMatch(/navigator\.share\(\{ title, text, url: link \}\)/);
    expect(src).toContain('data-testid="invite-reset"');
    expect(src).toMatch(/\$\{base\}\/invite`/);
    expect(src).not.toMatch(/window\.confirm\(/);
    expect(src).not.toMatch(/qrcode\.react/);
  });
});

describe('governance', () => {
  it('no broken labels and no old engine name, in the screen or the dictionaries', () => {
    const src = read('components/chat/CommunityGovernanceModal.tsx');
    expect(src).not.toMatch(/t\(["']For \(["']\)|t\(["']Against \(["']\)/);
    expect(code('components/chat/CommunityGovernanceModal.tsx')).not.toMatch(/Consensus Engine|on-chain/);
    expect(src).toMatch(/t\('Community governance'\)/);
    for (const l of ['es', 'ru', 'zh', 'de']) {
      const d = JSON.parse(read(`lib/i18n/messages/${l}.json`));
      expect('For (' in d || 'Against (' in d || 'Consensus Engine' in d, l).toBe(false);
      expect(typeof d['Community governance'], l).toBe('string');
    }
  });
  it('counts For, Against and Abstain from the vote rows; percentages add up to 100', () => {
    const t = tally([{ vote: 'FOR' }, { vote: 'for' }, { vote: 'AGAINST' }, { vote: 'ABSTAIN' }, { vote: 'x' }]);
    expect(t).toEqual({ for: 2, against: 1, abstain: 1, total: 4 });
    const p = percentages({ for: 1, against: 1, abstain: 1, total: 3 });
    expect(p.for + p.against + p.abstain).toBe(100);
    expect(percentages({ for: 0, against: 0, abstain: 0, total: 0 })).toEqual({ for: 0, against: 0, abstain: 0 });
  });
  it('quorum, duration and status', () => {
    expect(quorumFor(1)).toBe(1);
    expect(quorumFor(4)).toBe(2);
    expect(quorumFor(40)).toBe(10);
    expect(quorumFor(40, 3)).toBe(3);
    expect(quorumFor(40, 9999)).toBe(500);
    expect(durationDays(14)).toBe(14);
    expect(durationDays(5)).toBe(7);
    const later = { votingEndsAt: NOW + 1000, votingThreshold: 2 };
    expect(effectiveStatus(later, { for: 0, against: 0, abstain: 0, total: 0 }, NOW)).toBe('ACTIVE');
    const ended = { votingEndsAt: NOW - 1000, votingThreshold: 2 };
    expect(effectiveStatus(ended, { for: 1, against: 0, abstain: 0, total: 1 }, NOW)).toBe('NO_QUORUM');
    expect(effectiveStatus(ended, { for: 2, against: 1, abstain: 0, total: 3 }, NOW)).toBe('PASSED');
    expect(effectiveStatus(ended, { for: 1, against: 1, abstain: 1, total: 3 }, NOW)).toBe('REJECTED');
  });
  it('roles come from the owner and the member rows; a moderators’ proposal is checked on the server', () => {
    const roles = new Map([['0xb', 'MODERATOR'], ['0xc', 'MEMBER']]);
    expect(roleIn('0xA', '0xa', roles)).toBe('OWNER');
    expect(roleIn('0xB', '0xa', roles)).toBe('MODERATOR');
    expect(roleIn('0xd', '0xa', roles)).toBe('MEMBER');
    const route = read('app/api/chat/communities/[id]/proposals/route.ts');
    expect(route).toMatch(/body\?\.official === true[\s\S]{0,80}!isPrivilegedRole\(creatorRole\)[\s\S]{0,200}status: 403/);
    expect(route).toMatch(/isVoteChoice\(normalizedVote\)/);
    expect(route).toMatch(/callerRole:/);
  });
  it('the forum draft is plain facts', () => {
    const md = forumDraft({ title: 'T', description: 'D' }, { for: 1, against: 0, abstain: 0, total: 1 }, 'C', 'ACTIVE');
    expect(md).toMatch(/^# T/);
    expect(md).toMatch(/\| 1 \(100%\) \| 0 \(0%\) \| 0 \(0%\) \| 1 \|/);
    expect(md).not.toMatch(/audited|partner|official|on-chain/i);
  });
});

describe('analytics helpers', () => {
  const posts = [
    { authorAddress: '0xA', createdAt: day(0), authorName: 'Ana' },
    { authorAddress: '0xa', createdAt: day(1) },
    { authorAddress: '0xb', createdAt: day(3) },
    { authorAddress: '0xc', createdAt: day(10) },
    { authorAddress: '0xc', createdAt: 'not a date' },
  ];
  it('activity per day: every day present, today last, nothing outside the window', () => {
    const d = activityByDay(posts.map((p) => p.createdAt), 14, NOW);
    expect(d).toHaveLength(14);
    expect(d[13].key).toBe('2026-11-27');
    expect(d[13].count).toBe(1);
    expect(d.reduce((n, x) => n + x.count, 0)).toBe(4);
    expect(postsByDay(posts, 14, NOW)['2026-11-26']).toBe(1);
  });
  it('active members, top contributors, heatmap', () => {
    expect(activeUniqueAddresses(posts, 7, NOW)).toBe(2);
    expect(activeUniqueAddresses(posts, 30, NOW)).toBe(3);
    const top = topContributors(posts, 2);
    expect(top.map((c) => [c.address, c.count])).toEqual([['0xa', 2], ['0xc', 2]]);
    expect(top[0].label).toBe('Ana');
    const m = hourlyActivityMatrix([NOW]);
    expect(m).toHaveLength(7);
    expect(m[new Date(NOW).getUTCDay()][12]).toBe(1);
  });
  it('growth is null without an earlier month, and insights never come from unknown figures', () => {
    expect(periodGrowthPct(memberGrowthByMonth(['2026-11-01']))).toBeNull();
    expect(periodGrowthPct(memberGrowthByMonth(['2026-10-01', '2026-10-02', '2026-11-03']))).toBe(50);
    expect(generateOperationalInsights({ totalMembers: null, active7d: null, growthPct: null, daily: null, channels: [] })).toEqual([]);
    const ins = generateOperationalInsights({ totalMembers: 10, active7d: 4, growthPct: null, daily: null, channels: [{ name: 'dev', count: 0 }] });
    expect(fillInsight(ins[0].title, ins[0].vars)).toBe('40% of members posted in the last 7 days');
    expect(ins.some((i) => i.id === 'quiet-channels')).toBe(true);
  });
  it('CSV quotes every field', () => {
    expect(toCsv([['a', 'b,c'], ['"q"', null]])).toBe('"a","b,c"\r\n"""q""",""');
  });
  it('the analytics screen names its source and never reads payments from localStorage', () => {
    const src = untranslated(read('components/chat/CommunityAnalytics.tsx'));
    expect(src).toContain('Computed on this device from the encrypted channels. Nothing was sent to the server.');
    expect(src).toContain('Read from the server database.');
    expect(src).not.toMatch(/localStorage\.(?:get|set)Item/);
  });
});
