import type { DocPage } from "../types";

export const brand: DocPage = {
  slug: "brand",
  href: "/docs/brand",
  label: "Brand & Design",
  title: "Brand & Design System",
  summary: "The visual identity, typography, color palette, and interface standards governing Humanity Ledger and Ledger Chat.",
  keywords: ["brand", "typography", "design system", "colors", "logo", "identity", "aztec labs standard", "ui guidelines"],
  updated: "2026-11-10",
  blocks: [
    {
      t: "p",
      text: "The Humanity Ledger brand embodies cryptographic rigor, institutional soberness, and uncompromising user sovereignty. Built to Aztec Labs standards, our visual system rejects frivolous ornamentation in favor of precision, high legibility, and architectural clarity.",
    },
    { t: "h2", text: "Design Philosophy" },
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
    { t: "h2", text: "Typography System" },
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
    { t: "h2", text: "Color Palette" },
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
        ["--hl-aztec-violet", "#5200FF", "Cryptographic Accent", "Vibrant zero-knowledge violet inherited from Aztec protocol alignment."],
        ["--hl-slate-bg", "#F7F8FA", "Base Canvas (Light)", "Subtle cool-tinted paper background avoiding clinical pure-white fatigue."],
        ["--hl-border-subtle", "#E4E7EC", "Structural Borders", "Single-pixel delineations separating cards and chat panels."],
        ["--hl-shield-emerald", "#10B981", "Private State / Success", "Unbroken end-to-end encryption indicator and confirmed proof state."],
        ["--hl-burn-vermilion", "#FF3B30", "Revocation / Timers", "Destructive actions, revoked payloads, and disappearing message intervals."],
      ],
    },
    { t: "h2", text: "Logo & Mark Specifications" },
    {
      t: "p",
      text: "The Humanity Ledger mark consists of an interlocking cryptographic ledger glyph rendered with mathematical proportions.",
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
          text: "Do not rotate, skew, apply gradients, drop shadows, or outline effects to the glyph. The mark exists exclusively in solid monochrome (#15171C on light, #FFFFFF on dark) or Aztec Violet (#5200FF).",
        },
      ],
    },
    { t: "h2", text: "Mobile Interface Benchmarks" },
    {
      t: "p",
      text: "Ledger Chat mobile interfaces are engineered against Signal and Apple Human Interface Guidelines: 44pt minimum touch targets, dynamic bottom safe-area insets, fluid gesture dismissals, and seamless WalletConnect relay handshakes that never lock users out of their active Safari sessions.",
    },
  ],
};
