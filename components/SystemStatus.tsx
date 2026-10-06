"use client";

import { useEffect, useState } from "react";
import { Activity } from "lucide-react";

export default function SystemStatus() {
    const [mounted, setMounted] = useState(false);

    useEffect(() => {
        setMounted(true);
    }, []);

    if (!mounted) return null;

    return (
        <div className="flex items-center gap-2 text-[10px] uppercase tracking-widest text-[#25D366]/80 font-mono">
            <Activity size={12} className="animate-pulse" />
            <span>System Normal | v2.0</span>
        </div>
    );
}


