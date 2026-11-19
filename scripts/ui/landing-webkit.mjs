// scripts/ui/landing-webkit.mjs: scrolls the landing like a finger, down and back up, on an
// iPhone 15 (WebKit, Safari's engine), a Pixel 7 (Chromium) and a desktop, and fails on any
// screen where nothing is visible (reported 19/11/2026: white past the first film on phones).
// On the phones it also checks every position the instant it is reached, before the scroll loop
// has run a frame (what a real finger flick shows), and loads the page's late code slowly, as a
// mobile network does, so a phone that has not loaded yet can never leave a white screen.
//   node scripts/ui/landing-webkit.mjs <baseUrl> <outDir>
import { chromium, webkit, devices } from 'playwright';
import fs from 'node:fs';
import path from 'node:path';

const base = process.argv[2] || 'http://localhost:3100';
const out = process.argv[3] || 'landing-shots';
fs.mkdirSync(out, { recursive: true });
const RUNS = [
  ['webkit', webkit, 'iphone-15', devices['iPhone 15'], true],
  ['chromium', chromium, 'pixel-7', devices['Pixel 7'], true],
  ['webkit', webkit, 'desktop', { viewport: { width: 1440, height: 900 } }, false],
];
const SCROLLER = `(() => { for (let n = document.querySelector('[data-scene]')?.parentElement; n && n !== document.body; n = n.parentElement) { const o = getComputedStyle(n).overflowY; if ((o === 'auto' || o === 'scroll') && n.scrollHeight > n.clientHeight + 1) return n; } return document.scrollingElement; })()`;
// Is anything visible? 20 points across the screen below the navigation; a point counts when the
// element there has text, is media, or has a non-white background, and every ancestor's opacity
// multiplied together is above 0.15.
const PROBE_FN = `() => {
  const vw = innerWidth, vh = innerHeight; let seen = 0; const why = [];
  for (let i = 0; i < 5; i++) for (let j = 0; j < 4; j++) {
    const x = vw * (0.1 + 0.2 * i), y = 100 + (vh - 120) * (0.12 + 0.25 * j);
    // Every layer at the point, top first: an invisible layer on top (a scene fading in) must
    // not hide a visible one below it.
    let hit = null, top = null;
    for (const el of document.elementsFromPoint(x, y)) {
      if (!top) top = el;
      let op = 1; for (let n = el; n && n !== document.documentElement; n = n.parentElement) op *= parseFloat(getComputedStyle(n).opacity || '1');
      if (op <= 0.15) continue;
      const cs = getComputedStyle(el);
      const text = [...el.childNodes].some((c) => c.nodeType === 3 && c.textContent.trim());
      const media = /^(IMG|VIDEO|CANVAS|svg|PICTURE|path|circle|rect)$/.test(el.tagName);
      const bg = cs.backgroundColor && !/rgba?\\(255, 255, 255|rgba\\(0, 0, 0, 0\\)|transparent/.test(cs.backgroundColor) || (cs.backgroundImage && cs.backgroundImage !== 'none' && !/gradient/.test(cs.backgroundImage));
      if (text || media || bg) { hit = el; break; }
    }
    if (hit) seen++; else if (why.length < 3 && top) why.push(top.tagName + '.' + String(top.className).slice(0, 40));
  }
  const pins = [...document.querySelectorAll('[data-scene]')].map((s) => { const r = s.getBoundingClientRect(); return { label: s.getAttribute('aria-label'), top: Math.round(r.top), bottom: Math.round(r.bottom), p: s.style.getPropertyValue('--p'), in: s.style.getPropertyValue('--in'), near: s.hasAttribute('data-near'), pinOp: getComputedStyle(s.firstElementChild).opacity }; }).filter((s) => s.top < vh && s.bottom > 0);
  return { seen, why, pins };
}`;
const PROBE = `(${PROBE_FN})()`;
// Scroll and look in the same task: the scroll loop's next frame has not run yet.
const FLICK = (y) => `(() => { (${SCROLLER}).scrollTop = ${y}; return (${PROBE_FN})(); })()`;

let blank = 0;
const report = [];
for (const [bName, engine, dName, cfg, phone] of RUNS) {
  const { defaultBrowserType, ...opts } = cfg; // eslint-disable-line no-unused-vars
  const browser = await engine.launch();
  const ctx = await browser.newContext(opts);
  const page = await ctx.newPage();
  const errors = [];
  page.on('pageerror', (e) => errors.push(String(e.message).slice(0, 160)));
  // A mobile network: code requested after the first load arrives 2.5 s late.
  let late = false;
  if (phone) await page.route('**/_next/static/chunks/**', async (route) => {
    if (late) await new Promise((r) => setTimeout(r, 2500));
    await route.continue();
  });
  await page.goto(base + '/', { waitUntil: 'networkidle', timeout: 60000 }).catch((e) => errors.push('goto ' + e.message));
  await page.waitForTimeout(1500);
  late = true;
  const geo = await page.evaluate(`(() => { const s = ${SCROLLER}; return { h: s.scrollHeight, vh: s.clientHeight, tag: s.tagName }; })()`);
  const step = Math.round(geo.vh * 0.4);
  const ys = [];
  for (let y = 0; y < geo.h - geo.vh; y += step) ys.push(y);
  const pass = [...ys, ...[...ys].reverse()];
  let shots = 0;
  const fail = (e) => ({ seen: -1, why: [String(e.message).slice(0, 80)], pins: [] });
  for (const [n, y] of pass.entries()) {
    const dir = n < ys.length ? 'down' : 'up';
    const checks = [];
    if (phone) checks.push(['flick', await page.evaluate(FLICK(y)).catch(fail)]);
    else await page.evaluate(`(${SCROLLER}).scrollTop = ${y}`);
    await page.waitForTimeout(180);
    checks.push(['settled', await page.evaluate(PROBE).catch(fail)]);
    for (const [when, r] of checks) {
      if (r.seen !== 0) continue;
      blank++;
      report.push({ browser: bName, device: dName, dir, y, when, ...r });
      if (shots++ < 6) await page.screenshot({ path: path.join(out, `${bName}-${dName}-blank-${dir}-${y}-${when}.png`) }).catch(() => undefined);
    }
  }
  // The landing scrolls the document, never a nested element: a fixed body with an inner scroller
  // is what broke scrolling on iPhone and Android (19/11/2026).
  if (geo.tag !== 'HTML') { blank++; report.push({ browser: bName, device: dName, problem: `the page scrolls inside ${geo.tag}, not the document` }); }
  report.push({ browser: bName, device: dName, scroller: geo.tag, height: geo.h, steps: pass.length, errors: [...new Set(errors)].slice(0, 5) });
  await browser.close();
}
fs.writeFileSync(path.join(out, 'report.json'), JSON.stringify(report, null, 2));
for (const r of report) console.log(JSON.stringify(r));
console.log(blank ? `FAIL: ${blank} blank screen(s)` : 'PASS: something visible on every screen, down and up');
process.exit(blank ? 1 : 0);
