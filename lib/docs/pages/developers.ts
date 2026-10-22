import type { DocPage } from "../types";

export const developers: DocPage = {
  slug: "developers",
  href: "/developers",
  label: "Developer hub",
  title: "Developer hub",
  summary: "Everything you need to read, run and contribute to the Humanity Ledger code.",
  keywords: ["developer", "developers", "api", "sdk", "code", "github", "repository", "run locally", "contribute", "setup", "install", "stack", "env"],
  updated: "2026-10-21",
  blocks: [
    {
      t: "p",
      text: "Humanity Ledger is open source. If you want to know what the product does, the [repository](https://github.com/humanityledger/Humanity-Ledger) is a better answer than any page we write, including this one.",
    },
    {
      t: "cards",
      items: [
        { title: "Repository", text: "Source code, issues and pull requests.", href: "https://github.com/humanityledger/Humanity-Ledger", icon: "github", external: true },
        { title: "Architecture", text: "The parts of the system and their boundaries.", href: "/docs/architecture", icon: "server" },
        { title: "Whitepaper", text: "The design, subsystem by subsystem.", href: "/docs/whitepaper", icon: "file" },
        { title: "Open findings", text: "Security issues that are still being worked on.", href: "/docs/audits", icon: "shield" },
      ],
    },
    { t: "h2", text: "State of the project" },
    {
      t: "status",
      items: [
        { label: "Contract audit", state: "unavailable", text: "No independent review of the contracts yet." },
        { label: "Penetration test", state: "unavailable", text: "Not carried out yet." },
        { label: "Direct messages", state: "available", text: "XMTP with MLS, encrypted in the browser." },
        { label: "Fallback relay", state: "partial", text: "Stores readable messages when XMTP delivery fails. Labelled in the interface." },
        { label: "Community content", state: "partial", text: "Stored readable on the server." },
        { label: "Mobile apps", state: "development", text: "Not submitted to the stores. The web client is the supported one." },
      ],
    },
    { t: "h2", text: "The stack" },
    {
      t: "table",
      head: ["Layer", "Technology", "Notes"],
      strongFirst: true,
      rows: [
        ["Application", "Next.js 15, React 19, TypeScript", "App Router. The middleware runs on the Edge runtime and holds the identity perimeter."],
        ["Messaging", "XMTP browser SDK, MLS", "Direct messages are encrypted in the browser. A server fallback exists and is labelled."],
        ["Identity", "Sign in with Ethereum, JWT", "Sessions are cookies scripts cannot read. Identity is never taken from a header or a query parameter."],
        ["Payments", "wagmi, viem; Aztec and Noir", "Public payments are signed in the user's wallet. Private payments on Aztec are experimental."],
        ["Data", "PostgreSQL with Prisma, Redis", "Redis is optional in development. Rate limiting and nonce storage degrade gracefully without it."],
        ["Realtime", "Server sent events, WebRTC", "Some views still poll, which is the current scaling limit."],
        ["Testing", "Vitest, Playwright", "Unit tests in `test/`, end to end tests in `e2e/`."],
      ],
    },
    { t: "h2", text: "Run it locally" },
    { t: "h3", text: "1. Clone and install" },
    {
      t: "code",
      label: "Terminal",
      code: "git clone https://github.com/humanityledger/Humanity-Ledger.git\ncd Humanity-Ledger\nnpm install",
    },
    {
      t: "p",
      text: "Some dependencies still declare React 18 as a peer while the project uses React 19. The overrides in `package.json` handle most cases. If npm still refuses, add `legacy-peer-deps=true` to your `.npmrc`.",
    },
    { t: "h3", text: "2. Configure the environment" },
    {
      t: "code",
      label: ".env.local",
      code: "# Required, or the app will not start\nDATABASE_URL=\nDATABASE_URL_UNPOOLED=\nJWT_SECRET=\nNEXTAUTH_SECRET=\nNEXTAUTH_URL=http://localhost:3000\nENCLAVE_PIN_PEPPER=\nENCLAVE_PIN_SECRET=",
    },
    {
      t: "hint",
      tone: "warning",
      title: "Never regenerate the PIN pepper in production",
      text: "`ENCLAVE_PIN_PEPPER` is part of every stored PIN hash. Changing it makes every existing PIN invalid.",
    },
    { t: "h3", text: "3. Set up the database" },
    {
      t: "code",
      label: "Terminal",
      code: "npx prisma generate\nnpx prisma db push",
    },
    {
      t: "p",
      text: "`DATABASE_URL` is the pooled connection and `DATABASE_URL_UNPOOLED` the direct one. Prisma needs both, because migrations use session level features that a transaction pooler cannot carry. A free Neon project works well.",
    },
    { t: "h3", text: "4. Start it" },
    {
      t: "code",
      label: "Terminal",
      code: "npm run dev",
    },
    {
      t: "p",
      text: "Open [http://localhost:3000](http://localhost:3000). The messenger is at `/chat`.",
    },
    { t: "h2", text: "Common questions" },
    { t: "h3", text: "Why does signing in fail locally?" },
    {
      t: "p",
      text: "Usually one of two things. The message must be a real EIP-4361 message, built with `prepareMessage()`. And its domain must match the server's, which ignores the port: sign for `localhost`, not `localhost:3000`. The nonce route, `/api/siwe/nonce`, must also be reachable without a session.",
    },
    { t: "h3", text: "Where is the identity check?" },
    {
      t: "p",
      text: "In `middleware.ts`. It removes every identity header the client sent, on every request including public ones, then attaches the address from the verified session. Routes read it with `requireWallet(req)` or `getSession()`. Never send an identity header from a client: it is discarded.",
    },
    { t: "h3", text: "Can I run it without Docker?" },
    {
      t: "p",
      text: "Yes. PostgreSQL can come from any provider and Redis is optional in development. `docs/RUN-LOCAL.md` in the repository covers both.",
    },
    { t: "h3", text: "How do I report a vulnerability?" },
    {
      t: "p",
      text: "Privately, through the process on [Report a vulnerability](/docs/bug-bounty). Please do not open a public issue.",
    },
  ],
};
