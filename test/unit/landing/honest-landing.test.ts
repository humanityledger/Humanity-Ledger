/** Landing: no numbered counters; the technical facts Aztec Labs would check are stated, with limits. */
import fs from 'node:fs';
import * as C from '@/lib/landing/content';

describe('landing without numbered indicators', () => {
  it('no "02 / 15" counters and no numbered stack', () => {
    const src = fs.readFileSync('components/landing/immersive/ImmersiveLanding.tsx', 'utf8');
    expect(src).not.toMatch(/pad\(ORDER\.indexOf|\{pad\(i \+ 1\)\}/);
  });
});

describe('stack layout without numbers', () => {
  // Regression, 20 Nov 2026: with the number span gone, each layer's text fell into the 32 px
  // marker column and wrapped one word per line. The text must always sit in the wide column.
  const css = fs.readFileSync('components/landing/immersive/Immersive.module.css', 'utf8');
  it('pins the text to the second column and draws the marker in CSS', () => {
    expect(css).toMatch(/\.stack li > div \{ grid-column: 2; min-width: 0; \}/);
    expect(css).toMatch(/\.stack li \{[^}]*grid-template-columns: 32px minmax\(0, 1fr\)/);
    expect(css).toMatch(/\.stack li::after \{ content: ''/);
  });
});

describe('technical honesty', () => {
  const text = JSON.stringify([C.STACK, C.FAQ]);
  it('names SIWE, MLS, the PXE, notes and nullifiers, Fee Juice and peer binding', () => {
    for (const t of ['Sign-In with Ethereum', 'MLS (RFC 9420)', 'PXE', 'nullifier', 'Fee Juice', 'controls that Aztec address']) expect(text).toContain(t);
  });
  it('states the current limits in one place', () => {
    const lim = C.FAQ.find((f) => f.q === 'What are the current limits?');
    expect(lim?.a).toMatch(/account that pays a fee is public/);
    expect(lim?.a).toMatch(/no external audit/);
    expect(lim?.a).toMatch(/not end-to-end encrypted/);
  });
  it('docs: Status is server-stored and not end-to-end encrypted; group calls are not offered', () => {
    expect(fs.readFileSync('lib/docs/pages/guide.ts', 'utf8')).toMatch(/Status is stored on our server and is not end-to-end encrypted/);
    expect(fs.readFileSync('lib/docs/pages/ledger-chat.ts', 'utf8')).not.toMatch(/start a group call/);
  });
});
