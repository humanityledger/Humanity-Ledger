# Humanity Ledger — working standard

Instructions for any agent or developer writing interface and copy in this repository. Read this before building a page.

Precedence: an explicit instruction from a maintainer beats this file; this file beats habit.

---

## 1. The rule that outranks the rest

**Never write a claim the code does not support.**

This is a privacy product that moves money. A sentence like "zero central servers" is not marketing copy — it is a promise a person uses to decide whether to type their bank details into a text field. If the claim is ahead of the build, someone gets hurt in the gap.

Concretely, these are currently **false** and must not appear anywhere:

| Claim | Why it is false right now |
|---|---|
| "Audited on Aztec" / any audit badge | No third-party contract audit exists. Tracked as H-037. |
| "Zero central servers" / "no central database" | `app/api/chat/direct` writes message bodies to PostgreSQL; `app/api/chat/send` writes to Redis and PostgreSQL. |
| "Unencrypted fallbacks explicitly prohibited" | The fallback exists and is unencrypted. That is F2-02. |
| "Instant finality", "sub-millisecond", "military-grade" | Unmeasured superlatives. Give a number with a source or say nothing. |
| "No limit" on community members | Community queries use `take: 200`. |

When a capability is partly built, say which part. "Direct messages are encrypted; group messages are not yet" is both honest and more persuasive than a blanket claim, because a reader who finds one overstatement stops believing the rest of the page.

**Figures carry their provenance.** Aztec's ~2.5 s proving time and sub-$0.05 fee are self-reported by Aztec and measured on a consumer laptop. Write them that way. Never present a simulated number as a live one — if `simulated: true` comes back from an API, the interface says so.

### The status vocabulary

Every capability statement in marketing and docs uses one of these, and only these:

- **Live** — shipped and working in the current build.
- **Partial** — works with a stated limitation. The limitation is named in the same sentence.
- **Alpha** — depends on something the upstream project itself calls alpha.
- **Not done** — scheduled, not built. Never written as "coming soon" without a reason.

A status changes when the code changes, not when the copy does.

---

## 2. Two visual worlds, one token system

The product has two surfaces and they do not look alike. Do not mix them.

**The app** (`/chat`, `/portfolio`, everything behind sign-in) is the Void system: pure black ground, monochrome type, glass edges.

**Marketing and documentation** (landing, `/docs`, legal, company pages) is paper: white ground, near-black ink, generous measure. It should read like a specification, not like a crypto launch.

Both draw from the same tokens in `app/ledger-tokens.css`. Never hard-code a hex value in a component; if a token is missing, add it there.

### No dark mode

`tailwind.config.ts` sets `darkMode: ['class', '.never-trigger-dark-mode-ever']`. This is deliberate. **Every `dark:` variant in this codebase is inert** — it compiles to a selector that is never matched and paints nothing. They are dead code. Delete them when you touch a file; never add one, and never "fix" one by trying to make dark mode work.

### Typography

- Display: **Bricolage Grotesque**, weights 600 and 800, letter-spacing −0.03em at large sizes.
- Body: **Archivo**.
- Data, labels, status, addresses, code: **JetBrains Mono**.

Running text stays near 60–65 characters. Message bodies in the app are 15px. Uppercase labels get `letter-spacing: 0.14em` and never exceed 11px.

### The trust scale is the only colour

In the app, the four trust tokens (`--ledger-sealed`, `--ledger-verified`, `--ledger-unsealed`, `--ledger-broken`) are the only saturated colour in the system. That scarcity is what makes them read as signal. Do not introduce a decorative accent that competes with them.

`components/chat/TrustBadge.tsx` is the component. `trustStateForMessage()` is deliberately pessimistic: anything it cannot confirm as sealed is reported as readable. Keep it that way — a badge that guesses in the product's favour is worse than no badge.

---

## 3. Documentation must look like GitBook

Not "inspired by". The structure below is the specification.

### Layout

Three columns at ≥1280px, two at ≥1024px, one below:

```
┌────────────┬───────────────────────────┬──────────────┐
│ Sidebar    │ Content                   │ On this page │
│ 260px      │ max 720px, left-aligned   │ 220px        │
│ sticky     │                           │ sticky       │
└────────────┴───────────────────────────┴──────────────┘
```

- **Sidebar**: grouped navigation from `components/docs/DocsData.ts`. Group labels are 10px mono uppercase. The active item gets a left rule and a weight change, never a filled pill.
- **Content**: 720px maximum. Longer lines are the single most common way a docs page stops being readable.
- **On this page**: `h2` and `h3` of the current document, with the section nearest the top of the viewport marked. This is the element people recognise as GitBook; a docs page without it is not finished.

### Required on every docs page

1. Breadcrumb: `Docs / <Group> / <Page>`.
2. `h1` matching the sidebar label exactly. A reader who clicks "Encryption Systems" and lands on "Cryptography Overview" thinks they clicked wrong.
3. A one- or two-sentence summary under the `h1` that states what the page answers.
4. Previous / next at the foot, with the group name above each title.
5. A "Last reviewed" date. A docs page with no date is a page nobody will trust after six months.

### Inside the content

- Code blocks: mono, bordered, with the language labelled and a copy control. Never a bare `<pre>`.
- Callouts come in exactly three kinds — **Note**, **Caution**, **Security** — each a left rule plus a label, never a coloured box with an emoji.
- Tables get `overflow-x: auto` on their own container so the page body never scrolls sideways.
- Every heading is linkable, with the anchor appearing on hover.
- An `h2` every three to four paragraphs. Unbroken prose is where readers leave.

---

## 4. The landing page

The explanations currently on the site are good and were written deliberately. **Keep them.** Improve typography, hierarchy, spacing and rhythm; do not rewrite the substance. The exception is section 1 of this file: any claim listed there as false is removed or corrected, regardless of how well it reads.

Structure that works, in order: hero stating what the product is → what is actually running today → how it works in four steps → payments → honest comparison → platforms → questions → close.

Dead calls to action are worse than none. An App Store badge pointing at `#` tells a visitor the page is not maintained. If a platform is not shipping, the page says so with a reason.

The installer pages (`/download`, macOS, Windows, Linux) state for each platform: minimum OS version, architecture, file size, SHA-256 checksum, and whether the binary is code-signed. **An unsigned installer is never offered without saying it is unsigned** and what that means. Where a build is unsigned, the web client is the recommended path and the page says why.

---

## 5. Building a page

Before writing markup:

1. Read the existing page. Most pages here are working product. Improving typography and structure is the job; rewriting a 60KB component from scratch is not.
2. Check which claims it makes against section 1.
3. Decide the single question the page answers. If you cannot name it, the page does not need to exist.

While writing:

- Lay out with flex or grid and `gap`. Per-element margins collapse in ways that are hard to see.
- Side gutter at every width: `padding-left: max(16px, env(safe-area-inset-left, 0px))` and the same for right.
- Nothing has a `min-width` wider than a phone. Only tables, code and diagrams may exceed the viewport, each inside its own scroll container.
- Visible focus state on everything focusable. Respect `prefers-reduced-motion`.
- Three durations only: 120ms for press and hover, 220ms for panels, 420ms for route changes.

Writing the copy:

- Active voice. A control says what happens; the confirmation says it happened.
- Name things as a reader recognises them, not as the system implements them. A person manages notifications, not webhook configuration.
- Errors say what went wrong and what to do. Never apologise, never say "something went wrong".
- Avoid em-dash asides, "not X, but Y", colon-then-reveal, scare quotes, and phrases like "worth noting". Short and direct beats clever.
- No emoji as section markers, in docs or in the interface.

### Do not produce

These read as machine-generated and the repository has a visual identity of its own: cream backgrounds with a serif display and terracotta accent; purple-to-blue gradient heroes; Inter or Space Grotesk as the default face; everything centred; a uniform radius and shadow on every block, which flattens hierarchy rather than creating it.

Card styling — border, fill, radius, shadow — marks an element as a separate object. Apply it to the one element that needs setting apart, not to all of them.

---

## 6. Security constraints that affect the interface

- The middleware strips `x-web3-address`, `x-wallet-address`, `x-verified-session-address` and `x-session-kind` from every incoming request, public routes included, then injects the verified values. **Never send an identity header from the client.** It will be discarded, and writing one implies a trust model that does not exist.
- Identity comes from `requireWallet(req)` or `getSession()`. Never from a query parameter, a header or a request body.
- `x-session-kind` distinguishes `wallet` from `account`. Email-backed sessions carry a UUID rather than a `0x` address; a route that validates `/^0x[0-9a-fA-F]{40}$/` rejects those users.
- `/api/siwe/nonce` and `/api/siwe/verify` are the sign-in pair. `/api/auth/system-verify` is retired and answers 410. The signed message must be a real EIP-4361 message built with `prepareMessage()`, and its `domain` must match the server's, which strips the port.
- Never add a client-generated nonce fallback. A nonce the client chooses is not a nonce.
- Message bodies pass through `checkMessageEnvelope()` in `lib/security/messageEnvelope.ts`. While `CHAT_REQUIRE_SEALED_ENVELOPE` is unset, unsealed bodies are stored and logged as a warning; the interface must label those messages as readable on the server.

---

## 7. Local development

`docs/RUN-LOCAL.md` has the full setup. Postgres comes from Neon; `DATABASE_URL` is pooled and `DATABASE_URL_UNPOOLED` is direct, and Prisma needs both. Redis is optional — the rate limiter and nonce store fail open without it.

Required or the app will not start or will 500 on use: `JWT_SECRET`, `ENCLAVE_PIN_PEPPER`, `ENCLAVE_PIN_SECRET`, `NEXTAUTH_SECRET`, `NEXTAUTH_URL`, `DATABASE_URL`.

`ENCLAVE_PIN_PEPPER` is unrecoverable. Regenerating it invalidates every stored PIN. In production it belongs in a secret manager, not in a `.env` file someone regenerates without thinking.
