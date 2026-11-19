import { describe, expect, it } from 'vitest';
import { readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';
import * as C from '@/lib/landing/content';
import mainnet from '../../../deployments/aztec-mainnet.json';

const DIR = 'components/landing/immersive';
const read = (p: string) => readFileSync(join(process.cwd(), p), 'utf8');
const sources = [...readdirSync(DIR).map((f) => read(join(DIR, f))), read('lib/landing/content.ts'), read('app/page.tsx')];
const text = JSON.stringify(C);

describe('the immersive landing says only what the code and the record back', () => {
  it('never claims an audit, E2E communities, a deployed portal, sponsorship or Studio', () => {
    for (const src of [...sources, text]) {
      expect(src).not.toMatch(/\baudited\b|audit seal|certified/i);
      expect(src).not.toMatch(/end[- ]to[- ]end[^.]{0,80}communit|communit[^.]{0,80}end[- ]to[- ]end/i);
      expect(src).not.toMatch(/partner|powered by Aztec Labs|backed by|sponsor/i);
      expect(src).not.toMatch(/\bStudio\b|\bQDS\b/);
      expect(src).not.toMatch(/revolutionary|unprecedented|military[- ]grade/i);
    }
    expect((mainnet as { audit: unknown }).audit).toBeNull();
    expect(C.PAYMENTS.small).toMatch(/internal security review, not an external audit/);
  });

  it('the portal copy follows the build: "next" until HLPortal is configured', () => {
    expect(C.PORTAL_DEPLOYED).toBe(Boolean(process.env.NEXT_PUBLIC_HL_PORTAL));
    expect(/next: written and tested, not yet deployed/.test(C.ETHEREUM.small)).toBe(!C.PORTAL_DEPLOYED);
  });

  it('no hand-written live figure: counts come from /api/stats/live or the build', () => {
    for (const src of sources) {
      expect(src).not.toMatch(/\b\d[\d,.]*\s*(users|accounts|visitors|downloads|people)\b/i);
      expect(src).not.toMatch(/thousands of|millions of|trusted by/i);
    }
  });

  it('the first payment is the recorded one, with the full note', () => {
    expect(C.FIRST_PAYMENT.block - C.FIRST_PAYMENT.tokenBlock).toBe(20);
    expect(C.FIRST_PAYMENT.tx).toMatch(/^0x[0-9a-f]{64}$/);
    expect(C.FIRST_PAYMENT.token).toBe('0x1f49571a48699da4e70e1b7dbc5afcea5bb712f7b2cfaf432353e694851e24e5');
    expect(C.RECORD.note).toMatch(/internal security review, not an external audit, and payments on Alpha have a cap per payment/);
    for (const m of C.MILESTONES) expect(m.hash).toMatch(/^0x[0-9a-f]{64}$/);
  });

  it('the wave-1 classes are the ones in the closed alpha record', () => {
    expect(C.WAVE1_CLASSES.map((c) => c.id)).toEqual((mainnet as { closedAlpha: { classes: string[] } }).closedAlpha.classes);
  });

  it('white mode only, native scroll, static page', () => {
    const all = sources.join('\n');
    expect(all).not.toMatch(/LandingMode|data-landing-theme|hl_landing_mode/);
    expect(all).not.toMatch(/preventDefault\(\)/);
    expect(all).not.toMatch(/lenis|locomotive|framer-motion/i);
    // Per-request render only for the CSP nonce: the page itself never touches the database.
    expect(read('app/page.tsx')).not.toMatch(/prisma|@\/lib\/db/);
    expect(read(`${DIR}/ImmersiveLanding.tsx`)).not.toMatch(/prisma|fetch\(/);
    expect(read(`${DIR}/engine.ts`)).toMatch(/passive: true/);
    expect(read(`${DIR}/engine.ts`)).not.toMatch(/IntersectionObserver/);
  });

  it('the stylesheet animates transform and opacity only, and respects reduced motion', () => {
    const css = read(`${DIR}/Immersive.module.css`);
    expect(css).toMatch(/prefers-reduced-motion: reduce/);
    expect(css).not.toMatch(/transition:\s*(box-shadow|filter|backdrop|clip-path|width|height|top|left)/);
    expect(css).not.toMatch(/\b\d+vh\b/);
    expect(css).not.toMatch(/scroll-behavior:\s*smooth/);
  });

  it('third-party marks are only official files, or the plain name', () => {
    expect(C.BRAND_FILES.aztec === null || C.BRAND_FILES.aztec.startsWith('/brand/')).toBe(true);
    expect(C.BRAND_FILES.ethereum === null || C.BRAND_FILES.ethereum.startsWith('/brand/')).toBe(true);
    // Trademark attribution only: no independence sentence on the landing (master plan, decision 6).
    expect(C.TRADEMARKS).toBe('Aztec and Ethereum are trademarks of their respective owners.');
    for (const src of sources) expect(src).not.toMatch(/independent project/i);
  });
});

describe('nothing competes with the scroll on the landing', () => {
  it('no progress line on "/", and decorative loops pause while scrolling', () => {
    expect(read('components/ui/ScrollProgressBar.tsx')).toMatch(/usePathname\(\) === "\/"/);
    expect(read('components/landing/v2/LiveGlobe.tsx')).toMatch(/isScrolling\(\)/);
    expect(read('components/landing/v2/PhoneShowcase.tsx')).toMatch(/isScrolling\(\)/);
    expect(read(`${DIR}/engine.ts`)).not.toMatch(/--page/);
  });
  it('--p is a registered, non-inherited number, so a frame restyles only what reads it', () => {
    expect(read(`${DIR}/Immersive.module.css`)).toMatch(/@property --p \{ syntax: '<number>'; inherits: false;/);
  });
  it('the record is two events with full hashes behind a copy button, not a numbered list', () => {
    const page = read(`${DIR}/ImmersiveLanding.tsx`);
    expect(page).not.toMatch(/<ol className=\{s\.ticks\}/);
    expect(page).toMatch(/<CopyHash label="Transaction" hash=\{C\.FIRST_PAYMENT\.tx\}/);
  });
});

describe('the fuller landing stays true', () => {
  it('features never present communities as end-to-end encrypted', () => {
    const communities = C.FEATURES.flatMap((g) => g.items).find((f) => f.title === 'Communities');
    expect(communities?.body).toMatch(/stored on our server and are not end-to-end encrypted/);
    for (const g of C.FEATURES) for (const f of g.items) expect(`${f.title} ${f.body}`).not.toMatch(/audit|sponsor|partner/i);
  });
  it('the next wave states the signed limits (OD-2: 100 HLC, OD-4 as amended: 50 testers)', () => {
    expect(C.NEXT_WAVE).toMatch(/at most 50 testers/);
    expect(C.NEXT_WAVE).toMatch(/100 HLC per agreement/);
  });
  it('versions under the hood are read from the repository, not typed', () => {
    const page = read(`${DIR}/ImmersiveLanding.tsx`);
    expect(page).toMatch(/read\('package\.json'\)/);
    expect(page).toMatch(/contracts\/aztec\/escrow\/Nargo\.toml/);
    expect(page).not.toMatch(/5\.2\.0|v6\.0\.0/);
  });
  it('the call image is served at its native size, WebP first, with its source to confirm', () => {
    expect(C.MEDIA.call).toEqual({ webp: '/media/landing/call-phone.webp', png: '/media/landing/call-phone.png' });
    expect(read(`${DIR}/ImmersiveLanding.tsx`)).toMatch(/width=\{800\} height=\{1290\}/);
    expect(read('public/media/landing/README.md')).toMatch(/Confirm its source and licence/);
  });
  it('no stickers and nothing pulsing on the landing', () => {
    const page = read(`${DIR}/ImmersiveLanding.tsx`);
    expect(page).not.toMatch(/screen="stickers"/);
    expect(read('components/landing/v2/LiveGlobe.module.css')).not.toMatch(/animation: live/);
  });
});
