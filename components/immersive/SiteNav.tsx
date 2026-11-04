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
 * frosted with backdrop blur. Each group opens a glass panel with a short
 * line under every link, on hover or focus on wide screens and on tap on
 * phones. Keyboard: Tab moves through groups, Enter/Space/ArrowDown opens,
 * Escape closes and returns focus to the trigger.
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
      { label: "Network status", href: "/status", hint: "What is up right now" },
    ],
  },
  {
    label: "Developers",
    items: [
      { label: "Documentation", href: "/docs/overview", hint: "How everything works, honestly" },
      { label: "Architecture", href: "/docs/architecture", hint: "Messaging, identity and payments" },
      { label: "Developer hub", href: "/developers", hint: "Run it, read it, build on it" },
      { label: "Source code", href: EXTERNAL_LINKS.github.repo, hint: "Humanity-Ledger on GitHub", external: true },
      { label: "Changelog", href: "/changelog", hint: "What changed, in plain words" },
    ],
  },
  {
    label: "Company",
    items: [
      { label: "About", href: "/company", hint: "Who builds Humanity Ledger" },
      { label: "Blog", href: "/blog", hint: "Notes from the work" },
      { label: "Security", href: "/docs/audits", hint: "Audits, findings and disclosure" },
      { label: "Contact", href: "/contact", hint: "Write to us" },
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

function Group({ group, open, setOpen }: { group: NavGroup; open: boolean; setOpen: (v: boolean) => void }) {
  const id = useId();
  const triggerRef = useRef<HTMLButtonElement>(null);
  const panelRef = useRef<HTMLDivElement>(null);
  const closeTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const cancelClose = () => {
    if (closeTimer.current) clearTimeout(closeTimer.current);
  };
  const scheduleClose = () => {
    cancelClose();
    closeTimer.current = setTimeout(() => setOpen(false), 140);
  };

  return (
    <div
      className={s.group}
      onPointerEnter={(e) => {
        if (e.pointerType === "mouse") {
          cancelClose();
          setOpen(true);
        }
      }}
      onPointerLeave={(e) => e.pointerType === "mouse" && scheduleClose()}
      onKeyDown={(e) => {
        if (e.key === "Escape" && open) {
          e.stopPropagation();
          setOpen(false);
          triggerRef.current?.focus();
        }
        if (e.key === "ArrowDown" && document.activeElement === triggerRef.current) {
          e.preventDefault();
          setOpen(true);
          requestAnimationFrame(() => (panelRef.current?.querySelector("a") as HTMLElement | null)?.focus());
        }
      }}
      onBlur={(e) => {
        if (!e.currentTarget.contains(e.relatedTarget as Node)) setOpen(false);
      }}
    >
      <button
        ref={triggerRef}
        type="button"
        className={`${s.trigger} ${open ? s.triggerOpen : ""}`}
        aria-expanded={open}
        aria-controls={id}
        onClick={() => setOpen(!open)}
      >
        {group.label}
        <ChevronDown size={14} strokeWidth={2} aria-hidden="true" className={s.chev} />
      </button>
      <div ref={panelRef} id={id} role="menu" aria-label={group.label} className={`${s.panel} hl-glass ${open ? s.panelOpen : ""}`}>
        {group.items.map((it) => (
          <NavLink key={it.label} item={it} onNavigate={() => setOpen(false)} />
        ))}
      </div>
    </div>
  );
}

export function SiteNav({ groups = SITE_NAV }: { groups?: NavGroup[] }) {
  const [openIdx, setOpenIdx] = useState<number | null>(null);
  const [sheet, setSheet] = useState(false);
  const [scrolled, setScrolled] = useState(false);

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

        <nav className={s.groups} aria-label="Main">
          {groups.map((g, i) => (
            <Group key={g.label} group={g} open={openIdx === i} setOpen={(v) => setOpenIdx(v ? i : openIdx === i ? null : openIdx)} />
          ))}
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
