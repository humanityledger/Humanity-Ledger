"use client";

import React, { useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Check, X } from "lucide-react";

// ─────────────────────────────────────────────────────────────────────────────
// Theme palette definitions
// ─────────────────────────────────────────────────────────────────────────────

export interface ThemePalette {
  id: string;
  label: string;
  /** Emoji or symbol that represents the theme visually */
  symbol: string;
  /** Own-message bubble color (hex) */
  accent: string;
  /** Secondary accent for gradients */
  accentDark: string;
  /** Chat area background */
  bgChat: string;
  /** Sidebar / surface background */
  bgSurface: string;
  /** Primary text color */
  textPrimary: string;
  /** Secondary / muted text color */
  textMuted: string;
  /** Received bubble background */
  bubbleReceived: string;
  /** Border / divider color */
  border: string;
}

export const THEME_PALETTES: ThemePalette[] = [
  {
    id: "default",
    label: "Classic",
    symbol: "⬜",
    accent: "#15171c",
    accentDark: "#000000",
    bgChat: "#f7f8fa",
    bgSurface: "#ffffff",
    textPrimary: "#15171c",
    textMuted: "#727a88",
    bubbleReceived: "#ffffff",
    border: "#e4e7ec",
  },
  {
    id: "midnight",
    label: "Midnight",
    symbol: "🌑",
    accent: "#6c63ff",
    accentDark: "#4b44cc",
    bgChat: "#0d0d14",
    bgSurface: "#13131f",
    textPrimary: "#e8e9f0",
    textMuted: "#6b6e85",
    bubbleReceived: "#1e1e2e",
    border: "#2a2a3e",
  },
  {
    id: "ocean",
    label: "Ocean",
    symbol: "🌊",
    accent: "#0ea5e9",
    accentDark: "#0284c7",
    bgChat: "#f0f9ff",
    bgSurface: "#ffffff",
    textPrimary: "#0c4a6e",
    textMuted: "#60a5d8",
    bubbleReceived: "#e0f2fe",
    border: "#bae6fd",
  },
  {
    id: "forest",
    label: "Forest",
    symbol: "🌲",
    accent: "#16a34a",
    accentDark: "#15803d",
    bgChat: "#f0fdf4",
    bgSurface: "#ffffff",
    textPrimary: "#14532d",
    textMuted: "#4ade80",
    bubbleReceived: "#dcfce7",
    border: "#bbf7d0",
  },
  {
    id: "rose",
    label: "Rose",
    symbol: "🌹",
    accent: "#e11d48",
    accentDark: "#be123c",
    bgChat: "#fff1f2",
    bgSurface: "#ffffff",
    textPrimary: "#881337",
    textMuted: "#fb7185",
    bubbleReceived: "#ffe4e6",
    border: "#fecdd3",
  },
  {
    id: "amber",
    label: "Amber",
    symbol: "🔆",
    accent: "#d97706",
    accentDark: "#b45309",
    bgChat: "#fffbeb",
    bgSurface: "#ffffff",
    textPrimary: "#78350f",
    textMuted: "#fbbf24",
    bubbleReceived: "#fef3c7",
    border: "#fde68a",
  },
  {
    id: "violet",
    label: "Violet",
    symbol: "💜",
    accent: "#7c3aed",
    accentDark: "#6d28d9",
    bgChat: "#f5f3ff",
    bgSurface: "#ffffff",
    textPrimary: "#2e1065",
    textMuted: "#a78bfa",
    bubbleReceived: "#ede9fe",
    border: "#ddd6fe",
  },
  {
    id: "amoled",
    label: "AMOLED",
    symbol: "⬛",
    accent: "#22c55e",
    accentDark: "#16a34a",
    bgChat: "#000000",
    bgSurface: "#000000",
    textPrimary: "#f8fafc",
    textMuted: "#64748b",
    bubbleReceived: "#0a0a0a",
    border: "#1a1a1a",
  },
];

// ─────────────────────────────────────────────────────────────────────────────
// CSS variable injection
// ─────────────────────────────────────────────────────────────────────────────

export function applyThemePalette(palette: ThemePalette) {
  if (typeof document === "undefined") return;
  const root = document.documentElement;
  root.style.setProperty("--lc-accent", palette.accent);
  root.style.setProperty("--lc-accent-dark", palette.accentDark);
  root.style.setProperty("--lc-bg-chat", palette.bgChat);
  root.style.setProperty("--lc-bg-surface", palette.bgSurface);
  root.style.setProperty("--lc-text-primary", palette.textPrimary);
  root.style.setProperty("--lc-text-muted", palette.textMuted);
  root.style.setProperty("--lc-bubble-received", palette.bubbleReceived);
  root.style.setProperty("--lc-border", palette.border);
}

// ─────────────────────────────────────────────────────────────────────────────
// ThemePickerSheet Component
// ─────────────────────────────────────────────────────────────────────────────

interface ThemePickerSheetProps {
  open: boolean;
  currentThemeId: string;
  onSelect: (palette: ThemePalette) => void;
  onClose: () => void;
}

export function ThemePickerSheet({
  open,
  currentThemeId,
  onSelect,
  onClose,
}: ThemePickerSheetProps) {
  const handleSelect = useCallback(
    (palette: ThemePalette) => {
      applyThemePalette(palette);
      onSelect(palette);
    },
    [onSelect]
  );

  return (
    <AnimatePresence>
      {open && (
        <>
          {/* Backdrop */}
          <motion.div
            className="fixed inset-0 z-40 bg-black/30 backdrop-blur-sm"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={onClose}
          />

          {/* Sheet */}
          <motion.div
            className="fixed bottom-0 left-0 right-0 z-50 bg-white rounded-t-[28px] shadow-2xl max-h-[85vh] overflow-y-auto"
            initial={{ y: "100%" }}
            animate={{ y: 0 }}
            exit={{ y: "100%" }}
            transition={{ type: "spring", stiffness: 380, damping: 32 }}
          >
            {/* Handle bar */}
            <div className="flex justify-center pt-3 pb-1">
              <div className="w-10 h-1 rounded-full bg-[#e4e7ec]" />
            </div>

            {/* Header */}
            <div className="flex items-center justify-between px-6 py-4 border-b border-[#f2f4f7]">
              <div>
                <h2 className="text-[20px] font-bold text-[#15171c] leading-none">
                  Themes
                </h2>
                <p className="text-[13px] text-[#727a88] mt-1">
                  Choose your color palette
                </p>
              </div>
              <button
                type="button"
                onClick={onClose}
                className="w-9 h-9 rounded-full bg-[#f2f4f7] flex items-center justify-center text-[#475061] hover:bg-[#e4e7ec] transition-colors"
                aria-label="Close"
              >
                <X size={18} strokeWidth={2} />
              </button>
            </div>

            {/* Grid */}
            <div className="grid grid-cols-2 gap-3 p-5 pb-10">
              {THEME_PALETTES.map((palette) => {
                const isActive = palette.id === currentThemeId;
                return (
                  <motion.button
                    key={palette.id}
                    type="button"
                    whileTap={{ scale: 0.96 }}
                    onClick={() => handleSelect(palette)}
                    className={`relative rounded-2xl p-4 border-2 text-left transition-all ${
                      isActive
                        ? "border-[#15171c] shadow-md"
                        : "border-transparent shadow-sm hover:border-[#e4e7ec]"
                    }`}
                    style={{ backgroundColor: palette.bgSurface }}
                  >
                    {/* Preview swatch strip */}
                    <div
                      className="w-full h-10 rounded-xl mb-3 overflow-hidden flex"
                      style={{ backgroundColor: palette.bgChat }}
                    >
                      <div
                        className="h-full flex-1"
                        style={{ backgroundColor: palette.bubbleReceived }}
                      />
                      <div
                        className="h-full w-[45%]"
                        style={{ backgroundColor: palette.accent }}
                      />
                    </div>

                    {/* Label row */}
                    <div className="flex items-center justify-between">
                      <div>
                        <span className="text-[14px] font-semibold" style={{ color: palette.textPrimary }}>
                          {palette.symbol} {palette.label}
                        </span>
                      </div>
                      {isActive && (
                        <motion.div
                          initial={{ scale: 0 }}
                          animate={{ scale: 1 }}
                          className="w-5 h-5 rounded-full bg-[#15171c] flex items-center justify-center"
                        >
                          <Check size={11} strokeWidth={3} className="text-white" />
                        </motion.div>
                      )}
                    </div>
                  </motion.button>
                );
              })}
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
}
