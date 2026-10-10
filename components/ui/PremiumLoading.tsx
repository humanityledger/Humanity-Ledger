"use client";

import { motion } from 'framer-motion';
import { Loader2, Sparkles } from 'lucide-react';

interface PremiumLoadingProps {
  message?: string;
  fullScreen?: boolean;
}

export function PremiumLoading({ message = "Loading...", fullScreen = true }: PremiumLoadingProps) {
  if (fullScreen) {
    return (
      <div className="fixed inset-0 bg-black z-50 flex items-center justify-center">
        {/* Animated background orbs */}
        <div className="absolute inset-0">
          <div className="absolute top-1/4 left-1/4 w-96 h-96 bg-purple-500/20 rounded-full blur-3xl animate-blob" />
          <div className="absolute bottom-1/4 right-1/4 w-96 h-96 bg-[#25D366]/20 rounded-full blur-3xl animate-blob animation-delay-2000" />
        </div>

        {/* Loading content */}
        <motion.div
          initial={{ opacity: 0, scale: 0.9 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ duration: 0.5 }}
          className="relative z-10 flex flex-col items-center gap-6"
        >
          {/* Animated logo/icon */}
          <motion.div
            animate={{
              rotate: 360,
              scale: [1, 1.1, 1],
            }}
            transition={{
              rotate: { duration: 3, repeat: Infinity, ease: "linear" },
              scale: { duration: 2, repeat: Infinity, ease: "easeInOut" },
            }}
            className="relative"
          >
            <div className="w-20 h-20 rounded-full bg-gradient-to-r from-purple-500 to-[#25D366] flex items-center justify-center">
              <Sparkles className="w-10 h-10 text-white" />
            </div>
            <div className="absolute inset-0 rounded-full bg-gradient-to-r from-purple-500 to-[#25D366] blur-xl opacity-50" />
          </motion.div>

          {/* Loading text */}
          <div className="text-center">
            <h2 className="text-2xl font-bold gradient-text mb-2">{message}</h2>
            <motion.div
              animate={{ opacity: [0.5, 1, 0.5] }}
              transition={{ duration: 2, repeat: Infinity }}
              className="flex items-center gap-2 text-white/60"
            >
              <Loader2 className="w-4 h-4 animate-spin" />
              <span className="text-sm font-mono">Initializing...</span>
            </motion.div>
          </div>
        </motion.div>
      </div>
    );
  }

  // Inline loading state
  return (
    <div className="flex items-center justify-center p-8">
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        className="flex items-center gap-3"
      >
        <Loader2 className="w-5 h-5 animate-spin text-purple-400" />
        <span className="text-white/80">{message}</span>
      </motion.div>
    </div>
  );
}


