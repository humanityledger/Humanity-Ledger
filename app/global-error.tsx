"use client";

import { useEffect } from "react";
import { AlertTriangle, RefreshCw } from "lucide-react";
import { Inter } from 'next/font/google';

const inter = Inter({ subsets: ['latin'] });

export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string }
  reset: () => void
}) {
  useEffect(() => {
    console.error("Global Application Fault:", error);
    
    // [ABYSMALLY COMPLEX OPTIMIZATION]: Auto-heal Next.js Server Action mismatch
    if (error?.message?.includes("Failed to find Server Action") || error?.digest?.includes("Failed to find Server Action")) {
      console.warn("Server Action Desync Detected. Initiating auto-reload...");
      window.location.reload();
      return;
    }

    // [ABYSMALLY COMPLEX OPTIMIZATION]: Auto-heal ChunkLoadError (Stale build cache)
    const isChunkError =
      error?.name === 'ChunkLoadError' ||
      error?.message?.includes('Loading chunk') ||
      error?.message?.includes('Failed to fetch dynamically imported module') ||
      error?.message?.includes('Importing a module script failed');

    if (isChunkError) {
      const reloadKey = 'global_root_chunk_reload_attempted';
      try {
        if (!sessionStorage.getItem(reloadKey)) {
          sessionStorage.setItem(reloadKey, '1');
          console.warn('Global Root ChunkLoadError detected. Initiating auto-reload to fetch fresh chunks...');
          window.location.reload();
        } else {
          sessionStorage.removeItem(reloadKey);
        }
      } catch (e) {
        console.error("Session storage failed during chunk reload", e);
      }
    }
    // [ABYSMALLY COMPLEX OPTIMIZATION]: Auto-heal Wagmi / WalletConnect Provider Crashes
    const msg = (error?.message || '').toLowerCase();
    const isWagmiCrash = msg.includes('wagmi') || 
                         msg.includes('walletconnect') || 
                         msg.includes('connector') || 
                         msg.includes('appkit') ||
                         msg.includes('socket stall') ||
                         msg.includes('timeout') ||
                         msg.includes('unhandled promise');
    if (isWagmiCrash) {
      console.warn("WalletConnect/Wagmi Provider crashed. Purging session to prevent white screen of death...");
      try {
        sessionStorage.setItem('__disconnected__', '1');
        localStorage.removeItem('system_session_v2');
      } catch {}
      // We wait a tiny bit so logs can flush, then reload
      setTimeout(() => window.location.reload(), 100);
      return;
    }
  }, [error]);

  return (
    <html lang="en">
      <body className={`${inter.className} bg-transparent text-[#050505] dark:text-[#FFFFFF] antialiased`}>
        <div className="flex flex-col items-center justify-center min-h-screen space-y-8 text-center px-4">
          
          <div className="relative z-10 w-full max-w-lg p-10 bg-white border border-black/5 rounded-[2.5rem] shadow-2xl flex flex-col items-center">
            <div className="w-20 h-20 rounded-full bg-[#FF3B30]/10 text-[#FF3B30] flex items-center justify-center mb-6 ring-[12px] ring-[#FF3B30]/5">
              <AlertTriangle size={40} />
            </div>

            <h1 className="text-3xl font-black text-black uppercase tracking-widest mb-3">
              Fatal Kernel Panic
            </h1>
            
            <p className="text-sm font-bold text-black/50 leading-relaxed mb-8 max-w-sm">
              The System Terminal encountered a critical root fault in the React mounting tree. The system halted to prevent state corruption.
            </p>
            <pre className="w-full text-left text-[10px] text-red-500 font-mono bg-red-50 rounded-xl px-4 py-3 mb-8 overflow-x-auto whitespace-pre-wrap break-all border border-red-100">
              {error.message}
              {error.stack ? `\n\n${error.stack}` : ''}
            </pre>

            {error.digest && (
              <div className="w-full bg-black/5 rounded-2xl p-4 mb-8 border border-black/10 flex items-center justify-between">
                <span className="text-[11px] font-black uppercase tracking-[0.2em] text-black/40">Fault Digest ID:</span>
                <span className="text-xs font-mono font-bold text-[#FF3B30] bg-[#FF3B30]/10 px-2 py-0.5 rounded">{error.digest}</span>
              </div>
            )}

            <button 
              onClick={() => reset()}
              className="w-full flex items-center justify-center gap-2 px-6 py-4 bg-black hover:bg-black/90 text-white text-xs font-black uppercase tracking-[0.2em] rounded-2xl transition-all shadow-xl shadow-black/10 hover:shadow-black/20 hover:-translate-y-0.5 active:translate-y-0"
            >
              <RefreshCw size={16} className="opacity-50" />
              Force Terminal Restart
            </button>
            <p className="mt-6 text-[10px] font-black text-black/20 uppercase tracking-widest">
              Action forces complete DOM remount
            </p>
          </div>
        </div>
      </body>
    </html>
  );
}
