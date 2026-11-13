import { describe, expect, it } from 'vitest';
import { readFileSync, existsSync } from 'node:fs';
import { join } from 'node:path';
import { RAMP, hash, noise } from '@/components/immersive/glyphs';

const read = (p: string) => readFileSync(join(process.cwd(), p), 'utf8');
/** The code without its comments (the comments list the claims the page must not make). */
const code = (src: string) => src.replace(/\/\*[^]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '');
const landing = read('components/landing/v2/Landing.tsx');
const showcase = read('components/landing/v2/Showcase.tsx');
const phones = read('components/landing/v2/PhoneShowcase.tsx');
const footer = read('components/landing/v2/SiteFooter.tsx');
const nav = read('components/immersive/SiteNav.tsx');
const story = read('components/landing/v2/Story.module.css');

describe('landing: says only what is true', () => {
  it('no scale claims, no slogans borrowed from Aztec', () => {
    for (const src of [landing, showcase, phones].map(code)) {
      expect(src).not.toMatch(/four billion|4_000_000_000|Built for billions/i);
      expect(src).not.toMatch(/Freedom to (pay|move)/i);
      expect(src).not.toMatch(/military[- ]grade/i);
    }
    expect(existsSync(join(process.cwd(), 'components/landing/v2/FilmSection.tsx'))).toBe(false);
  });

  it('the network sentence follows the build, in the page and the footer', () => {
    expect(landing).toMatch(/networkLabel\(\)/);
    expect(footer).toMatch(/ALPHA_LIVE\s*\n?\s*\?\s*" on Aztec Alpha with real funds and a cap per payment\. "/);
    expect(footer).toMatch(/only on the Aztec test network with tokens that have no value/);
    // The early-access and affiliation disclaimers stay.
    expect(footer).toMatch(/Ledger Chat is in early access/);
    expect(footer).toMatch(/Not affiliated with Humanity Protocol, Ledger SAS\s+or the Aztec Foundation/);
    expect(showcase).toMatch(/our payment contracts have not been independently audited yet/);
  });

  it('credit: made by Humanity Ledger, built on Aztec Network (never "made by" Aztec, never "Corp." before a company exists)', () => {
    expect(footer).toMatch(/LEGAL_ENTITY\.kind === "company" \? LEGAL_ENTITY\.name : LEGAL_ENTITY\.tradingName/);
    expect(footer).toMatch(/made by \{MAKER\}\. Built on/);
    expect(code(footer)).not.toMatch(/Corp\./);
    expect(code(footer)).not.toMatch(/& Aztec Network/);
  });

  it('the bar and the footer say Ledger Chat', () => {
    expect(nav).toMatch(/<HLLogo size=\{30\} label="Ledger Chat" \/>/);
    expect(nav).toMatch(/aria-label="Ledger Chat home"/);
    expect(footer).toMatch(/Ledger <em>Chat<\/em>/);
  });

  it('every in-page link points at a section that exists', () => {
    const ids = new Set([...landing.matchAll(/id="([\w-]+)"/g), ...showcase.matchAll(/id="([\w-]+)"/g)].map((m) => m[1]));
    for (const src of [landing, footer, nav]) {
      for (const m of src.matchAll(/href="\/?#([\w-]+)"/g)) expect(ids.has(m[1]), `#${m[1]}`).toBe(true);
    }
  });
});

describe('landing: motion stays on the compositor', () => {
  it('scroll effects are scroll timelines that animate transform and opacity only', () => {
    expect(story).toMatch(/@supports \(animation-timeline: view\(\)\)/);
    expect(story).toMatch(/prefers-reduced-motion: no-preference/);
    const keyframes = [...story.matchAll(/@keyframes\s+\w+\s*\{([^]*?)\n\}/g)].map((m) => m[1]);
    expect(keyframes.length).toBeGreaterThan(3);
    for (const k of keyframes) {
      const props = [...k.matchAll(/([a-z-]+)\s*:/g)].map((m) => m[1]);
      for (const p of props) expect(['opacity', 'transform']).toContain(p);
    }
  });
});

describe('glyph field', () => {
  it('ramps from a dot to the letters of AZTEC', () => {
    expect(RAMP[0]).toBe('.');
    expect(RAMP.slice(-4).join('')).toBe('ZECA');
    for (const ch of 'AZTEC') expect(RAMP).toContain(ch);
  });

  it('hash and noise are stable and in range', () => {
    expect(hash(3, 7)).toBe(hash(3, 7));
    for (let i = 0; i < 200; i++) {
      const h = hash(i, i * 3);
      const n = noise(i / 7, i / 11);
      expect(h).toBeGreaterThanOrEqual(0);
      expect(h).toBeLessThan(1);
      expect(n).toBeGreaterThanOrEqual(0);
      expect(n).toBeLessThanOrEqual(1);
    }
  });

  it('uses the open-licence display serif, never the commercial face aztec.network licenses', () => {
    const g = read('components/immersive/glyphs.ts');
    expect(g).toMatch(/--font-display/);
    expect(g).not.toMatch(/font = [^;]*Arizona/);
  });
});
