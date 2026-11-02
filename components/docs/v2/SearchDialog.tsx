"use client";

import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { ChevronRight, CornerDownLeft, FileText, Hash, LoaderCircle, Search } from "lucide-react";
import type { SearchEntry } from "@/lib/docs/registry";
import s from "./Docs.module.css";

/**
 * Full text search across the documentation.
 *
 * The index is imported the first time the dialog opens, so readers who
 * never search never download it. Matching is done in the browser: every
 * word typed must appear somewhere in an entry, and entries are ranked by
 * where the words appear, with titles counting most.
 */

const SUGGESTED = ["/docs/quickstart", "/docs/ledger-chat", "/docs/pin", "/docs/zero-knowledge", "/docs/bug-bounty"];

function fold(text: string) {
  return text
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "");
}

function escapeRe(text: string) {
  return text.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

interface Ranked {
  entry: SearchEntry;
  score: number;
}

function rank(index: SearchEntry[], query: string): Ranked[] {
  const terms = fold(query).split(/\s+/).filter(Boolean);
  if (terms.length === 0) return [];
  const phrase = terms.join(" ");
  const out: Ranked[] = [];

  for (const entry of index) {
    const title = fold(entry.section ?? entry.page);
    const page = fold(entry.page);
    const keywords = fold(entry.keywords);
    const summary = fold(entry.summary);
    const text = fold(entry.text);
    const all = `${title} ${page} ${keywords} ${summary} ${text}`;

    let score = 0;
    let ok = true;
    for (const t of terms) {
      if (!all.includes(t)) {
        ok = false;
        break;
      }
      if (title.startsWith(t)) score += 40;
      else if (title.includes(t)) score += 24;
      if (page.includes(t)) score += 8;
      if (keywords.includes(t)) score += 12;
      if (summary.includes(t)) score += 6;
      if (text.includes(t)) score += 2;
    }
    if (!ok) continue;
    if (title.includes(phrase)) score += 30;
    if (!entry.section) score += 3;
    out.push({ entry, score });
  }

  return out.sort((a, b) => b.score - a.score).slice(0, 24);
}

function snippet(entry: SearchEntry, query: string) {
  const source = entry.summary || entry.text;
  if (!query.trim()) return source;
  const first = fold(query).split(/\s+/).filter(Boolean)[0];
  const body = entry.text || entry.summary;
  const at = fold(body).indexOf(first);
  if (at < 0) return source;
  const start = Math.max(0, at - 60);
  const end = Math.min(body.length, at + 120);
  return `${start > 0 ? "…" : ""}${body.slice(start, end).trim()}${end < body.length ? "…" : ""}`;
}

function Highlight({ text, query }: { text: string; query: string }) {
  const terms = query.split(/\s+/).filter((t) => t.length > 1);
  if (terms.length === 0) return <>{text}</>;
  const re = new RegExp(`(${terms.map(escapeRe).join("|")})`, "gi");
  const parts = text.split(re);
  return (
    <>
      {parts.map((part, i) =>
        i % 2 === 1 ? (
          <mark key={i} className={s.mark}>
            {part}
          </mark>
        ) : (
          <React.Fragment key={i}>{part}</React.Fragment>
        ),
      )}
    </>
  );
}

export function SearchDialog({ open, onClose }: { open: boolean; onClose: () => void }) {
  const router = useRouter();
  const [index, setIndex] = useState<SearchEntry[] | null>(null);
  const [query, setQuery] = useState("");
  const [active, setActive] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);
  const listRef = useRef<HTMLDivElement>(null);
  const returnFocus = useRef<HTMLElement | null>(null);

  useEffect(() => {
    if (!open) return;
    returnFocus.current = document.activeElement as HTMLElement | null;
    setActive(0);
    const t = window.setTimeout(() => inputRef.current?.focus(), 10);
    return () => {
      window.clearTimeout(t);
      returnFocus.current?.focus?.();
    };
  }, [open]);

  useEffect(() => {
    if (!open || index) return;
    let cancelled = false;
    import("@/lib/docs/searchIndex")
      .then((m) => !cancelled && setIndex(m.SEARCH_INDEX))
      .catch(() => !cancelled && setIndex([]));
    return () => {
      cancelled = true;
    };
  }, [open, index]);

  const results = useMemo(() => {
    if (!index) return [];
    if (!query.trim()) {
      return SUGGESTED.map((href) => index.find((e) => e.href === href))
        .filter((e): e is SearchEntry => Boolean(e))
        .map((entry) => ({ entry, score: 0 }));
    }
    return rank(index, query);
  }, [index, query]);

  useEffect(() => setActive(0), [query]);

  useEffect(() => {
    const el = listRef.current?.querySelector<HTMLElement>(`[data-index="${active}"]`);
    el?.scrollIntoView({ block: "nearest" });
  }, [active]);

  const go = useCallback(
    (href: string) => {
      onClose();
      router.push(href);
    },
    [onClose, router],
  );

  const onKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Escape") {
      e.preventDefault();
      onClose();
    } else if (e.key === "ArrowDown") {
      e.preventDefault();
      setActive((a) => Math.min(a + 1, Math.max(results.length - 1, 0)));
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setActive((a) => Math.max(a - 1, 0));
    } else if (e.key === "Enter") {
      const hit = results[active];
      if (hit) {
        e.preventDefault();
        go(hit.entry.href);
      }
    } else if (e.key === "Tab") {
      // Keep focus inside the dialog: the input is the only control.
      e.preventDefault();
      inputRef.current?.focus();
    }
  };

  if (!open) return null;

  const listId = "docs-search-results";

  return (
    <div className={s.searchOverlay} onMouseDown={(e) => e.target === e.currentTarget && onClose()}>
      <div className={s.searchPanel} role="dialog" aria-modal="true" aria-label="Search documentation" onKeyDown={onKeyDown}>
        <div className={s.searchInputRow}>
          <Search size={18} strokeWidth={1.9} aria-hidden="true" />
          <input
            ref={inputRef}
            className={s.searchInput}
            type="search"
            placeholder="Search the documentation"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            role="combobox"
            aria-expanded="true"
            aria-controls={listId}
            aria-activedescendant={results[active] ? `docs-result-${active}` : undefined}
            autoComplete="off"
            spellCheck={false}
          />
          <button type="button" className={s.kbd} onClick={onClose} aria-label="Close search" style={{ cursor: "pointer" }}>
            Esc
          </button>
        </div>

        <div className={s.results} ref={listRef}>
          {!index ? (
            <div className={s.searchEmpty} role="status">
              <LoaderCircle size={18} strokeWidth={2} className={s.spin} aria-label="Loading" />
            </div>
          ) : results.length === 0 ? (
            <div className={s.searchEmpty} role="status">
              <strong>No results for “{query.trim()}”</strong>
              Try a shorter word, or a different one such as PIN, wallet or encryption.
            </div>
          ) : (
            <>
              <p className={s.resultGroup}>{query.trim() ? `${results.length} ${results.length === 1 ? "result" : "results"}` : "Suggested"}</p>
              <ul className={s.resultList} id={listId} role="listbox" aria-label="Results">
                {results.map(({ entry }, i) => {
                  const Icon = entry.section ? Hash : FileText;
                  return (
                    <li key={entry.href} role="presentation">
                      <a
                        id={`docs-result-${i}`}
                        data-index={i}
                        role="option"
                        aria-selected={i === active}
                        href={entry.href}
                        className={`${s.result} ${i === active ? s.resultActive : ""}`}
                        onMouseMove={() => setActive(i)}
                        onClick={(e) => {
                          e.preventDefault();
                          go(entry.href);
                        }}
                      >
                        <Icon size={16} strokeWidth={1.75} aria-hidden="true" />
                        <span className={s.resultBody}>
                          <span className={s.resultTitle}>
                            {entry.section ? (
                              <>
                                <span className={s.resultCrumb}>{entry.page}</span>
                                <ChevronRight size={13} strokeWidth={2} aria-hidden="true" style={{ color: "var(--hl-ink-4)", marginTop: 0 }} />
                                <Highlight text={entry.section} query={query} />
                              </>
                            ) : (
                              <Highlight text={entry.page} query={query} />
                            )}
                          </span>
                          <span className={s.resultSnippet}>
                            <Highlight text={snippet(entry, query)} query={query} />
                          </span>
                        </span>
                      </a>
                    </li>
                  );
                })}
              </ul>
            </>
          )}
        </div>

        <div className={s.searchFoot} aria-hidden="true">
          <span>
            <span className={s.kbd}>
              <CornerDownLeft size={12} strokeWidth={2} />
            </span>
            to open
          </span>
          <span>
            <span className={s.kbd}>↑</span>
            <span className={s.kbd}>↓</span>
            to move
          </span>
          <span>
            <span className={s.kbd}>Esc</span>
            to close
          </span>
        </div>
      </div>
    </div>
  );
}
