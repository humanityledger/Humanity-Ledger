"use client";

import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { Search, CornerDownLeft, ArrowUp, ArrowDown } from "lucide-react";
import { ALL_DOC_SLUGS, type DocEntry } from "./DocsData";

/**
 * Documentation search.
 *
 * Opens with ⌘K or Ctrl+K, or by clicking the field in the docs header.
 *
 * Deliberately not a fuzzy matcher. Fuzzy ranking on an index of twenty pages
 * produces confident nonsense — type "key" and get "Changelog" because it
 * shares three letters. With a corpus this size, substring matching across
 * title, group, summary and keywords is both more predictable and easier for a
 * reader to form a mental model of. Revisit when the index passes a few
 * hundred pages, not before.
 *
 * Matches are scored so that a title hit always outranks a summary hit. A
 * reader who types the exact name of a page expects it first, and getting that
 * wrong is the fastest way to make a search feel broken.
 */

interface ScoredEntry {
  entry: DocEntry;
  score: number;
  /** Which field produced the best match, shown as context in the result row. */
  matchedOn: "title" | "keyword" | "summary" | "group";
}

const SCORE = {
  titleExact: 100,
  titlePrefix: 80,
  titleContains: 60,
  keyword: 40,
  group: 25,
  summary: 20,
} as const;

function scoreEntry(entry: DocEntry, q: string): ScoredEntry | null {
  const label = entry.label.toLowerCase();
  const group = entry.group.toLowerCase();
  const summary = entry.summary.toLowerCase();

  if (label === q) return { entry, score: SCORE.titleExact, matchedOn: "title" };
  if (label.startsWith(q)) return { entry, score: SCORE.titlePrefix, matchedOn: "title" };
  if (label.includes(q)) return { entry, score: SCORE.titleContains, matchedOn: "title" };

  if (entry.keywords.some((k) => k.includes(q) || q.includes(k))) {
    return { entry, score: SCORE.keyword, matchedOn: "keyword" };
  }
  if (group.includes(q)) return { entry, score: SCORE.group, matchedOn: "group" };
  if (summary.includes(q)) return { entry, score: SCORE.summary, matchedOn: "summary" };

  return null;
}

/** Wrap the matched run so the reader can see why a result came back. */
function Highlight({ text, query }: { text: string; query: string }) {
  if (!query) return <>{text}</>;
  const i = text.toLowerCase().indexOf(query.toLowerCase());
  if (i === -1) return <>{text}</>;
  return (
    <>
      {text.slice(0, i)}
      <mark className="bg-[#fdf0cf] text-inherit">{text.slice(i, i + query.length)}</mark>
      {text.slice(i + query.length)}
    </>
  );
}

export function DocsSearch() {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [cursor, setCursor] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);
  const listRef = useRef<HTMLUListElement>(null);

  const results = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return ALL_DOC_SLUGS.slice(0, 6).map((entry) => ({ entry, score: 0, matchedOn: "title" as const }));
    return ALL_DOC_SLUGS
      .map((e) => scoreEntry(e, q))
      .filter((r): r is ScoredEntry => r !== null)
      .sort((a, b) => b.score - a.score || a.entry.label.localeCompare(b.entry.label))
      .slice(0, 8);
  }, [query]);

  const close = useCallback(() => {
    setOpen(false);
    setQuery("");
    setCursor(0);
  }, []);

  const go = useCallback(
    (slug: string) => {
      close();
      router.push(`/docs/${slug}`);
    },
    [close, router],
  );

  // ⌘K / Ctrl+K anywhere, Escape to leave.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        setOpen((v) => !v);
        return;
      }
      if (e.key === "Escape" && open) close();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, close]);

  useEffect(() => {
    if (open) {
      // Focus after paint, or the browser restores focus to the trigger.
      const id = window.setTimeout(() => inputRef.current?.focus(), 0);
      return () => window.clearTimeout(id);
    }
  }, [open]);

  useEffect(() => setCursor(0), [query]);

  // Keep the highlighted row in view when driving the list from the keyboard.
  useEffect(() => {
    const el = listRef.current?.children[cursor] as HTMLElement | undefined;
    el?.scrollIntoView({ block: "nearest" });
  }, [cursor]);

  const onInputKey = (e: React.KeyboardEvent) => {
    if (e.key === "ArrowDown") {
      e.preventDefault();
      setCursor((c) => (results.length ? (c + 1) % results.length : 0));
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setCursor((c) => (results.length ? (c - 1 + results.length) % results.length : 0));
    } else if (e.key === "Enter" && results[cursor]) {
      e.preventDefault();
      go(results[cursor].entry.slug);
    }
  };

  return (
    <>
      {/* Trigger — a field, not an icon. An icon alone hides that search exists. */}
      <button
        onClick={() => setOpen(true)}
        className="flex items-center gap-2.5 rounded-[6px] border border-black/[0.1] bg-black/[0.02] px-3 py-[7px] text-left transition-colors hover:border-black/20 sm:w-56"
        aria-label="Search documentation"
      >
        <Search size={14} strokeWidth={1.8} className="shrink-0 text-black/35" />
        <span className="hidden flex-1 text-[13px] text-black/35 sm:block">Search docs</span>
        <kbd className="hidden shrink-0 rounded-[3px] border border-black/[0.1] bg-white px-1.5 py-0.5 font-mono text-[10px] text-black/35 sm:block">
          ⌘K
        </kbd>
      </button>

      {open && (
        <div
          className="fixed inset-0 z-[100] flex items-start justify-center bg-black/25 px-4 pt-[12vh] backdrop-blur-[2px]"
          onMouseDown={close}
          role="presentation"
        >
          <div
            className="w-full max-w-[560px] overflow-hidden rounded-[10px] border border-black/[0.08] bg-white shadow-[0_20px_60px_rgba(0,0,0,0.18)]"
            onMouseDown={(e) => e.stopPropagation()}
            role="dialog"
            aria-modal="true"
            aria-label="Search documentation"
          >
            <div className="flex items-center gap-3 border-b border-black/[0.08] px-4">
              <Search size={16} strokeWidth={1.8} className="shrink-0 text-black/30" />
              <input
                ref={inputRef}
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                onKeyDown={onInputKey}
                placeholder="Search the documentation"
                className="w-full bg-transparent py-4 text-[15px] text-[#0d0d11] outline-none placeholder:text-black/30"
                autoComplete="off"
                spellCheck={false}
              />
            </div>

            {results.length === 0 ? (
              <div className="px-4 py-10 text-center">
                <p className="text-[14px] text-black/55">
                  Nothing matches &ldquo;{query}&rdquo;.
                </p>
                <p className="mx-auto mt-2 max-w-[38ch] text-[13px] leading-relaxed text-black/40">
                  Try a plainer word for what you want to do — &ldquo;recover account&rdquo; rather than
                  the name of a page.
                </p>
              </div>
            ) : (
              <ul ref={listRef} className="max-h-[52vh] overflow-y-auto py-2">
                {!query.trim() && (
                  <li className="px-4 pb-1.5 pt-1 font-mono text-[10px] uppercase tracking-[0.14em] text-black/30">
                    Start here
                  </li>
                )}
                {results.map((r, i) => (
                  <li key={r.entry.slug}>
                    <button
                      onMouseEnter={() => setCursor(i)}
                      onClick={() => go(r.entry.slug)}
                      className={`flex w-full flex-col items-start gap-0.5 px-4 py-2.5 text-left transition-colors ${
                        i === cursor ? "bg-black/[0.04]" : ""
                      }`}
                    >
                      <span className="flex w-full items-baseline gap-2">
                        <span className="min-w-0 flex-1 truncate text-[14px] font-medium text-[#0d0d11]">
                          <Highlight text={r.entry.label} query={query.trim()} />
                        </span>
                        <span className="shrink-0 font-mono text-[10px] uppercase tracking-[0.12em] text-black/30">
                          {r.entry.group}
                        </span>
                      </span>
                      <span className="line-clamp-1 text-[12.5px] text-black/45">
                        <Highlight text={r.entry.summary} query={query.trim()} />
                      </span>
                    </button>
                  </li>
                ))}
              </ul>
            )}

            <div className="flex items-center gap-4 border-t border-black/[0.08] bg-black/[0.015] px-4 py-2.5">
              {[
                { icon: <ArrowUp size={10} />, extra: <ArrowDown size={10} />, label: "navigate" },
                { icon: <CornerDownLeft size={10} />, label: "open" },
              ].map((hint, idx) => (
                <span key={idx} className="flex items-center gap-1.5 text-[11px] text-black/35">
                  <kbd className="flex items-center gap-0.5 rounded-[3px] border border-black/[0.1] bg-white px-1 py-0.5">
                    {hint.icon}
                    {hint.extra}
                  </kbd>
                  {hint.label}
                </span>
              ))}
              <span className="ml-auto flex items-center gap-1.5 text-[11px] text-black/35">
                <kbd className="rounded-[3px] border border-black/[0.1] bg-white px-1.5 py-0.5 font-mono text-[10px]">
                  esc
                </kbd>
                close
              </span>
            </div>
          </div>
        </div>
      )}
    </>
  );
}

export default DocsSearch;
