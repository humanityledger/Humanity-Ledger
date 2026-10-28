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
import { toast } from "sonner";
import { QRCodeSVG } from "qrcode.react";
import { useUIStore } from "@/lib/store/ui-store";
import { useSystemSignOut } from "@/hooks/useSystemSignOut";
import { EmailLoginModal } from "@/components/auth/EmailLoginModal";
import { useDynamicIsland } from "@/lib/store/dynamic-island-store";
import { ConnectView, type ConnectStage, type WalletOption } from "@/components/connect/ConnectView";

import { safeReturnPath } from "@/lib/security/safeRedirect";
const DynamicUniversalScanModal = dynamic(() => import("@/components/scan/UniversalScanModal"), { ssr: false });

const QR_LIFETIME_MS = 240_000;
const QR_POLL_MS = 2_000;

function useIsMobile() {
  const [isMobile, setIsMobile] = useState(false);
  useEffect(() => {
    setIsMobile(
      /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini|Mobile/i.test(
        typeof navigator !== "undefined" ? navigator.userAgent : "",
      ),
    );
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
  { id: "metamask-mobile", name: "MetaMask", hint: "Opens the MetaMask app", logo: "/wallets/metamask.svg" },
  { id: "coinbase-mobile", name: "Coinbase Wallet", hint: "Opens the Coinbase Wallet app", logo: "/wallets/coinbase.png" },
  { id: "rainbow-mobile", name: "Rainbow", hint: "Opens the Rainbow app", logo: "/wallets/rainbow.png" },
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
    if (hasCookie || hasLocal) {
      setLinked(true);
      const t = setTimeout(() => window.location.replace(returnPathFromQuery()), 500);
      return () => clearTimeout(t);
    }
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
      setQrPin(generateVisualPin());
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
        let seed: string | null = null;
        let vault: string | null = null;
        try {
          const { deriveSharedSecret, decryptAESGCM } = await import("@/lib/web-crypto");
          const shared = await deriveSharedSecret(ephemeral.privateKey, data.mobilePub, ephemeral.isECDH, qrPin ?? undefined);
          const p = JSON.parse(await decryptAESGCM(shared, data.encryptedPayload, data.iv));
          if (typeof p.claim === "string") claim = p.claim;
          if (typeof p.seed === "string") seed = p.seed;
          if (typeof p.vault === "string") vault = p.vault;
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
          if (seed) localStorage.setItem(`ledger_chat_seed_${normalized}`, seed);
          if (vault) localStorage.setItem("system_vault_v1", vault);
        }
        if (normalized) {
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

    signingRef.current = true;
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
          if (d.authenticated && d.user?.address?.toLowerCase() === address.toLowerCase()) {
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
          signal: AbortSignal.timeout(8_000),
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
          statement: "Sign in to Humanity Ledger.",
          uri: window.location.origin,
          version: "1",
          chainId: chainId ?? 1,
          nonce,
          issuedAt: new Date().toISOString(),
        });
        const message = siwe.prepareMessage();
        const signature = await signMessageAsync({ message });

        const vr = await fetch("/api/siwe/verify", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          credentials: "include",
          body: JSON.stringify({ message, signature }),
        });

        if (vr.ok) {
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
        const m = (e as { message?: string })?.message?.toLowerCase() ?? "";
        setSignError(
          m.includes("rejected") || m.includes("denied") || m.includes("cancel")
            ? "You declined the signature in your wallet. Nothing was charged and nothing was sent."
            : null,
        );
        setAuthStatus("failed");
        signingRef.current = false;
      }
    })();
  }, [mounted, accountStatus, address, authStatus, chainId, isLinked, signMessageAsync, setLinked]);

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
      } catch {
        /* storage unavailable */
      }
      const brand = walletId.split("-")[0];
      const inj = connectors.find(
        (c) =>
          c.id === "injected" ||
          (c as { type?: string }).type === "injected" ||
          c.id === "io.metamask" ||
          c.name.toLowerCase().includes(brand),
      );
      const hasProvider = typeof window !== "undefined" && Boolean((window as unknown as { ethereum?: unknown }).ethereum);
      if (inj && hasProvider) {
        const w = MOBILE_WALLETS.find((x) => x.id === walletId);
        if (w) setPendingWallet({ id: w.id, name: w.name, logo: w.logo });
        connect({ connector: inj });
        return;
      }
      try {
        const btn = document.querySelector("appkit-button") || document.querySelector("w3m-button");
        const nb = btn?.shadowRoot?.querySelector("button");
        if (nb) {
          nb.click();
          return;
        }
      } catch {
        /* fall through */
      }
      openAppKitSafe();
    },
    [connect, connectors, openAppKitSafe],
  );

  const handleDisconnect = useCallback(() => {
    stopQr();
    setView("choose");
    setPendingWallet(null);
    setAuthStatus("idle");
    setSignError(null);
    signingRef.current = false;
    toast.success("Signed out.");
    nuclearDisconnect();
  }, [nuclearDisconnect, stopQr]);

  const handleRetry = useCallback(() => {
    signingRef.current = false;
    setSignError(null);
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
        onCancelPending={() => setPendingWallet(null)}
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
