"use client";

import React from "react";
import Link from "next/link";
import {
  ArrowLeft,
  ChevronRight,
  CircleAlert,
  CircleCheck,
  Check,
  KeyRound,
  LoaderCircle,
  Lock,
  Mail,
  QrCode,
  RefreshCw,
  ScanQrCode,
  Wallet,
} from "lucide-react";
import { HLLogo } from "@/components/shared/HLLogo";
import { LivePhone } from "@/components/landing/v2/PhoneShowcase";
import s from "./ConnectView.module.css";

/**
 * ConnectView — the presentational half of /connect.
 *
 * Every decision about wallets, signatures and sessions lives in
 * components/landing/ConnectPage.tsx. This file only draws the state it is
 * handed, which is what lets each state be rendered and checked on its own.
 */

export type ConnectStage = "choose" | "qr" | "connecting" | "signing" | "failed" | "done";

export interface WalletOption {
  id: string;
  name: string;
  hint: string;
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
  /** The rendered QR code, supplied by the container. */
  qr?: React.ReactNode;
  qrPin?: string | null;
  qrExpired?: boolean;

  onWallet: (id: string) => void;
  onOtherWallets: () => void;
  onEmail: () => void;
  onPhone: () => void;
  onBack: () => void;
  onRetry: () => void;
  onDisconnect: () => void;
  onCancelPending: () => void;
  onRefreshQr: () => void;
  onLinkDevice?: () => void;
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
  return (
    <ul className={s.facts}>
      {FACTS.map(({ icon: Icon, title, text }) => (
        <li key={title} className={s.fact}>
          <span className={s.factIcon} aria-hidden="true">
            <Icon size={18} strokeWidth={1.75} />
          </span>
          <div>
            <p className={s.factTitle}>{title}</p>
            <p className={s.factText}>{text}</p>
          </div>
        </li>
      ))}
    </ul>
  );
}

function FooterLinks() {
  return (
    <nav className={s.links} aria-label="Legal">
      <Link href="/docs/whitepaper">Whitepaper</Link>
      <Link href="/docs/terms">Terms of Service</Link>
      <Link href="/docs/privacy">Privacy Policy</Link>
      <Link href="/docs/overview">Help</Link>
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

function Choose(p: ConnectViewProps) {
  return (
    <>
      <h1 className={s.title}>Sign in to Ledger Chat</h1>
      <p className={s.subtitle}>Connect the wallet you want to use as your account.</p>

      <div className={s.options}>
        {p.wallets.map((w) => (
          <Option key={w.id} logo={w.logo} name={w.name} hint={w.hint} onClick={() => p.onWallet(w.id)} />
        ))}
        <Option
          icon={Wallet}
          name="Other wallets"
          hint={p.isMobile ? "Choose any wallet app on this phone" : "Connect with WalletConnect"}
          onClick={p.onOtherWallets}
        />
      </div>

      <div className={s.divider}>or</div>

      <div className={s.options}>
        <Option icon={Mail} name="Continue with email" hint="We email you a code to sign in" onClick={p.onEmail} />
        {p.isMobile ? (
          <Option
            icon={ScanQrCode}
            name="Scan a code from your computer"
            hint="Sign in on a computer using this phone"
            onClick={p.onPhone}
          />
        ) : (
          <Option icon={QrCode} name="Use your phone" hint="Scan a code to sign in on this computer" onClick={p.onPhone} />
        )}
      </div>

      <p className={s.legal}>
        By continuing you confirm you are at least 16 years old and agree to the{" "}
        <Link href="/docs/terms">Terms of Service</Link> and <Link href="/docs/privacy">Privacy Policy</Link>.
      </p>
    </>
  );
}

function QrStage(p: ConnectViewProps) {
  return (
    <>
      <button type="button" className={s.back} onClick={p.onBack}>
        <ArrowLeft size={16} strokeWidth={1.75} aria-hidden="true" />
        Back
      </button>
      <h1 className={s.title}>Sign in with your phone</h1>
      <p className={s.subtitle}>Use a phone where you are already signed in to Ledger Chat.</p>

      <div className={s.qrCard}>
        <div className={s.qrBox}>
          {p.qrExpired ? (
            <div className={s.qrExpired}>
              <span>This code has expired.</span>
              <button type="button" className={`${s.btn} ${s.btnSecondary}`} onClick={p.onRefreshQr}>
                <RefreshCw size={15} strokeWidth={1.75} aria-hidden="true" />
                New code
              </button>
            </div>
          ) : (
            p.qr ?? <LoaderCircle size={22} strokeWidth={1.75} className={s.spin} aria-label="Preparing code" />
          )}
        </div>

        {p.qrPin && !p.qrExpired && (
          <div className={s.code}>
            <span className={s.codeLabel}>Your phone should show this code</span>
            <span className={s.codeValue}>{p.qrPin}</span>
          </div>
        )}

        {!p.qrExpired && (
          <span className={s.waiting} role="status">
            <LoaderCircle size={14} strokeWidth={2} className={s.spin} aria-hidden="true" />
            Waiting for your phone
          </span>
        )}
      </div>

      <ol className={s.qrSteps}>
        <li>On your phone, open <strong>humanidfi.com/connect</strong> in a mobile browser.</li>
        <li>Sign in with your wallet on that page.</li>
        <li>Tap <strong>Scan a code from your computer</strong> and point the camera at this code.</li>
      </ol>
    </>
  );
}

function Connecting(p: ConnectViewProps) {
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
      <h1 className={s.title}>Waiting for {name}</h1>
      <p className={s.subtitle}>Approve the connection request in {name}. If nothing appears, open the extension from your browser toolbar.</p>
      <span className={s.waiting} role="status">
        <LoaderCircle size={14} strokeWidth={2} className={s.spin} aria-hidden="true" />
        Waiting for approval
      </span>
      <div className={s.actions}>
        <button type="button" className={`${s.btn} ${s.btnSecondary}`} onClick={p.onCancelPending}>
          Cancel
        </button>
      </div>
    </>
  );
}

const STEP_LABELS = ["Wallet connected", "Signature requested", "Session opened"] as const;

function Signing(p: ConnectViewProps) {
  const current = p.signStep ?? 2;
  return (
    <>
      <span className={`${s.statusIcon} ${s.statusNeutral}`} aria-hidden="true">
        <KeyRound size={22} strokeWidth={1.75} />
      </span>
      <h1 className={s.title}>Confirm it is you</h1>
      <p className={s.subtitle}>
        Your wallet will ask you to sign a message. Signing is free and does not send a transaction.
      </p>

      <ol className={s.steps} aria-label="Progress">
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
              <span>{label}</span>
            </li>
          );
        })}
      </ol>

      <div className={s.actions}>
        <button type="button" className={s.btnText} onClick={p.onDisconnect}>
          Cancel and disconnect
        </button>
      </div>
    </>
  );
}

function Failed(p: ConnectViewProps) {
  return (
    <>
      <span className={`${s.statusIcon} ${s.statusDanger}`} aria-hidden="true">
        <CircleAlert size={24} strokeWidth={1.75} />
      </span>
      <h1 className={s.title}>Sign in did not finish</h1>
      <p className={s.errorText} role="alert">
        {p.errorMessage || "The signature was declined or timed out. Nothing was charged and nothing was sent."}
      </p>
      <div className={s.actions}>
        <button type="button" className={`${s.btn} ${s.btnPrimary}`} onClick={p.onRetry}>
          Try again
        </button>
        <button type="button" className={`${s.btn} ${s.btnSecondary}`} onClick={p.onDisconnect}>
          Use a different wallet
        </button>
      </div>
    </>
  );
}

function Done(p: ConnectViewProps) {
  return (
    <>
      <span className={`${s.statusIcon} ${s.statusSuccess}`} aria-hidden="true">
        <CircleCheck size={26} strokeWidth={1.75} />
      </span>
      <h1 className={s.title}>You are signed in</h1>
      <p className={s.subtitle}>Opening Ledger Chat.</p>
      <div className={s.actions}>
        {p.isMobile && p.onLinkDevice && (
          <button type="button" className={`${s.btn} ${s.btnSecondary}`} onClick={p.onLinkDevice}>
            <ScanQrCode size={17} strokeWidth={1.75} aria-hidden="true" />
            Link another device
          </button>
        )}
        <button type="button" className={s.btnText} onClick={p.onDisconnect}>
          Sign out
        </button>
      </div>
    </>
  );
}

/* ── Page ───────────────────────────────────────────────────────────────── */

export function ConnectView(props: ConnectViewProps) {
  const { stage } = props;

  const body =
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
          <Link href="/" aria-label="Humanity Ledger home" className={s.brand}>
            <HLLogo size={30} />
          </Link>
          <Link href="/docs/overview" className={s.help}>
            Help
          </Link>
        </div>

        <div className={s.panelMain}>
          <div className={s.form} key={stage}>
            {body}
          </div>
        </div>

        <p className={s.panelFoot}>Signing in is free. Nothing is written to the blockchain.</p>
      </main>

      <aside className={s.about} aria-labelledby="connect-about-title">
        <div className={s.aboutTop}>
          <Link href="/" aria-label="Humanity Ledger home" className={s.brand}>
            <HLLogo size={32} />
          </Link>
          <Link href="/" className={s.home}>
            <ArrowLeft size={15} strokeWidth={1.9} aria-hidden="true" />
            Back to home
          </Link>
        </div>

        <div className={s.aboutHead}>
          <h2 id="connect-about-title" className={s.aboutTitle}>
            Private messages and payments, tied to your wallet.
          </h2>
          <p className={s.aboutLead}>
            Your wallet address is your account, so there is no phone number to share and no password to forget.
          </p>
        </div>

        <div className={s.showcase}>
          <div className={s.visual}>
            {/* The front-on photograph: no fingers cross the glass and no
                perspective, so the live chat screen sits exactly on it. */}
            <LivePhone id="voice" screen="chat" fill={0.8} />
          </div>
          <Facts />
        </div>

        <div className={s.aboutFoot}>
          <p className={s.notice}>Ledger Chat is in early access. Our contracts have not been independently audited yet.</p>
          <FooterLinks />
        </div>
      </aside>
    </div>
  );
}

export default ConnectView;