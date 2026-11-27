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
:root{--bg:#fff;--bg-subtle:#f7f8fa;--bg-muted:#eff1f4;--bg-hover:#f2f4f7;--bg-pressed:#e9ecf0;--border:#e4e7ec;--border-strong:#d0d5dd;--ink:#15171c;--ink-2:#475061;--ink-3:#727a88;--ink-4:#a3a9b4;--accent:#2754d6;--accent-soft:#eef2fc;--ok:#157347;--ok-soft:#eaf5ef;--warn:#8f5b00;--warn-soft:#fbf4e6;--danger:#c0362c;--danger-soft:#fbeceb;--radius-sm:6px;--radius:10px;--radius-lg:14px;--shadow-xs:0 1px 2px rgba(16,24,40,.05);--font:-apple-system,BlinkMacSystemFont,"Segoe UI",Roboto,"Helvetica Neue",Arial,sans-serif;--mono:ui-monospace,"SFMono-Regular","Cascadia Mono",Consolas,monospace;--fast:120ms;--ease:cubic-bezier(.2,0,0,1)}
*{box-sizing:border-box}
html,body{margin:0;background:var(--bg);color:var(--ink);font:15px/1.5 var(--font);-webkit-font-smoothing:antialiased}
body{padding:20px max(16px,env(safe-area-inset-right)) 32px max(16px,env(safe-area-inset-left))}
body:has(.app-header){padding:0}
.app{width:100%;max-width:1040px;margin:0 auto;display:flex;flex-direction:column;gap:16px}
.app>header.stack:first-child{padding-bottom:14px;border-bottom:1px solid var(--border)}
body:has(.app-header) .app{min-height:100vh;gap:0}
.app-header{position:sticky;top:0;z-index:10;background:rgba(255,255,255,.96);border-bottom:1px solid var(--border);padding:14px max(20px,env(safe-area-inset-right)) 14px max(20px,env(safe-area-inset-left));display:flex;align-items:center;justify-content:space-between;gap:12px;flex-wrap:wrap}
.app-body{flex:1;padding:20px max(20px,env(safe-area-inset-right)) 32px max(20px,env(safe-area-inset-left));display:flex;flex-direction:column;gap:16px}
.app-foot{padding:14px 20px;border-top:1px solid var(--border);color:var(--ink-3);font-size:12.5px;text-align:center}
h1{font-size:21px;line-height:1.25;font-weight:600;letter-spacing:-.01em;margin:0}
h2{font-size:16px;font-weight:600;margin:0}
h3{font-size:15px;font-weight:600;margin:0}
p{margin:0}
a{color:var(--accent)}
.muted{color:var(--ink-3)}.faint{color:var(--ink-4)}.small{font-size:12.5px}
.label{font:500 11px/1.2 var(--mono);letter-spacing:.14em;text-transform:uppercase;color:var(--ink-3)}
.mono{font-family:var(--mono);font-size:12.5px}
.num{font-variant-numeric:tabular-nums}
.row{display:flex;align-items:center;gap:8px;flex-wrap:wrap}
.between{justify-content:space-between}
.stack{display:flex;flex-direction:column;gap:8px}
.grow{flex:1;min-width:0}
.grid-2{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:16px}
.grid-auto{display:grid;grid-template-columns:repeat(auto-fit,minmax(180px,1fr));gap:12px}
@media (max-width:640px){.grid-2{grid-template-columns:1fr}}
.card{border:1px solid var(--border);border-radius:var(--radius-lg);padding:16px;background:var(--bg);box-shadow:var(--shadow-xs)}
.kpi{border:1px solid var(--border);border-radius:var(--radius-lg);padding:14px 16px;background:var(--bg);display:flex;flex-direction:column;gap:4px}
.kpi-val{font-size:26px;font-weight:600;line-height:1.1;font-variant-numeric:tabular-nums;letter-spacing:-.01em}
.kpi-lbl{font-size:12.5px;color:var(--ink-3)}
.list{display:flex;flex-direction:column;border:1px solid var(--border);border-radius:var(--radius-lg);overflow:hidden;background:var(--bg)}
.list>*{padding:12px 14px;border-top:1px solid var(--border)}
.list>*:first-child{border-top:0}
button{font:inherit;font-size:14px;font-weight:500;line-height:1.2;min-height:44px;border:1px solid var(--border-strong);background:var(--bg);color:var(--ink);border-radius:999px;padding:10px 16px;cursor:pointer;transition:background var(--fast) var(--ease),border-color var(--fast) var(--ease),color var(--fast) var(--ease)}
button:hover{background:var(--bg-hover)}
button:active{background:var(--bg-pressed)}
button:disabled{opacity:.45;cursor:default}
button.primary{background:var(--ink);border-color:var(--ink);color:#fff}
button.primary:hover{background:#2b2f38}
button.accent,.btn-accent{background:var(--accent);border-color:var(--accent);color:#fff}
button.accent:hover,.btn-accent:hover{background:#1f45b3}
button.danger,.btn-danger{background:var(--bg);border-color:var(--danger);color:var(--danger)}
button.danger:hover,.btn-danger:hover{background:var(--danger-soft)}
button.ghost{border-color:transparent;background:transparent}
button.ghost:hover{background:var(--bg-hover)}
button.item{display:block;width:100%;text-align:left;border:0;border-radius:0;padding:12px 14px;background:var(--bg)}
button.item:hover{background:var(--bg-subtle)}
button.item[aria-pressed="true"]{background:var(--bg-muted)}
:focus-visible{outline:2px solid var(--accent);outline-offset:2px}
input,textarea,select{font:inherit;font-size:16px;color:var(--ink);background:var(--bg-subtle);border:1px solid var(--border);border-radius:var(--radius);padding:10px 12px;min-height:44px;width:100%;transition:border-color var(--fast) var(--ease),background var(--fast) var(--ease)}
input:focus,textarea:focus,select:focus{background:var(--bg);border-color:var(--accent);outline:none}
input[type=checkbox],input[type=radio]{width:auto;min-height:0;accent-color:var(--ink)}
textarea{resize:vertical;min-height:88px}
.field{display:flex;flex-direction:column;gap:6px}
.search-row{display:flex;gap:8px;align-items:center;flex-wrap:wrap}
.search-row input{flex:1;min-width:180px}
.tabs{display:flex;gap:4px;border-bottom:1px solid var(--border);overflow-x:auto;scrollbar-width:none}
.tab{border:0;border-radius:0;background:transparent;color:var(--ink-3);padding:10px 14px;border-bottom:2px solid transparent;white-space:nowrap}
.tab:hover{background:var(--bg-hover);color:var(--ink)}
.tab[aria-selected="true"]{color:var(--ink);border-bottom-color:var(--ink);font-weight:600}
.bar{height:6px;border-radius:999px;background:var(--bg-muted);overflow:hidden}
.bar>i{display:block;height:100%;background:var(--ink);transition:width 220ms var(--ease)}
.chip{display:inline-flex;align-items:center;gap:6px;border:1px solid var(--border);border-radius:999px;padding:3px 10px;font-size:12.5px;color:var(--ink-2);background:var(--bg)}
.chip.on{background:var(--ink);border-color:var(--ink);color:#fff}
.badge{display:inline-flex;align-items:center;gap:4px;border-radius:999px;padding:2px 9px;font-size:12px;font-weight:600;background:var(--bg-muted);color:var(--ink-2)}
.badge-accent{background:var(--accent-soft);color:var(--accent)}
.badge-ok{background:var(--ok-soft);color:var(--ok)}
.badge-warn{background:var(--warn-soft);color:var(--warn)}
.badge-danger{background:var(--danger-soft);color:var(--danger)}
.notice{border:1px solid var(--border);border-left:3px solid var(--accent);border-radius:var(--radius);padding:10px 14px;background:var(--bg-subtle);color:var(--ink-2)}
.banner{border-radius:var(--radius);padding:10px 14px;background:var(--danger-soft);color:var(--danger);border:1px solid #efc7c3}
.empty{padding:28px 20px;text-align:center;color:var(--ink-3);border:1px dashed var(--border-strong);border-radius:var(--radius-lg)}
.empty svg{display:block;margin:0 auto 10px;color:var(--ink-4)}
hr{border:0;border-top:1px solid var(--border);margin:0}
table{width:100%;border-collapse:collapse;font-size:14px}
th,td{text-align:left;padding:10px 12px;border-bottom:1px solid var(--border)}
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

  // Wallet extensions (MetaMask, Rabby, Coinbase…) inject their script into every frame. In this
  // sandbox (opaque origin, no network) they cannot connect and throw "Failed to connect to MetaMask".
  // That is not the app failing: it is filtered out, never reported, and window.ethereum stays absent.
  var EXT_NOISE = /metamask|inpage\\.js|contentscript|ethereum|wallet_|eth_requestAccounts|chrome-extension:\\/\\/|moz-extension:\\/\\/|safari-(?:web-)?extension:\\/\\//i;
  function isExtensionNoise(err, source) {
    try {
      var msg = err && err.message ? err.message : String(err === undefined || err === null ? '' : err);
      var stack = String((err && err.stack) || '');
      var src = String(source || '');
      if (/^(?:chrome|moz|safari-web|safari)-extension:/i.test(src)) return true;
      if (msg === 'Script error.' && !stack) return true;
      return EXT_NOISE.test(msg + ' ' + stack + ' ' + src);
    } catch (x) { return false; }
  }
  try {
    if (!Object.getOwnPropertyDescriptor(window, 'ethereum')) {
      Object.defineProperty(window, 'ethereum', { value: undefined, configurable: true, writable: true });
    }
  } catch (e) {}

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
  window.addEventListener('error', function (e) {
    if (isExtensionNoise(e.error || e.message, e.filename)) { try { e.preventDefault(); } catch (x) {} return; }
    report(e.error || e.message);
  });
  window.addEventListener('unhandledrejection', function (e) {
    if (isExtensionNoise(e.reason, '')) { try { e.preventDefault(); } catch (x) {} return; }
    report(e.reason);
  });
  var lang = /^es\\b/i.test(String((navigator && navigator.language) || '')) ? 'es' : 'en';

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
    /** Read-modify-write of a shared key: updater(current) returns the new value (null removes it). */
    patch: function (key, updater, fallback) {
      if (typeof updater !== 'function') throw new Error('hl.patch needs a function.');
      var cur = hl.get(key, fallback === undefined ? null : fallback);
      var next = updater(cur);
      return hl.set(key, next === undefined ? null : next);
    },
    /** Removes a shared key. */
    remove: function (key) { return hl.set(key, null); },
    /** 'es' or 'en', from the browser language. */
    lang: lang,
    /** Picks the text for the reader's language: hl.pick('Guardar', 'Save'). */
    pick: function (es, en) { return lang === 'es' ? es : en; },
    /** A date for people, in their language. Empty when the value is not a date. */
    formatDate: function (iso, withTime) {
      var d = new Date(iso);
      if (isNaN(d.getTime())) return '';
      try {
        return d.toLocaleString(lang === 'es' ? 'es-ES' : 'en-GB', withTime === false
          ? { year: 'numeric', month: 'short', day: 'numeric' }
          : { year: 'numeric', month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' });
      } catch (e) { return d.toISOString().slice(0, 16).replace('T', ' '); }
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

/**
 * Host-side twin of the frame's extension filter: a wallet extension's failure inside the
 * sandbox ("Failed to connect to MetaMask") is not an app error and must never ask the creator
 * to "fix" the app. Older app documents built before the filter may still report it.
 */
const HOST_EXTENSION_NOISE = /metamask|inpage\.js|contentscript|ethereum|wallet_|eth_requestAccounts|chrome-extension:\/\/|moz-extension:\/\/|safari-(?:web-)?extension:\/\//i;
export function isExtensionNoiseMessage(message: string, stack = ''): boolean {
  return HOST_EXTENSION_NOISE.test(`${message} ${stack}`);
}

/**
 * The live preview of "Edit code". Served by the frame route (?preview=1, creator only) with the
 * same CSP and sandbox as a real app; the parent hands it the document being edited, which it
 * writes over itself. It never reads or writes the app's stored data: its hl answers come from
 * the editor, in memory.
 */
export const APP_PREVIEW_SHELL = [
  '<!doctype html><html lang="es"><head><meta charset="utf-8"><title>Preview</title></head><body>',
  '<script>(function(){',
  "window.addEventListener('message',function(e){if(e.source!==parent)return;var m=e.data;",
  "if(!m||m.hl!==1||m.op!=='preview'||typeof m.html!=='string')return;",
  'document.open();document.write(m.html);document.close();});',
  "try{parent.postMessage({hl:1,op:'preview-ready'},'*');}catch(e){}",
  '})();</script></body></html>',
].join('');
