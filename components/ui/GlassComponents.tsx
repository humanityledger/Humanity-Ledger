"use client";

import React from "react";
import { cn } from "@/lib/utils";
import { motion, HTMLMotionProps } from "framer-motion";

// --- GLASS CARD (Base) ---
interface GlassCardProps extends HTMLMotionProps<"div"> {
    children: React.ReactNode;
    className?: string;
    variant?: "glass" | "solid";
}

export const GlassCard = ({ children, className, variant = "glass", ...props }: GlassCardProps) => {
    const baseStyles = "rounded-3xl p-6 relative overflow-hidden transition-all duration-300";
    const variants = {
        glass: "bg-surface/40 backdrop-blur-xl border border-glass-border hover:border-white/10",
        solid: "bg-surface border border-neutral-900",
    };

    return (
        <motion.div
            className={cn(baseStyles, variants[variant], className)}
            {...props}
        >
            {children}
        </motion.div>
    );
};

// --- GLASS INPUT ---
interface GlassInputProps extends React.InputHTMLAttributes<HTMLInputElement> {
    label?: string;
}

export const GlassInput = ({ label, className, ...props }: GlassInputProps) => {
    return (
        <div className="space-y-1.5 w-full">
            {label && (
                <label className="text-xs font-mono text-neutral-500 uppercase tracking-wider ml-1">
                    {label}
                </label>
            )}
            <input
                className={cn(
                    "w-full bg-surface/50 border border-glass-border rounded-xl px-4 py-3 text-white placeholder-neutral-700 focus:outline-none focus:border-white/20 focus:ring-1 focus:ring-white/10 transition-all font-mono",
                    className
                )}
                {...props}
            />
        </div>
    );
};

// --- PRIMARY BUTTON ---
interface PrimaryButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
    glow?: boolean;
}

export const PrimaryButton = ({ children, className, glow = false, ...props }: PrimaryButtonProps) => {
    return (
        <button
            className={cn(
                "rounded-xl font-medium transition-all active:scale-[0.98] flex items-center justify-center gap-2 relative overflow-hidden px-5 py-2.5 text-sm bg-white text-black hover:bg-neutral-200",
                glow && "shadow-[0_0_20px_rgba(255,255,255,0.3)]",
                className
            )}
            {...props}
        >
            {children}
        </button>
    );
};

// --- GLASS BADGE ---
export const GlassBadge = ({ children, color = "blue" }: { children: React.ReactNode, color?: "blue" | "purple" | "green" | "red" }) => {
    const colors = {
        blue: "bg-[#25D366]/10 text-emerald-200 border-[#25D366]/20",
        purple: "bg-purple-500/10 text-purple-200 border-purple-500/20",
        green: "bg-green-500/10 text-green-200 border-green-500/20",
        red: "bg-red-500/10 text-red-200 border-red-500/20",
    };

    return (
        <span className={cn("px-2 py-1 rounded-lg text-xs font-semibold border backdrop-blur-md", colors[color])}>
            {children}
        </span>
    );
};

// --- PROGRESS BAR ---
export const ProgressBar = ({ value, color = "cyan" }: { value: number, color?: string }) => (
    <div className="h-2 w-full bg-black/20 rounded-full overflow-hidden">
        <motion.div
            initial={{ width: 0 }}
            animate={{ width: `${value}%` }}
            transition={{ duration: 1, delay: 0.2 }}
            className={cn("h-full rounded-full shadow-[0_0_10px_rgba(34,211,238,0.5)]",
                color === "cyan" ? "bg-cyan-400" : "bg-purple-400"
            )}
        />
    </div>
);


