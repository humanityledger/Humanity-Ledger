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
    let page = await ctx.newPage();
    const errors = [];
    page.on('pageerror', (e) => errors.push(String(e.message).slice(0, 200)));
    page.on('console', (m) => m.type() === 'error' && errors.push(m.text().slice(0, 200)));
    await page.goto(`${base}/chat?e2e=settings`, { waitUntil: 'networkidle', timeout: 60000 }).catch((e) => errors.push('goto: ' + e.message));
    await page.waitForSelector('[data-testid="settings-root"]', { timeout: 20000 }).catch(() => errors.push('no settings-root'));
    await page.waitForTimeout(800);
    // Does requestAnimationFrame run in this browser and device? Playwright's "stable" check and
    // framer-motion both depend on it.
    const raf = await page.evaluate(() => new Promise((r) => { let n = 0; const f = () => (++n >= 3 ? r(true) : requestAnimationFrame(f)); requestAnimationFrame(f); setTimeout(() => r(false), 1500); })).catch((e) => `probe failed: ${e.message.slice(0, 60)}`);
    if (page.isClosed() || String(raf).includes('crashed')) page = await ctx.newPage();
    const ids = await page.$$eval('[data-settings-item]', (els) => els.map((e) => e.getAttribute('data-settings-item')));
    if (ids.length === 0) {
      // Settings never mounted: that is a failure, never a vacuous pass. Show where the page went.
      failed++;
      const where = await page.evaluate(() => ({ url: location.href, text: document.body.innerText.slice(0, 300), e2e: document.querySelector('[data-chat-page]') ? 'chat page' : 'none' }));
      results.push({ browser: bName, device: cName, ok: false, why: 'Settings did not mount', ...where });
      await page.screenshot({ path: path.join(out, `${bName}-${cName}-not-mounted.png`) });
    }
    for (const id of ids) {
      // A crashed page (WebKit 'Target crashed') is counted as a failure of that section and replaced.
      if (page.isClosed()) page = await ctx.newPage();
      await page.goto(`${base}/chat?e2e=settings`, { waitUntil: 'networkidle', timeout: 60000 }).catch(() => undefined);
      await page.waitForSelector(`[data-settings-item="${id}"]`, { timeout: 20000 }).catch(() => undefined);
      await page.waitForTimeout(700);
      let forced = false;
      await page.click(`[data-settings-item="${id}"]`, { timeout: 10000 }).catch(async (e) => {
        // Keep Playwright's reason (not stable, not visible, another element intercepts) and what
        // sits on top of the button's centre.
        const over = await page.evaluate((sel) => {
          const b = document.querySelector(sel)?.getBoundingClientRect();
          if (!b) return 'button not found';
          const hit = document.elementFromPoint(b.x + b.width / 2, b.y + b.height / 2);
          return `button at ${Math.round(b.x)},${Math.round(b.y)} ${Math.round(b.width)}x${Math.round(b.height)}; on top: ${hit?.tagName}.${String(hit?.className).slice(0, 80)} ${hit?.closest('[data-testid]')?.getAttribute('data-testid') ?? ''}`;
        }, `[data-settings-item="${id}"]`).catch(() => '');
        errors.push(`click ${id}: ${e.message.split('\n').filter((l) => /intercepts|stable|visible|outside|retrying|scroll/.test(l)).slice(-2).join(' | ')} || ${over}`);
        // Without animation frames the "stable" wait never ends; tap anyway, and say so in the report.
        forced = true;
        await page.click(`[data-settings-item="${id}"]`, { force: true, timeout: 5000 }).catch((e2) => errors.push(`forced click ${id}: ${e2.message.slice(0, 160)}`));
      });
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
        // Every element of the row that holds the list and the content, with its box and display.
        const row = c.parentElement?.parentElement;
        info.row = row ? [...row.children].map((n) => { const r = n.getBoundingClientRect(); const s = getComputedStyle(n); return `${n.tagName.toLowerCase()} ${s.display} x${Math.round(r.x)} w${Math.round(r.width)} min-w:${s.minWidth} flex:${s.flex}`; }) : [];
        const rr = row?.getBoundingClientRect();
        info.rowBox = rr ? [Math.round(rr.x), Math.round(rr.width)] : null;
        info.rootTransform = getComputedStyle(root).transform;
        const first = [...c.querySelectorAll('*')].find((n) => { const r = n.getBoundingClientRect(); return r.width > 4 && r.height > 4; });
        if (!first) return { ok: false, why: 'nothing with a size', ...info };
        const r = first.getBoundingClientRect();
        const x = r.x + Math.min(r.width / 2, 40), y = r.y + Math.min(r.height / 2, 12);
        const inView = x >= 0 && x <= vw && y >= 0 && y <= vh;
        const hit = inView ? document.elementFromPoint(x, y) : null;
        return { ok: inView && !!hit && c.contains(hit), why: !inView ? 'outside the viewport' : !hit || !c.contains(hit) ? `covered by ${hit?.tagName}.${String(hit?.className).slice(0, 60)}` : '', ...info };
      }).catch((e) => ({ ok: false, why: `page crashed: ${e.message.slice(0, 80)}` }));
      if (!probe.ok) failed++;
      results.push({ browser: bName, device: cName, section: id, raf, forced, ...probe });
      if (!probe.ok || id === ids[ids.length - 1]) await page.screenshot({ path: path.join(out, `${bName}-${cName}-${id}.png`) }).catch(() => undefined);
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
