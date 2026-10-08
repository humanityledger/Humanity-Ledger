'use client';

import { motion } from 'framer-motion';

/**
 * MetaMask-inspired interface component
 * Glassmorphism design with scroll-based opacity.
 * Optimized for Mobile First.
 */
export function MetaMaskInterface({ onConnect }: { onConnect?: () => void }) {
  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.95 }}
      animate={{ opacity: 1, scale: 1 }}
      transition={{ duration: 0.8, ease: 'easeOut' }}
      className="relative z-10 w-full max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 mt-12 sm:mt-0"
    >
      <div className="glass-pearl rounded-3xl p-6 sm:p-12 border border-white/[0.05] text-center backdrop-blur-xl bg-black/30">
        {/* Header */}
        <motion.h1
          className="text-4xl sm:text-6xl font-bold text-white mb-4 sm:mb-6 tracking-tight leading-tight"
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.2 }}
        >
          Welcome to <br className="sm:hidden" />
          <span className="text-cyan-400">Humanity Ledger</span>
        </motion.h1>

        {/* Subtitle */}
        <motion.p
          className="text-base sm:text-xl text-zinc-300 mb-8 sm:mb-12 max-w-2xl mx-auto leading-relaxed"
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.4 }}
        >
          Your system digital identity, protected by zero knowledge proofs.
          <br className="hidden sm:block" /> No seed phrases, just biometric verification.
        </motion.p>

        {/* CTA Button */}
        <motion.button
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.6 }}
          whileHover={{ scale: 1.05 }}
          whileTap={{ scale: 0.95 }}
          onClick={onConnect}
          className="w-full sm:w-auto px-8 py-4 bg-gradient-to-r from-cyan-600 to-emerald-600 text-white font-bold rounded-2xl shadow-lg shadow-cyan-900/40 hover:shadow-cyan-500/50 transition-all cursor-pointer z-50 text-lg"
        >
          Connect Identity
        </motion.button>

        {/* Feature Pills */}
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.8 }}
          className="flex items-center justify-center gap-2 sm:gap-4 mt-8 flex-wrap"
        >
          {['Biometric Auth', 'ZK-Proofs', 'Self-System'].map((feature, i) => (
            <span
              key={i}
              className="px-3 py-1.5 sm:px-4 sm:py-2 bg-white/[0.05] border border-white/[0.1] rounded-full text-xs sm:text-sm text-zinc-300 backdrop-blur-sm"
            >
              {feature}
            </span>
          ))}
        </motion.div>
      </div>
    </motion.div>
  );
}

