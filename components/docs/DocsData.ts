/**
 * Documentation index.
 *
 * `keywords` exists for search. A reader looking for "how do I recover my
 * account" does not know the page is called "Digital Identity (DID)", and a
 * search that only matches titles fails exactly the people who need it most —
 * the ones who do not yet know the vocabulary. Add the words a confused
 * newcomer would type, not the words an engineer would file it under.
 *
 * `summary` is shown under the title in search results and belongs at the top
 * of the page itself (CLAUDE.md §3). One sentence, stating what the page
 * answers.
 */

export interface DocItem {
  slug: string;
  label: string;
  summary: string;
  keywords: string[];
}

export interface DocSection {
  group: string;
  items: DocItem[];
}

export const DOC_SECTIONS: DocSection[] = [
  {
    group: "Getting Started",
    items: [
      {
        slug: "overview",
        label: "Platform Overview",
        summary: "What Humanity Ledger is, what ships today, and what does not.",
        keywords: ["intro", "introduction", "start", "what is", "begin", "about", "first"],
      },
      {
        slug: "identity",
        label: "Digital Identity (DID)",
        summary: "How a wallet becomes an account, and what that costs you if you lose it.",
        keywords: ["wallet", "login", "sign in", "account", "recovery", "lost", "seed phrase", "did", "siwe", "metamask"],
      },
      {
        slug: "app-hub",
        label: "App Hub",
        summary: "The applications built on the protocol and how they share one identity.",
        keywords: ["apps", "applications", "ecosystem", "modules"],
      },
    ],
  },
  {
    group: "Ledger Chat",
    items: [
      {
        slug: "ledger-chat",
        label: "Introduction",
        summary: "The messenger: what is encrypted, what is not, and how to tell them apart.",
        keywords: ["chat", "messaging", "messages", "dm", "encryption", "e2ee", "xmtp", "mls"],
      },
      {
        slug: "p2p-routing",
        label: "Secure P2P Routing",
        summary: "How a message reaches its recipient, and what the server sees on the way.",
        keywords: ["routing", "relay", "p2p", "peer", "delivery", "offline", "fallback"],
      },
    ],
  },
  {
    group: "Protocol & Architecture",
    items: [
      {
        slug: "architecture",
        label: "Architecture Overview",
        summary: "The components of the system and the boundaries between them.",
        keywords: ["architecture", "system", "design", "diagram", "stack", "infrastructure"],
      },
      {
        slug: "cryptography",
        label: "Encryption Systems",
        summary: "The primitives in use, where each one applies, and where none does yet.",
        keywords: ["crypto", "cryptography", "encryption", "keys", "cipher", "aes", "argon2", "signature"],
      },
      {
        slug: "zero-knowledge",
        label: "Zero-Knowledge Privacy",
        summary: "Shielded transfers on Aztec: what stays private and what does not.",
        keywords: ["zk", "zero knowledge", "aztec", "shielded", "private", "proof", "noir", "payments"],
      },
    ],
  },
  {
    group: "Security & Audits",
    items: [
      {
        slug: "audits",
        label: "Security Audits",
        summary: "Which reviews have been completed, which have not, and the open findings.",
        keywords: ["audit", "security", "pentest", "review", "findings", "vulnerability", "report"],
      },
      {
        slug: "bug-bounty",
        label: "Bug Bounty",
        summary: "How to report a vulnerability and what happens after you do.",
        keywords: ["bounty", "bug", "report", "disclosure", "vulnerability", "responsible"],
      },
      {
        slug: "transparency",
        label: "Transparency Report",
        summary: "Requests received from authorities and what was handed over.",
        keywords: ["transparency", "legal requests", "subpoena", "government", "data requests"],
      },
    ],
  },
  {
    group: "Legal & Compliance",
    items: [
      {
        slug: "terms",
        label: "Terms of Service",
        summary: "The agreement between you and Humanity Ledger.",
        keywords: ["terms", "tos", "agreement", "legal", "conditions"],
      },
      {
        slug: "privacy",
        label: "Privacy Policy",
        summary: "What data exists, where it lives, and how long it stays.",
        keywords: ["privacy", "data", "gdpr", "retention", "personal data", "cookies", "tracking"],
      },
      {
        slug: "cookies",
        label: "Cookie Policy",
        summary: "Which cookies are set and what each one is for.",
        keywords: ["cookies", "storage", "session", "tracking"],
      },
      {
        slug: "aml-kyc",
        label: "AML & KYC Framework",
        summary: "When identity verification applies and when it does not.",
        keywords: ["aml", "kyc", "compliance", "verification", "identity check", "regulation"],
      },
      {
        slug: "disclaimer",
        label: "Risk Disclaimer",
        summary: "What can go wrong with unaudited contracts and an alpha network.",
        keywords: ["risk", "disclaimer", "warning", "loss", "funds", "liability"],
      },
    ],
  },
  {
    group: "Developers",
    items: [
      {
        slug: "changelog",
        label: "Changelog",
        summary: "What shipped, when, and what broke.",
        keywords: ["changelog", "releases", "updates", "versions", "history"],
      },
    ],
  },
];

export const ALL_DOC_SLUGS = DOC_SECTIONS.flatMap((s) =>
  s.items.map((i) => ({ ...i, group: s.group })),
);

export type DocEntry = (typeof ALL_DOC_SLUGS)[number];
