"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Inter } from "next/font/google";
import { HLLogo } from "@/components/shared/HLLogo";
import { isChunkLoadError, reloadForFreshChunks } from "@/lib/errors/chunk-recovery";

const inter = Inter({ subsets: ["latin"] });

/**
 * Root error boundary. It replaces the whole layout, so it draws with inline styles only.
 *
 * Before (14 Nov 2026): "Fatal Kernel Panic" with the raw stack trace, shown on iPhone when a chunk
 * failed to load after coming back from MetaMask. A chunk error now reloads the page once it is in
 * front (lib/errors/chunk-recovery.ts); the screen below is shown only if that is not possible, and it
 * never shows error text outside development.
 */
export default function GlobalError({ error }: { error: Error & { digest?: string }; reset: () => void }) {
  const chunk = isChunkLoadError(error);
  const [reloading, setReloading] = useState(false);

  useEffect(() => {
    console.error("[HL] Root error:", error);

    // A Server Action from an older build: the page must be loaded again.
    if (error?.message?.includes("Failed to find Server Action") || error?.digest?.includes("Failed to find Server Action")) {
      if (reloadForFreshChunks()) setReloading(true);
      return;
    }

    if (chunk) {
      if (reloadForFreshChunks()) setReloading(true);
      return;
    }

    // Wallet provider crash: reload once to recover it. Never mark the session as signed out here: a crash
    // anywhere (any message containing "timeout") used to set __disconnected__, so the next load showed
    // every page as signed out for the rest of the tab. Signing out is only nuclearDisconnect.
    const msg = (error?.message || "").toLowerCase();
    const isWalletCrash =
      msg.includes("wagmi") ||
      msg.includes("walletconnect") ||
      msg.includes("connector") ||
      msg.includes("appkit") ||
      msg.includes("socket stall") ||
      msg.includes("timeout") ||
      msg.includes("unhandled promise");
    if (isWalletCrash) {
      const key = "global_provider_reload_attempted";
      try {
        if (sessionStorage.getItem(key)) {
          sessionStorage.removeItem(key);
          return;
        }
        sessionStorage.setItem(key, "1");
      } catch {
        return;
      }
      setReloading(true);
      setTimeout(() => window.location.reload(), 100);
    }
  }, [error, chunk]);

  const dev = process.env.NODE_ENV !== "production";
  const title = chunk ? "Ledger Chat was updated" : "Something went wrong";
  const text = chunk
    ? "Part of the page could not load. Reload to get the latest version."
    : "The page stopped because of an unexpected error. Reload to continue.";

  return (
    <html lang="en">
      <body className={inter.className} style={{ margin: 0, background: "#f2f3f5", color: "#0A0A0A" }}>
        <main
          style={{
            minHeight: "100dvh",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            padding: 24,
            boxSizing: "border-box",
          }}
        >
          <div
            style={{
              width: "100%",
              maxWidth: 420,
              background: "#fff",
              border: "1px solid rgba(16,24,40,0.06)",
              borderRadius: 28,
              padding: "40px 28px 32px",
              textAlign: "center",
              boxSizing: "border-box",
            }}
          >
            <div style={{ display: "flex", justifyContent: "center", marginBottom: 24 }}>
              <HLLogo size={44} />
            </div>
            <h1 style={{ margin: 0, fontSize: 22, fontWeight: 600, letterSpacing: "-0.02em" }}>{title}</h1>
            <p style={{ margin: "8px 0 0", fontSize: 15, lineHeight: 1.5, color: "#6b7280" }}>
              {reloading ? "Reloading…" : text} Your wallet, keys and messages are not affected.
            </p>

            {dev && error?.message ? (
              <pre
                style={{
                  margin: "16px 0 0",
                  padding: "8px 12px",
                  textAlign: "left",
                  fontSize: 12,
                  whiteSpace: "pre-wrap",
                  wordBreak: "break-word",
                  background: "#f9fafb",
                  border: "1px solid #e5e7eb",
                  borderRadius: 12,
                  color: "#4b5563",
                }}
              >
                {error.message}
                {error.digest ? ` (digest ${error.digest})` : ""}
              </pre>
            ) : null}

            <div style={{ marginTop: 28, display: "flex", gap: 12, justifyContent: "center" }}>
              <button
                type="button"
                onClick={() => window.location.reload()}
                style={{
                  height: 44,
                  padding: "0 22px",
                  borderRadius: 999,
                  border: "none",
                  background: "#0A0A0A",
                  color: "#fff",
                  fontSize: 15,
                  fontWeight: 600,
                  cursor: "pointer",
                  fontFamily: "inherit",
                }}
              >
                Reload
              </button>
              <Link
                href="/"
                style={{
                  height: 44,
                  padding: "0 22px",
                  borderRadius: 999,
                  border: "1px solid #e5e7eb",
                  color: "#0A0A0A",
                  fontSize: 15,
                  fontWeight: 600,
                  display: "inline-flex",
                  alignItems: "center",
                  textDecoration: "none",
                  boxSizing: "border-box",
                }}
              >
                Home
              </Link>
            </div>
          </div>
        </main>
      </body>
    </html>
  );
}
