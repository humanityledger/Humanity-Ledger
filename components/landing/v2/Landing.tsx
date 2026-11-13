"use client";

import React from "react";
import Link from "next/link";
import { AZTEC_WALLET_CONFIG, networkLabel } from "@/lib/aztec/wallet/config";
import { SiteFooter } from "./SiteFooter";
import { GlyphField } from "@/components/immersive/GlyphField";
import { SiteNav } from "@/components/immersive/SiteNav";
import { PhoneShowcase, phoneShowcaseStyles } from "./PhoneShowcase";
import { AztecSection, DesktopTour, LiveActivities } from "./Showcase";
import { DevicesSection, StackSection, TokenSection } from "./ProtocolSections";
import s from "./Landing.module.css";
import st from "./Story.module.css";

/**
 * Ledger Chat landing page.
 *
 * Few words, each one true. The page says what Ledger Chat is in one line, shows the real
 * interface, and keeps the details (protocol, limits, comparisons) in the documentation, where
 * they can be read in full. What it may not say, because the product does not do it:
 *
 *   "Zero central servers"          community data and a relay path use our servers
 *   "Audited"                       no third-party audit has taken place
 *   "Military-grade" encryption     not a measurable property
 *   "Built for four billion"        a design target, never tested; not a claim for a landing page
 *   "Made by ... & Aztec Network"   Aztec does not make Ledger Chat; it is built on Aztec
 *
 * Motion: every effect is a CSS scroll-driven animation (transform and opacity only), so it runs
 * on the compositor at the display's own refresh rate and plays backwards when you scroll back
 * up. Browsers without scroll timelines get the finished, still page. The only script per frame
 * is the cursor lens of GlyphField, which redraws a few hundred cells from an atlas and rests
 * when nothing moves.
 */

const ALPHA = AZTEC_WALLET_CONFIG.network === "mainnet" && AZTEC_WALLET_CONFIG.alphaEnabled;

/** Splits a line into words that light up one after another as the block crosses the screen. */
function Words({ text, from = 0 }: { text: string; from?: number }) {
  return (
    <>
      {text.split(" ").map((w, i) => (
        <span key={i} className={st.word} style={{ ["--i" as string]: from + i } as React.CSSProperties}>
          {w}{" "}
        </span>
      ))}
    </>
  );
}

const STATEMENTS: { n: string; label: string; title: string; line: string }[] = [
  {
    n: "01",
    label: "Identity",
    title: "No phone number.",
    line: "Your wallet is your account, and it belongs to you.",
  },
  {
    n: "02",
    label: "Messages",
    title: "Read by two people.",
    line: "Direct messages are encrypted on your device, with MLS over XMTP.",
  },
  {
    n: "03",
    label: "Payments",
    title: "Money, like a message.",
    line: `Private payments on ${networkLabel()}, proved on your own device.`,
  },
  {
    n: "04",
    label: "Calls",
    title: "Calls, from the chat.",
    line: "Voice and video between your devices, encrypted in transit.",
  },
];

export function HumanityLanding() {
  return (
    <div className={`${s.page} ${st.page}`}>
      <GlyphField ambient />
      <SiteNav />

      <main id="main-content">
        {/* Hero: one line, one action. */}
        <section className={st.hero} aria-labelledby="hero-title">
          <div className={st.heroField} aria-hidden="true" />
          <div className={st.heroInner}>
            <h1 id="hero-title" className={st.heroTitle}>
              <span className={st.heroLine}>Talk freely.</span>
              <span className={`${st.heroLine} ${st.heroLine2}`}>
                <em>Pay privately.</em>
              </span>
            </h1>
            <p className={st.heroLead}>
              Messages, calls and private payments in one encrypted place. Your wallet is your account.
            </p>
            <div className={st.heroCtas}>
              <Link href="/chat" className={`${s.btn} ${s.btnLg} ${s.btnPrimary}`}>
                Open Ledger Chat
              </Link>
              <a href="#desktop" className={`${s.btn} ${s.btnLg} ${s.btnSecondary}`}>
                See it
              </a>
            </div>
          </div>
          <span className={st.scrollCue} aria-hidden="true" />
        </section>

        <div className={`${s.wrap} ${st.stack}`}>
          {/* The real interface on a computer, pinned while you scroll through it. */}
          <DesktopTour />

          {/* Four things, said once each. */}
          <section id="principles" className={st.statements} aria-label="What Ledger Chat is">
            {STATEMENTS.map((x) => (
              <article key={x.n} className={st.statement}>
                <span className={st.statementField} aria-hidden="true" />
                <p className={st.statementLabel}>
                  <span>{x.n}</span>
                  {x.label}
                </p>
                <h2 className={st.statementTitle}>
                  <Words text={x.title} />
                </h2>
                <p className={st.statementLine}>
                  <Words text={x.line} from={x.title.split(" ").length} />
                </p>
              </article>
            ))}
          </section>

          {/* On the phone. */}
          <section id="in-your-hand" className={`${s.card} ${phoneShowcaseStyles.showcase}`} aria-labelledby="hand-title">
            <div className={s.sectionHead}>
              <p className={s.eyebrow}>On your phone</p>
              <h2 id="hand-title" className={s.h2}>
                One private place. <em>In your hand.</em>
              </h2>
            </div>
            <PhoneShowcase />
          </section>

          <LiveActivities />

          <AztecSection />

          {/* How the layers fit: Ledger Chat, XMTP with MLS, Aztec Alpha, Ethereum. */}
          <section id="stack" className={s.card} aria-labelledby="stack-title">
            <StackSection />
          </section>

          {/* Computer, iPhone, Android. */}
          <section id="devices" className={s.card} aria-labelledby="devices-title">
            <DevicesSection />
          </section>

          {/* HLC: the plan, its distribution and its launch conditions, from lib/protocol/tokenomics.ts. */}
          <section id="hlc" className={s.card} aria-labelledby="hlc-title">
            <TokenSection />
          </section>

          {/* Close. */}
          <section id="start" className={st.closing} aria-labelledby="closing-title">
            <span className={st.closingField} aria-hidden="true" />
            <h2 id="closing-title" className={st.closingTitle}>
              <Words text="Start a private" /> <em><Words text="conversation." from={3} /></em>
            </h2>
            <p className={st.closingLead}>Free. Runs in your browser, nothing to install.</p>
            <div className={st.heroCtas}>
              <Link href="/chat" className={`${s.btn} ${s.btnLg} ${s.btnPrimary}`}>
                Open Ledger Chat
              </Link>
              <Link href="/docs/overview" className={`${s.btn} ${s.btnLg} ${s.btnSecondary}`}>
                Read the documentation
              </Link>
            </div>
            <p className={st.closingNote}>
              {ALPHA
                ? "Private payments use real funds on Aztec Alpha, with a cap per payment. The contracts are not audited yet."
                : "Private payments run on the Aztec test network, with tokens that have no value."}{" "}
              iPhone and Android apps are in development.
            </p>
          </section>
        </div>
      </main>

      <SiteFooter lead={false} />
    </div>
  );
}

export default HumanityLanding;
