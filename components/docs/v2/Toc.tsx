"use client";

import React, { useEffect, useState } from "react";
import { ArrowUp, TextAlignStart } from "lucide-react";
import type { TocItem } from "@/lib/docs/registry";
import s from "./Docs.module.css";

/**
 * "On this page". Highlights the section being read.
 *
 * The page may scroll inside a container rather than the window (the app
 * shell wraps public pages in a scrolling <main>), so this listens for
 * scroll events anywhere in the document and measures headings directly.
 */
export function Toc({ items }: { items: TocItem[] }) {
  const [active, setActive] = useState<string>(items[0]?.id ?? "");

  useEffect(() => {
    if (items.length === 0) return;
    let frame = 0;
    const measure = () => {
      frame = 0;
      const line = 140;
      let current = items[0].id;
      for (const item of items) {
        const el = document.getElementById(item.id);
        if (!el) continue;
        if (el.getBoundingClientRect().top <= line) current = item.id;
        else break;
      }
      setActive(current);
    };
    const onScroll = () => {
      if (!frame) frame = window.requestAnimationFrame(measure);
    };
    measure();
    document.addEventListener("scroll", onScroll, { capture: true, passive: true });
    window.addEventListener("resize", onScroll);
    return () => {
      document.removeEventListener("scroll", onScroll, { capture: true } as EventListenerOptions);
      window.removeEventListener("resize", onScroll);
      if (frame) window.cancelAnimationFrame(frame);
    };
  }, [items]);

  if (items.length < 2) return <aside className={s.toc} aria-hidden="true" />;

  return (
    <aside className={s.toc} aria-label="On this page">
      <p className={s.tocTitle}>
        <TextAlignStart size={15} strokeWidth={1.9} aria-hidden="true" />
        On this page
      </p>
      <ul className={s.tocList}>
        {items.map((item) => (
          <li key={item.id}>
            <a
              href={`#${item.id}`}
              className={`${s.tocLink} ${item.level === 3 ? s.tocSub : ""} ${active === item.id ? s.tocActive : ""}`}
              aria-current={active === item.id ? "location" : undefined}
            >
              {item.text}
            </a>
          </li>
        ))}
      </ul>
      <button
        type="button"
        className={s.tocTop}
        onClick={() => document.querySelector("[data-docs-root]")?.scrollIntoView({ behavior: "smooth", block: "start" })}
      >
        <ArrowUp size={14} strokeWidth={2} aria-hidden="true" />
        Back to top
      </button>
    </aside>
  );
}
