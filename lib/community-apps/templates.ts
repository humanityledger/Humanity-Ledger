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
 * Rule for editing: no backticks and no "${" inside the HTML strings below,
 * because they live inside TypeScript template literals.
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
];

export function findTemplate(id: string): AppTemplate | undefined {
  return APP_TEMPLATES.find(t => t.id === id);
}
