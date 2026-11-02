"use client";

import React from "react";
import { motion } from "framer-motion";
import { HLLogo } from "./HLLogo";

interface InstitutionalShellProps {
  children: React.ReactNode;
  title: string;
  subtitle?: string;
  badge?: string;
  badgeVariant?: "lime" | "emerald" | "rose" | "orchid" | "amber";
  fullWidth?: boolean;
}

//  THE MASTER STACK SHELL  COSMIC WALLPAPER EDITION 
export function InstitutionalShell({
  children,
  title,
  subtitle,
  badge,
  fullWidth = false
}: InstitutionalShellProps) {

  return (
    <div className="flex flex-col flex-1 h-full min-h-0 text-[#050505] relative font-aztec-body overflow-x-hidden bg-white">

      {/* The background pattern layer pointed at /patron-cosmico-4k.png, which
          is not in public/: every page using this shell made a failed request. */}

      {/*  Main content  */}
      <div className="flex-1 relative z-10">
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, ease: [0.16, 1, 0.3, 1], delay: 0.1 }}
          style={{ transform: 'translateZ(0)' }}
          className={`min-h-full pb-0 ${fullWidth ? 'w-full' : 'container mx-auto'}`}
        >
          {children}
        </motion.div>
      </div>

      {/*  DOWNPAGE: Footer band  */}
      <div className="relative pt-10 pb-0 overflow-hidden border-t border-black/[0.07] z-10 mt-10 bg-white">
        {/* Footer band */}
        <div className="relative z-20 px-6 md:px-10 py-5 flex flex-col md:flex-row items-center justify-between gap-4 bg-white">
          <div className="flex items-center gap-3">
            <HLLogo className="w-5 h-5" />
            <span className="font-mono text-[9px] uppercase tracking-widest text-black/60 font-black">
              Immutable Data · Zero-Trust Verification · Extreme Precision
            </span>
          </div>
          <span className="font-mono text-[9px] uppercase tracking-widest text-black/40 font-bold text-center md:text-right">
            Privacy by Void · No data stored · All communication is end to end verified
          </span>
        </div>
      </div>

    </div>
  );
}
