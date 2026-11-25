/**
 * The documentation in every language (lib/docs/i18n.ts). 25 November 2026: the interface was
 * translated, but the bodies of the /docs pages (about 2,000 texts) were still English in
 * Español, Русский, Deutsch and 中文.
 *
 * Fails when a page text, a diagram label or a figure text has no entry in a documentation
 * dictionary (lib/i18n/docs/<locale>.json), or when a translation loses inline code, a link
 * target, bold markers or a placeholder.
 */
import { describe, expect, it } from 'vitest';
import fs from 'node:fs';
import { NAV, headingId } from '@/lib/docs/registry';
import { BLOG_POSTS } from '@/lib/docs/pages/company';
import { ENGLISH_ONLY_NOTE, ENGLISH_ONLY_SLUGS, ENGLISH_PREVAILS_NOTE, NOTE_TITLE, docTexts, translatePage, translatorFrom } from '@/lib/docs/i18n';
import { layoutDiagram, textWidth, wrap } from '@/lib/docs/diagram';

const LANGS = ['es', 'ru', 'de', 'zh'] as const;

function figureTexts(): string[] {
  const src = fs.readFileSync('components/docs/v2/Figures.tsx', 'utf8');
  const out: string[] = [];
  for (const m of src.matchAll(/"([^"\n]*[A-Za-z][^"\n]*)"/g)) {
    const s = m[1];
    if (/^[a-z-]+$/.test(s) || /[{}=]|^\.|\.tsx?$|^lucide|^@\/|^--/.test(s) || s.startsWith('use ')) continue;
    out.push(s);
  }
  for (const m of src.matchAll(/>\s*([^<>{}\n]*[A-Za-z][^<>{}\n]*?)\s*</g)) out.push(m[1]);
  return out;
}

function allTexts(): Set<string> {
  const keys = new Set<string>();
  const add = (s: string) => { if (s && /\p{L}/u.test(s)) keys.add(s.trim()); };
  for (const g of NAV) {
    add(g.title);
    for (const p of g.pages) docTexts(p, g.title).forEach(add);
  }
  add('Blog');
  for (const p of BLOG_POSTS) docTexts(p.page, 'Blog').forEach(add);
  [ENGLISH_ONLY_NOTE, ENGLISH_PREVAILS_NOTE, NOTE_TITLE].forEach(add);
  figureTexts().forEach(add);
  return keys;
}

const codes = (s: string) => (s.match(/`[^`]+`/g) || []).sort().join('\u0001');
const links = (s: string) => [...s.matchAll(/\]\(([^)\s]+)\)/g)].map((m) => m[1]).sort().join('\u0001');
const bold = (s: string) => (s.match(/\*\*/g) || []).length;
const ph = (s: string) => (s.match(/\{\w+\}/g) || []).sort().join(',');

describe('documentation dictionaries', () => {
  const keys = allTexts();

  it('finds the texts', () => {
    expect(keys.size).toBeGreaterThan(1500);
  });

  for (const l of LANGS) {
    const dict: Record<string, string> = JSON.parse(fs.readFileSync(`lib/i18n/docs/${l}.json`, 'utf8'));

    it(`${l}: every documentation text has an entry`, () => {
      const missing = [...keys].filter((k) => !(k in dict));
      expect(missing, missing.slice(0, 15).join('\n')).toEqual([]);
    });

    it(`${l}: translations keep code, links, bold and placeholders`, () => {
      const bad = Object.entries(dict)
        .filter(([k, v]) => !v || codes(k) !== codes(v) || links(k) !== links(v) || bold(k) !== bold(v) || ph(k) !== ph(v))
        .map(([k]) => k);
      expect(bad, bad.slice(0, 10).join('\n')).toEqual([]);
    });

    it(`${l}: pages render translated, anchors stay English, legal text stays English`, () => {
      const tr = translatorFrom(dict);
      for (const g of NAV) {
        for (const p of g.pages) {
          const shown = translatePage(p, tr);
          const heads = p.blocks.filter((b) => b.t === 'h2' || b.t === 'h3') as { text: string; id?: string }[];
          const shownHeads = shown.blocks.filter((b) => b.t === 'h2' || b.t === 'h3') as { text: string; id?: string }[];
          heads.forEach((h, i) => expect(shownHeads[i].id).toBe(headingId(h.text, h.id)));
          if (ENGLISH_ONLY_SLUGS.has(p.slug)) {
            expect(shown.blocks.slice(1)).toEqual(p.blocks);
            expect(shown.blocks[0]).toMatchObject({ t: 'hint', text: dict[ENGLISH_ONLY_NOTE] });
          }
          for (const b of p.blocks) if (b.t === 'diagram') expect(() => layoutDiagram(b.code, tr)).not.toThrow();
        }
      }
    });
  }

  it('the sidebar labels and group names are in the interface dictionaries', () => {
    for (const l of LANGS) {
      const ui: Record<string, string> = JSON.parse(fs.readFileSync(`lib/i18n/messages/${l}.json`, 'utf8'));
      const missing = NAV.flatMap((g) => [g.title, ...g.pages.map((p) => p.label)]).filter((k) => !(k in ui));
      expect(missing, `${l}: ${missing.join(', ')}`).toEqual([]);
    }
  });
});

describe('diagram text in other scripts', () => {
  it('Chinese is measured wide and wraps between characters', () => {
    expect(textWidth('私密支付', 14)).toBeGreaterThan(textWidth('abcd', 14) * 1.5);
    const lines = wrap('你的设备在本地加密消息并生成私密支付的证明然后发送', 120, 14);
    expect(lines.length).toBeGreaterThan(1);
    for (const line of lines) expect(textWidth(line, 14)).toBeLessThanOrEqual(120 + 14);
  });
});
