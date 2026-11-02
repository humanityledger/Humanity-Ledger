"use client";

import React from "react";
import { motion } from "framer-motion";

interface TypingIndicatorProps {
  /** Display name(s) of people currently typing */
  names?: string[];
  /** Accent color for the dots */
  accentColor?: string;
}

/**
 * TypingIndicator — animated three-dot bubble.
 * Each dot bounces with a stagger delay via Framer Motion keyframes.
 */
export function TypingIndicator({ names = [], accentColor = "#a3a9b4" }: TypingIndicatorProps) {
  const label = React.useMemo(() => {
    if (names.length === 0) return "typing…";
    if (names.length === 1) return `${names[0]} is typing…`;
    if (names.length === 2) return `${names[0]} and ${names[1]} are typing…`;
    return `${names[0]} and ${names.length - 1} others are typing…`;
  }, [names]);

  return (
    <motion.div
      className="flex self-start items-end gap-2 mb-1 ml-4"
      initial={{ opacity: 0, y: 6, scale: 0.92 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      exit={{ opacity: 0, y: 4, scale: 0.9 }}
      transition={{ type: "spring", stiffness: 380, damping: 28 }}
    >
      <div
        className="px-4 py-3 bg-white rounded-[18px] rounded-bl-[4px] border border-[#e4e7ec] flex items-center gap-[5px] shadow-sm"
        role="status"
        aria-label={label}
        title={label}
      >
        {[0, 1, 2].map((i) => (
          <motion.span
            key={i}
            className="w-[7px] h-[7px] rounded-full block"
            style={{ backgroundColor: accentColor, willChange: "transform" }}
            animate={{ y: [0, -5, 0] }}
            transition={{
              duration: 0.72,
              repeat: Infinity,
              delay: i * 0.18,
            }}
          />
        ))}
      </div>
      {names.length > 0 && (
        <span className="text-[11px] text-[#a3a9b4] font-medium pb-1 select-none">
          {label}
        </span>
      )}
    </motion.div>
  );
}
