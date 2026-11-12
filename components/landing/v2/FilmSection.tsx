"use client";

/**
 * FilmSection: "Ledger Chat in 30 seconds", rendered live instead of played
 * from a video. The device is the vector iPhone (DeviceFrame) and the screens
 * are the same markup the rest of the landing uses, so every word is sharp at
 * any size and nothing shown is a feature the product does not have.
 *
 * Six chapters of five seconds. Plays only while visible, pauses on demand,
 * and holds each final frame (no autoplay) under prefers-reduced-motion.
 */

import React, { useEffect, useRef, useState } from "react";
import { DeviceFrame, type IslandState } from "./DeviceFrame";
import {
  AgreementChatScreen,
  ChatScreen,
  CommunitiesScreen,
  InvoiceChatScreen,
  VideoCallScreen,
  VoiceCallScreen,
  type ScreenProps,
} from "./phoneScreens";
import { AZTEC_WALLET_CONFIG } from "@/lib/aztec/wallet/config";
import landing from "./Landing.module.css";
import s from "./FilmSection.module.css";

interface Chapter {
  id: string;
  title: string;
  text: string;
  Screen: React.ComponentType<ScreenProps>;
  island: IslandState;
}

const CHAPTERS: Chapter[] = [
  {
    id: "messages",
    title: "Private messages, no phone number",
    text: "Direct messages are end-to-end encrypted with MLS over XMTP. You sign in with your wallet and nothing else.",
    Screen: ChatScreen,
    island: "secure",
  },
  {
    id: "pay",
    title: "Pay privately inside the chat",
    text: "The proof is made on your device, and money only goes to an Aztec address the other person signed for.",
    Screen: InvoiceChatScreen,
    island: "secure",
  },
  {
    id: "agreement",
    title: "Escrow and streams between two people",
    text: "Lock funds until the work is delivered, or pay over time. Every step is an Aztec transaction both of you can check.",
    Screen: AgreementChatScreen,
    island: "secure",
  },
  {
    id: "voice",
    title: "Call straight from the chat",
    text: "Browser to browser over WebRTC, encrypted in transit with DTLS-SRTP.",
    Screen: VoiceCallScreen,
    island: "call",
  },
  {
    id: "video",
    title: "Face to face, without your IP address",
    text: "Turn on Hide my IP address and calls go through a relay, so the other person never sees it.",
    Screen: VideoCallScreen,
    island: "video",
  },
  {
    id: "communities",
    title: "Communities with channels and votes",
    text: "Posts are stored on our servers so new members can read the history. Paying a member opens a private chat with them.",
    Screen: CommunitiesScreen,
    island: "idle",
  },
];

const ALPHA = AZTEC_WALLET_CONFIG.network === "mainnet" && AZTEC_WALLET_CONFIG.alphaEnabled;
const NETWORK_NOTE = ALPHA
  ? "Payments and agreements run on Aztec Alpha with a cap per payment. The contracts have not been audited yet."
  : "Payments and agreements run on the Aztec test network with test tokens. The contracts have not been audited yet.";

const CHAPTER_MS = 5000;
const TOTAL_S = (CHAPTERS.length * CHAPTER_MS) / 1000;

export function FilmSection() {
  const rootRef = useRef<HTMLElement>(null);
  const [idx, setIdx] = useState(0);
  const [p, setP] = useState(0);
  const [playing, setPlaying] = useState(true);
  const [visible, setVisible] = useState(false);
  const [reduced, setReduced] = useState(false);
  const startRef = useRef(0);

  useEffect(() => {
    const mq = window.matchMedia("(prefers-reduced-motion: reduce)");
    const apply = () => setReduced(mq.matches);
    apply();
    mq.addEventListener("change", apply);
    return () => mq.removeEventListener("change", apply);
  }, []);

  useEffect(() => {
    const el = rootRef.current;
    if (!el || typeof IntersectionObserver === "undefined") return;
    const io = new IntersectionObserver(([e]) => setVisible(e.isIntersecting), { threshold: 0.25 });
    io.observe(el);
    return () => io.disconnect();
  }, []);

  // One clock for the whole film; resumes where it stopped.
  useEffect(() => {
    if (reduced) {
      setP(1);
      return;
    }
    if (!playing || !visible) return;
    startRef.current = performance.now() - p * CHAPTER_MS;
    const timer = window.setInterval(() => {
      if (document.hidden) return;
      const t = (performance.now() - startRef.current) / CHAPTER_MS;
      if (t >= 1) {
        startRef.current = performance.now();
        setP(0);
        setIdx((i) => (i + 1) % CHAPTERS.length);
        return;
      }
      setP(Math.round(t * 60) / 60);
    }, 100);
    return () => window.clearInterval(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [playing, visible, reduced, idx]);

  const go = (i: number) => {
    setIdx(i);
    setP(reduced ? 1 : 0);
    startRef.current = performance.now();
  };

  const ch = CHAPTERS[idx];
  const elapsed = Math.floor((idx * CHAPTER_MS + p * CHAPTER_MS) / 1000);
  const callSeconds = ch.island === "call" ? 4 + Math.floor(p * 40) : 0;

  return (
    <section ref={rootRef} id="film" data-glow className={`${landing.card} ${landing.reveal} ${s.film}`} aria-labelledby="film-title">
      <div className={s.head}>
        <h2 id="film-title" className={landing.h2}>
          Ledger Chat. <em>In 30 seconds.</em>
        </h2>
        <p className={s.lead}>Everything below is the real interface, drawn live. Nothing is a feature we do not ship.</p>
      </div>

      <div className={s.stage}>
        <div>
          <div className={s.chapters} role="tablist" aria-label="Chapters">
            {CHAPTERS.map((c, i) => {
              const on = i === idx;
              return (
                  <button
                    key={c.id}
                    type="button"
                    role="tab"
                    aria-selected={on}
                    aria-controls="film-phone"
                    className={`${s.chapter} ${on ? s.active : ""}`}
                    onClick={() => go(i)}
                  >
                    <span className={s.row}>
                      <span className={s.num}>{String(i + 1).padStart(2, "0")}</span>
                      <span className={s.title}>{c.title}</span>
                      {on && <span className={s.text}>{c.text}</span>}
                      {on && (
                        <span className={s.bar} aria-hidden="true">
                          <span style={{ transform: `scaleX(${reduced ? 1 : p})` }} />
                        </span>
                      )}
                    </span>
                  </button>
              );
            })}
          </div>
          <div className={s.controls}>
            {!reduced && (
              <button type="button" className={s.play} onClick={() => setPlaying((v) => !v)} aria-pressed={!playing}>
                {playing ? "Pause" : "Play"}
              </button>
            )}
            <span className={s.clock} aria-hidden="true">
              0:{String(Math.min(elapsed, TOTAL_S)).padStart(2, "0")} / 0:{TOTAL_S}
            </span>
          </div>
        </div>

        <div id="film-phone" className={s.phoneWrap} role="tabpanel">
          <DeviceFrame island={ch.island} callSeconds={callSeconds} fit={0.96} label={`${ch.title}. ${ch.text}`}>
            <div key={ch.id} className={s.screenFade}>
              <ch.Screen p={reduced ? 1 : p} active={visible && playing} />
            </div>
          </DeviceFrame>
        </div>
      </div>

      <p className={s.note}>{NETWORK_NOTE}</p>
    </section>
  );
}
