// scripts/ui/mobile-budget.mjs: the phone landing's budgets, measured on a running production build.
//   node scripts/ui/mobile-budget.mjs <baseUrl> [reportPath]
// It requests / as an iPhone, takes every script and stylesheet the page loads, and leaves out the
// framework runtime named in .next/build-manifest.json (rootMainFiles, polyfillFiles). Then:
//   - JavaScript, gzip, without the framework runtime: 60 KB or less;
//   - CSS, gzip: 25 KB or less;
//   - hero image (fetchpriority="high"), largest candidate: 120 KB or less;
//   - none of the desktop landing's modules (engine, globe, phone, scrubbed video) in the scripts;
//   - fonts: what is preloaded, reported (they come from the root layout).
import fs from 'node:fs';
import zlib from 'node:zlib';

const base = (process.argv[2] || 'http://localhost:3100').replace(/\/$/, '');
const out = process.argv[3] || 'mobile-budget.json';
const UA = 'Mozilla/5.0 (iPhone; CPU iPhone OS 18_1 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.1 Mobile/15E148 Safari/604.1';
const LIMITS = { js: 60 * 1024, css: 25 * 1024, hero: 120 * 1024 };
// Strings that exist only in the desktop landing's client code (components/landing/immersive and the globe).
const DESKTOP_MARKERS = ['data-spy-nav', 'data-scenes', 'Globe lit where visits came from'];

const manifest = (() => { try { return JSON.parse(fs.readFileSync('.next/build-manifest.json', 'utf8')); } catch { return {}; } })();
const framework = new Set([...(manifest.rootMainFiles ?? []), ...(manifest.polyfillFiles ?? [])].map((f) => f.replace(/^\/?/, '')));
const isFramework = (src) => [...framework].some((f) => src.endsWith(f));

const get = async (url) => {
  const r = await fetch(url.startsWith('http') ? url : base + url, { headers: { 'user-agent': UA } });
  if (!r.ok) throw new Error(`${r.status} ${url}`);
  return Buffer.from(await r.arrayBuffer());
};
const gz = (buf) => zlib.gzipSync(buf, { level: 9 }).length;
const kb = (n) => +(n / 1024).toFixed(1);

const html = (await get('/')).toString('utf8');
if (!html.includes('data-landing="mobile"')) { console.error('FAIL: / did not serve the phone tree to an iPhone'); process.exit(1); }
const attr = (tag, name) => (new RegExp(`${name}="([^"]+)"`).exec(tag) || [])[1];
const scripts = [...new Set([...html.matchAll(/<script[^>]+src="([^"]+)"/g)].map((m) => m[1]))];
const styles = [...new Set([...html.matchAll(/<link[^>]+rel="stylesheet"[^>]*>/g)].map((m) => attr(m[0], 'href')).filter(Boolean))];
const fonts = [...html.matchAll(/<link[^>]+as="font"[^>]*>/g)].map((m) => attr(m[0], 'href'));

const js = [];
let markers = [];
for (const src of scripts) {
  const buf = await get(src);
  const fw = isFramework(src);
  js.push({ src, gzip: gz(buf), framework: fw });
  if (!fw) for (const m of DESKTOP_MARKERS) if (buf.includes(m)) markers.push(`${m} in ${src}`);
}
const css = [];
for (const href of styles) css.push({ href, gzip: gz(await get(href)) });

const heroTag = (/<img[^>]+fetchpriority="high"[^>]*>/i.exec(html) || [])[0] || '';
const heroSources = [...html.matchAll(/<source[^>]+srcset="([^"]+)"/g)].map((m) => m[1]).filter((s) => s.includes('/hero-'));
const heroFiles = [...new Set([attr(heroTag, 'src'), ...heroSources.flatMap((s) => s.split(',').map((x) => x.trim().split(' ')[0]))].filter(Boolean))];
const hero = [];
for (const f of heroFiles) hero.push({ file: f, bytes: (await get(f)).length });

const fontSizes = [];
for (const f of fonts) fontSizes.push({ file: f, bytes: (await get(f)).length });

const jsApp = js.filter((x) => !x.framework).reduce((n, x) => n + x.gzip, 0);
const jsFw = js.filter((x) => x.framework).reduce((n, x) => n + x.gzip, 0);
const cssAll = css.reduce((n, x) => n + x.gzip, 0);
const heroMax = Math.max(0, ...hero.map((h) => h.bytes));
const fails = [];
if (!framework.size) fails.push('no .next/build-manifest.json: run after next build');
if (jsApp > LIMITS.js) fails.push(`JavaScript ${kb(jsApp)} KB gzip > ${kb(LIMITS.js)} KB`);
if (cssAll > LIMITS.css) fails.push(`CSS ${kb(cssAll)} KB gzip > ${kb(LIMITS.css)} KB`);
if (!hero.length) fails.push('no hero image with fetchpriority="high"');
if (heroMax > LIMITS.hero) fails.push(`hero image ${kb(heroMax)} KB > ${kb(LIMITS.hero)} KB`);
if (markers.length) fails.push(`desktop landing code in the phone page: ${markers.join('; ')}`);

const report = {
  jsKB: { app: kb(jsApp), framework: kb(jsFw), limit: kb(LIMITS.js) },
  cssKB: { total: kb(cssAll), limit: kb(LIMITS.css), files: css.map((c) => ({ href: c.href, kb: kb(c.gzip) })) },
  heroKB: { max: kb(heroMax), limit: kb(LIMITS.hero), files: hero.map((h) => ({ file: h.file, kb: kb(h.bytes) })) },
  fonts: fontSizes.map((f) => ({ file: f.file, kb: kb(f.bytes) })),
  scripts: js.map((x) => ({ src: x.src, kb: kb(x.gzip), framework: x.framework })),
  fails,
};
fs.writeFileSync(out, JSON.stringify(report, null, 2));
console.log(JSON.stringify({ ...report, scripts: undefined }, null, 2));
console.log(fails.length ? `FAIL: ${fails.join(' | ')}` : 'PASS: phone landing within budget');
process.exit(fails.length ? 1 : 0);
