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
  it('Aztec is credited as what is true, with the wordmark file of the brand kit', () => {
    const page = read('components/landing/immersive/ImmersiveLanding.tsx');
    expect(page).toMatch(/aria-label="Built on Aztec Network"/);
    expect(page).not.toMatch(/partner|official|backed by/i);
    expect(read('public/brand/aztec/README.md')).toMatch(/media-kit/);
  });
});
