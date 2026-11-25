/**
 * A documentation diagram: Mermaid source (lib/docs/diagram.ts) drawn on the server as SVG in the
 * house style. The source sits under the drawing, ready to copy.
 */
import React from "react";
import { layoutDiagram, type FlowLayout, type PlacedNode, type SeqLayout, type Tone } from "@/lib/docs/diagram";
import { CopyButton } from "./CopyButton";
import s from "./Docs.module.css";

function hash(text: string): string {
  let h = 2166136261;
  for (let i = 0; i < text.length; i++) h = Math.imul(h ^ text.charCodeAt(i), 16777619);
  return (h >>> 0).toString(36);
}

const TONE_CLASS: Record<Tone, string> = {
  default: "",
  accent: s.dgAccent,
  ok: s.dgOk,
  danger: s.dgDanger,
  muted: s.dgMuted,
  dashed: s.dgDashed,
  dark: s.dgDark,
};

function shapePath(n: PlacedNode): React.ReactNode {
  const { x, y, w, h } = n.box;
  switch (n.shape) {
    case "round":
      return <rect x={x} y={y} width={w} height={h} rx={16} />;
    case "stadium":
      return <rect x={x} y={y} width={w} height={h} rx={h / 2} />;
    case "circle":
      return <ellipse cx={x + w / 2} cy={y + h / 2} rx={w / 2} ry={h / 2} />;
    case "db": {
      const ry = 7;
      return <path d={`M${x} ${y + ry}A${w / 2} ${ry} 0 0 1 ${x + w} ${y + ry}V${y + h - ry}A${w / 2} ${ry} 0 0 1 ${x} ${y + h - ry}Z M${x} ${y + ry}A${w / 2} ${ry} 0 0 0 ${x + w} ${y + ry}`} />;
    }
    case "hex": {
      const c = 14;
      return <path d={`M${x + c} ${y}H${x + w - c}L${x + w} ${y + h / 2}L${x + w - c} ${y + h}H${x + c}L${x} ${y + h / 2}Z`} />;
    }
    case "diamond":
      return <path d={`M${x + w / 2} ${y}L${x + w} ${y + h / 2}L${x + w / 2} ${y + h}L${x} ${y + h / 2}Z`} />;
    case "sub":
      return (
        <>
          <rect x={x} y={y} width={w} height={h} rx={8} />
          <path d={`M${x + 8} ${y}V${y + h}M${x + w - 8} ${y}V${y + h}`} fill="none" />
        </>
      );
    default:
      return <rect x={x} y={y} width={w} height={h} rx={10} />;
  }
}

function Flow({ L, id }: { L: FlowLayout; id: string }) {
  return (
    <>
      {L.groups.map((g, i) => (
        <g key={`g${i}`} className={s.dgGroup}>
          <rect x={g.box.x} y={g.box.y} width={g.box.w} height={g.box.h} rx={14} />
          <text x={g.box.x + 12} y={g.box.y + 19}>{g.title}</text>
        </g>
      ))}
      {L.edges.map((e, i) => (
        <path
          key={`e${i}`}
          d={e.d}
          className={`${s.dgEdge} ${e.dashed ? s.dgEdgeDashed : ""} ${e.thick ? s.dgEdgeThick : ""}`}
          markerEnd={e.arrowEnd ? `url(#${id}-${e.dashed ? "ad" : "a"})` : undefined}
          markerStart={e.arrowStart ? `url(#${id}-${e.dashed ? "sd" : "s"})` : undefined}
        />
      ))}
      {L.nodes.map((n) => {
        const cx = n.box.x + n.box.w / 2;
        const lines = n.titleLines.length + n.subLines.length;
        const textH = n.titleLines.length * 17 + n.subLines.length * 15.5 + (n.subLines.length ? 2 : 0);
        let y = n.box.y + (n.box.h - textH) / 2 + 13;
        return (
          <g key={n.id} className={`${s.dgNode} ${TONE_CLASS[n.tone]}`}>
            {shapePath(n)}
            {lines ? (
              <text x={cx} textAnchor="middle">
                {n.titleLines.map((t, i) => {
                  const el = <tspan key={`t${i}`} x={cx} y={y} className={s.dgTitle}>{t}</tspan>;
                  y += 17;
                  return el;
                })}
                {n.subLines.map((t, i) => {
                  if (i === 0) y += 2;
                  const el = <tspan key={`s${i}`} x={cx} y={y - 1} className={s.dgSub}>{t}</tspan>;
                  y += 15.5;
                  return el;
                })}
              </text>
            ) : null}
          </g>
        );
      })}
      {L.edges.map((e, i) =>
        e.label.length ? (
          <g key={`l${i}`} className={s.dgLabel}>
            <rect x={e.lx - e.lw / 2} y={e.ly - e.lh / 2} width={e.lw} height={e.lh} rx={6} />
            <text x={e.lx} textAnchor="middle">
              {e.label.map((t, j) => (
                <tspan key={j} x={e.lx} y={e.ly - e.lh / 2 + 15 + j * 14.5}>{t}</tspan>
              ))}
            </text>
          </g>
        ) : null,
      )}
    </>
  );
}

function Seq({ L, id }: { L: SeqLayout; id: string }) {
  return (
    <>
      {L.rows.map((r, i) =>
        r.k === "frame" ? (
          <g key={`f${i}`} className={s.dgFrame}>
            <rect x={r.box.x} y={r.box.y} width={r.box.w} height={r.box.h} rx={10} />
            <path d={`M${r.box.x} ${r.box.y + 22}H${r.box.x + Math.max(44, r.kind.length * 8 + 22)}L${r.box.x + Math.max(44, r.kind.length * 8 + 22) + 8} ${r.box.y + 14}V${r.box.y}`} className={s.dgFrameTab} />
            <text x={r.box.x + 10} y={r.box.y + 15} className={s.dgFrameKind}>{r.kind}</text>
            {r.label ? <text x={r.box.x + Math.max(44, r.kind.length * 8 + 22) + 18} y={r.box.y + 15} className={s.dgFrameLabel}>[{r.label}]</text> : null}
            {r.splits.map((sp, j) => (
              <g key={j}>
                <path d={`M${r.box.x} ${sp.y - 6}H${r.box.x + r.box.w}`} className={s.dgFrameSplit} />
                {sp.label ? <text x={r.box.x + 10} y={sp.y + 10} className={s.dgFrameLabel}>[{sp.label}]</text> : null}
              </g>
            ))}
          </g>
        ) : null,
      )}
      {L.actors.map((a) => (
        <path key={`ll${a.id}`} d={`M${a.x} ${L.top}V${L.bottom}`} className={s.dgLifeline} />
      ))}
      {L.actors.map((a) => {
        const h = L.top - 4;
        let y = (h - (a.titleLines.length * 17 + a.subLines.length * 15.5)) / 2 + 13;
        return (
          <g key={`a${a.id}`} className={`${s.dgNode} ${a.person ? s.dgAccent : ""}`}>
            <rect x={a.x - a.w / 2} y={0} width={a.w} height={h} rx={10} />
            <text x={a.x} textAnchor="middle">
              {a.titleLines.map((t, i) => {
                const el = <tspan key={`t${i}`} x={a.x} y={y} className={s.dgTitle}>{t}</tspan>;
                y += 17;
                return el;
              })}
              {a.subLines.map((t, i) => {
                const el = <tspan key={`s${i}`} x={a.x} y={y} className={s.dgSub}>{t}</tspan>;
                y += 15.5;
                return el;
              })}
            </text>
          </g>
        );
      })}
      {L.rows.map((r, i) => {
        if (r.k === "note") {
          return (
            <g key={`n${i}`} className={s.dgNote}>
              <rect x={r.box.x} y={r.box.y} width={r.box.w} height={r.box.h} rx={8} />
              <text x={r.box.x + r.box.w / 2} textAnchor="middle">
                {r.text.map((t, j) => <tspan key={j} x={r.box.x + r.box.w / 2} y={r.box.y + 19 + j * 16}>{t}</tspan>)}
              </text>
            </g>
          );
        }
        if (r.k !== "msg") return null;
        const marker = r.head === "open" ? undefined : `url(#${id}-${r.head === "cross" ? "x" : r.dashed ? "ad" : "a"})`;
        const cls = `${s.dgEdge} ${r.dashed ? s.dgEdgeDashed : ""}`;
        const textX = r.self ? r.x1 + 14 : (r.x1 + r.x2) / 2;
        const anchor = r.self ? "start" : "middle";
        return (
          <g key={`m${i}`}>
            {r.self ? (
              <path d={`M${r.x1} ${r.y}H${r.x1 + 34}V${r.y + 22}H${r.x1 + 4}`} className={cls} fill="none" markerEnd={marker} />
            ) : (
              <path d={`M${r.x1 + (r.x2 > r.x1 ? 1 : -1)} ${r.y}H${r.x2 + (r.x2 > r.x1 ? -2 : 2)}`} className={cls} markerEnd={marker} />
            )}
            {r.n !== undefined ? (
              <g className={s.dgNum}>
                <circle cx={r.x1 + (r.self ? 0 : r.x2 > r.x1 ? 13 : -13)} cy={r.y} r={8.5} />
                <text x={r.x1 + (r.self ? 0 : r.x2 > r.x1 ? 13 : -13)} y={r.y + 3.6} textAnchor="middle">{r.n}</text>
              </g>
            ) : null}
            <text x={r.self ? r.x1 + 42 : textX} textAnchor={anchor} className={s.dgMsg}>
              {r.text.map((t, j) => (
                <tspan key={j} x={r.self ? r.x1 + 42 : textX} y={r.self ? r.y + 15 + j * 16 : r.y - 7 - (r.text.length - 1 - j) * 16}>{t}</tspan>
              ))}
            </text>
          </g>
        );
      })}
    </>
  );
}

export function Diagram({ code, caption, title, tr }: { code: string; caption: string; title?: string; tr?: ((s: string) => string) | null }) {
  // Laid out from the translated texts, so boxes fit them; the Mermaid source below stays as written.
  const L = layoutDiagram(code, tr ?? undefined);
  const id = `dg${hash(code)}${tr ? 't' : ''}`;
  return (
    <figure className={s.diagram}>
      {title ? <p className={s.diagramTitle}>{title}</p> : null}
      <div className={s.diagramScroll}>
        <svg
          viewBox={`0 0 ${L.width} ${L.height}`}
          width={L.width}
          height={L.height}
          className={s.diagramSvg}
          style={{ width: `max(100%, ${Math.round(L.width * 0.68)}px)`, maxWidth: L.width }}
          role="img"
          aria-label={caption}
        >
          <defs>
            <marker id={`${id}-a`} viewBox="0 0 10 10" refX="9" refY="5" markerWidth="7" markerHeight="7" orient="auto-start-reverse"><path d="M0 1L9 5L0 9z" className={s.dgHead} /></marker>
            <marker id={`${id}-ad`} viewBox="0 0 10 10" refX="9" refY="5" markerWidth="7" markerHeight="7" orient="auto-start-reverse"><path d="M0 1L9 5L0 9z" className={s.dgHeadMuted} /></marker>
            <marker id={`${id}-s`} viewBox="0 0 10 10" refX="9" refY="5" markerWidth="7" markerHeight="7" orient="auto-start-reverse"><path d="M0 1L9 5L0 9z" className={s.dgHead} /></marker>
            <marker id={`${id}-sd`} viewBox="0 0 10 10" refX="9" refY="5" markerWidth="7" markerHeight="7" orient="auto-start-reverse"><path d="M0 1L9 5L0 9z" className={s.dgHeadMuted} /></marker>
            <marker id={`${id}-x`} viewBox="0 0 10 10" refX="5" refY="5" markerWidth="9" markerHeight="9" orient="auto"><path d="M1 1L9 9M9 1L1 9" className={s.dgCross} /></marker>
          </defs>
          {L.type === "flow" ? <Flow L={L} id={id} /> : <Seq L={L} id={id} />}
        </svg>
      </div>
      <figcaption className={s.figcaption}>{caption}</figcaption>
      <details className={s.diagramSource}>
        <summary>Mermaid source</summary>
        <div className={s.codeBox}>
          <div className={s.codeHead}>
            <span>Mermaid</span>
            <CopyButton text={code.trim()} />
          </div>
          <pre className={s.pre}>
            <code>{code.trim()}</code>
          </pre>
        </div>
      </details>
    </figure>
  );
}
