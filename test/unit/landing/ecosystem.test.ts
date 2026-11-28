/**
 * Aztec ecosystem section of the landing (28 Nov 2026): every app listed on aztec.network/apps,
 * each linking out with its favicon and a letter tile when the icon does not load.
 */
import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { ECOSYSTEM } from '@/lib/landing/chapters';

const site = readFileSync('components/landing/site/SiteLanding.tsx', 'utf8');
const css = readFileSync('components/landing/site/site.module.css', 'utf8');

describe('Aztec ecosystem on the landing', () => {
  it('lists the thirteen apps of aztec.network/apps, once each', () => {
    const names = ECOSYSTEM.apps.map((a) => a.brand);
    expect(names.length).toBe(13);
    expect(new Set(ECOSYSTEM.apps.map((a) => a.slug)).size).toBe(13);
    for (const n of ['Aztecscan', 'Galactica', 'Nemi', 'Nulo', 'Nyx', 'Olla', 'RavenHouse', 'RollingChat', 'Shield', 'Xochi', 'zk.money', 'ZKPassport']) {
      expect(names).toContain(n);
    }
    expect(ECOSYSTEM.more.href).toBe('https://aztec.network/apps');
  });

  it('links over https and names icon hosts without a scheme or path', () => {
    for (const a of ECOSYSTEM.apps) {
      expect(a.url, a.slug).toMatch(/^https:\/\/[a-z0-9.-]+\//);
      expect(a.icon, a.slug).toMatch(/^([a-z0-9-]+\.)+[a-z]{2,}$|^$/);
      expect(['Available', 'Alpha', 'Check availability']).toContain(a.availability);
    }
  });

  it('opens each app in a new tab without a referrer and keeps a letter fallback', () => {
    expect(site).toContain('id="ecosystem"');
    expect(site).toMatch(/target="_blank" rel="noopener noreferrer"/);
    expect(site).toContain('referrerPolicy="no-referrer"');
    expect(site).toContain('data-l=');
    expect(css).toMatch(/\.ecoIcon img::after \{ content: attr\(data-l\)/);
  });
});
