import type { DocPage } from "../types";

export const securityModel: DocPage = {
  slug: "security-model",
  href: "/docs/security-model",
  label: "Security model",
  summary: "What Ledger Chat protects you from, what it does not, and what you can do yourself.",
  keywords: ["security", "threat model", "safety", "protect", "hack", "breach", "attack", "risk", "trust"],
  updated: "2026-11-17",
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
        ["Our own servers being breached", "Direct messages delivered through XMTP are not on our servers in readable form. The private wallet's keys never reach our servers; a passkey backup is ciphertext we cannot open."],
        ["Someone pretending to be you", "Signing in needs a signature from your wallet. Our servers ignore any identity the browser claims that is not backed by a valid session."],
        ["Password leaks and SIM swaps", "There is no password to leak and no phone number to steal."],
        ["A private payment going to the wrong person", "Before you pay, Ledger Chat checks a proof that the Aztec address belongs to the person in the conversation. The proof names the network, so an address announced on the test network cannot receive a payment of real value."],
        ["Losing your Ethereum wallet", "A passkey you enrolled opens the same private wallet. Before any key is used, the wallet checks that what the passkey unlocked is your own account."],
        ["A wrong or tampered configuration", "The private wallet refuses an Aztec node on another network. The Ethereum portal, once deployed, turns itself off if a token address is not the official one."],
        ["An incident in progress", "We can stop new private payments from the app at once. Claims, refunds and withdrawals of your own money keep working."],
      ],
    },
    { t: "h2", text: "What we do not protect against yet" },
    {
      t: "ul",
      items: [
        "**Messages sent through the fallback path**, community posts and attachments can be read by our servers. See [Encryption](/docs/cryptography) for the full list.",
        "**Metadata.** Our servers know who your contacts are, which communities you belong to and when you are online. XMTP nodes can see when encrypted messages are sent.",
        "**Your IP address in calls**, unless you turn on the setting that relays every call.",
        "**Someone using your unlocked browser profile.** The local message history and the private wallet live in your browser. Anyone who can use it while it is unlocked can read the history and open the wallet.",
        "**The fee payer of a private payment.** Your account pays each network fee publicly, so its transactions can be linked to each other, although amounts and recipients stay private.",
        "**Contracts without an audit.** No independent firm has audited our contracts yet.",
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
        { title: "Lock your devices", text: "Use a screen lock on every device where you use Ledger Chat." },
        { title: "Review your passkeys", text: "In the private wallet, open **Security**. Remove any passkey on a device you no longer control: it can spend like your wallet." },
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
  updated: "2026-11-17",
  blocks: [
    { t: "h2", text: "Independent reviews" },
    {
      t: "status",
      items: [
        { label: "Smart contract audit", state: "unavailable", text: "No independent firm has reviewed our contracts yet." },
        { label: "Application penetration test", state: "unavailable", text: "Not carried out yet." },
        { label: "Internal code review", state: "available", text: "October 2026, and the private wallet and portal in November 2026. Results below." },
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
    { t: "h2", text: "Internal review, November 2026" },
    {
      t: "p",
      text: "A review of the passkey unlock, the private wallet's Ethereum portal code and their configuration, made before any of it holds funds.",
    },
    { t: "h3", text: "Fixed before release" },
    {
      t: "table",
      head: ["Finding", "Effect before the fix"],
      strongFirst: true,
      rows: [
        ["Passkey unlock trusted the unwrapped key", "A corrupted or planted passkey record could have opened an account other than yours. The key a passkey unlocks must now be your own wallet's signature before anything is derived from it."],
        ["Backup could replace a record on your device", "A bad copy from the server would have overwritten the good record on your device and stopped the passkey from working there. Records on your device now always win."],
        ["Passkeys tied to the exact host", "A passkey enrolled on www.ledgerchat.org did not work on ledgerchat.org. Passkeys are now tied to ledgerchat.org on every subdomain."],
        ["Exits blocked during a pause", "Pausing new payments would also have blocked claiming a deposit or withdrawing to Ethereum. Those exits now always work."],
        ["Portal token not checked against the portal", "A token wired to another Ethereum contract would have burned a withdrawal. The wallet now reads the token's portal on your device and refuses a mismatch."],
        ["Look alike tokens in the configuration", "A release could have listed a fake USDC. On Ethereum, every token must now be the official contract with its real decimals, or the portal stays off."],
        ["A withdrawal the wallet could not finish", "Starting a withdrawal needs a second step on Ethereum that the wallet does not send yet. The withdraw form stays off until it does."],
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
        ["Public fee payer", "Each private transaction names the account that pays its fee.", "Private fee payment is the next piece of work."],
        ["Passkeys on real devices", "Passkey unlock is tested against a simulated authenticator only.", "To be tested on iPhone, Android, Windows and a security key."],
        ["Contracts not audited", "Escrow, streams, the identity contract and the Ethereum portal have no external audit.", "Escrow, streams and the portal stay off Aztec Alpha and Ethereum until they do."],
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
