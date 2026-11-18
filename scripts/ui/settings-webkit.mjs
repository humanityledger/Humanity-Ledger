// scripts/ui/settings-webkit.mjs: opens every Settings section in WebKit (Safari's engine) and
// Chromium, on a desktop, an iPhone 15 and an iPad Pro 11, and fails if one does not show.
//   node scripts/ui/settings-webkit.mjs <baseUrl> <outDir>
// Needs a build with NEXT_PUBLIC_E2E_HARNESS=1 (it serves /chat?e2e=settings).
import { chromium, webkit, devices } from 'playwright';
import fs from 'node:fs';
import path from 'node:path';

const base = process.argv[2] || 'http://localhost:3100';
const out = process.argv[3] || 'settings-shots';
fs.mkdirSync(out, { recursive: true });
const CONFIGS = [
  ['desktop', { viewport: { width: 1440, height: 900 } }],
  ['iphone-15', devices['iPhone 15']],
  ['ipad-pro-11', devices['iPad Pro 11']],
];
const results = [];
let failed = 0;
for (const [bName, engine] of [['webkit', webkit], ['chromium', chromium]]) {
  const browser = await engine.launch();
  for (const [cName, cfg] of CONFIGS) {
    const { defaultBrowserType, ...opts } = cfg; // eslint-disable-line no-unused-vars
    const ctx = await browser.newContext(opts);
    const page = await ctx.newPage();
    const errors = [];
    page.on('pageerror', (e) => errors.push(String(e.message).slice(0, 200)));
    page.on('console', (m) => m.type() === 'error' && errors.push(m.text().slice(0, 200)));
    await page.goto(`${base}/chat?e2e=settings`, { waitUntil: 'networkidle', timeout: 60000 }).catch((e) => errors.push('goto: ' + e.message));
    await page.waitForSelector('[data-testid="settings-root"]', { timeout: 20000 }).catch(() => errors.push('no settings-root'));
    await page.waitForTimeout(800);
    const ids = await page.$$eval('[data-settings-item]', (els) => els.map((e) => e.getAttribute('data-settings-item')));
    for (const id of ids) {
      await page.goto(`${base}/chat?e2e=settings`, { waitUntil: 'networkidle', timeout: 60000 }).catch(() => undefined);
      await page.waitForSelector(`[data-settings-item="${id}"]`, { timeout: 20000 }).catch(() => undefined);
      await page.waitForTimeout(700);
      await page.click(`[data-settings-item="${id}"]`).catch((e) => errors.push(`click ${id}: ${e.message.slice(0, 120)}`));
      await page.waitForTimeout(700);
      const probe = await page.evaluate(() => {
        const root = document.querySelector('[data-testid="settings-root"]');
        const c = document.querySelector('[data-testid="settings-content"]');
        const vw = window.innerWidth, vh = window.innerHeight;
        const info = { layout: root?.getAttribute('data-layout'), rootW: root?.clientWidth, rootH: root?.clientHeight, vw, vh };
        if (!c) return { ok: false, why: 'no content column', ...info };
        const cr = c.getBoundingClientRect();
        const cs = getComputedStyle(c.parentElement);
        Object.assign(info, { content: [Math.round(cr.x), Math.round(cr.y), Math.round(cr.width), Math.round(cr.height)], colDisplay: cs.display, colH: cs.height });
        const first = [...c.querySelectorAll('*')].find((n) => { const r = n.getBoundingClientRect(); return r.width > 4 && r.height > 4; });
        if (!first) return { ok: false, why: 'nothing with a size', ...info };
        const r = first.getBoundingClientRect();
        const x = r.x + Math.min(r.width / 2, 40), y = r.y + Math.min(r.height / 2, 12);
        const inView = x >= 0 && x <= vw && y >= 0 && y <= vh;
        const hit = inView ? document.elementFromPoint(x, y) : null;
        return { ok: inView && !!hit && c.contains(hit), why: !inView ? 'outside the viewport' : !hit || !c.contains(hit) ? `covered by ${hit?.tagName}.${String(hit?.className).slice(0, 60)}` : '', ...info };
      });
      if (!probe.ok) failed++;
      results.push({ browser: bName, device: cName, section: id, ...probe });
      if (!probe.ok || id === ids[ids.length - 1]) await page.screenshot({ path: path.join(out, `${bName}-${cName}-${id}.png`) });
    }
    results.push({ browser: bName, device: cName, sections: ids.length, errors: [...new Set(errors)] });
    await ctx.close();
  }
  await browser.close();
}
fs.writeFileSync(path.join(out, 'report.json'), JSON.stringify(results, null, 2));
for (const r of results) console.log(JSON.stringify(r));
console.log(failed ? `FAIL: ${failed} section(s) did not show` : 'PASS: every section shows in WebKit and Chromium');
process.exit(failed ? 1 : 0);
