"use client";

import { toast } from "sonner";

import { motion } from "framer-motion";
import { ShieldCheck, Wallet } from "lucide-react";
import { useState } from "react";
import { useRouter } from "next/navigation";


export default function GlassLogin() {
    // const [isDiving, setIsDiving] = useState(false);
    // const router = useRouter();

    // This function runs INSIDE the World ID widget (loading state)
    /*
    const verifyProof = async (proof: any) => {
        try {
            const res = await fetch("/api/auth/verify-world-id", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify(proof),
            });

            if (!res.ok) {
                const data = await res.json();

                // Common configuration errors (HTML response)
                if (data.error?.includes("Upstream API Error") || data.error?.includes("Non-JSON")) {
                    const status = data.status || "Unknown";
                    throw new Error(`API Config Error (Status: ${status}). Check AUTH_APP_ID.`);
                }

                throw new Error(data.error || "Verification failed");
            }

            return; // Success (widget will show green tick)

        } catch (error: any) {
            console.error(error);
            throw new Error(error.message || "Verification Failed"); // Widget will show error
        }
    };
    */

    // This function runs AFTER the widget shows success
    /*
    const onWidgetSuccess = () => {
        toast.dismiss();
        toast.success("Identity Verified: Human confirmed");

        // Animación y Redirección
        setIsDiving(true);

        // Reducing wait time for agility
        setTimeout(() => {
            router.push("/markets");
        }, 1500);
    };
    */

    const diveVariants = {
        initial: {
            opacity: 0,
            scale: 0.95,
            y: 20
        },
        animate: {
            opacity: 1,
            scale: 1,
            y: 0,
            transition: { duration: 0.8, ease: [0.16, 1, 0.3, 1] as const }
        },
        diving: {
            scale: 10,      // Massive scale up to simulate entering "into" the card
            opacity: 0,     // Fade out as we get too close
            filter: "blur(10px)",
            transition: { duration: 2.5, ease: "easeInOut" } as const
        }
    };

    return (
        <motion.div
            variants={diveVariants}
            initial="initial"
            animate="animate"
            className="relative w-full max-w-[340px] overflow-hidden rounded-3xl border border-white/10 bg-gray-900/30 backdrop-blur-2xl shadow-2xl ring-1 ring-white/5"
        >
            {/* Top glow effect */}
            <div className="absolute top-0 left-1/2 -translate-x-1/2 w-1/2 h-[2px] bg-gradient-to-r from-transparent via-emerald-400/50 to-transparent blur-sm" />

            {/* Main Content */}
            <div className="flex flex-col items-center p-8 pt-10">

                {/* Titles / Header (Simplified) */}
                <div className="text-center space-y-1 mb-6">
                    <h1 className="text-xl font-bold text-white tracking-tight">
                        Polymarket Wallet
                    </h1>
                </div>

                {/* Subtle Separator */}
                <div className="w-full h-px bg-gradient-to-r from-transparent via-white/10 to-transparent mb-8" />

                {/* Small Footer */}
                <p className="mt-6 text-[10px] text-gray-500 text-center font-medium">
                    Secured by World ID & Blockchain
                </p>
            </div>
        </motion.div>
    );
}
