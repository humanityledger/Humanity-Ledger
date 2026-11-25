"use client";

import React, { Component, ErrorInfo, ReactNode } from "react";
import { t } from '@/lib/i18n/client';

interface Props {
  children: ReactNode;
}

interface State {
  hasError: boolean;
  error?: Error;
  errorCount: number;
}

export class GlobalErrorBoundary extends Component<Props, State> {
  public state: State = {
    hasError: false,
    errorCount: 0,
  };

  public static getDerivedStateFromError(error: Error): Partial<State> {
    return { hasError: true, error };
  }

  public componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error("[Global Error Boundary] Caught exception:", error, errorInfo);
    this.setState(prev => ({ errorCount: prev.errorCount + 1 }));
  }

  private handleReset = () => {
    this.setState({ hasError: false, error: undefined });
    // Clear any stale wagmi / appkit state that could be causing the crash
    try { sessionStorage.removeItem('WAGMI_CONNECTED'); } catch {}
    try { sessionStorage.removeItem('__enclave_clearance_v2__'); } catch {}
    window.location.reload();
  };

  private handleGoConnect = () => {
    // Purge everything to break the reload loop
    try { sessionStorage.clear(); } catch {}
    try { localStorage.removeItem('__disconnected__'); } catch {}
    try { localStorage.removeItem('system_session_v2'); } catch {}
    
    if (window.location.pathname === "/connect") {
      window.location.href = "/?t=" + Date.now();
    } else {
      window.location.href = "/connect";
    }
  };

  private handleGoHome = () => {
    window.location.href = "/";
  };

  public render() {
    if (this.state.hasError) {
      const errorMsg = this.state.error?.message || "Unknown module error";
      // Check if this looks like a ChunkLoad error (stale deployment)
      const isChunkError = /chunk|dynamically imported|loading chunk/i.test(errorMsg);

      return (
        <div
          style={{
            minHeight: "100vh",
            background: "#fff",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            padding: "24px",
            fontFamily: "'Inter', -apple-system, BlinkMacSystemFont, sans-serif",
          }}
        >
          <div
            style={{
              maxWidth: "400px",
              width: "100%",
              background: "#fff",
              border: "1px solid rgba(0,0,0,0.08)",
              borderRadius: "24px",
              padding: "36px 28px",
              boxShadow: "0 32px 80px rgba(0,0,0,0.1)",
              position: "relative",
              overflow: "hidden",
            }}
          >
            {/* Ambient gradient */}
            <div style={{
              position: "absolute",
              top: "50%",
              left: "50%",
              transform: "translate(-50%,-50%)",
              width: "240px",
              height: "240px",
              background: "radial-gradient(circle, rgba(239,68,68,0.06) 0%, transparent 70%)",
              borderRadius: "50%",
              pointerEvents: "none",
            }} />

            <div style={{ position: "relative", zIndex: 1, display: "flex", flexDirection: "column", alignItems: "center", textAlign: "center" }}>
              {/* Icon */}
              <div style={{
                width: "64px",
                height: "64px",
                background: "rgba(239,68,68,0.08)",
                border: "1px solid rgba(239,68,68,0.15)",
                borderRadius: "50%",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                marginBottom: "20px",
              }}>
                <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="rgb(239,68,68)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/>
                  <line x1="12" y1="8" x2="12" y2="12"/>
                  <line x1="12" y1="16" x2="12.01" y2="16"/>
                </svg>
              </div>

              <h1 style={{
                fontSize: "20px",
                fontWeight: 900,
                color: "#0A0A0A",
                letterSpacing: "-0.02em",
                marginBottom: "8px",
                textTransform: "uppercase",
              }}>
                {isChunkError ? t("Update Required") : t("System Error")}
              </h1>

              <p style={{
                fontSize: "11px",
                color: "rgba(0,0,0,0.4)",
                fontFamily: "monospace",
                textTransform: "uppercase",
                letterSpacing: "0.15em",
                lineHeight: 1.6,
                marginBottom: "28px",
              }}>
                {isChunkError
                  ? t("New version deployed. Tap below to reload.")
                  : t("Module decoupling error. System state preserved.")}
              </p>

              {/* Buttons */}
              <div style={{ width: "100%", display: "flex", flexDirection: "column", gap: "10px" }}>
                {/* Primary: Go to Connect (most helpful on mobile) */}
                <button
                  onClick={this.handleGoConnect}
                  style={{
                    width: "100%",
                    height: "52px",
                    background: "#0A0A0A",
                    color: "#fff",
                    border: "none",
                    borderRadius: "14px",
                    fontSize: "11px",
                    fontWeight: 900,
                    textTransform: "uppercase",
                    letterSpacing: "0.15em",
                    cursor: "pointer",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    gap: "8px",
                  }}
                >
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M15 3h4a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2h-4"/>
                    <polyline points="10 17 15 12 10 7"/>
                    <line x1="15" y1="12" x2="3" y2="12"/>
                  </svg>
                  {t("Connect Wallet")}
                </button>

                {/* Secondary: Reload */}
                <button
                  onClick={this.handleReset}
                  style={{
                    width: "100%",
                    height: "48px",
                    background: "transparent",
                    color: "#0A0A0A",
                    border: "1px solid rgba(0,0,0,0.1)",
                    borderRadius: "14px",
                    fontSize: "11px",
                    fontWeight: 900,
                    textTransform: "uppercase",
                    letterSpacing: "0.15em",
                    cursor: "pointer",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    gap: "8px",
                  }}
                >
                  <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                    <polyline points="23 4 23 10 17 10"/>
                    <path d="M20.49 15a9 9 0 1 1-2.12-9.36L23 10"/>
                  </svg>
                  {t("Reload System")}
                </button>

                {/* Tertiary: Home */}
                <button
                  onClick={this.handleGoHome}
                  style={{
                    width: "100%",
                    height: "44px",
                    background: "transparent",
                    color: "rgba(0,0,0,0.35)",
                    border: "none",
                    borderRadius: "14px",
                    fontSize: "10px",
                    fontWeight: 700,
                    textTransform: "uppercase",
                    letterSpacing: "0.15em",
                    cursor: "pointer",
                  }}
                >
                  {t("Return to Landing")}
                </button>
              </div>

              {/* Error detail */}
              <div style={{
                marginTop: "24px",
                width: "100%",
                background: "rgba(0,0,0,0.02)",
                border: "1px solid rgba(0,0,0,0.05)",
                borderRadius: "10px",
                padding: "12px 14px",
                textAlign: "left",
              }}>
                <div style={{ fontSize: "8px", fontFamily: "monospace", textTransform: "uppercase", letterSpacing: "0.3em", color: "rgba(0,0,0,0.3)", marginBottom: "6px" }}>
                  {t("Error Integrity")}
                </div>
                <div style={{ fontSize: "9px", fontFamily: "monospace", color: "rgba(0,0,0,0.35)", wordBreak: "break-all", lineHeight: 1.5 }}>
                  {errorMsg.slice(0, 120)}
                </div>
              </div>
            </div>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}
