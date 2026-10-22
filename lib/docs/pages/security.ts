import type { DocPage } from "../types";

export const securityModel: DocPage = {
  slug: "security-model",
  href: "/docs/security-model",
  label: "Security model",
  summary: "What Ledger Chat protects you from, what it does not, and what you can do yourself.",
  keywords: ["security", "threat model", "safety", "protect", "hack", "breach", "attack", "risk", "trust"],
  updated: "2026-10-21",
  blocks: [
    {
      t: "p",
      text: "No product protects against everything. This page explains, in plain terms, which risks Ledger Chat is designed to handle and which ones remain your responsibility or are still open.",
    },
    { t: "h2", text: "What we protect against" },
    {
      t: "table",
      head: ["Risk", "How Ledger Chat handles it"],
      strongFirst: true,
      rows: [
        ["Someone reading your direct messages on the way", "Messages are encrypted on your device and only decrypted on the recipient's."],
        ["Our own servers being breached", "Direct messages delivered through XMTP are not on our servers in readable form. Your PIN is stored only as an Argon2id hash."],
        ["Someone pretending to be you", "Signing in needs a signature from your wallet. Our servers ignore any identity the browser claims that is not backed by a valid session."],
        ["Password leaks and SIM swaps", "There is no password to leak and no phone number to steal."],
        ["Someone opening the app on your unlocked device", "The PIN blocks the app until it is entered."],
      ],
    },
    { t: "h2", text: "What we do not protect against yet" },
    {
      t: "ul",
      items: [
        "**Messages sent through the fallback path**, community posts and attachments can be read by our servers. See [Encryption](/docs/cryptography) for the full list.",
        "**Metadata.** Our servers know who your contacts are, which communities you belong to and when you are online. XMTP nodes can see when encrypted messages are sent.",
        "**Your IP address in calls**, unless you turn on the setting that relays every call.",
      ],
    },
    { t: "h2", text: "What no messenger can protect against" },
    {
      t: "ul",
      items: [
        "Malware on your device, which can see whatever you see.",
        "A person you are talking to who saves or shares what you send.",
        "Someone who has your wallet's recovery phrase. They are you, as far as any system can tell.",
      ],
    },
    { t: "h2", text: "What you can do" },
    {
      t: "steps",
      items: [
        { title: "Protect your recovery phrase", text: "Write it down, keep it offline, and never type it into a website or a chat." },
        { title: "Check what you sign", text: "A sign in message for Ledger Chat names this website. A message for any other domain, or a request to approve a transaction, is not our sign in." },
        { title: "Watch for the label", text: "If a message is marked **Not end to end encrypted**, treat it like an email: fine for most things, not for secrets." },
        { title: "Lock your devices", text: "Use a screen lock on every device where you use Ledger Chat, and a PIN that is not easy to guess." },
      ],
    },
  ],
};

export const audits: DocPage = {
  slug: "audits",
  href: "/docs/audits",
  label: "Audits and findings",
  title: "Security audits and open findings",
  summary: "Which reviews have taken place, what they found, what has been fixed and what is still open.",
  keywords: ["audit", "security", "pentest", "penetration test", "review", "findings", "vulnerability", "report", "fixed", "open issues"],
  updated: "2026-10-21",
  blocks: [
    { t: "h2", text: "Independent reviews" },
    {
      t: "status",
      items: [
        { label: "Smart contract audit", state: "unavailable", text: "No independent firm has reviewed our contracts yet." },
        { label: "Application penetration test", state: "unavailable", text: "Not carried out yet." },
        { label: "Internal code review", state: "available", text: "Completed in October 2026. Results below." },
      ],
    },
    {
      t: "p",
      text: "When an independent report is published, it will be linked here in full, including any findings we disagree with.",
    },
    { t: "h2", text: "Internal review, October 2026" },
    {
      t: "p",
      text: "The review read the code that handles identity, sessions, messages and private balances, rather than relying on documentation. Findings are described here by their effect on you. Technical detail lives in the repository.",
    },
    { t: "h3", text: "Fixed" },
    {
      t: "table",
      head: ["Finding", "Effect before the fix"],
      strongFirst: true,
      rows: [
        ["Identity taken from request headers", "Some routes trusted an address sent by the browser. Every route now reads identity only from the verified session."],
        ["Shielded balance readable by address", "Anyone could query the private balance of any address. The endpoint now answers only for the signed in account."],
        ["Public route matching too broad", "A route whose name began like a public one was treated as public. Matching now respects path boundaries."],
        ["Cross site requests", "State changing requests from other websites were not reliably refused. They now are."],
        ["Sign in nonce", "The nonce could be chosen by the browser. It is now issued and checked by the server."],
        ["PIN check failing for everyone", "A bug made every PIN check fail after the PIN was set. Verification now works as intended."],
        ["Session token algorithm", "One path accepted tokens without fixing the signing algorithm. It is now fixed to HMAC-SHA256."],
      ],
    },
    { t: "h3", text: "Open" },
    {
      t: "table",
      head: ["Finding", "Effect today", "Status"],
      strongFirst: true,
      rows: [
        ["Readable fallback messages", "Messages that fail XMTP delivery are stored readable on our server.", "Labelled in the chat. Server side rejection is ready and waits for client side sealing."],
        ["Community content", "Posts and channel messages are stored readable on our server.", "Documented. Encryption not started."],
        ["Attachments", "Files are stored as uploaded and can be opened by anyone with the link.", "Documented. Encryption not started."],
        ["Session cookies", "Two cookie names carry the same session while older code is migrated.", "In progress."],
        ["Dependencies", "Some third party packages have published advisories.", "Being upgraded in order of severity."],
      ],
    },
    {
      t: "hint",
      tone: "info",
      text: "Found something that is not on this list? Please tell us privately first. See [Report a vulnerability](/docs/bug-bounty).",
    },
  ],
};

export const bugBounty: DocPage = {
  slug: "bug-bounty",
  href: "/docs/bug-bounty",
  label: "Report a vulnerability",
  summary: "How to tell us about a security problem privately, and what happens after you do.",
  keywords: ["bounty", "bug", "report", "disclosure", "vulnerability", "responsible disclosure", "security contact", "cve"],
  updated: "2026-10-21",
  blocks: [
    {
      t: "p",
      text: "If you believe you have found a security problem in Humanity Ledger or Ledger Chat, we want to hear about it before anyone else does.",
    },
    { t: "h2", text: "How to report" },
    {
      t: "steps",
      items: [
        { title: "Use a private channel", text: "Report through [GitHub private vulnerability reporting](https://github.com/humanityledger/Humanity-Ledger/security/policy), or email [humanityledger@icloud.com](mailto:humanityledger@icloud.com). Please do not open a public issue." },
        { title: "Tell us how to reproduce it", text: "The affected page or endpoint, the steps you took, what you expected and what happened. A short proof of concept helps." },
        { title: "Give us time to fix it", text: "Please keep the details private until a fix is released or until we have agreed a date with you." },
      ],
    },
    { t: "h2", text: "What you can expect from us" },
    {
      t: "ul",
      items: [
        "A reply confirming we have your report.",
        "Updates while we investigate and fix it.",
        "Credit in the [changelog](/changelog) and on the [audits page](/docs/audits), if you would like it.",
      ],
    },
    { t: "h2", text: "Guidelines" },
    {
      t: "ul",
      items: [
        "Test only against accounts you own or have permission to use.",
        "Do not access, change or delete other people's data, and stop as soon as you see data that is not yours.",
        "Do not run tests that degrade the service for others, such as load or spam tests.",
      ],
    },
    {
      t: "hint",
      tone: "info",
      text: "We do not run a paid bounty programme yet. If that changes, this page will say so first.",
    },
  ],
};
