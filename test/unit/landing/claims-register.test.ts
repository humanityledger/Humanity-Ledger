/**
 * The claims register is the contract between the landing and the code (landing brief and
 * build-out prompt of 21 November 2026). These checks fail when:
 *  - a row's evidence path does not exist;
 *  - a row marked Live is controlled by a switch that is off;
 *  - the landing, the brief or the page copy contains a banned word or item;
 *  - a status word outside the four labels appears.
 */
import { describe, expect, it } from 'vitest';
import { existsSync, readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';
import { BANNED, CLAIMS, LABELS } from '@/lib/landing/claims';
import * as K from '@/lib/landing/chapters';

const root = process.cwd();
const read = (p: string) => readFileSync(join(root, p), 'utf8');
const SITE = 'components/landing/site';
const siteFiles = readdirSync(join(root, SITE)).filter((f) => f.endsWith('.tsx')).map((f) => `${SITE}/${f}`);
/** Everything a visitor of "/" and "/brief" reads. /record is the reviewer page and may hold hashes. */
const landingSources = [...siteFiles, 'lib/landing/chapters.ts', 'app/page.tsx', 'app/brief/page.tsx'];
const copy = JSON.stringify(K.ALL_COPY);

describe('claims register', () => {
  it('every evidence path exists in the repository', () => {
    for (const c of CLAIMS) for (const p of c.evidence) expect(existsSync(join(root, p)), `${c.id}: ${p}`).toBe(true);
  });

  it('no row is Live while its controlling switch is off', () => {
    for (const c of CLAIMS) {
      const sw = (c as { switch?: { name: string; on: boolean } }).switch;
      if (sw && !sw.on) expect(c.label, `${c.id} is controlled by ${sw.name}, which is off`).not.toBe('Live');
    }
  });

  it('uses only the four status words', () => {
    for (const c of CLAIMS) expect(LABELS).toContain(c.label);
    for (const f of K.FEATURES) expect(CLAIMS.map((c) => c.id)).toContain(f.claim);
  });

  it('USDC and the relay are never shown as live', () => {
    expect(CLAIMS.find((c) => c.id === 'usdc')?.label).toBe('Not enabled yet');
    expect(CLAIMS.find((c) => c.id === 'relay')?.label).toBe('In design');
    expect(K.RELAY.never).toMatch(/never carries payments/);
  });
});

describe('the landing says only what the register allows', () => {
  it('no banned word, in the copy or in any file of the page', () => {
    for (const re of BANNED) {
      expect(copy, String(re)).not.toMatch(re);
      for (const f of landingSources) expect(read(f), `${f} ${re}`).not.toMatch(re);
    }
  });

  it('no token name, hash or block number on the landing (they live on /record)', () => {
    for (const f of [...siteFiles, 'lib/landing/chapters.ts', 'app/page.tsx']) {
      const src = read(f);
      expect(src, f).not.toMatch(/\bHLC\b/);
      expect(src, f).not.toMatch(/0x[0-9a-f]{16,}/i);
      expect(src, f).not.toMatch(/\bblock\s+\d{3,}/i);
    }
  });

  it('no user count, throughput figure or field-test claim without a log', () => {
    expect(copy).not.toMatch(/\b\d[\d,.]*\s*(users|accounts|visitors|downloads|people|transfers|tps)\b/i);
    expect(copy).not.toMatch(/\b\d+\s*(hours|km)\b/i);
  });

  it('the limits sit next to the claims they limit', () => {
    expect(K.PAYMENT.honest).toMatch(/account that pays the network fee[^.]*public/);
    expect(K.MESSAGES.limit).toMatch(/not all metadata/);
    const server = K.VISIBILITY.rows.filter((r) => !r.e2e).map((r) => r.part);
    expect(server).toEqual(expect.arrayContaining(['Contacts', 'Communities', 'Status']));
  });

  it('sections are named, never numbered', () => {
    for (const f of siteFiles) expect(read(f), f).not.toMatch(/\{pad\(|\b0\d \/ \d{2}\b/);
  });
});

describe('the site tree stays light', () => {
  it('only the four moments and the copy button run in the browser', () => {
    const clients = siteFiles.filter((f) => /^'use client'/.test(read(f))).map((f) => f.split('/').pop());
    expect(clients.sort()).toEqual(['Architecture.tsx', 'CopyText.tsx', 'HeroConversation.tsx', 'ProofSequence.tsx', 'ZkAnalogy.tsx']);
  });

  it('never imports the previous trees, a scroll library or a tracker', () => {
    for (const f of siteFiles) {
      const src = read(f);
      expect(src, f).not.toMatch(/from ['"][^'"]*landing\/(immersive|mobile|v2)\b|lenis|locomotive|framer-motion|gtag|googletagmanager|segment\.com/);
      expect(src, f).not.toMatch(/addEventListener\(\s*['"](scroll|wheel|touchmove)['"]/);
    }
  });

  it('animates transform and opacity only, with a reduced-motion state', () => {
    const css = read(`${SITE}/site.module.css`);
    expect(css).toMatch(/prefers-reduced-motion: reduce/);
    for (const m of css.matchAll(/@keyframes [a-z-]+ \{([^@]*?)\}\s*\}/g)) {
      for (const p of m[1].matchAll(/([a-z-]+)\s*:/g)) expect(['opacity', 'transform']).toContain(p[1]);
    }
    expect(css).not.toMatch(/scroll-behavior:\s*smooth/);
  });

  it('the reviewer pages are public', () => {
    const mw = read('middleware.ts');
    for (const p of ['/record', '/brief', '/security', '/trust']) {
      expect(mw).toContain(`'${p}',`);
      expect(read('lib/routing/publicPages.ts')).toContain(`'${p}',`);
    }
  });
});
