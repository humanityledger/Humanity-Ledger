/**
 * lib/community-apps/templates.ts
 *
 * Apps that ship with Ledger Chat. They are written against the same bridge
 * as model-made apps (lib/community-apps/sdk.ts) and run in the same sandbox,
 * so they are also the reference a model is shown when it writes one.
 *
 * Each template follows the browser language (Spanish or English). Votes,
 * sign-ups and picks are member keys, so nobody can cast them for someone
 * else; settings are shared keys that the creator or an admin writes.
 *
 * Rule for editing: no backticks, no "${" and no backslashes inside the HTML
 * strings below, because they live inside TypeScript template literals (a
 * backslash there is consumed by TypeScript: write [0-9], not the digit class).
 *
 * V2 (27 Nov 2026): the first four keep their markup and storage keys, so
 * saved data still works; the base stylesheet now gives them the full width.
 * padel-league, expense-split and idea-board use the full-screen layout
 * (.app-header + .app-body) that generated apps are asked to follow.
 */

export interface AppTemplate {
  id: string;
  title: { es: string; en: string };
  summary: { es: string; en: string };
  html: string;
}

const POLL = `
<div class="app" id="root" aria-live="polite"><p class="muted">…</p></div>
<style>
.opt .bar{margin-top:8px}
.tick{font:500 11px/1 var(--mono);letter-spacing:.14em;text-transform:uppercase}
</style>
<script>
(function () {
  var es = (navigator.language || '').slice(0, 2) === 'es';
  var T = es ? {
    kind: 'Encuesta', fresh: 'Nueva encuesta', q: 'Pregunta', qph: '¿Qué hacemos el viernes?', opts: 'Opciones', opt: 'Opción',
    add: 'Añadir opción', remove: 'Quitar opción', multi: 'Cada persona puede elegir varias', voters: 'Mostrar quién votó cada opción',
    create: 'Publicar encuesta', need: 'Escribe la pregunta y al menos dos opciones distintas.',
    votes: function (n) { return n === 1 ? '1 voto' : n + ' votos'; }, one: 'Una opción por persona', many: 'Varias opciones por persona',
    closed: 'Cerrada', yours: 'Tu voto', retract: 'Retirar mi voto', close: 'Cerrar votación', reopen: 'Reabrir',
    confirm: 'Confirmar: borrar y empezar otra', waiting: 'Quien añadió esta app todavía no ha escrito la pregunta.',
    note: 'Cada voto queda guardado con tu dirección en el servidor de la comunidad.'
  } : {
    kind: 'Poll', fresh: 'New poll', q: 'Question', qph: 'What should we do on Friday?', opts: 'Options', opt: 'Option',
    add: 'Add option', remove: 'Remove option', multi: 'People can pick more than one', voters: 'Show who voted for each option',
    create: 'Publish poll', need: 'Write the question and at least two different options.',
    votes: function (n) { return n === 1 ? '1 vote' : n + ' votes'; }, one: 'One option per person', many: 'Several options per person',
    closed: 'Closed', yours: 'Your vote', retract: 'Withdraw my vote', close: 'Close voting', reopen: 'Reopen',
    confirm: 'Confirm: clear and start another', waiting: 'Whoever added this app has not written the question yet.',
    note: 'Each vote is stored with your address on the community server.'
  };
  var esc = hl.esc, root = document.getElementById('root'), ctx = null, armed = false;
  var draft = { q: '', opts: ['', ''], multi: false, showVoters: false };
  function manager() { return ctx && (ctx.me.isCreator || ctx.me.isAdmin); }

  function setup() {
    if (!manager()) { root.innerHTML = '<div class="empty">' + T.waiting + '</div>'; return; }
    var h = '<header class="stack"><span class="label">' + T.kind + '</span><h1>' + T.fresh + '</h1></header>';
    h += '<div class="field"><label class="label" for="q">' + T.q + '</label><input id="q" data-f="q" maxlength="200" placeholder="' + esc(T.qph) + '" value="' + esc(draft.q) + '"></div>';
    h += '<div class="field"><span class="label">' + T.opts + '</span><div class="stack">';
    draft.opts.forEach(function (o, k) {
      h += '<div class="row"><input class="grow" data-k="' + k + '" maxlength="120" aria-label="' + T.opt + ' ' + (k + 1) + '" placeholder="' + T.opt + ' ' + (k + 1) + '" value="' + esc(o) + '">';
      if (draft.opts.length > 2) h += '<button class="ghost" data-act="remove" data-k="' + k + '" aria-label="' + T.remove + '">×</button>';
      h += '</div>';
    });
    h += '</div>';
    if (draft.opts.length < 12) h += '<div><button class="ghost" data-act="add">' + T.add + '</button></div>';
    h += '</div>';
    h += '<label class="row small"><input type="checkbox" data-f="multi"' + (draft.multi ? ' checked' : '') + '>' + T.multi + '</label>';
    h += '<label class="row small"><input type="checkbox" data-f="voters"' + (draft.showVoters ? ' checked' : '') + '>' + T.voters + '</label>';
    h += '<p class="small muted" id="msg" role="status"></p>';
    h += '<div class="row"><button class="primary" data-act="create">' + T.create + '</button></div>';
    root.innerHTML = h;
  }

  function render() {
    var cfg = hl.get('poll', null);
    if (!cfg) { setup(); return; }
    var mine = hl.mine('vote', null);
    var picks = mine && mine.poll === cfg.id ? mine.choice : [];
    var closed = !!hl.get('closed:' + cfg.id, false);
    var votes = hl.everyone('vote').filter(function (v) { return v.value && v.value.poll === cfg.id; });
    var counts = cfg.options.map(function () { return 0; });
    var names = cfg.options.map(function () { return []; });
    votes.forEach(function (v) {
      (v.value.choice || []).forEach(function (i) { if (counts[i] !== undefined) { counts[i]++; names[i].push(v.label); } });
    });
    var total = votes.length;
    var h = '<header class="stack"><span class="label">' + T.kind + '</span><h1>' + esc(cfg.q) + '</h1>';
    h += '<p class="small muted num">' + T.votes(total) + ' · ' + (closed ? T.closed : (cfg.multi ? T.many : T.one)) + '</p></header>';
    h += '<div class="list">';
    cfg.options.forEach(function (o, i) {
      var pct = total ? Math.round(counts[i] * 100 / total) : 0;
      var on = picks.indexOf(i) >= 0;
      h += '<button class="item opt" data-i="' + i + '" aria-pressed="' + on + '"' + (closed ? ' aria-disabled="true"' : '') + '>';
      h += '<div class="row"><span class="grow">' + esc(o) + '</span>' + (on ? '<span class="tick">' + T.yours + '</span>' : '');
      h += '<span class="num muted small">' + counts[i] + ' · ' + pct + '%</span></div>';
      h += '<div class="bar"><i style="width:' + pct + '%"></i></div>';
      if (cfg.showVoters && names[i].length) h += '<p class="mono muted" style="margin-top:6px">' + names[i].map(esc).join(', ') + '</p>';
      h += '</button>';
    });
    h += '</div><div class="row">';
    if (picks.length && !closed) h += '<button class="ghost" data-act="retract">' + T.retract + '</button>';
    if (manager()) {
      h += '<span class="grow"></span><button data-act="toggle">' + (closed ? T.reopen : T.close) + '</button>';
      h += '<button class="ghost" data-act="fresh">' + (armed ? T.confirm : T.fresh) + '</button>';
    }
    h += '</div><p class="small faint">' + T.note + '</p>';
    root.innerHTML = h;
  }

  root.addEventListener('input', function (e) {
    var t = e.target;
    if (t.dataset.f === 'q') draft.q = t.value;
    else if (t.dataset.f === 'multi') draft.multi = t.checked;
    else if (t.dataset.f === 'voters') draft.showVoters = t.checked;
    else if (t.tagName === 'INPUT' && t.dataset.k !== undefined) draft.opts[+t.dataset.k] = t.value;
  });
  root.addEventListener('change', function (e) {
    var t = e.target;
    if (t.dataset.f === 'multi') draft.multi = t.checked;
    if (t.dataset.f === 'voters') draft.showVoters = t.checked;
  });
  root.addEventListener('click', function (e) {
    var b = e.target.closest('button');
    if (!b) return;
    var cfg = hl.get('poll', null), act = b.dataset.act;
    if (b.dataset.i !== undefined && cfg) {
      if (hl.get('closed:' + cfg.id, false)) return;
      var i = +b.dataset.i, mine = hl.mine('vote', null);
      var picks = mine && mine.poll === cfg.id ? mine.choice.slice() : [];
      var at = picks.indexOf(i);
      if (cfg.multi) { if (at >= 0) picks.splice(at, 1); else picks.push(i); }
      else picks = at >= 0 ? [] : [i];
      hl.setMine('vote', picks.length ? { poll: cfg.id, choice: picks } : null);
      return;
    }
    if (act === 'retract') hl.setMine('vote', null);
    if (act === 'toggle' && cfg) hl.set('closed:' + cfg.id, hl.get('closed:' + cfg.id, false) ? null : true);
    if (act === 'fresh') {
      if (!armed) { armed = true; render(); setTimeout(function () { armed = false; render(); }, 4000); return; }
      armed = false; draft = { q: '', opts: ['', ''], multi: false, showVoters: false };
      hl.set('poll', null);
      setup();
    }
    if (act === 'add') { draft.opts.push(''); setup(); var ins = root.querySelectorAll('input[data-k]'); ins[ins.length - 1].focus(); }
    if (act === 'remove') { draft.opts.splice(+b.dataset.k, 1); setup(); }
    if (act === 'create') {
      var q = draft.q.trim(), seen = {}, opts = [];
      draft.opts.forEach(function (o) { o = o.trim(); if (o && !seen[o.toLowerCase()]) { seen[o.toLowerCase()] = 1; opts.push(o); } });
      if (!q || opts.length < 2) { root.querySelector('#msg').textContent = T.need; return; }
      hl.set('poll', { id: hl.uid(), q: q, options: opts, multi: draft.multi, showVoters: draft.showVoters });
    }
  });

  hl.ready().then(function (c) {
    ctx = c; render();
    hl.onChange(function () { if (hl.get('poll', null) || !manager()) render(); });
  });
})();
</script>
`;

const SIGNUP = `
<div class="app" id="root" aria-live="polite"><p class="muted">…</p></div>
<style>
.slot{display:flex;flex-direction:column;gap:8px}
.people{display:flex;flex-wrap:wrap;gap:6px}
.wait{border-style:dashed}
.cap{width:84px;flex:none}
</style>
<script>
(function () {
  var es = (navigator.language || '').slice(0, 2) === 'es';
  var T = es ? {
    kind: 'Inscripción', fresh: 'Nueva hoja', title: 'Título', titleph: 'Turnos de limpieza del local', note: 'Nota (opcional)',
    slots: 'Huecos', slot: 'Hueco', slotph: 'Sábado 10:00', cap: 'Plazas', add: 'Añadir hueco', remove: 'Quitar hueco',
    create: 'Publicar hoja', need: 'Escribe un título y al menos un hueco.', join: 'Apuntarme', leave: 'Quitarme', move: 'Cambiarme aquí',
    full: 'Completo', waitlist: 'En espera', you: 'Tú', closed: 'Inscripciones cerradas', close: 'Cerrar inscripciones', reopen: 'Reabrir',
    confirm: 'Confirmar: borrar y empezar otra', waiting: 'Quien añadió esta app todavía no ha creado los huecos.',
    of: ' de ', note2: 'El orden de llegada decide las plazas. Quien no entra queda en espera y sube si alguien se quita.'
  } : {
    kind: 'Sign-up', fresh: 'New sheet', title: 'Title', titleph: 'Cleaning shifts', note: 'Note (optional)',
    slots: 'Slots', slot: 'Slot', slotph: 'Saturday 10:00', cap: 'Places', add: 'Add slot', remove: 'Remove slot',
    create: 'Publish sheet', need: 'Write a title and at least one slot.', join: 'Sign me up', leave: 'Remove me', move: 'Move me here',
    full: 'Full', waitlist: 'Waiting', you: 'You', closed: 'Sign-up closed', close: 'Close sign-up', reopen: 'Reopen',
    confirm: 'Confirm: clear and start another', waiting: 'Whoever added this app has not created the slots yet.',
    of: ' of ', note2: 'Places go in order of arrival. Anyone past the limit waits and moves up when someone leaves.'
  };
  var esc = hl.esc, root = document.getElementById('root'), ctx = null, armed = false;
  var draft = { title: '', note: '', slots: [{ label: '', cap: 1 }] };
  function manager() { return ctx && (ctx.me.isCreator || ctx.me.isAdmin); }

  function setup() {
    if (!manager()) { root.innerHTML = '<div class="empty">' + T.waiting + '</div>'; return; }
    var h = '<header class="stack"><span class="label">' + T.kind + '</span><h1>' + T.fresh + '</h1></header>';
    h += '<div class="field"><label class="label" for="t">' + T.title + '</label><input id="t" data-f="title" maxlength="140" placeholder="' + esc(T.titleph) + '" value="' + esc(draft.title) + '"></div>';
    h += '<div class="field"><label class="label" for="n">' + T.note + '</label><textarea id="n" data-f="note" maxlength="600">' + esc(draft.note) + '</textarea></div>';
    h += '<div class="field"><span class="label">' + T.slots + '</span><div class="stack">';
    draft.slots.forEach(function (s, k) {
      h += '<div class="row"><input class="grow" data-k="' + k + '" data-p="label" maxlength="80" aria-label="' + T.slot + ' ' + (k + 1) + '" placeholder="' + esc(T.slotph) + '" value="' + esc(s.label) + '">';
      h += '<input class="cap num" type="number" min="1" max="500" data-k="' + k + '" data-p="cap" aria-label="' + T.cap + '" value="' + s.cap + '">';
      if (draft.slots.length > 1) h += '<button class="ghost" data-act="remove" data-k="' + k + '" aria-label="' + T.remove + '">×</button>';
      h += '</div>';
    });
    h += '</div>';
    if (draft.slots.length < 40) h += '<div><button class="ghost" data-act="add">' + T.add + '</button></div>';
    h += '</div><p class="small muted" id="msg" role="status"></p>';
    h += '<div class="row"><button class="primary" data-act="create">' + T.create + '</button></div>';
    root.innerHTML = h;
  }

  function render() {
    var cfg = hl.get('sheet', null);
    if (!cfg) { setup(); return; }
    var closed = !!hl.get('closed:' + cfg.id, false);
    var mine = hl.mine('slot', null);
    var mySlot = mine && mine.sheet === cfg.id ? mine.slot : null;
    var rows = hl.everyone('slot').filter(function (r) { return r.value && r.value.sheet === cfg.id; });
    var h = '<header class="stack"><span class="label">' + T.kind + (closed ? ' · ' + T.closed : '') + '</span><h1>' + esc(cfg.title) + '</h1>';
    if (cfg.note) h += '<p class="muted">' + esc(cfg.note) + '</p>';
    h += '</header><div class="list">';
    cfg.slots.forEach(function (s) {
      var here = rows.filter(function (r) { return r.value.slot === s.id; });
      var inn = here.slice(0, s.cap), out = here.slice(s.cap);
      var isMine = mySlot === s.id;
      h += '<div class="slot"><div class="row"><div class="grow"><h3>' + esc(s.label) + '</h3>';
      h += '<p class="small muted num">' + Math.min(here.length, s.cap) + T.of + s.cap + (here.length >= s.cap ? ' · ' + T.full : '') + '</p></div>';
      if (!closed) {
        if (isMine) h += '<button data-act="leave">' + T.leave + '</button>';
        else h += '<button class="' + (mySlot ? '' : 'primary') + '" data-act="join" data-s="' + esc(s.id) + '">' + (mySlot ? T.move : T.join) + '</button>';
      }
      h += '</div>';
      if (here.length) {
        h += '<div class="people">';
        inn.forEach(function (r) { h += '<span class="chip mono' + (r.me ? ' on' : '') + '">' + (r.me ? T.you : esc(r.label)) + '</span>'; });
        out.forEach(function (r) { h += '<span class="chip mono wait" title="' + T.waitlist + '">' + (r.me ? T.you : esc(r.label)) + ' · ' + T.waitlist + '</span>'; });
        h += '</div>';
      }
      h += '</div>';
    });
    h += '</div><p class="small faint">' + T.note2 + '</p>';
    if (manager()) {
      h += '<div class="row"><button data-act="toggle">' + (closed ? T.reopen : T.close) + '</button>';
      h += '<button class="ghost" data-act="fresh">' + (armed ? T.confirm : T.fresh) + '</button></div>';
    }
    root.innerHTML = h;
  }

  root.addEventListener('input', function (e) {
    var t = e.target;
    if (t.dataset.f === 'title') draft.title = t.value;
    else if (t.dataset.f === 'note') draft.note = t.value;
    else if (t.dataset.k !== undefined && t.dataset.p) {
      var s = draft.slots[+t.dataset.k];
      if (t.dataset.p === 'cap') s.cap = Math.max(1, Math.min(500, parseInt(t.value, 10) || 1)); else s.label = t.value;
    }
  });
  root.addEventListener('click', function (e) {
    var b = e.target.closest('button');
    if (!b) return;
    var cfg = hl.get('sheet', null), act = b.dataset.act;
    if (act === 'join' && cfg) hl.setMine('slot', { sheet: cfg.id, slot: b.dataset.s });
    if (act === 'leave') hl.setMine('slot', null);
    if (act === 'toggle' && cfg) hl.set('closed:' + cfg.id, hl.get('closed:' + cfg.id, false) ? null : true);
    if (act === 'fresh') {
      if (!armed) { armed = true; render(); setTimeout(function () { armed = false; render(); }, 4000); return; }
      armed = false; draft = { title: '', note: '', slots: [{ label: '', cap: 1 }] };
      hl.set('sheet', null); setup();
    }
    if (act === 'add') { draft.slots.push({ label: '', cap: 1 }); setup(); var ins = root.querySelectorAll('input[data-p=label]'); ins[ins.length - 1].focus(); }
    if (act === 'remove') { draft.slots.splice(+b.dataset.k, 1); setup(); }
    if (act === 'create') {
      var title = draft.title.trim();
      var slots = draft.slots.filter(function (s) { return s.label.trim(); }).map(function (s) {
        return { id: hl.uid(), label: s.label.trim(), cap: s.cap };
      });
      if (!title || !slots.length) { root.querySelector('#msg').textContent = T.need; return; }
      hl.set('sheet', { id: hl.uid(), title: title, note: draft.note.trim(), slots: slots });
    }
  });

  hl.ready().then(function (c) {
    ctx = c; render();
    hl.onChange(function () { if (hl.get('sheet', null) || !manager()) render(); });
  });
})();
</script>
`;

const LIST = `
<div class="app" id="root" aria-live="polite"><p class="muted">…</p></div>
<style>
.it{display:flex;align-items:flex-start;gap:12px}
.box{flex:none;width:20px;height:20px;padding:0;border-radius:6px;margin-top:1px;display:flex;align-items:center;justify-content:center;font-size:12px;line-height:1}
.box[aria-pressed="true"]{background:var(--ink);border-color:var(--ink);color:#fff}
.done .txt{text-decoration:line-through;color:var(--ink-3)}
.x{padding:2px 8px;font-size:12.5px}
</style>
<script>
(function () {
  var es = (navigator.language || '').slice(0, 2) === 'es';
  var T = es ? {
    kind: 'Lista compartida', def: 'Lista compartida', ph: 'Añade algo a la lista', add: 'Añadir', open: function (n) { return n === 1 ? '1 pendiente' : n + ' pendientes'; },
    done: 'Hecho', by: 'por', mark: 'Marcar como hecho', unmark: 'Marcar como pendiente', del: 'Quitar', hide: 'Ocultar',
    rename: 'Renombrar', save: 'Guardar', empty: 'La lista está vacía. Lo primero que escribas aparecerá aquí para todos.',
    full: 'Has llegado al máximo de elementos propios. Quita alguno que ya esté hecho.'
  } : {
    kind: 'Shared list', def: 'Shared list', ph: 'Add something to the list', add: 'Add', open: function (n) { return n + ' open'; },
    done: 'Done', by: 'by', mark: 'Mark as done', unmark: 'Mark as open', del: 'Remove', hide: 'Hide',
    rename: 'Rename', save: 'Save', empty: 'The list is empty. The first thing you add appears here for everyone.',
    full: 'You have reached the limit of items of your own. Remove one that is done.'
  };
  var esc = hl.esc, root = document.getElementById('root'), ctx = null, renaming = false, typed = '';
  function manager() { return ctx && (ctx.me.isCreator || ctx.me.isAdmin); }

  function items() {
    var out = [];
    hl.everyone('items').forEach(function (row) {
      (row.value || []).forEach(function (it) {
        if (hl.get('hide:' + it.id, null)) return;
        var d = hl.list('done:' + it.id)[0];
        out.push({ id: it.id, text: it.text, at: it.at, author: row.label, mine: !!row.me, done: d ? d.by : null });
      });
    });
    return out.sort(function (a, b) {
      if (!!a.done !== !!b.done) return a.done ? 1 : -1;
      return a.at < b.at ? -1 : 1;
    });
  }

  function render() {
    var title = hl.get('title', T.def), list = items();
    var open = list.filter(function (i) { return !i.done; }).length;
    var h = '<header class="stack"><span class="label">' + T.kind + '</span>';
    if (renaming) {
      h += '<div class="row"><input class="grow" id="title" maxlength="80" value="' + esc(title) + '"><button class="primary" data-act="saveTitle">' + T.save + '</button></div>';
    } else {
      h += '<div class="row between"><h1>' + esc(title) + '</h1>' + (manager() ? '<button class="ghost small" data-act="rename">' + T.rename + '</button>' : '') + '</div>';
    }
    h += '<p class="small muted num">' + T.open(open) + '</p></header>';
    h += '<div class="row"><input class="grow" id="new" maxlength="140" placeholder="' + esc(T.ph) + '" value="' + esc(typed) + '"><button class="primary" data-act="add">' + T.add + '</button></div>';
    h += '<p class="small muted" id="msg" role="status"></p>';
    if (!list.length) h += '<div class="empty">' + T.empty + '</div>';
    else {
      h += '<div class="list">';
      list.forEach(function (it) {
        h += '<div class="it' + (it.done ? ' done' : '') + '">';
        h += '<button class="box" data-act="check" data-id="' + esc(it.id) + '" aria-pressed="' + !!it.done + '" aria-label="' + (it.done ? T.unmark : T.mark) + '">' + (it.done ? '✓' : '') + '</button>';
        h += '<div class="grow"><p class="txt">' + esc(it.text) + '</p><p class="small muted mono">' + esc(it.author);
        if (it.done) h += ' · ' + T.done + ' ' + T.by + ' ' + esc(it.done.label);
        h += '</p></div>';
        if (it.mine) h += '<button class="ghost x" data-act="del" data-id="' + esc(it.id) + '">' + T.del + '</button>';
        else if (manager()) h += '<button class="ghost x" data-act="hide" data-id="' + esc(it.id) + '">' + T.hide + '</button>';
        h += '</div>';
      });
      h += '</div>';
    }
    var focused = document.activeElement && document.activeElement.id === 'new';
    root.innerHTML = h;
    if (focused) { var n = root.querySelector('#new'); n.focus(); n.setSelectionRange(n.value.length, n.value.length); }
  }

  function add() {
    var text = typed.trim();
    if (!text) return;
    var mine = hl.mine('items', []);
    mine.push({ id: hl.uid(), text: text, at: new Date().toISOString() });
    if (JSON.stringify(mine).length > 7800) { root.querySelector('#msg').textContent = T.full; return; }
    typed = '';
    hl.setMine('items', mine);
  }

  root.addEventListener('input', function (e) { if (e.target.id === 'new') typed = e.target.value; });
  root.addEventListener('keydown', function (e) {
    if (e.key !== 'Enter') return;
    if (e.target.id === 'new') { e.preventDefault(); add(); }
    if (e.target.id === 'title') { e.preventDefault(); root.querySelector('[data-act=saveTitle]').click(); }
  });
  root.addEventListener('click', function (e) {
    var b = e.target.closest('button');
    if (!b) return;
    var act = b.dataset.act, id = b.dataset.id;
    if (act === 'add') add();
    if (act === 'check') hl.set('done:' + id, hl.get('done:' + id, null) ? null : true);
    if (act === 'del') hl.setMine('items', hl.mine('items', []).filter(function (i) { return i.id !== id; }));
    if (act === 'hide') hl.set('hide:' + id, true);
    if (act === 'rename') { renaming = true; render(); root.querySelector('#title').focus(); }
    if (act === 'saveTitle') {
      var v = root.querySelector('#title').value.trim();
      renaming = false;
      hl.set('title', v || null);
      render();
    }
  });

  hl.ready().then(function (c) {
    ctx = c; render();
    hl.onChange(function () { if (!renaming) render(); });
  });
})();
</script>
`;

const WHEN = `
<div class="app" id="root" aria-live="polite"><p class="muted">…</p></div>
<style>
.grid{border-collapse:separate;border-spacing:4px;width:100%}
.grid th{border:0;padding:4px 6px;font-size:12.5px;white-space:nowrap}
.grid td{border:0;padding:0}
.cell{width:100%;min-width:56px;height:40px;border-radius:8px;padding:0;font-size:12.5px;font-variant-numeric:tabular-nums}
.cell[aria-pressed="true"]{box-shadow:inset 0 0 0 2px var(--ink)}
.cell.dark[aria-pressed="true"]{box-shadow:inset 0 0 0 2px #fff,0 0 0 1px var(--ink)}
.two{display:grid;grid-template-columns:1fr 1fr;gap:12px}
@media (max-width:420px){.two{grid-template-columns:1fr}}
</style>
<script>
(function () {
  var es = (navigator.language || '').slice(0, 2) === 'es';
  var lang = es ? 'es' : 'en';
  var T = es ? {
    kind: '¿Cuándo quedamos?', fresh: 'Nueva propuesta', title: 'Para qué', titleph: 'Cena de fin de mes', from: 'Desde', days: 'Días',
    parts: 'Franjas', partsDef: 'Mañana, Tarde, Noche', partsHelp: 'Separadas por comas', create: 'Publicar',
    need: 'Escribe para qué es, una fecha y al menos una franja.', tap: 'Toca las casillas en las que puedes. Cada número es cuánta gente puede.',
    best: 'Mejor opción', none: 'Nadie ha marcado nada todavía.', people: function (n, t) { return n + ' de ' + t + (t === 1 ? ' persona' : ' personas'); },
    answered: function (n) { return n === 1 ? '1 persona ha respondido' : n + ' personas han respondido'; },
    confirm: 'Confirmar: borrar y empezar otra', waiting: 'Quien añadió esta app todavía no ha propuesto fechas.'
  } : {
    kind: 'When can we meet?', fresh: 'New proposal', title: 'What for', titleph: 'End of month dinner', from: 'From', days: 'Days',
    parts: 'Time slots', partsDef: 'Morning, Afternoon, Evening', partsHelp: 'Separated by commas', create: 'Publish',
    need: 'Write what it is for, a date and at least one time slot.', tap: 'Tap the cells that work for you. Each number is how many people can make it.',
    best: 'Best option', none: 'Nobody has marked anything yet.', people: function (n, t) { return n + ' of ' + t + (t === 1 ? ' person' : ' people'); },
    answered: function (n) { return n === 1 ? '1 person has answered' : n + ' people have answered'; },
    confirm: 'Confirm: clear and start another', waiting: 'Whoever added this app has not proposed dates yet.'
  };
  var esc = hl.esc, root = document.getElementById('root'), ctx = null, armed = false;
  function today() { var d = new Date(); d.setMinutes(d.getMinutes() - d.getTimezoneOffset()); return d.toISOString().slice(0, 10); }
  var draft = { title: '', from: today(), days: 7, parts: T.partsDef };
  function manager() { return ctx && (ctx.me.isCreator || ctx.me.isAdmin); }
  function dayLabel(iso) {
    var p = iso.split('-');
    return new Date(+p[0], +p[1] - 1, +p[2]).toLocaleDateString(lang, { weekday: 'short', day: 'numeric', month: 'short' });
  }

  function setup() {
    if (!manager()) { root.innerHTML = '<div class="empty">' + T.waiting + '</div>'; return; }
    var h = '<header class="stack"><span class="label">' + T.kind + '</span><h1>' + T.fresh + '</h1></header>';
    h += '<div class="field"><label class="label" for="t">' + T.title + '</label><input id="t" data-f="title" maxlength="120" placeholder="' + esc(T.titleph) + '" value="' + esc(draft.title) + '"></div>';
    h += '<div class="two"><div class="field"><label class="label" for="f">' + T.from + '</label><input id="f" type="date" data-f="from" value="' + esc(draft.from) + '"></div>';
    h += '<div class="field"><label class="label" for="d">' + T.days + '</label><input id="d" type="number" min="1" max="21" data-f="days" value="' + draft.days + '"></div></div>';
    h += '<div class="field"><label class="label" for="p">' + T.parts + '</label><input id="p" data-f="parts" maxlength="160" value="' + esc(draft.parts) + '"><span class="small muted">' + T.partsHelp + '</span></div>';
    h += '<p class="small muted" id="msg" role="status"></p><div class="row"><button class="primary" data-act="create">' + T.create + '</button></div>';
    root.innerHTML = h;
  }

  function render() {
    var cfg = hl.get('plan', null);
    if (!cfg) { setup(); return; }
    var rows = hl.everyone('avail').filter(function (r) { return r.value && r.value.plan === cfg.id; });
    var mine = hl.mine('avail', null);
    var picks = mine && mine.plan === cfg.id ? mine.picks : [];
    var count = {}, names = {};
    rows.forEach(function (r) {
      (r.value.picks || []).forEach(function (k) { count[k] = (count[k] || 0) + 1; (names[k] = names[k] || []).push(r.label); });
    });
    var total = rows.length, top = 0;
    Object.keys(count).forEach(function (k) { if (count[k] > top) top = count[k]; });
    var h = '<header class="stack"><span class="label">' + T.kind + '</span><h1>' + esc(cfg.title) + '</h1>';
    h += '<p class="small muted">' + T.answered(total) + '. ' + T.tap + '</p></header>';
    h += '<div class="scroll-x"><table class="grid"><thead><tr><th></th>';
    cfg.parts.forEach(function (p) { h += '<th scope="col">' + esc(p) + '</th>'; });
    h += '</tr></thead><tbody>';
    cfg.days.forEach(function (d) {
      h += '<tr><th scope="row">' + esc(dayLabel(d)) + '</th>';
      cfg.parts.forEach(function (p, i) {
        var k = d + '|' + i, n = count[k] || 0, on = picks.indexOf(k) >= 0;
        var a = total ? 0.06 + 0.84 * (n / total) : 0;
        var dark = a > 0.5;
        var style = n ? 'background:rgba(21,23,28,' + a.toFixed(2) + ');border-color:transparent;color:' + (dark ? '#fff' : 'var(--ink)') : '';
        var who = (names[k] || []).join(', ');
        h += '<td><button class="cell' + (dark ? ' dark' : '') + '" data-k="' + esc(k) + '" aria-pressed="' + on + '" style="' + style + '" title="' + esc(who) + '" aria-label="' + esc(dayLabel(d) + ' ' + p + ': ' + n) + '">' + (n || '') + '</button></td>';
      });
      h += '</tr>';
    });
    h += '</tbody></table></div>';
    var best = Object.keys(count).filter(function (k) { return count[k] === top && top > 0; }).sort();
    h += '<div class="card stack"><span class="label">' + T.best + '</span>';
    if (!best.length) h += '<p class="muted">' + T.none + '</p>';
    best.slice(0, 3).forEach(function (k) {
      var parts = k.split('|');
      h += '<div><p><strong>' + esc(dayLabel(parts[0])) + ' · ' + esc(cfg.parts[+parts[1]] || '') + '</strong> <span class="muted small num">' + T.people(count[k], total) + '</span></p>';
      h += '<p class="mono muted">' + names[k].map(esc).join(', ') + '</p></div>';
    });
    h += '</div>';
    if (manager()) h += '<div class="row"><button class="ghost" data-act="fresh">' + (armed ? T.confirm : T.fresh) + '</button></div>';
    root.innerHTML = h;
  }

  root.addEventListener('input', function (e) {
    var t = e.target, f = t.dataset.f;
    if (f === 'title') draft.title = t.value;
    if (f === 'from') draft.from = t.value;
    if (f === 'days') draft.days = Math.max(1, Math.min(21, parseInt(t.value, 10) || 1));
    if (f === 'parts') draft.parts = t.value;
  });
  root.addEventListener('click', function (e) {
    var b = e.target.closest('button');
    if (!b) return;
    var cfg = hl.get('plan', null), act = b.dataset.act;
    if (b.dataset.k && cfg) {
      var mine = hl.mine('avail', null);
      var picks = mine && mine.plan === cfg.id ? mine.picks.slice() : [];
      var at = picks.indexOf(b.dataset.k);
      if (at >= 0) picks.splice(at, 1); else picks.push(b.dataset.k);
      hl.setMine('avail', picks.length ? { plan: cfg.id, picks: picks } : null);
      return;
    }
    if (act === 'fresh') {
      if (!armed) { armed = true; render(); setTimeout(function () { armed = false; render(); }, 4000); return; }
      armed = false; hl.set('plan', null); setup();
    }
    if (act === 'create') {
      var title = draft.title.trim();
      var parts = draft.parts.split(',').map(function (s) { return s.trim(); }).filter(Boolean).slice(0, 6);
      if (!title || !/^[0-9]{4}-[0-9]{2}-[0-9]{2}$/.test(draft.from) || !parts.length) { root.querySelector('#msg').textContent = T.need; return; }
      var p = draft.from.split('-'), start = new Date(+p[0], +p[1] - 1, +p[2]), days = [];
      for (var i = 0; i < draft.days; i++) {
        var d = new Date(start.getFullYear(), start.getMonth(), start.getDate() + i);
        days.push(d.getFullYear() + '-' + ('0' + (d.getMonth() + 1)).slice(-2) + '-' + ('0' + d.getDate()).slice(-2));
      }
      hl.set('plan', { id: hl.uid(), title: title, days: days, parts: parts });
    }
  });

  hl.ready().then(function (c) {
    ctx = c; render();
    hl.onChange(function () { if (hl.get('plan', null) || !manager()) render(); });
  });
})();
</script>
`;

/* ── V2 templates (27 Nov 2026): full-screen layout, .app-header + .app-body ── */

const PADEL_LEAGUE = `
<div class="app" id="root" aria-live="polite"><p class="muted">…</p></div>
<style>
.score{font-variant-numeric:tabular-nums;font-weight:600;padding:0 6px}
.win{font-weight:600}
.pos{width:40px;color:var(--ink-3)}
</style>
<script>
(function () {
  var es = (navigator.language || '').slice(0, 2) === 'es';
  var T = es ? {
    kind: 'Liga', title: 'Liga de pádel', record: 'Anotar partido', table: 'Clasificación', matches: 'Partidos', settings: 'Ajustes',
    player: 'Jugador', p: 'PJ', w: 'PG', l: 'PP', diff: 'Dif.', pts: 'Pts', teamA: 'Pareja A', teamB: 'Pareja B',
    player1: 'Jugador 1', player2: 'Jugador 2 (vacío si es individual)', games: 'Juegos ganados', date: 'Fecha', save: 'Guardar', cancel: 'Cancelar',
    del: 'Borrar', confirm: 'Confirmar borrado', search: 'Buscar jugador', page: 'Página', noMatches: 'Todavía no hay partidos. Anota el primero.',
    noFound: 'Ningún resultado con esa búsqueda.', kMatches: 'Partidos', kPlayers: 'Jugadores', kLast: 'Último partido',
    rule: 'Victoria 3 puntos, derrota 0. Empate a puntos: diferencia de juegos, luego victorias.',
    errPlayers: 'Escribe al menos un jugador en cada pareja.', errPairs: 'Las dos parejas deben tener el mismo número de jugadores.',
    errSame: 'Un jugador no puede estar dos veces en el mismo partido.', errScore: 'Los juegos son números enteros entre 0 y 99.',
    errDraw: 'Un partido no puede acabar en empate.', name: 'Nombre de la liga', onlyOrg: 'Solo quien añadió la app o un admin cambia los ajustes.',
    danger: 'Empezar temporada nueva', clear: 'Borrar todos los partidos', clearConfirm: 'Confirmar: borrar todos', saved: 'Guardado.',
    clearHelp: 'Borra todos los partidos para todos los miembros. No se puede deshacer.', by: 'anotado por'
  } : {
    kind: 'League', title: 'Padel league', record: 'Record match', table: 'Standings', matches: 'Matches', settings: 'Settings',
    player: 'Player', p: 'P', w: 'W', l: 'L', diff: 'Diff', pts: 'Pts', teamA: 'Team A', teamB: 'Team B',
    player1: 'Player 1', player2: 'Player 2 (empty for singles)', games: 'Games won', date: 'Date', save: 'Save', cancel: 'Cancel',
    del: 'Delete', confirm: 'Confirm delete', search: 'Search player', page: 'Page', noMatches: 'No matches yet. Record the first one.',
    noFound: 'Nothing matches that search.', kMatches: 'Matches', kPlayers: 'Players', kLast: 'Last match',
    rule: 'A win is 3 points, a loss 0. Ties on points: game difference, then wins.',
    errPlayers: 'Write at least one player on each team.', errPairs: 'Both teams need the same number of players.',
    errSame: 'A player cannot appear twice in the same match.', errScore: 'Games are whole numbers from 0 to 99.',
    errDraw: 'A match cannot end in a draw.', name: 'League name', onlyOrg: 'Only whoever added the app or an admin changes settings.',
    danger: 'Start a new season', clear: 'Delete all matches', clearConfirm: 'Confirm: delete all', saved: 'Saved.',
    clearHelp: 'Deletes every match for every member. This cannot be undone.', by: 'recorded by'
  };
  var ICON = '<svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" aria-hidden="true"><circle cx="12" cy="12" r="9"/><path d="M5 9c4 2 10 2 14 0M5 15c4-2 10-2 14 0"/></svg>';
  var PER = 20;
  var root = document.getElementById('root');
  var me = null, tab = 'table', q = '', err = '', armed = '', page = 0, titleDraft = null;
  var form = { a1: '', a2: '', b1: '', b2: '', sa: '', sb: '', date: '' };
  var esc = hl.esc;

  function manager() { return !!me && (me.isCreator || me.isAdmin); }
  function clean(s) { return String(s || '').split(' ').filter(Boolean).join(' ').slice(0, 40); }
  function low(s) { return clean(s).toLowerCase(); }
  function today() { return new Date().toISOString().slice(0, 10); }
  function day(d) { return hl.formatDate(String(d).length === 10 ? d + 'T12:00:00' : d, false); }
  function matches() {
    return hl.list('match:').map(function (e) {
      var v = e.value || {};
      return { id: e.key.slice(6), a: [v.a1, v.a2].filter(Boolean), b: [v.b1, v.b2].filter(Boolean), sa: +v.sa || 0, sb: +v.sb || 0, date: v.date || e.at, by: e.by };
    }).filter(function (m) { return m.a.length && m.b.length && m.sa !== m.sb; })
      .sort(function (x, y) { return x.date < y.date ? 1 : x.date > y.date ? -1 : (x.id < y.id ? 1 : -1); });
  }
  function standings(list) {
    var rows = {};
    function row(n) { var k = low(n); if (!rows[k]) rows[k] = { name: clean(n), p: 0, w: 0, l: 0, gf: 0, ga: 0 }; return rows[k]; }
    list.forEach(function (m) {
      var aw = m.sa > m.sb;
      m.a.forEach(function (n) { var r = row(n); r.p++; r.gf += m.sa; r.ga += m.sb; if (aw) r.w++; else r.l++; });
      m.b.forEach(function (n) { var r = row(n); r.p++; r.gf += m.sb; r.ga += m.sa; if (aw) r.l++; else r.w++; });
    });
    return Object.keys(rows).map(function (k) { var r = rows[k]; r.pts = r.w * 3; r.diff = r.gf - r.ga; return r; })
      .sort(function (x, y) { return y.pts - x.pts || y.diff - x.diff || y.w - x.w || (x.name < y.name ? -1 : 1); });
  }
  function empty(t) { return '<div class="empty">' + ICON + '<p>' + t + '</p></div>'; }
  function searchRow() { return '<div class="search-row"><input id="q" type="search" placeholder="' + T.search + '" aria-label="' + T.search + '" value="' + esc(q) + '"></div>'; }
  function pager(pages) {
    var h = '<div class="row">';
    for (var i = 0; i < pages; i++) h += '<button class="' + (i === page ? 'primary' : 'ghost') + '" data-act="page" data-p="' + i + '" aria-label="' + T.page + ' ' + (i + 1) + '">' + (i + 1) + '</button>';
    return h + '</div>';
  }
  function tabs() {
    var list = [['table', T.table], ['matches', T.matches], ['add', T.record]];
    if (manager()) list.push(['settings', T.settings]);
    return '<div class="tabs" role="tablist">' + list.map(function (t) {
      return '<button class="tab" role="tab" data-act="tab" data-tab="' + t[0] + '" aria-selected="' + (tab === t[0]) + '">' + t[1] + '</button>';
    }).join('') + '</div>';
  }
  function viewTable(list) {
    var rows = standings(list);
    if (!rows.length) return empty(T.noMatches);
    var f = low(q);
    var shown = rows.map(function (r, i) { r.pos = i + 1; return r; }).filter(function (r) { return !f || low(r.name).indexOf(f) >= 0; });
    var h = searchRow();
    if (!shown.length) return h + '<p class="muted">' + T.noFound + '</p>';
    h += '<div class="scroll-x"><table><thead><tr><th>#</th><th>' + T.player + '</th><th class="num">' + T.p + '</th><th class="num">' + T.w + '</th><th class="num">' + T.l + '</th><th class="num">' + T.diff + '</th><th class="num">' + T.pts + '</th></tr></thead><tbody>';
    h += shown.map(function (r) {
      return '<tr><td class="pos num">' + r.pos + '</td><td>' + esc(r.name) + '</td><td class="num">' + r.p + '</td><td class="num">' + r.w + '</td><td class="num">' + r.l + '</td><td class="num">' + (r.diff > 0 ? '+' : '') + r.diff + '</td><td class="num"><strong>' + r.pts + '</strong></td></tr>';
    }).join('');
    return h + '</tbody></table></div><p class="small muted">' + T.rule + '</p>';
  }
  function viewMatches(list) {
    if (!list.length) return empty(T.noMatches);
    var f = low(q);
    var shown = list.filter(function (m) { return !f || low(m.a.concat(m.b).join(' ')).indexOf(f) >= 0; });
    var pages = Math.max(1, Math.ceil(shown.length / PER));
    if (page >= pages) page = pages - 1;
    var h = searchRow();
    if (!shown.length) return h + '<p class="muted">' + T.noFound + '</p>';
    h += '<div class="list">' + shown.slice(page * PER, page * PER + PER).map(function (m) {
      var aw = m.sa > m.sb;
      var can = manager() || (m.by && me && m.by.id === me.id);
      return '<div class="row between"><div class="grow stack" style="gap:2px"><div><span class="' + (aw ? 'win' : '') + '">' + esc(m.a.join(' / ')) + '</span><span class="score">' + m.sa + ' – ' + m.sb + '</span><span class="' + (aw ? '' : 'win') + '">' + esc(m.b.join(' / ')) + '</span></div>' +
        '<span class="small muted">' + esc(day(m.date)) + (m.by ? ' · ' + T.by + ' ' + esc(m.by.label) : '') + '</span></div>' +
        (can ? '<button class="' + (armed === m.id ? 'danger' : 'ghost') + '" data-act="del" data-id="' + esc(m.id) + '">' + (armed === m.id ? T.confirm : T.del) + '</button>' : '') + '</div>';
    }).join('') + '</div>';
    return pages > 1 ? h + pager(pages) : h;
  }
  function inp(f, lbl, num) {
    return '<label class="field"><span class="small muted">' + lbl + '</span><input data-f="' + f + '" ' +
      (num ? 'type="number" inputmode="numeric" min="0" max="99"' : 'list="players" maxlength="40" autocomplete="off"') +
      ' value="' + esc(form[f]) + '" aria-label="' + lbl + '"></label>';
  }
  function viewAdd(list) {
    var names = standings(list).map(function (r) { return r.name; });
    var h = '<div class="card stack"><h2>' + T.record + '</h2>';
    h += '<datalist id="players">' + names.map(function (n) { return '<option value="' + esc(n) + '">'; }).join('') + '</datalist>';
    h += '<div class="grid-2"><div class="stack"><span class="label">' + T.teamA + '</span>' + inp('a1', T.player1) + inp('a2', T.player2) + inp('sa', T.games, true) + '</div>';
    h += '<div class="stack"><span class="label">' + T.teamB + '</span>' + inp('b1', T.player1) + inp('b2', T.player2) + inp('sb', T.games, true) + '</div></div>';
    h += '<label class="field"><span class="label">' + T.date + '</span><input type="date" data-f="date" value="' + esc(form.date || today()) + '" aria-label="' + T.date + '"></label>';
    if (err) h += '<p class="banner" role="alert">' + esc(err) + '</p>';
    return h + '<div class="row"><button class="accent" data-act="save">' + T.save + '</button><button class="ghost" data-act="tab" data-tab="table">' + T.cancel + '</button></div></div>';
  }
  function viewSettings(list) {
    if (!manager()) return empty(T.onlyOrg);
    var cfg = hl.get('cfg', {}) || {};
    var h = '<div class="card stack"><h2>' + T.settings + '</h2><label class="field"><span class="label">' + T.name + '</span><input id="title" maxlength="60" value="' + esc(titleDraft !== null ? titleDraft : (cfg.title || '')) + '" placeholder="' + T.title + '"></label><div class="row"><button class="primary" data-act="rename">' + T.save + '</button></div></div>';
    return h + '<div class="card stack"><h2>' + T.danger + '</h2><p class="small muted">' + T.clearHelp + '</p><div class="row"><button class="danger" data-act="clear"' + (list.length ? '' : ' disabled') + '>' + (armed === '*' ? T.clearConfirm : T.clear) + '</button></div></div>';
  }
  function save() {
    var a1 = clean(form.a1), a2 = clean(form.a2), b1 = clean(form.b1), b2 = clean(form.b2);
    var sa = parseInt(form.sa, 10), sb = parseInt(form.sb, 10);
    var all = [a1, a2, b1, b2].filter(Boolean).map(function (n) { return n.toLowerCase(); });
    err = '';
    if (!a1 || !b1) err = T.errPlayers;
    else if (!a2 !== !b2) err = T.errPairs;
    else if (all.some(function (n, i) { return all.indexOf(n) !== i; })) err = T.errSame;
    else if (isNaN(sa) || isNaN(sb) || sa < 0 || sb < 0 || sa > 99 || sb > 99) err = T.errScore;
    else if (sa === sb) err = T.errDraw;
    if (err) { render(); return; }
    var d = /^[0-9]{4}-[0-9]{2}-[0-9]{2}$/.test(form.date) ? form.date : today();
    hl.set('match:' + d.split('-').join('') + '-' + hl.uid(), { a1: a1, a2: a2 || null, b1: b1, b2: b2 || null, sa: sa, sb: sb, date: d });
    form = { a1: '', a2: '', b1: '', b2: '', sa: '', sb: '', date: d };
    tab = 'matches'; page = 0; q = '';
    render();
  }
  function render() {
    if (!me) return;
    var a = document.activeElement;
    var fid = a && root.contains(a) ? (a.id || a.getAttribute('data-f')) : null;
    var pos = fid ? a.selectionStart : null;
    var list = matches();
    var cfg = hl.get('cfg', {}) || {};
    var h = '<header class="app-header"><div><span class="label">' + T.kind + '</span><h1>' + esc(cfg.title || T.title) + '</h1></div>' +
      (tab === 'add' ? '' : '<button class="accent" data-act="tab" data-tab="add">' + T.record + '</button>') + '</header><main class="app-body">';
    h += '<div class="grid-auto"><div class="kpi"><span class="kpi-val">' + list.length + '</span><span class="kpi-lbl">' + T.kMatches + '</span></div>' +
      '<div class="kpi"><span class="kpi-val">' + standings(list).length + '</span><span class="kpi-lbl">' + T.kPlayers + '</span></div>' +
      '<div class="kpi"><span class="kpi-val">' + (list.length ? esc(day(list[0].date)) : '—') + '</span><span class="kpi-lbl">' + T.kLast + '</span></div></div>';
    h += tabs();
    h += tab === 'matches' ? viewMatches(list) : tab === 'add' ? viewAdd(list) : tab === 'settings' ? viewSettings(list) : viewTable(list);
    root.innerHTML = h + '</main>';
    if (fid) {
      var el = document.getElementById(fid) || root.querySelector('[data-f="' + fid + '"]');
      if (el) { el.focus(); try { if (pos !== null && pos !== undefined) el.setSelectionRange(pos, pos); } catch (x) {} }
    }
  }
  root.addEventListener('input', function (e) {
    var f = e.target.getAttribute('data-f');
    if (f) form[f] = e.target.value;
    if (e.target.id === 'q') { q = e.target.value; page = 0; render(); }
    if (e.target.id === 'title') titleDraft = e.target.value;
  });
  root.addEventListener('keydown', function (e) { if (e.key === 'Enter' && e.target.getAttribute('data-f')) save(); });
  root.addEventListener('click', function (e) {
    var b = e.target.closest('button');
    if (!b) return;
    var act = b.getAttribute('data-act');
    if (act === 'tab') { tab = b.getAttribute('data-tab'); err = ''; q = ''; page = 0; armed = ''; render(); }
    else if (act === 'save') save();
    else if (act === 'page') { page = +b.getAttribute('data-p') || 0; render(); }
    else if (act === 'del') {
      var id = b.getAttribute('data-id');
      if (armed === id) { armed = ''; hl.remove('match:' + id); } else { armed = id; render(); }
    } else if (act === 'clear' && manager()) {
      if (armed === '*') { armed = ''; matches().forEach(function (m) { hl.remove('match:' + m.id); }); } else { armed = '*'; render(); }
    } else if (act === 'rename' && manager()) {
      var cfg = hl.get('cfg', {}) || {};
      cfg.title = String(titleDraft !== null ? titleDraft : (cfg.title || '')).trim().slice(0, 60);
      titleDraft = null;
      hl.set('cfg', cfg);
    }
  });
  hl.ready().then(function (c) { me = c.me; render(); hl.onChange(render); });
})();
</script>
`;

const EXPENSE_SPLIT = `
<div class="app" id="root" aria-live="polite"><p class="muted">…</p></div>
<style>
.amt{font-variant-numeric:tabular-nums;font-weight:600;white-space:nowrap}
.pos{color:var(--ok)}.neg{color:var(--danger)}
.who{display:flex;flex-wrap:wrap;gap:8px}
.who label{display:inline-flex;align-items:center;gap:6px;border:1px solid var(--border);border-radius:999px;padding:6px 12px;min-height:40px;cursor:pointer}
</style>
<script>
(function () {
  var es = (navigator.language || '').slice(0, 2) === 'es';
  var T = es ? {
    kind: 'Gastos', title: 'Gastos compartidos', add: 'Añadir gasto', expenses: 'Gastos', balances: 'Saldos', people: 'Personas', settings: 'Ajustes',
    desc: 'Concepto', amount: 'Importe', payer: 'Pagó', among: 'Se reparte entre', date: 'Fecha', save: 'Guardar', cancel: 'Cancelar',
    del: 'Borrar', confirm: 'Confirmar borrado', search: 'Buscar gasto', page: 'Página', person: 'Nombre', addPerson: 'Añadir persona',
    noPeople: 'Primero añade a las personas que comparten gastos.', noExp: 'Todavía no hay gastos.', noFound: 'Ningún gasto con esa búsqueda.',
    kTotal: 'Total gastado', kCount: 'Gastos', kPeople: 'Personas', paid: 'Pagó', share: 'Le toca', balance: 'Saldo',
    settle: 'Para quedar en paz', pays: 'paga a', even: 'Todo el mundo está en paz.',
    note: 'Esta app solo lleva la cuenta. Los pagos se hacen en Ledger Chat, fuera de la app.',
    errDesc: 'Escribe un concepto.', errAmount: 'El importe debe ser un número mayor que 0.', errPayer: 'Elige quién pagó.',
    errAmong: 'Marca al menos una persona.', errName: 'Escribe un nombre que no esté ya en la lista.', inUse: 'Tiene gastos: no se puede quitar.',
    remove: 'Quitar', currency: 'Moneda (símbolo)', name: 'Nombre', onlyOrg: 'Solo quien añadió la app o un admin cambia los ajustes.', all: 'Todos'
  } : {
    kind: 'Expenses', title: 'Shared expenses', add: 'Add expense', expenses: 'Expenses', balances: 'Balances', people: 'People', settings: 'Settings',
    desc: 'What for', amount: 'Amount', payer: 'Paid by', among: 'Split between', date: 'Date', save: 'Save', cancel: 'Cancel',
    del: 'Delete', confirm: 'Confirm delete', search: 'Search expenses', page: 'Page', person: 'Name', addPerson: 'Add person',
    noPeople: 'First add the people who share expenses.', noExp: 'No expenses yet.', noFound: 'No expense matches that search.',
    kTotal: 'Total spent', kCount: 'Expenses', kPeople: 'People', paid: 'Paid', share: 'Share', balance: 'Balance',
    settle: 'To settle up', pays: 'pays', even: 'Everyone is settled up.',
    note: 'This app only keeps the accounts. Payments happen in Ledger Chat, outside the app.',
    errDesc: 'Write what it was for.', errAmount: 'The amount must be a number above 0.', errPayer: 'Choose who paid.',
    errAmong: 'Tick at least one person.', errName: 'Write a name that is not already on the list.', inUse: 'Has expenses: cannot be removed.',
    remove: 'Remove', currency: 'Currency (symbol)', name: 'Name', onlyOrg: 'Only whoever added the app or an admin changes settings.', all: 'Everyone'
  };
  var ICON = '<svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" aria-hidden="true"><rect x="4" y="3" width="16" height="18" rx="2"/><path d="M8 8h8M8 12h8M8 16h5"/></svg>';
  var PER = 20;
  var root = document.getElementById('root');
  var me = null, tab = 'expenses', q = '', err = '', armed = '', page = 0, newName = '', draft = null, curDraft = null, titleDraft = null;
  var esc = hl.esc;

  function manager() { return !!me && (me.isCreator || me.isAdmin); }
  function today() { return new Date().toISOString().slice(0, 10); }
  function day(d) { return hl.formatDate(String(d).length === 10 ? d + 'T12:00:00' : d, false); }
  function cfg() { return hl.get('cfg', {}) || {}; }
  function cur() { return cfg().currency || '€'; }
  function money(c) {
    var v = (c / 100).toLocaleString(es ? 'es-ES' : 'en-GB', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
    return v + ' ' + esc(cur());
  }
  function people() {
    return hl.list('person:').map(function (e) { return { id: e.key.slice(7), name: String((e.value || {}).name || '') }; })
      .filter(function (p) { return p.name; }).sort(function (a, b) { return a.name.toLowerCase() < b.name.toLowerCase() ? -1 : 1; });
  }
  function expenses() {
    return hl.list('exp:').map(function (e) {
      var v = e.value || {};
      return { id: e.key.slice(4), desc: String(v.desc || ''), cents: Math.round(+v.cents || 0), payer: v.payer, among: Array.isArray(v.among) ? v.among : [], date: v.date || e.at, by: e.by };
    }).filter(function (x) { return x.cents > 0 && x.payer && x.among.length; })
      .sort(function (a, b) { return a.date < b.date ? 1 : a.date > b.date ? -1 : (a.id < b.id ? 1 : -1); });
  }
  function nameOf(list, id) { for (var i = 0; i < list.length; i++) if (list[i].id === id) return list[i].name; return '?'; }
  function ledger(ps, xs) {
    var b = {};
    ps.forEach(function (p) { b[p.id] = { paid: 0, share: 0 }; });
    xs.forEach(function (x) {
      var who = x.among.filter(function (id) { return b[id]; });
      if (!b[x.payer] || !who.length) return;
      b[x.payer].paid += x.cents;
      var each = Math.floor(x.cents / who.length), rest = x.cents - each * who.length;
      who.forEach(function (id, i) { b[id].share += each + (i < rest ? 1 : 0); });
    });
    return b;
  }
  function settlements(ps, b) {
    var cred = [], debt = [];
    ps.forEach(function (p) { var n = b[p.id].paid - b[p.id].share; if (n > 0) cred.push({ id: p.id, n: n }); else if (n < 0) debt.push({ id: p.id, n: -n }); });
    cred.sort(function (x, y) { return y.n - x.n; }); debt.sort(function (x, y) { return y.n - x.n; });
    var out = [], i = 0, j = 0;
    while (i < debt.length && j < cred.length) {
      var m = Math.min(debt[i].n, cred[j].n);
      if (m > 0) out.push({ from: debt[i].id, to: cred[j].id, c: m });
      debt[i].n -= m; cred[j].n -= m;
      if (!debt[i].n) i++;
      if (!cred[j].n) j++;
    }
    return out;
  }
  function empty(t) { return '<div class="empty">' + ICON + '<p>' + t + '</p></div>'; }
  function tabs() {
    var list = [['expenses', T.expenses], ['balances', T.balances], ['people', T.people]];
    if (manager()) list.push(['settings', T.settings]);
    return '<div class="tabs" role="tablist">' + list.map(function (t) {
      return '<button class="tab" role="tab" data-act="tab" data-tab="' + t[0] + '" aria-selected="' + (tab === t[0]) + '">' + t[1] + '</button>';
    }).join('') + '</div>';
  }
  function fresh(ps) { return { desc: '', amount: '', payer: '', among: ps.map(function (p) { return p.id; }), date: today() }; }
  function viewAdd(ps) {
    if (!ps.length) return empty(T.noPeople);
    if (!draft) draft = fresh(ps);
    var h = '<div class="card stack"><h2>' + T.add + '</h2><div class="grid-2">';
    h += '<label class="field"><span class="label">' + T.desc + '</span><input data-f="desc" maxlength="80" value="' + esc(draft.desc) + '" aria-label="' + T.desc + '"></label>';
    h += '<label class="field"><span class="label">' + T.amount + ' (' + esc(cur()) + ')</span><input data-f="amount" inputmode="decimal" value="' + esc(draft.amount) + '" aria-label="' + T.amount + '"></label>';
    h += '<label class="field"><span class="label">' + T.payer + '</span><select data-f="payer" aria-label="' + T.payer + '"><option value="">-</option>' + ps.map(function (p) {
      return '<option value="' + esc(p.id) + '"' + (draft.payer === p.id ? ' selected' : '') + '>' + esc(p.name) + '</option>'; }).join('') + '</select></label>';
    h += '<label class="field"><span class="label">' + T.date + '</span><input type="date" data-f="date" value="' + esc(draft.date) + '" aria-label="' + T.date + '"></label></div>';
    h += '<div class="field"><span class="label">' + T.among + '</span><div class="who">' + ps.map(function (p) {
      return '<label><input type="checkbox" data-who="' + esc(p.id) + '"' + (draft.among.indexOf(p.id) >= 0 ? ' checked' : '') + '> ' + esc(p.name) + '</label>'; }).join('') + '</div></div>';
    if (err) h += '<p class="banner" role="alert">' + esc(err) + '</p>';
    return h + '<div class="row"><button class="accent" data-act="save">' + T.save + '</button><button class="ghost" data-act="tab" data-tab="expenses">' + T.cancel + '</button></div></div>';
  }
  function viewExpenses(ps, xs) {
    if (!ps.length) return empty(T.noPeople);
    if (!xs.length) return empty(T.noExp);
    var f = q.trim().toLowerCase();
    var shown = xs.filter(function (x) { return !f || (x.desc + ' ' + nameOf(ps, x.payer)).toLowerCase().indexOf(f) >= 0; });
    var pages = Math.max(1, Math.ceil(shown.length / PER));
    if (page >= pages) page = pages - 1;
    var h = '<div class="search-row"><input id="q" type="search" placeholder="' + T.search + '" aria-label="' + T.search + '" value="' + esc(q) + '"></div>';
    if (!shown.length) return h + '<p class="muted">' + T.noFound + '</p>';
    h += '<div class="list">' + shown.slice(page * PER, page * PER + PER).map(function (x) {
      var can = manager() || (x.by && me && x.by.id === me.id);
      var who = x.among.length === ps.length ? T.all : x.among.map(function (id) { return nameOf(ps, id); }).join(', ');
      return '<div class="row between"><div class="grow stack" style="gap:2px"><strong>' + esc(x.desc) + '</strong><span class="small muted">' + esc(nameOf(ps, x.payer)) + ' · ' + esc(day(x.date)) + ' · ' + esc(who) + '</span></div>' +
        '<span class="amt">' + money(x.cents) + '</span>' +
        (can ? '<button class="' + (armed === x.id ? 'danger' : 'ghost') + '" data-act="del" data-id="' + esc(x.id) + '">' + (armed === x.id ? T.confirm : T.del) + '</button>' : '') + '</div>';
    }).join('') + '</div>';
    if (pages > 1) {
      h += '<div class="row">';
      for (var i = 0; i < pages; i++) h += '<button class="' + (i === page ? 'primary' : 'ghost') + '" data-act="page" data-p="' + i + '" aria-label="' + T.page + ' ' + (i + 1) + '">' + (i + 1) + '</button>';
      h += '</div>';
    }
    return h;
  }
  function viewBalances(ps, xs) {
    if (!ps.length) return empty(T.noPeople);
    var b = ledger(ps, xs);
    var h = '<div class="scroll-x"><table><thead><tr><th>' + T.name + '</th><th class="num">' + T.paid + '</th><th class="num">' + T.share + '</th><th class="num">' + T.balance + '</th></tr></thead><tbody>';
    h += ps.map(function (p) {
      var n = b[p.id].paid - b[p.id].share;
      return '<tr><td>' + esc(p.name) + '</td><td class="num">' + money(b[p.id].paid) + '</td><td class="num">' + money(b[p.id].share) + '</td><td class="num amt ' + (n > 0 ? 'pos' : n < 0 ? 'neg' : '') + '">' + (n > 0 ? '+' : '') + money(n) + '</td></tr>';
    }).join('') + '</tbody></table></div>';
    var s = settlements(ps, b);
    h += '<div class="card stack"><h2>' + T.settle + '</h2>';
    h += s.length ? '<div class="list">' + s.map(function (t) {
      return '<div class="row between"><span>' + esc(nameOf(ps, t.from)) + ' ' + T.pays + ' ' + esc(nameOf(ps, t.to)) + '</span><span class="amt">' + money(t.c) + '</span></div>';
    }).join('') + '</div>' : '<p class="muted">' + T.even + '</p>';
    return h + '<p class="notice small">' + T.note + '</p></div>';
  }
  function viewPeople(ps, xs) {
    var used = {};
    xs.forEach(function (x) { used[x.payer] = 1; x.among.forEach(function (id) { used[id] = 1; }); });
    var h = '<div class="search-row"><input id="newName" maxlength="40" placeholder="' + T.person + '" aria-label="' + T.person + '" value="' + esc(newName) + '"><button class="accent" data-act="person">' + T.addPerson + '</button></div>';
    if (err) h += '<p class="banner" role="alert">' + esc(err) + '</p>';
    if (!ps.length) return h + empty(T.noPeople);
    return h + '<div class="list">' + ps.map(function (p) {
      return '<div class="row between"><span class="grow">' + esc(p.name) + '</span>' + (used[p.id] ? '<span class="small muted">' + T.inUse + '</span>' :
        '<button class="' + (armed === 'p' + p.id ? 'danger' : 'ghost') + '" data-act="unperson" data-id="' + esc(p.id) + '">' + (armed === 'p' + p.id ? T.confirm : T.remove) + '</button>') + '</div>';
    }).join('') + '</div>';
  }
  function viewSettings() {
    if (!manager()) return empty(T.onlyOrg);
    var c = cfg();
    return '<div class="card stack"><h2>' + T.settings + '</h2>' +
      '<label class="field"><span class="label">' + T.name + '</span><input id="title" maxlength="60" value="' + esc(titleDraft !== null ? titleDraft : (c.title || '')) + '" placeholder="' + T.title + '"></label>' +
      '<label class="field"><span class="label">' + T.currency + '</span><input id="currency" maxlength="4" value="' + esc(curDraft !== null ? curDraft : cur()) + '"></label>' +
      '<div class="row"><button class="primary" data-act="cfg">' + T.save + '</button></div></div>';
  }
  function save(ps) {
    var d = draft || fresh(ps);
    var cents = Math.round(parseFloat(String(d.amount).split(',').join('.')) * 100);
    var among = d.among.filter(function (id) { return ps.some(function (p) { return p.id === id; }); });
    err = '';
    if (!d.desc.trim()) err = T.errDesc;
    else if (!(cents > 0) || cents > 1000000000) err = T.errAmount;
    else if (!d.payer) err = T.errPayer;
    else if (!among.length) err = T.errAmong;
    if (err) { render(); return; }
    var date = /^[0-9]{4}-[0-9]{2}-[0-9]{2}$/.test(d.date) ? d.date : today();
    hl.set('exp:' + date.split('-').join('') + '-' + hl.uid(), { desc: d.desc.trim().slice(0, 80), cents: cents, payer: d.payer, among: among, date: date });
    draft = null; tab = 'expenses'; page = 0; q = '';
    render();
  }
  function render() {
    if (!me) return;
    var a = document.activeElement;
    var fid = a && root.contains(a) ? (a.id || a.getAttribute('data-f')) : null;
    var pos = fid ? a.selectionStart : null;
    var ps = people(), xs = expenses();
    var total = xs.reduce(function (n, x) { return n + x.cents; }, 0);
    var h = '<header class="app-header"><div><span class="label">' + T.kind + '</span><h1>' + esc(cfg().title || T.title) + '</h1></div>' +
      (tab === 'add' || !ps.length ? '' : '<button class="accent" data-act="tab" data-tab="add">' + T.add + '</button>') + '</header><main class="app-body">';
    h += '<div class="grid-auto"><div class="kpi"><span class="kpi-val">' + money(total) + '</span><span class="kpi-lbl">' + T.kTotal + '</span></div>' +
      '<div class="kpi"><span class="kpi-val">' + xs.length + '</span><span class="kpi-lbl">' + T.kCount + '</span></div>' +
      '<div class="kpi"><span class="kpi-val">' + ps.length + '</span><span class="kpi-lbl">' + T.kPeople + '</span></div></div>';
    h += tabs();
    h += tab === 'add' ? viewAdd(ps) : tab === 'balances' ? viewBalances(ps, xs) : tab === 'people' ? viewPeople(ps, xs) : tab === 'settings' ? viewSettings() : viewExpenses(ps, xs);
    root.innerHTML = h + '</main>';
    if (fid) {
      var el = document.getElementById(fid) || root.querySelector('[data-f="' + fid + '"]');
      if (el) { el.focus(); try { if (pos !== null && pos !== undefined) el.setSelectionRange(pos, pos); } catch (x) {} }
    }
  }
  function addPerson() {
    var n = newName.split(' ').filter(Boolean).join(' ').slice(0, 40);
    var exists = people().some(function (p) { return p.name.toLowerCase() === n.toLowerCase(); });
    if (!n || exists) { err = T.errName; render(); return; }
    err = ''; newName = '';
    hl.set('person:' + hl.uid(), { name: n });
  }
  root.addEventListener('input', function (e) {
    var t = e.target, f = t.getAttribute('data-f');
    if (f) { if (!draft) draft = fresh(people()); draft[f] = t.value; }
    if (t.id === 'q') { q = t.value; page = 0; render(); }
    if (t.id === 'newName') newName = t.value;
    if (t.id === 'title') titleDraft = t.value;
    if (t.id === 'currency') curDraft = t.value;
  });
  root.addEventListener('change', function (e) {
    var t = e.target, id = t.getAttribute('data-who'), f = t.getAttribute('data-f');
    if (!id && !f) return;
    if (!draft) draft = fresh(people());
    if (f) draft[f] = t.value;
    if (id) {
      var i = draft.among.indexOf(id);
      if (t.checked && i < 0) draft.among.push(id);
      if (!t.checked && i >= 0) draft.among.splice(i, 1);
    }
  });
  root.addEventListener('keydown', function (e) {
    if (e.key !== 'Enter') return;
    if (e.target.id === 'newName') addPerson();
    else if (e.target.getAttribute('data-f') && e.target.tagName === 'INPUT') save(people());
  });
  root.addEventListener('click', function (e) {
    var b = e.target.closest('button');
    if (!b) return;
    var act = b.getAttribute('data-act'), id = b.getAttribute('data-id');
    if (act === 'tab') { tab = b.getAttribute('data-tab'); err = ''; q = ''; page = 0; armed = ''; render(); }
    else if (act === 'save') save(people());
    else if (act === 'page') { page = +b.getAttribute('data-p') || 0; render(); }
    else if (act === 'person') addPerson();
    else if (act === 'del') { if (armed === id) { armed = ''; hl.remove('exp:' + id); } else { armed = id; render(); } }
    else if (act === 'unperson') { if (armed === 'p' + id) { armed = ''; hl.remove('person:' + id); } else { armed = 'p' + id; render(); } }
    else if (act === 'cfg' && manager()) {
      var c = cfg();
      if (titleDraft !== null) c.title = titleDraft.trim().slice(0, 60);
      if (curDraft !== null) c.currency = curDraft.trim().slice(0, 4) || '€';
      titleDraft = null; curDraft = null;
      hl.set('cfg', c);
    }
  });
  hl.ready().then(function (c) { me = c.me; render(); hl.onChange(render); });
})();
</script>
`;

const IDEA_BOARD = `
<div class="app" id="root" aria-live="polite"><p class="muted">…</p></div>
<style>
.vote{min-width:64px;display:inline-flex;flex-direction:column;align-items:center;gap:0;padding:6px 10px;border-radius:var(--radius)}
.vote b{font-size:17px;font-variant-numeric:tabular-nums}
.vote[aria-pressed="true"]{background:var(--ink);border-color:var(--ink);color:#fff}
.idea{display:flex;gap:12px;align-items:flex-start}
.idea p{white-space:pre-wrap;word-break:break-word}
</style>
<script>
(function () {
  var es = (navigator.language || '').slice(0, 2) === 'es';
  var T = es ? {
    kind: 'Ideas', title: 'Tablón de ideas', add: 'Proponer idea', top: 'Más votadas', newest: 'Recientes', all: 'Todas',
    open: 'Abierta', planned: 'Planificada', shipped: 'Hecha', status: 'Estado', ideaTitle: 'Idea', body: 'Detalles (opcional)',
    save: 'Publicar idea', cancel: 'Cancelar', search: 'Buscar ideas', vote: 'Votar', unvote: 'Quitar voto', votes: 'votos',
    del: 'Borrar', confirm: 'Confirmar borrado', none: 'Todavía no hay ideas. Propón la primera.', noFound: 'Ninguna idea con esa búsqueda.',
    kIdeas: 'Ideas', kVotes: 'Votos', kShipped: 'Hechas', page: 'Página', errTitle: 'Escribe la idea en al menos 4 caracteres.',
    by: 'de', mark: 'Marcar como'
  } : {
    kind: 'Ideas', title: 'Idea board', add: 'Suggest an idea', top: 'Top', newest: 'Newest', all: 'All',
    open: 'Open', planned: 'Planned', shipped: 'Shipped', status: 'Status', ideaTitle: 'Idea', body: 'Details (optional)',
    save: 'Post idea', cancel: 'Cancel', search: 'Search ideas', vote: 'Vote', unvote: 'Remove vote', votes: 'votes',
    del: 'Delete', confirm: 'Confirm delete', none: 'No ideas yet. Suggest the first one.', noFound: 'No idea matches that search.',
    kIdeas: 'Ideas', kVotes: 'Votes', kShipped: 'Shipped', page: 'Page', errTitle: 'Write the idea in at least 4 characters.',
    by: 'by', mark: 'Mark as'
  };
  var STATUS = ['open', 'planned', 'shipped'];
  var BADGE = { open: 'badge', planned: 'badge badge-accent', shipped: 'badge badge-ok' };
  var ICON = '<svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" aria-hidden="true"><path d="M9 18h6M10 21h4M12 3a6 6 0 0 0-4 10.5c.7.7 1 1.5 1 2.5h6c0-1 .3-1.8 1-2.5A6 6 0 0 0 12 3z"/></svg>';
  var PER = 20;
  var root = document.getElementById('root');
  var me = null, sort = 'top', filter = 'all', q = '', err = '', armed = '', page = 0, adding = false, form = { t: '', b: '' };
  var esc = hl.esc;

  function manager() { return !!me && (me.isCreator || me.isAdmin); }
  function ideas() {
    return hl.list('idea:').map(function (e) {
      var v = e.value || {}, id = e.key.slice(5);
      var voters = hl.everyone('vote:' + id).filter(function (r) { return r.value; });
      return { id: id, t: String(v.t || ''), b: String(v.b || ''), s: STATUS.indexOf(v.s) >= 0 ? v.s : 'open', at: v.at || e.at, by: v.author || e.by, votes: voters.length, mine: !!hl.mine('vote:' + id, null) };
    }).filter(function (i) { return i.t; });
  }
  function empty(t) { return '<div class="empty">' + ICON + '<p>' + t + '</p></div>'; }
  function viewAdd() {
    var h = '<div class="card stack"><h2>' + T.add + '</h2>';
    h += '<label class="field"><span class="label">' + T.ideaTitle + '</span><input data-f="t" maxlength="120" value="' + esc(form.t) + '" aria-label="' + T.ideaTitle + '"></label>';
    h += '<label class="field"><span class="label">' + T.body + '</span><textarea data-f="b" maxlength="1500" aria-label="' + T.body + '">' + esc(form.b) + '</textarea></label>';
    if (err) h += '<p class="banner" role="alert">' + esc(err) + '</p>';
    return h + '<div class="row"><button class="accent" data-act="save">' + T.save + '</button><button class="ghost" data-act="cancel">' + T.cancel + '</button></div></div>';
  }
  function card(i) {
    var can = manager() || (i.by && me && i.by.id === me.id);
    var h = '<div class="card idea"><button class="vote" data-act="vote" data-id="' + esc(i.id) + '" aria-pressed="' + i.mine + '" aria-label="' + (i.mine ? T.unvote : T.vote) + '"><b>' + i.votes + '</b><span class="small">' + T.votes + '</span></button>';
    h += '<div class="grow stack"><div class="row between"><strong>' + esc(i.t) + '</strong><span class="' + BADGE[i.s] + '">' + T[i.s] + '</span></div>';
    if (i.b) h += '<p class="muted">' + esc(i.b) + '</p>';
    h += '<span class="small faint">' + (i.by ? T.by + ' ' + esc(i.by.label) + ' · ' : '') + esc(hl.formatDate(i.at, false)) + '</span>';
    if (manager() || can) {
      h += '<div class="row">';
      if (manager()) h += STATUS.filter(function (s) { return s !== i.s; }).map(function (s) {
        return '<button class="ghost small" data-act="status" data-id="' + esc(i.id) + '" data-s="' + s + '">' + T.mark + ' ' + T[s].toLowerCase() + '</button>'; }).join('');
      if (can) h += '<button class="' + (armed === i.id ? 'danger' : 'ghost') + ' small" data-act="del" data-id="' + esc(i.id) + '">' + (armed === i.id ? T.confirm : T.del) + '</button>';
      h += '</div>';
    }
    return h + '</div></div>';
  }
  function render() {
    if (!me) return;
    var a = document.activeElement;
    var fid = a && root.contains(a) ? (a.id || a.getAttribute('data-f')) : null;
    var pos = fid ? a.selectionStart : null;
    var list = ideas();
    var cfg = hl.get('cfg', {}) || {};
    var votes = list.reduce(function (n, i) { return n + i.votes; }, 0);
    var h = '<header class="app-header"><div><span class="label">' + T.kind + '</span><h1>' + esc(cfg.title || T.title) + '</h1></div>' +
      (adding ? '' : '<button class="accent" data-act="add">' + T.add + '</button>') + '</header><main class="app-body">';
    h += '<div class="grid-auto"><div class="kpi"><span class="kpi-val">' + list.length + '</span><span class="kpi-lbl">' + T.kIdeas + '</span></div>' +
      '<div class="kpi"><span class="kpi-val">' + votes + '</span><span class="kpi-lbl">' + T.kVotes + '</span></div>' +
      '<div class="kpi"><span class="kpi-val">' + list.filter(function (i) { return i.s === 'shipped'; }).length + '</span><span class="kpi-lbl">' + T.kShipped + '</span></div></div>';
    if (adding) h += viewAdd();
    h += '<div class="tabs" role="tablist">' + [['top', T.top], ['newest', T.newest]].map(function (t) {
      return '<button class="tab" role="tab" data-act="sort" data-v="' + t[0] + '" aria-selected="' + (sort === t[0]) + '">' + t[1] + '</button>'; }).join('') + '</div>';
    h += '<div class="search-row"><input id="q" type="search" placeholder="' + T.search + '" aria-label="' + T.search + '" value="' + esc(q) + '">' +
      '<select id="filter" aria-label="' + T.status + '">' + ['all'].concat(STATUS).map(function (s) {
        return '<option value="' + s + '"' + (filter === s ? ' selected' : '') + '>' + T[s] + '</option>'; }).join('') + '</select></div>';
    var f = q.trim().toLowerCase();
    var shown = list.filter(function (i) { return (filter === 'all' || i.s === filter) && (!f || (i.t + ' ' + i.b).toLowerCase().indexOf(f) >= 0); })
      .sort(function (x, y) { return sort === 'top' ? (y.votes - x.votes || (x.at < y.at ? 1 : -1)) : (x.at < y.at ? 1 : -1); });
    var pages = Math.max(1, Math.ceil(shown.length / PER));
    if (page >= pages) page = pages - 1;
    if (!list.length) h += empty(T.none);
    else if (!shown.length) h += '<p class="muted">' + T.noFound + '</p>';
    else h += '<div class="stack">' + shown.slice(page * PER, page * PER + PER).map(card).join('') + '</div>';
    if (pages > 1) {
      h += '<div class="row">';
      for (var p = 0; p < pages; p++) h += '<button class="' + (p === page ? 'primary' : 'ghost') + '" data-act="page" data-p="' + p + '" aria-label="' + T.page + ' ' + (p + 1) + '">' + (p + 1) + '</button>';
      h += '</div>';
    }
    root.innerHTML = h + '</main>';
    if (fid) {
      var el = document.getElementById(fid) || root.querySelector('[data-f="' + fid + '"]');
      if (el) { el.focus(); try { if (pos !== null && pos !== undefined) el.setSelectionRange(pos, pos); } catch (x) {} }
    }
  }
  function save() {
    var t = form.t.trim().slice(0, 120), b = form.b.trim().slice(0, 1500);
    if (t.length < 4) { err = T.errTitle; render(); return; }
    var id = hl.uid();
    hl.set('idea:' + id, { t: t, b: b, s: 'open', at: new Date().toISOString(), author: { id: me.id, label: me.label } });
    hl.setMine('vote:' + id, 1);
    form = { t: '', b: '' }; err = ''; adding = false; sort = 'newest';
    render();
  }
  root.addEventListener('input', function (e) {
    var t = e.target, f = t.getAttribute('data-f');
    if (f) form[f] = t.value;
    if (t.id === 'q') { q = t.value; page = 0; render(); }
  });
  root.addEventListener('change', function (e) { if (e.target.id === 'filter') { filter = e.target.value; page = 0; render(); } });
  root.addEventListener('keydown', function (e) { if (e.key === 'Enter' && e.target.getAttribute('data-f') === 't') save(); });
  root.addEventListener('click', function (e) {
    var b = e.target.closest('button');
    if (!b) return;
    var act = b.getAttribute('data-act'), id = b.getAttribute('data-id');
    if (act === 'add') { adding = true; err = ''; render(); }
    else if (act === 'cancel') { adding = false; err = ''; render(); }
    else if (act === 'save') save();
    else if (act === 'sort') { sort = b.getAttribute('data-v'); page = 0; render(); }
    else if (act === 'page') { page = +b.getAttribute('data-p') || 0; render(); }
    else if (act === 'vote') hl.setMine('vote:' + id, hl.mine('vote:' + id, null) ? null : 1);
    else if (act === 'status' && manager()) hl.patch('idea:' + id, function (v) { if (!v) return v; v.s = b.getAttribute('data-s'); return v; });
    else if (act === 'del') { if (armed === id) { armed = ''; hl.remove('idea:' + id); } else { armed = id; render(); } }
  });
  hl.ready().then(function (c) { me = c.me; render(); hl.onChange(render); });
})();
</script>
`;

export const APP_TEMPLATES: AppTemplate[] = [
  {
    id: 'poll',
    title: { es: 'Encuesta', en: 'Poll' },
    summary: { es: 'Una pregunta, varias opciones y el recuento en directo.', en: 'One question, a few options and a live count.' },
    html: POLL,
  },
  {
    id: 'signup',
    title: { es: 'Inscripción', en: 'Sign-up' },
    summary: { es: 'Huecos con plazas limitadas y lista de espera por orden de llegada.', en: 'Slots with limited places and a first-come waiting list.' },
    html: SIGNUP,
  },
  {
    id: 'list',
    title: { es: 'Lista compartida', en: 'Shared list' },
    summary: { es: 'Tareas o compras que cualquiera añade y marca como hechas.', en: 'Tasks or shopping anyone can add and tick off.' },
    html: LIST,
  },
  {
    id: 'when',
    title: { es: '¿Cuándo quedamos?', en: 'When can we meet?' },
    summary: { es: 'Fechas y franjas propuestas; cada uno marca cuándo puede.', en: 'Proposed dates and times; everyone marks when they can.' },
    html: WHEN,
  },
  {
    id: 'padel-league',
    title: { es: 'Liga de pádel', en: 'Padel league' },
    summary: { es: 'Partidos, resultados y clasificación automática (PJ, PG, PP, diferencia, puntos).', en: 'Matches, scores and automatic standings (played, won, lost, difference, points).' },
    html: PADEL_LEAGUE,
  },
  {
    id: 'expense-split',
    title: { es: 'Reparto de gastos', en: 'Expense split' },
    summary: { es: 'Quién pagó qué, saldos y quién debe a quién con el mínimo de pagos.', en: 'Who paid what, balances, and who owes whom in the fewest payments.' },
    html: EXPENSE_SPLIT,
  },
  {
    id: 'idea-board',
    title: { es: 'Tablón de ideas', en: 'Idea board' },
    summary: { es: 'Propuestas de la comunidad con votos, búsqueda y estado (abierta, planificada, hecha).', en: 'Community proposals with votes, search and status (open, planned, shipped).' },
    html: IDEA_BOARD,
  },
];

export function findTemplate(id: string): AppTemplate | undefined {
  return APP_TEMPLATES.find(t => t.id === id);
}
