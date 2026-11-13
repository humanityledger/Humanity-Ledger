import { readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';

/**
 * Communities follow the institutional style: no pulsing or spinning indicators, no gradients,
 * no blur, no spring or hover-scale motion, and no figures that are not read from the server.
 */
const ROOT = process.cwd();
const FILES = [
  ...readdirSync(join(ROOT, 'components/chat'))
    .filter((f) => /^Community.*\.tsx$/.test(f) || f === 'LedgerCommunitiesTab.tsx')
    .map((f) => `components/chat/${f}`),
  'components/chat/community-apps/CommunityApps.tsx',
  'components/chat/community-apps/AppFrame.tsx',
  'components/zk/ZkCommunityTreasury.tsx',
  'app/communities/page.tsx',
  'app/communities/[slug]/page.tsx',
];

const FORBIDDEN: Array<[string, RegExp]> = [
  ['animate-pulse / animate-ping / animate-spin', /\banimate-(?:pulse|ping|spin)\b/],
  ['gradient', /\bbg-gradient-/],
  ['backdrop blur', /\bbackdrop-blur/],
  ['spring transition', /type:\s*['"]spring['"]/],
  ['hover or tap scale', /\bwhile(?:Hover|Tap)=/],
  ['heavy shadow', /\bshadow-(?:md|lg|xl|2xl)\b/],
  ['testnet token shown as an asset', /zkDAI/],
];

describe('community interface', () => {
  for (const file of FILES) {
    it(`${file} has no decorative motion or invented figures`, () => {
      const src = readFileSync(join(ROOT, file), 'utf8');
      for (const [name, re] of FORBIDDEN) {
        expect(re.test(src), `${file}: ${name}`).toBe(false);
      }
    });
  }

  it('analytics never reads payments from localStorage', () => {
    const src = readFileSync(join(ROOT, 'components/chat/CommunityAnalytics.tsx'), 'utf8');
    expect(src).not.toMatch(/zkCommunityPayments|localStorage\.(?:get|set)Item/);
  });
});
