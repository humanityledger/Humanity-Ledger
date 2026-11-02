/**
 * lib/constants/links.ts
 *
 * Every external link the product points at, in one place.
 *
 * Scattered literals are how a site ends up with three different GitHub URLs,
 * two of which 404. Import from here; never paste a URL into a component.
 *
 * A link that does not exist yet does not get a placeholder. `null` means the
 * destination is not live, and components are expected to render that as an
 * absent link rather than one that goes nowhere — an App Store badge pointing
 * at "#" tells a visitor the site is unmaintained (CLAUDE.md §4).
 */

export const EXTERNAL_LINKS = {
  github: {
    org: "https://github.com/humanityledger",
    repo: "https://github.com/humanityledger/Humanity-Ledger",
    issues: "https://github.com/humanityledger/Humanity-Ledger/issues",
    security: "https://github.com/humanityledger/Humanity-Ledger/security/policy",
    releases: "https://github.com/humanityledger/Humanity-Ledger/releases",
  },
  linkedin: "https://es.linkedin.com/company/humanity-ledger",
  aztec: "https://aztec.network",
  xmtp: "https://xmtp.org",
  email: "mailto:humanityledger@icloud.com",
} as const;

/** Store listings. Null until a binary has actually been submitted and accepted. */
export const APP_STORES = {
  ios: null as string | null,
  android: null as string | null,
} as const;

export const INTERNAL_LINKS = {
  chat: "/chat",
  connect: "/connect",
  docs: "/docs/overview",
  whitepaper: "/docs/whitepaper",
  audits: "/docs/audits",
  developers: "/developers",
  privacy: "/docs/privacy",
  terms: "/docs/terms",
  support: "/contact",
  status: "/status",
  blog: "/blog",
  company: "/company",
  changelog: "/changelog",
  contact: "/contact",
} as const;
