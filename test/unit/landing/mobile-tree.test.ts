/**
 * The phone landing's rules, checked in its source (components/landing/mobile). Runtime checks
 * (frames, layout shifts, passive listeners) are in scripts/ui/landing-webkit.mjs; sizes in
 * scripts/ui/mobile-budget.mjs.
 */
import { describe, expect, it } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';

const dir = path.join(process.cwd(), 'components/landing/mobile');
const files = fs.readdirSync(dir).map((f) => ({ f, src: fs.readFileSync(path.join(dir, f), 'utf8') }));
const code = files.filter((x) => /\.(tsx?|ts)$/.test(x.f));
const css = files.filter((x) => x.f.endsWith('.css')).map((x) => x.src.replace(/\/\*[\s\S]*?\*\//g, '')).join('\n');
const strip = (s: string) => s.replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '');

describe('phone landing tree', () => {
  it('never imports the desktop landing, its engine, the globe, the phone or the scrubbed video', () => {
    for (const { f, src } of code) {
      const imports = [...src.matchAll(/(?:from|import\()\s*['"]([^'"]+)['"]/g)].map((m) => m[1]);
      for (const i of imports) expect(i, f).not.toMatch(/landing\/immersive|engine|Globe|LivePhone|ScenePhone|SceneVideo|DotWorld|landing\/v2/);
    }
  });

  it('has at most two client islands, Reveal and Enhance, and no React state', () => {
    const clients = code.filter((x) => /^['"]use client['"]/m.test(x.src)).map((x) => x.f).sort();
    expect(clients).toEqual(['Enhance.tsx', 'Reveal.tsx']);
    for (const { f, src } of code) expect(src, f).not.toMatch(/useState|useReducer|useSyncExternalStore/);
  });

  it('runs nothing per scroll frame and never blocks the finger', () => {
    for (const { f, src } of code) {
      const s = strip(src);
      expect(s, f).not.toMatch(/addEventListener\(\s*['"](scroll|touchstart|touchmove|wheel|resize)['"]/);
      expect(s, f).not.toMatch(/preventDefault|scrollTo\(|scrollBy\(|visualViewport/);
      expect(s, f).not.toMatch(/style\.setProperty|onScroll/);
    }
  });

  it('paints cheaply: no filters, blend modes, keyframe animations, pins or fixed layers', () => {
    expect(css).not.toMatch(/backdrop-filter|(^|[^-])filter\s*:|mix-blend-mode|@keyframes|animation\s*:|position:\s*fixed/m);
    expect(css).not.toMatch(/\b\d{2,}px\s+rgba?\(/); // no blur radius of 10 px or more in a shadow
    expect(css.match(/position:\s*sticky/g) ?? []).toHaveLength(1); // the 56 px header only
    expect(css).not.toMatch(/overflow\s*:\s*hidden[^;]*;[^}]*\}\s*html|touch-action\s*:\s*none/);
  });

  it('animates only opacity and transform, for 240 ms, and nothing with reduced motion', () => {
    const transitions = css.match(/transition\s*:[^;]+;/g) ?? [];
    expect(transitions.length).toBeGreaterThan(0);
    for (const t of transitions) {
      for (const part of t.replace(/transition\s*:/, '').replace(';', '').split(',')) {
        expect(part.trim(), t).toMatch(/^(opacity|transform) 240ms ease-out$/);
      }
    }
    expect(css).toMatch(/@media \(prefers-reduced-motion: no-preference\)/);
  });

  it('uses one font family and two weights, and the 16 / 20 / 28 / 40 scale', () => {
    const weights = new Set((css.match(/font-weight:\s*(\d+)/g) ?? []).map((w) => w.replace(/\D/g, '')));
    expect([...weights].sort()).toEqual(['400', '600']);
    const sizes = new Set((css.match(/font-size:\s*(\d+)px/g) ?? []).map((w) => w.replace(/\D/g, '')));
    for (const s of sizes) expect(['16', '20', '28', '40']).toContain(s);
    expect((css.match(/font-family:[^;]+/g) ?? []).filter((f) => !/monospace/.test(f))).toHaveLength(1);
  });

  it('sizes everything below the fold so the scroll never jumps', () => {
    expect(css).toMatch(/\.section\s*\{[^}]*content-visibility:\s*auto[^}]*contain-intrinsic-height/);
    const page = files.find((x) => x.f === 'MobileLanding.tsx')!.src;
    expect(page).toMatch(/fetchPriority: 'high'/);
    expect(page).toMatch(/loading: 'lazy'/);
    expect(page).toMatch(/preload="none"/);
  });

  it('keeps every link and line of fine print of the site footer', () => {
    const site = fs.readFileSync(path.join(process.cwd(), 'components/landing/v2/SiteFooter.tsx'), 'utf8');
    const mine = files.find((x) => x.f === 'MobileFooter.tsx')!.src;
    const items = [...site.matchAll(/\{ label: "([^"]+)", href: ([^,}]+)/g)].map((m) => [m[1], m[2].trim().replace(/"/g, "'")]);
    expect(items.length).toBeGreaterThan(20);
    for (const [label, href] of items) expect(mine, label).toContain(`{ label: '${label}', href: ${href}`);
    for (const line of ['Not a bank, broker, exchange or financial', 'Not affiliated with Humanity Protocol, Ledger SAS', 'internal security review, not an external audit, and private payments run', 'Please do not rely on the service to protect information or funds you cannot afford to lose.']) {
      expect(mine).toContain(line);
    }
  });
});
