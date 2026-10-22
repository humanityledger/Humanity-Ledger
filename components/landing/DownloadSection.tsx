"use client";

import React, { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  Download, Monitor, Apple, Globe, CheckCircle2,
  ChevronDown, Lock, Terminal, ShieldAlert, Copy, Check,
} from "lucide-react";
import { toast } from "sonner";

/**
 * DownloadSection — platform availability and installers.
 *
 * Rewritten against the standard in CLAUDE.md §1 and §4. Three things changed
 * about what this page is willing to say:
 *
 * 1. The previous FAQ answered "Is the Windows installer safe to run?" with
 *    "Yes. The installer is built and signed..." and then told the reader to
 *    click past the SmartScreen warning via "More info" → "Run anyway".
 *    Those two statements contradict each other: SmartScreen does not warn on
 *    a build signed with a reputable certificate. Teaching a user to dismiss
 *    an OS security warning is a bad habit for any product and an indefensible
 *    one for a product that asks to hold their keys. The page now states the
 *    signing status plainly and gives a checksum instead.
 *
 * 2. A release with no version, no size and no checksum cannot be verified by
 *    anyone. Each platform below carries all three, and where a value has not
 *    been published the card says so rather than showing a plausible-looking
 *    placeholder. A fabricated checksum is worse than no checksum: it teaches
 *    the reader that checking is theatre.
 *
 * 3. "Sub-millisecond responsiveness" and similar superlatives are gone. No
 *    figure appears here without something behind it.
 *
 * MAINTAINING THIS FILE: every release value lives in PLATFORMS below. Update
 * it there on each release and the page follows. If `sha256` is left null the
 * card automatically renders its unverified state — which is correct, and is
 * the behaviour you want on the day someone forgets.
 */

// ─── Release metadata ─────────────────────────────────────────────────────────

type SigningStatus = "signed" | "unsigned" | "not-built";

interface Platform {
  id: string;
  name: string;
  requirement: string;
  architecture: string;
  /** Null until a build is published. */
  file: { href: string; filename: string; sizeMB: number } | null;
  /** Null until the checksum is published. Never invent one. */
  sha256: string | null;
  signing: SigningStatus;
  version: string | null;
  /** What the verify command looks like on that platform. */
  verifyCommand: string;
  icon: React.ReactNode;
}

const PLATFORMS: Platform[] = [
  {
    id: "windows",
    name: "Windows",
    requirement: "Windows 10 or 11",
    architecture: "x64",
    file: {
      href: "/releases/Ledger-Chat-Setup-Windows.exe",
      filename: "Ledger-Chat-Setup-Windows.exe",
      sizeMB: 93.7,
    },
    sha256: null, // TODO: publish on next release and paste here.
    signing: "unsigned",
    version: "1.0.0",
    verifyCommand: "certutil -hashfile Ledger-Chat-Setup-Windows.exe SHA256",
    icon: <Monitor size={20} strokeWidth={1.6} />,
  },
  {
    id: "macos",
    name: "macOS",
    requirement: "macOS 13 Ventura or later",
    architecture: "Apple Silicon and Intel",
    file: null,
    sha256: null,
    signing: "not-built",
    version: null,
    verifyCommand: "shasum -a 256 Ledger-Chat.dmg",
    icon: <Apple size={20} strokeWidth={1.6} />,
  },
  {
    id: "linux",
    name: "Linux",
    requirement: "Ubuntu 22.04, Debian 12, Fedora 39 or later",
    architecture: "x86_64",
    file: null,
    sha256: null,
    signing: "not-built",
    version: null,
    verifyCommand: "sha256sum Ledger-Chat.AppImage",
    icon: <Terminal size={20} strokeWidth={1.6} />,
  },
];

// ─── Status vocabulary (CLAUDE.md §1) ─────────────────────────────────────────

const SIGNING_COPY: Record<SigningStatus, { label: string; tone: "ok" | "warn" | "none"; detail: string }> = {
  signed: {
    label: "Code-signed",
    tone: "ok",
    detail: "Your operating system can confirm this file came from us and has not been altered.",
  },
  unsigned: {
    label: "Not code-signed",
    tone: "warn",
    detail:
      "Windows will show a SmartScreen warning, and it is right to. We have not yet bought a signing certificate, so your system cannot confirm who built this file. Verify the checksum below before running it, or use the web client, which needs no install.",
  },
  "not-built": {
    label: "Not released",
    tone: "none",
    detail: "No installer has been published for this platform yet. The web client works here today.",
  },
};

// ─── Small pieces ─────────────────────────────────────────────────────────────

function StatusChip({ tone, children }: { tone: "ok" | "warn" | "none"; children: React.ReactNode }) {
  const styles = {
    ok: "text-[#0f7a56] bg-[#e6f4ee] border-[#bfe0d2]",
    warn: "text-[#8a5a12] bg-[#faf1e0] border-[#e8d4ab]",
    none: "text-black/45 bg-black/[0.03] border-black/[0.08]",
  }[tone];
  return (
    <span
      className={`inline-flex items-center gap-1.5 rounded-[3px] border px-2 py-[3px] font-mono text-[10px] font-medium uppercase tracking-[0.1em] ${styles}`}
    >
      {children}
    </span>
  );
}

function SpecRow({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="flex items-baseline justify-between gap-4 border-b border-black/[0.06] py-2 last:border-b-0">
      <span className="shrink-0 font-mono text-[10px] uppercase tracking-[0.14em] text-black/35">{label}</span>
      <span className="min-w-0 text-right text-[13px] text-black/70">{value}</span>
    </div>
  );
}

function ChecksumBlock({ platform }: { platform: Platform }) {
  const [copied, setCopied] = useState(false);

  if (!platform.sha256) {
    return (
      <div className="mt-4 rounded-[6px] border border-[#e8d4ab] bg-[#faf1e0] px-3.5 py-3">
        <p className="text-[12.5px] leading-relaxed text-[#8a5a12]">
          No checksum published for this build. Without one you cannot confirm the file you downloaded is
          the file we built. We are fixing this in the next release; until then the web client is the
          safer route.
        </p>
      </div>
    );
  }

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(platform.sha256!);
      setCopied(true);
      toast.success("Checksum copied");
      setTimeout(() => setCopied(false), 2000);
    } catch {
      toast.error("Could not copy. Select the text manually.");
    }
  };

  return (
    <div className="mt-4">
      <div className="mb-1.5 flex items-center justify-between">
        <span className="font-mono text-[10px] uppercase tracking-[0.14em] text-black/35">SHA-256</span>
        <button
          onClick={copy}
          className="flex items-center gap-1 text-[11px] text-black/40 transition-colors hover:text-black"
          aria-label="Copy checksum"
        >
          {copied ? <Check size={12} /> : <Copy size={12} />}
          {copied ? "Copied" : "Copy"}
        </button>
      </div>
      <code className="block break-all rounded-[5px] border border-black/[0.08] bg-black/[0.02] px-3 py-2 font-mono text-[11px] leading-relaxed text-black/70">
        {platform.sha256}
      </code>
      <p className="mt-2 font-mono text-[11px] leading-relaxed text-black/40">{platform.verifyCommand}</p>
    </div>
  );
}

function PlatformCard({ platform }: { platform: Platform }) {
  const signing = SIGNING_COPY[platform.signing];
  const available = platform.file !== null;

  return (
    <div className="flex min-w-0 flex-col rounded-[10px] border border-black/[0.08] bg-white p-6">
      <div className="mb-5 flex items-start justify-between gap-3">
        <div className="flex items-center gap-2.5">
          <span className="text-black/70">{platform.icon}</span>
          <h3 className="text-[17px] font-semibold tracking-[-0.01em] text-[#0d0d11]">{platform.name}</h3>
        </div>
        <StatusChip tone={signing.tone}>{signing.label}</StatusChip>
      </div>

      <div className="mb-5">
        <SpecRow label="Requires" value={platform.requirement} />
        <SpecRow label="Architecture" value={platform.architecture} />
        <SpecRow label="Version" value={platform.version ?? <span className="text-black/30">Not released</span>} />
        <SpecRow
          label="Size"
          value={platform.file ? `${platform.file.sizeMB} MB` : <span className="text-black/30">—</span>}
        />
      </div>

      <p className="mb-1 text-[12.5px] leading-relaxed text-black/50">{signing.detail}</p>

      {available && <ChecksumBlock platform={platform} />}

      <div className="mt-auto pt-6">
        {available ? (
          <div className="flex flex-col gap-2">
            <a
              href={platform.file!.href}
              download={platform.file!.filename}
              onClick={() => toast.success(`Downloading ${platform.name} installer`)}
              className="flex items-center justify-center gap-2 rounded-[5px] bg-[#0d0d11] px-4 py-3 text-[13.5px] font-medium text-white transition-colors hover:bg-[#2b2e36]"
            >
              <Download size={16} strokeWidth={1.8} />
              Download for {platform.name}
            </a>
            <a
              href="/chat"
              className="flex items-center justify-center gap-2 rounded-[5px] border border-black/[0.12] px-4 py-3 text-[13.5px] font-medium text-black/70 transition-colors hover:bg-black/[0.03]"
            >
              <Globe size={16} strokeWidth={1.8} />
              Use the web client instead
            </a>
          </div>
        ) : (
          <a
            href="/chat"
            className="flex items-center justify-center gap-2 rounded-[5px] bg-[#0d0d11] px-4 py-3 text-[13.5px] font-medium text-white transition-colors hover:bg-[#2b2e36]"
          >
            <Globe size={16} strokeWidth={1.8} />
            Open the web client
          </a>
        )}
      </div>
    </div>
  );
}

// ─── FAQ ──────────────────────────────────────────────────────────────────────

const FAQS = [
  {
    q: "What is Ledger Chat?",
    a: "A messenger where your wallet is your account. Direct messages are encrypted on your device before they are sent, and payments live in the same thread as the conversation that produced them. No phone number and no email are required.",
  },
  {
    q: "Do I need a crypto wallet?",
    a: "Yes, or an email address. A wallet (MetaMask, Coinbase Wallet, Rabby, Rainbow, or anything that speaks WalletConnect) gives you the full product. Email sign-in works but is not bound to a wallet, so shielded balances and payments are unavailable on that path.",
  },
  {
    q: "Can you read my messages?",
    a: "For messages delivered over XMTP MLS, no: we receive ciphertext and hold no key. When that delivery fails, the message falls back to our relay and is stored unencrypted, where an operator could read it. The app labels every message with which of the two happened. We are closing the fallback; until we do, we would rather show it than hide it.",
  },
  {
    q: "Is the Windows installer safe to run?",
    a: "It is not code-signed yet, so Windows will show a SmartScreen warning. That warning is correct and you should not be in the habit of dismissing it. We will publish a SHA-256 checksum with the next release so you can verify the file yourself. If you would rather not run an unsigned binary, the web client is the same application and needs no install.",
  },
  {
    q: "Is it free?",
    a: "Yes. No subscription, no advertising, no account to create. Messaging costs are paid by us rather than by you, which is a cost we carry rather than a law of physics. If that ever changes it will be announced before it happens.",
  },
  {
    q: "What happens if I lose my wallet?",
    a: "Your account and your message history are gone. There is no reset link, because no copy of your keys exists anywhere except on your devices. Back up your recovery phrase offline before you rely on this for anything that matters.",
  },
  {
    q: "Is it ready for people who are actually at risk?",
    a: "No. There is no third-party audit, no completed penetration test, group messages are not yet end-to-end encrypted, and the product has been in production for zero years. If your safety depends on a messenger today, use Signal.",
  },
];

function FaqItem({ q, a }: { q: string; a: string }) {
  const [open, setOpen] = useState(false);
  return (
    <div className="border-b border-black/[0.08] last:border-b-0">
      <button
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
        className="flex w-full items-center justify-between gap-6 py-5 text-left"
      >
        <span className="text-[15px] font-medium text-[#0d0d11]">{q}</span>
        <ChevronDown
          size={18}
          strokeWidth={1.8}
          className={`shrink-0 text-black/30 transition-transform duration-200 ${open ? "rotate-180" : ""}`}
        />
      </button>
      <AnimatePresence initial={false}>
        {open && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.22, ease: [0.2, 0, 0, 1] }}
            className="overflow-hidden"
          >
            <p className="max-w-[62ch] pb-5 text-[14px] leading-[1.65] text-black/60">{a}</p>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

// ─── Section ──────────────────────────────────────────────────────────────────

export function DownloadSection() {
  return (
    <section className="w-full bg-white py-24">
      <div
        className="mx-auto max-w-[1100px]"
        style={{
          paddingLeft: "max(16px, env(safe-area-inset-left, 0px))",
          paddingRight: "max(16px, env(safe-area-inset-right, 0px))",
        }}
      >
        <p className="mb-4 font-mono text-[11px] uppercase tracking-[0.2em] text-black/35">
          Platform availability
        </p>
        <h2 className="mb-4 max-w-[20ch] text-[clamp(1.6rem,4vw,2.4rem)] font-bold leading-[1.1] tracking-[-0.03em] text-[#0d0d11]">
          Where Ledger Chat runs today
        </h2>
        <p className="mb-12 max-w-[56ch] text-[15.5px] leading-[1.6] text-black/55">
          The web client is the only build we currently ship, and it is the full application. The desktop
          installers below are listed with their real state, including the parts that are not finished.
        </p>

        {/* Web client — the recommended path, so it leads. */}
        <div className="mb-4 flex flex-col gap-5 rounded-[10px] border border-black/[0.08] bg-[#f4f5f7] p-6 sm:flex-row sm:items-center">
          <div className="flex min-w-0 flex-1 items-start gap-3.5">
            <span className="mt-0.5 shrink-0 text-black/70">
              <Globe size={20} strokeWidth={1.6} />
            </span>
            <div className="min-w-0">
              <div className="mb-1 flex flex-wrap items-center gap-2.5">
                <h3 className="text-[17px] font-semibold tracking-[-0.01em] text-[#0d0d11]">Web client</h3>
                <StatusChip tone="ok">Available</StatusChip>
              </div>
              <p className="max-w-[56ch] text-[13.5px] leading-relaxed text-black/55">
                Chrome, Edge, Firefox and Safari, on desktop and mobile. Nothing to install and nothing to
                sign, which is why it is the route we recommend while the desktop builds are unsigned.
              </p>
            </div>
          </div>
          <a
            href="/chat"
            className="shrink-0 rounded-[5px] bg-[#0d0d11] px-5 py-3 text-center text-[13.5px] font-medium text-white transition-colors hover:bg-[#2b2e36]"
          >
            Launch Ledger Chat
          </a>
        </div>

        <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
          {PLATFORMS.map((p) => (
            <PlatformCard key={p.id} platform={p} />
          ))}
        </div>

        {/* Why an unsigned binary matters — stated once, where the decision is made. */}
        <div className="mt-8 flex max-w-[66ch] gap-3.5 border-l-[3px] border-[#8a5a12] bg-[#faf1e0] px-5 py-4">
          <ShieldAlert size={18} strokeWidth={1.7} className="mt-0.5 shrink-0 text-[#8a5a12]" />
          <div>
            <p className="mb-1.5 font-mono text-[10px] uppercase tracking-[0.14em] text-[#8a5a12]">Security</p>
            <p className="text-[13.5px] leading-relaxed text-[#6d4710]">
              An unsigned installer is one your operating system cannot trace back to us. If someone
              intercepted the download and substituted a different file, nothing on your machine would
              notice. That is the actual risk, and it is why we are not going to tell you to click past the
              warning. Use the web client, or wait for a signed build.
            </p>
          </div>
        </div>

        {/* Mobile */}
        <div className="mt-16 border-t border-black/[0.08] pt-10">
          <h3 className="mb-3 text-[17px] font-semibold tracking-[-0.01em] text-[#0d0d11]">Mobile</h3>
          <p className="max-w-[58ch] text-[14px] leading-relaxed text-black/55">
            No iOS or Android binary has been submitted for store review. Native builds exist internally and
            are not ready. We will put a date here when we have one, rather than a badge that links nowhere.
            In the meantime the web client works in mobile browsers.
          </p>
        </div>

        {/* What you do and do not get */}
        <div className="mt-10 flex flex-wrap gap-x-7 gap-y-3">
          {[
            { icon: <Terminal size={14} strokeWidth={1.8} />, text: "Open source" },
            { icon: <Lock size={14} strokeWidth={1.8} />, text: "No account required" },
            { icon: <CheckCircle2 size={14} strokeWidth={1.8} />, text: "No subscription" },
          ].map((item) => (
            <span key={item.text} className="flex items-center gap-2 text-[12.5px] text-black/45">
              <span className="text-black/30">{item.icon}</span>
              {item.text}
            </span>
          ))}
        </div>

        {/* FAQ */}
        <div className="mt-20 border-t border-black/[0.08] pt-14">
          <h2 className="mb-10 text-[clamp(1.4rem,3.4vw,1.9rem)] font-bold tracking-[-0.025em] text-[#0d0d11]">
            Questions worth asking
          </h2>
          <div>
            {FAQS.map((f) => (
              <FaqItem key={f.q} {...f} />
            ))}
          </div>
          <p className="mt-10 text-[13.5px] text-black/45">
            Nothing here answers your question?{" "}
            <a href="/support" className="text-[#1a5fb4] underline underline-offset-[3px]">
              Contact support
            </a>
            .
          </p>
        </div>
      </div>
    </section>
  );
}

export default DownloadSection;
