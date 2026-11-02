"use client";

import React from "react";
import { motion, AnimatePresence } from "framer-motion";
import { X, Check } from "lucide-react";

// ─────────────────────────────────────────────────────────────────────────────
// Wallpaper options
// ─────────────────────────────────────────────────────────────────────────────

export interface WallpaperOption {
  id: string;
  label: string;
  /** CSS background value */
  background: string;
  /** Preview style (short CSS for the swatch) */
  preview: React.CSSProperties;
}

export const WALLPAPER_OPTIONS: WallpaperOption[] = [
  {
    id: "default",
    label: "Default",
    background: "#f7f8fa",
    preview: { backgroundColor: "#f7f8fa" },
  },
  {
    id: "pure_white",
    label: "Pure White",
    background: "#ffffff",
    preview: { backgroundColor: "#ffffff", border: "1px solid #e4e7ec" },
  },
  {
    id: "amoled",
    label: "AMOLED Black",
    background: "#000000",
    preview: { backgroundColor: "#000000" },
  },
  {
    id: "slate",
    label: "Deep Slate",
    background: "#0f172a",
    preview: { backgroundColor: "#0f172a" },
  },
  {
    id: "ocean",
    label: "Ocean Blue",
    background: "linear-gradient(160deg, #0f2027 0%, #203a43 50%, #2c5364 100%)",
    preview: { background: "linear-gradient(160deg, #0f2027 0%, #2c5364 100%)" },
  },
  {
    id: "sunset",
    label: "Sunset",
    background: "linear-gradient(160deg, #ff6b6b 0%, #feca57 50%, #ff9f43 100%)",
    preview: { background: "linear-gradient(160deg, #ff6b6b 0%, #ff9f43 100%)" },
  },
  {
    id: "forest",
    label: "Forest",
    background: "linear-gradient(160deg, #134e5e 0%, #71b280 100%)",
    preview: { background: "linear-gradient(160deg, #134e5e 0%, #71b280 100%)" },
  },
  {
    id: "aurora",
    label: "Aurora",
    background: "linear-gradient(160deg, #1a1a2e 0%, #16213e 40%, #0f3460 70%, #533483 100%)",
    preview: { background: "linear-gradient(160deg, #1a1a2e 0%, #533483 100%)" },
  },
  {
    id: "rose",
    label: "Rose Garden",
    background: "linear-gradient(160deg, #ffecd2 0%, #fcb69f 100%)",
    preview: { background: "linear-gradient(160deg, #ffecd2 0%, #fcb69f 100%)" },
  },
  {
    id: "lavender",
    label: "Lavender",
    background: "linear-gradient(160deg, #e9d5ff 0%, #c4b5fd 50%, #a78bfa 100%)",
    preview: { background: "linear-gradient(160deg, #e9d5ff 0%, #a78bfa 100%)" },
  },
  {
    id: "dots",
    label: "Dot Grid",
    background: "#f7f8fa",
    preview: {
      backgroundColor: "#f7f8fa",
      backgroundImage: "radial-gradient(rgba(21,23,28,0.2) 1px, transparent 1px)",
      backgroundSize: "10px 10px",
    },
  },
  {
    id: "circuit",
    label: "Circuit",
    background: "#f7f8fa",
    preview: {
      backgroundColor: "#f7f8fa",
      backgroundImage:
        "linear-gradient(rgba(21,23,28,0.08) 1px, transparent 1px), linear-gradient(90deg, rgba(21,23,28,0.08) 1px, transparent 1px)",
      backgroundSize: "14px 14px",
    },
  },
];

// ─────────────────────────────────────────────────────────────────────────────
// Component
// ─────────────────────────────────────────────────────────────────────────────

interface WallpaperPickerSheetProps {
  open: boolean;
  currentWallpaperId: string;
  peerDisplayName: string;
  onSelect: (option: WallpaperOption) => void;
  onClose: () => void;
}

export function WallpaperPickerSheet({
  open,
  currentWallpaperId,
  peerDisplayName,
  onSelect,
  onClose,
}: WallpaperPickerSheetProps) {
  return (
    <AnimatePresence>
      {open && (
        <>
          <motion.div
            className="fixed inset-0 z-40 bg-black/30 backdrop-blur-sm"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={onClose}
          />
          <motion.div
            className="fixed bottom-0 left-0 right-0 z-50 bg-white rounded-t-[28px] shadow-2xl max-h-[82vh] overflow-y-auto"
            initial={{ y: "100%" }}
            animate={{ y: 0 }}
            exit={{ y: "100%" }}
            transition={{ type: "spring", stiffness: 380, damping: 32 }}
          >
            {/* Handle */}
            <div className="flex justify-center pt-3 pb-1">
              <div className="w-10 h-1 rounded-full bg-[#e4e7ec]" />
            </div>

            {/* Header */}
            <div className="flex items-center justify-between px-6 py-4 border-b border-[#f2f4f7]">
              <div>
                <h2 className="text-[20px] font-bold text-[#15171c] leading-none">
                  Chat Wallpaper
                </h2>
                <p className="text-[13px] text-[#727a88] mt-1">
                  For your chat with {peerDisplayName}
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
            <div className="grid grid-cols-3 gap-3 p-5 pb-12">
              {WALLPAPER_OPTIONS.map((opt) => {
                const isActive = opt.id === currentWallpaperId;
                return (
                  <motion.button
                    key={opt.id}
                    type="button"
                    whileTap={{ scale: 0.94 }}
                    onClick={() => { onSelect(opt); onClose(); }}
                    className={`relative rounded-2xl overflow-hidden border-2 transition-all ${
                      isActive ? "border-[#15171c] shadow-lg" : "border-transparent"
                    }`}
                  >
                    {/* Swatch */}
                    <div
                      className="w-full h-20"
                      style={opt.preview}
                    />
                    {/* Label */}
                    <div className="bg-white px-2 py-1.5 text-center">
                      <span className="text-[11px] font-medium text-[#15171c] leading-none">
                        {opt.label}
                      </span>
                    </div>
                    {/* Active check */}
                    {isActive && (
                      <div className="absolute top-2 right-2 w-5 h-5 rounded-full bg-[#15171c] flex items-center justify-center">
                        <Check size={11} strokeWidth={3} className="text-white" />
                      </div>
                    )}
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
