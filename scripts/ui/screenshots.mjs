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
  ['docs-ecosystem', '/docs/ecosystem'],
  ['docs-whitepaper', '/docs/whitepaper'],
  ['chat', '/chat'],
  ['changelog', '/docs/changelog'],
  ['hub-redirect', '/hub'],
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
    // The live 30-second film: capture three chapters as the visitor sees them.
    const film = name === 'home' ? await page.$('#film') : null;
    if (film) {
      await film.scrollIntoViewIfNeeded();
      for (const [i, tag] of [[0, 'messages'], [1, 'pay'], [2, 'agreement']]) {
        const tabs = await page.$$('#film [role="tab"]');
        if (vpName === 'desktop' && tabs[i]) await tabs[i].click();
        await page.waitForTimeout(3600);
        await film.screenshot({ path: path.join(out, `film-${tag}-${vpName}.png`) });
        if (vpName !== 'desktop') break;
      }
    }
    // Immersive landing: every pinned scene at 0, 50 and 100 % of its run, with the progress the
    // page computed, so a scene that does not advance shows up in the report.
    // The page may scroll inside an element (on "/" the layout scrolls <main>): find it once.
    const SCROLLER = `(() => { for (let n = document.querySelector('[data-scene]')?.parentElement; n && n !== document.body; n = n.parentElement) { const o = getComputedStyle(n).overflowY; if (o === 'auto' || o === 'scroll') return n; } return document.scrollingElement; })()`;
    const scenes = name === 'home' ? await page.evaluate(`(() => { const sc = ${SCROLLER}; const o = sc.getBoundingClientRect().top; return { vh: sc.clientHeight, list: [...document.querySelectorAll('[data-scene]')].map((e) => { const r = e.getBoundingClientRect(); return { top: r.top - o + sc.scrollTop, height: r.height, label: e.getAttribute('aria-label') || '' }; }) }; })()`) : { vh: 0, list: [] };
    const sceneReport = [];
    for (const [i, sc] of scenes.list.entries()) {
      for (const f of [0, 0.5, 1]) {
        const y = Math.round(sc.top + Math.max(0, sc.height - scenes.vh) * f);
        await page.evaluate(`(${SCROLLER}).scrollTop = ${y}`);
        await page.waitForTimeout(500);
        const p = await page.$$eval('[data-scene]', (els, k) => els[k]?.style.getPropertyValue('--p') ?? '', i);
        const at = await page.evaluate(`Math.round((${SCROLLER}).scrollTop)`);
        sceneReport.push({ scene: sc.label, f, p, y, at });
        await page.screenshot({ path: path.join(out, `scene-${String(i + 1).padStart(2, '0')}-${Math.round(f * 100)}-${vpName}.png`) });
      }
    }
    // The landing's static sections, each from its heading.
    for (const id of name === 'home' ? ['features-title', 'spec-title', 'protects-title', 'open-title', 'devices-title'] : []) {
      const h = await page.$(`#${id}`);
      if (!h) continue;
      await page.evaluate(`document.getElementById('${id}').scrollIntoView({ block: 'start' })`);
      await page.waitForTimeout(400);
      await page.screenshot({ path: path.join(out, `section-${id.replace('-title', '')}-${vpName}.png`) });
    }
    // The world in dots, centred, then with the pointer on Europe (the hover state).
    if (name === 'home' && (await page.$('canvas[aria-label^="Map of the world"]'))) {
      await page.evaluate(`document.querySelector('canvas[aria-label^="Map of the world"]').scrollIntoView({ block: 'center' })`);
      await page.waitForTimeout(1200);
      await page.screenshot({ path: path.join(out, `section-map-${vpName}.png`) });
      const mapInfo = await page.evaluate(`(() => { const c = document.querySelector('canvas[aria-label^="Map of the world"]'); const r = c.getBoundingClientRect(); return { dots: c.dataset.dots ?? 'none', w: c.width, h: c.height, box: [Math.round(r.width), Math.round(r.height)] }; })()`);
      console.log('[map]', vpName, JSON.stringify(mapInfo));
      const b = await page.evaluate(`(() => { const r = document.querySelector('canvas[aria-label^="Map of the world"]').getBoundingClientRect(); return { x: r.x + r.width * 0.52, y: r.y + r.height * 0.28 }; })()`);
      await page.mouse.move(b.x, b.y, { steps: 6 });
      await page.waitForTimeout(600);
      await page.screenshot({ path: path.join(out, `section-map-hover-${vpName}.png`) });
    }
    const started = name === 'home' ? await page.evaluate(() => document.querySelector('[data-scenes]')?.getAttribute('data-scenes') ?? 'not started') : undefined;
    report.push({ page: name, viewport: vpName, finalUrl: page.url(), errors, ...(sceneReport.length ? { started, scenes: sceneReport } : {}) });
    await page.close();
  }
  await ctx.close();
}
await browser.close();
fs.writeFileSync(path.join(out, 'report.json'), JSON.stringify(report, null, 2));
console.log(JSON.stringify(report, null, 2));
