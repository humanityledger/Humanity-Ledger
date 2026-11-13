import { readFileSync } from 'node:fs';

const read = (p: string) => readFileSync(p, 'utf8');
const code = (src: string) => src.replace(/\/\*[^]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '');
const sections = code(read('components/landing/v2/ProtocolSections.tsx'));
const landing = read('components/landing/v2/Landing.tsx');
const css = read('components/landing/v2/Protocol.module.css');

describe('landing: HLC and protocol sections', () => {
  it('the sections exist on the page with the ids the navigation links to', () => {
    for (const id of ['stack', 'devices', 'hlc']) expect(landing).toMatch(new RegExp(`<section id="${id}"`));
    expect(read('components/immersive/SiteNav.tsx')).toMatch(/href: "\/#hlc"/);
  });

  it('token figures come from the tested model and the live endpoint, not from the page', () => {
    expect(sections).toMatch(/from "@\/lib\/protocol\/tokenomics"/);
    expect(sections).toMatch(/useProtocolReport\(\)/);
    expect(sections).not.toMatch(/450,000,000|200,000,000|150,000,000|1,000,000,000/);
  });

  it('presents a plan, never an offer or an income', () => {
    expect(sections).toMatch(/HLC is not on sale and nothing is being distributed/);
    expect(sections).toMatch(/Staking lowers fees\. It pays nothing\./);
    expect(sections).not.toMatch(/\b(APY|APR|yield|dividend|passive income|guaranteed|to the moon)\b/i);
    expect(sections).not.toMatch(/\bearn (ETH|USDC)\b/i);
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
