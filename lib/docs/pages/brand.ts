import type { DocPage } from "../types";

export const brand: DocPage = {
  slug: "brand",
  href: "/docs/brand",
  label: "Brand & Design",
  title: "Brand & Design System",
  summary: "The visual identity, typography, color palette, and interface standards governing Humanity Ledger and Ledger Chat.",
  keywords: ["brand", "typography", "design system", "colors", "logo", "identity", "screenshots", "press kit", "aztec logo", "live activities", "dynamic island", "ui guidelines"],
  updated: "2026-11-12",
  blocks: [
    {
      t: "p",
      text: "The Humanity Ledger brand embodies cryptographic rigor, institutional soberness, and uncompromising user sovereignty. Our visual system rejects frivolous ornamentation in favor of precision, high legibility, and architectural clarity.",
    },
    { t: "h2", text: "Design philosophy" },
    {
      t: "defs",
      items: [
        {
          term: "Cryptographic Soberness",
          text: "Interfaces must communicate finality and cryptographic certainty. Every visual element has an informational purpose; decorative clutter and gratuitous animations are prohibited.",
        },
        {
          term: "Native Mobile Parity",
          text: "Mobile experiences must match or exceed the tactile responsiveness of native iOS applications. Interstitial states, haptic feedback triggers, and safe-area boundaries are strictly respected.",
        },
        {
          term: "Zero Custody, Zero Pretense",
          text: "We describe protocols exactly as they exist in mathematics and code. We do not use speculative buzzwords or vague promises; state changes correspond directly to verifiable proofs.",
        },
      ],
    },
    { t: "h2", text: "Typography system" },
    {
      t: "p",
      text: "Our typographic hierarchy relies on variable-weight geometric sans-serif typefaces with optical alignment and tabular numerals for cryptographic addresses and balances.",
    },
    {
      t: "table",
      head: ["Role", "Font Family", "Weight", "Tracking", "Usage"],
      strongFirst: true,
      rows: [
        ["Display / Headlines", "Inter Display, -apple-system", "600 (Semi-Bold)", "-0.02em", "Landing page headers, sheet titles"],
        ["Body Text", "Inter, system-ui, sans-serif", "400 (Regular) / 450", "-0.01em", "Documentation, chat bubbles, descriptions"],
        ["Technical / Monospace", "JetBrains Mono, SF Mono, Menlo", "500 (Medium)", "0em", "Addresses (0x...), transaction hashes, proofs, code blocks"],
        ["Financial Figures", "Inter (tabular-nums)", "500 (Medium)", "-0.01em", "Token amounts, invoices, transaction counters"],
      ],
    },
    { t: "h2", text: "Color palette" },
    {
      t: "p",
      text: "The palette is calibrated for high-contrast accessibility (WCAG AAA for text) in both stark light and sovereign dark modes.",
    },
    {
      t: "table",
      head: ["Token Name", "Hex Value", "Role", "Description"],
      strongFirst: true,
      rows: [
        ["--hl-onyx-primary", "#15171C", "Primary Text / Dark Surface", "Deep soot-black anchoring text and sovereign navigation bars."],
        ["--hl-aztec-violet", "#5200FF", "Cryptographic Accent", "Accent for proofs and verified states. Used sparingly, never for large surfaces."],
        ["--hl-slate-bg", "#F7F8FA", "Base Canvas (Light)", "Subtle cool-tinted paper background avoiding clinical pure-white fatigue."],
        ["--hl-border-subtle", "#E4E7EC", "Structural Borders", "Single-pixel delineations separating cards and chat panels."],
        ["--hl-shield-emerald", "#10B981", "Private State / Success", "Unbroken end-to-end encryption indicator and confirmed proof state."],
        ["--hl-burn-vermilion", "#FF3B30", "Revocation / Timers", "Destructive actions, revoked payloads, and disappearing message intervals."],
      ],
    },
    { t: "h2", text: "Logo and mark", id: "logo" },
    {
      t: "p",
      text: "The Humanity Ledger mark is a black world map in a white disc. It is set beside the wordmark, or alone where space is short, and it is the only logo the company uses.",
    },
    {
      t: "defs",
      items: [
        {
          term: "Clear Space",
          text: "The mark must always be surrounded by clear space equal to at least 50% of the mark's height on all four sides. No text or graphic element may encroach on this boundary.",
        },
        {
          term: "Minimum Render Dimensions",
          text: "Digital displays: 24px height. Print publications: 8mm height. Below these thresholds, legibility of the sovereign aperture degrades.",
        },
        {
          term: "Unacceptable Variations",
          text: "Do not rotate, skew, recolor, or add gradients, shadows or outlines. The map stays black inside its white disc on every background; only the wordmark changes, ink (#15171C) on light and white on dark.",
        },
      ],
    },
    {
      t: "gallery",
      columns: 2,
      items: [
        {
          src: "/brand/humanity-ledger/humanity-ledger-logo-light.png",
          width: 2104,
          height: 640,
          alt: "Humanity Ledger logo, dark wordmark on white",
          caption: "Humanity Ledger logo for light backgrounds.",
        },
        {
          src: "/brand/humanity-ledger/humanity-ledger-logo-dark.png",
          width: 2104,
          height: 640,
          alt: "Humanity Ledger logo, white wordmark on near black",
          caption: "Humanity Ledger logo for dark backgrounds.",
        },
      ],
    },
    { t: "h2", text: "Ledger Chat screens", id: "screens" },
    {
      t: "p",
      text: "Reference screens for the Ledger Chat redesign, for press, partners and anyone writing about the product. Each one downloads as a full resolution PNG. Names, messages and amounts in them are examples.",
    },
    { t: "h3", text: "Desktop" },
    {
      t: "gallery",
      columns: 2,
      items: [
        {
          src: "/landing/desktop/chats-2880.webp",
          download: "/brand/ledger-chat/ledger-chat-chats.png",
          width: 2880,
          height: 1800,
          alt: "Ledger Chat on desktop: the chat list, a conversation with a private payment of 48 HLC, and the contact panel with safety glyphs",
          caption: "Chats. A conversation with a private payment, a voice note and the live call pill.",
        },
        {
          src: "/landing/desktop/calls-2880.webp",
          download: "/brand/ledger-chat/ledger-chat-calls.png",
          width: 2880,
          height: 1800,
          alt: "Ledger Chat on desktop: call history and an encrypted direct video call",
          caption: "Calls. History, and an end to end encrypted call with a direct connection.",
        },
        {
          src: "/landing/desktop/updates-2880.webp",
          download: "/brand/ledger-chat/ledger-chat-updates.png",
          width: 2880,
          height: 1800,
          alt: "Ledger Chat on desktop: status updates, a post composer with an audience picker, and the feed",
          caption: "Updates. Status, posts for chosen audiences, polls and private tips.",
        },
        {
          src: "/landing/desktop/communities-2880.webp",
          download: "/brand/ledger-chat/ledger-chat-communities.png",
          width: 2880,
          height: 1800,
          alt: "Ledger Chat on desktop: a community with channels, a live voice room, a pinned announcement and members",
          caption: "Communities. Channels, voice rooms, announcements and member roles.",
        },
      ],
    },
    { t: "h3", text: "iPhone" },
    {
      t: "gallery",
      columns: 3,
      items: [
        {
          src: "/brand/ledger-chat/ledger-chat-iphone-chats.webp",
          download: "/brand/ledger-chat/ledger-chat-iphone-chats.png",
          width: 780,
          height: 1688,
          alt: "Ledger Chat on iPhone: the chat list with an ongoing call in the Dynamic Island",
          caption: "Chats, with the ongoing call in the Dynamic Island.",
        },
        {
          src: "/brand/ledger-chat/ledger-chat-iphone-payment.webp",
          download: "/brand/ledger-chat/ledger-chat-iphone-payment.png",
          width: 780,
          height: 1688,
          alt: "Ledger Chat on iPhone: a private payment being proved, shown in the expanded Dynamic Island",
          caption: "A private payment proving on the device.",
        },
        {
          src: "/brand/ledger-chat/ledger-chat-iphone-call.webp",
          download: "/brand/ledger-chat/ledger-chat-iphone-call.png",
          width: 780,
          height: 1688,
          alt: "Ledger Chat on iPhone: a full screen encrypted video call",
          caption: "An encrypted video call.",
        },
      ],
    },
    { t: "h3", text: "Live Activities" },
    {
      t: "p",
      text: "Calls and private payments stay visible around the camera while people move through the app. The island never shows message text, only names and amounts, and amounts hide while the screen is shared or recorded. On the web the same pill floats at the top of the conversation.",
    },
    {
      t: "gallery",
      columns: 1,
      items: [
        {
          src: "/brand/ledger-chat/ledger-chat-live-activities.webp",
          download: "/brand/ledger-chat/ledger-chat-live-activities.png",
          width: 1600,
          height: 1500,
          alt: "The Ledger Chat Dynamic Island states: compact call, compact payment, expanded incoming call, expanded payment received and minimal",
          caption: "The Live Activities state system.",
        },
      ],
    },
    { t: "h2", text: "Aztec Network marks", id: "aztec" },
    {
      t: "p",
      text: "Private payments in Ledger Chat settle on Aztec Network. When we show that, we use the Aztec marks exactly as Aztec supplies them on [aztec.network/brand](https://aztec.network/brand). The marks belong to Aztec. Ledger Chat is an independent application and showing the marks does not mean Aztec endorses it.",
    },
    {
      t: "defs",
      items: [
        {
          term: "Two marks, used apart",
          text: "The symbol and the wordmark are separate assets for separate places. Never set them together, and never join either of them to the Humanity Ledger logo as a single lockup.",
        },
        {
          term: "Surface",
          text: "The wordmark is ink (#141900) on light surfaces and paper (#FFF9F2) on dark ones. The symbol keeps its gradient on both.",
        },
        {
          term: "Size and room",
          text: "Never narrower than 60px on screen or 20mm in print, with clear space on every side.",
        },
        {
          term: "Unchanged",
          text: "No other colors, outlines, shadows or effects, and no stretching, rotating or type set inside them.",
        },
      ],
    },
    {
      t: "gallery",
      columns: 2,
      items: [
        {
          src: "/brand/aztec/aztec-wordmark-ink.svg",
          width: 619,
          height: 143,
          alt: "Aztec wordmark in ink",
          caption: "Wordmark, ink, for light surfaces.",
          surface: "paper",
        },
        {
          src: "/brand/aztec/aztec-wordmark-paper.svg",
          width: 619,
          height: 143,
          alt: "Aztec wordmark in paper",
          caption: "Wordmark, paper, for dark surfaces.",
          surface: "ink",
        },
        {
          src: "/brand/aztec/aztec-symbol.svg",
          width: 207,
          height: 207,
          alt: "Aztec symbol with its gradient",
          caption: "Symbol, gradient, on dark.",
          surface: "ink",
        },
        {
          src: "/brand/aztec/aztec-symbol-ink.svg",
          width: 207,
          height: 207,
          alt: "Aztec symbol in ink",
          caption: "Symbol, single color ink.",
          surface: "paper",
        },
      ],
    },
    { t: "h2", text: "Mobile interface benchmarks" },
    {
      t: "p",
      text: "Ledger Chat mobile interfaces are engineered against Signal and Apple Human Interface Guidelines: 44pt minimum touch targets, dynamic bottom safe-area insets, fluid gesture dismissals, and seamless WalletConnect relay handshakes that never lock users out of their active Safari sessions.",
    },
  ],
};
