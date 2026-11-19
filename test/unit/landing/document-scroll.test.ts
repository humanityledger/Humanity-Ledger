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

describe('package 0 instruments', () => {
  it('/?debug=scroll shows the scroller, viewport heights, scene state and long frames, on screen only', () => {
    const islands = fs.readFileSync('components/landing/immersive/Islands.tsx', 'utf8');
    expect(islands).toMatch(/get\('debug'\) !== 'scroll'/);
    expect(islands).toMatch(/visualViewport/);
    expect(islands.slice(islands.indexOf('export function ScrollDebug'))).not.toMatch(/fetch\(|sendBeacon/);
    expect(fs.readFileSync('components/landing/immersive/ImmersiveLanding.tsx', 'utf8')).toMatch(/<ScrollDebug \/>/);
  });
  it('the browser test checks pixels, real touch flicks and the browser bars', () => {
    const t = fs.readFileSync('scripts/ui/landing-webkit.mjs', 'utf8');
    expect(t).toMatch(/Input\.synthesizeScrollGesture/);
    expect(t).toMatch(/whiteShare\(buf, skipTop\)/);
    expect(t).toMatch(/height: baseSize\.height \+ 80/);
  });
});
