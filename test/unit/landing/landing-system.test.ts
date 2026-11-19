import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { sceneState } from '@/components/landing/immersive/engine';

/**
 * One grammar for the landing (docs/plan/prompts/01-landing.md, "El sistema"): every font size,
 * radius, shadow and space in components/landing/immersive/ comes from the tokens on .page, and
 * the tokens themselves sit on the scales. A value outside them is a review error.
 */
const css = readFileSync('components/landing/immersive/Immersive.module.css', 'utf8').replace(/\/\*[^]*?\*\//g, '');
const tsx = readFileSync('components/landing/immersive/ImmersiveLanding.tsx', 'utf8');

const SPACE = [4, 8, 12, 16, 24, 32, 48, 64, 96, 128, 192];
const TYPE = [12, 14, 16, 18, 20, 24, 32, 44, 64, 88, 120];
const RADII = [12, 20, 28, 36, 999];

/** Declarations outside the token block: `prop: value` pairs, custom properties excluded. */
const declarations = (prop: RegExp) =>
  [...css.matchAll(/([a-z-]+)\s*:\s*([^;{}]+);/g)]
    .filter((m) => prop.test(m[1]) && !m[1].startsWith('--'))
    .map((m) => ({ prop: m[1], value: m[2].trim() }));
const tokens = (prefix: string) => [...css.matchAll(new RegExp(`--${prefix}(\\d+)\\s*:\\s*(\\d+)px`, 'g'))].map((m) => [Number(m[1]), Number(m[2])]);

describe('the landing has one design system', () => {
  it('the tokens are the scales: space on base 4, one type scale, four radii', () => {
    const s = tokens('s');
    const t = tokens('t');
    expect(s.map(([n]) => n)).toEqual(SPACE);
    for (const [n, px] of s) expect(px).toBe(n);
    expect(t.map(([n]) => n)).toEqual(TYPE);
    for (const [n, px] of t) expect(px).toBe(n);
    for (const r of ['chip: 12px', 'card: 20px', 'panel: 28px', 'window: 36px']) expect(css).toContain(`--r-${r}`);
  });

  it('every font size is a type token, or a fluid size between two steps of the scale', () => {
    for (const { value } of declarations(/^font-size$/)) {
      const fluid = /^clamp\((\d+)px, [\d.]+vw, (\d+)px\)$/.exec(value);
      if (fluid) {
        expect(TYPE).toContain(Number(fluid[1]));
        expect(TYPE).toContain(Number(fluid[2]));
      } else expect(value, value).toMatch(/^var\(--t\d+\)$/);
    }
  });

  it('every radius is a radius token or a circle', () => {
    for (const { value } of declarations(/^border-radius$/)) expect(value, value).toMatch(/^(var\(--r-[a-z]+\)|50%)$/);
    for (const r of [...css.matchAll(/--r-[a-z]+:\s*(\d+)px;/g)]) expect(RADII).toContain(Number(r[1]));
  });

  it('every shadow is a level, a hairline or the focus ring: never pure black', () => {
    for (const { value } of declarations(/^box-shadow$/)) {
      const parts = value.split(/,(?![^(]*\))/).map((x) => x.trim());
      for (const p of parts) expect(p, value).toMatch(/^(var\(--(sh\d|sh-cta(-hover)?|ring)\)|inset 0 0 0 (1px|var\(--hair\)) .+|none)$/);
    }
    expect(css).not.toMatch(/rgba\(0,\s*0,\s*0/);
  });

  it('every space is a space token, 0, auto, or a fluid margin between two steps', () => {
    for (const { prop, value } of declarations(/^(gap|padding|margin)(-[a-z]+)?$/)) {
      // the overlap of consecutive scenes: structure, not spacing
      if (prop === 'margin-top' && value === 'calc(-100svh - var(--fade))') continue;
      for (const part of value.split(/\s+(?![^(]*\))/)) {
        if (/^(0|auto)$/.test(part)) continue;
        if (/^var\(--(s\d+|margin|scene-gap|navh)\)$/.test(part)) continue;
        if (/^calc\(var\(--s4\) \/ 2\)$/.test(part)) continue;
        if (/^calc\(var\(--margin\) \+ var\(--s\d+\)\)$/.test(part)) continue;
        if (/^calc\(var\(--navh\) \+ var\(--s\d+\)\)$/.test(part)) continue;
        if (/^var\(--s\d+\)$/.test(part)) continue;
        throw new Error(`${prop}: ${value} is outside the spacing scale`);
      }
    }
  });

  it('three durations and two curves', () => {
    expect(css).toMatch(/--d1: 120ms; --d2: 240ms; --d3: 480ms;/);
    expect(css).toMatch(/--ease-in: cubic-bezier\(0\.22, 1, 0\.36, 1\);/);
    expect(css).toMatch(/--ease-state: cubic-bezier\(0\.4, 0, 0\.2, 1\);/);
    for (const m of css.matchAll(/transition:\s*([^;]+);/g)) {
      expect(m[1]).not.toMatch(/\d+m?s/);
      expect(m[1]).toMatch(/var\(--d\d\) var\(--ease-(in|state)\)/);
    }
  });

  it('every scene and chapter has the same anatomy: index, eyebrow, title with one emphasis', () => {
    expect(tsx).toMatch(/function Kicker/);
    const scenes = [...tsx.matchAll(/<Scene /g)].length;
    const captions = [...tsx.matchAll(/<Caption k="/g)].length;
    const chapters = [...tsx.matchAll(/<Chapter (id="[a-z]+" )?k="/g)].length;
    // the hero and the record lay out their own kicker
    expect(captions + 2).toBe(scenes);
    expect(scenes + chapters).toBe(15);
    expect(tsx).toMatch(/const ORDER = \[(?:'[a-z]+', ){14}'[a-z]+'\] as const;/);
  });

  it('no independence sentence, no partnership words, and the CTA is violet', () => {
    expect(tsx).not.toMatch(/independent project|partner|official|backed by/i);
    expect(css).toMatch(/\.cta, \.ctaBig \{[^}]*background: var\(--violet\)/);
  });
});

describe('the scroll engine cross-fades pinned scenes', () => {
  const vh = 800;
  const fade = 0.36 * vh;
  // scene B starts one screen plus a fade before the end of scene A
  const A = { top: 0, height: 2400, fadeIn: 0, fadeOut: fade };
  const B = { top: A.height - vh - fade, height: 2400, fadeIn: fade, fadeOut: 0 };

  it('A finishes its own story before B starts to fade in over it', () => {
    expect(sceneState(B.top, A, vh).p).toBe(1);
    expect(sceneState(B.top, B, vh)).toEqual({ p: 0, in: 0 });
  });

  it('B is fully drawn before A stops being pinned, so no frame is half-scrolled', () => {
    const unpinA = A.top + A.height - vh;
    expect(sceneState(unpinA, B, vh).in).toBe(1);
    expect(sceneState(unpinA, B, vh).p).toBe(0);
  });

  it('pure and reversible: the same position gives the same state up or down', () => {
    let prev = { p: -1, in: -1 };
    for (let y = 0; y <= B.top + B.height; y += 37) {
      const st = sceneState(y, B, vh);
      expect(st.p).toBeGreaterThanOrEqual(prev.p === -1 ? 0 : prev.p);
      expect(st.in).toBeGreaterThanOrEqual(prev.in === -1 ? 0 : prev.in);
      expect(sceneState(y, B, vh)).toEqual(st);
      prev = st;
    }
    expect(sceneState(B.top + B.height, B, vh)).toEqual({ p: 1, in: 1 });
  });

  it('the first scene has no fade, and a scene no taller than its fades is a step', () => {
    expect(sceneState(0, A, vh).in).toBe(1);
    const tiny = { top: 0, height: vh, fadeIn: 0, fadeOut: 0 };
    expect(sceneState(-1, tiny, vh).p).toBe(0);
    expect(sceneState(0, tiny, vh).p).toBe(1);
  });

  it('the CSS overlap is the one the engine reads: one screen plus the fade', () => {
    expect(css).toMatch(/\.scene \+ \.scene \{ margin-top: calc\(-100svh - var\(--fade\)\); \}/);
    expect(css).toMatch(/@property --in \{ syntax: '<number>'; inherits: false; initial-value: 1; \}/);
    expect(css).toMatch(/opacity: var\(--in\)/);
  });

  it('on phones and touch screens the scenes do not overlap and every pin is opaque', () => {
    const block = /@media \(max-width: 899px\), \(pointer: coarse\) \{([^}]*\}){3}\s*\}/.exec(css)?.[0] ?? '';
    expect(block).toMatch(/\.scene \+ \.scene \{ margin-top: 0; \}/);
    expect(block).toMatch(/\.pin \{ opacity: 1; \}/);
    // the hand film stays until the live phone has loaded
    expect(css).toMatch(/\.hero \.pin:has\(\.heroPhone \.phoneHold\) \.frame \{ opacity: 1;/);
  });
});
