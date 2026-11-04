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
    // The app shell scrolls inside an element, not the window: find the
    // biggest scroller, walk it once so lazy sections render, then capture
    // the middle and the end (the footer).
    const scrollTo = async (frac) => page.evaluate(async (f) => {
      const all = [document.scrollingElement, ...document.querySelectorAll('*')];
      let best = document.scrollingElement, max = 0;
      for (const el of all) {
        if (!el) continue;
        const d = el.scrollHeight - el.clientHeight;
        const st = getComputedStyle(el).overflowY;
        if (d > max && (el === document.scrollingElement || st === 'auto' || st === 'scroll')) { max = d; best = el; }
      }
      if (f === 'walk') {
        for (let y = 0; y < max; y += 700) { best.scrollTop = y; await new Promise(r => setTimeout(r, 90)); }
        return max;
      }
      best.scrollTop = Math.round(max * f);
      return max;
    }, frac);
    await scrollTo('walk');
    await scrollTo(0.5);
    await page.waitForTimeout(700);
    await page.screenshot({ path: path.join(out, `${name}-${vpName}-mid.png`) });
    await scrollTo(1);
    await page.waitForTimeout(900);
    await page.screenshot({ path: path.join(out, `${name}-${vpName}-end.png`) });
    // Hover the first card spotlight, if any, for the glow check.
    const glow = await page.$('[data-glow]');
    if (glow && vpName === 'desktop') {
      await glow.scrollIntoViewIfNeeded();
      const b = await glow.boundingBox();
      if (b) {
        await page.mouse.move(b.x + b.width * 0.3, b.y + Math.min(160, b.height / 2));
        await page.waitForTimeout(900);
        await page.screenshot({ path: path.join(out, `${name}-${vpName}-glow.png`) });
      }
    }
    report.push({ page: name, viewport: vpName, finalUrl: page.url(), errors });
    await page.close();
  }
  await ctx.close();
}
await browser.close();
fs.writeFileSync(path.join(out, 'report.json'), JSON.stringify(report, null, 2));
console.log(JSON.stringify(report, null, 2));
