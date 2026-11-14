"use client";

import React from "react";
import { motion, AnimatePresence } from "framer-motion";
import { X, Check } from "lucide-react";
import { WALLPAPERS } from "@/lib/chat/wallpapers";

// ─────────────────────────────────────────────────────────────────────────────
// Wallpaper options
// ─────────────────────────────────────────────────────────────────────────────

export interface WallpaperOption {
  id: string;
  label: string;
  /**
   * The value stored for this wallpaper: its id (lib/chat/wallpapers.ts). Older builds stored CSS
   * here; resolveWallpaper() still reads those.
   */
  background: string;
  /** Style for a thumbnail. */
  preview: React.CSSProperties;
}

/** Every wallpaper, for pickers that list them flat. "Default" is the colour theme's own canvas. */
export const WALLPAPER_OPTIONS: WallpaperOption[] = WALLPAPERS.map((w) => ({
  id: w.id,
  label: w.id === "default" ? "Default" : w.label,
  background: w.id,
  preview: w.id === "default" ? { backgroundColor: "#f7f8fa" } : w.style,
}));

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
            <div className="grid grid-cols-3 sm:grid-cols-4 gap-3 p-5 pb-12">
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
                      className="w-full aspect-[3/4]"
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
