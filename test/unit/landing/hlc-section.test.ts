import { readFileSync } from 'node:fs';

const read = (p: string) => readFileSync(p, 'utf8');
const code = (src: string) => src.replace(/\/\*[^]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '');
const sections = code(read('components/landing/v2/ProtocolSections.tsx'));
const landing = read('components/landing/v2/Landing.tsx');
const css = read('components/landing/v2/Protocol.module.css');

describe('landing: protocol sections, without a token model', () => {
  it('the devices section stays; the HLC token section is gone (PA-1, 19/11/2026)', () => {
    expect(landing).toMatch(/<section id="devices"/);
    expect(landing).not.toMatch(/<section id="hlc"|TokenSection/);
    // The stack is the interactive explorer of the launch sections.
    expect(landing).toMatch(/<StackExplorer \/>/);
    expect(read('components/landing/v2/LaunchSections.tsx')).toMatch(/<section id="stack"/);
    expect(read('components/immersive/SiteNav.tsx')).not.toMatch(/#hlc/);
  });

  it('no token model on the page: no supply, allocations, airdrop, fair launch or buyback', () => {
    expect(sections).not.toMatch(/lib\/protocol\/tokenomics/);
    expect(sections).not.toMatch(/airdrop|fair launch|buy(ing)? (it )?back|burn|vesting|staking/i);
    expect(sections).not.toMatch(/\b(APY|APR|yield|dividend|passive income|guaranteed|to the moon)\b/i);
  });

  it('never claims that senders are private on Alpha', () => {
    expect(sections).not.toMatch(/senders and recipients stay private/i);
    expect(sections).toMatch(/the account that pays the network fee is visible/);
  });

  it('motion is one scroll-driven moment on transform and opacity, with reduced motion respected', () => {
    expect(css).toMatch(/@supports \(animation-timeline: view\(\)\)/);
    expect(css).toMatch(/prefers-reduced-motion: no-preference/);
    const keyframes = [...css.matchAll(/@keyframes\s+\w+\s*\{([^]*?)\n\}/g)].map((m) => m[1]);
    expect(keyframes.length).toBe(1);
    for (const k of keyframes) for (const m of k.matchAll(/([a-z-]+)\s*:/g)) expect(['opacity', 'transform']).toContain(m[1]);
    expect(css).not.toMatch(/gradient|backdrop-filter|box-shadow/);
  });
});
