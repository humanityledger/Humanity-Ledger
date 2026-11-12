"use client";

import React, { useEffect, useState } from "react";
import Link from "next/link";
import { HLLogo } from "@/components/shared/HLLogo";
import { AZTEC_WALLET_CONFIG, networkLabel } from "@/lib/aztec/wallet/config";
import { RemoteLottie } from "@/components/ui/RemoteLottie";
import { HeroMap } from "./HeroMap";
import { SiteFooter } from "./SiteFooter";
import { Figure } from "@/components/docs/v2/Figures";
import { GlyphField } from "@/components/immersive/GlyphField";
import { SiteNav } from "@/components/immersive/SiteNav";
import { PhoneShowcase, phoneShowcaseStyles } from "./PhoneShowcase";
import { FilmSection } from "./FilmSection";
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
        <div className={s.small}>
          ledgerchat.org wants you to sign in with your Ethereum account.
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
          <span className={s.nodeLabel}>Your device</span>
          <span className={s.nodeHint}>Encrypts the message</span>
        </div>
        <span className={s.wire} aria-hidden="true" />
        <div className={s.node}>
          <span className={s.nodeLabel}>XMTP network</span>
          <span className={s.nodeHint}>Carries only ciphertext</span>
        </div>
        <span className={s.wire} aria-hidden="true" />
        <div className={s.node}>
          <span className={s.nodeLabel}>Their device</span>
          <span className={s.nodeHint}>Decrypts it</span>
        </div>
      </div>
      <div className={s.routeFoot}>
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

/** Facts only; each cell must stay true of each product today. */
const WHY_ROWS: [string, string, string, string, string][] = [
  ["Account", "Your Ethereum wallet", "Phone number", "Phone number", "Phone number"],
  ["Direct messages encrypted by default", "Yes, MLS over XMTP", "Yes", "Yes", "Only in secret chats"],
  ["Pay inside the chat, settled on Ethereum", "Yes, privately on Aztec", "No", "No", "No"],
  ["Build a page or app by describing it", "Yes, Ledger Studio", "No", "No", "No"],
  ["Source code", "Public", "Closed", "Public", "Public apps, closed server"],
];

const PILLARS = [
  {
    title: "Private by default.",
    text: "Every direct message is encrypted on your device before it travels. Only the person you are writing to holds the key to read it.",
    visual: <ChatVignette />,
  },
  {
    title: "Your wallet is your identity.",
    text: "No phone number, no email and no password. You sign in with your wallet, and your account belongs to you alone.",
    visual: <SignatureVignette />,
  },
  {
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
    title: "Communities",
    text: "Run large groups with free and paid channels, announcements, polls and revocable invite links. Paying a member opens a private chat with them, so the community server never sees it.",
  },
  {
    title: "Payments in the chat",
    text: "Send test USDC, DAI or ETH privately to the person you are talking to, once their Aztec address is verified.",
  },
  {
    title: "Private payments",
    text: "Shielded transfers on the Aztec network keep the amount and the recipient off the public ledger.",
  },
  {
    title: "Every device you use",
    text: "Use Ledger Chat on your phone and your computer. Link a new device by scanning a code.",
  },
];

const PAYMENT_FEATURES = [
  {
    title: "Proofs made in your browser",
    text: "The proof for each payment is generated on your device. Your keys and notes stay in this browser's storage and are never sent to our servers.",
  },
  {
    title: "Verified recipients",
    text: "Money only goes to an Aztec address the other person signed for. If it cannot be verified, the payment is blocked.",
  },
  {
    title: "Escrow and streaming agreements",
    tag: "Test network",
    text: "Lock funds until work is delivered, or pay over time, from inside a conversation. Both sides can see the state on Aztec.",
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
        <span className={s.srOnly}>Yes</span>
      </span>
    );
  if (v === "no")
    return (
      <span className={`${s.cell} ${s.no}`}>
        <span className={s.srOnly}>No</span>
      </span>
    );
  return <span className={s.cell}>{v}</span>;
}

const EXPERIENCE = [
  {
    title: "Lock it your way",
    text: "Turn on the app lock in Settings, so a borrowed laptop does not mean an open inbox.",
  },
  {
    title: "A calm interface",
    text: "Clear type, generous spacing and nothing competing with your conversations. No gas to calculate and no menus to decode.",
  },
  {
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
  const [installPrompt, setInstallPrompt] = useState<any>(null);
  const [pwaInstalled, setPwaInstalled] = useState(false);
  const [showWinVerify, setShowWinVerify] = useState(false);
  const [copiedSha, setCopiedSha] = useState(false);

  useEffect(() => {
    if (typeof window === "undefined") return;
    const isStandalone =
      window.matchMedia("(display-mode: standalone)").matches ||
      (window.navigator as unknown as { standalone?: boolean }).standalone === true;
    if (isStandalone) setPwaInstalled(true);

    const handlePrompt = (e: any) => {
      e.preventDefault();
      setInstallPrompt(e);
    };
    window.addEventListener("beforeinstallprompt", handlePrompt);
    window.addEventListener("appinstalled", () => setPwaInstalled(true));
    return () => {
      window.removeEventListener("beforeinstallprompt", handlePrompt);
    };
  }, []);

  const handleInstallClick = async () => {
    if (installPrompt) {
      try {
        await installPrompt.prompt();
        const choice = await installPrompt.userChoice;
        if (choice.outcome === "accepted") setPwaInstalled(true);
      } catch {}
    } else {
      window.location.href = "/chat";
    }
  };

  const handleCopySha = () => {
    navigator.clipboard?.writeText("96bf4a3e66372df155a4f167dd62eadb6503c26923a90c54bfbfe76e3a145a1c");
    setCopiedSha(true);
    setTimeout(() => setCopiedSha(false), 3000);
  };

  return (
    <div className={s.page}>
      <GlyphField />
      <SiteNav />

      <main className={`${s.wrap} ${s.stack}`}>
        {/* Hero */}
        <section className={`${s.card} ${s.open} ${s.hero}`} aria-labelledby="hero-title">
          <div>
            <h1 id="hero-title" className={s.h1}>
              The private messenger <em>you completely control.</em>
            </h1>
            <p className={s.lead}>
              Message privately, join communities and send digital assets, without giving anyone your phone number.
              Ledger Chat is the first application built on Humanity Ledger.
            </p>
            <div className={s.heroCtas}>
              <Link href="/chat" className={`${s.btn} ${s.btnLg} ${s.btnPrimary}`}>
                Open Ledger Chat
              </Link>
              <a href="#how-it-works" className={`${s.btn} ${s.btnLg} ${s.btnSecondary}`}>
                How it works
              </a>
            </div>
            <ul className={s.trust}>
              <li>
                Encrypted end to end
              </li>
              <li>
                No phone number needed
              </li>
              <li>
                Works in your browser
              </li>
            </ul>
          </div>
          <div className={s.heroVisual}>
            <HeroMap className={s.heroMap} />
          </div>
        </section>

        {/* 30-second film – between hero and feature pillars */}
        <FilmSection />

        {/* Introducing Ledger Chat */}
        <section id="ledger-chat" data-glow className={`${s.card} ${s.reveal}`} aria-labelledby="intro-title">
          <div className={s.sectionHead}>
            <p className={s.eyebrow}>Ledger Chat</p>
            <h2 id="intro-title" className={s.h2}>
              Introducing <em>Ledger Chat.</em>
            </h2>
            <p className={s.lead}>
              Ledger Chat brings the privacy of a decentralized network to a messenger that feels as simple as the ones
              you already use.
            </p>
          </div>
          <div className={s.pillars}>
            {PILLARS.map(({ title, text, visual }, i) => (
              <article key={title} className={s.pillar} style={{ ["--i" as string]: i } as React.CSSProperties}>
                <div>
                  <h3 className={s.pillarTitle}>{title}</h3>
                  <p className={s.body}>{text}</p>
                </div>
                {visual}
              </article>
            ))}
          </div>
        </section>

        {/* Ledger Chat in your hand */}
        <section id="in-your-hand" className={`${s.card} ${phoneShowcaseStyles.showcase}`} aria-labelledby="hand-title">
          <div className={s.sectionHead}>
            <p className={s.eyebrow}>Ledger Chat in your hand</p>
            <h2 id="hand-title" className={s.h2}>
              Messages, calls and payments. <em>One private place.</em>
            </h2>
            <p className={s.lead}>
              Eight moments of Ledger Chat between two people, the way they look on your phone: messages, a private
              payment, the wallet, your own look, Ledger Studio, a voice call, a video call and a community. Keep
              scrolling to watch each one happen.
            </p>
          </div>
          <PhoneShowcase />
        </section>
        {/* Why Ledger Chat: plain comparison, facts only */}
        <section id="why" data-glow className={`${s.card} ${s.reveal}`} aria-labelledby="why-title">
          <div className={s.sectionHead}>
            <p className={s.eyebrow}>Why Ledger Chat</p>
            <h2 id="why-title" className={s.h2}>
              The messenger where <em>money moves like a message.</em>
            </h2>
            <p className={s.lead}>
              WhatsApp, Signal and Telegram ask for your phone number and stop at the conversation. Ledger Chat starts
              from your wallet, so paying someone is part of talking to them.
            </p>
          </div>
          <div style={{ overflowX: "auto", marginTop: 8 }}>
            <table style={{ width: "100%", minWidth: 640, borderCollapse: "collapse", fontSize: 15, lineHeight: 1.45 }}>
              <thead>
                <tr>
                  {["", "Ledger Chat", "WhatsApp", "Signal", "Telegram"].map((h, i) => (
                    <th key={h || "row"} scope="col" style={{ textAlign: "left", padding: "14px 16px", fontWeight: 600, color: i === 1 ? "#0b0c0e" : "#6b7280", borderBottom: "1px solid #e4e7ec" }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {WHY_ROWS.map(([label, ...cells]) => (
                  <tr key={label}>
                    <th scope="row" style={{ textAlign: "left", padding: "16px", fontWeight: 500, color: "#5b6170", borderBottom: "1px solid #eef0f3", whiteSpace: "nowrap" }}>{label}</th>
                    {cells.map((c, i) => (
                      <td key={i} style={{ padding: "16px", borderBottom: "1px solid #eef0f3", color: i === 0 ? "#0b0c0e" : "#5b6170", fontWeight: i === 0 ? 600 : 400 }}>{c}</td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>

        {/* How it works */}
        <section id="how-it-works" data-glow className={`${s.card} ${s.reveal}`} aria-labelledby="steps-title">
          <div className={s.sectionHead}>
            <p className={s.eyebrow}>How it works</p>
            <h2 id="steps-title" className={s.h2}>
              Start communicating <em>in 60 seconds.</em>
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

        {/* The protocol, open to inspection (diagram shared with /docs/ecosystem) */}
        <section id="protocol" data-glow className={`${s.card} ${s.reveal}`} aria-labelledby="protocol-title">
          <div className={s.sectionHead}>
            <p className={s.eyebrow}>Protocol</p>
            <h2 id="protocol-title" className={s.h2}>
              Built in the open. <em>Checked by anyone.</em>
            </h2>
            <p className={s.lead}>
              One account, your wallet, and four groups of services on top of it. Every part is published with its design, its limits and its tests.
            </p>
          </div>
          <Figure kind="ecosystem" caption="Live: in use. Experimental: works, with stated limits. In development: built, not yet switched on." />
          <div className={s.protocolLinks}>
            <Link href="/docs/whitepaper" className={s.protocolLink}>Read the whitepaper</Link>
            <Link href="/docs/ecosystem" className={s.protocolLink}>Ecosystem and source code</Link>
            <Link href="/docs/whitepaper#linked-devices" className={s.protocolLink}>How linking a computer works</Link>
          </div>
        </section>

        {/* What you can do */}
        <section data-glow className={`${s.card} ${s.reveal}`} aria-labelledby="tiles-title">
          <div className={s.sectionHead}>
            <h2 id="tiles-title" className={s.h2}>
              More than <em>messages.</em>
            </h2>
            <p className={s.lead}>
              The conversation is where people already agree on things. Ledger Chat lets them settle them there too.
            </p>
          </div>
          <div className={s.tiles}>
            {TILES.map(({ title, text }) => (
              <div key={title} className={s.tile} data-glow>
                <h3 className={s.h3}>{title}</h3>
                <p className={s.body}>{text}</p>
              </div>
            ))}
          </div>
        </section>

        {/* Payments */}
        <section id="payments" data-glow className={`${s.card} ${s.reveal}`} aria-labelledby="pay-title">
          <div className={s.split}>
            <div>
              <p className={s.eyebrow}>Aztec Network and zk.money</p>
              <h2 id="pay-title" className={s.h2}>
                Confidential payments, <em>powered by Aztec.</em>
              </h2>
              <p className={s.lead}>
                Payments are proven on your own device and sent as private notes, so the amount and the recipient are not
                published. The network fee is the exception: on Aztec Alpha it is paid publicly from your account.
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
                <span>
                  Aztec is still in alpha. In August 2026 its developers reported a critical flaw in Alpha V5 and announced
                  a fix in V6, and our payment contracts have not been independently audited yet. Private payments are
                  experimental: only use amounts you are comfortable losing.
                </span>
              </div>
              <dl className={s.defs} aria-label="Current state of private payments">
                <div>
                  <dt className={s.defTitle}>Network today</dt>
                  <dd className={s.small} style={{ margin: 0 }}>
                    {AZTEC_WALLET_CONFIG.network === "testnet"
                      ? `${networkLabel()}. Test tokens only, nothing here has real value.`
                      : AZTEC_WALLET_CONFIG.alphaEnabled
                        ? `${networkLabel()}, with real funds and a cap per payment.`
                        : "Private payments are switched off on this build."}
                  </dd>
                </div>
                <div>
                  <dt className={s.defTitle}>What stays private</dt>
                  <dd className={s.small} style={{ margin: 0 }}>Amount, recipient and the agreement terms. Messages travel separately, end to end encrypted over XMTP.</dd>
                </div>
                <div>
                  <dt className={s.defTitle}>What is public</dt>
                  <dd className={s.small} style={{ margin: 0 }}>That your Aztec account sent a transaction, and on Alpha the fee it paid in Fee Juice.</dd>
                </div>
                <div>
                  <dt className={s.defTitle}>Who you trust</dt>
                  <dd className={s.small} style={{ margin: 0 }}>The Aztec network, the contracts (not yet audited) and the code this site serves to your browser. Our servers never hold your keys or notes.</dd>
                </div>
              </dl>
              <div style={{ marginTop: 28 }}>
                <Link href="/docs/zero-knowledge" className={s.textLink}>
                  How private payments work
                </Link>
              </div>
            </div>
            <ReceiptVignette />
          </div>
        </section>

        {/* Comparison */}
        <section data-glow className={`${s.card} ${s.reveal}`} aria-labelledby="compare-title">
          <div className={s.sectionHead}>
            <h2 id="compare-title" className={s.h2}>
              Why Ledger Chat <em>is different.</em>
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
        <section data-glow className={`${s.card} ${s.reveal}`} aria-labelledby="exp-title">
          <div className={s.sectionHead}>
            <h2 id="exp-title" className={s.h2}>
              Decentralization does not have to <em>mean friction.</em>
            </h2>
            <p className={s.lead}>
              Privacy is a right, but people only keep using what is easy. We hid the machinery so you can concentrate on
              the conversation.
            </p>
          </div>
          <div className={s.tiles} style={{ gridTemplateColumns: "repeat(auto-fit, minmax(260px, 1fr))" }}>
            {EXPERIENCE.map(({ title, text }) => (
              <div key={title} className={s.tile} data-glow>
                <h3 className={s.h3}>{title}</h3>
                <p className={s.body}>{text}</p>
              </div>
            ))}
          </div>
        </section>

        {/* Features */}
        <section data-glow className={`${s.card} ${s.reveal}`} aria-labelledby="features-title">
          <div className={s.sectionHead}>
            <h2 id="features-title" className={s.h2}>
              Everything you expect <em>from a messenger.</em>
            </h2>
            <p className={s.lead}>
              All the everyday features of a modern messenger, without advertising trackers or behavioural profiling.
            </p>
          </div>
          <ul className={s.checklist}>
            {CHECKLIST.map((c) => (
              <li key={c}>
                {c}
              </li>
            ))}
          </ul>
        </section>

        {/* Platforms */}
        <section id="download" data-glow className={`${s.card} ${s.reveal}`} aria-labelledby="platforms-title">
          <div className={s.sectionHead}>
            <h2 id="platforms-title" className={s.h2}>
              Use it <em>wherever you are.</em>
            </h2>
            <p className={s.lead}>
              Ledger Chat runs in any modern browser today. Your conversations follow you to every device you link.
            </p>
          </div>
          <div className={s.platforms}>
            <div className={s.platform}>
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
              <p className={s.platformStatus + " " + s.platformLive}>Windows 10 / 11</p>
              <h3 className={s.h3}>Windows</h3>
              <p className={s.small}>
                Install directly as a standalone desktop app, or download the verified open-source preview installer.
              </p>
              <div className={s.platformAction} style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
                <button
                  type="button"
                  onClick={handleInstallClick}
                  className={`${s.btn} ${s.btnSm} ${s.btnPrimary}`}
                  style={{ width: "100%", justifyContent: "center" }}
                >
                  {pwaInstalled ? "Launch Desktop App" : "Install Desktop App"}
                </button>
                <button
                  type="button"
                  onClick={() => setShowWinVerify(!showWinVerify)}
                  className={`${s.btn} ${s.btnSm} ${s.btnSecondary}`}
                  style={{ width: "100%", justifyContent: "center", fontSize: "12px", padding: "6px 12px" }}
                >
                  {showWinVerify ? "Hide details" : "Standalone .exe & SHA-256"}
                </button>
                {showWinVerify && (
                  <div style={{ marginTop: "10px", padding: "12px", background: "rgba(0,0,0,0.04)", borderRadius: "8px", fontSize: "11px", lineHeight: "1.5" }}>
                    <div style={{ fontWeight: 600, marginBottom: "4px" }}>Open-source binary (Windows x64)</div>
                    <div style={{ display: "flex", alignItems: "center", gap: "6px", margin: "6px 0" }}>
                      <a
                        href="/releases/Ledger-Chat-Setup-Windows.exe"
                        download
                        style={{ color: "var(--hl-ink)", textDecoration: "underline", fontWeight: 600 }}
                      >
                        Direct Download (.exe)
                      </a>
                      <span>·</span>
                      <a
                        href="https://github.com/humanityledger/Humanity-Ledger/releases"
                        target="_blank"
                        rel="noopener noreferrer"
                        style={{ color: "var(--hl-ink)", textDecoration: "underline" }}
                      >
                        GitHub Mirror
                      </a>
                    </div>
                    <div style={{ fontSize: "10px", color: "var(--hl-ink-3)", wordBreak: "break-all", background: "rgba(0,0,0,0.03)", padding: "6px", borderRadius: "4px" }}>
                      <strong>SHA-256:</strong><br />
                      96bf4a3e66372df155a4f167dd62eadb6503c26923a90c54bfbfe76e3a145a1c
                    </div>
                    <button
                      type="button"
                      onClick={handleCopySha}
                      style={{ marginTop: "6px", fontSize: "10px", cursor: "pointer", background: "none", border: "none", padding: 0, textDecoration: "underline", color: "var(--hl-ink-2)", display: "inline-flex", alignItems: "center", gap: "4px" }}
                    >
                      {copiedSha ? "✓ Hash copied to clipboard" : "Copy SHA-256 fingerprint"}
                    </button>
                    <p style={{ marginTop: "8px", fontSize: "10px", color: "var(--hl-ink-3)" }}>
                      <em>Note: For standalone .exe preview builds, Windows SmartScreen will ask for confirmation. Click &quot;More info&quot; → &quot;Run anyway&quot;. For zero warnings, use the 1-click &quot;Install Desktop App&quot; above.</em>
                    </p>
                  </div>
                )}
              </div>
            </div>
            <div className={s.platform}>
              <p className={s.platformStatus}>In development</p>
              <h3 className={s.h3}>iPhone</h3>
              <p className={s.small}>A native app for iOS 16 and later. Until it ships, Ledger Chat works in Safari.</p>
            </div>
            <div className={s.platform}>
              <p className={s.platformStatus}>In development</p>
              <h3 className={s.h3}>Android</h3>
              <p className={s.small}>A native app for Android 10 and later. Until it ships, Ledger Chat works in Chrome.</p>
            </div>
          </div>
        </section>

        {/* Updates */}
        <section data-glow className={`${s.card} ${s.reveal}`} aria-labelledby="updates-title">
          <div className={`${s.sectionHead} ${s.headRow}`} style={{ maxWidth: "none" }}>
            <div style={{ maxWidth: 680 }}>
              <h2 id="updates-title" className={s.h2}>
                Recent <em>improvements.</em>
              </h2>
              <p className={s.lead}>Ledger Chat ships improvements continuously. These are the most recent.</p>
            </div>
            <Link href="/docs/changelog" className={s.textLink}>
              Full changelog
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
        <section className={`${s.card} ${s.open} ${s.closing} ${s.reveal}`} aria-labelledby="closing-title">
          <div className={s.closingMark}>
            <HLLogo variant="mark" size={64} />
          </div>
          <h2 id="closing-title" className={s.h2}>
            Start a <em>private conversation.</em>
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
