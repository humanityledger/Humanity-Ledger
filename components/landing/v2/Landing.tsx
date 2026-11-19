"use client";

import React, { useEffect, useState } from "react";
import { AZTEC_WALLET_CONFIG, networkLabel } from "@/lib/aztec/wallet/config";
import { SiteFooter } from "./SiteFooter";
import { GlyphField } from "@/components/immersive/GlyphField";
import { SiteNav } from "@/components/immersive/SiteNav";
import { LivePhone, PhoneShowcase, phoneShowcaseStyles } from "./PhoneShowcase";
import { AppearancePlayground, FirstPaymentRecord, LaunchClose, LaunchHero, StackExplorer, type LandingMode } from "./LaunchSections";
import { AztecSection, DesktopTour, LiveActivities } from "./Showcase";
import { DevicesSection } from "./ProtocolSections";
import { LiveGlobe } from "./LiveGlobe";
import s from "./Landing.module.css";
import st from "./Story.module.css";

/**
 * Ledger Chat landing page, in white (a switch in the hero offers dark): the launch on Aztec
 * Alpha first (LaunchSections.tsx), then the product in cards.
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

const MODE_KEY = "hl_landing_mode";

export function HumanityLanding() {
  // White is the landing. Dark only if the visitor picks it, remembered on this device.
  const [mode, setMode] = useState<LandingMode>("light");
  useEffect(() => {
    try {
      if (localStorage.getItem(MODE_KEY) === "dark") setMode("dark");
    } catch {
      /* storage unavailable */
    }
  }, []);
  const pickMode = (m: LandingMode) => {
    setMode(m);
    try {
      localStorage.setItem(MODE_KEY, m);
    } catch {
      /* storage unavailable */
    }
  };
  return (
    <div className={`${s.page} ${st.page}`} data-landing-theme={mode}>
      <GlyphField ambient />
      <SiteNav />

      <main id="main-content">
        {/* Hero: live on Alpha, one action, where it runs today. */}
        <LaunchHero alpha={ALPHA} mode={mode} onMode={pickMode} phone={<LivePhone id="stickers" fill={0.92} />} />

        <div className={`${s.wrap} ${st.stack}`}>
          {ALPHA && <FirstPaymentRecord />}

          {/* Live: accounts, @usernames and visitors on a lit globe, from the database (lib/stats). */}
          <LiveGlobe />

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
          <StackExplorer />

          {/* Themes, wallpapers, bubbles and stickers, to try on the page. */}
          <AppearancePlayground />

          {/* Computer, iPhone, Android. */}
          <section id="devices" className={s.card} aria-labelledby="devices-title">
            <DevicesSection />
          </section>

          {/* Close. */}
          <LaunchClose alpha={ALPHA} />
        </div>
      </main>

      <SiteFooter lead={false} />
    </div>
  );
}

export default HumanityLanding;
