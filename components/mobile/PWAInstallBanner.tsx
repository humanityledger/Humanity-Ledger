"use client";

import React, { useEffect, useState } from "react";
import { X, Download, Share } from "lucide-react";

interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed" }>;
}

export function PWAInstallBanner() {
  const [installPrompt, setInstallPrompt] = useState<BeforeInstallPromptEvent | null>(null);
  const [show, setShow] = useState(false);
  const [isIOS, setIsIOS] = useState(false);

  useEffect(() => {
    if (typeof window === "undefined") return;

    // Check if already in standalone PWA mode
    const isStandalone =
      window.matchMedia("(display-mode: standalone)").matches ||
      (window.navigator as unknown as { standalone?: boolean }).standalone === true;

    if (isStandalone) return;

    // Check if dismissed recently (within 7 days)
    const dismissedAt = localStorage.getItem("hl_pwa_dismissed");
    if (dismissedAt && Date.now() - parseInt(dismissedAt, 10) < 7 * 86400000) {
      return;
    }

    const ua = window.navigator.userAgent;
    const isIosDevice = /iPhone|iPad|iPod/i.test(ua);
    setIsIOS(isIosDevice);

    const handleBeforeInstall = (e: Event) => {
      e.preventDefault();
      setInstallPrompt(e as BeforeInstallPromptEvent);
      // Only show banner if user has an active session
      const hasSession =
        document.cookie.includes("system_handshake=") ||
        Boolean(localStorage.getItem("system_session_v2"));
      if (hasSession) {
        setShow(true);
      }
    };

    window.addEventListener("beforeinstallprompt", handleBeforeInstall);

    // For iOS users with an active session, show the helpful Share prompt
    if (isIosDevice) {
      const hasSession =
        document.cookie.includes("system_handshake=") ||
        Boolean(localStorage.getItem("system_session_v2"));
      if (hasSession) {
        const timer = setTimeout(() => setShow(true), 3500);
        return () => clearTimeout(timer);
      }
    }

    return () => {
      window.removeEventListener("beforeinstallprompt", handleBeforeInstall);
    };
  }, []);

  if (!show) return null;

  const handleInstallClick = async () => {
    if (installPrompt) {
      await installPrompt.prompt();
      const choice = await installPrompt.userChoice;
      if (choice.outcome === "accepted") {
        setShow(false);
      }
    }
  };

  const handleDismiss = () => {
    setShow(false);
    localStorage.setItem("hl_pwa_dismissed", Date.now().toString());
  };

  return (
    <div
      role="banner"
      aria-label="Install Ledger Chat"
      style={{
        position: "fixed",
        bottom: "max(16px, env(safe-area-inset-bottom, 16px))",
        left: "16px",
        right: "16px",
        maxWidth: "420px",
        margin: "0 auto",
        zIndex: 9999,
        background: "rgba(17, 19, 24, 0.95)",
        backdropFilter: "blur(16px)",
        WebkitBackdropFilter: "blur(16px)",
        borderRadius: "20px",
        padding: "14px 16px",
        boxShadow: "0 12px 36px rgba(0, 0, 0, 0.28), 0 0 0 1px rgba(255, 255, 255, 0.1)",
        color: "#ffffff",
        display: "flex",
        alignItems: "center",
        gap: "12px",
        fontFamily: "var(--font-inter, sans-serif)",
      }}
    >
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src="/apple-touch-icon.png"
        alt="Ledger Chat"
        width={42}
        height={42}
        style={{ borderRadius: "10px", flexShrink: 0 }}
      />
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ fontSize: "14px", fontWeight: 650, letterSpacing: "-0.01em" }}>
          Install Ledger Chat
        </div>
        <div style={{ fontSize: "12px", color: "rgba(255, 255, 255, 0.72)", marginTop: "2px" }}>
          {isIOS ? (
            <span style={{ display: "inline-flex", alignItems: "center", gap: "4px" }}>
              Tap <Share size={12} strokeWidth={2.4} /> then &quot;Add to Home Screen&quot;
            </span>
          ) : (
            "Fast, private access right from your home screen."
          )}
        </div>
      </div>
      {!isIOS && installPrompt && (
        <button
          type="button"
          onClick={handleInstallClick}
          style={{
            background: "#5200ff",
            color: "#ffffff",
            border: "none",
            borderRadius: "12px",
            padding: "8px 14px",
            fontSize: "12.5px",
            fontWeight: 650,
            cursor: "pointer",
            display: "inline-flex",
            alignItems: "center",
            gap: "5px",
            flexShrink: 0,
          }}
        >
          <Download size={13} strokeWidth={2.4} />
          Install
        </button>
      )}
      <button
        type="button"
        onClick={handleDismiss}
        aria-label="Dismiss"
        style={{
          background: "transparent",
          border: "none",
          color: "rgba(255, 255, 255, 0.6)",
          padding: "6px",
          cursor: "pointer",
          borderRadius: "50%",
          display: "grid",
          placeItems: "center",
          flexShrink: 0,
        }}
      >
        <X size={16} strokeWidth={2.2} />
      </button>
    </div>
  );
}

export default PWAInstallBanner;
