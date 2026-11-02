import React from "react";
import Link from "next/link";
import { ArrowRight, ArrowUpRight, CircleCheck, Hash, Info, OctagonAlert, TriangleAlert } from "lucide-react";
import type { Block, FeatureState, HintTone } from "@/lib/docs/types";
import { headingId } from "@/lib/docs/registry";
import { Inline, isExternal } from "./inline";
import { CopyButton } from "./CopyButton";
import { Figure } from "./Figures";
import { DOC_ICONS } from "./icons";
import s from "./Docs.module.css";

const HINT_ICON: Record<HintTone, typeof Info> = {
  info: Info,
  warning: TriangleAlert,
  danger: OctagonAlert,
  success: CircleCheck,
};

const STATE_LABEL: Record<FeatureState, string> = {
  available: "Available",
  partial: "Partly available",
  development: "In development",
  unavailable: "Not yet",
};

function T({ text }: { text: string }) {
  return <Inline text={text} linkClass={s.link} codeClass={s.code} />;
}

function Heading({ level, text, id }: { level: 2 | 3; text: string; id?: string }) {
  const anchor = headingId(text, id);
  const Tag = level === 2 ? "h2" : "h3";
  return (
    <Tag id={anchor} className={level === 2 ? s.h2 : s.h3}>
      <a href={`#${anchor}`} className={s.anchor} aria-label={`Link to ${text}`}>
        <Hash size={15} strokeWidth={2} aria-hidden="true" />
      </a>
      {text}
    </Tag>
  );
}

function CardLink({
  href,
  external,
  className,
  children,
}: {
  href: string;
  external?: boolean;
  className: string;
  children: React.ReactNode;
}) {
  if (external || isExternal(href)) {
    const mail = href.startsWith("mailto:");
    return (
      <a href={href} className={className} {...(mail ? {} : { target: "_blank", rel: "noopener noreferrer" })}>
        {children}
      </a>
    );
  }
  return (
    <Link href={href} className={className}>
      {children}
    </Link>
  );
}

export function BlockView({ block }: { block: Block }) {
  switch (block.t) {
    case "p":
      return (
        <p className={s.p}>
          <T text={block.text} />
        </p>
      );
    case "h2":
      return <Heading level={2} text={block.text} id={block.id} />;
    case "h3":
      return <Heading level={3} text={block.text} id={block.id} />;
    case "ul":
    case "ol": {
      const Tag = block.t;
      return (
        <Tag className={s.list}>
          {block.items.map((item, i) => (
            <li key={i}>
              <T text={item} />
            </li>
          ))}
        </Tag>
      );
    }
    case "steps":
      return (
        <ol className={s.steps}>
          {block.items.map((item, i) => (
            <li key={i} className={s.step}>
              <div>
                <p className={s.stepTitle}>{item.title}</p>
                <p className={s.stepText}>
                  <T text={item.text} />
                </p>
              </div>
            </li>
          ))}
        </ol>
      );
    case "table":
      return (
        <div className={s.tableBox}>
          <table className={s.table}>
            <thead>
              <tr>
                {block.head.map((h) => (
                  <th key={h} scope="col">
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {block.rows.map((row, r) => (
                <tr key={r}>
                  {row.map((cell, c) => (
                    <td key={c} className={block.strongFirst && c === 0 ? s.strong : undefined}>
                      <T text={cell} />
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      );
    case "hint": {
      const Icon = HINT_ICON[block.tone];
      return (
        <div className={`${s.hint} ${s[`hint_${block.tone}`]}`} role="note">
          <Icon size={18} strokeWidth={1.9} aria-hidden="true" />
          <div>
            {block.title && <p className={s.hintTitle}>{block.title}</p>}
            <p className={s.hintText}>
              <T text={block.text} />
            </p>
          </div>
        </div>
      );
    }
    case "code":
      return (
        <div className={s.codeBox}>
          <div className={s.codeHead}>
            <span>{block.label ?? "Code"}</span>
            <CopyButton text={block.code} />
          </div>
          <pre className={s.pre}>
            <code>{block.code}</code>
          </pre>
        </div>
      );
    case "defs":
      return (
        <dl className={s.defs}>
          {block.items.map((item) => (
            <div key={item.term}>
              <dt>{item.term}</dt>
              <dd>
                <T text={item.text} />
              </dd>
            </div>
          ))}
        </dl>
      );
    case "cards":
      return (
        <div className={s.cards}>
          {block.items.map((item) => {
            const Icon = DOC_ICONS[item.icon];
            const ext = item.external || isExternal(item.href);
            return (
              <CardLink key={item.title} href={item.href} external={item.external} className={s.card}>
                <span className={s.cardIcon} aria-hidden="true">
                  <Icon size={17} strokeWidth={1.75} />
                </span>
                <span className={s.cardTitle}>
                  {item.title}
                  {ext ? (
                    <ArrowUpRight size={15} strokeWidth={2} aria-hidden="true" />
                  ) : (
                    <ArrowRight size={15} strokeWidth={2} aria-hidden="true" />
                  )}
                </span>
                <span className={s.cardText}>{item.text}</span>
              </CardLink>
            );
          })}
        </div>
      );
    case "status":
      return (
        <div className={s.statusList}>
          {block.items.map((item) => (
            <div key={item.label} className={s.statusRow}>
              <div className={s.statusLabel}>
                {item.label}
                <span className={`${s.pill} ${s[`pill_${item.state}`]}`}>{STATE_LABEL[item.state]}</span>
              </div>
              <div className={s.statusText}>
                <T text={item.text} />
              </div>
            </div>
          ))}
        </div>
      );
    case "figure":
      return <Figure kind={block.kind} caption={block.caption} />;
    case "person":
      return (
        <div className={s.person}>
          {block.photo ? (
            <img src={block.photo} alt="" className={s.personPhoto} width={64} height={64} loading="lazy" />
          ) : (
            <span className={`${s.personPhoto} ${s.personInitials}`} aria-hidden="true">
              {block.name
                .split(" ")
                .filter(Boolean)
                .map((w) => w[0])
                .filter((_, i, a) => i === 0 || i === a.length - 1)
                .join("")}
            </span>
          )}
          <div>
            <p className={s.personName}>{block.name}</p>
            <p className={s.personRole}>{block.role}</p>
            <div className={s.personLinks}>
              {block.links.map((l) => (
                <a key={l.href} href={l.href} target="_blank" rel="noopener noreferrer" className={s.link}>
                  {l.label}
                </a>
              ))}
            </div>
          </div>
        </div>
      );
    default:
      return null;
  }
}

export function Blocks({ blocks }: { blocks: Block[] }) {
  return (
    <>
      {blocks.map((b, i) => (
        <BlockView key={i} block={b} />
      ))}
    </>
  );
}
