/** On phones the landing must scroll the document, not a nested <main> inside a fixed body (19/11/2026). */
import fs from 'node:fs';

describe('landing scrolls the document', () => {
  it('ClientLayout never bounds "/"', () => {
    const src = fs.readFileSync('components/layout/ClientLayout.tsx', 'utf8');
    expect(src).toMatch(/const isBounded = !isDashboard && !isLanding && BOUNDED_PREFIXES/);
  });
  it('the mobile browser test fails when the page scrolls inside an element, and runs on layout changes', () => {
    expect(fs.readFileSync('scripts/ui/landing-webkit.mjs', 'utf8')).toMatch(/geo\.tag !== 'HTML'/);
    const wf = fs.readFileSync('.github/workflows/landing-webkit.yml', 'utf8');
    for (const p of ['components/layout/**', 'components/activities/**', 'app/layout.tsx']) expect(wf).toContain(p);
  });
});
