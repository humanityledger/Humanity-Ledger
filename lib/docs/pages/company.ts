import type { DocPage } from "../types";

export const about: DocPage = {
  slug: "about",
  href: "/company",
  label: "About",
  title: "About Humanity Ledger",
  summary: "Who we are, what we are building and how we work.",
  keywords: ["about", "company", "team", "founder", "mission", "who", "humanity ledger s.l.", "ceo"],
  updated: "2026-10-21",
  blocks: [
    {
      t: "p",
      text: "Humanity Ledger S.L. builds communication tools that people can use without handing over a phone number, and without trusting a company to keep their conversations private. Our first application is **Ledger Chat**.",
    },
    { t: "h2", text: "Why we exist" },
    {
      t: "p",
      text: "Most messengers tie your identity to a phone number and are paid for, one way or another, by what they learn about you. A wallet is a better foundation: you already hold it, nobody can take it from you, and it can sign, pay and prove things without a middleman. We are building the messenger that starts from there.",
    },
    { t: "h2", text: "How we work" },
    {
      t: "defs",
      items: [
        { term: "We say what is true today", text: "If a feature is not finished, or not encrypted, the app and the documentation say so. We would rather lose a comparison than win it with a claim we cannot back." },
        { term: "We publish our findings", text: "Security problems we find are listed on the [audits page](/docs/audits), including the ones that are still open." },
        { term: "You hold the keys", text: "We never take custody of funds or of keys that can move them." },
        { term: "No advertising", text: "We do not sell data and we do not show ads." },
        { term: "Open source", text: "The code is on [GitHub](https://github.com/humanityledger/Humanity-Ledger), so anyone can check what it does." },
      ],
    },
    { t: "h2", text: "Leadership" },
    {
      t: "person",
      name: "Stefan Antonio Cirisanu",
      role: "Founder and chief executive",
      links: [{ label: "LinkedIn", href: "https://www.linkedin.com/in/stefan-antonio-cirisanu-40116140b/" }],
    },
    { t: "h2", text: "Find us" },
    {
      t: "cards",
      items: [
        { title: "LinkedIn", text: "Company news and hiring.", href: "https://es.linkedin.com/company/humanity-ledger", icon: "linkedin", external: true },
        { title: "GitHub", text: "Source code, issues and releases.", href: "https://github.com/humanityledger/Humanity-Ledger", icon: "github", external: true },
        { title: "Contact", text: "Questions, press and partnerships.", href: "/contact", icon: "mail" },
        { title: "Blog", text: "How the product works and why.", href: "/blog", icon: "book" },
      ],
    },
  ],
};

export const contact: DocPage = {
  slug: "contact",
  href: "/contact",
  label: "Contact",
  title: "Contact us",
  summary: "The right place for each kind of question, so it reaches the right person.",
  keywords: ["contact", "email", "support", "help", "press", "partnership", "reach", "talk"],
  updated: "2026-10-21",
  blocks: [
    {
      t: "cards",
      items: [
        { title: "General questions", text: "Account help, partnerships and press. humanityledger@icloud.com", href: "mailto:humanityledger@icloud.com", icon: "mail", external: true },
        { title: "Report a bug", text: "Something is not working as it should. Open an issue on GitHub.", href: "https://github.com/humanityledger/Humanity-Ledger/issues", icon: "bug", external: true },
        { title: "Report a vulnerability", text: "A security problem. Please report it privately.", href: "/docs/bug-bounty", icon: "shield" },
        { title: "Privacy requests", text: "Access, correction or deletion of your data.", href: "/docs/privacy", icon: "file" },
      ],
    },
    { t: "h2", text: "Before you write" },
    {
      t: "ul",
      items: [
        "We will never ask for your recovery phrase, your private key or your PIN. Do not include them in any message.",
        "For account questions, write from the email address linked to your account, or include your wallet address. Never send a screenshot of your wallet's secret words.",
        "Many answers are already in the [documentation](/docs/overview). Try the search at the top of this page.",
      ],
    },
  ],
};

export const status: DocPage = {
  slug: "status",
  href: "/status",
  label: "Status",
  title: "Service status",
  summary: "A live check of our servers, run from your browser when you open this page.",
  keywords: ["status", "uptime", "down", "outage", "incident", "health", "working", "operational"],
  updated: "2026-10-21",
  blocks: [
    { t: "h2", text: "About this page" },
    {
      t: "ul",
      items: [
        "The check above calls our health endpoint directly from your browser. It reflects what you can reach right now, not an average.",
        "We do not publish uptime history yet. When we do, it will appear here.",
        "Services run by others, such as XMTP and the blockchains, are not monitored on this page.",
      ],
    },
    {
      t: "p",
      text: "If something is broken and it is not shown here, please [open an issue](https://github.com/humanityledger/Humanity-Ledger/issues).",
    },
  ],
};

export interface BlogPost {
  slug: string;
  title: string;
  date: string;
  summary: string;
  page: DocPage;
}

const walletPost: DocPage = {
  slug: "why-your-wallet-is-your-account",
  href: "/blog/why-your-wallet-is-your-account",
  label: "Why your wallet is your account",
  summary: "Phone numbers were never meant to be identities. Wallets were.",
  keywords: ["blog", "wallet", "identity", "phone number", "account"],
  updated: "2026-10-21",
  blocks: [
    {
      t: "p",
      text: "Almost every messenger you use asks for a phone number. It is convenient: everyone has one, and it doubles as a way to find your friends. But a phone number was never designed to be an identity, and it shows.",
    },
    { t: "h2", text: "The trouble with phone numbers" },
    {
      t: "ul",
      items: [
        "Your carrier controls it. A convincing call to the right support desk can move it to someone else's SIM card.",
        "It is not private. A phone number links to your name, your address and every other service that has it.",
        "It changes. Move country or switch plans, and your identity goes with the old number.",
      ],
    },
    { t: "h2", text: "What a wallet does differently" },
    {
      t: "p",
      text: "A wallet is a key pair that you generate and keep. Nobody issues it to you, so nobody can take it back. It can prove that a message came from you by signing it, which is exactly what signing in to Ledger Chat does. And it can pay, which turns a conversation into a place where things get settled.",
    },
    { t: "h2", text: "What it costs you" },
    {
      t: "p",
      text: "There is a real trade off. If you lose your recovery phrase, nobody can reset it for you, including us. We think that is worth it, but we would rather you choose it knowing, so we say it plainly on the [sign in page](/connect) and in the [documentation](/docs/identity).",
    },
  ],
};

const encryptionPost: DocPage = {
  slug: "what-encryption-covers-today",
  href: "/blog/what-encryption-covers-today",
  label: "What encryption covers in Ledger Chat today",
  summary: "An honest map of what is encrypted end to end, what is not yet, and how the app tells you.",
  keywords: ["blog", "encryption", "e2ee", "fallback", "communities", "attachments", "honesty"],
  updated: "2026-10-21",
  blocks: [
    {
      t: "p",
      text: "Messaging apps tend to say they are encrypted and leave it there. The truth is usually more detailed, and the details are what matter when you decide what to send. Here is ours.",
    },
    { t: "h2", text: "Encrypted end to end" },
    {
      t: "p",
      text: "Direct messages delivered through XMTP. They are encrypted on your device with MLS, an IETF standard, and only the devices in the conversation can read them. Our servers never see them in readable form.",
    },
    { t: "h2", text: "Not encrypted end to end yet" },
    {
      t: "ul",
      items: [
        "**Fallback messages.** When XMTP cannot deliver a message, the app can send it through our server instead. Those messages carry a label in the conversation.",
        "**Communities.** Posts and channel messages are stored on our server.",
        "**Attachments.** Files are stored as uploaded.",
      ],
    },
    { t: "h2", text: "Why say this out loud" },
    {
      t: "p",
      text: "Because you can only make a good decision about what to send if you know where it goes. A label on the message is more useful than a promise on a landing page. Each of these gaps is listed on our [audits page](/docs/audits), and each will be removed from this list when it is closed.",
    },
  ],
};

export const BLOG_POSTS: BlogPost[] = [
  { slug: encryptionPost.slug, title: encryptionPost.label, date: "2026-10-21", summary: encryptionPost.summary, page: encryptionPost },
  { slug: walletPost.slug, title: walletPost.label, date: "2026-10-21", summary: walletPost.summary, page: walletPost },
];

export const blog: DocPage = {
  slug: "blog",
  href: "/blog",
  label: "Blog",
  summary: "How Ledger Chat works, why we made the choices we made, and what changed.",
  keywords: ["blog", "news", "articles", "posts", "updates"],
  updated: "2026-10-21",
  blocks: [],
};
