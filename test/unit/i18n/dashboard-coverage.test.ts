/**
 * The dashboard in every language: every text it shows, including those it looks up from its own
 * tables (tabs, kinds, statuses, the data inventory, alerts), has an entry in each dictionary.
 */
import { describe, expect, it } from 'vitest';
import fs from 'node:fs';

/** Every component of the dashboard, not a fixed list: a new file is covered the day it is added. */
const COMPONENTS = fs
  .readdirSync('components/dashboard')
  .filter((f) => f.endsWith('.tsx'))
  .map((f) => `components/dashboard/${f}`);

function dashboardTexts(): Set<string> {
  const src = COMPONENTS.map((f) => fs.readFileSync(f, 'utf8')).join('\n');
  const out = new Set<string>();
  for (const m of src.matchAll(/\bt\(\s*(['"])((?:(?!\1)[^\\]|\\.)*)\1/g)) out.add(m[2].replace(/\\'/g, "'"));
  const keys = 'label|what|from|where|why|signing|starting|deploying|ready|send|receive|shield|unshield|faucet|issue|deploy|operator|settled|pending|proving|failed|local|proof|public';
  for (const m of src.matchAll(new RegExp(`(?:${keys}): (['"])((?:(?!\\1)[^\\\\]|\\\\.)*)\\1`, 'g'))) out.add(m[2].replace(/\\'/g, "'"));
  for (const m of fs.readFileSync('lib/dashboard/model.ts', 'utf8').matchAll(/text: '((?:[^'\\]|\\.)*)'/g)) out.add(m[1]);
  // The ages on the live line ("12 s ago"), from lib/dashboard/live.ts.
  for (const m of fs.readFileSync('lib/dashboard/live.ts', 'utf8').matchAll(/key: '((?:[^'\\]|\\.)*)'/g)) out.add(m[1]);
  return new Set([...out].filter((x) => /[A-Za-z]{2}/.test(x)));
}

describe('dashboard texts', () => {
  const texts = dashboardTexts();
  it('reads every component', () => expect(COMPONENTS.length).toBeGreaterThanOrEqual(5));
  it('finds them', () => expect(texts.size).toBeGreaterThan(180));
  for (const l of ['es', 'ru', 'de', 'zh']) {
    it(`${l}: every dashboard text has an entry`, () => {
      const dict: Record<string, string> = JSON.parse(fs.readFileSync(`lib/i18n/messages/${l}.json`, 'utf8'));
      const missing = [...texts].filter((k) => !(k in dict));
      expect(missing, missing.slice(0, 15).join('\n')).toEqual([]);
    });
  }
});
