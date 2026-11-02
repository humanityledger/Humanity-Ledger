import React from "react";
import Link from "next/link";
import { NAV } from "@/lib/docs/registry";
import s from "./Docs.module.css";

/**
 * The sidebar navigation. Used in the desktop sidebar and in the drawer on
 * narrow screens, so it has no state of its own: the current page is passed in.
 */
export function DocsNav({ current, onNavigate }: { current: string; onNavigate?: () => void }) {
  return (
    <nav className={s.nav} aria-label="Documentation">
      {NAV.map((group) => (
        <div key={group.title} className={s.navGroup}>
          <p className={s.navTitle}>{group.title}</p>
          <ul className={s.navList}>
            {group.pages.map((page) => {
              const active = page.href === current;
              return (
                <li key={page.href}>
                  <Link
                    href={page.href}
                    className={`${s.navLink} ${active ? s.navLinkActive : ""}`}
                    aria-current={active ? "page" : undefined}
                    onClick={onNavigate}
                  >
                    {page.label}
                  </Link>
                </li>
              );
            })}
          </ul>
        </div>
      ))}
    </nav>
  );
}
