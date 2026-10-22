/**
 * lib/docs/types.ts
 *
 * The shape of every page in the documentation site.
 *
 * Pages are data, not JSX. That keeps three things in step without anyone
 * having to remember: the rendered page, the "On this page" list (built from
 * the h2 and h3 blocks) and the search index (built from all of the text).
 *
 * Text fields accept a very small inline syntax, parsed by
 * components/docs/v2/inline.tsx:
 *
 *   **bold**            strong emphasis
 *   `code`              inline code
 *   [label](/path)      a link; internal paths use next/link
 *
 * Writing rules for anything that goes in here (see CLAUDE.md):
 *   - Sentence case for headings. No text in capitals.
 *   - No em dashes, en dashes or middle dots between words.
 *   - Say what is true today. If a feature is not finished, say so plainly.
 */

export type HintTone = "info" | "warning" | "danger" | "success";

export type FeatureState = "available" | "partial" | "development" | "unavailable";

export type FigureKind = "architecture" | "message-path";

export type IconName =
  | "message"
  | "users"
  | "phone"
  | "wallet"
  | "shield"
  | "lock"
  | "key"
  | "code"
  | "book"
  | "rocket"
  | "smartphone"
  | "server"
  | "mail"
  | "github"
  | "linkedin"
  | "bug"
  | "file"
  | "activity";

export type Block =
  | { t: "p"; text: string }
  | { t: "h2"; text: string; id?: string }
  | { t: "h3"; text: string; id?: string }
  | { t: "ul"; items: string[] }
  | { t: "ol"; items: string[] }
  | { t: "steps"; items: { title: string; text: string }[] }
  | { t: "table"; head: string[]; rows: string[][]; strongFirst?: boolean }
  | { t: "hint"; tone: HintTone; title?: string; text: string }
  | { t: "code"; label?: string; code: string }
  | { t: "defs"; items: { term: string; text: string }[] }
  | { t: "cards"; items: { title: string; text: string; href: string; icon: IconName; external?: boolean }[] }
  | { t: "status"; items: { label: string; state: FeatureState; text: string }[] }
  | { t: "figure"; kind: FigureKind; caption: string }
  | { t: "person"; name: string; role: string; photo?: string; links: { label: string; href: string }[] };

export interface DocPage {
  /** Stable key. For /docs/* pages it is also the URL segment. */
  slug: string;
  /** Where the page lives. */
  href: string;
  /** Sidebar label. Short. */
  label: string;
  /** Page heading. Defaults to the label. */
  title?: string;
  /** One sentence under the title, also shown in search results. */
  summary: string;
  /** Words a reader might type who does not know the page title. */
  keywords?: string[];
  /** ISO date of the last substantive review. */
  updated: string;
  blocks: Block[];
}

export interface NavGroup {
  title: string;
  pages: DocPage[];
}
