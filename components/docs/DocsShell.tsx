"use client";

import React, { useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { motion, AnimatePresence } from "framer-motion";

import { DOC_SECTIONS, ALL_DOC_SLUGS } from "./DocsData";

// ── Sidebar component ─────────────────────────────────────────────────────────
export function DocsSidebar({ currentSlug }: { currentSlug: string }) {
  const [mobileOpen, setMobileOpen] = useState(false);

  const SidebarContent = () => (
    <nav className="flex flex-col gap-7">
      {DOC_SECTIONS.map((section) => (
        <div key={section.group}>
          <h3 className="mb-2 text-[10px] font-black uppercase tracking-[0.2em] text-slate-400 font-mono px-3">
            {section.group}
          </h3>
          <ul className="flex flex-col gap-0.5">
            {section.items.map((item) => {
              const isActive = item.slug === currentSlug;
              return (
                <li key={item.slug}>
                  <Link
                    href={`/docs/${item.slug}`}
                    onClick={() => setMobileOpen(false)}
                    className={`block rounded-lg px-3 py-2 text-[13px] font-medium transition-all duration-150 ${
                      isActive
                        ? "bg-indigo-50 text-indigo-700 font-semibold"
                        : "text-slate-500 hover:text-slate-900 hover:bg-slate-50"
                    }`}
                  >
                    {item.label}
                  </Link>
                </li>
              );
            })}
          </ul>
        </div>
      ))}
    </nav>
  );

  return (
    <>
      {/* Desktop sidebar */}
      <aside className="hidden lg:block sticky top-[64px] h-[calc(100vh-64px)] w-60 shrink-0 overflow-y-auto border-r border-slate-100 px-5 py-8">
        <SidebarContent />
      </aside>

      {/* Mobile FAB */}
      <button
        onClick={() => setMobileOpen(true)}
        className="lg:hidden fixed bottom-6 right-6 z-50 w-12 h-12 bg-indigo-600 text-white rounded-full shadow-xl shadow-indigo-500/40 flex items-center justify-center"
        aria-label="Open docs navigation"
      >
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
          <line x1="3" y1="6" x2="21" y2="6" />
          <line x1="3" y1="12" x2="21" y2="12" />
          <line x1="3" y1="18" x2="21" y2="18" />
        </svg>
      </button>

      {/* Mobile drawer */}
      <AnimatePresence>
        {mobileOpen && (
          <>
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="lg:hidden fixed inset-0 z-40 bg-black/30"
              onClick={() => setMobileOpen(false)}
            />
            <motion.aside
              initial={{ x: -280 }}
              animate={{ x: 0 }}
              exit={{ x: -280 }}
              transition={{ type: "spring", damping: 30, stiffness: 300 }}
              className="lg:hidden fixed top-0 left-0 z-50 h-full w-72 bg-white border-r border-slate-100 px-5 py-8 overflow-y-auto shadow-2xl"
            >
              <div className="flex items-center justify-between mb-8">
                <span className="text-[13px] font-bold text-slate-900">Documentation</span>
                <button onClick={() => setMobileOpen(false)} className="text-slate-400 hover:text-slate-900">
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                    <line x1="18" y1="6" x2="6" y2="18" />
                    <line x1="6" y1="6" x2="18" y2="18" />
                  </svg>
                </button>
              </div>
              <SidebarContent />
            </motion.aside>
          </>
        )}
      </AnimatePresence>
    </>
  );
}

// ── Prev/Next navigator ───────────────────────────────────────────────────────
export function DocsPrevNext({ currentSlug }: { currentSlug: string }) {
  const idx = ALL_DOC_SLUGS.findIndex((d) => d.slug === currentSlug);
  const prev = idx > 0 ? ALL_DOC_SLUGS[idx - 1] : null;
  const next = idx < ALL_DOC_SLUGS.length - 1 ? ALL_DOC_SLUGS[idx + 1] : null;

  return (
    <div className="flex items-center justify-between mt-20 pt-8 border-t border-slate-100">
      {prev ? (
        <Link href={`/docs/${prev.slug}`} className="group flex flex-col items-start gap-1">
          <span className="text-[10px] font-mono uppercase tracking-[0.15em] text-slate-400 group-hover:text-indigo-500 transition-colors">
            ← Previous
          </span>
          <span className="text-[13px] font-semibold text-slate-600 group-hover:text-slate-900 transition-colors">
            {prev.label}
          </span>
        </Link>
      ) : (
        <div />
      )}
      {next ? (
        <Link href={`/docs/${next.slug}`} className="group flex flex-col items-end gap-1">
          <span className="text-[10px] font-mono uppercase tracking-[0.15em] text-slate-400 group-hover:text-indigo-500 transition-colors">
            Next →
          </span>
          <span className="text-[13px] font-semibold text-slate-600 group-hover:text-slate-900 transition-colors">
            {next.label}
          </span>
        </Link>
      ) : (
        <div />
      )}
    </div>
  );
}

// ── Doc layout shell ──────────────────────────────────────────────────────────
export function DocsShell({
  children,
  currentSlug,
}: {
  children: React.ReactNode;
  currentSlug: string;
}) {
  return (
    <div className="w-full flex-1 flex flex-col bg-white overflow-x-hidden">
      {/* Top nav */}
      <header className="sticky top-0 z-50 h-16 bg-white/95 backdrop-blur-xl border-b border-slate-100 flex items-center px-6">
        <div className="w-full max-w-[1200px] mx-auto flex items-center justify-between gap-8">
          <Link href="/" className="flex items-center gap-2.5">
            <img
              src="/worldmap.png"
              alt="Humanity Ledger"
              style={{ height: 22, width: 'auto', objectFit: 'contain' }}
            />
            <span style={{ fontSize: 15, fontWeight: 700, color: '#050505', fontFamily: 'system-ui, -apple-system, sans-serif', letterSpacing: '-0.02em' }}>Humanity</span>
            <span className="text-slate-300">/</span>
            <span className="text-[13px] font-medium text-slate-400">Docs</span>
          </Link>
          <div className="flex items-center gap-4">
            <Link href="/developers" className="text-[12px] font-medium text-slate-400 hover:text-slate-900 transition-colors hidden sm:block">
              Developer Hub
            </Link>
            <Link
              href="/portfolio"
              className="px-4 py-2 bg-indigo-600 text-white rounded-full text-[12px] font-semibold hover:bg-indigo-700 transition-colors shadow-lg shadow-indigo-500/25"
            >
              Launch App
            </Link>
          </div>
        </div>
      </header>

      {/* Body */}
      <div className="max-w-[1200px] mx-auto flex">
        <DocsSidebar currentSlug={currentSlug} />
        <main className="min-w-0 flex-1 px-6 md:px-12 py-16">
          <div className="max-w-[720px] mx-auto">
            {children}
            <DocsPrevNext currentSlug={currentSlug} />
          </div>
        </main>
      </div>
    </div>
  );
}

// ── Prose atoms ───────────────────────────────────────────────────────────────
export function DocTag({ children }: { children: React.ReactNode }) {
  return (
    <div className="mb-3 text-[10px] font-mono uppercase tracking-[0.2em] text-indigo-500">
      {children}
    </div>
  );
}

export function DocH1({ children }: { children: React.ReactNode }) {
  return (
    <h1
      className="font-bold text-slate-900 leading-[1.1] tracking-tight mb-4"
      style={{ fontSize: "clamp(2rem, 5vw, 2.75rem)" }}
    >
      {children}
    </h1>
  );
}

export function DocH2({ children, id }: { children: React.ReactNode; id?: string }) {
  return (
    <h2 id={id} className="text-[22px] font-bold text-slate-900 tracking-tight mt-16 mb-5 scroll-mt-24">
      {children}
    </h2>
  );
}

export function DocH3({ children }: { children: React.ReactNode }) {
  return (
    <h3 className="text-[17px] font-semibold text-slate-800 mt-10 mb-4">
      {children}
    </h3>
  );
}

export function DocP({ children }: { children: React.ReactNode }) {
  return (
    <p className="text-[15px] text-slate-600 leading-[1.8] mb-5">
      {children}
    </p>
  );
}

export function DocCallout({
  type = "note",
  title,
  children,
}: {
  type?: "note" | "key" | "warning";
  title: string;
  children: React.ReactNode;
}) {
  const styles = {
    note: "border-indigo-200 bg-indigo-50/60 text-indigo-500",
    key: "border-amber-200 bg-amber-50/60 text-amber-600",
    warning: "border-red-200 bg-red-50/60 text-red-500",
  };
  return (
    <div className={`my-8 p-5 rounded-2xl border ${styles[type]}`}>
      <div className="text-[10px] font-black uppercase tracking-[0.2em] font-mono mb-2">{title}</div>
      <div className="text-[13px] text-slate-600 leading-relaxed">{children}</div>
    </div>
  );
}

export function DocTable({
  headers,
  rows,
}: {
  headers: string[];
  rows: string[][];
}) {
  return (
    <div className="my-8 overflow-x-auto rounded-2xl border border-slate-200">
      <table className="w-full text-[13px]">
        <thead>
          <tr className="border-b border-slate-200 bg-slate-50">
            {headers.map((h) => (
              <th key={h} className="px-4 py-3 text-left font-semibold text-slate-500 text-[11px] uppercase tracking-wider">
                {h}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((row, i) => (
            <tr key={i} className={i < rows.length - 1 ? "border-b border-slate-100" : ""}>
              {row.map((cell, j) => (
                <td key={j} className={`px-4 py-3 ${j === 0 ? "font-semibold text-slate-800" : "text-slate-500"}`}>
                  {cell}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

export function DocOrderedList({ items }: { items: { title: string; desc: string }[] }) {
  return (
    <ol className="my-5 flex flex-col gap-4">
      {items.map((item, i) => (
        <li key={i} className="flex gap-4">
          <div className="w-6 h-6 rounded-full bg-indigo-100 text-indigo-700 flex items-center justify-center text-[10px] font-black flex-shrink-0 mt-0.5">
            {i + 1}
          </div>
          <div>
            <strong className="text-[14px] font-semibold text-slate-800">{item.title}</strong>
            <p className="text-[13px] text-slate-500 leading-relaxed mt-0.5">{item.desc}</p>
          </div>
        </li>
      ))}
    </ol>
  );
}
