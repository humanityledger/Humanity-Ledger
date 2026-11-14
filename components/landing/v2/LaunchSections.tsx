"use client";

/**
 * Landing sections for the launch on Aztec Alpha, white by default (a switch offers dark): the hero, the on-chain record of the first
 * private payment, the interactive stack and the appearance playground.
 *
 * Every figure here comes from the repository: the record from deployments/aztec-mainnet.json,
 * counts from the catalogues themselves (themes, wallpapers, bubble styles, stickers). Nothing is
 * claimed that the code does not do: messages use MLS through XMTP (we do not implement MLS), the
 * contracts are not audited, and the phone apps are not in the stores yet.
 */

import React, { useCallback, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { CHAT_THEMES, chatThemeVars } from "@/lib/chat/themes";
import { WALLPAPERS, canvasCss, resolveWallpaper } from "@/lib/chat/wallpapers";
import { BUBBLE_STYLES, bubbleClasses } from "@/lib/chat/bubbleStyles";
import { STICKER_PACKS, stickerFile, stickerMessage, stickerRef } from "@/lib/chat/stickers";
import "@/app/ledger-chat-settings.css";
import s from "./Launch.module.css";
import { DeviceFrame } from "./DeviceFrame";

/** The first private payment from Ledger Chat on Aztec Alpha (deployments/aztec-mainnet.json). */
export const FIRST_PAYMENT = {
  date: "14 November 2026",
  block: 29012,
  tx: "0x1eb2bb76ae52d876e0ef8e107bf9de5b83ce9cb42850a1a1a938cae3c24040a5",
  token: "0x1f49571a48699da4e70e1b7dbc5afcea5bb712f7b2cfaf432353e694851e24e5",
  tokenBlock: 28992,
  preflightRun: "43583640304",
  preflightUrl: "https://github.com/humanityledger/Humanity-Ledger/actions/runs/43583640304",
};

const short = (h: string) => `${h.slice(0, 8)}…${h.slice(-4)}`;
const STICKER_COUNT = STICKER_PACKS.reduce((n, p) => n + p.stickers.length, 0);

/* ── Small marks (drawn here, no brand artwork) ─────────────────────── */

function PhoneGlyph() {
  return (
    <svg viewBox="0 0 24 24" width="22" height="22" aria-hidden="true">
      <rect x="6" y="2.5" width="12" height="19" rx="3" fill="none" stroke="currentColor" strokeWidth="1.6" />
      <rect x="10" y="4.6" width="4" height="1.3" rx=".65" fill="currentColor" />
    </svg>
  );
}
function PlayGlyph() {
  return (
    <svg viewBox="0 0 24 24" width="22" height="22" aria-hidden="true">
      <path d="M6 3.8v16.4a1 1 0 0 0 1.5.86l13.2-8.2a1 1 0 0 0 0-1.72L7.5 2.94A1 1 0 0 0 6 3.8Z" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinejoin="round" />
    </svg>
  );
}
function GlobeGlyph() {
  return (
    <svg viewBox="0 0 24 24" width="20" height="20" aria-hidden="true">
      <circle cx="12" cy="12" r="9" fill="none" stroke="currentColor" strokeWidth="1.6" />
      <path d="M3 12h18M12 3c2.6 2.6 3.9 5.6 3.9 9s-1.3 6.4-3.9 9c-2.6-2.6-3.9-5.6-3.9-9S9.4 5.6 12 3Z" fill="none" stroke="currentColor" strokeWidth="1.4" />
    </svg>
  );
}

/* ── Hero ───────────────────────────────────────────────────────────── */

export type LandingMode = "light" | "dark";

export function LaunchHero({ alpha, phone, mode, onMode }: { alpha: boolean; phone?: React.ReactNode; mode?: LandingMode; onMode?: (m: LandingMode) => void }) {
  return (
    <section className={s.hero} aria-labelledby="hero-title">
      {onMode && (
        <div className={s.modeSwitch} role="group" aria-label="Page colours">
          {(["light", "dark"] as const).map((m) => (
            <button key={m} type="button" aria-pressed={(mode ?? "light") === m} onClick={() => onMode(m)}>
              {m === "light" ? "Light" : "Dark"}
            </button>
          ))}
        </div>
      )}
      <div className={s.heroGlow} aria-hidden="true" />
      <div className={s.heroGrid} aria-hidden="true" />
      <div className={s.heroInner}>
        <div className={s.heroCopy}>
          <p className={s.kicker}>Ledger Chat</p>
          <h1 id="hero-title" className={s.heroTitle}>
            Encrypted messages and private payments, in one place.
          </h1>
          <p className={s.heroLead}>
            Messages are end-to-end encrypted with MLS over XMTP. Payments are proved on your own device with Aztec and settled on
            Ethereum. Your wallet is your account.
          </p>
          <div className={s.ctas}>
            <Link href="/chat" className={`${s.btn} ${s.btnLight}`}>
              Open Ledger Chat
            </Link>
            <a href="#stack" className={`${s.btn} ${s.btnGhost}`}>
              How it works
            </a>
          </div>

          <dl className={s.facts}>
            <div className={s.fact}>
              <dt>Network</dt>
              <dd>{alpha ? "Aztec Alpha, on Ethereum" : "Aztec test network"}</dd>
            </div>
            <div className={s.fact}>
              <dt>{alpha ? "First private payment" : "Messaging"}</dt>
              <dd>{alpha ? <a href="#record">L2 block {FIRST_PAYMENT.block.toLocaleString("en-US")}</a> : "MLS over XMTP"}</dd>
            </div>
            <div className={s.fact}>
              <dt>Proofs</dt>
              <dd>Made on your device</dd>
            </div>
          </dl>

          <div className={s.availability} aria-label="Where Ledger Chat runs">
            <div className={s.availLive}>
              <GlobeGlyph />
              <span>
                <strong>Available today</strong> as a web app you can install: iPhone (Safari, Chrome), Android, Mac, Windows, Linux.
              </span>
            </div>
            <div className={s.stores}>
              <span className={s.store}>
                <PhoneGlyph />
                <span className={s.storeText}>
                  <small>iPhone · TestFlight first</small>
                  App Store
                </span>
                <span className={s.soon}>Coming soon</span>
              </span>
              <span className={s.store}>
                <PlayGlyph />
                <span className={s.storeText}>
                  <small>Android</small>
                  Google Play
                </span>
                <span className={s.soon}>Coming soon</span>
              </span>
            </div>
          </div>
        </div>
        {phone && <div className={s.heroPhone}>{phone}</div>}
      </div>
    </section>
  );
}

/* ── On-chain record ────────────────────────────────────────────────── */

export function FirstPaymentRecord() {
  const facts = [
    { k: `L2 block ${FIRST_PAYMENT.block.toLocaleString("en-US")}`, v: "First private payment from Ledger Chat", sub: `Transfer ${short(FIRST_PAYMENT.tx)}, 0.10 HLC`, mono: FIRST_PAYMENT.tx },
    { k: `L2 block ${FIRST_PAYMENT.tokenBlock.toLocaleString("en-US")}`, v: "HLC token deployed", sub: `Contract ${short(FIRST_PAYMENT.token)}, 6 decimals`, mono: FIRST_PAYMENT.token },
    { k: `Run ${FIRST_PAYMENT.preflightRun}`, v: "Checked by our public CI", sub: "Aztec mainnet preflight: all transactions checkpointed", href: FIRST_PAYMENT.preflightUrl },
  ];
  return (
    <section id="record" className={s.record} aria-labelledby="record-title">
      <p className={s.eyebrow}>{FIRST_PAYMENT.date}</p>
      <h2 id="record-title" className={s.h2}>
        Not a promise. <span className={s.dim}>A record on chain.</span>
      </h2>
      <div className={s.recordGrid}>
        {facts.map((f) => (
          <div key={f.k} className={s.recordCard}>
            <p className={s.recordKey}>{f.k}</p>
            <p className={s.recordVal}>{f.v}</p>
            {f.href ? (
              <a className={s.recordSub} href={f.href} target="_blank" rel="noopener noreferrer">
                {f.sub} ↗
              </a>
            ) : (
              <p className={s.recordSub} title={f.mono}>
                {f.sub}
              </p>
            )}
          </div>
        ))}
      </div>
      <p className={s.footnote}>
        Sent between two accounts of the operator, with fees paid in Fee Juice. The contracts are not audited yet, and payments on Alpha
        have a cap per payment.
      </p>
    </section>
  );
}

/* ── The stack, interactive ─────────────────────────────────────────── */

const LAYERS = [
  {
    id: "client",
    name: "Ledger Chat",
    role: "On your device",
    text: "The app you hold. Keys, the private wallet and every proof stay in your browser. The server never sees a private input.",
    detail: ["Wallet sign-in (SIWE)", "Aztec PXE in the browser", "Proofs on your device"],
  },
  {
    id: "xmtp",
    name: "XMTP · MLS",
    role: "Messages",
    text: "Direct messages are encrypted end to end with MLS (RFC 9420), provided by the XMTP network. We do not implement MLS ourselves.",
    detail: ["Encrypted on your device", "Forward secrecy from MLS", "Your Aztec address bound to your chat identity, signed"],
  },
  {
    id: "aztec",
    name: "Aztec Alpha",
    role: "Private payments",
    text: "A zero-knowledge rollup: balances and transfers are private notes, proved on your device, checked by the network.",
    detail: ["Private notes and nullifiers", "Fees in Fee Juice", "HLC deployed in L2 block 28,992"],
  },
  {
    id: "eth",
    name: "Ethereum",
    role: "Settlement",
    text: "Aztec settles its blocks on Ethereum mainnet, so the record of every private payment ends on L1.",
    detail: ["L1 chain 1", "Rollup proofs verified on Ethereum", "Nothing private is published"],
  },
] as const;

export function StackExplorer() {
  const [active, setActive] = useState<(typeof LAYERS)[number]["id"]>("client");
  const layer = LAYERS.find((l) => l.id === active) ?? LAYERS[0];
  return (
    <section id="stack" className={s.stack} aria-labelledby="stack-title">
      <div className={s.sectionHead}>
        <p className={s.eyebrow}>How it works</p>
        <h2 id="stack-title" className={s.h2}>
          Four layers. <span className={s.dim}>Each does one job.</span>
        </h2>
      </div>
      <div className={s.stackBody}>
        <div className={s.layers} role="tablist" aria-label="Layers" aria-orientation="vertical">
          {LAYERS.map((l, i) => (
            <button
              key={l.id}
              type="button"
              role="tab"
              aria-selected={l.id === active}
              aria-controls="stack-panel"
              className={`${s.layer} ${l.id === active ? s.layerOn : ""}`}
              style={{ ["--i" as string]: i } as React.CSSProperties}
              onMouseEnter={() => setActive(l.id)}
              onFocus={() => setActive(l.id)}
              onClick={() => setActive(l.id)}
            >
              <span className={s.layerIdx}>{String(i + 1).padStart(2, "0")}</span>
              <span className={s.layerName}>{l.name}</span>
              <span className={s.layerRole}>{l.role}</span>
            </button>
          ))}
        </div>
        <div id="stack-panel" role="tabpanel" className={s.stackPanel} key={layer.id}>
          <p className={s.panelRole}>{layer.role}</p>
          <h3 className={s.panelTitle}>{layer.name}</h3>
          <p className={s.panelText}>{layer.text}</p>
          <ul className={s.panelList}>
            {layer.detail.map((d) => (
              <li key={d}>{d}</li>
            ))}
          </ul>
        </div>
      </div>
    </section>
  );
}

/* ── Appearance playground ──────────────────────────────────────────── */

const THEME_PICKS = ["default", "midnight", "ocean", "rose", "forest", "synthwave", "amber", "nightshade", "lagoon", "violet", "ember", "snow"];
const WALL_PICKS = ["default", "iridescent", "scene-city", "doodle", "nebula", "scene-dawn-peaks", "topography", "candy", "scene-aurora", "confetti", "stars", "scene-blossom"];
const BUBBLE_PICKS = ["tail", "gradient", "aurora", "glass", "glow", "tinted", "soft", "brutalist"];
const DEMO_STICKERS = [
  ["lumi", "splash"],
  ["nubi-sol", "kiss"],
  ["spike", "mic-drop"],
  ["nubi-sol", "together"],
  ["spike", "rich"],
  ["nubi-sol", "love-you"],
] as const;

export function AppearancePlayground() {
  const [themeId, setThemeId] = useState("ocean");
  const [wallId, setWallId] = useState("iridescent");
  const [bubble, setBubble] = useState("aurora");
  const [sent, setSent] = useState<string | null>(null);
  const hostRef = useRef<HTMLDivElement>(null);
  const frameRef = useRef<HTMLDivElement>(null);
  const playing = useRef<{ cancel(): void } | null>(null);
  const theme = CHAT_THEMES.find((t) => t.id === themeId) ?? CHAT_THEMES[0];
  const wall = resolveWallpaper(wallId);
  const tone = wall && wall.id !== "default" ? wall.tone : theme.dark ? "dark" : "light";
  const themes = useMemo(() => THEME_PICKS.map((id) => CHAT_THEMES.find((t) => t.id === id)!).filter(Boolean), []);
  const walls = useMemo(() => WALL_PICKS.map((id) => WALLPAPERS.find((w) => w.id === id)!).filter(Boolean), []);

  const send = useCallback(async (pack: string, id: string) => {
    const content = stickerMessage(pack, id);
    const ref = stickerRef(content);
    if (!ref || !hostRef.current) return;
    setSent(ref.src);
    playing.current?.cancel();
    const { playStickerScene } = await import("@/lib/chat/sticker-scenes");
    const reducedMotion = typeof window.matchMedia === "function" && window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    playing.current = playStickerScene({
      host: hostRef.current,
      shakeTarget: frameRef.current,
      src: ref.src,
      scene: ref.sticker.scene,
      tint: ref.sticker.tint,
      from: null,
      reducedMotion,
    });
  }, []);

  return (
    <section id="make-it-yours" className={s.play} aria-labelledby="play-title">
      <div className={s.sectionHead}>
        <p className={s.eyebrow}>Make it yours</p>
        <h2 id="play-title" className={s.h2}>
          Try it here. <span className={s.dim}>Then send a sticker.</span>
        </h2>
        <p className={s.counts}>
          <span><strong>{CHAT_THEMES.length}</strong> themes</span>
          <span><strong>{WALLPAPERS.length - 1}</strong> wallpapers</span>
          <span><strong>{BUBBLE_STYLES.length}</strong> bubble styles</span>
          <span><strong>{STICKER_COUNT}</strong> stickers that take over the chat</span>
        </p>
      </div>

      <div className={s.playBody}>
        <div className={s.controls}>
          <fieldset className={s.group}>
            <legend>Theme</legend>
            <div className={s.swatches}>
              {themes.map((t) => (
                <button key={t.id} type="button" aria-pressed={t.id === themeId} aria-label={t.label} title={t.label} className={`${s.swatch} ${t.id === themeId ? s.on : ""}`} onClick={() => setThemeId(t.id)} style={{ background: `linear-gradient(135deg, ${t.canvas} 0 48%, ${t.accent} 52% 100%)` }} />
              ))}
            </div>
          </fieldset>
          <fieldset className={s.group}>
            <legend>Wallpaper</legend>
            <div className={s.swatches}>
              {walls.map((w) => (
                <button key={w.id} type="button" aria-pressed={w.id === wallId} aria-label={w.id === "default" ? "Theme colour" : w.label} title={w.id === "default" ? "Theme colour" : w.label} className={`${s.swatch} ${s.swatchTall} ${w.id === wallId ? s.on : ""}`} onClick={() => setWallId(w.id)} style={canvasCss(w, theme.canvas)} />
              ))}
            </div>
          </fieldset>
          <fieldset className={s.group}>
            <legend>Bubbles</legend>
            <div className={s.chips}>
              {BUBBLE_PICKS.map((id) => {
                const b = BUBBLE_STYLES.find((x) => x.id === id)!;
                return (
                  <button key={id} type="button" aria-pressed={id === bubble} className={`${s.chip} ${id === bubble ? s.chipOn : ""}`} onClick={() => setBubble(id)}>
                    {b.label}
                  </button>
                );
              })}
            </div>
          </fieldset>
          <fieldset className={s.group}>
            <legend>Send a sticker</legend>
            <div className={s.stickerRow}>
              {DEMO_STICKERS.map(([pack, id]) => (
                <button key={`${pack}/${id}`} type="button" className={s.stickerBtn} aria-label={`Send ${stickerRef(stickerMessage(pack, id))?.sticker.label ?? id}`} onClick={() => send(pack, id)}>
                  <img src={stickerFile(pack, id)} alt="" draggable={false} />
                </button>
              ))}
            </div>
          </fieldset>
        </div>

        <div className={s.device}>
          <DeviceFrame island="idle" fit={0.97} label="Ledger Chat with the theme, wallpaper and bubbles picked on the left">
            <div ref={frameRef} className={s.deviceScreen} data-chat-theme={theme.id} data-wallpaper-tone={tone} style={{ ...(chatThemeVars(theme) as unknown as React.CSSProperties), ...canvasCss(wall, theme.canvas) }}>
              <div className={s.deviceBar}>
                <span className={s.statusRow} aria-hidden="true">
                  <span>9:41</span>
                  <span className={s.statusIcons}>
                    <svg width="19" height="12" viewBox="0 0 19 12"><rect x="0" y="8" width="3.2" height="4" rx="1" fill="currentColor" /><rect x="5.2" y="5.5" width="3.2" height="6.5" rx="1" fill="currentColor" /><rect x="10.4" y="3" width="3.2" height="9" rx="1" fill="currentColor" /><rect x="15.6" y="0" width="3.2" height="12" rx="1" fill="currentColor" /></svg>
                    <svg width="27" height="13" viewBox="0 0 27 13"><rect x="0.5" y="0.5" width="23" height="12" rx="3.5" fill="none" stroke="currentColor" opacity="0.4" /><rect x="2" y="2" width="20" height="9" rx="2.2" fill="currentColor" /></svg>
                  </span>
                </span>
                <span className={s.peer}>
                  <span className={s.avatar}>IV</span>
                  <span>
                    <b>Irina</b>
                    <i className={s.verified}>Verified Aztec address</i>
                  </span>
                </span>
              </div>
              <div className={s.thread}>
                <div className={`${bubbleClasses(bubble, false)} ${s.msg}`}>Did the payment land?</div>
                <div className={`${bubbleClasses(bubble, true)} ${s.msg} ${s.me}`}>Yes, 0.10 HLC, private.</div>
                <div className={`${bubbleClasses(bubble, false)} ${s.msg}`}>Then this calls for a sticker.</div>
                {sent && <img key={sent} src={sent} alt="" className={s.sentSticker} />}
              </div>
              <div className={s.composer} aria-hidden="true"><span>Message</span></div>
              <div ref={hostRef} className={s.sceneHost} aria-hidden="true" />
            </div>
          </DeviceFrame>
        </div>
      </div>
    </section>
  );
}

/* ── Close ──────────────────────────────────────────────────────────── */

export function LaunchClose({ alpha }: { alpha: boolean }) {
  return (
    <section id="start" className={s.close} aria-labelledby="closing-title">
      <h2 id="closing-title" className={s.closeTitle}>
        Start a private conversation.
      </h2>
      <p className={s.heroLead}>Free. Runs in your browser, nothing to install.</p>
      <div className={s.ctas}>
        <Link href="/chat" className={`${s.btn} ${s.btnLight}`}>
          Open Ledger Chat
        </Link>
        <Link href="/docs/overview" className={`${s.btn} ${s.btnGhost}`}>
          Read the documentation
        </Link>
      </div>
      <p className={s.footnote}>
        {alpha
          ? "Private payments use real funds on Aztec Alpha, with a cap per payment. The contracts are not audited yet."
          : "Private payments run on the Aztec test network, with tokens that have no value."}{" "}
        The iPhone and Android apps are in development; the web app works on both today.
      </p>
    </section>
  );
}
