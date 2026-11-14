"use client";

import { useEffect } from "react";
import { AlertTriangle, RefreshCw, Home } from "lucide-react";
import Link from "next/link";
import { isChunkLoadError, reloadForFreshChunks } from "@/lib/errors/chunk-recovery";

export default function ChatError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error("[LedgerChat] Rendering fault:", error);

    // A chunk that failed to load (a deploy, or iOS cutting the network while the person was in the
    // wallet app): reload once the page is in front (lib/errors/chunk-recovery.ts).
    if (isChunkLoadError(error)) {
      reloadForFreshChunks();
      return;
    }

    // Wallet provider crash: reload once. It no longer signs the person out: any error whose message
    // contained "timeout" or "socket" (an XMTP or network timeout too) used to mark the tab signed out and
    // send them to /connect, the same bug app/global-error.tsx dropped earlier.
    const msg = (error?.message || "").toLowerCase();
    const isWalletCrash =
      msg.includes("wagmi") ||
      msg.includes("walletconnect") ||
      msg.includes("connector") ||
      msg.includes("appkit");
    if (isWalletCrash) {
      const key = "chat_provider_reload_attempted";
      try {
        if (sessionStorage.getItem(key)) {
          sessionStorage.removeItem(key);
          return;
        }
        sessionStorage.setItem(key, "1");
      } catch {
        return;
      }
      setTimeout(() => window.location.reload(), 100);
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
        <p className="text-[14px] text-black/50 leading-relaxed mb-6">
          The chat stopped because of an unexpected error. Your wallet, keys and messages are not affected.
        </p>
        {process.env.NODE_ENV !== "production" && (
          <p className="text-[12px] text-red-500 leading-relaxed mb-6 font-mono text-left break-words overflow-hidden whitespace-pre-wrap">
            {error.message}
          </p>
        )}
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
            href="/"
            className="w-full flex items-center justify-center gap-2 py-3 border border-black/10 text-black/60 font-bold text-[11px] uppercase tracking-widest rounded-2xl hover:border-black hover:text-black transition-colors"
          >
            <Home size={12} /> Back to home
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
