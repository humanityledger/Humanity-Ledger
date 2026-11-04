// scripts/ui/screenshots.mjs — full-page screenshots of the public surfaces,
// used by the "UI screenshots" workflow to review design changes.
//   node scripts/ui/screenshots.mjs <baseUrl> <outDir>
import { chromium } from 'playwright';
import fs from 'node:fs';
import path from 'node:path';

const base = process.argv[2] || 'http://localhost:3100';
const out = process.argv[3] || 'shots';
fs.mkdirSync(out, { recursive: true });

const PAGES = [
  ['home', '/'],
  ['connect', '/connect'],
  ['docs', '/docs/overview'],
  ['docs-privacy', '/docs/privacy'],
  ['chat', '/chat'],
  ['changelog', '/changelog'],
];
const VIEWPORTS = [
  ['desktop', { width: 1440, height: 900 }],
  ['mobile', { width: 390, height: 844 }],
];

const browser = await chromium.launch();
const report = [];
for (const [vpName, viewport] of VIEWPORTS) {
  const ctx = await browser.newContext({ viewport, deviceScaleFactor: 1, reducedMotion: 'no-preference' });
  for (const [name, url] of PAGES) {
    const page = await ctx.newPage();
    const errors = [];
    page.on('pageerror', (e) => errors.push(String(e.message).slice(0, 200)));
    page.on('console', (m) => m.type() === 'error' && errors.push(m.text().slice(0, 200)));
    try {
      await page.goto(base + url, { waitUntil: 'networkidle', timeout: 60000 });
    } catch (e) {
      errors.push('goto: ' + String(e.message).slice(0, 160));
    }
    await page.mouse.move(viewport.width * 0.62, 260);
    await page.waitForTimeout(1500);
    // Above the fold, with the cursor over the page.
    await page.screenshot({ path: path.join(out, `${name}-${vpName}-fold.png`) });
    // Scroll through once so lazy sections render, then capture the page.
    await page.evaluate(async () => {
      for (let y = 0; y < document.body.scrollHeight; y += 700) { window.scrollTo(0, y); await new Promise(r => setTimeout(r, 120)); }
      window.scrollTo(0, document.body.scrollHeight);
    });
    await page.waitForTimeout(800);
    await page.screenshot({ path: path.join(out, `${name}-${vpName}-end.png`) });
    if (vpName === 'desktop') {
      await page.screenshot({ path: path.join(out, `${name}-${vpName}-full.png`), fullPage: true });
    }
    report.push({ page: name, viewport: vpName, finalUrl: page.url(), errors });
    await page.close();
  }
  await ctx.close();
}
await browser.close();
fs.writeFileSync(path.join(out, 'report.json'), JSON.stringify(report, null, 2));
console.log(JSON.stringify(report, null, 2));
