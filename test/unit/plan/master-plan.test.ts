import { describe, expect, it } from 'vitest';
import { existsSync, readFileSync } from 'node:fs';

describe('the master plan lives in the repository', () => {
  it('keeps the four prompts and the master prompt', () => {
    for (const f of ['00-master', '01-landing', '02-render-alpha', '03-scale-growth', '04-docs']) {
      expect(existsSync(`docs/plan/prompts/${f}.md`), f).toBe(true);
    }
  });
  it('lists the 14 PRs, in order, each with a status', () => {
    const plan = readFileSync('docs/plan/MASTER_PLAN.md', 'utf8');
    const rows = [...plan.matchAll(/^\| (\d+) \|/gm)].map((m) => Number(m[1]));
    expect(rows.filter((n) => n >= 1)).toEqual(Array.from({ length: 14 }, (_, i) => i + 1));
    expect(plan).toMatch(/\| (todo|open|merged|blocked)/);
  });
});
