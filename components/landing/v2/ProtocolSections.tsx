"use client";

import React from "react";
import s from "./Landing.module.css";
import p from "./Protocol.module.css";

/**
 * Landing sections: how the layers fit and where it runs.
 *
 * The HLC token section (supply, allocations, vesting, launch conditions) was removed on
 * 19 November 2026 with the token model (decision PA-1): HLC is a test token with no monetary
 * value and no launch is planned.
 */

/* ── How it fits together ─────────────────────────────────────────────────── */

const LAYERS = [
  {
    name: "Ledger Chat",
    text: "The app: direct messages, communities, calls and a private wallet, in the browser on a computer or a phone.",
    fact: "Your wallet is your account",
  },
  {
    name: "XMTP with MLS",
    text: "Direct messages are encrypted on your device with the MLS protocol and carried by the XMTP network. Only the two of you hold the keys.",
    fact: "End-to-end encrypted",
  },
  {
    name: "Aztec Alpha",
    text: "Private payments and agreements. Amounts and recipients stay private, and the proof is made on your own device. On Alpha the account that pays the network fee is visible.",
    fact: "Proofs made on your device",
  },
  {
    name: "Ethereum",
    text: "Aztec settles on Ethereum mainnet. Network fees are paid in Fee Juice, bridged from Ethereum through Aztec's own portal, which the app pins and checks.",
    fact: "Settles on chain 1",
  },
] as const;

export function StackSection() {
  return (
    <div className={p.section}>
      <div className={s.sectionHead}>
        <h2 id="stack-title" className={s.h2}>
          Four layers, each doing one job.
        </h2>
        <p className={p.lead}>
          Ledger Chat does not invent its own cryptography. It joins open protocols that already carry real messages and
          real value, and checks each of them before it trusts them.
        </p>
      </div>
      <ol className={p.stack}>
        {LAYERS.map((l) => (
          <li key={l.name} className={p.layer}>
            <h3 className={p.layerName}>{l.name}</h3>
            <p className={p.layerText}>{l.text}</p>
            <p className={p.layerFact}>{l.fact}</p>
          </li>
        ))}
      </ol>
    </div>
  );
}

/* ── Where it runs ────────────────────────────────────────────────────────── */

const DEVICES = [
  {
    name: "Computer",
    frame: "desktop",
    live: true,
    status: "Available now",
    text: "Any current browser on macOS, Windows or Linux. Nothing to install.",
  },
  {
    name: "iPhone",
    frame: "phone",
    live: true,
    status: "In Safari now",
    text: "Open ledgerchat.org in Safari and add it to the Home Screen. A native app is in development.",
  },
  {
    name: "Android",
    frame: "phone",
    live: true,
    status: "In Chrome now",
    text: "Open ledgerchat.org in Chrome and install it from the menu. A native app is in development.",
  },
] as const;

export function DevicesSection() {
  return (
    <div className={p.section}>
      <div className={s.sectionHead}>
        <h2 id="devices-title" className={s.h2}>
          The same account on every screen.
        </h2>
        <p className={p.lead}>
          Sign in with the same wallet and your conversations follow you. Proofs for private payments are made on the
          device you are holding.
        </p>
      </div>
      <div className={p.devices}>
        {DEVICES.map((d) => (
          <article key={d.name} className={p.device}>
            <div className={`${p.deviceFrame} ${d.frame === "desktop" ? p.frameDesktop : p.framePhone}`} aria-hidden="true">
              <span className={p.screenLine} />
              <span className={p.screenLine} />
              <span className={p.screenLine} />
            </div>
            <h3 className={p.deviceName}>{d.name}</h3>
            <p className={p.deviceStatus}>
              <span className={d.live ? p.dotLive : p.dotLater} aria-hidden="true" />
              {d.status}
            </p>
            <p className={p.deviceText}>{d.text}</p>
          </article>
        ))}
      </div>
    </div>
  );
}
