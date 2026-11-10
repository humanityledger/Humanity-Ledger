"use client";

import React, { useCallback, useEffect, useId, useRef, useState } from "react";
import Link from "next/link";
import { ArrowUpRight, ChevronDown, Menu, X as Close } from "lucide-react";
import { HLLogo } from "@/components/shared/HLLogo";
import { EXTERNAL_LINKS } from "@/lib/constants/links";
import s from "./SiteNav.module.css";

/**
 * SiteNav — the floating glass navigation of every public page.
 *
 * A rounded bar that floats over the living background (ImmersiveField),
 * frosted with high-contrast backdrop blur. Centralized hover management
 * with a 350ms grace period ensures moving between Product, Developers,
 * and Company is silky smooth and never abruptly closes.
 */

export interface NavItem {
  label: string;
  href: string;
  hint?: string;
  external?: boolean;
}

export interface NavGroup {
  label: string;
  items: NavItem[];
}

export const SITE_NAV: NavGroup[] = [
  {
    label: "Product",
    items: [
      { label: "Ledger Chat", href: "/chat", hint: "The private messenger, in your browser" },
      { label: "How it works", href: "/#how-it-works", hint: "From wallet to first message" },
      { label: "Private payments", href: "/#payments", hint: "Shielded transfers on Aztec" },
      { label: "Download", href: "/#download", hint: "Phone and desktop" },
      { label: "Network status", href: "/docs/status", hint: "What is up right now" },
    ],
  },
  {
    label: "Developers",
    items: [
      { label: "Documentation", href: "/docs/overview", hint: "How everything works, honestly" },
      { label: "Architecture", href: "/docs/architecture", hint: "Messaging, identity and payments" },
      { label: "Developers", href: "/docs/developers", hint: "Run it, read it, build on it" },
      { label: "Source code", href: EXTERNAL_LINKS.github.repo, hint: "Humanity-Ledger on GitHub", external: true },
      { label: "Changelog", href: "/docs/changelog", hint: "What changed, in plain words" },
    ],
  },
  {
    label: "Company",
    items: [
      { label: "About", href: "/docs/about", hint: "Who builds Humanity Ledger" },
      { label: "Blog", href: "/docs/blog", hint: "Notes from the work" },
      { label: "Security", href: "/docs/audits", hint: "Audits, findings and disclosure" },
      { label: "Contact", href: "/docs/contact", hint: "Write to us" },
    ],
  },
];

function NavLink({ item, onNavigate }: { item: NavItem; onNavigate?: () => void }) {
  const body = (
    <>
      <span className={s.itemLabel}>
        {item.label}
        {item.external && <ArrowUpRight size={13} strokeWidth={2} aria-hidden="true" />}
      </span>
      {item.hint && <span className={s.itemHint}>{item.hint}</span>}
    </>
  );
  return item.external ? (
    <a href={item.href} target="_blank" rel="noopener noreferrer" className={s.item} role="menuitem" onClick={onNavigate}>
      {body}
    </a>
  ) : (
    <Link href={item.href} className={s.item} role="menuitem" onClick={onNavigate}>
      {body}
    </Link>
  );
}

export function SiteNav({ groups = SITE_NAV }: { groups?: NavGroup[] }) {
  const [openIdx, setOpenIdx] = useState<number | null>(null);
  const [sheet, setSheet] = useState(false);
  const [scrolled, setScrolled] = useState(false);
  const closeTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const cancelClose = useCallback(() => {
    if (closeTimerRef.current) {
      clearTimeout(closeTimerRef.current);
      closeTimerRef.current = null;
    }
  }, []);

  const scheduleClose = useCallback(() => {
    cancelClose();
    // 350ms grace timeout prevents accidental dismissals when moving between menus
    closeTimerRef.current = setTimeout(() => {
      setOpenIdx(null);
    }, 350);
  }, [cancelClose]);

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 8);
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  const closeSheet = useCallback(() => setSheet(false), []);
  useEffect(() => {
    if (!sheet) return;
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && setSheet(false);
    document.addEventListener("keydown", onKey);
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", onKey);
      document.body.style.overflow = prev;
    };
  }, [sheet]);

  return (
    <div className={s.shell}>
      <header className={`${s.bar} hl-glass ${scrolled ? s.barScrolled : ""}`}>
        <Link href="/" className={s.brand} aria-label="Humanity Ledger home">
          <HLLogo size={30} />
        </Link>

        <nav
          className={s.groups}
          aria-label="Main"
          onPointerLeave={scheduleClose}
          onPointerEnter={cancelClose}
        >
          {groups.map((g, i) => {
            const isOpen = openIdx === i;
            return (
              <div
                key={g.label}
                className={s.group}
                onPointerEnter={() => {
                  cancelClose();
                  setOpenIdx(i);
                }}
                onKeyDown={(e) => {
                  if (e.key === "Escape" && isOpen) {
                    e.stopPropagation();
                    setOpenIdx(null);
                  }
                }}
              >
                <button
                  type="button"
                  className={`${s.trigger} ${isOpen ? s.triggerOpen : ""}`}
                  aria-expanded={isOpen}
                  onClick={() => setOpenIdx(isOpen ? null : i)}
                >
                  {g.label}
                  <ChevronDown size={14} strokeWidth={2} aria-hidden="true" className={s.chev} />
                </button>
                <div
                  role="menu"
                  aria-label={g.label}
                  className={`${s.panel} hl-glass ${isOpen ? s.panelOpen : ""}`}
                  onPointerEnter={cancelClose}
                  onPointerLeave={scheduleClose}
                >
                  {g.items.map((it) => (
                    <NavLink key={it.label} item={it} onNavigate={() => setOpenIdx(null)} />
                  ))}
                </div>
              </div>
            );
          })}
        </nav>

        <div className={s.actions}>
          <a href={EXTERNAL_LINKS.x} target="_blank" rel="noopener noreferrer" className={s.textLink} aria-label="Humanity Ledger on X (opens x.com/humanityledger)">
            X
            <ArrowUpRight size={12} strokeWidth={2} aria-hidden="true" />
          </a>
          <Link href="/connect" className={`${s.btn} ${s.btnGhost} ${s.hideSm}`}>
            Sign in
          </Link>
          <Link href="/chat" className={`${s.btn} ${s.btnPrimary}`}>
            Open Ledger Chat
          </Link>
          <button type="button" className={s.menuBtn} aria-label="Open menu" aria-expanded={sheet} onClick={() => setSheet(true)}>
            <Menu size={19} strokeWidth={1.9} />
          </button>
        </div>
      </header>

      {sheet && (
        <div className={s.sheetBackdrop} onClick={closeSheet}>
          <div role="dialog" aria-modal="true" aria-label="Menu" className={`${s.sheet} hl-glass`} onClick={(e) => e.stopPropagation()}>
            <div className={s.sheetHead}>
              <HLLogo size={28} />
              <button type="button" className={s.menuBtn} aria-label="Close menu" onClick={closeSheet} autoFocus>
                <Close size={19} strokeWidth={1.9} />
              </button>
            </div>
            {groups.map((g) => (
              <div key={g.label} className={s.sheetGroup}>
                <p className={s.sheetTitle}>{g.label}</p>
                {g.items.map((it) => (
                  <NavLink key={it.label} item={it} onNavigate={closeSheet} />
                ))}
              </div>
            ))}
            <div className={s.sheetActions}>
              <Link href="/connect" className={`${s.btn} ${s.btnGhost}`} onClick={closeSheet}>
                Sign in
              </Link>
              <Link href="/chat" className={`${s.btn} ${s.btnPrimary}`} onClick={closeSheet}>
                Open Ledger Chat
              </Link>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default SiteNav;
