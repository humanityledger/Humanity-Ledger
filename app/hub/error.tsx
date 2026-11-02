"use client";

import { useEffect } from "react";
import { AlertTriangle, RefreshCw, Home } from "lucide-react";
import Link from "next/link";

export default function HubError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error("[Hub] Rendering fault:", error);
  }, [error]);

  return (
    <div className="flex items-center justify-center min-h-screen bg-[#F6F7F9] px-4">
      <div className="w-full max-w-[360px] bg-white rounded-3xl border border-black/5 shadow-xl p-8 flex flex-col items-center text-center">
        <div className="w-14 h-14 rounded-full bg-red-50 flex items-center justify-center mb-5">
          <AlertTriangle size={24} className="text-red-500" />
        </div>
        <h1 className="text-[18px] font-black text-black tracking-tight mb-2">
          Hub Unavailable
        </h1>
        <p className="text-[12px] text-black/40 leading-relaxed mb-6">
          The App Hub encountered a rendering error. Try reloading or reconnecting your wallet.
        </p>
        <div className="flex flex-col w-full gap-2">
          <button
            onClick={() => reset()}
            className="w-full flex items-center justify-center gap-2 py-3 bg-black text-white font-bold text-[11px] uppercase tracking-widest rounded-2xl hover:bg-black/80 transition-colors"
          >
            <RefreshCw size={12} /> Reload Hub
          </button>
          <Link
            href="/connect"
            className="w-full flex items-center justify-center gap-2 py-3 border border-black/10 text-black/60 font-bold text-[11px] uppercase tracking-widest rounded-2xl hover:border-black hover:text-black transition-colors"
          >
            <Home size={12} /> Reconnect
          </Link>
        </div>
      </div>
    </div>
  );
}
