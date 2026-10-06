"use client";

import React from 'react';
import { motion } from 'framer-motion';

interface PremiumCardProps {
  children: React.ReactNode;
  className?: string;
  hover?: boolean;
  glow?: 'purple' | 'green' | 'blue' | 'none';
  gradient?: boolean;
}

export function PremiumCard({
  children,
  className = '',
  hover = true,
  glow = 'none',
  gradient = false
}: PremiumCardProps) {
  
  const glowStyles = {
    purple: 'hover:shadow-purple-500/20',
    green: 'hover:shadow-green-500/20',
    blue: 'hover:shadow-[#25D366]/20',
    none: ''
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.5 }}
      whileHover={hover ? { y: -4 } : {}}
      className={`
        glass-card rounded-2xl p-6
        transition-all duration-300
        ${hover ? 'hover:shadow-2xl' : ''}
        ${glowStyles[glow]}
        ${className}
      `}
    >
      {gradient && (
        <div className="absolute inset-0 bg-gradient-to-br from-purple-500/10 to-transparent rounded-2xl pointer-events-none" />
      )}
      <div className="relative z-10">{children}</div>
    </motion.div>
  );
}


