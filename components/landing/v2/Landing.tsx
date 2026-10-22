"use client";

import React, { useEffect, useState } from "react";
import Link from "next/link";
import {
  ArrowRight,
  ArrowUpRight,
  BadgeCheck,
  Check,
  Coins,
  Download,
  Globe,
  Info,
  KeyRound,
  Lock,
  X,
  Monitor,
  Network,
  Shield,
  Smartphone,
  Sparkles,
  Users,
  Wallet,
} from "lucide-react";
import { HLLogo } from "@/components/shared/HLLogo";
import { RemoteLottie } from "@/components/ui/RemoteLottie";
import { HeroMap } from "./HeroMap";
import { SiteFooter } from "./SiteFooter";
import s from "./Landing.module.css";

/**
 * Humanity Ledger landing page.
 *
 * The structure and the explanations follow the previous landing
 * (ImmersiveManifestoLanding.tsx) section by section. Sentences were only
 * rewritten where they claimed something the product does not do:
 *
 *   "Zero central servers"                 community data and a relay path use our servers
 *   "Audited on Aztec"                     no third-party audit has taken place
 *   "Military-grade" encryption            not a measurable property
 *   "Zero limits on members"               community queries are paged
 *   "instant state finality"               not a property of Aztec Alpha
 *   "Unencrypted fallback ... prohibited"  a readable relay path exists and is disclosed
 *   "zero network fees"                    messaging is free; private payments carry an Aztec fee
 */

const NAV = [
  { href: "#ledger-chat", label: "Ledger Chat" },
  { href: "#how-it-works", label: "How it works" },
  { href: "#payments", label: "Payments" },
  { href: "#download", label: "Download" },
  { href: "/docs/overview", label: "Documentation" },
];

function Nav() {
  const [scrolled, setScrolled] = useState(false);
  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 8);
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  return (
    <header className={`${s.nav} ${scrolled ? s.navScrolled : ""}`}>
      <div className={`${s.wrap} ${s.navInner}`}>
        <Link href="/" className={s.navBrand} aria-label="Humanity Ledger home">
          <HLLogo size={32} />
        </Link>
        <nav className={s.navLinks} aria-label="Main">
          {NAV.map((n) => (
            <a key={n.href} href={n.href}>
              {n.label}
            </a>
          ))}
        </nav>
        <div className={s.navActions}>
          <Link href="/connect" className={`${s.btn} ${s.btnSm} ${s.btnGhost} ${s.navSecondary}`}>
            Sign in
          </Link>
          <Link href="/chat" className={`${s.btn} ${s.btnSm} ${s.btnPrimary}`}>
            <span className={s.labelLong}>Open Ledger Chat</span>
            <span className={s.labelShort}>Open app</span>
          </Link>
        </div>
      </div>
    </header>
  );
}

/* ── Vignettes ─────────────────────────────────────────────────────────── */

function ChatVignette() {
  return (
    <div className={s.vignette}>
      <div className={s.vHead}>
        <span className={s.vAvatar}>IV</span>
        <div>
          <div className={s.vName}>Irina Vlad</div>
          <div className={s.vSub}>0xA4f2…9C1b</div>
        </div>
      </div>
      <div className={s.vBody}>
        <span className={s.vNotice}>
          <Lock size={12} strokeWidth={2} aria-hidden="true" />
          Messages are encrypted end to end
        </span>
        <div className={s.bubbleIn}>Did the advance for the project come through?</div>
        <div className={s.bubbleOut}>It just arrived. Sending you the signed invoice tonight.</div>
        <div className={s.bubbleIn}>Perfect, thank you.</div>
        <span className={s.vMeta}>Read 11:04</span>
      </div>
    </div>
  );
}

function SignatureVignette() {
  return (
    <div className={s.vignette}>
      <div className={s.sig}>
        <div className={s.sigTitle}>Signature request</div>
        <div className={s.small} style={{ marginTop: -8 }}>
          humanidfi.com wants you to sign in with your Ethereum account.
        </div>
        <div className={s.sigRows}>
          <div className={s.sigRow}>
            <span>Account</span>
            <span>0xA4f2…9C1b</span>
          </div>
          <div className={s.sigRow}>
            <span>Network</span>
            <span>Ethereum</span>
          </div>
          <div className={s.sigRow}>
            <span>Cost</span>
            <span>Free, no transaction</span>
          </div>
        </div>
        <div className={s.sigBtns}>
          <span className={s.sigCancel}>Cancel</span>
          <span className={s.sigSign}>Sign</span>
        </div>
      </div>
    </div>
  );
}

function RouteVignette() {
  return (
    <div className={s.vignette}>
      <div className={s.route}>
        <div className={s.node}>
          <span className={s.nodeIcon}>
            <Smartphone size={22} strokeWidth={1.6} aria-hidden="true" />
          </span>
          <span className={s.nodeLabel}>Your device</span>
          <span className={s.nodeHint}>Encrypts the message</span>
        </div>
        <span className={s.wire} aria-hidden="true" />
        <div className={s.node}>
          <span className={s.nodeIcon}>
            <Network size={22} strokeWidth={1.6} aria-hidden="true" />
          </span>
          <span className={s.nodeLabel}>XMTP network</span>
          <span className={s.nodeHint}>Carries only ciphertext</span>
        </div>
        <span className={s.wire} aria-hidden="true" />
        <div className={s.node}>
          <span className={s.nodeIcon}>
            <Monitor size={22} strokeWidth={1.6} aria-hidden="true" />
          </span>
          <span className={s.nodeLabel}>Their device</span>
          <span className={s.nodeHint}>Decrypts it</span>
        </div>
      </div>
      <div className={s.routeFoot}>
        <Info size={14} strokeWidth={1.75} style={{ flexShrink: 0, marginTop: 2 }} aria-hidden="true" />
        <span>Community settings and a backup delivery path still run on our servers. The documentation lists exactly what they store.</span>
      </div>
    </div>
  );
}

function useReducedMotion() {
  const [reduce, setReduce] = useState(false);
  useEffect(() => {
    const mq = window.matchMedia?.("(prefers-reduced-motion: reduce)");
    if (!mq) return;
    setReduce(mq.matches);
    const on = () => setReduce(mq.matches);
    mq.addEventListener?.("change", on);
    return () => mq.removeEventListener?.("change", on);
  }, []);
  return reduce;
}

function ReceiptVignette() {
  const reduce = useReducedMotion();
  return (
    <div className={s.vignette}>
      <div className={s.receipt}>
        {reduce ? (
          <span className={s.receiptStatic} aria-hidden="true">
            <Check size={30} strokeWidth={2.5} />
          </span>
        ) : (
          <div className={s.receiptAnim} aria-hidden="true">
            <div className={s.receiptAnimInner}>
              <RemoteLottie path="/lottie/send-button.json" loop width="100%" height="100%" />
            </div>
          </div>
        )}
        <span className={s.receiptLabel}>Sent privately to Irina</span>
        <span className={s.receiptAmount}>250.00 USDC</span>
        <div className={s.receiptRows}>
          <div className={s.receiptRow}>
            <span>Network</span>
            <span>Aztec</span>
          </div>
          <div className={s.receiptRow}>
            <span>Visible on the public ledger</span>
            <span>Neither the amount nor the recipient</span>
          </div>
          <div className={s.receiptRow}>
            <span>Network fee</span>
            <span>Under $0.05</span>
          </div>
        </div>
      </div>
    </div>
  );
}

/* ── Content ───────────────────────────────────────────────────────────── */

const PILLARS = [
  {
    icon: Lock,
    title: "Private by default.",
    text: "Every direct message is encrypted on your device before it travels. Only the person you are writing to holds the key to read it.",
    visual: <ChatVignette />,
  },
  {
    icon: Wallet,
    title: "Your wallet is your identity.",
    text: "No phone number, no email and no password. You sign in with your wallet, and your account belongs to you alone.",
    visual: <SignatureVignette />,
  },
  {
    icon: Network,
    title: "Carried by an open network.",
    text: "Messages travel over XMTP, an open messaging network, instead of a database we own. There is far less for anyone to breach, sell or watch.",
    visual: <RouteVignette />,
  },
];

const STEPS = [
  {
    title: "Connect",
    text: "Open Ledger Chat in your browser and connect a wallet. Sending messages is free; we pay the network costs.",
  },
  {
    title: "Create your profile",
    text: "Choose a display name. Your encryption keys are generated on your device and never leave it.",
  },
  {
    title: "Find people",
    text: "Share your address, scan a QR code in person, or search the directory for people and communities.",
  },
  {
    title: "Talk and pay",
    text: "Message, call, or send digital assets inside the conversation, without switching apps.",
  },
];

const TILES = [
  {
    icon: Users,
    title: "Communities",
    text: "Run large groups with free and paid channels, announcements, polls and invite links you can revoke at any time.",
  },
  {
    icon: Coins,
    title: "Payments in the chat",
    text: "Send USDC, USDT or ETH to the person you are talking to, right inside the conversation.",
  },
  {
    icon: Shield,
    title: "Private payments",
    text: "Shielded transfers on the Aztec network keep the amount and the recipient off the public ledger.",
  },
  {
    icon: Smartphone,
    title: "Every device you use",
    text: "Use Ledger Chat on your phone and your computer. Link a new device by scanning a code.",
  },
];

const PAYMENT_FEATURES = [
  {
    title: "Proofs made in your browser",
    text: "The zero knowledge proof for each payment is generated on your device, so the network never sees the amount or the people involved.",
  },
  {
    title: "Private handles",
    text: "Send shielded DAI, USDC and ETH to a handle instead of a public address, so your main wallet stays out of view.",
  },
  {
    title: "Streaming payments",
    tag: "In development",
    text: "Pay salaries and subscriptions continuously from inside a conversation, without leaving a public trail.",
  },
  {
    title: "Protection against double spending",
    text: "Each private note can only be spent once. The Aztec rollup enforces this with nullifiers, without revealing which note was used.",
  },
];

type Mark = "yes" | "no" | string;
const COMPARE: { row: string; ours: Mark; whatsapp: Mark; telegram: Mark }[] = [
  { row: "Sign up without a phone number", ours: "yes", whatsapp: "no", telegram: "no" },
  { row: "Private chats encrypted by default", ours: "yes", whatsapp: "yes", telegram: "Only secret chats" },
  { row: "Group chats encrypted end to end", ours: "In development", whatsapp: "yes", telegram: "no" },
  { row: "Send money inside a chat", ours: "yes", whatsapp: "Some countries", telegram: "yes" },
  { row: "Your account is a wallet you hold", ours: "yes", whatsapp: "no", telegram: "no" },
  { row: "Funded by advertising", ours: "no", whatsapp: "In the Updates tab", telegram: "In public channels" },
  { row: "Independently audited", ours: "Not yet", whatsapp: "yes", telegram: "Partially" },
];

function MarkCell({ v }: { v: Mark }) {
  if (v === "yes")
    return (
      <span className={`${s.cell} ${s.yes}`}>
        <Check size={18} strokeWidth={2.25} aria-hidden="true" />
        <span className={s.srOnly}>Yes</span>
      </span>
    );
  if (v === "no")
    return (
      <span className={`${s.cell} ${s.no}`}>
        <X size={17} strokeWidth={2} aria-hidden="true" />
        <span className={s.srOnly}>No</span>
      </span>
    );
  return <span className={s.cell}>{v}</span>;
}

const EXPERIENCE = [
  {
    icon: KeyRound,
    title: "Lock it your way",
    text: "Protect the app on your device with a PIN or your device's biometrics, so a borrowed laptop does not mean an open inbox.",
  },
  {
    icon: Sparkles,
    title: "A calm interface",
    text: "Clear type, generous spacing and nothing competing with your conversations. No gas to calculate and no menus to decode.",
  },
  {
    icon: BadgeCheck,
    title: "Cryptography you never have to see",
    text: "Zero knowledge proofs and end to end encryption run underneath an interface that feels like any messenger you already know.",
  },
];

const CHECKLIST = [
  "Text, photos, videos and files",
  "Voice and video calls",
  "Group chats and private communities",
  "Messages that disappear after a set time",
  "Digital assets sent inside a conversation",
  "Reactions to any message",
  "Live location you can stop sharing",
  "Polls in groups",
  "Scheduled messages",
  "Contact exchange by QR code in person",
];

const UPDATES = [
  {
    title: "A rebuilt way to sign in",
    text: "Signing in now follows the Sign in with Ethereum standard from start to finish, with a code from our server that can only be used once.",
  },
  {
    title: "Formatted announcements",
    text: "Group admins can publish formatted announcements with images, headings and lists, like a short post inside the group.",
  },
  {
    title: "Revocable invite links",
    text: "Share an invite link for a community and switch it off whenever you like. A revoked link stops working straight away.",
  },
  {
    title: "Channels for token holders",
    text: "Limit a channel to members who hold USDC, ETH or a particular NFT.",
  },
  {
    title: "Finer privacy controls",
    text: "Choose what others can see, from read receipts to typing indicators, and decide how the app looks.",
  },
];

/* ── Page ──────────────────────────────────────────────────────────────── */

export function HumanityLanding() {
  return (
    <div className={s.page}>
      <Nav />

      <main className={`${s.wrap} ${s.stack}`}>
        {/* Hero */}
        <section className={`${s.card} ${s.hero}`} aria-labelledby="hero-title">
          <div>
            <h1 id="hero-title" className={s.h1}>
              The private messenger you completely control.
            </h1>
            <p className={s.lead}>
              Message privately, join communities and send digital assets, without giving anyone your phone number.
              Ledger Chat is the first application built on Humanity Ledger.
            </p>
            <div className={s.heroCtas}>
              <Link href="/chat" className={`${s.btn} ${s.btnLg} ${s.btnPrimary}`}>
                Open Ledger Chat
                <ArrowRight size={18} strokeWidth={2} aria-hidden="true" />
              </Link>
              <a href="#how-it-works" className={`${s.btn} ${s.btnLg} ${s.btnSecondary}`}>
                How it works
              </a>
            </div>
            <ul className={s.trust}>
              <li>
                <Lock size={17} strokeWidth={1.9} aria-hidden="true" />
                Encrypted end to end
              </li>
              <li>
                <Smartphone size={17} strokeWidth={1.9} aria-hidden="true" />
                No phone number needed
              </li>
              <li>
                <Globe size={17} strokeWidth={1.9} aria-hidden="true" />
                Works in your browser
              </li>
            </ul>
          </div>
          <div className={s.heroVisual}>
            <HeroMap className={s.heroMap} />
          </div>
        </section>

        {/* Introducing Ledger Chat */}
        <section id="ledger-chat" className={`${s.card} ${s.reveal}`} aria-labelledby="intro-title">
          <div className={s.sectionHead}>
            <p className={s.eyebrow}>Ledger Chat</p>
            <h2 id="intro-title" className={s.h2}>
              Introducing Ledger Chat.
            </h2>
            <p className={s.lead}>
              Ledger Chat brings the privacy of a decentralized network to a messenger that feels as simple as the ones
              you already use.
            </p>
          </div>
          <div className={s.pillars}>
            {PILLARS.map(({ icon: Icon, title, text, visual }, i) => (
              <article key={title} className={s.pillar} style={{ ["--i" as string]: i } as React.CSSProperties}>
                <div>
                  <span className={s.pillarIcon} aria-hidden="true">
                    <Icon size={20} strokeWidth={1.75} />
                  </span>
                  <h3 className={s.pillarTitle}>{title}</h3>
                  <p className={s.body}>{text}</p>
                </div>
                {visual}
              </article>
            ))}
          </div>
        </section>

        {/* How it works */}
        <section id="how-it-works" className={`${s.card} ${s.reveal}`} aria-labelledby="steps-title">
          <div className={s.sectionHead}>
            <p className={s.eyebrow}>How it works</p>
            <h2 id="steps-title" className={s.h2}>
              Start communicating in 60 seconds.
            </h2>
            <p className={s.lead}>Anyone can set up a private identity and start a conversation straight away.</p>
          </div>
          <ol className={s.steps}>
            {STEPS.map((st, i) => (
              <li key={st.title} className={s.step}>
                <span className={s.stepNum} aria-hidden="true">
                  {i + 1}
                </span>
                <h3 className={s.h3}>{st.title}</h3>
                <p className={s.body}>{st.text}</p>
              </li>
            ))}
          </ol>
        </section>

        {/* What you can do */}
        <section className={`${s.card} ${s.reveal}`} aria-labelledby="tiles-title">
          <div className={s.sectionHead}>
            <h2 id="tiles-title" className={s.h2}>
              More than messages.
            </h2>
            <p className={s.lead}>
              The conversation is where people already agree on things. Ledger Chat lets them settle them there too.
            </p>
          </div>
          <div className={s.tiles}>
            {TILES.map(({ icon: Icon, title, text }) => (
              <div key={title} className={s.tile}>
                <span className={s.tileIcon} aria-hidden="true">
                  <Icon size={19} strokeWidth={1.75} />
                </span>
                <h3 className={s.h3}>{title}</h3>
                <p className={s.body}>{text}</p>
              </div>
            ))}
          </div>
        </section>

        {/* Payments */}
        <section id="payments" className={`${s.card} ${s.reveal}`} aria-labelledby="pay-title">
          <div className={s.split}>
            <div>
              <p className={s.eyebrow}>Aztec Network and zk.money</p>
              <h2 id="pay-title" className={s.h2}>
                Confidential payments, powered by Aztec.
              </h2>
              <p className={s.lead}>
                Humanity Ledger brings zk.money back inside the app. Payments are proven on your own device, so balances
                stay hidden and transfers cannot be traced on the blockchain.
              </p>
              <ul className={s.defs}>
                {PAYMENT_FEATURES.map((f) => (
                  <li key={f.title}>
                    <p className={s.defTitle}>
                      {f.title}
                      {f.tag && <span className={s.defTag}>{f.tag}</span>}
                    </p>
                    <p className={s.small}>{f.text}</p>
                  </li>
                ))}
              </ul>
              <div className={s.note}>
                <Info size={17} strokeWidth={1.75} aria-hidden="true" />
                <span>
                  Aztec is still in alpha. In August 2026 its developers reported a critical flaw in Alpha V5 and announced
                  a fix in V6, and our payment contracts have not been independently audited yet. Private payments are
                  experimental: only use amounts you are comfortable losing.
                </span>
              </div>
              <div style={{ marginTop: 28 }}>
                <Link href="/docs/zero-knowledge" className={s.textLink}>
                  How private payments work
                  <ArrowRight size={16} strokeWidth={2} aria-hidden="true" />
                </Link>
              </div>
            </div>
            <ReceiptVignette />
          </div>
        </section>

        {/* Comparison */}
        <section className={`${s.card} ${s.reveal}`} aria-labelledby="compare-title">
          <div className={s.sectionHead}>
            <h2 id="compare-title" className={s.h2}>
              Why Ledger Chat is different.
            </h2>
            <p className={s.lead}>
              Most messengers are paid for with attention and data. Ledger Chat is built around privacy instead of
              advertising, and it says plainly where it is still catching up.
            </p>
          </div>
          <div className={s.tableBox}>
            <table className={s.table}>
              <thead>
                <tr>
                  <th scope="col">Feature</th>
                  <th scope="col" className={s.ours}>
                    Ledger Chat
                  </th>
                  <th scope="col">WhatsApp</th>
                  <th scope="col">Telegram</th>
                </tr>
              </thead>
              <tbody>
                {COMPARE.map((r) => (
                  <tr key={r.row}>
                    <td>{r.row}</td>
                    <td className={s.ours}>
                      <MarkCell v={r.ours} />
                    </td>
                    <td>
                      <MarkCell v={r.whatsapp} />
                    </td>
                    <td>
                      <MarkCell v={r.telegram} />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <ul className={s.compareList}>
            {COMPARE.map((r) => (
              <li key={r.row} className={s.compareItem}>
                <p className={s.compareFeature}>{r.row}</p>
                <div className={`${s.compareRow} ${s.compareRowOurs}`}>
                  <span>Ledger Chat</span>
                  <MarkCell v={r.ours} />
                </div>
                <div className={s.compareRow}>
                  <span>WhatsApp</span>
                  <MarkCell v={r.whatsapp} />
                </div>
                <div className={s.compareRow}>
                  <span>Telegram</span>
                  <MarkCell v={r.telegram} />
                </div>
              </li>
            ))}
          </ul>
        </section>

        {/* Experience */}
        <section className={`${s.card} ${s.reveal}`} aria-labelledby="exp-title">
          <div className={s.sectionHead}>
            <h2 id="exp-title" className={s.h2}>
              Decentralization does not have to mean friction.
            </h2>
            <p className={s.lead}>
              Privacy is a right, but people only keep using what is easy. We hid the machinery so you can concentrate on
              the conversation.
            </p>
          </div>
          <div className={s.tiles} style={{ gridTemplateColumns: "repeat(auto-fit, minmax(260px, 1fr))" }}>
            {EXPERIENCE.map(({ icon: Icon, title, text }) => (
              <div key={title} className={s.tile}>
                <span className={s.tileIcon} aria-hidden="true">
                  <Icon size={19} strokeWidth={1.75} />
                </span>
                <h3 className={s.h3}>{title}</h3>
                <p className={s.body}>{text}</p>
              </div>
            ))}
          </div>
        </section>

        {/* Features */}
        <section className={`${s.card} ${s.reveal}`} aria-labelledby="features-title">
          <div className={s.sectionHead}>
            <h2 id="features-title" className={s.h2}>
              Everything you expect from a messenger.
            </h2>
            <p className={s.lead}>
              All the everyday features of a modern messenger, without advertising trackers or behavioural profiling.
            </p>
          </div>
          <ul className={s.checklist}>
            {CHECKLIST.map((c) => (
              <li key={c}>
                <Check size={18} strokeWidth={2.25} aria-hidden="true" />
                {c}
              </li>
            ))}
          </ul>
        </section>

        {/* Platforms */}
        <section id="download" className={`${s.card} ${s.reveal}`} aria-labelledby="platforms-title">
          <div className={s.sectionHead}>
            <h2 id="platforms-title" className={s.h2}>
              Use it wherever you are.
            </h2>
            <p className={s.lead}>
              Ledger Chat runs in any modern browser today. Your conversations follow you to every device you link.
            </p>
          </div>
          <div className={s.platforms}>
            <div className={s.platform}>
              <Globe size={24} strokeWidth={1.6} aria-hidden="true" />
              <p className={s.platformStatus + " " + s.platformLive}>Available now</p>
              <h3 className={s.h3}>Web browser</h3>
              <p className={s.small}>Chrome, Edge, Firefox and Safari, on desktop and on mobile. Nothing to install.</p>
              <div className={s.platformAction}>
                <Link href="/chat" className={`${s.btn} ${s.btnSm} ${s.btnPrimary}`}>
                  Open in your browser
                </Link>
              </div>
            </div>
            <div className={s.platform}>
              <Monitor size={24} strokeWidth={1.6} aria-hidden="true" />
              <p className={s.platformStatus}>Preview</p>
              <h3 className={s.h3}>Windows</h3>
              <p className={s.small}>
                A preview for Windows 10 and 11. It is not signed yet, so Windows will warn you before it opens.
              </p>
              <div className={s.platformAction}>
                <a href="/releases/Ledger-Chat-Setup-Windows.exe" download className={`${s.btn} ${s.btnSm} ${s.btnSecondary}`}>
                  <Download size={15} strokeWidth={2} aria-hidden="true" />
                  Download preview
                </a>
              </div>
            </div>
            <div className={s.platform}>
              <Smartphone size={24} strokeWidth={1.6} aria-hidden="true" />
              <p className={s.platformStatus}>In development</p>
              <h3 className={s.h3}>iPhone</h3>
              <p className={s.small}>A native app for iOS 16 and later. Until it ships, Ledger Chat works in Safari.</p>
            </div>
            <div className={s.platform}>
              <Smartphone size={24} strokeWidth={1.6} aria-hidden="true" />
              <p className={s.platformStatus}>In development</p>
              <h3 className={s.h3}>Android</h3>
              <p className={s.small}>A native app for Android 10 and later. Until it ships, Ledger Chat works in Chrome.</p>
            </div>
          </div>
        </section>

        {/* Updates */}
        <section className={`${s.card} ${s.reveal}`} aria-labelledby="updates-title">
          <div className={`${s.sectionHead} ${s.headRow}`} style={{ maxWidth: "none" }}>
            <div style={{ maxWidth: 680 }}>
              <h2 id="updates-title" className={s.h2}>
                Recent improvements.
              </h2>
              <p className={s.lead}>Ledger Chat ships improvements continuously. These are the most recent.</p>
            </div>
            <Link href="/changelog" className={s.textLink}>
              Full changelog
              <ArrowUpRight size={16} strokeWidth={2} aria-hidden="true" />
            </Link>
          </div>
          <ul className={s.updates}>
            {UPDATES.map((u) => (
              <li key={u.title} className={s.update}>
                <p className={s.updateTitle}>{u.title}</p>
                <p className={s.body}>{u.text}</p>
              </li>
            ))}
          </ul>
        </section>

        {/* Closing */}
        <section className={`${s.card} ${s.closing} ${s.reveal}`} aria-labelledby="closing-title">
          <div className={s.closingMark}>
            <HLLogo variant="mark" size={64} />
          </div>
          <h2 id="closing-title" className={s.h2}>
            Start a private conversation.
          </h2>
          <p className={s.lead}>
            Ledger Chat is free, open to anyone and private by default. It runs in your browser, with nothing to install.
          </p>
          <div className={s.closingCtas}>
            <Link href="/chat" className={`${s.btn} ${s.btnLg} ${s.btnPrimary}`}>
              Open Ledger Chat
            </Link>
            <Link href="/communities" className={`${s.btn} ${s.btnLg} ${s.btnSecondary}`}>
              Explore communities
            </Link>
          </div>
        </section>
      </main>

      <SiteFooter />
    </div>
  );
}

export default HumanityLanding;
