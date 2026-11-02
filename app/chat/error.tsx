"use client";

import { useEffect } from "react";
import { AlertTriangle, RefreshCw, Home } from "lucide-react";
import Link from "next/link";

export default function ChatError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error("[LedgerChat] Rendering fault:", error);

    const msg = (error?.message || "").toLowerCase();
    const isWagmi =
      msg.includes("wagmi") ||
      msg.includes("walletconnect") ||
      msg.includes("connector") ||
      msg.includes("appkit") ||
      msg.includes("timeout") ||
      msg.includes("socket");
    if (isWagmi) {
      try {
        sessionStorage.setItem("__disconnected__", "1");
        localStorage.removeItem("system_session_v2");
      } catch {}
      setTimeout(() => window.location.replace("/connect"), 100);
      return;
    }

    const isChunk =
      error?.name === "ChunkLoadError" ||
      msg.includes("loading chunk") ||
      msg.includes("dynamically imported module");
    if (isChunk) {
      try {
        if (!sessionStorage.getItem("chat_chunk_reload")) {
          sessionStorage.setItem("chat_chunk_reload", "1");
          window.location.reload();
        } else {
          sessionStorage.removeItem("chat_chunk_reload");
        }
      } catch {}
    }
  }, [error]);

  return (
    <div className="flex items-center justify-center min-h-screen bg-[#F2F2F7] px-4">
      <div className="w-full max-w-[360px] bg-white rounded-3xl border border-black/5 shadow-xl p-8 flex flex-col items-center text-center">
        <div className="w-14 h-14 rounded-full bg-red-50 flex items-center justify-center mb-5">
          <AlertTriangle size={24} className="text-red-500" />
        </div>
        <h1 className="text-[18px] font-black text-black tracking-tight mb-2">
          Chat Unavailable
        </h1>
        <p className="text-[12px] text-red-500 leading-relaxed mb-6 font-mono text-left break-words overflow-hidden whitespace-pre-wrap">
          {error.message}
          <br/>
          {error.stack}
        </p>
        {error.digest && (
          <div className="w-full bg-black/[0.03] rounded-xl border border-black/5 p-3 mb-6 text-left">
            <span className="text-[9px] font-mono uppercase tracking-widest text-black/30 block mb-1">
              Fault ID
            </span>
            <span className="text-[10px] font-mono text-black/50">{error.digest}</span>
          </div>
        )}
        <div className="flex flex-col w-full gap-2">
          <button
            onClick={() => reset()}
            className="w-full flex items-center justify-center gap-2 py-3 bg-black text-white font-bold text-[11px] uppercase tracking-widest rounded-2xl hover:bg-black/80 transition-colors"
          >
            <RefreshCw size={12} /> Reload Chat
          </button>
          <Link
            href="/hub"
            className="w-full flex items-center justify-center gap-2 py-3 border border-black/10 text-black/60 font-bold text-[11px] uppercase tracking-widest rounded-2xl hover:border-black hover:text-black transition-colors"
          >
            <Home size={12} /> Back to Hub
          </Link>
          <Link
            href="/connect"
            className="text-[9px] font-mono text-black/25 hover:text-black transition-colors mt-1 uppercase tracking-widest"
          >
            Reconnect wallet
          </Link>
        </div>
      </div>
    </div>
  );
}
