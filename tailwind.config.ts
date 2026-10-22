import type { Config } from "tailwindcss";
// An import rather than require(): Node 22 and later load this file as an ES
// module, where require is not defined and the whole CSS build fails.
import typography from "@tailwindcss/typography";

const config: Config = {
    content: [
        "./pages/**/*.{js,ts,jsx,tsx,mdx}",
        "./components/**/*.{js,ts,jsx,tsx,mdx}",
        "./app/**/*.{js,ts,jsx,tsx,mdx}",
    ],
    // System: darkMode is intentionally disabled platform-wide.
    // CONSEQUENCE worth knowing: every `dark:` variant in the codebase is
    // INERT — it compiles to a selector that is never matched, so it paints
    // nothing. Those classes are dead code, not a broken theme. Delete them
    // rather than trying to make them work (registered as N-05 in the UI audit).

    // Using a phantom class that is never applied  dark: variants in JSX
    // are inert. The light-mode firewall in globals.css also overrides any
    // accidental .dark injection from AppKit/Wagmi disconnect cycles.
    darkMode: ['class', '.never-trigger-dark-mode-ever'],
    future: {
        hoverOnlyWhenSupported: true,
    },
    theme: {
        extend: {
            fontFamily: {
                sans: ["Inter", "sans-serif"],
                mono: ["JetBrains Mono", "Fira Code", "monospace"],
            },
            fontSize: {
                "ledger-xs": ["var(--ledger-text-xs)", { lineHeight: "1" }],
                "ledger-sm": ["var(--ledger-text-sm)", { lineHeight: "1.35" }],
                "ledger-md": ["var(--ledger-text-md)", { lineHeight: "var(--ledger-leading-body)" }],
                "ledger-lg": ["var(--ledger-text-lg)", { lineHeight: "1.35" }],
                "ledger-xl": ["var(--ledger-text-xl)", { lineHeight: "var(--ledger-leading-tight)" }],
                "ledger-2xl": ["var(--ledger-text-2xl)", { lineHeight: "var(--ledger-leading-tight)" }],
            },
            borderRadius: {
                "ledger-sm": "var(--ledger-radius-sm)",
                "ledger-md": "var(--ledger-radius-md)",
                "ledger-lg": "var(--ledger-radius-lg)",
                bubble: "var(--ledger-radius-bubble)",
            },
            boxShadow: {
                "elev-1": "var(--ledger-elev-1)",
                "elev-2": "var(--ledger-elev-2)",
                "elev-3": "var(--ledger-elev-3)",
            },
            transitionTimingFunction: {
                ledger: "var(--ledger-ease)",
                "ledger-out": "var(--ledger-ease-out)",
            },
            transitionDuration: {
                fast: "var(--ledger-dur-fast)",
                base: "var(--ledger-dur-base)",
                slow: "var(--ledger-dur-slow)",
            },
            colors: {
                // Sistema Void
                void: "#000000",
                obsidian: "#050505",
                surface: "#0a0a0c",

                // Sistema Glass
                "glass-border": "rgba(255, 255, 255, 0.08)",
                "glass-surface": "rgba(255, 255, 255, 0.03)",
                "glass-highlight": "rgba(255, 255, 255, 0.06)",

                // Semantic Accents
                midgard: { // Monochrome Identity
                    DEFAULT: "#ffffff", // Pure White
                    glow: "rgba(255, 255, 255, 0.5)",
                },
                asgard: { // Monochrome Accent
                    DEFAULT: "#cccccc", // Light Gray
                    glow: "rgba(204, 204, 204, 0.5)",
                },

                // ── Token layer (styles/ledger-tokens.css) ──────────────────
                // Every value below resolves to a CSS variable, so a change
                // lands in one file instead of across components. The keys
                // above are kept so existing class names keep working.
                ledger: {
                    void: "var(--ledger-void)",
                    obsidian: "var(--ledger-obsidian)",
                    surface: "var(--ledger-surface)",
                    raised: "var(--ledger-surface-raised)",

                    fg: "var(--ledger-fg)",
                    "fg-strong": "var(--ledger-fg-strong)",
                    "fg-muted": "var(--ledger-fg-muted)",
                    "fg-faint": "var(--ledger-fg-faint)",

                    edge: "var(--ledger-edge)",
                    "edge-strong": "var(--ledger-edge-strong)",
                    glass: "var(--ledger-glass)",
                    "glass-hover": "var(--ledger-glass-hover)",

                    // Trust scale — the only saturated colour in the system.
                    sealed: "var(--ledger-sealed)",
                    "sealed-dim": "var(--ledger-sealed-dim)",
                    verified: "var(--ledger-verified)",
                    "verified-dim": "var(--ledger-verified-dim)",
                    unsealed: "var(--ledger-unsealed)",
                    "unsealed-dim": "var(--ledger-unsealed-dim)",
                    broken: "var(--ledger-broken)",
                    "broken-dim": "var(--ledger-broken-dim)",
                },

                // Neutral ramp. Nine steps with a cold bias, so a grey reads
                // as chosen rather than as an unfinished state.
                n: {
                    900: "var(--ledger-n-900)",
                    800: "var(--ledger-n-800)",
                    700: "var(--ledger-n-700)",
                    600: "var(--ledger-n-600)",
                    500: "var(--ledger-n-500)",
                    400: "var(--ledger-n-400)",
                    300: "var(--ledger-n-300)",
                    200: "var(--ledger-n-200)",
                    100: "var(--ledger-n-100)",
                    0:   "var(--ledger-n-000)",
                }
            },
            backgroundImage: {
                "void-gradient": "none",
                "glass-gradient": "none",
            },
            animation: {
                "fade-in": "fadeIn 0.5s ease-out forwards",
                "slide-up": "slideUp 0.5s ease-out forwards",
                "pulse-slow": "pulse 3s cubic-bezier(0.4, 0, 0.6, 1) infinite",
                "subtle-zoom": "subtleZoom 20s ease-in-out infinite",
                "scan": "scan 8s linear infinite",
            },
            keyframes: {
                fadeIn: {
                    "0%": { opacity: "0" },
                    "100%": { opacity: "1" },
                },
                slideUp: {
                    "0%": { opacity: "0", transform: "translateY(10px)" },
                    "100%": { opacity: "1", transform: "translateY(0)" },
                },
                subtleZoom: {
                    "0%, 100%": { transform: "scale(1)" },
                    "50%": { transform: "scale(1.1)" },
                },
                scan: {
                    "0%": { transform: "translateY(-100%)" },
                    "100%": { transform: "translateY(1000%)" },
                },
            },
        },
    },
    plugins: [
        typography,
    ],
};
export default config;
