import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';

const read = (p: string) => readFileSync(p, 'utf8');

describe('mobile rendering and the world in dots (19/11/2026)', () => {
  it('pinned scenes are never skipped by content-visibility (white screens on a finger flick)', () => {
    const css = read('components/landing/immersive/Immersive.module.css').replace(/\/\*[^]*?\*\//g, '');
    expect(css).not.toMatch(/\.pin\s*\{[^}]*content-visibility/);
    expect(css).not.toMatch(/\.scene:not\(\[data-near\]\) \.pin \{ content-visibility/);
  });
  it('films play on touch screens instead of seeking on every frame', () => {
    expect(read('components/landing/immersive/Islands.tsx')).toMatch(/const touch = window\.matchMedia\('\(pointer: coarse\)'\)\.matches;\s*if \(touch \|\|/);
  });
  it('the map is real land data, public domain, one degree', () => {
    const land = JSON.parse(read('public/globe/flat-land.json'));
    expect(land.source).toMatch(/Natural Earth .*public domain/);
    expect(land.step).toBe(1);
    expect(land.cols).toBe(360);
    const dots = land.rows.reduce((n: number, r: number[]) => n + r.filter((_, i) => i % 2 === 1).reduce((a, b) => a + b, 0), 0);
    expect(dots).toBe(15351);
  });
  it('the map is sharp at the screen resolution (up to 3x, at most 8,192 px) and nothing pulses', () => {
    const map = read('components/landing/immersive/DotWorld.tsx');
    expect(map).toMatch(/Math\.min\(window\.devicePixelRatio \|\| 1, 3, 8192 \/ W\)/);
    expect(map).not.toMatch(/pulse|setInterval/);
    expect(read('components/landing/immersive/ImmersiveLanding.tsx')).toMatch(/<DotWorld \/>/);
  });
  it('Aztec is credited as what is true, linked to aztec.network (in text until D-1 is decided)', () => {
    const page = read('components/landing/immersive/ImmersiveLanding.tsx');
    expect(page).toMatch(/Built on\s*<a href="https:\/\/aztec\.network"/);
    expect(page).toMatch(/<a href="https:\/\/ethereum\.org"[^>]*aria-label="Ethereum"><Mark name="ethereum" \/><\/a>/);
    expect(page).not.toMatch(/Live on \$\{NETWORK\}/);
    expect(page).not.toMatch(/partner|official|backed by/i);
    expect(read('public/brand/aztec/README.md')).toMatch(/media-kit/);
  });
});

describe('the land masks reach visitors without a session', () => {
  it('public/globe is outside the middleware, like fonts/ and images/', () => {
    const mw = readFileSync('middleware.ts', 'utf8');
    expect(mw).toMatch(/\|fonts\/\|images\/\|icons\/\|globe\/\)/);
    // Only that folder: API routes and pages still go through the middleware.
    expect(mw).toMatch(/'\/api\/:path\*'/);
  });
});

describe('official Ethereum mark and no blank screens', () => {
  it('the Ethereum diamond is the file from ethereum.org, recorded with its source', () => {
    expect(readFileSync('public/brand/ethereum/eth-diamond-black.svg', 'utf8')).toMatch(/viewBox="0 0 1920 1920"/);
    expect(readFileSync('public/brand/ethereum/README.md', 'utf8')).toMatch(/ethereum\/ethereum-org-website/);
  });
  it('captions are visible as soon as their scene is (blank screens between scenes, 19/11/2026)', () => {
    const css = readFileSync('components/landing/immersive/Immersive.module.css', 'utf8');
    expect(css).toMatch(/\.caption \{[^}]*opacity: 1; transform/);
    expect(readFileSync('scripts/ui/landing-webkit.mjs', 'utf8')).toMatch(/elementsFromPoint/);
  });
});
