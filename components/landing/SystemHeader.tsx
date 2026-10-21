"use client";

import React, { useState, useEffect } from "react";
import Link from "next/link";

interface NavItem {
  label: string;
  href: string;
  isExternal?: boolean;
}

const NAV_ITEMS: NavItem[] = [];

function HLLogo() {
  return (
    <Link href="/" className="flex items-center gap-2.5 group" aria-label="Humanity Ledger — Home">
      {/* World map logo — the authentic Humanity Ledger mark */}
      <img
        src="/worldmap.png"
        alt="World map"
        width={34}
        height={22}
        style={{
          objectFit: 'contain',
          filter: 'none',
        }}
        className="pointer-events-none select-none transition-opacity duration-300 group-hover:opacity-75"
      />
      <span className="font-sans text-[17px] font-bold tracking-tight text-[#1a1a1a] group-hover:text-black/70 transition-colors duration-200">
        Humanity
      </span>
    </Link>
  );
}

export function SystemHeader() {
  const [scrolled, setScrolled] = useState(false);

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 20);
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  return (
    <header
      className={[
        "fixed top-0 left-0 right-0 z-50 transition-all duration-500",
        scrolled
          ? "bg-white/90 backdrop-blur-xl border-b border-black/[0.06] shadow-sm"
          : "bg-white/70 backdrop-blur-md border-b border-black/[0.04]",
      ].join(" ")}
    >
      <div className="w-full max-w-[1400px] mx-auto px-6 md:px-10 h-[72px] flex items-center justify-between">
        <HLLogo />

        <nav className="hidden md:flex items-center gap-8" aria-label="Primary navigation">
          {NAV_ITEMS.map((item) => (
            <Link
              key={item.href}
              href={item.href}
              target={item.isExternal ? "_blank" : undefined}
              rel={item.isExternal ? "noopener noreferrer" : undefined}
              className="font-sans text-[12px] font-bold uppercase tracking-widest text-black/50 hover:text-black transition-colors duration-200 relative group"
            >
              {item.label}
              <span className="absolute -bottom-0.5 left-0 w-0 h-px bg-black group-hover:w-full transition-all duration-300" />
            </Link>
          ))}
        </nav>

        <div className="flex items-center gap-3">
          <Link
            href="/"
            className="hidden md:inline-flex items-center justify-center px-5 py-2.5 rounded-xl bg-black text-white font-black text-[11px] uppercase tracking-widest hover:bg-black/80 transition-all duration-200 active:scale-95"
          >
            Open App
          </Link>
        </div>
      </div>
    </header>
  );
}
