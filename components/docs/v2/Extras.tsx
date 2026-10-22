import React from "react";
import Link from "next/link";
import { RELEASES, type ChangeKind } from "@/lib/docs/pages/changelog";
import { BLOG_POSTS } from "@/lib/docs/pages/company";
import { formatDate } from "./DocsLayout";
import s from "./Docs.module.css";

const KIND_LABEL: Record<ChangeKind, string> = {
  new: "New",
  improved: "Improved",
  fixed: "Fixed",
  security: "Security",
};

export const CHANGELOG_TOC = RELEASES.map((r) => ({ id: r.id, text: r.title, level: 2 as const }));

export function ChangelogList() {
  return (
    <div style={{ marginTop: 32 }}>
      {RELEASES.map((r) => (
        <section key={r.id} className={s.release} aria-labelledby={r.id}>
          <h2 id={r.id} className={s.releaseTitle}>
            {r.title}
            {r.note && <span className={s.releaseNote}>{r.note}</span>}
          </h2>
          <ul className={s.changes}>
            {r.changes.map((c, i) => (
              <li key={i} className={s.change}>
                <span className={`${s.kind} ${s[`kind_${c.kind}`]}`}>{KIND_LABEL[c.kind]}</span>
                <span>{c.text}</span>
              </li>
            ))}
          </ul>
        </section>
      ))}
      <p className={s.p} style={{ marginTop: 24, color: "var(--hl-ink-3)", fontSize: 14.5 }}>
        Earlier history is in the{" "}
        <a
          className={s.link}
          href="https://github.com/humanityledger/Humanity-Ledger/commits/main"
          target="_blank"
          rel="noopener noreferrer"
        >
          commit log on GitHub
        </a>
        .
      </p>
    </div>
  );
}

export function BlogIndex() {
  return (
    <ul className={s.posts}>
      {BLOG_POSTS.map((p) => (
        <li key={p.slug} className={s.post}>
          <Link href={`/blog/${p.slug}`} className={s.postLink}>
            <span className={s.postDate}>{formatDate(p.date)}</span>
            <h2 className={s.postTitle}>{p.title}</h2>
            <p className={s.postSummary}>{p.summary}</p>
          </Link>
        </li>
      ))}
    </ul>
  );
}
