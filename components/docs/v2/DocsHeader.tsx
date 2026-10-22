"use client";

import React, { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { Github, Menu, Search, X } from "lucide-react";
import { HLMark } from "@/components/shared/HLLogo";
import { EXTERNAL_LINKS } from "@/lib/constants/links";
import { DocsNav } from "./DocsNav";
import { SearchDialog } from "./SearchDialog";
import s from "./Docs.module.css";

export function DocsHeader({ current }: { current: string }) {
  const pathname = usePathname();
  const [searchOpen, setSearchOpen] = useState(false);
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [shortcut, setShortcut] = useState("Ctrl K");

  useEffect(() => {
    const mac = /Mac|iPhone|iPad/.test(navigator.platform || navigator.userAgent);
    if (mac) setShortcut("⌘ K");
  }, []);

  // Close the drawer whenever the page changes.
  useEffect(() => setDrawerOpen(false), [pathname]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement | null;
      const typing = !!target && (target.isContentEditable || /^(INPUT|TEXTAREA|SELECT)$/.test(target.tagName));
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        setSearchOpen((v) => !v);
      } else if (e.key === "/" && !typing) {
        e.preventDefault();
        setSearchOpen(true);
      } else if (e.key === "Escape") {
        setDrawerOpen(false);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  const closeSearch = useCallback(() => setSearchOpen(false), []);

  return (
    <>
      <header className={s.header}>
        <div className={s.headerInner}>
          <div className={s.brandRow}>
            <button
              type="button"
              className={`${s.iconButton} ${s.menuButton}`}
              onClick={() => setDrawerOpen(true)}
              aria-label="Open navigation"
              aria-expanded={drawerOpen}
            >
              <Menu size={19} strokeWidth={1.9} aria-hidden="true" />
            </button>
            <Link href="/" className={s.brand} aria-label="Humanity Ledger home">
              <HLMark size={26} />
              <span className={s.brandName}>Humanity Ledger</span>
            </Link>
            <span className={s.brandDivider} aria-hidden="true" />
            <Link href="/docs/overview" className={s.brandSection}>
              Docs
            </Link>
          </div>

          <div className={s.searchSlot}>
            <button type="button" className={s.searchTrigger} onClick={() => setSearchOpen(true)} aria-label="Search documentation">
              <Search size={16} strokeWidth={1.9} aria-hidden="true" />
              <span>Search</span>
              <span className={s.kbd} aria-hidden="true">
                {shortcut}
              </span>
            </button>
          </div>

          <div className={s.actions}>
            <button
              type="button"
              className={`${s.iconButton} ${s.searchIconButton}`}
              onClick={() => setSearchOpen(true)}
              aria-label="Search documentation"
            >
              <Search size={18} strokeWidth={1.9} aria-hidden="true" />
            </button>
            <Link href="/developers" className={`${s.headerLink} ${s.hideMedium}`}>
              Developers
            </Link>
            <a
              href={EXTERNAL_LINKS.github.repo}
              target="_blank"
              rel="noopener noreferrer"
              className={`${s.iconButton} ${s.hideTiny}`}
              aria-label="Humanity Ledger on GitHub"
            >
              <Github size={18} strokeWidth={1.75} aria-hidden="true" />
            </a>
            <Link href="/chat" className={s.primaryButton}>
              <span className={s.hideNarrow}>Open Ledger Chat</span>
              <span className={s.showNarrow}>Open app</span>
            </Link>
          </div>
        </div>
      </header>

      {drawerOpen && (
        <>
          <div className={s.overlay} onClick={() => setDrawerOpen(false)} aria-hidden="true" />
          <div className={s.drawer} role="dialog" aria-modal="true" aria-label="Documentation navigation">
            <div className={s.drawerHead}>
              <Link href="/" className={s.brand} aria-label="Humanity Ledger home">
                <HLMark size={24} />
                <span className={s.brandName}>Humanity Ledger</span>
              </Link>
              <button type="button" className={s.iconButton} onClick={() => setDrawerOpen(false)} aria-label="Close navigation">
                <X size={19} strokeWidth={1.9} aria-hidden="true" />
              </button>
            </div>
            <div className={s.drawerBody}>
              <DocsNav current={current} onNavigate={() => setDrawerOpen(false)} />
            </div>
            <div className={s.drawerFoot}>
              <Link href="/developers">Developers</Link>
              <a href={EXTERNAL_LINKS.github.repo} target="_blank" rel="noopener noreferrer">
                <Github size={16} strokeWidth={1.75} aria-hidden="true" />
                GitHub
              </a>
            </div>
          </div>
        </>
      )}

      <SearchDialog open={searchOpen} onClose={closeSearch} />
    </>
  );
}
