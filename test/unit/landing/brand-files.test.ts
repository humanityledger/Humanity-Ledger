/** Package 7: every third-party mark the site shows is recorded with its source, date and conditions. */
import fs from 'node:fs';
import * as C from '@/lib/landing/content';

describe('third-party marks', () => {
  const readme = fs.readFileSync('public/brand/README.md', 'utf8');
  it('every file in BRAND_FILES has an entry with source, download date and conditions', () => {
    for (const [name, file] of Object.entries(C.BRAND_FILES)) {
      if (!file) continue;
      const at = readme.indexOf(`## ${file}`);
      expect(at, `${name}: ${file} has no entry in public/brand/README.md`).toBeGreaterThanOrEqual(0);
      const entry = readme.slice(at, readme.indexOf('\n## ', at + 1) === -1 ? undefined : readme.indexOf('\n## ', at + 1));
      expect(entry).toMatch(/\*\*Source:\*\*/);
      expect(entry).toMatch(/\*\*Downloaded:\*\* \d{2}\/\d{2}\/\d{4}/);
      expect(entry).toMatch(/\*\*Conditions:\*\*/);
      expect(fs.existsSync(`public${file}`), file).toBe(true);
    }
  });
  it('the Aztec wordmark is not shown until its brand rules are in writing (D-1)', () => {
    expect(C.BRAND_FILES.aztec).toBeNull();
    expect(fs.readFileSync('lib/docs/pages/brand.ts', 'utf8')).not.toMatch(/\/brand\/aztec\//);
  });
});
