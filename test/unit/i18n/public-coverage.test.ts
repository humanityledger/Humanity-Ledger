/**
 * The public website in every language. 25 November 2026: the landing hero line, its points and
 * many section texts stayed English in Español, Русский, Deutsch and 中文, because the landing copy
 * is data (lib/landing/chapters.ts) and some of it was printed without t(). The landing, the
 * security page and the trust centre now pass their data through translateDeep (lib/i18n/deep.ts);
 * this test fails when one of their texts has no entry in a dictionary.
 */
import { describe, expect, it } from 'vitest';
import fs from 'node:fs';
import * as chapters from '@/lib/landing/chapters';
import { textsDeep, translateDeep } from '@/lib/i18n/deep';

const CLAIM_WORDS = new Set(['Live', 'Closed alpha', 'Not enabled yet', 'In design']);

function pageTexts(): Set<string> {
  const set = textsDeep({ ...chapters });
  textsDeep(chapters.stackRows({ xmtp: '', aztecNr: '' }), undefined, set);
  for (const f of ['app/security/page.tsx', 'app/trust/page.tsx']) {
    const src = fs.readFileSync(f, 'utf8');
    for (const m of src.matchAll(/(?:part|how|standard|keys|who|can|cannot|mitigation|name|role|sees|what|why): '((?:[^'\\]|\\.)+)'/g)) set.add(m[1].replace(/\\'/g, "'"));
    for (const m of src.matchAll(/__t\('((?:[^'\\]|\\.)+)'/g)) set.add(m[1]);
  }
  return new Set([...set].filter((s) => /\p{L}{2}/u.test(s) && !CLAIM_WORDS.has(s) && !/^\d/.test(s)));
}

describe('public pages', () => {
  const texts = pageTexts();
  it('finds the texts', () => expect(texts.size).toBeGreaterThan(250));

  for (const l of ['es', 'ru', 'de', 'zh']) {
    it(`${l}: every landing, security and trust text has an entry`, () => {
      const dict: Record<string, string> = JSON.parse(fs.readFileSync(`lib/i18n/messages/${l}.json`, 'utf8'));
      // Names that stay as written (people, products, standards) may equal the English text.
      const missing = [...texts].filter((k) => !(k in dict));
      expect(missing, missing.slice(0, 15).join('\n')).toEqual([]);
    });
  }

  it('translateDeep leaves links, ids and non-text keys alone', () => {
    const out = translateDeep({ title: 'Hi', href: '/x', items: [{ id: 'a', text: 'Yo' }] }, (s) => `[${s}]`);
    expect(out).toEqual({ title: '[Hi]', href: '/x', items: [{ id: 'a', text: '[Yo]' }] });
  });

  it('the landing prints its data through translateDeep', () => {
    const src = fs.readFileSync('components/landing/site/SiteLanding.tsx', 'utf8');
    expect(src).toMatch(/const K = translateDeep\(/);
  });
});
