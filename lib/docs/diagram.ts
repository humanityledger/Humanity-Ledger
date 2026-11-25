/**
 * lib/docs/diagram.ts — diagrams for the documentation, written in Mermaid syntax and drawn on
 * the server as SVG in the house style (components/docs/v2/Diagram.tsx). No Mermaid runtime, no
 * client JavaScript: the page ships the drawing, and the source stays readable and copyable, so
 * anyone can paste it into another Mermaid tool.
 *
 * Supported subset:
 *   flowchart LR | TB (also `graph`)
 *     nodes   A[Title<br/>subtitle]  A(round)  A([stadium])  A[(database)]  A((circle))
 *             A{{hexagon}}  A{decision}  A[[subroutine]]   tone: A[..]:::accent | ok | danger | muted | dashed | dark
 *     edges   A --> B   A --- B   A -.-> B   A ==> B   A <--> B   A -->|label| B   A -- label --> B   A -. label .-> B
 *             chains: A --> B --> C
 *     groups  subgraph id [Title] ... end
 *     tones   class A,B accent
 *   sequenceDiagram
 *     participant A as Title<br/>subtitle   actor B as You    autonumber
 *     A->>B: text   A-->>B: text   A->B: text   A-->B: text   A-xB: text   A-)B: text
 *     Note over A,B: text   Note left of A: text   Note right of A: text
 *     alt | opt | loop | par | critical | break | rect  label ... else label ... end
 * Anything else is ignored, so unsupported Mermaid lines do not break the page.
 */

export type Tone = 'default' | 'accent' | 'ok' | 'danger' | 'muted' | 'dashed' | 'dark';
export type Shape = 'rect' | 'round' | 'stadium' | 'db' | 'circle' | 'hex' | 'diamond' | 'sub';

export interface FlowNode { id: string; title: string[]; sub: string[]; shape: Shape; tone: Tone; group?: number }
export interface FlowEdge { from: string; to: string; label: string[]; dashed: boolean; thick: boolean; arrowEnd: boolean; arrowStart: boolean }
export interface FlowGroup { id: string; title: string; parent?: number }
export interface FlowAst { type: 'flow'; dir: 'LR' | 'TB'; nodes: FlowNode[]; edges: FlowEdge[]; groups: FlowGroup[] }

export interface SeqActor { id: string; title: string[]; sub: string[]; person: boolean }
export type SeqItem =
  | { k: 'msg'; from: string; to: string; text: string[]; dashed: boolean; head: 'arrow' | 'open' | 'cross' | 'async' }
  | { k: 'note'; over: string[]; side: 'over' | 'left' | 'right'; text: string[] }
  | { k: 'open'; kind: string; label: string }
  | { k: 'else'; label: string }
  | { k: 'close' };
export interface SeqAst { type: 'seq'; actors: SeqActor[]; items: SeqItem[]; autonumber: boolean }

export type DiagramAst = FlowAst | SeqAst;

// ── Text ─────────────────────────────────────────────────────────────────────

const NARROW = new Set("ilI.,:;'|!()[]{} jtfr/`");
const WIDE = new Set('mwMW@%');

/** Approximate width of `text` in Inter at `size` px (good to a few percent for this layout). */
export function textWidth(text: string, size: number, bold = false): number {
  let w = 0;
  for (const ch of text) {
    if (NARROW.has(ch)) w += 0.3;
    else if (WIDE.has(ch)) w += 0.86;
    else if (ch >= 'A' && ch <= 'Z') w += 0.66;
    else if (ch >= '0' && ch <= '9') w += 0.58;
    else if (/[\u2E80-\u9FFF\uAC00-\uD7AF\uF900-\uFAFF\uFF00-\uFFEF\u3000-\u303F]/.test(ch)) w += 1.0;
    else if (ch >= '\u0410' && ch <= '\u042F') w += 0.7;
    else if (ch >= '\u0430' && ch <= '\u044F') w += 0.56;
    else w += 0.53;
  }
  return w * size * (bold ? 1.05 : 1);
}

/** Wraps a line to `max` px. */
export function wrap(text: string, max: number, size: number, bold = false): string[] {
  // Chinese has no spaces: a run longer than the line is broken between characters.
  const words = text.split(/\s+/).filter(Boolean).flatMap((w) => {
    if (textWidth(w, size, bold) <= max || !/[\u2E80-\u9FFF\uFF00-\uFFEF]/.test(w)) return [w];
    const parts: string[] = [];
    let cur = '';
    for (const ch of w) {
      if (cur && textWidth(cur + ch, size, bold) > max) { parts.push(cur); cur = ch; } else cur += ch;
    }
    if (cur) parts.push(cur);
    return parts;
  });
  const out: string[] = [];
  let line = '';
  for (const w of words) {
    const next = line ? `${line} ${w}` : w;
    if (line && textWidth(next, size, bold) > max) {
      out.push(line);
      line = w;
    } else line = next;
  }
  if (line) out.push(line);
  return out.length ? out : [''];
}

function clean(label: string): string {
  let t = label.trim();
  if ((t.startsWith('"') && t.endsWith('"')) || (t.startsWith("'") && t.endsWith("'"))) t = t.slice(1, -1);
  return t.replace(/&quot;/g, '"').replace(/#quot;/g, '"').replace(/&amp;/g, '&');
}

function lines(label: string): string[] {
  return clean(label).split(/<br\s*\/?>/i).map((l) => l.trim()).filter((l, i) => l || i === 0);
}

// ── Parsing ──────────────────────────────────────────────────────────────────

const TONES = new Set<Tone>(['default', 'accent', 'ok', 'danger', 'muted', 'dashed', 'dark']);

const SHAPES: { open: string; close: string; shape: Shape }[] = [
  { open: '[(', close: ')]', shape: 'db' },
  { open: '([', close: '])', shape: 'stadium' },
  { open: '((', close: '))', shape: 'circle' },
  { open: '{{', close: '}}', shape: 'hex' },
  { open: '[[', close: ']]', shape: 'sub' },
  { open: '[', close: ']', shape: 'rect' },
  { open: '(', close: ')', shape: 'round' },
  { open: '{', close: '}', shape: 'diamond' },
];

const EDGE_PATTERNS: { re: RegExp; dashed: boolean; thick: boolean; labelled?: boolean }[] = [
  { re: /^(<)?--\s+(.+?)\s+--(>)?/, dashed: false, thick: false, labelled: true },
  { re: /^(<)?-\.\s+(.+?)\s+\.-(>)?/, dashed: true, thick: false, labelled: true },
  { re: /^(<)?==\s+(.+?)\s+==(>)?/, dashed: false, thick: true, labelled: true },
  { re: /^(<)?-\.+-(>)?/, dashed: true, thick: false },
  { re: /^(<)?={2,}(>)?/, dashed: false, thick: true },
  { re: /^(<)?-{2,}(>)?/, dashed: false, thick: false },
];

function parseFlow(src: string[], dir: 'LR' | 'TB'): FlowAst {
  const nodes = new Map<string, FlowNode>();
  const edges: FlowEdge[] = [];
  const groups: FlowGroup[] = [];
  const stack: number[] = [];

  const node = (id: string): FlowNode => {
    let n = nodes.get(id);
    if (!n) {
      n = { id, title: [id], sub: [], shape: 'rect', tone: 'default' };
      nodes.set(id, n);
    }
    if (stack.length && n.group === undefined) n.group = stack[stack.length - 1];
    return n;
  };

  const readNode = (s: string, p: number): { id: string; end: number } | null => {
    const m = /^[A-Za-z_]\w*(?:-\w+)*/.exec(s.slice(p));
    if (!m) return null;
    const id = m[0];
    let q = p + id.length;
    const n = node(id);
    for (const sh of SHAPES) {
      if (s.startsWith(sh.open, q)) {
        const close = s.indexOf(sh.close, q + sh.open.length);
        if (close < 0) break;
        const ls = lines(s.slice(q + sh.open.length, close));
        n.title = [ls[0]];
        n.sub = ls.slice(1);
        n.shape = sh.shape;
        q = close + sh.close.length;
        break;
      }
    }
    const t = /^:::([\w-]+)/.exec(s.slice(q));
    if (t) {
      if (TONES.has(t[1] as Tone)) n.tone = t[1] as Tone;
      q += t[0].length;
    }
    return { id, end: q };
  };

  for (const raw of src) {
    const line = raw.trim();
    if (!line || line.startsWith('%%') || /^(classDef|style|linkStyle|click|direction)\b/.test(line)) continue;
    const sg = /^subgraph\s+(?:([\w-]+)\s*\[(.+)\]|(.+))$/.exec(line);
    if (sg) {
      const title = clean(sg[2] ?? sg[3] ?? '');
      groups.push({ id: sg[1] ?? `g${groups.length}`, title, parent: stack.length ? stack[stack.length - 1] : undefined });
      stack.push(groups.length - 1);
      continue;
    }
    if (line === 'end') {
      stack.pop();
      continue;
    }
    const cl = /^class\s+([\w,\s-]+?)\s+([\w-]+)$/.exec(line);
    if (cl) {
      for (const id of cl[1].split(',').map((x) => x.trim())) if (TONES.has(cl[2] as Tone)) node(id).tone = cl[2] as Tone;
      continue;
    }
    let p = 0;
    const first = readNode(line, p);
    if (!first) continue;
    let prev = first.id;
    p = first.end;
    for (;;) {
      while (line[p] === ' ') p++;
      if (p >= line.length) break;
      let matched = false;
      for (const pat of EDGE_PATTERNS) {
        const m = pat.re.exec(line.slice(p));
        if (!m) continue;
        matched = true;
        let label = pat.labelled ? m[2] : '';
        const arrowStart = !!m[1];
        const arrowEnd = !!(pat.labelled ? m[3] : m[2]);
        p += m[0].length;
        while (line[p] === ' ') p++;
        if (line[p] === '|') {
          const close = line.indexOf('|', p + 1);
          if (close > p) {
            label = line.slice(p + 1, close);
            p = close + 1;
          }
        }
        while (line[p] === ' ') p++;
        const next = readNode(line, p);
        if (!next) return { type: 'flow', dir, nodes: [...nodes.values()], edges, groups };
        edges.push({ from: prev, to: next.id, label: label ? lines(label) : [], dashed: pat.dashed, thick: pat.thick, arrowEnd, arrowStart });
        prev = next.id;
        p = next.end;
        break;
      }
      if (!matched) break;
    }
  }
  return { type: 'flow', dir, nodes: [...nodes.values()], edges, groups };
}

function parseSeq(src: string[]): SeqAst {
  const actors = new Map<string, SeqActor>();
  const items: SeqItem[] = [];
  let autonumber = false;
  const actor = (id: string): SeqActor => {
    let a = actors.get(id);
    if (!a) {
      a = { id, title: [id], sub: [], person: false };
      actors.set(id, a);
    }
    return a;
  };
  for (const raw of src) {
    const line = raw.trim();
    if (!line || line.startsWith('%%')) continue;
    if (line === 'autonumber') { autonumber = true; continue; }
    const pa = /^(participant|actor)\s+([\w-]+)(?:\s+as\s+(.+))?$/.exec(line);
    if (pa) {
      const a = actor(pa[2]);
      const ls = lines(pa[3] ?? pa[2]);
      a.title = [ls[0]];
      a.sub = ls.slice(1);
      a.person = pa[1] === 'actor';
      continue;
    }
    const note = /^note\s+(over|left of|right of)\s+([\w-]+(?:\s*,\s*[\w-]+)?)\s*:\s*(.+)$/i.exec(line);
    if (note) {
      const over = note[2].split(',').map((x) => x.trim());
      over.forEach(actor);
      items.push({ k: 'note', over, side: note[1].toLowerCase().startsWith('left') ? 'left' : note[1].toLowerCase().startsWith('right') ? 'right' : 'over', text: lines(note[3]) });
      continue;
    }
    const open = /^(alt|opt|loop|par|critical|break|rect)\b\s*(.*)$/.exec(line);
    if (open) { items.push({ k: 'open', kind: open[1], label: clean(open[2] || '') }); continue; }
    const el = /^(else|and)\b\s*(.*)$/.exec(line);
    if (el) { items.push({ k: 'else', label: clean(el[2] || '') }); continue; }
    if (line === 'end') { items.push({ k: 'close' }); continue; }
    const msg = /^(\w+(?:-\w+)*)\s*(-->>|->>|-->|->|--x|-x|--\)|-\))\s*[+-]?(\w+(?:-\w+)*)\s*:\s*(.*)$/.exec(line);
    if (msg) {
      actor(msg[1]);
      actor(msg[3]);
      const op = msg[2];
      items.push({
        k: 'msg',
        from: msg[1],
        to: msg[3],
        text: lines(msg[4]),
        dashed: op.startsWith('--'),
        head: op.endsWith('>>') ? 'arrow' : op.endsWith('x') ? 'cross' : op.endsWith(')') ? 'async' : 'open',
      });
    }
  }
  return { type: 'seq', actors: [...actors.values()], items, autonumber };
}

export function parseDiagram(code: string): DiagramAst {
  const src = code.replace(/\r/g, '').split('\n');
  const i = src.findIndex((l) => l.trim() && !l.trim().startsWith('%%'));
  const head = (src[i] || '').trim();
  const rest = src.slice(i + 1);
  if (/^sequenceDiagram\b/.test(head)) return parseSeq(rest);
  const m = /^(?:flowchart|graph)\s+(LR|RL|TB|TD|BT)\b/.exec(head);
  const dir = m && (m[1] === 'LR' || m[1] === 'RL') ? 'LR' : 'TB';
  return parseFlow(rest, dir);
}

// ── Layout: flowcharts ───────────────────────────────────────────────────────

export interface Box { x: number; y: number; w: number; h: number }
export interface PlacedNode extends FlowNode { box: Box; titleLines: string[]; subLines: string[] }
export interface PlacedEdge extends FlowEdge { d: string; lx: number; ly: number; lw: number; lh: number }
export interface PlacedGroup extends FlowGroup { box: Box }
export interface FlowLayout { type: 'flow'; width: number; height: number; nodes: PlacedNode[]; edges: PlacedEdge[]; groups: PlacedGroup[] }

const T_SIZE = 13.5;
const S_SIZE = 12;
const L_SIZE = 11.5;
const PAD_X = 14;
const PAD_Y = 11;
const MAX_TEXT = 210;

function measureNode(n: FlowNode) {
  const titleLines = n.title.flatMap((t) => wrap(t, MAX_TEXT, T_SIZE, true));
  const subLines = n.sub.flatMap((t) => wrap(t, MAX_TEXT, S_SIZE));
  const tw = Math.max(...titleLines.map((t) => textWidth(t, T_SIZE, true)), ...subLines.map((t) => textWidth(t, S_SIZE)), 0);
  let w = Math.max(112, Math.ceil(tw + PAD_X * 2));
  let h = PAD_Y * 2 + titleLines.length * 17 + subLines.length * 15.5 + (subLines.length ? 2 : 0);
  if (n.shape === 'circle') { const d = Math.max(w, h) * 0.92; w = d; h = d; }
  if (n.shape === 'diamond') { w = w * 1.35; h = h * 1.5; }
  if (n.shape === 'db') h += 14;
  if (n.shape === 'hex') w += 20;
  return { w: Math.round(w), h: Math.round(h), titleLines, subLines };
}

export function layoutFlow(ast: FlowAst): FlowLayout {
  const LR = ast.dir === 'LR';
  const ids = ast.nodes.map((n) => n.id);
  const index = new Map(ids.map((id, i) => [id, i]));
  const out = new Map<string, string[]>(ids.map((id) => [id, []]));
  for (const e of ast.edges) out.get(e.from)?.push(e.to);

  // 1. Ranks. Back edges (found by depth-first search, in order of appearance) do not set ranks.
  const state = new Map<string, number>();
  const back = new Set<string>();
  const dfs = (u: string) => {
    state.set(u, 1);
    for (const v of out.get(u) || []) {
      if (state.get(v) === 1) back.add(`${u}>${v}`);
      else if (!state.get(v)) dfs(v);
    }
    state.set(u, 2);
  };
  for (const id of ids) if (!state.get(id)) dfs(id);
  const isForward = (e: FlowEdge) => !back.has(`${e.from}>${e.to}`) && e.from !== e.to;
  const forward = ast.edges.filter(isForward);
  const rank = new Map<string, number>(ids.map((id) => [id, 0]));
  for (let pass = 0; pass <= ids.length; pass++) {
    let changed = false;
    for (const e of forward) {
      const r = (rank.get(e.from) || 0) + 1;
      if (r > (rank.get(e.to) || 0)) { rank.set(e.to, r); changed = true; }
    }
    if (!changed) break;
  }
  // A source that only feeds later layers moves next to them.
  for (const id of ids) {
    if (forward.some((e) => e.to === id)) continue;
    const outs = forward.filter((e) => e.from === id);
    if (outs.length) rank.set(id, Math.max(rank.get(id) || 0, Math.min(...outs.map((e) => rank.get(e.to) || 0)) - 1));
  }

  // 2. Groups: each top-level group gets its own band across the flow, so boxes never overlap.
  const topGroup = (g: number | undefined): number => {
    if (g === undefined) return -1;
    let k = g;
    while (ast.groups[k]?.parent !== undefined) k = ast.groups[k].parent!;
    return k;
  };
  const groupOf = new Map<string, number>(ast.nodes.map((n) => [n.id, topGroup(n.group)]));

  // 3. Long edges pass through invisible points in the layers they cross.
  type Seg = { from: string; to: string };
  const segs: Seg[] = [];
  const chain = new Map<FlowEdge, string[]>();
  const sizes = new Map(ast.nodes.map((n) => [n.id, measureNode(n)]));
  const dummy = new Set<string>();
  ast.edges.forEach((e, k) => {
    const ra = rank.get(e.from)!, rb = rank.get(e.to)!;
    if (!isForward(e) || rb - ra <= 1) {
      chain.set(e, [e.from, e.to]);
      if (isForward(e)) segs.push({ from: e.from, to: e.to });
      return;
    }
    const path = [e.from];
    const g = groupOf.get(e.from) === groupOf.get(e.to) ? groupOf.get(e.from)! : -1;
    for (let r = ra + 1; r < rb; r++) {
      const id = `__d${k}_${r}`;
      dummy.add(id);
      rank.set(id, r);
      groupOf.set(id, g);
      sizes.set(id, { w: LR ? 2 : 12, h: LR ? 12 : 2, titleLines: [], subLines: [] });
      index.set(id, ids.length + k);
      path.push(id);
    }
    path.push(e.to);
    for (let i = 0; i + 1 < path.length; i++) segs.push({ from: path[i], to: path[i + 1] });
    chain.set(e, path);
  });

  const maxRank = Math.max(0, ...rank.values());
  const layers: string[][] = Array.from({ length: maxRank + 1 }, () => []);
  for (const id of [...ids, ...dummy]) layers[rank.get(id) || 0].push(id);

  // 4. Order inside each layer: group first, then the average position of neighbours.
  const pos = new Map<string, number>();
  layers.forEach((l) => l.forEach((id, i) => pos.set(id, i)));
  const preds = new Map<string, string[]>(), succs = new Map<string, string[]>();
  for (const sg of segs) {
    (preds.get(sg.to) || preds.set(sg.to, []).get(sg.to)!).push(sg.from);
    (succs.get(sg.from) || succs.set(sg.from, []).get(sg.from)!).push(sg.to);
  }
  const bary = (id: string, nb: string[] | undefined) => (nb && nb.length ? nb.reduce((t, x) => t + (pos.get(x) || 0), 0) / nb.length : pos.get(id) || 0);
  for (let sweep = 0; sweep < 10; sweep++) {
    const down = sweep % 2 === 0;
    const order = down ? layers.slice(1) : layers.slice(0, -1).reverse();
    for (const layer of order) {
      const key = new Map(layer.map((id) => [id, bary(id, down ? preds.get(id) : succs.get(id))]));
      layer.sort((x, y) => groupOf.get(x)! - groupOf.get(y)! || key.get(x)! - key.get(y)! || index.get(x)! - index.get(y)!);
      layer.forEach((id, i) => pos.set(id, i));
    }
  }

  // 5. Coordinates. Along the flow: layers and the gaps between them (room for edge labels).
  const span = (id: string) => (LR ? sizes.get(id)!.h : sizes.get(id)!.w); // across
  const depth = (id: string) => (LR ? sizes.get(id)!.w : sizes.get(id)!.h); // along
  const gaps: number[] = [];
  for (let r = 0; r < maxRank; r++) {
    let need = 0;
    for (const e of ast.edges) {
      const c = chain.get(e)!;
      if (!e.label.length || c.length < 2) continue;
      if (rank.get(c[0]) === r && rank.get(c[1]) === r + 1) {
        const lw = Math.max(...e.label.map((t) => textWidth(t, L_SIZE))) + 16;
        need = Math.max(need, LR ? lw + 22 : e.label.length * 15 + 26);
      }
    }
    gaps.push(Math.max(LR ? 60 : 46, need));
  }
  const thick = layers.map((l) => Math.max(0, ...l.map(depth)));
  const ACROSS_GAP = 20;
  const groupPad = ast.groups.length ? 30 : 0;
  const M = 8;

  // Across the flow: bands per group, each as long as its longest layer.
  const bandOrder = [...new Set([...groupOf.values()])].sort((x, y) => x - y);
  const bandLen = new Map<number, number>();
  for (const g of bandOrder) {
    let len = 0;
    for (const l of layers) {
      const members = l.filter((id) => groupOf.get(id) === g);
      const L = members.reduce((t, id, i) => t + span(id) + (i ? ACROSS_GAP : 0), 0);
      len = Math.max(len, L);
    }
    bandLen.set(g, len);
  }
  const bandStart = new Map<number, number>();
  let acc = M;
  bandOrder.forEach((g, i) => {
    if (i) acc += g === -1 || bandOrder[i - 1] === -1 ? 34 : 34 + groupPad;
    if (g !== -1) acc += groupPad;
    bandStart.set(g, acc);
    acc += bandLen.get(g)!;
  });

  const boxes = new Map<string, Box>();
  let along = M + (ast.groups.length && LR ? 14 : 0) + (ast.groups.length && !LR ? 0 : 0);
  layers.forEach((layer, r) => {
    for (const g of bandOrder) {
      const members = layer.filter((id) => groupOf.get(id) === g);
      const len = members.reduce((t, id, i) => t + span(id) + (i ? ACROSS_GAP : 0), 0);
      let across = bandStart.get(g)! + (bandLen.get(g)! - len) / 2;
      for (const id of members) {
        const sz = sizes.get(id)!;
        const a = along + (thick[r] - depth(id)) / 2;
        boxes.set(id, LR ? { x: a, y: across, w: sz.w, h: sz.h } : { x: across, y: a, w: sz.w, h: sz.h });
        across += span(id) + ACROSS_GAP;
      }
    }
    along += thick[r] + (gaps[r] ?? 0);
  });
  if (ast.groups.length && !LR) {
    // room for group titles above the first layer
    boxes.forEach((b) => { b.y += 20; });
  }

  // 6. Edges: ports spread along a side, smooth curves through the invisible points.
  const portOut = new Map<string, FlowEdge[]>();
  const portIn = new Map<string, FlowEdge[]>();
  const firstHop = (e: FlowEdge) => chain.get(e)![1];
  const lastHop = (e: FlowEdge) => { const c = chain.get(e)!; return c[c.length - 2]; };
  const centreOf = (id: string) => { const b = boxes.get(id)!; return LR ? b.y + b.h / 2 : b.x + b.w / 2; };
  for (const e of ast.edges) {
    if (!isForward(e)) continue;
    (portOut.get(e.from) || portOut.set(e.from, []).get(e.from)!).push(e);
    (portIn.get(e.to) || portIn.set(e.to, []).get(e.to)!).push(e);
  }
  portOut.forEach((l) => l.sort((x, y) => centreOf(firstHop(x)) - centreOf(firstHop(y))));
  portIn.forEach((l) => l.sort((x, y) => centreOf(lastHop(x)) - centreOf(lastHop(y))));
  const spread = (id: string, list: FlowEdge[] | undefined, e: FlowEdge) => {
    if (!list || list.length < 2) return 0;
    const b = boxes.get(id)!;
    const i = list.indexOf(e);
    const room = Math.min((LR ? b.h : b.w) - 16, (list.length - 1) * 13);
    return -room / 2 + (room * i) / (list.length - 1);
  };

  let maxX = 0, maxY = 0;
  boxes.forEach((b, id) => { if (dummy.has(id)) return; maxX = Math.max(maxX, b.x + b.w); maxY = Math.max(maxY, b.y + b.h); });
  const placedEdges: PlacedEdge[] = [];
  let loops = 0;
  for (const e of ast.edges) {
    const a = boxes.get(e.from)!, b = boxes.get(e.to)!;
    const ra = rank.get(e.from)!, rb = rank.get(e.to)!;
    let d: string, lx: number, ly: number;
    if (isForward(e) && rb > ra) {
      const c = chain.get(e)!;
      const pts: [number, number][] = [];
      if (LR) {
        pts.push([a.x + a.w, a.y + a.h / 2 + spread(e.from, portOut.get(e.from), e)]);
        for (const id of c.slice(1, -1)) { const q = boxes.get(id)!; pts.push([q.x, q.y + q.h / 2]); pts.push([q.x + q.w, q.y + q.h / 2]); }
        pts.push([b.x, b.y + b.h / 2 + spread(e.to, portIn.get(e.to), e)]);
      } else {
        pts.push([a.x + a.w / 2 + spread(e.from, portOut.get(e.from), e), a.y + a.h]);
        for (const id of c.slice(1, -1)) { const q = boxes.get(id)!; pts.push([q.x + q.w / 2, q.y]); pts.push([q.x + q.w / 2, q.y + q.h]); }
        pts.push([b.x + b.w / 2 + spread(e.to, portIn.get(e.to), e), b.y]);
      }
      d = `M${pts[0][0]} ${pts[0][1]}`;
      for (let i = 0; i + 1 < pts.length; i++) {
        const [x1, y1] = pts[i], [x2, y2] = pts[i + 1];
        if (i % 2 === 1) { d += `L${x2} ${y2}`; continue; } // across an invisible point
        if (LR) { const k = Math.max(20, (x2 - x1) / 2); d += `C${x1 + k} ${y1} ${x2 - k} ${y2} ${x2} ${y2}`; }
        else { const k = Math.max(18, (y2 - y1) / 2); d += `C${x1} ${y1 + k} ${x2} ${y2 - k} ${x2} ${y2}`; }
      }
      // The label sits in the first gap after the source.
      lx = (pts[0][0] + pts[1][0]) / 2; ly = (pts[0][1] + pts[1][1]) / 2;
    } else if (rb === ra && e.from !== e.to) {
      const first = (LR ? a.y < b.y : a.x < b.x) ? a : b;
      const second = first === a ? b : a;
      if (LR) {
        const x = (Math.max(a.x, b.x) + Math.min(a.x + a.w, b.x + b.w)) / 2;
        const y1 = first.y + first.h, y2 = second.y;
        d = first === a ? `M${x} ${y1}L${x} ${y2}` : `M${x} ${y2}L${x} ${y1}`;
        lx = x; ly = (y1 + y2) / 2;
      } else {
        const y = (Math.max(a.y, b.y) + Math.min(a.y + a.h, b.y + b.h)) / 2;
        const x1 = first.x + first.w, x2 = second.x;
        d = first === a ? `M${x1} ${y}L${x2} ${y}` : `M${x2} ${y}L${x1} ${y}`;
        lx = (x1 + x2) / 2; ly = y;
      }
    } else {
      // Back to an earlier layer: around the outside.
      loops += 1;
      if (LR) {
        const yb = maxY + 16 + loops * 14;
        const x1 = a.x + a.w / 2, y1 = a.y + a.h, x2 = b.x + b.w / 2, y2 = b.y + b.h;
        d = `M${x1} ${y1}C${x1} ${yb} ${x2} ${yb} ${x2} ${y2}`;
        lx = (x1 + x2) / 2; ly = yb - 4;
      } else {
        const xb = maxX + 16 + loops * 14;
        const x1 = a.x + a.w, y1 = a.y + a.h / 2, x2 = b.x + b.w, y2 = b.y + b.h / 2;
        d = `M${x1} ${y1}C${xb} ${y1} ${xb} ${y2} ${x2} ${y2}`;
        lx = xb - 4; ly = (y1 + y2) / 2;
      }
    }
    const lw = e.label.length ? Math.max(...e.label.map((t) => textWidth(t, L_SIZE))) + 12 : 0;
    const lh = e.label.length * 14.5 + 6;
    placedEdges.push({ ...e, d, lx, ly, lw, lh });
  }

  const placedGroups: PlacedGroup[] = ast.groups.map((g, gi) => {
    const members = ast.nodes.filter((n) => {
      let k = n.group;
      while (k !== undefined) { if (k === gi) return true; k = ast.groups[k].parent; }
      return false;
    });
    if (!members.length) return { ...g, box: { x: 0, y: 0, w: 0, h: 0 } };
    const bs = members.map((n) => boxes.get(n.id)!);
    const x0 = Math.min(...bs.map((q) => q.x)) - 16, y0 = Math.min(...bs.map((q) => q.y)) - 32;
    const x1 = Math.max(...bs.map((q) => q.x + q.w)) + 16, y1 = Math.max(...bs.map((q) => q.y + q.h)) + 16;
    return { ...g, box: { x: x0, y: y0, w: x1 - x0, h: y1 - y0 } };
  });

  // Shift everything so nothing starts above or left of the margin.
  let minX = Infinity, minY = Infinity;
  boxes.forEach((q) => { minX = Math.min(minX, q.x); minY = Math.min(minY, q.y); });
  placedGroups.forEach((g) => { if (g.box.w) { minX = Math.min(minX, g.box.x); minY = Math.min(minY, g.box.y); } });
  placedEdges.forEach((e) => { if (e.lw) { minX = Math.min(minX, e.lx - e.lw / 2); minY = Math.min(minY, e.ly - e.lh / 2); } });
  const dx = M - minX, dy = M - minY;
  const shift = (q: Box) => { q.x += dx; q.y += dy; };
  boxes.forEach(shift);
  placedGroups.forEach((g) => shift(g.box));
  for (const e of placedEdges) {
    e.d = e.d.replace(/(-?\d+(?:\.\d+)?) (-?\d+(?:\.\d+)?)/g, (_m, x, y) => `${(+x + dx).toFixed(1)} ${(+y + dy).toFixed(1)}`);
    e.lx += dx; e.ly += dy;
  }

  let W = 0, H = 0;
  boxes.forEach((q) => { W = Math.max(W, q.x + q.w); H = Math.max(H, q.y + q.h); });
  placedGroups.forEach((g) => { W = Math.max(W, g.box.x + g.box.w); H = Math.max(H, g.box.y + g.box.h); });
  if (loops) { if (LR) H += 22 + loops * 14; else W += 22 + loops * 14; }
  placedEdges.forEach((e) => { W = Math.max(W, e.lx + e.lw / 2); H = Math.max(H, e.ly + e.lh / 2); });

  return {
    type: 'flow',
    width: Math.ceil(W + M),
    height: Math.ceil(H + M),
    nodes: ast.nodes.map((n) => ({ ...n, box: boxes.get(n.id)!, titleLines: sizes.get(n.id)!.titleLines, subLines: sizes.get(n.id)!.subLines })),
    edges: placedEdges,
    groups: placedGroups.filter((g) => g.box.w > 0),
  };
}

// ── Layout: sequence diagrams ────────────────────────────────────────────────

export interface SeqLayoutActor extends SeqActor { x: number; w: number; titleLines: string[]; subLines: string[] }
export type SeqRow =
  | { k: 'msg'; x1: number; x2: number; y: number; text: string[]; dashed: boolean; head: 'arrow' | 'open' | 'cross' | 'async'; self: boolean; n?: number }
  | { k: 'note'; box: Box; text: string[] }
  | { k: 'frame'; box: Box; kind: string; label: string; splits: { y: number; label: string }[] };
export interface SeqLayout { type: 'seq'; width: number; height: number; actors: SeqLayoutActor[]; rows: SeqRow[]; top: number; bottom: number }

const M_SIZE = 12.5;
const MAX_MSG = 300;

export function layoutSeq(ast: SeqAst): SeqLayout {
  const actors = ast.actors.map((a) => {
    const titleLines = a.title.flatMap((t) => wrap(t, 170, T_SIZE, true));
    const subLines = a.sub.flatMap((t) => wrap(t, 170, S_SIZE));
    const w = Math.max(104, Math.ceil(Math.max(...titleLines.map((t) => textWidth(t, T_SIZE, true)), ...subLines.map((t) => textWidth(t, S_SIZE))) + 28));
    return { ...a, w, titleLines, subLines, x: 0 };
  });
  const at = new Map(actors.map((a, i) => [a.id, i]));
  const wrapped = ast.items.map((it) => (it.k === 'msg' || it.k === 'note' ? { ...it, text: it.text.flatMap((t) => wrap(t, it.k === 'note' ? 260 : MAX_MSG, M_SIZE)) } : it));

  // Horizontal positions: each message needs room for its label between its two lifelines.
  const gap: number[] = actors.slice(1).map((a, i) => Math.max(150, (actors[i].w + a.w) / 2 + 36));
  for (const it of wrapped) {
    if (it.k !== 'msg') continue;
    const i = at.get(it.from)!, j = at.get(it.to)!;
    const lo = Math.min(i, j), hi = Math.max(i, j);
    const need = Math.max(...it.text.map((t) => textWidth(t, M_SIZE))) + (ast.autonumber ? 56 : 34);
    if (lo === hi) { if (lo < gap.length) gap[lo] = Math.max(gap[lo], need + 50); continue; }
    let have = 0;
    for (let k = lo; k < hi; k++) have += gap[k];
    if (have < need) gap[hi - 1] += need - have;
  }
  let x = 8 + actors[0]?.w / 2 || 60;
  actors.forEach((a, i) => { if (i) x += gap[i - 1]; a.x = x; });
  const rightEdge = (actors[actors.length - 1]?.x || 0) + (actors[actors.length - 1]?.w || 0) / 2;

  const headH = Math.max(...actors.map((a) => 20 + a.titleLines.length * 17 + a.subLines.length * 15.5), 40);
  const rows: SeqRow[] = [];
  let y = headH + 26;
  let n = 0;
  const frames: { kind: string; label: string; y0: number; splits: { y: number; label: string }[] }[] = [];
  const LEFT = 8, RIGHT = Math.max(rightEdge + 8, 200);
  for (const it of wrapped) {
    if (it.k === 'msg') {
      const i = at.get(it.from)!, j = at.get(it.to)!;
      const self = i === j;
      const textH = it.text.length * 16;
      y += textH + 6;
      rows.push({ k: 'msg', x1: actors[i].x, x2: actors[j].x, y, text: it.text, dashed: it.dashed, head: it.head, self, n: ast.autonumber ? ++n : undefined });
      y += self ? 40 : 20;
    } else if (it.k === 'note') {
      const xs = it.over.map((id) => actors[at.get(id)!].x);
      const tw = Math.max(...it.text.map((t) => textWidth(t, M_SIZE))) + 24;
      let x0: number, x1: number;
      if (it.side === 'over') {
        x0 = Math.min(...xs) - (xs.length > 1 ? 36 : 0); x1 = Math.max(...xs) + (xs.length > 1 ? 36 : 0);
        if (x1 - x0 < tw) { const c = (x0 + x1) / 2; x0 = c - tw / 2; x1 = c + tw / 2; }
      } else if (it.side === 'right') { x0 = xs[0] + 12; x1 = x0 + tw; }
      else { x1 = xs[0] - 12; x0 = x1 - tw; }
      const h = it.text.length * 16 + 14;
      rows.push({ k: 'note', box: { x: x0, y: y - 2, w: x1 - x0, h }, text: it.text });
      y += h + 14;
    } else if (it.k === 'open') {
      frames.push({ kind: it.kind, label: it.label, y0: y - 4, splits: [] });
      y += 30;
    } else if (it.k === 'else') {
      const f = frames[frames.length - 1];
      if (f) { f.splits.push({ y: y, label: it.label }); y += 28; }
    } else if (it.k === 'close') {
      const f = frames.pop();
      if (f) {
        const depth = frames.length;
        rows.push({ k: 'frame', box: { x: LEFT + depth * 6, y: f.y0, w: RIGHT - LEFT - depth * 12, h: y - f.y0 + 4 }, kind: f.kind, label: f.label, splits: f.splits });
        y += 14;
      }
    }
  }
  const bottom = y + 6;
  let width = RIGHT + 8;
  rows.forEach((r) => {
    if (r.k === 'note') width = Math.max(width, r.box.x + r.box.w + 8);
    if (r.k === 'msg' && r.self) width = Math.max(width, r.x1 + 60 + Math.max(...r.text.map((t) => textWidth(t, M_SIZE))));
  });
  let minX = 0;
  rows.forEach((r) => { if (r.k === 'note') minX = Math.min(minX, r.box.x - 8); });
  if (minX < 0) {
    const dx = -minX;
    actors.forEach((a) => (a.x += dx));
    rows.forEach((r) => {
      if (r.k === 'msg') { r.x1 += dx; r.x2 += dx; } else { r.box.x += dx; }
    });
    width += dx;
  }
  return { type: 'seq', width: Math.ceil(width), height: Math.ceil(bottom + 8), actors, rows, top: headH, bottom };
}

export type DiagramLayout = FlowLayout | SeqLayout;

/**
 * Every text a reader sees in a diagram, line by line (node titles and subtitles, edge labels,
 * group titles, actors, messages, notes, block labels). The documentation's dictionaries
 * (lib/i18n/docs) translate exactly these strings.
 */
export function diagramTexts(ast: DiagramAst): string[] {
  const out: string[] = [];
  const add = (xs: string[]) => { for (const x of xs) if (x && /\p{L}/u.test(x)) out.push(x); };
  if (ast.type === 'flow') {
    for (const n of ast.nodes) add([...n.title, ...n.sub]);
    for (const e of ast.edges) add(e.label);
    for (const g of ast.groups) add([g.title]);
  } else {
    for (const a of ast.actors) add([...a.title, ...a.sub]);
    for (const it of ast.items) {
      if (it.k === 'msg' || it.k === 'note') add(it.text);
      else if (it.k === 'open' || it.k === 'else') add([it.label]);
    }
  }
  return out;
}

/** The same diagram with every visible text passed through `tr`; ids, shapes and edges unchanged. */
export function translateDiagram(ast: DiagramAst, tr: (s: string) => string): DiagramAst {
  const m = (xs: string[]) => xs.map((x) => (x ? tr(x) : x));
  if (ast.type === 'flow') {
    return {
      ...ast,
      nodes: ast.nodes.map((n) => ({ ...n, title: m(n.title), sub: m(n.sub) })),
      edges: ast.edges.map((e) => ({ ...e, label: m(e.label) })),
      groups: ast.groups.map((g) => ({ ...g, title: g.title ? tr(g.title) : g.title })),
    };
  }
  return {
    ...ast,
    actors: ast.actors.map((a) => ({ ...a, title: m(a.title), sub: m(a.sub) })),
    items: ast.items.map(
      (it): SeqItem =>
        it.k === 'msg' || it.k === 'note' ? { ...it, text: m(it.text) } : it.k === 'open' || it.k === 'else' ? { ...it, label: it.label ? tr(it.label) : it.label } : it,
    ),
  };
}

export function layoutDiagram(code: string, tr?: (s: string) => string): DiagramLayout {
  let ast = parseDiagram(code);
  if (tr) ast = translateDiagram(ast, tr);
  return ast.type === 'seq' ? layoutSeq(ast) : layoutFlow(ast);
}
