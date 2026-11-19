// scripts/ui/landing-webkit.mjs: scrolls the landing like a finger, down and back up, on an
// iPhone 15 (WebKit, Safari's engine), a Pixel 7 (Chromium) and a desktop, and fails on any
// screen where nothing is visible (reported 19/11/2026: white past the first film on phones).
// On the phones it also checks every position the instant it is reached, before the scroll loop
// has run a frame (what a real finger flick shows), and loads the page's late code slowly, as a
// mobile network does, so a phone that has not loaded yet can never leave a white screen.
// Package 0 (19/11/2026) adds three checks the DOM probe cannot make:
//   - pixels: each settled screen is captured and fails when 99.5 % or more of it below the
//     navigation is white. A blank screen is ~100 % white; the page is white by design and a
//     text-only scene on desktop measured 98.7 % (CI, 19/11/2026), so a lower threshold flags it;
//   - Chromium (Pixel 7): real touch flicks with momentum (CDP Input.synthesizeScrollGesture),
//     captured the moment each flick ends, down and back up;
//   - WebKit (iPhone 15): the viewport grows by 80 px half way down and shrinks half way up, as
//     the browser bars do when they hide and show.
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
let PNG = null;
try { ({ PNG } = await import('pngjs')); } catch { /* pngjs is installed by the workflow; the pixel check is skipped without it */ }
/** Share of near-white pixels below the navigation (sampled), or null without pngjs. */
function whiteShare(buf, skipTop) {
  if (!PNG) return null;
  const img = PNG.sync.read(buf);
  let white = 0, all = 0;
  for (let y = skipTop; y < img.height; y += 4) for (let x = 0; x < img.width; x += 4) {
    const i = (img.width * y + x) << 2;
    all++;
    if (img.data[i] >= 245 && img.data[i + 1] >= 245 && img.data[i + 2] >= 245) white++;
  }
  return all ? white / all : null;
}
const WHITE_MAX = 0.995;
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
  const resize = phone && bName === 'webkit';
  const baseSize = page.viewportSize();
  const dpr = opts.deviceScaleFactor || 1;
  const skipTop = Math.round(72 * dpr);
  const pixelCheck = async (label) => {
    const buf = await page.screenshot().catch(() => null);
    const w = buf ? whiteShare(buf, skipTop) : null;
    if (w !== null && w >= WHITE_MAX) {
      blank++;
      report.push({ browser: bName, device: dName, when: label, white: Number(w.toFixed(4)) });
      fs.writeFileSync(path.join(out, `${bName}-${dName}-white-${label}.png`), buf);
    }
  };
  for (const [n, y] of pass.entries()) {
    const dir = n < ys.length ? 'down' : 'up';
    if (resize && n === Math.floor(ys.length / 2)) await page.setViewportSize({ width: baseSize.width, height: baseSize.height + 80 });
    if (resize && n === ys.length + Math.floor(ys.length / 2)) await page.setViewportSize(baseSize);
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
    await pixelCheck(`${dir}-${y}`);
  }
  if (resize) await page.setViewportSize(baseSize);
  // Real touch flicks with momentum on the Android phone, captured as each flick ends.
  if (phone && bName === 'chromium') {
    const cdp = await ctx.newCDPSession(page);
    const top = () => page.evaluate(`(${SCROLLER}).scrollTop`);
    await page.evaluate(`(${SCROLLER}).scrollTop = 0`);
    for (const dirSign of [-1, 1]) {
      let prev = -1;
      for (let k = 0; k < 80; k++) {
        await cdp.send('Input.synthesizeScrollGesture', { x: 200, y: 500, yDistance: dirSign * 700, speed: 3500, gestureSourceType: 'touch', preventFling: false }).catch((e) => errors.push('gesture ' + e.message));
        const at = await top();
        const r = await page.evaluate(PROBE).catch(fail);
        if (r.seen === 0) { blank++; report.push({ browser: bName, device: dName, when: `touch-${dirSign < 0 ? 'down' : 'up'}`, y: at, ...r }); }
        await pixelCheck(`touch-${dirSign < 0 ? 'down' : 'up'}-${Math.round(at)}`);
        if (at === prev) break;
        prev = at;
      }
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
