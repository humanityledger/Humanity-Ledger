import type { DocPage } from "../types";

/**
 * The changelog is written from the repository history, in plain language.
 * Each entry describes the effect on someone using the product, not the
 * internal change. Superlatives from commit messages are left out.
 */

export type ChangeKind = "new" | "improved" | "fixed" | "security";

export interface ChangeEntry {
  kind: ChangeKind;
  text: string;
}

export interface Release {
  id: string;
  title: string;
  date?: string;
  note?: string;
  changes: ChangeEntry[];
}

export const RELEASES: Release[] = [
  {
    id: "unreleased",
    title: "Not yet released",
    note: "In the repository, waiting for the next deployment.",
    changes: [
      { kind: "new", text: "A legal notice, and a content and copyright page explaining how to report illegal content and how our code is licensed." },
      { kind: "improved", text: "Terms, Privacy Policy, Cookie Policy and risk disclosure rewritten to match the code: who provides the service, every cookie we set, and what the private payments wallet can and cannot do." },
      { kind: "improved", text: "Older pages that described a token, open source licensing or guarantees the product does not offer now lead to the matching documentation page." },
      { kind: "security", text: "Every route that sold, credited, airdropped or transferred Quantum Dots (QD) now refuses all requests. Humanity Ledger has no token, and the in app screen that took ETH for QD has been removed." },
      { kind: "new", text: "A redesigned home page, sign in page and documentation site, with search across every page." },
      { kind: "new", text: "Documentation rewritten to describe the product as it works today, including the findings that are still open." },
      { kind: "security", text: "Signing in now follows EIP-4361 throughout, with a nonce issued and checked by the server." },
      { kind: "security", text: "Requests that change data are refused unless they come from our own website." },
      { kind: "security", text: "Session tokens are only accepted with the expected signing algorithm." },
      { kind: "security", text: "The private balance endpoint now answers only for the account that is signed in." },
      { kind: "security", text: "The server no longer records the content of fallback messages in its logs, and can be set to refuse them." },
      { kind: "fixed", text: "Checking a PIN failed for every account after it was set. It now works." },
      { kind: "fixed", text: "Signing in no longer fails when the cache is unavailable." },
    ],
  },
  {
    id: "2026-10-21",
    title: "21 October 2026",
    date: "2026-10-21",
    changes: [
      { kind: "improved", text: "Online status is kept in the cache with an expiry instead of being written to the database, which removes a database write every time someone comes online." },
    ],
  },
  {
    id: "2026-10-19",
    title: "19 October 2026",
    date: "2026-10-19",
    changes: [
      { kind: "new", text: "Group calls inside communities." },
      { kind: "improved", text: "One light theme across the whole app. Dark mode has been removed." },
      { kind: "improved", text: "Aztec libraries upgraded to the V6 release." },
      { kind: "fixed", text: "Signing in with a six digit PIN." },
      { kind: "fixed", text: "Calls that did not end when you pressed hang up." },
      { kind: "security", text: "A set of fixes to how every route identifies the person making a request." },
    ],
  },
  {
    id: "2026-10-15",
    title: "15 October 2026",
    date: "2026-10-15",
    changes: [
      { kind: "improved", text: "Redesigned screens for private payments." },
      { kind: "improved", text: "Deposits into a private balance are sent from your own wallet." },
    ],
  },
  {
    id: "2026-10-14",
    title: "14 October 2026",
    date: "2026-10-14",
    changes: [
      { kind: "new", text: "Experimental streaming payments and invoices inside a conversation." },
      { kind: "fixed", text: "Linking a device with a QR code." },
      { kind: "fixed", text: "New community posts appear immediately for the person who wrote them." },
      { kind: "security", text: "Rich text in community posts is cleaned before it is shown, to prevent script injection." },
      { kind: "security", text: "A device link code can no longer be used twice." },
      { kind: "security", text: "Stronger checks against spending the same private note twice." },
    ],
  },
  {
    id: "2026-10-13",
    title: "13 October 2026",
    date: "2026-10-13",
    changes: [
      { kind: "new", text: "A redesigned PIN setup that explains each step." },
      { kind: "fixed", text: "Messages written while you were offline are delivered when you reconnect." },
      { kind: "fixed", text: "The PIN lockout shown in the app now matches the five minutes enforced by the server." },
      { kind: "fixed", text: "The Windows download now serves the real installer." },
    ],
  },
  {
    id: "2026-10-12",
    title: "12 October 2026",
    date: "2026-10-12",
    changes: [
      { kind: "new", text: "Community access by token, proposals, tips for creators and saved messages." },
      { kind: "security", text: "Community invite links are signed, so they cannot be forged." },
      { kind: "security", text: "Removed an administrative shortcut that should not have existed." },
      { kind: "security", text: "Stories can no longer be used to make our server fetch arbitrary addresses." },
    ],
  },
  {
    id: "2026-10-10",
    title: "10 October 2026",
    date: "2026-10-10",
    changes: [
      { kind: "new", text: "Communities rebuilt, with channels, posts, polls, voice notes and settings." },
      { kind: "new", text: "Analytics for community owners." },
      { kind: "new", text: "Notification settings, including do not disturb." },
      { kind: "improved", text: "Redesigned call screens." },
    ],
  },
  {
    id: "2026-10-09",
    title: "9 October 2026",
    date: "2026-10-09",
    changes: [
      { kind: "fixed", text: "Some XMTP messages were sent but never shown to the recipient." },
      { kind: "fixed", text: "Duplicate conversations with the same person." },
      { kind: "security", text: "Fixed database query injection in four endpoints." },
      { kind: "security", text: "Removed a file search from an animation endpoint that could expose server files." },
      { kind: "security", text: "Privacy settings can only be changed by the account they belong to." },
    ],
  },
  {
    id: "2026-10-08",
    title: "8 October 2026",
    date: "2026-10-08",
    changes: [
      { kind: "new", text: "Push notifications, message threads and syncing between your devices." },
      { kind: "security", text: "Third party API keys moved behind our own server so they are no longer sent to browsers." },
      { kind: "improved", text: "The repository was cleaned up, and its description now says beta rather than production." },
    ],
  },
];

export const changelog: DocPage = {
  slug: "changelog",
  href: "/changelog",
  label: "Changelog",
  summary: "What changed in Ledger Chat, newest first, written from the repository history.",
  keywords: ["changelog", "releases", "updates", "versions", "history", "what's new", "release notes"],
  updated: "2026-10-21",
  blocks: [],
};
