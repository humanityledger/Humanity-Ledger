/**
 * The documentation diagrams (lib/docs/diagram.ts, lib/docs/pages/diagrams.ts): there are at
 * least forty, every one parses into something drawable, no two boxes overlap, and the text
 * follows the writing rules of the documentation.
 */
import { describe, expect, it } from 'vitest';
import { layoutDiagram, parseDiagram, textWidth, wrap } from '@/lib/docs/diagram';
import { DIAGRAM_COUNT, DIAGRAM_PAGES } from '@/lib/docs/pages/diagrams';
import { NAV } from '@/lib/docs/registry';
import { guide } from '@/lib/docs/pages/guide';

const all = [...DIAGRAM_PAGES, guide].flatMap((p) => p.blocks.filter((b): b is Extract<typeof b, { t: 'diagram' }> => b.t === 'diagram').map((b) => ({ page: p.slug, ...b })));

const overlap = (a: { x: number; y: number; w: number; h: number }, b: { x: number; y: number; w: number; h: number }) =>
  a.x < b.x + b.w - 0.5 && b.x < a.x + a.w - 0.5 && a.y < b.y + b.h - 0.5 && b.y < a.y + a.h - 0.5;

describe('documentation diagrams', () => {
  it('there are at least forty, on pages listed in the navigation', () => {
    expect(DIAGRAM_COUNT).toBeGreaterThanOrEqual(40);
    const slugs = NAV.flatMap((g) => g.pages.map((p) => p.slug));
    for (const p of DIAGRAM_PAGES) expect(slugs).toContain(p.slug);
  });

  it('every diagram parses and lays out without overlapping boxes', () => {
    for (const d of all) {
      const ast = parseDiagram(d.code);
      const L = layoutDiagram(d.code);
      expect(Number.isFinite(L.width) && Number.isFinite(L.height), `${d.title}: size`).toBe(true);
      expect(L.width > 0 && L.height > 0, `${d.title}: empty`).toBe(true);
      if (ast.type === 'flow') {
        expect(ast.nodes.length >= 2, `${d.title}: nodes`).toBe(true);
        if (L.type !== 'flow') throw new Error('layout type');
        for (const n of L.nodes) expect([n.box.x, n.box.y, n.box.w, n.box.h].every(Number.isFinite), `${d.title}: ${n.id}`).toBe(true);
        for (let i = 0; i < L.nodes.length; i++) {
          for (let j = i + 1; j < L.nodes.length; j++) {
            expect(overlap(L.nodes[i].box, L.nodes[j].box), `${d.title}: ${L.nodes[i].id} overlaps ${L.nodes[j].id}`).toBe(false);
          }
        }
        for (const e of L.edges) expect(/NaN|undefined/.test(e.d), `${d.title}: edge ${e.from}-${e.to}`).toBe(false);
        // every edge names nodes that exist
        const ids = new Set(ast.nodes.map((n) => n.id));
        for (const e of ast.edges) expect(ids.has(e.from) && ids.has(e.to), `${d.title}: ${e.from}->${e.to}`).toBe(true);
      } else {
        expect(ast.actors.length >= 2, `${d.title}: actors`).toBe(true);
        expect(ast.items.some((i) => i.k === 'msg'), `${d.title}: messages`).toBe(true);
        // frames are balanced
        let depth = 0;
        for (const i of ast.items) { if (i.k === 'open') depth++; if (i.k === 'close') depth--; expect(depth >= 0, d.title!).toBe(true); }
        expect(depth, `${d.title}: unclosed frame`).toBe(0);
      }
    }
  });

  it('reads the Mermaid forms the pages use', () => {
    const f = parseDiagram('flowchart LR\n  A[One<br/>two]:::accent -->|x| B[(Db)]\n  B -.-> C((C))\n  C ==> D{Q}\n  A-->B');
    expect(f.type).toBe('flow');
    if (f.type !== 'flow') return;
    expect(f.nodes.map((n) => n.id)).toEqual(['A', 'B', 'C', 'D']);
    expect(f.nodes[0].title).toEqual(['One']);
    expect(f.nodes[0].sub).toEqual(['two']);
    expect(f.nodes[0].tone).toBe('accent');
    expect(f.nodes[1].shape).toBe('db');
    expect(f.edges.map((e) => [e.from, e.to, e.dashed, e.thick])).toEqual([['A', 'B', false, false], ['B', 'C', true, false], ['C', 'D', false, true], ['A', 'B', false, false]]);
    const q = parseDiagram('sequenceDiagram\n  participant S as Our server\n  D->>S: hello\n  S-->>D: back\n  Note over D,S: note');
    expect(q.type).toBe('seq');
    if (q.type !== 'seq') return;
    expect(q.actors.map((a) => a.id)).toEqual(['S', 'D']);
    expect(q.items.map((i) => i.k)).toEqual(['msg', 'msg', 'note']);
  });

  it('wraps long lines and measures text', () => {
    expect(wrap('a b c d e f g h i j k l m n o p', 40, 12).length).toBeGreaterThan(1);
    expect(textWidth('MMMM', 12)).toBeGreaterThan(textWidth('iiii', 12));
  });

  it('follows the writing rules: no dashes between words, no banned words', () => {
    for (const d of all) {
      const text = `${d.title ?? ''} ${d.caption} ${d.code}`;
      expect(/[–—·]/.test(text), `${d.title}: dash or middle dot`).toBe(false);
      expect(/\b(partner|official|endorsed|anonymous|untraceable|audited by)\b/i.test(text), `${d.title}: banned word`).toBe(false);
    }
  });
});
