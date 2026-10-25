/**
 * lib/community-apps/sdk.ts
 *
 * What runs inside every community app frame, before the app's own code:
 *
 *   APP_BASE_CSS  the visual base, so every app looks like Ledger Chat
 *                 without loading anything (the frame has no network).
 *   APP_SDK_JS    `window.hl`, the only interface between the app and the
 *                 community. It talks to components/chat/community-apps/
 *                 AppFrame.tsx over postMessage.
 *
 * The bridge in one paragraph. An app keeps two kinds of data. Shared keys
 * (`hl.get`, `hl.set`, `hl.list`) can be written by any member. Member keys
 * (`hl.mine`, `hl.setMine`, `hl.everyone`) belong to one member each and only
 * that member can write them, which is what makes a vote or a sign-up
 * trustworthy: the server decides whose entry it is, not the app. Every entry
 * reports who wrote it last. Values are JSON, at most 8 KB each.
 *
 * Colours below mirror app/ledger-tokens.css. They are repeated here because
 * the frame is a separate document that cannot read the parent's variables.
 */

export const APP_BASE_CSS = `
:root{--bg:#fff;--bg-subtle:#f7f8fa;--bg-muted:#eff1f4;--bg-hover:#f2f4f7;--bg-pressed:#e9ecf0;--border:#e4e7ec;--border-strong:#d0d5dd;--ink:#15171c;--ink-2:#475061;--ink-3:#727a88;--ink-4:#a3a9b4;--radius-sm:6px;--radius:10px;--radius-lg:14px;--font:-apple-system,BlinkMacSystemFont,"Segoe UI",Roboto,"Helvetica Neue",Arial,sans-serif;--mono:ui-monospace,"SFMono-Regular","Cascadia Mono",Consolas,monospace;--fast:120ms}
*{box-sizing:border-box}
html,body{margin:0;background:var(--bg);color:var(--ink);font:14px/1.5 var(--font);-webkit-font-smoothing:antialiased}
body{padding:20px max(16px,env(safe-area-inset-right)) 32px max(16px,env(safe-area-inset-left))}
.app{max-width:640px;margin:0 auto;display:flex;flex-direction:column;gap:16px}
h1{font-size:20px;line-height:1.25;font-weight:600;letter-spacing:-.01em;margin:0}
h2{font-size:15px;font-weight:600;margin:0}
h3{font-size:14px;font-weight:600;margin:0}
p{margin:0}
a{color:var(--ink)}
.muted{color:var(--ink-3)}.faint{color:var(--ink-4)}.small{font-size:12.5px}
.label{font:500 11px/1.2 var(--mono);letter-spacing:.14em;text-transform:uppercase;color:var(--ink-3)}
.mono{font-family:var(--mono);font-size:12.5px}
.num{font-variant-numeric:tabular-nums}
.row{display:flex;align-items:center;gap:8px;flex-wrap:wrap}
.between{justify-content:space-between}
.stack{display:flex;flex-direction:column;gap:8px}
.grow{flex:1;min-width:0}
.card{border:1px solid var(--border);border-radius:var(--radius-lg);padding:16px;background:var(--bg)}
.list{display:flex;flex-direction:column;border:1px solid var(--border);border-radius:var(--radius-lg);overflow:hidden;background:var(--bg)}
.list>*{padding:12px 14px;border-top:1px solid var(--border)}
.list>*:first-child{border-top:0}
button{font:inherit;font-size:13.5px;font-weight:500;line-height:1.2;border:1px solid var(--border-strong);background:var(--bg);color:var(--ink);border-radius:999px;padding:8px 14px;cursor:pointer;transition:background var(--fast),border-color var(--fast)}
button:hover{background:var(--bg-hover)}
button:active{background:var(--bg-pressed)}
button:disabled{opacity:.45;cursor:default}
button.primary{background:var(--ink);border-color:var(--ink);color:#fff}
button.primary:hover{background:#2b2f38}
button.ghost{border-color:transparent;background:transparent}
button.ghost:hover{background:var(--bg-hover)}
button.item{display:block;width:100%;text-align:left;border:0;border-radius:0;padding:12px 14px;background:var(--bg)}
button.item:hover{background:var(--bg-subtle)}
button.item[aria-pressed="true"]{background:var(--bg-muted)}
:focus-visible{outline:2px solid var(--ink);outline-offset:2px}
input,textarea,select{font:inherit;font-size:14px;color:var(--ink);background:var(--bg-subtle);border:1px solid var(--border);border-radius:var(--radius);padding:9px 12px;width:100%;transition:border-color var(--fast),background var(--fast)}
input:focus,textarea:focus,select:focus{background:var(--bg);border-color:var(--border-strong);outline:none}
input[type=checkbox],input[type=radio]{width:auto;accent-color:var(--ink)}
textarea{resize:vertical;min-height:76px}
.field{display:flex;flex-direction:column;gap:6px}
.bar{height:6px;border-radius:999px;background:var(--bg-muted);overflow:hidden}
.bar>i{display:block;height:100%;background:var(--ink);transition:width 220ms}
.chip{display:inline-flex;align-items:center;gap:6px;border:1px solid var(--border);border-radius:999px;padding:3px 10px;font-size:12.5px;color:var(--ink-2);background:var(--bg)}
.chip.on{background:var(--ink);border-color:var(--ink);color:#fff}
.empty{padding:28px 20px;text-align:center;color:var(--ink-3);border:1px dashed var(--border-strong);border-radius:var(--radius-lg)}
hr{border:0;border-top:1px solid var(--border);margin:0}
table{width:100%;border-collapse:collapse;font-size:13.5px}
th,td{text-align:left;padding:8px 10px;border-bottom:1px solid var(--border)}
th{font-weight:500;color:var(--ink-3)}
.scroll-x{overflow-x:auto}
@media (prefers-reduced-motion:reduce){*{transition:none!important;animation:none!important}}
`.trim();

export const APP_SDK_JS = `
(function () {
  'use strict';
  var seq = 0, pending = {}, listeners = [], ctx = null, readyDone = false;
  var state = { shared: {}, mine: {}, members: {} };
  var resolveReady, readyPromise = new Promise(function (r) { resolveReady = r; });

  function clone(v) { return v === undefined || v === null ? v : JSON.parse(JSON.stringify(v)); }
  function post(msg) { try { parent.postMessage(msg, '*'); } catch (e) {} }
  function report(err) {
    var message = err && err.message ? err.message : String(err);
    post({ hl: 1, op: 'error', data: { message: message.slice(0, 500), stack: String((err && err.stack) || '').slice(0, 2000) } });
  }
  function request(op, data) {
    return new Promise(function (resolve, reject) {
      var id = ++seq;
      pending[id] = { resolve: resolve, reject: reject };
      post({ hl: 1, id: id, op: op, data: data });
      setTimeout(function () {
        if (pending[id]) { delete pending[id]; reject(new Error('Ledger Chat did not answer.')); }
      }, 20000);
    });
  }
  function notify() {
    listeners.slice().forEach(function (fn) { try { fn(); } catch (e) { report(e); } });
  }
  function checkKey(key) {
    if (typeof key !== 'string' || !/^[A-Za-z0-9_.:-]{1,80}$/.test(key)) {
      throw new Error('Keys are 1-80 characters: letters, digits, _ . : -');
    }
  }
  function checkValue(value) {
    var s = JSON.stringify(value === undefined ? null : value);
    if (s.length > 8000) throw new Error('A value can be at most 8 KB.');
  }

  window.addEventListener('message', function (e) {
    if (e.source !== parent) return;
    var m = e.data;
    if (!m || m.hl !== 1) return;
    if (m.op === 'state') { state = m.state || state; notify(); return; }
    var p = m.id && pending[m.id];
    if (!p) return;
    delete pending[m.id];
    if (m.ok) p.resolve(m.result); else p.reject(new Error(m.error || 'The request failed.'));
  });
  window.addEventListener('error', function (e) { report(e.error || e.message); });
  window.addEventListener('unhandledrejection', function (e) { report(e.reason); });

  var hl = {
    ready: function () { return readyPromise; },
    get context() { return clone(ctx); },
    get me() { return ctx ? clone(ctx.me) : null; },

    get: function (key, fallback) {
      var e = state.shared[key];
      return e && e.value !== null && e.value !== undefined ? clone(e.value) : fallback;
    },
    set: function (key, value) {
      checkKey(key); checkValue(value);
      if (value === null || value === undefined) delete state.shared[key];
      else state.shared[key] = { value: clone(value), by: ctx && ctx.me, at: new Date().toISOString() };
      notify();
      return request('set', { scope: 'shared', key: key, value: value === undefined ? null : value });
    },
    list: function (prefix) {
      prefix = prefix || '';
      return Object.keys(state.shared).filter(function (k) {
        return k.indexOf(prefix) === 0 && state.shared[k].value !== null;
      }).sort().map(function (k) {
        var e = state.shared[k];
        return { key: k, value: clone(e.value), by: clone(e.by), at: e.at };
      });
    },

    mine: function (key, fallback) {
      var v = state.mine[key];
      return v === null || v === undefined ? fallback : clone(v);
    },
    setMine: function (key, value) {
      checkKey(key); checkValue(value);
      var v = value === undefined ? null : value;
      if (v === null) delete state.mine[key]; else state.mine[key] = clone(v);
      var rows = (state.members[key] || []).filter(function (r) { return !r.me; });
      if (v !== null && ctx) rows.push({ id: ctx.me.id, label: ctx.me.label, value: clone(v), at: new Date().toISOString(), me: true });
      state.members[key] = rows;
      notify();
      return request('set', { scope: 'mine', key: key, value: v });
    },
    everyone: function (key) {
      return (state.members[key] || []).filter(function (r) { return r.value !== null; }).slice().sort(function (a, b) {
        return a.at < b.at ? -1 : a.at > b.at ? 1 : 0;
      }).map(clone);
    },

    onChange: function (fn) {
      listeners.push(fn);
      return function () { listeners = listeners.filter(function (f) { return f !== fn; }); };
    },
    uid: function () {
      var a = new Uint8Array(8); crypto.getRandomValues(a);
      return Array.prototype.map.call(a, function (b) { return ('0' + b.toString(16)).slice(-2); }).join('');
    },
    esc: function (s) {
      return String(s === null || s === undefined ? '' : s).replace(/[&<>"']/g, function (c) {
        return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c];
      });
    },
    report: report
  };
  Object.freeze(hl);
  Object.defineProperty(window, 'hl', { value: hl, writable: false, configurable: false });

  request('hello', null).then(function (r) {
    ctx = r.context; state = r.state || state; readyDone = true;
    resolveReady(clone(ctx)); notify();
  }).catch(function (e) { report(e); });
})();
`.trim();

function escapeText(s: string): string {
  return s.replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c] as string));
}

/**
 * Apps are stored as a body fragment. A model sometimes returns a whole
 * document anyway; keep what is inside it and drop the wrapper, so the base
 * CSS and the SDK are always the first thing in <head>.
 */
export function normalizeFragment(html: string): string {
  return html
    .replace(/<!doctype[^>]*>/gi, '')
    .replace(/<\/?html[^>]*>/gi, '')
    .replace(/<\/?head[^>]*>/gi, '')
    .replace(/<\/?body[^>]*>/gi, '')
    .replace(/<meta[^>]*>/gi, '')
    .replace(/<title[^>]*>[\s\S]*?<\/title>/gi, '')
    .trim();
}

export function buildAppDocument(fragment: string, title: string): string {
  return [
    '<!doctype html>',
    '<html lang="es"><head>',
    '<meta charset="utf-8">',
    '<meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover">',
    `<title>${escapeText(title)}</title>`,
    `<style>${APP_BASE_CSS}</style>`,
    `<script>${APP_SDK_JS}</script>`,
    '</head><body>',
    normalizeFragment(fragment),
    '</body></html>',
  ].join('\n');
}
