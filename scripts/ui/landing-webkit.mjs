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
// The phone landing (components/landing/mobile, 19/11/2026) adds, on the phones only:
//   - the tree split: / with an iPhone user agent gets the phone tree, with a desktop one the
//     immersive tree, and both responses carry Vary: User-Agent, Sec-CH-UA-Mobile;
//   - Pixel 7 (Chromium, CPU throttled 4x, real touch flicks down and up): no long animation frame
//     over 50 ms, rAF interval p95 at or below 1.5x the frame interval, no layout shift, no
//     non-passive touchstart / touchmove / wheel listener on window, document or body, and layout
//     work in the trace bounded by the sections that come into view (content-visibility: auto);
//   - iPhone 15 (WebKit): rAF interval p95, layout shifts and long tasks where WebKit reports them;
//   - "before": the same Pixel 7 run against the immersive tree (desktop user agent), reported only.
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
let slow = 0;
const report = [];

/* ── Phone landing checks ─────────────────────────────────────────────── */
const UA_IPHONE = devices['iPhone 15'].userAgent;
const UA_DESKTOP = 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36';
for (const [name, ua, want] of [['iphone', UA_IPHONE, true], ['desktop', UA_DESKTOP, false]]) {
  const res = await fetch(base + '/', { headers: { 'user-agent': ua } }).catch((e) => ({ ok: false, error: e.message }));
  const html = res.ok ? await res.text() : '';
  const vary = res.headers?.get('vary') ?? '';
  const mobile = html.includes('data-landing="mobile"');
  const desktop = html.includes('data-scene');
  const ok = res.ok && mobile === want && desktop === !want && /user-agent/i.test(vary) && /sec-ch-ua-mobile/i.test(vary);
  if (!ok) slow++;
  report.push({ check: 'tree', ua: name, ok, gotMobileTree: mobile, gotDesktopTree: desktop, vary, acceptCH: res.headers?.get('accept-ch') ?? '' });
}

// Collected in the page while the finger moves: rAF gaps, long animation frames, layout shifts.
const PERF_START = `(() => {
  const P = window.__perf = { gaps: [], loaf: [], longtask: 0, shifts: 0, on: true, types: PerformanceObserver.supportedEntryTypes || [] };
  let last = performance.now();
  const tick = (t) => { if (!P.on) return; P.gaps.push(t - last); last = t; requestAnimationFrame(tick); };
  requestAnimationFrame(tick);
  const obs = (type, fn) => { if (P.types.includes(type)) new PerformanceObserver((l) => l.getEntries().forEach(fn)).observe({ type }); };
  obs('long-animation-frame', (e) => P.loaf.push(Math.round(e.duration)));
  obs('longtask', () => { P.longtask++; });
  obs('layout-shift', (e) => { if (!e.hadRecentInput) P.shifts++; });
  return P.types;
})()`;
const PERF_STOP = `(() => { const P = window.__perf; P.on = false; const g = P.gaps.slice(2).sort((a, b) => a - b);
  const q = (x) => g.length ? g[Math.min(g.length - 1, Math.floor(g.length * x))] : 0;
  return { frames: g.length, median: +q(0.5).toFixed(2), p95: +q(0.95).toFixed(2), loafOver50: P.loaf.filter((d) => d > 50), longtask: P.types.includes('longtask') ? P.longtask : 'n/a', shifts: P.types.includes('layout-shift') ? P.shifts : 'n/a', sections: document.querySelectorAll('[data-reveal]').length }; })()`;

async function nonPassiveListeners(cdp) {
  const bad = [];
  for (const expr of ['window', 'document', 'document.body']) {
    const { result } = await cdp.send('Runtime.evaluate', { expression: expr });
    const { listeners } = await cdp.send('DOMDebugger.getEventListeners', { objectId: result.objectId });
    for (const l of listeners) if (/^(touchstart|touchmove|wheel|mousewheel)$/.test(l.type) && !l.passive) bad.push(`${expr}:${l.type}`);
  }
  return bad;
}

/** Pixel 7, CPU 4x slower, real touch flicks down and back up, traced. */
async function chromiumPerf(page, ctx, label, enforce) {
  const cdp = await ctx.newCDPSession(page);
  await page.evaluate('scrollTo(0, 0)');
  await page.waitForTimeout(600);
  const nonPassive = await nonPassiveListeners(cdp).catch((e) => [`check failed: ${e.message}`]);
  await cdp.send('Emulation.setCPUThrottlingRate', { rate: 4 });
  const events = [];
  cdp.on('Tracing.dataCollected', (d) => { for (const e of d.value) if (e.name === 'Layout' || e.name === 'UpdateLayoutTree' || e.name === 'ScheduleStyleRecalculation') events.push(e.name); });
  const done = new Promise((r) => cdp.once('Tracing.tracingComplete', r));
  await cdp.send('Tracing.start', { categories: 'devtools.timeline', transferMode: 'ReportEvents' });
  await page.evaluate(PERF_START);
  for (const sign of [-1, 1]) for (let k = 0; k < 6; k++) {
    await cdp.send('Input.synthesizeScrollGesture', { x: 200, y: 500, yDistance: sign * 900, speed: 4000, gestureSourceType: 'touch', preventFling: false }).catch(() => undefined);
  }
  const r = await page.evaluate(PERF_STOP);
  await cdp.send('Tracing.end');
  await done;
  await cdp.send('Emulation.setCPUThrottlingRate', { rate: 1 });
  const layout = events.filter((n) => n === 'Layout').length;
  const style = events.filter((n) => n === 'UpdateLayoutTree').length;
  const vsync = r.median || 16.7;
  const limits = { rafP95: +(1.5 * vsync).toFixed(2), layout: 2 * r.sections + 4 };
  const fails = [];
  if (r.loafOver50.length) fails.push(`long animation frames over 50 ms: ${r.loafOver50.join(', ')}`);
  if (r.p95 > limits.rafP95) fails.push(`rAF p95 ${r.p95} ms > ${limits.rafP95}`);
  if (typeof r.shifts === 'number' && r.shifts > 0) fails.push(`${r.shifts} layout shift(s)`);
  if (nonPassive.length) fails.push(`non-passive listeners: ${nonPassive.join(', ')}`);
  if (layout > limits.layout) fails.push(`${layout} layouts during the flicks > ${limits.layout}`);
  if (enforce && fails.length) slow++;
  report.push({ check: 'perf', run: label, enforced: enforce, ...r, layout, styleRecalc: style, nonPassive, limits, fails });
}

/** iPhone 15 (WebKit): the rAF gaps while the page is scrolled down and up, and what WebKit reports. */
async function webkitPerf(page) {
  await page.evaluate('scrollTo(0, 0)');
  await page.waitForTimeout(400);
  await page.evaluate(PERF_START);
  const h = await page.evaluate('document.documentElement.scrollHeight - innerHeight');
  for (const target of [h, 0]) {
    for (let i = 1; i <= 24; i++) {
      await page.evaluate(`scrollTo(0, ${Math.round(target ? (h * i) / 24 : h - (h * i) / 24)})`);
      await page.waitForTimeout(50);
    }
  }
  const r = await page.evaluate(PERF_STOP);
  const vsync = r.median || 16.7;
  const fails = [];
  if (r.p95 > 1.5 * vsync) fails.push(`rAF p95 ${r.p95} ms > ${(1.5 * vsync).toFixed(2)}`);
  if (typeof r.shifts === 'number' && r.shifts > 0) fails.push(`${r.shifts} layout shift(s)`);
  if (typeof r.longtask === 'number' && r.longtask > 0) fails.push(`${r.longtask} long task(s)`);
  if (fails.length) slow++;
  report.push({ check: 'perf', run: 'webkit-iphone-15 (phone tree)', enforced: true, ...r, fails });
}
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
  // The phone tree's frame checks (after the white-screen pass, from the top of the page).
  if (phone && bName === 'chromium') await chromiumPerf(page, ctx, 'chromium-pixel-7 (phone tree)', true);
  if (phone && bName === 'webkit') await webkitPerf(page);
  // The landing scrolls the document, never a nested element: a fixed body with an inner scroller
  // is what broke scrolling on iPhone and Android (19/11/2026).
  if (geo.tag !== 'HTML') { blank++; report.push({ browser: bName, device: dName, problem: `the page scrolls inside ${geo.tag}, not the document` }); }
  report.push({ browser: bName, device: dName, scroller: geo.tag, height: geo.h, steps: pass.length, errors: [...new Set(errors)].slice(0, 5) });
  await browser.close();
}
// "Before": the immersive tree on the same phone (a desktop user agent), measured the same way.
{
  const { defaultBrowserType, userAgent, ...opts } = devices['Pixel 7']; // eslint-disable-line no-unused-vars
  const browser = await chromium.launch();
  const ctx = await browser.newContext({ ...opts, userAgent: UA_DESKTOP });
  const page = await ctx.newPage();
  await page.goto(base + '/', { waitUntil: 'networkidle', timeout: 60000 }).catch(() => undefined);
  await page.waitForTimeout(1500);
  await chromiumPerf(page, ctx, 'chromium-pixel-7 (immersive tree, before)', false).catch((e) => report.push({ check: 'perf', run: 'before', error: e.message }));
  await browser.close();
}
fs.writeFileSync(path.join(out, 'report.json'), JSON.stringify(report, null, 2));
for (const r of report) console.log(JSON.stringify(r));
console.log(blank ? `FAIL: ${blank} blank screen(s)` : 'PASS: something visible on every screen, down and up');
console.log(slow ? `FAIL: ${slow} phone landing check(s) (tree split or frames)` : 'PASS: phone landing tree split and frame checks');
process.exit(blank || slow ? 1 : 0);
