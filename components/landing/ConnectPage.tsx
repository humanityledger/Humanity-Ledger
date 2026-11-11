"use client";

/**
 * /connect — sign-in for Ledger Chat.
 *
 * This file owns the behaviour: wallet connection, the SIWE signature, the
 * phone-to-computer QR handshake and the redirect into the app. Everything
 * the visitor sees is drawn by components/connect/ConnectView.tsx from the
 * stage computed here.
 *
 * Changes in this revision, beyond the visual rebuild:
 *
 *  - The QR handshake only starts when the visitor asks for it. Before, every
 *    visit to /connect generated a session and polled /api/auth/qr-poll once a
 *    second for as long as the tab stayed open, even though the desktop layout
 *    never rendered the code. At scale that was most of the load on the auth
 *    routes. Polling now runs every two seconds, and only while the QR view is
 *    open and the code has not expired.
 *
 *  - The "12,135 registered members" figure is gone. It was the fallback
 *    shown whenever /api/metrics/users did not answer, so most visitors saw a
 *    number nobody had measured.
 *
 *  - "Protected by Privy" is gone. The project uses wagmi and Reown AppKit.
 *
 *  - The pre-ticked age checkbox is gone. A pre-ticked box is not consent, and
 *    it never blocked anything. The age and terms statement is now a sentence
 *    next to the actions, which is what it effectively was.
 *
 * The SIWE flow itself is unchanged from the fix on 21 October 2026.
 */

import React, { useCallback, useEffect, useRef, useState } from "react";
import dynamic from "next/dynamic";
import { useAccount, useChainId, useConnect, useSignMessage } from "wagmi";
import { SiweMessage } from "siwe";
import { useAppKit } from "@reown/appkit/react";
import { allowAutoRedirect, clearLocalSessionMarkers, hasServerSession } from "@/lib/auth/session-check";
import { toast } from "sonner";
import { QRCodeSVG } from "qrcode.react";
import { useUIStore } from "@/lib/store/ui-store";
import { useSystemSignOut } from "@/hooks/useSystemSignOut";
import { EmailLoginModal } from "@/components/auth/EmailLoginModal";
import { useDynamicIsland } from "@/lib/store/dynamic-island-store";
import { ConnectView, type ConnectStage, type WalletOption } from "@/components/connect/ConnectView";

import { safeReturnPath } from "@/lib/security/safeRedirect";
import { withSignTimeout } from "@/lib/auth/sign-timeout";
import { purgeLegacyHandshakeSecrets } from "@/lib/scan/sessionHandshake";

/** A signature request with no answer after this long is abandoned; a late answer is ignored. */
const SIGN_TIMEOUT_MS = 120_000;
const DynamicUniversalScanModal = dynamic(() => import("@/components/scan/UniversalScanModal"), { ssr: false });

const QR_LIFETIME_MS = 240_000;
const QR_POLL_MS = 2_000;

function useIsMobile() {
  const [isMobile, setIsMobile] = useState(false);
  useEffect(() => {
    const ua = typeof navigator !== "undefined" ? navigator.userAgent : "";
    // iPadOS Safari reports a Mac user agent; touch support tells them apart (no wallet extensions there).
    const iPadOS = /Macintosh/.test(ua) && typeof navigator !== "undefined" && navigator.maxTouchPoints > 1;
    setIsMobile(iPadOS || /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini|Mobile/i.test(ua));
  }, []);
  return isMobile;
}

interface DesktopWallet extends WalletOption {
  rdns: string;
  installUrl: string;
}

const DESKTOP_WALLETS: DesktopWallet[] = [
  { id: "metamask", name: "MetaMask", hint: "Browser extension", logo: "/wallets/metamask.svg", rdns: "io.metamask", installUrl: "https://metamask.io/download/" },
  { id: "coinbase", name: "Coinbase Wallet", hint: "Browser extension", logo: "/wallets/coinbase.png", rdns: "com.coinbase.wallet", installUrl: "https://www.coinbase.com/wallet" },
  { id: "rainbow", name: "Rainbow", hint: "Browser extension", logo: "/wallets/rainbow.png", rdns: "me.rainbow", installUrl: "https://rainbow.me/extension" },
];

const MOBILE_WALLETS: WalletOption[] = [
  { id: "metamask-browser", name: "MetaMask (Open in App)", hint: "Recommended: opens directly in MetaMask app", logo: "/wallets/metamask.svg" },
  { id: "metamask-mobile", name: "MetaMask", hint: "Connect from this browser with WalletConnect", logo: "/wallets/metamask.svg" },
  { id: "coinbase-mobile", name: "Coinbase Wallet", hint: "Opens the Coinbase Wallet app", logo: "/wallets/coinbase.png" },
  { id: "rainbow-mobile", name: "Rainbow", hint: "Opens the Rainbow app", logo: "/wallets/rainbow.png" },
  // public/wallets/trust.png was an HTML page saved as .png (broken image); OKX showed Coinbase's logo. Generic icon until real assets are added.
  { id: "trust-mobile", name: "Trust Wallet", hint: "Opens Trust Wallet app", logo: "" },
  { id: "okx-mobile", name: "OKX Wallet", hint: "Opens OKX app", logo: "" },
];

/** Return path after sign-in. Only same-origin paths are honoured. */
function returnPathFromQuery(): string {
  if (typeof window === "undefined") return "/chat";
  const rp = new URLSearchParams(window.location.search);
  const raw = rp.get("returnUrl") || rp.get("redirect_url") || rp.get("redirect") || "";
  // safeReturnPath refuses other sites, "/\host" and javascript: URLs.
  const path = safeReturnPath(raw, "/chat");
  const ok = !path.startsWith("/terminal") && path !== "/portfolio";
  return ok ? path : "/chat";
}

function readDisconnectGuard(): boolean {
  try {
    return sessionStorage.getItem("__disconnected__") === "1" || localStorage.getItem("__disconnected__") === "1";
  } catch {
    return false;
  }
}

function clearDisconnectGuard() {
  try {
    sessionStorage.removeItem("__disconnected__");
    localStorage.removeItem("__disconnected__");
  } catch {
    /* storage unavailable */
  }
}

export default function ConnectPage() {
  const isMobile = useIsMobile();
  const { isConnected, address, status: accountStatus } = useAccount();
  const chainId = useChainId();
  const { connect, connectors, isPending, isError, error } = useConnect();
  const { signMessageAsync } = useSignMessage();
  const { open: openAppKit } = useAppKit();
  const { isLinked, setLinked } = useUIStore();
  const { nuclearDisconnect } = useSystemSignOut();

  const [mounted, setMounted] = useState(false);
  const [view, setView] = useState<"choose" | "qr">("choose");

  const [pendingWallet, setPendingWallet] = useState<{ id: string; name: string; logo: string } | null>(null);
  const [authStatus, setAuthStatus] = useState<"idle" | "verifying" | "failed">("idle");
  const [signStep, setSignStep] = useState<1 | 2 | 3>(2);
  const [signError, setSignError] = useState<string | null>(null);
  const [mobileDeepLink, setMobileDeepLink] = useState<string | null>(null);

  const [qrSession, setQrSession] = useState<string | null>(null);
  const [qrData, setQrData] = useState("");
  const [qrPin, setQrPin] = useState<string | null>(null);
  const [qrExpired, setQrExpired] = useState(false);
  const [ephemeral, setEphemeral] = useState<{ publicKey: string; privateKey: string; isECDH?: boolean } | null>(null);
  const [syncStatus, setSyncStatus] = useState<"IDLE" | "AWAITING" | "SYNCED" | "ERROR">("IDLE");
  const qrTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const [showMobileScanner, setShowMobileScanner] = useState(false);
  const [emailModalOpen, setEmailModalOpen] = useState(false);

  const redirectingRef = useRef(false);
  const signingRef = useRef(false);
  // Each signature attempt gets an id; a result from an older, abandoned attempt is never used.
  const signAttemptRef = useRef(0);
  const signingStartTimeRef = useRef(0);

  const effectiveIsConnected = mounted && isConnected && !readDisconnectGuard();

  /* ── Wallet connection errors ─────────────────────────────────────────── */
  useEffect(() => {
    if (!isError || !error) return;
    setPendingWallet(null);
    const msg = (error.message ?? "").toLowerCase();
    if (msg.includes("already connected")) return;
    if (msg.includes("provider not found") || msg.includes("not installed")) {
      toast.error("That wallet extension is not installed in this browser.", {
        action: { label: "Get MetaMask", onClick: () => window.open("https://metamask.io/download/", "_blank") },
        duration: 7000,
      });
    } else if (msg.includes("rejected")) {
      toast.error("You declined the connection request.");
    } else {
      toast.error("The wallet could not connect.", { description: error.message });
    }
  }, [isError, error]);

  /* ── First mount ──────────────────────────────────────────────────────── */
  useEffect(() => {
    setMounted(true);
    purgeLegacyHandshakeSecrets(); // leftovers from older builds
    try {
      // Set by sign-out when an Aztec wallet store could not be deleted (lib/aztec/wallet/wipe.ts).
      if (sessionStorage.getItem("hl.aztec.wipe_incomplete")) {
        sessionStorage.removeItem("hl.aztec.wipe_incomplete");
        toast.warning("Some private wallet data could not be removed from this browser. Close other Ledger Chat tabs and sign out again, or clear this site's data.");
      }
    } catch {
      /* storage unavailable */
    }
    const p = new URLSearchParams(window.location.search);
    if (p.has("s") && p.has("p")) {
      window.location.replace("/scan?payload=" + encodeURIComponent(window.location.href));
      return;
    }
    if (!document.cookie.includes("system_handshake=")) {
      fetch("/api/auth/session-heal", { credentials: "include", cache: "no-store" })
        .then((r) => r.json())
        .then((d) => {
          if (d.healed) window.dispatchEvent(new Event("storage"));
        })
        .catch(() => {});
    }
  }, []);

  /* ── Already signed in on this device ─────────────────────────────────── */
  useEffect(() => {
    if (readDisconnectGuard()) return;
    const hasCookie = document.cookie.split("; ").some((r) => r.startsWith("system_handshake="));
    const hasLocal = (() => {
      try {
        const r = localStorage.getItem("system_session_v2");
        if (!r) return false;
        const p = JSON.parse(r);
        return Boolean(p && p.exp && p.exp > Date.now());
      } catch {
        return false;
      }
    })();
    if (!hasCookie && !hasLocal) return;
    // Local hints are not a session: only the server's answer (the same one the chat gate gets) may
    // send the user on. Without it the hints are stale and are cleared, or /connect and /chat bounce
    // the user between them forever (in-app wallet browsers especially).
    let live = true;
    (async () => {
      const ok = await hasServerSession();
      if (!live) return;
      if (ok && allowAutoRedirect()) {
        setLinked(true);
        redirectingRef.current = true;
        window.location.replace(returnPathFromQuery());
      } else {
        clearLocalSessionMarkers();
      }
    })();
    return () => {
      live = false;
    };
  }, [setLinked]);

  /* ── QR handshake: only while the QR view is open ─────────────────────── */
  const startQr = useCallback(async () => {
    if (qrTimerRef.current) clearTimeout(qrTimerRef.current);
    setQrExpired(false);
    setQrData("");
    try {
      const { generateX25519KeyPair, generateVisualPin } = await import("@/lib/web-crypto");
      const pair = await generateX25519KeyPair();
      setEphemeral(pair);
      const generatedPin = generateVisualPin();
      setQrPin(generatedPin);
      const sessId = crypto.randomUUID?.() ?? Array.from(crypto.getRandomValues(new Uint8Array(16)), (b) => b.toString(16).padStart(2, "0")).join("");
      // Register the code's public key; the reply sets the cookie that lets
      // only this browser poll the session and finish the sign-in.
      const init = await fetch("/api/auth/qr-init", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ uuid: sessId, pub: pair.publicKey, ecdh: !!pair.isECDH, exp: Date.now() + QR_LIFETIME_MS }),
      });
      if (!init.ok) throw new Error("qr-init failed");
      setQrSession(sessId);
      const url = new URL("/connect", window.location.origin);
      url.searchParams.set("s", sessId);
      url.searchParams.set("p", pair.publicKey);
      if (pair.isECDH) url.searchParams.set("ecdh", "1");
      if (generatedPin) url.searchParams.set("pin", generatedPin);
      setQrData(url.toString());
      setSyncStatus("AWAITING");
      qrTimerRef.current = setTimeout(() => {
        setQrExpired(true);
        setQrSession(null);
        setSyncStatus("IDLE");
      }, QR_LIFETIME_MS);
    } catch {
      setSyncStatus("ERROR");
    }
  }, []);

  const stopQr = useCallback(() => {
    if (qrTimerRef.current) clearTimeout(qrTimerRef.current);
    setQrSession(null);
    setQrData("");
    setQrPin(null);
    setEphemeral(null);
    setSyncStatus("IDLE");
    setQrExpired(false);
  }, []);

  useEffect(() => () => {
    if (qrTimerRef.current) clearTimeout(qrTimerRef.current);
  }, []);

  useEffect(() => {
    if (view !== "qr" || qrExpired || !qrSession || !ephemeral) return;
    if (syncStatus === "SYNCED" || syncStatus === "ERROR") return;

    const poll = setInterval(async () => {
      try {
        const res = await fetch(`/api/auth/qr-poll?uuid=${qrSession}&t=${Date.now()}`, { cache: "no-store" });
        if (!res.ok) return;
        const data = await res.json();
        if (!data.encryptedPayload || !data.iv || !data.mobilePub) return;
        clearInterval(poll);

        // The phone encrypted a one-time claim code (and its chat keys) to this
        // browser's key mixed with the PIN on screen. Only the claim code
        // turns into a session, and only here, in HttpOnly cookies.
        let claim: string | null = null;
        try {
          const { deriveSharedSecret, decryptAESGCM } = await import("@/lib/web-crypto");
          const shared = await deriveSharedSecret(ephemeral.privateKey, data.mobilePub, ephemeral.isECDH, qrPin ?? undefined);
          const p = JSON.parse(await decryptAESGCM(shared, data.encryptedPayload, data.iv));
          // Only the claim is read. Older phones may still send `seed`/`vault`: ignored, never stored.
          if (typeof p.claim === "string") claim = p.claim;
        } catch (e) {
          console.warn("[QR] could not decrypt the phone's answer (wrong PIN?)", e);
        }
        if (!claim) {
          setSyncStatus("ERROR");
          return;
        }

        setSyncStatus("SYNCED");
        useDynamicIsland.getState().setState("syncing", { title: "Signing you in" }, 3000);
        const hy = await fetch("/api/auth/qr-hydrate", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          credentials: "include",
          body: JSON.stringify({ uuid: qrSession, claim }),
        });
        if (!hy.ok) {
          setSyncStatus("ERROR");
          return;
        }
        const hd = await hy.json().catch(() => ({}));
        const addr = String((hd as { address?: string }).address || "").toLowerCase();
        const normalized: string | null = /^0x[0-9a-f]{40}$/.test(addr) ? addr : null;
        if (normalized) {
          purgeLegacyHandshakeSecrets();
          localStorage.setItem("system_session_v2", JSON.stringify({ wallet: normalized, exp: Date.now() + 604_800_000, source: "qr-handshake" }));
          sessionStorage.setItem("system_wallet_addr", normalized);
          sessionStorage.setItem("portfolio_unlocked", "true");
          clearDisconnectGuard();
          document.cookie = `system_handshake=${normalized}; path=/; max-age=604800; SameSite=Lax`;
          setLinked(true);
        }
        await new Promise((r) => setTimeout(r, 800));
        window.location.replace(returnPathFromQuery());
      } catch {
        /* transient network error, keep polling */
      }
    }, QR_POLL_MS);

    return () => clearInterval(poll);
  }, [view, qrExpired, qrSession, ephemeral, syncStatus, qrPin, setLinked]);

  /* ── SIWE signature once a wallet is connected ────────────────────────── */
  useEffect(() => {
    if (!mounted || accountStatus !== "connected" || !address) return;
    if (redirectingRef.current || signingRef.current || authStatus === "failed") return;

    if (isLinked) {
      redirectingRef.current = true;
      window.location.replace(returnPathFromQuery());
      return;
    }
    if (readDisconnectGuard()) return;

    // Clear stale connection pairing URI now that session is connected
    setMobileDeepLink(null);

    signingRef.current = true;
    signingStartTimeRef.current = Date.now();
    const attempt = ++signAttemptRef.current;
    const stale = () => attempt !== signAttemptRef.current || redirectingRef.current;
    (async () => {
      setAuthStatus("verifying");
      setSignStep(2);
      setSignError(null);

      // A session may already exist for this address.
      try {
        const r = await fetch("/api/auth/verify-session", {
          cache: "no-store",
          credentials: "include",
          signal: AbortSignal.timeout(10_000),
        });
        if (r.ok) {
          const d = await r.json();
          if (d.authenticated && d.user?.address?.toLowerCase() === address.toLowerCase() && (await hasServerSession()) && allowAutoRedirect()) {
            setSignStep(3);
            setLinked(true);
            redirectingRef.current = true;
            window.location.replace(returnPathFromQuery());
            return;
          }
        }
      } catch {
        /* fall through to a fresh signature */
      }

      try {
        // SIWE (EIP-4361). The nonce is always issued by the server and comes
        // back as an httpOnly cookie, so every call sends credentials. A
        // client-generated nonce is a replay window, so there is no fallback.
        const nonceRes = await fetch("/api/siwe/nonce", {
          cache: "no-store",
          credentials: "include",
          signal: AbortSignal.timeout(12_000),
        });
        if (!nonceRes.ok) {
          setSignError(
            nonceRes.status === 429
              ? "Too many attempts to sign in from this network. Wait a minute and try again."
              : "We could not start signing you in. Try again in a moment.",
          );
          setAuthStatus("failed");
          signingRef.current = false;
          return;
        }
        const nonce = (await nonceRes.text()).trim();

        const siwe = new SiweMessage({
          // The server checks the domain without the port.
          domain: window.location.hostname,
          address,
          statement: "Sign in to Ledger Chat.",
          uri: window.location.origin,
          version: "1",
          chainId: chainId ?? 1,
          nonce,
          issuedAt: new Date().toISOString(),
        });
        const message = siwe.prepareMessage();

        // On mobile (iOS / Android), when WalletConnect requests a signature:
        // 1. If in an in-app browser (e.g. MetaMask in-app browser), do NOT redirect
        //    because MetaMask renders the signature prompt natively on the current view.
        // 2. If in external browser (Safari / Chrome), store the deep link in state.
        //    The "Open wallet to sign" button uses this link with a user-gesture
        //    onClick — the ONLY context where iOS Safari allows navigation.
        //    DO NOT use setTimeout + window.location.href here: async context,
        //    Safari blocks it silently since iOS 15.
        const isInAppBrowser =
          typeof window !== "undefined" &&
          Boolean((window as unknown as { ethereum?: unknown }).ethereum);

        if (isMobile && !isInAppBrowser) {
          // No stored link: the "Open … to sign" button then opens the wallet that is actually connected,
          // by the native deep link from its WalletConnect session (lib/wallet/mobileWallet.ts, validated).
          // WalletConnect recommends deep links over universal links, which iOS may open in the browser;
          // and the brand tapped on this page may not be the wallet picked in the AppKit sheet.
          setMobileDeepLink(null);
        }

        // Robust mobile signature handling with deep retry on transient relay errors.
        // The retry window gives the user time to return from MetaMask after signing.
        let signature = "";
        for (let attempt = 0; attempt < 5; attempt++) {
          try {
            // "expired" is not retried: the user gets "Try again" and a fresh nonce.
            signature = await withSignTimeout(signMessageAsync({ message }), SIGN_TIMEOUT_MS);
            if (stale()) return; // a newer attempt or a redirect took over
            if (signature) break;
          } catch (e: unknown) {
            if (stale()) return;
            const errMsg = ((e as { message?: string })?.message || "").toLowerCase();
            const isUserDecline =
              errMsg.includes("rejected") ||
              errMsg.includes("denied") ||
              errMsg.includes("user rejected") ||
              errMsg.includes("cancel");

            if (isUserDecline) {
              throw e; // User explicitly cancelled, do not retry
            }

            const isRecoverable =
              errMsg.includes("not connected") ||
              errMsg.includes("reconnecting") ||
              errMsg.includes("socket stall") ||
              errMsg.includes("provider not found") ||
              errMsg.includes("unavailable") ||
              errMsg.includes("timeout") ||
              errMsg.includes("network") ||
              errMsg.includes("interrupted") ||
              errMsg.includes("connection") ||
              errMsg.includes("closed") ||
              errMsg.includes("stall") ||
              errMsg.includes("relay") ||
              errMsg.includes("pending") ||
              errMsg.includes("waiting");

            if (isRecoverable && attempt < 4) {
              console.warn(`[SIWE:Mobile] Transient error on attempt ${attempt + 1}, retrying in 3s...`, errMsg);
              // On retry: update the deep link in state so the button re-renders with
              // the current link. The user can tap "Open wallet to sign" to return
              // to the wallet — from a button click (user gesture) Safari allows it.
              if (isMobile && mobileDeepLink) {
                // Update state so button reflects current link; do NOT navigate here
                // (we are inside an async IIFE — not a user gesture — Safari blocks it).
                setMobileDeepLink(mobileDeepLink);
              }
              await new Promise((r) => setTimeout(r, 3000));
              continue;
            }
            throw e;
          }
        }

        if (stale()) return;
        const vr = await fetch("/api/siwe/verify", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          credentials: "include",
          body: JSON.stringify({ message, signature }),
        });

        if (vr.ok) {
          try {
            const addrLower = address.toLowerCase();
            localStorage.setItem(
              "system_session_v2",
              JSON.stringify({ wallet: addrLower, exp: Date.now() + 604_800_000, source: "siwe" })
            );
            sessionStorage.setItem("system_wallet_addr", addrLower);
            localStorage.setItem("system_wallet_addr", addrLower);
            clearDisconnectGuard();
          } catch {
            /* storage unavailable */
          }
          setSignStep(3);
          setLinked(true);
          redirectingRef.current = true;
          window.location.replace(returnPathFromQuery());
          return;
        }

        const detail = await vr.json().catch(() => null);
        setSignError(detail?.error || "Your signature could not be verified. Try again.");
        setAuthStatus("failed");
        signingRef.current = false;
      } catch (e: unknown) {
        if (stale()) return;
        const m = (e as { message?: string })?.message?.toLowerCase() ?? "";
        if (m.includes("rejected") || m.includes("denied") || m.includes("cancel") || m.includes("user rejected")) {
          setSignError("You declined the signature in your wallet. Nothing was charged and nothing was sent.");
        } else if (m.includes("timeout") || m.includes("timed out") || m.includes("expired")) {
          setSignError("The signature request timed out. Please tap 'Try again' and approve the request in your wallet.");
        } else {
          setSignError("Connection interrupted while waiting for wallet. Please tap 'Try again'.");
        }
        setAuthStatus("failed");
        signingRef.current = false;
      }
    })();
  }, [mounted, accountStatus, address, authStatus, chainId, isLinked, signMessageAsync, setLinked]);

  /* ── Auto-heal / Resume when returning from wallet app ────────────────── */
  useEffect(() => {
    const onVisibilityChange = async () => {
      if (typeof document === "undefined" || document.visibilityState !== "visible") return;
      if (redirectingRef.current) return;

      // 0. Purge pending state if user has been away or stuck for > 45 seconds
      const wakeupTs = localStorage.getItem("system_pending_wakeup_ts");
      if (wakeupTs && Date.now() - parseInt(wakeupTs, 10) > 45_000) {
        setPendingWallet(null);
        setMobileDeepLink(null);
        localStorage.removeItem("system_pending_wakeup");
        localStorage.removeItem("system_pending_wakeup_ts");
      }

      // 1. Check if session was completed in background or already valid.
      //    On mobile, the user just returned from the wallet app — give the
      //    browser 800ms to deliver the response cookies before we check.
      //    Without this delay, the fetch races the cookie write and returns 401.
      await new Promise((r) => setTimeout(r, 800));

      try {
        const r = await fetch("/api/auth/verify-session", { cache: "no-store", credentials: "include" });
        if (r.ok) {
          const d = await r.json();
          if (d.authenticated && d.user?.address && (await hasServerSession()) && allowAutoRedirect()) {
            setSignStep(3);
            setLinked(true);
            redirectingRef.current = true;
            window.location.replace(returnPathFromQuery());
            return;
          }
        }
      } catch {}

      // 2. If stuck in failed state or hung in verifying after tab background restore, enable auto-retry if still connected
      if (effectiveIsConnected && (authStatus === "failed" || (authStatus === "verifying" && Date.now() - signingStartTimeRef.current > 15_000))) {
        signAttemptRef.current++; // abandon the hung request before a new one is made
        signingRef.current = false;
        setSignError(null);
        setAuthStatus("idle");
      }
    };

    document.addEventListener("visibilitychange", onVisibilityChange);
    return () => document.removeEventListener("visibilitychange", onVisibilityChange);
  }, [effectiveIsConnected, authStatus, setLinked]);

  /* ── Actions ──────────────────────────────────────────────────────────── */
  const openAppKitSafe = useCallback(() => {
    try {
      (openAppKit as unknown as (o?: { view: string }) => void)({ view: "Connect" });
    } catch {
      try {
        openAppKit();
      } catch {
        try {
          const el = (document.querySelector("appkit-modal") || document.querySelector("w3m-modal")) as
            | (HTMLElement & { open?: boolean; openModal?: () => void })
            | null;
          if (el) {
            el.open = true;
            el.openModal?.();
          }
        } catch {
          /* no modal available */
        }
      }
    }
  }, [openAppKit]);

  const handleDesktopWallet = useCallback(
    (walletId: string) => {
      const w = DESKTOP_WALLETS.find((x) => x.id === walletId);
      if (!w) return;
      clearDisconnectGuard();
      const conn =
        connectors.find((c) => c.id === w.rdns) ||
        connectors.find((c) => c.name.toLowerCase().includes(walletId)) ||
        connectors.find((c) => c.id === "injected" || (c as { type?: string }).type === "injected");
      if (conn) {
        setPendingWallet({ id: w.id, name: w.name, logo: w.logo });
        connect({ connector: conn });
      } else {
        openAppKitSafe();
        toast.info(`${w.name} is not installed here. Scan the code with the ${w.name} app on your phone instead.`);
      }
    },
    [connect, connectors, openAppKitSafe],
  );

  const handleMobileWallet = useCallback(
    (walletId: string) => {
      try {
        clearDisconnectGuard();
        localStorage.setItem("system_pending_wakeup", "1");
        localStorage.setItem("system_pending_wakeup_ts", Date.now().toString());
      } catch {
        /* storage unavailable */
      }
      const brand = walletId.split("-")[0];
      try {
        sessionStorage.setItem("preferred_mobile_wallet", brand);
        localStorage.setItem("preferred_mobile_wallet", brand);
      } catch {}

      // 1. If inside an in-app browser (MetaMask / Coinbase in-app browser)
      //    connect directly via the injected provider — no deep link needed.
      const hasProvider =
        typeof window !== "undefined" &&
        Boolean((window as unknown as { ethereum?: unknown }).ethereum);
      const inj = hasProvider
        ? connectors.find(
            (c) =>
              c.id === "injected" ||
              (c as { type?: string }).type === "injected" ||
              c.id === "io.metamask" ||
              c.name.toLowerCase().includes(brand),
          )
        : undefined;
      if (inj && hasProvider) {
        const w = MOBILE_WALLETS.find((x) => x.id === walletId);
        if (w) setPendingWallet({ id: w.id, name: w.name, logo: w.logo });
        connect({ connector: inj });
        return;
      }

      // Safari / Chrome on a phone: AppKit alone opens the wallet. Its sheet creates the WalletConnect
      // pairing and opens the chosen wallet from the user's tap (the only moment iOS allows it), then
      // delivers the session back over the relay. This page used to start a second pairing of its own in
      // parallel and navigate from an async callback (which iOS blocks): the wallet got one pairing, the
      // page waited on the other, and the sheet stayed on "Continue in MetaMask".
      const w = MOBILE_WALLETS.find((x) => x.id === walletId);
      if (w) setPendingWallet({ id: w.id, name: w.name, logo: w.logo });
      setMobileDeepLink(null);
      openAppKitSafe();
    },
    [connect, connectors, openAppKitSafe],
  );

  const handleDisconnect = useCallback(() => {
    signAttemptRef.current++; // a signature arriving after Cancel is ignored
    stopQr();
    setView("choose");
    setPendingWallet(null);
    setMobileDeepLink(null);
    setAuthStatus("idle");
    setSignError(null);
    signingRef.current = false;
    toast.success("Signed out.");
    nuclearDisconnect();
  }, [nuclearDisconnect, stopQr]);

  const handleRetry = useCallback(() => {
    signingRef.current = false;
    setSignError(null);
    setMobileDeepLink(null);
    setAuthStatus("idle");
  }, []);

  const handlePhone = useCallback(() => {
    if (isMobile) {
      setShowMobileScanner(true);
      return;
    }
    setView("qr");
    startQr();
  }, [isMobile, startQr]);

  const handleBack = useCallback(() => {
    stopQr();
    setView("choose");
  }, [stopQr]);

  /* ── Stage ────────────────────────────────────────────────────────────── */
  if (!mounted) return <div style={{ minHeight: "100vh", background: "#ffffff" }} />;

  let stage: ConnectStage = "choose";
  if (isLinked) stage = "done";
  else if (effectiveIsConnected && authStatus === "failed") stage = "failed";
  else if (effectiveIsConnected) stage = "signing";
  else if (pendingWallet && isPending) stage = "connecting";
  else if (view === "qr") stage = "qr";

  return (
    <>
      <ConnectView
        stage={stage}
        isMobile={isMobile}
        wallets={isMobile ? MOBILE_WALLETS : DESKTOP_WALLETS}
        pendingWallet={pendingWallet}
        signStep={signStep}
        errorMessage={signError}
        mobileDeepLink={mobileDeepLink}
        qr={qrData ? <QRCodeSVG value={qrData} size={172} level="M" bgColor="#ffffff" fgColor="#15171c" /> : null}
        qrPin={qrPin}
        qrExpired={qrExpired}
        onWallet={(id) => (isMobile ? handleMobileWallet(id) : handleDesktopWallet(id))}
        onOtherWallets={openAppKitSafe}
        onEmail={() => setEmailModalOpen(true)}
        onPhone={handlePhone}
        onBack={handleBack}
        onRetry={handleRetry}
        onDisconnect={handleDisconnect}
        onCancelPending={() => {
          setPendingWallet(null);
          setMobileDeepLink(null);
        }}
        onRefreshQr={startQr}
        onLinkDevice={() => setShowMobileScanner(true)}
      />

      {isMobile && (
        <DynamicUniversalScanModal
          isOpen={showMobileScanner}
          onClose={() => setShowMobileScanner(false)}
          address={address ?? ""}
          mode="session-only"
          onScan={() => {
            setShowMobileScanner(false);
            toast.success("The other device is now signed in.");
          }}
        />
      )}
      <EmailLoginModal isOpen={emailModalOpen} onClose={() => setEmailModalOpen(false)} />

      {/* AppKit's web component, used by the mobile wallet hand-off. */}
      <div aria-hidden="true" style={{ position: "absolute", opacity: 0, width: 1, height: 1, pointerEvents: "none", overflow: "hidden" }}>
        {/* @ts-ignore AppKit registers this custom element at runtime */}
        <appkit-button />
      </div>
    </>
  );
}
