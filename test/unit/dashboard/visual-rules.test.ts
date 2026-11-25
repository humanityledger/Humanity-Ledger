/**
 * The dashboard's visual rules, so they hold after the next change too: white page, black ink,
 * greys only; nothing moves; no radius, shadow, gradient or blur; no icons, spinners or skeletons;
 * one light theme. components/dashboard/dashboard.module.css says the same at its top.
 */
import { describe, expect, it } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';

const DIR = 'components/dashboard';
const strip = (src: string) => src.replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '');
const CSS = strip(fs.readFileSync(path.join(DIR, 'dashboard.module.css'), 'utf8'));
const TSX = fs
  .readdirSync(DIR)
  .filter((f) => f.endsWith('.tsx'))
  .map((f) => ({ f, src: strip(fs.readFileSync(path.join(DIR, f), 'utf8')) }));

function rules(css: string): { sel: string; body: string }[] {
  const out: { sel: string; body: string }[] = [];
  for (const m of css.replace(/@media[^{]+\{/g, '').matchAll(/([^{}]+)\{([^{}]*)\}/g)) out.push({ sel: m[1].trim(), body: m[2] });
  return out;
}

describe('dashboard visual rules', () => {
  it('has the files to check', () => {
    expect(TSX.length).toBeGreaterThanOrEqual(5);
    expect(rules(CSS).length).toBeGreaterThan(40);
  });

  it('nothing moves: no animation, transition or transform', () => {
    expect(CSS).not.toMatch(/@keyframes|animation|transition|transform|scroll-behavior:\s*smooth|will-change/);
    for (const { f, src } of TSX) {
      expect(src, f).not.toMatch(/\banimation\b|\btransition\b|transform\s*:|translate[XYZ3d]*\(|behavior:\s*['"]smooth['"]|framer-motion|react-spring/);
    }
  });

  it('no shadow, gradient, blur or filter', () => {
    expect(CSS).not.toMatch(/box-shadow|text-shadow|gradient\(|blur\(|backdrop-filter|\bfilter\s*:|opacity\s*:/);
  });

  it('corners stay square (at most 2 px)', () => {
    for (const m of CSS.matchAll(/border-radius\s*:\s*([^;}]+)/g)) {
      for (const v of m[1].trim().split(/\s+/)) expect(v === '0' || /^[0-2](\.\d+)?px$/.test(v), m[0]).toBe(true);
    }
  });

  it('black, white and greys only', () => {
    const colours = [...CSS.matchAll(/#([0-9a-fA-F]{3}|[0-9a-fA-F]{6})\b|rgba?\(([^)]*)\)|hsla?\(([^)]*)\)/g)];
    expect(colours.length).toBeGreaterThan(0);
    for (const c of colours) {
      if (c[1]) {
        const h = c[1].length === 3 ? c[1].replace(/./g, '$&$&') : c[1];
        const [r, g, b] = [0, 2, 4].map((i) => h.slice(i, i + 2).toLowerCase());
        expect(r === g && g === b, c[0]).toBe(true);
      } else if (c[2]) {
        const [r, g, b] = c[2].split(',').map((x) => x.trim());
        expect(r === g && g === b, c[0]).toBe(true);
      } else {
        expect(c[0], 'no hsl colours').toBe('');
      }
    }
    expect(CSS).not.toMatch(/\b(red|green|blue|orange|yellow|purple|teal|crimson|gold)\b/);
    for (const { f, src } of TSX) {
      expect(src, f).not.toMatch(/#[0-9a-fA-F]{3,8}\b(?![-\w])|rgba?\(|hsla?\(/);
      expect(src, f).not.toMatch(/style=\{\{[^}]*\b(color|background|border)\s*:/);
    }
  });

  it('no icon library, glyph markers or emoji', () => {
    for (const { f, src } of TSX) {
      expect(src, f).not.toMatch(/from ['"](lucide-react|react-icons[^'"]*|@heroicons[^'"]*|@radix-ui\/react-icons)['"]/);
      expect(src, f).not.toMatch(/\p{Extended_Pictographic}|[✓✔✗✕→←↗↘⚠]/u);
      expect(src, f).not.toMatch(/<svg|<img/);
    }
  });

  it('no spinner, skeleton or pulse: waiting states are words', () => {
    expect(CSS).not.toMatch(/spinner|shimmer|skeleton|pulse/i);
    for (const { f, src } of TSX) expect(src, f).not.toMatch(/spinner|shimmer|skeleton|pulse|Loader2|<progress/i);
  });

  it('one light theme: no dark mode switch', () => {
    expect(CSS).not.toMatch(/data-theme|prefers-color-scheme/);
    for (const { f, src } of TSX) expect(src, f).not.toMatch(/data-theme|prefers-color-scheme|toggleTheme|'dark'/);
  });

  it('controls are big enough to tap', () => {
    const want: Record<string, number> = { '.btn': 40, '.tab': 44, '.row': 44, '.textBtn': 32, '.toggle button': 32, '.select, .search': 36 };
    const all = rules(CSS);
    for (const [sel, min] of Object.entries(want)) {
      const r = all.find((x) => x.sel === sel);
      expect(r, sel).toBeTruthy();
      const h = /min-height:\s*(\d+)px/.exec(r!.body);
      expect(h && Number(h[1]) >= min, `${sel} min-height ≥ ${min}px`).toBe(true);
    }
  });

  it('phones get 16 px inputs (no zoom on focus in iOS Safari)', () => {
    expect(CSS).toMatch(/@media \(max-width: 640px\) \{ \.search, \.select \{ font-size: 16px; \} \}/);
  });

  it('beats .site a specificity on links and button links, omits zero-moved tokens in PeopleView, and never tags XMTP as public chain', () => {
    expect(CSS).toMatch(/\.dash a\[href\]/);
    expect(CSS).toMatch(/\.dash a\.btn\b/);
    expect(CSS).not.toMatch(/:where\(\.dash\) a\b/);
    const views = TSX.find((x) => x.f === 'Views.tsx')?.src ?? '';
    expect(views).toMatch(/v\[pick\]\s*>\s*0n/);
    expect(views).not.toMatch(/id="mg-net"\s+src=\{\['public'\]\}/);
  });
});
