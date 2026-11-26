"use client";

import { LanguagePicker } from '@/components/i18n/LanguagePicker';
import { SignaturePreview } from "@/components/auth/SignaturePreview";

import React from "react";
import Link from "next/link";
import {
  ArrowLeft,
  Fingerprint,
  ChevronRight,
  CircleAlert,
  CircleCheck,
  Check,
  KeyRound,
  LoaderCircle,
  Lock,
  QrCode,
  RefreshCw,
  ScanQrCode,
  Wallet,
} from "lucide-react";
import { HLLogo } from "@/components/shared/HLLogo";
import { LivePhone } from "@/components/landing/v2/PhoneShowcase";
import s from "./ConnectView.module.css";
import { safeNativeWalletLink, safeWalletHref } from "@/lib/auth/wallet-links";
import { openMobileWalletApp, detectConnectedMobileWallet, METAMASK_DAPP_URL, metamaskOpenHref, phonePlatform, type PhonePlatform } from "@/lib/wallet/mobileWallet";
import { useT } from '@/lib/i18n/client';

/**
 * ConnectView — the presentational half of /connect.
 *
 * Every decision about wallets, signatures and sessions lives in
 * components/landing/ConnectPage.tsx. This file only draws the state it is
 * handed, which is what lets each state be rendered and checked on its own.
 */

export type ConnectStage = "choose" | "human_check" | "qr" | "connecting" | "signing" | "failed" | "done";

export interface WalletOption {
  id: string;
  name: string;
  hint: string;
  /** Empty: no verified logo in /public/wallets, a generic wallet icon is shown instead of another brand's. */
  logo: string;
}

export interface ConnectViewProps {
  stage: ConnectStage;
  isMobile: boolean;
  wallets: WalletOption[];
  pendingWallet?: { name: string; logo?: string | null } | null;
  /** 1 wallet connected, 2 waiting for signature, 3 opening the session. */
  signStep?: 1 | 2 | 3;
  errorMessage?: string | null;
  /** The wallet's own error text, shown under "Details" so a failure on a phone can be reported exactly. */
  errorDetail?: string | null;
  mobileDeepLink?: string | null;
  /**
   * iPhone: the link to this signature request in the connected wallet (lib/auth/wc-sign-request.ts),
   * and whether the relay has the request yet. False keeps "Open … to sign" waiting.
   */
  signLink?: { href: string; target: "_self" | "_blank" } | null;
  signReady?: boolean;
  /** The exact sign-in message the wallet is asked to sign (EIP-4361), shown field by field. */
  signPreview?: string | null;
  /** The rendered QR code, supplied by the container. */
  qr?: React.ReactNode;
  qrPin?: string | null;
  qrExpired?: boolean;

  onWallet: (id: string) => void;
  onOtherWallets: () => void;
  /** False on a phone, where the one wallet button already opens the full wallet list. */
  showOtherWallets?: boolean;
  /**
   * Phone browser that is not a wallet browser (Safari, Chrome). Shows the MetaMask dapp link.
   * The link is a tap. Nothing navigates there by itself.
   */
  externalMobile?: boolean;
  onPhone: () => void;
  onBack: () => void;
  onRetry: () => void;
  onDisconnect: () => void;
  onCancelPending: () => void;
  onRefreshQr: () => void;
  onLinkDevice?: () => void;
  /** G8 passkey account (NEXT_PUBLIC_PASSKEY_ACCOUNTS): sign in or create, no wallet. */
  onPasskey?: (mode: 'signin' | 'create') => void;
  passkeyBusy?: boolean;
  /** G8 HumanGate card (NEXT_PUBLIC_HUMAN_GATE), shown in place of the choices until it passes. */
  humanGate?: React.ReactNode;
}

const FACTS = [
  {
    icon: Wallet,
    title: "Your wallet is your account",
    text: "You sign a short message to prove the address is yours. Signing is free and nothing is written to the blockchain.",
  },
  {
    icon: Lock,
    title: "Encrypted on your device",
    text: "Direct messages are encrypted with the XMTP protocol before they leave your browser.",
  },
  {
    icon: KeyRound,
    title: "No one can reset it for you",
    text: "There is no recovery link. Keep your wallet's recovery phrase somewhere safe and offline.",
  },
];

function Facts() {
  const t = useT();
  return (
    <ul className={s.facts}>
      {FACTS.map(({ icon: Icon, title, text }) => (
        <li key={title} className={s.fact}>
          <span className={s.factIcon} aria-hidden="true">
            <Icon size={18} strokeWidth={1.75} />
          </span>
          <div>
            <p className={s.factTitle}>{t(title)}</p>
            <p className={s.factText}>{t(text)}</p>
          </div>
        </li>
      ))}
    </ul>
  );
}

function FooterLinks() {
  const t = useT();
  return (
    <nav className={s.links} aria-label={t("Legal")}>
      <Link href="/docs/whitepaper">{t("Whitepaper")}</Link>
      <Link href="/docs/terms">{t("Terms of Service")}</Link>
      <Link href="/docs/privacy">{t("Privacy Policy")}</Link>
      <Link href="/docs/overview">{t("Help")}</Link>
    </nav>
  );
}

function Option({
  logo,
  icon: Icon,
  name,
  hint,
  onClick,
  disabled,
}: {
  logo?: string;
  icon?: React.ComponentType<{ size?: number; strokeWidth?: number }>;
  name: string;
  hint: string;
  onClick: () => void;
  disabled?: boolean;
}) {
  return (
    <button type="button" className={s.option} onClick={onClick} disabled={disabled}>
      <span className={s.optionLogo} aria-hidden="true">
        {logo ? <img src={logo} alt="" /> : Icon ? <Icon size={18} strokeWidth={1.75} /> : null}
      </span>
      <span className={s.optionText}>
        <span className={s.optionName}>{name}</span>
        <span className={s.optionHint}>{hint}</span>
      </span>
      <ChevronRight size={18} strokeWidth={1.75} className={s.optionArrow} aria-hidden="true" />
    </button>
  );
}

/* ── Stages ─────────────────────────────────────────────────────────────── */

export function MetaMaskDappLink() {
  const t = useT();
  // A plain link, followed only on a tap. Platform from the user agent at render time.
  const [platform, setPlatform] = React.useState<PhonePlatform>("other");
  React.useEffect(() => {
    if (typeof navigator !== "undefined") setPlatform(phonePlatform(navigator.userAgent || "", navigator.maxTouchPoints || 0));
  }, []);
  const href = metamaskOpenHref(platform);
  const install = safeWalletHref(METAMASK_DAPP_URL);
  return (
    <div className={s.metamaskCta}>
      <a href={href} className={`${s.btn} ${s.btnPrimary}`} data-testid="open-in-metamask">
        {t("Open in MetaMask")}
      </a>
      <p className={s.metamaskHint}>{t("This opens the MetaMask app with Ledger Chat inside it. Sign the Humanity Ledger message there for ledgerchat.org.{value}{value2}", { value: platform === "ios" ? t(" If your iPhone asks “Open in MetaMask?”, tap Open.") : "", value2: install ? (
          <>
            {t("{value}No MetaMask on this phone? {0}.", { value: " ", 0: <a href={install} className={s.inlineLink}>{t("Get MetaMask")}</a> })}</>
        ) : null })}
      </p>
    </div>
  );
}

function Choose(p: ConnectViewProps) {
  const t = useT();
  return (
    <>
      <h1 className={s.title}>{t("Sign in to Ledger Chat")}</h1>
      <p className={s.subtitle}>{t("Connect the wallet you want to use as your account.")}</p>

      {p.isMobile && p.externalMobile ? <MetaMaskDappLink /> : null}

      {p.onPasskey ? (
        <>
          <div className={s.options}>
            <Option icon={Fingerprint} name={t("Continue with passkey")} hint={p.passkeyBusy ? t("Waiting for Face ID, Touch ID or Windows Hello…") : t("No wallet needed. Your passkey is your account on every device it syncs to.")} onClick={() => !p.passkeyBusy && p.onPasskey!('signin')} />
            <Option icon={KeyRound} name={t("Create a passkey account")} hint={t("New here? One fingerprint or face scan creates your account and your private Aztec identity.")} onClick={() => !p.passkeyBusy && p.onPasskey!('create')} />
          </div>
          <div className={s.divider}>{t("or use a wallet")}</div>
        </>
      ) : null}

      <div className={s.options}>
        {p.wallets.map((w) => (
          <Option key={w.id} logo={w.logo || undefined} icon={Wallet} name={w.name} hint={t(w.hint)} onClick={() => p.onWallet(w.id)} />
        ))}
        {p.showOtherWallets !== false && (
          <Option
            icon={Wallet}
            name="Other wallets"
            hint={p.isMobile ? t("Choose any wallet app on this phone") : t("Connect with WalletConnect")}
            onClick={p.onOtherWallets}
          />
        )}
      </div>

      <div className={s.divider}>{t("or")}</div>

      <div className={s.options}>
        {p.isMobile ? (
          <Option
            icon={ScanQrCode}
            name="Link a computer"
            hint={t("Scan the code shown on ledgerchat.org on your computer")}
            onClick={p.onPhone}
          />
        ) : (
          <Option icon={QrCode} name="Use your phone" hint={t("Scan a code with Ledger Chat on your phone")} onClick={p.onPhone} />
        )}
      </div>

      <p className={s.legal}>{t("By continuing you confirm you are at least 16 years old and agree to the{value}{0}, the {1} and the{value2}{2}.", { value: " ", 0: <Link href="/docs/terms">{t("Terms of Service")}</Link>, 1: <Link href="/docs/community-guidelines">{t("Community Guidelines")}</Link>, value2: " ", 2: <Link href="/docs/privacy">{t("Privacy Policy")}</Link> })}</p>
    </>
  );
}

/**
 * The computer's sign-in, WhatsApp Web style: the phone holds the account and links this
 * computer by scanning the code and confirming. The computer never gets the wallet; the phone
 * approves each signature it needs (lib/auth/linkedDevices.ts).
 */
function QrStage(p: ConnectViewProps) {
  const t = useT();
  return (
    <>
      <h1 className={s.title}>{t("Use Ledger Chat on this computer")}</h1>
      <p className={s.subtitle}>{t("Link it to Ledger Chat on your phone, like WhatsApp Web or Signal Desktop.")}</p>

      <div className={s.qrCard}>
        <div className={s.qrBox}>
          {p.qrExpired ? (
            <div className={s.qrExpired}>
              <span>{t("This code has expired.")}</span>
              <button type="button" className={`${s.btn} ${s.btnSecondary}`} onClick={p.onRefreshQr}>
                <RefreshCw size={15} strokeWidth={1.75} aria-hidden="true" />
                {t("New code")}
              </button>
            </div>
          ) : (
            p.qr ?? <LoaderCircle size={22} strokeWidth={1.75} className={s.spin} aria-label={t("Preparing code")} />
          )}
        </div>

        {!p.qrExpired && (
          <span className={s.waiting} role="status">
            <LoaderCircle size={14} strokeWidth={2} className={s.spin} aria-hidden="true" />
            {t("Waiting for your phone")}
          </span>
        )}
      </div>

      <ol className={s.qrSteps}>
        <li><span>{t("Open Ledger Chat on your phone. First time? Go to ledgerchat.org on your phone and sign in with your wallet: that creates your account.")}</span></li>
        <li><span>{t("Tap {0}.", { 0: <strong>{t("Settings → Linked devices → Link a device")}</strong> })}</span></li>
        <li><span>{t("Point your phone at this code and confirm on your phone.")}</span></li>
      </ol>

      <p className={s.legal}>
        {t("Your chats stay end-to-end encrypted. This computer never receives your wallet: when it needs a signature, your phone shows what it is and you approve it there.")}
      </p>

      <button type="button" className={s.back} onClick={p.onBack}>
        <Wallet size={16} strokeWidth={1.75} aria-hidden="true" />
        {t("Sign in with a wallet on this computer instead")}
      </button>
    </>
  );
}

function Connecting(p: ConnectViewProps) {
  const t = useT();
  const name = p.pendingWallet?.name ?? "your wallet";
  return (
    <>
      {p.pendingWallet?.logo ? (
        <span className={s.walletBadge} aria-hidden="true">
          <img src={p.pendingWallet.logo} alt="" />
        </span>
      ) : (
        <span className={`${s.statusIcon} ${s.statusNeutral}`} aria-hidden="true">
          <Wallet size={22} strokeWidth={1.75} />
        </span>
      )}
      <h1 className={s.title}>{t("Waiting for {name}", { name })}</h1>
      <p className={s.subtitle}>
        {p.isMobile
          ? t("Approve the connection in {name}, then come back to this page: on iPhone, tap \"‹ Safari\" at the top left (iOS does not let a wallet return to the browser by itself). This page carries on as soon as you are back.", { name })
          : t("Approve the connection request in {name}. If nothing appears, open the extension from your browser toolbar.", { name })}
      </p>
      <span className={s.waiting} role="status">
        <LoaderCircle size={14} strokeWidth={2} className={s.spin} aria-hidden="true" />
        {t("Waiting for approval")}
      </span>
      <div className={s.actions}>
        {p.isMobile &&
          (safeWalletHref(p.mobileDeepLink) ? (
            // A plain link: a tap on it is the one navigation every phone browser lets open an app.
            <a href={safeWalletHref(p.mobileDeepLink)!} className={`${s.btn} ${s.btnPrimary}`}>{t("Open {name}", { name })}
            </a>
          ) : (
            <button type="button" className={`${s.btn} ${s.btnPrimary}`} disabled aria-disabled="true">{t("Preparing {name}", { name })}
            </button>
          ))}
        <button type="button" className={`${s.btn} ${s.btnSecondary}`} onClick={p.onCancelPending}>
          {t("Cancel")}
        </button>
      </div>
    </>
  );
}

const STEP_LABELS = ["Wallet connected", "Signature requested", "Session opened"] as const;

/** Opens the wallet on this signature request, from the tap. Re-checked here: an app scheme or https only. */
function openSignLink(link: ConnectViewProps["signLink"]): boolean {
  if (!link || typeof window === "undefined") return false;
  if (link.target === "_self" && safeNativeWalletLink(link.href)) {
    window.location.href = link.href;
    return true;
  }
  if (link.target === "_blank" && /^https:\/\/[^\s"'<>`]+$/.test(link.href)) {
    window.open(link.href, "_blank", "noopener,noreferrer");
    return true;
  }
  return false;
}

function Signing(p: ConnectViewProps) {
  const t = useT();
  const current = p.signStep ?? 2;
  const waiting = p.isMobile && p.signReady === false;
  return (
    <>
      <span className={`${s.statusIcon} ${s.statusNeutral}`} aria-hidden="true">
        <KeyRound size={22} strokeWidth={1.75} />
      </span>
      <h1 className={s.title}>{t("Confirm it is you")}</h1>
      <p className={s.subtitle}>
        {waiting
          ? t("Sending the request to your wallet. This takes a second.")
          : t("Your wallet will ask you to sign a message. Signing is free and does not send a transaction.")}
      </p>
      <p className={s.subtitle}>{t("If your wallet says “simulation failed”, that is expected: this is a signature, not a transaction.")}</p>
      {p.signPreview ? <SignaturePreview text={p.signPreview} kind="sign-in" /> : null}

      <ol className={s.steps} aria-label={t("Progress")}>
        {STEP_LABELS.map((label, i) => {
          const n = i + 1;
          const state = n < current ? s.stepDone : n === current ? s.stepActive : "";
          return (
            <li key={label} className={`${s.step} ${state}`} aria-current={n === current ? "step" : undefined}>
              <span className={s.stepMark} aria-hidden="true">
                {n < current ? (
                  <Check size={13} strokeWidth={2.5} />
                ) : n === current ? (
                  <LoaderCircle size={18} strokeWidth={2} className={s.spin} />
                ) : null}
              </span>
              <span>{t(label)}</span>
            </li>
          );
        })}
      </ol>

      <div className={s.actions}>
        {p.isMobile && (
          <button
            type="button"
            className={`${s.btn} ${s.btnPrimary}`}
            disabled={waiting}
            aria-disabled={waiting || undefined}
            onClick={() => {
              if (typeof window === "undefined" || waiting) return;
              if (openSignLink(p.signLink)) return;
              const href = safeWalletHref(p.mobileDeepLink);
              if (href) {
                window.location.href = href;
                return;
              }
              openMobileWalletApp();
            }}
          >
            {waiting ? (
              <>
                <LoaderCircle size={16} strokeWidth={2} className={s.spin} aria-hidden="true" />
                {t("Preparing the request")}
              </>
            ) : (
              <>{t("Open {name} to sign", { name: detectConnectedMobileWallet().name })}</>
            )}
          </button>
        )}
        <button type="button" className={s.btnText} onClick={p.onDisconnect}>
          {t("Cancel and disconnect")}
        </button>
      </div>
    </>
  );
}

function Failed(p: ConnectViewProps) {
  const t = useT();
  return (
    <>
      <span className={`${s.statusIcon} ${s.statusDanger}`} aria-hidden="true">
        <CircleAlert size={24} strokeWidth={1.75} />
      </span>
      <h1 className={s.title}>{t("Sign in did not finish")}</h1>
      <p className={s.errorText} role="alert">
        {p.errorMessage || t("The signature was declined or timed out. Nothing was charged and nothing was sent.")}
      </p>
      <div className={s.actions}>
        {/* On a phone browser without a wallet, signing inside MetaMask is the path that does not depend
            on the WalletConnect relay, so it comes first. */}
        {p.isMobile && p.externalMobile ? <MetaMaskDappLink /> : null}
        <button type="button" className={`${s.btn} ${p.isMobile && p.externalMobile ? s.btnSecondary : s.btnPrimary}`} onClick={p.onRetry}>
          {t("Try again")}
        </button>
        <button type="button" className={`${s.btn} ${s.btnSecondary}`} onClick={p.onDisconnect}>
          {t("Use a different wallet")}
        </button>
      </div>
      {p.errorDetail ? (
        <details className={s.details}>
          <summary>{t("Details")}</summary>
          <code data-testid="sign-error-detail">{p.errorDetail}</code>
        </details>
      ) : null}
    </>
  );
}

function Done(p: ConnectViewProps) {
  const t = useT();
  return (
    <>
      <span className={`${s.statusIcon} ${s.statusSuccess}`} aria-hidden="true">
        <CircleCheck size={26} strokeWidth={1.75} />
      </span>
      <h1 className={s.title}>{t("You are signed in")}</h1>
      <p className={s.subtitle}>{t("Opening Ledger Chat.")}</p>
      <div className={s.actions}>
        {p.isMobile && p.onLinkDevice && (
          <button type="button" className={`${s.btn} ${s.btnSecondary}`} onClick={p.onLinkDevice}>
            <ScanQrCode size={17} strokeWidth={1.75} aria-hidden="true" />
            {t("Link another device")}
          </button>
        )}
        <button type="button" className={s.btnText} onClick={p.onDisconnect}>
          {t("Sign out")}
        </button>
      </div>
    </>
  );
}

/* ── Page ───────────────────────────────────────────────────────────────── */

export function ConnectView(props: ConnectViewProps) {
  const t = useT();
  const { stage } = props;

  const body =
    stage === "human_check" && props.humanGate ? props.humanGate :
    stage === "qr" ? <QrStage {...props} /> :
    stage === "connecting" ? <Connecting {...props} /> :
    stage === "signing" ? <Signing {...props} /> :
    stage === "failed" ? <Failed {...props} /> :
    stage === "done" ? <Done {...props} /> :
    <Choose {...props} />;

  return (
    <div className={s.root} data-stage={stage}>
      <main className={s.panel}>
        <div className={s.panelTop}>
          <Link href="/" aria-label={t("Humanity Ledger home")} className={s.brand}>
            <HLLogo size={30} />
          </Link>
          <Link href="/docs/overview" className={s.help}>
            {t("Help")}
          </Link>
        </div>

        <div className={s.panelMain}>
          <div className={s.form} key={stage}>
            {body}
          </div>
        </div>

        <p className={s.panelFoot}>{t("Signing in is free. Nothing is written to the blockchain.")}</p>
        <div className="mt-3 flex justify-center">
          <LanguagePicker variant="compact" />
        </div>
      </main>

      <aside className={s.about} aria-labelledby="connect-about-title">
        <div className={s.aboutTop}>
          <Link href="/" aria-label={t("Humanity Ledger home")} className={s.brand}>
            <HLLogo size={32} />
          </Link>
          <Link href="/" className={s.home}>
            <ArrowLeft size={15} strokeWidth={1.9} aria-hidden="true" />
            {t("Back to home")}
          </Link>
        </div>

        <div className={s.aboutHead}>
          <h2 id="connect-about-title" className={s.aboutTitle}>
            {t("Private messages and payments, tied to your wallet.")}
          </h2>
          <p className={s.aboutLead}>
            {t("Your wallet address is your account, so there is no phone number to share and no password to forget.")}
          </p>
        </div>

        <div className={s.showcase}>
          <div className={s.visual}>
            {/* Vector iPhone with the live Ledger Chat conversation: an Aztec
                private invoice settling inside an MLS-encrypted DM. */}
            <LivePhone id="chat" fill={0.86} />
          </div>
          <Facts />
        </div>

        <div className={s.aboutFoot}>
          <p className={s.notice}>{t("Ledger Chat is in early access. Our contracts have not been independently audited yet.")}</p>
          <FooterLinks />
        </div>
      </aside>
    </div>
  );
}

export default ConnectView;