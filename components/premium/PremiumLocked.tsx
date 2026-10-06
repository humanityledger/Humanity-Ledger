"use client";

import { motion } from 'framer-motion';
import { Lock, Crown, Sparkles, TrendingUp, Zap } from 'lucide-react';

interface PremiumLockedProps {
  feature: string;
  description: string;
  icon?: 'lock' | 'crown' | 'sparkles' | 'trending' | 'zap';
  onUpgrade: () => void;
}

export default function PremiumLocked({ 
  feature, 
  description, 
  icon = 'lock',
  onUpgrade 
}: PremiumLockedProps) {
  
  const icons = {
    lock: Lock,
    crown: Crown,
    sparkles: Sparkles,
    trending: TrendingUp,
    zap: Zap,
  };
  
  const IconComponent = icons[icon];

  return (
    <div className="relative min-h-[600px] flex items-center justify-center overflow-hidden">
      {/* Animated Background Grid */}
      <div className="absolute inset-0 bg-gradient-to-br from-black via-gray-900 to-black">
        <div className="absolute inset-0 opacity-20">
          <div className="absolute inset-0" style={{
            backgroundImage: `
              linear-gradient(rgba(139, 92, 246, 0.1) 1px, transparent 1px),
              linear-gradient(90deg, rgba(139, 92, 246, 0.1) 1px, transparent 1px)
            `,
            backgroundSize: '50px 50px'
          }} />
        </div>
        
        {/* Gradient Orbs */}
        <motion.div
          className="absolute top-1/4 left-1/4 w-96 h-96 bg-purple-500/20 rounded-full blur-3xl"
          animate={{
            scale: [1, 1.2, 1],
            opacity: [0.3, 0.5, 0.3],
          }}
          transition={{
            duration: 8,
            repeat: Infinity,
            ease: "easeInOut"
          }}
        />
        <motion.div
          className="absolute bottom-1/4 right-1/4 w-96 h-96 bg-[#25D366]/20 rounded-full blur-3xl"
          animate={{
            scale: [1.2, 1, 1.2],
            opacity: [0.5, 0.3, 0.5],
          }}
          transition={{
            duration: 8,
            repeat: Infinity,
            ease: "easeInOut",
            delay: 1
          }}
        />
      </div>

      {/* Content */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.6 }}
        className="relative z-10 text-center max-w-md mx-auto px-6"
      >
        {/* Icon with Glow */}
        <motion.div
          className="relative inline-block mb-8"
          animate={{
            y: [0, -10, 0],
          }}
          transition={{
            duration: 3,
            repeat: Infinity,
            ease: "easeInOut"
          }}
        >
          <div className="absolute inset-0 bg-gradient-to-br from-purple-500 to-[#25D366] rounded-full blur-2xl opacity-50" />
          <div className="relative bg-gradient-to-br from-purple-500 via-purple-600 to-blue-600 p-8 rounded-3xl shadow-2xl">
            <IconComponent className="w-16 h-16 text-white" strokeWidth={1.5} />
          </div>
          
          {/* Sparkle Effects */}
          <motion.div
            className="absolute -top-2 -right-2 text-yellow-400"
            animate={{
              scale: [1, 1.3, 1],
              rotate: [0, 180, 360],
            }}
            transition={{
              duration: 4,
              repeat: Infinity,
            }}
          >
            <Sparkles className="w-6 h-6" />
          </motion.div>
        </motion.div>

        {/* Title */}
        <h2 className="text-4xl font-black text-white mb-4 tracking-tight">
          {feature}
        </h2>

        {/* Description */}
        <p className="text-gray-400 text-base mb-8 leading-relaxed font-medium">
          {description}
        </p>

        {/* Features List */}
        <div className="mb-8 space-y-3">
          {[
            'Unlimited access to all features',
            'Real-time data & analytics',
            'Priority support',
            'Advanced ledger tracking'
          ].map((item, i) => (
            <motion.div
              key={i}
              initial={{ opacity: 0, x: -20 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: 0.2 + i * 0.1 }}
              className="flex items-center justify-center gap-2 text-sm text-gray-300"
            >
              <div className="w-1.5 h-1.5 rounded-full bg-gradient-to-r from-purple-500 to-[#25D366]" />
              <span>{item}</span>
            </motion.div>
          ))}
        </div>

        {/* CTA Button */}
        <motion.button
          onClick={onUpgrade}
          whileHover={{ scale: 1.05 }}
          whileTap={{ scale: 0.95 }}
          className="group relative w-full overflow-hidden"
        >
          <div className="absolute inset-0 bg-gradient-to-r from-purple-600 via-purple-500 to-blue-600 rounded-2xl blur-xl opacity-75 group-hover:opacity-100 transition-opacity" />
          <div className="relative bg-gradient-to-r from-purple-600 via-purple-500 to-blue-600 text-white px-8 py-4 rounded-2xl font-black text-sm uppercase tracking-widest shadow-2xl flex items-center justify-center gap-2">
            <Crown className="w-5 h-5" />
            Upgrade to Premium
            <motion.div
              animate={{ x: [0, 5, 0] }}
              transition={{ duration: 1.5, repeat: Infinity }}
            >
              
            </motion.div>
          </div>
        </motion.button>

        {/* Subtle Badge */}
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.8 }}
          className="mt-6 text-xs text-gray-500 font-bold uppercase tracking-widest"
        >
          Premium Feature
        </motion.div>
      </motion.div>
    </div>
  );
}


