"use client";

import { motion } from "framer-motion";
import { UniversalEliteWallpaper } from "@/components/shared/UniversalEliteWallpaper";
import { Shield } from "lucide-react";

interface LegendaryLoaderProps {
    title: string;
    subtitle?: string;
}

export function LegendaryLoader({ title, subtitle }: LegendaryLoaderProps) {
    return (
        <div className="fixed inset-0 z-[999] flex items-center justify-center bg-black/95 backdrop-blur-3xl overflow-hidden">
            <UniversalEliteWallpaper />
            
            <div className="relative z-10 flex flex-col items-center">
                <motion.div
                    initial={{ scale: 0.8, opacity: 0 }}
                    animate={{ scale: 1, opacity: 1 }}
                    transition={{ 
                        duration: 1, 
                        ease: [0.16, 1, 0.3, 1],
                        repeat: Infinity,
                        repeatType: "reverse"
                    }}
                    className="mb-8"
                >
                    <div className="relative">
                        <div className="absolute inset-0 bg-[#25D366]/10 blur-2xl rounded-full animate-pulse" />
                        <Shield size={64} className="text-slate-900 relative z-10 drop-shadow-[0_0_15px_rgba(0,0,0,0.1)]" />
                    </div>
                </motion.div>

                <motion.h2 
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: 0.2 }}
                    className="text-2xl md:text-4xl font-aztec-serif font-black text-white tracking-tighter uppercase mb-2 text-center"
                >
                    {title}
                </motion.h2>

                {subtitle && (
                    <motion.p
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        transition={{ delay: 0.4 }}
                        className="text-[10px] md:text-xs font-bold text-[var(--aztec-chartreuse)] tracking-[0.4em] uppercase text-center"
                    >
                        {subtitle}
                    </motion.p>
                )}

                {/* Progress Bar Animation */}
                <div className="mt-12 w-48 h-[2px] bg-slate-200 rounded-full overflow-hidden">
                    <motion.div 
                        initial={{ x: "-100%" }}
                        animate={{ x: "100%" }}
                        transition={{ 
                            duration: 2, 
                            repeat: Infinity, 
                            ease: "easeInOut" 
                        }}
                        className="w-full h-full bg-gradient-to-r from-transparent via-emerald-400 to-transparent"
                    />
                </div>
            </div>
        </div>
    );
}


