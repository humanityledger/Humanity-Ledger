import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';

describe('npm run ship', () => {
  const sh = readFileSync('scripts/ship.sh', 'utf8');
  it('only ships a clean main, after a fast-forward pull', () => {
    expect(sh).toMatch(/!= "main"/);
    expect(sh).toMatch(/git status --porcelain/);
    expect(sh).toMatch(/git pull --ff-only origin main/);
  });
  it('runs the type check and the unit tests unless --fast, and never force-pushes', () => {
    expect(sh).toMatch(/npx tsc --noEmit/);
    expect(sh).toMatch(/npx vitest run/);
    expect(sh).not.toMatch(/--force|-f origin/);
  });
  it('is wired as an npm script', () => {
    expect(JSON.parse(readFileSync('package.json', 'utf8')).scripts.ship).toBe('bash scripts/ship.sh');
  });
});
