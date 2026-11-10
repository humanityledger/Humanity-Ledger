"use client";

/**
 * "Ledger Chat in your hand": four live Ledger Chat screens on a vector
 * iPhone (DeviceFrame.tsx): a conversation with a private invoice, a voice
 * call, a video call and a community.
 *
 * The device is drawn, not photographed, and scaled as a whole to fit its
 * tile, so it is never cropped or re-proportioned. (The earlier version
 * placed screens on photographs with per-photo 3D matrices, then on a fixed
 * 390 x 844 CSS frame that clipped the 430 x 932 screens and drew a second
 * Dynamic Island under the screens' own.)
 *
 * Wide screens: the stage stays pinned while the visitor scrolls, the
 * phones travel along a diagonal and the step on the left follows.
 * Narrow screens and reduced motion: the phones stack with their text.
 *
 * Copy rule: every sentence here must be true of the product today.
 */

import React, { useCallback, useEffect, useRef, useState } from "react";
import {
  InvoiceChatScreen,
  VideoCallScreen,
  VoiceCallScreen,
  CommunitiesScreen,
  ChatScreen,
  type ScreenProps,
} from "./phoneScreens";
import { DeviceFrame, type IslandState } from "./DeviceFrame";
import s from "./PhoneShowcase.module.css";

interface Phone {
  id: string;
  label: string;
  title: string;
  text: string;
  Screen: React.ComponentType<ScreenProps>;
  /** What the Dynamic Island shows while this screen plays. */
  island: IslandState;
  /** For the call island: seconds at p = 0 and p = 1. */
  clock?: [number, number];
}

const PHONES: Phone[] = [
  {
    id: "chat",
    label: "Messages",
    title: "Talk, then settle up in the same chat.",
    text: "Direct messages are end-to-end encrypted with MLS over XMTP and kept on your device. A private invoice is paid from your Aztec wallet without leaving the conversation; today that runs on the Aztec test network.",
    Screen: InvoiceChatScreen,
    island: "secure",
  },
  {
    id: "voice",
    label: "Voice calls",
    title: "Call straight from the chat.",
    text: "Voice calls connect browser to browser over WebRTC and are encrypted in transit with DTLS-SRTP, with optional noise suppression. No phone number is involved at any point.",
    Screen: VoiceCallScreen,
    island: "call",
    clock: [3, 99],
  },
  {
    id: "video",
    label: "Video calls",
    title: "Face to face, without your IP address.",
    text: "Video calls use the same encrypted connection. Turn on Hide my IP address in settings and calls are routed through a relay, so the other person never sees your IP address.",
    Screen: VideoCallScreen,
    island: "video",
  },
  {
    id: "communities",
    label: "Communities",
    title: "Channels, pinned posts and votes.",
    text: "Communities have topic channels, pinned announcements and proposals with one vote per wallet. Community posts are kept on Humanity Ledger's servers so new members can read the history; direct messages are the end-to-end encrypted part.",
    Screen: CommunitiesScreen,
    island: "idle",
  },
];

/** Screens available to LivePhone by id, including ones not in the scroll story. */
const SCREENS: Record<string, React.ComponentType<ScreenProps>> = {
  chat: InvoiceChatScreen,
  invoice: InvoiceChatScreen,
  messages: ChatScreen,
  voice: VoiceCallScreen,
  video: VideoCallScreen,
  communities: CommunitiesScreen,
};

const N = PHONES.length;
/** Share of each step spent playing its screen before moving to the next. */
const DWELL = 0.66;

const clamp = (v: number, a = 0, b = 1) => Math.min(b, Math.max(a, v));
const smooth = (x: number) => x * x * (3 - 2 * x);

/** The diagonal: upcoming photos wait below and to the right, past ones leave up and to the left. */
function tileStyle(d: number) {
  const a = Math.abs(d);
  let tx: number, ty: number, sc: number, op: number;
  if (d >= 0) {
    tx = d * 46;
    ty = d * 30;
    sc = 1 - 0.13 * d;
    // Opaque while it arrives, so it covers the one leaving instead of blending with it.
    op = clamp(1 - 0.55 * (d - 1));
  } else {
    tx = d * 34;
    ty = d * 44;
    sc = 1 - 0.06 * a;
    op = clamp(1 - 1.25 * a);
  }
  const rx = d * 5;
  const ry = d * -9;
  const rz = d * -1.2;
  return {
    transform: `perspective(1800px) translate3d(${tx}%, ${ty}%, 0) rotateX(${rx}deg) rotateY(${ry}deg) rotateZ(${rz}deg) scale(${sc})`,
    opacity: op,
    zIndex: 100 - Math.round(a * 10) - (d < 0 ? 20 : 0),
    visibility: op < 0.01 ? "hidden" : "visible",
  } as const;
}

function scrollParent(el: HTMLElement | null): HTMLElement | null {
  let n = el?.parentElement ?? null;
  while (n) {
    const oy = getComputedStyle(n).overflowY;
    if ((oy === "auto" || oy === "scroll") && n.scrollHeight > n.clientHeight) return n;
    n = n.parentElement;
  }
  return (document.scrollingElement as HTMLElement) ?? null;
}

function PhoneTile({
  ph,
  i,
  progress,
  active,
  screen,
  fit,
}: {
  ph: Phone;
  i: number;
  progress: number;
  active: boolean;
  screen?: React.ComponentType<ScreenProps>;
  fit?: number;
}) {
  const Screen = screen ?? ph.Screen;
  const seconds = ph.clock ? Math.round(ph.clock[0] + (ph.clock[1] - ph.clock[0]) * progress) : 0;
  // A call island only once the call has connected (VoiceCallScreen connects at p = 0.12).
  const island: IslandState = ph.island === "call" && progress < 0.12 ? "idle" : ph.island;
  return (
    <div className={s.photo} data-photo={i}>
      <DeviceFrame island={active || progress >= 1 ? island : "idle"} callSeconds={seconds} fit={fit}>
        <Screen p={progress} active={active} />
      </DeviceFrame>
    </div>
  );
}

export function PhoneShowcase() {
  const [mode, setMode] = useState<"scroll" | "stack">("stack");
  const [reduced, setReduced] = useState(false);
  const [progress, setProgress] = useState<number[]>(() => PHONES.map(() => 0));
  const [active, setActive] = useState(0);

  const trackRef = useRef<HTMLDivElement>(null);
  const stageRef = useRef<HTMLDivElement>(null);
  const deckRef = useRef<HTMLDivElement>(null);
  const tileRefs = useRef<(HTMLElement | null)[]>([]);
  const stepRefs = useRef<(HTMLLIElement | null)[]>([]);
  const last = useRef({ prog: "", active: -1 });

  // Choose the layout.
  useEffect(() => {
    const wide = window.matchMedia("(min-width: 980px) and (min-height: 620px)");
    const motion = window.matchMedia("(prefers-reduced-motion: reduce)");
    const apply = () => {
      setReduced(motion.matches);
      setMode(wide.matches && !motion.matches ? "scroll" : "stack");
    };
    apply();
    wide.addEventListener?.("change", apply);
    motion.addEventListener?.("change", apply);
    return () => {
      wide.removeEventListener?.("change", apply);
      motion.removeEventListener?.("change", apply);
    };
  }, []);

  // Size the tiles. The device inside scales itself (DeviceFrame).
  const layout = useCallback(() => {
    const deck = deckRef.current;
    if (!deck || mode !== "scroll") return;
    const dw = deck.clientWidth;
    const dh = deck.clientHeight;
    const aspect = 1.25;
    const tw = Math.min(dw, dh * 0.84 * aspect);
    deck.style.setProperty("--tw", `${tw}px`);
    deck.style.setProperty("--th", `${tw / aspect}px`);
  }, [mode]);

  useEffect(() => {
    layout();
    const deck = deckRef.current;
    if (!deck || typeof ResizeObserver === "undefined") return;
    const ro = new ResizeObserver(() => layout());
    ro.observe(deck);
    return () => ro.disconnect();
  }, [layout]);

  // Follow the scroll.
  useEffect(() => {
    if (reduced) {
      setProgress(PHONES.map(() => 1));
      return;
    }
    let raf = 0;

    const commit = (prog: number[], act: number) => {
      const key = prog.map((v) => v.toFixed(2)).join(",");
      if (key !== last.current.prog) {
        last.current.prog = key;
        setProgress(prog.map((v) => Math.round(v * 100) / 100));
      }
      if (act !== last.current.active) {
        last.current.active = act;
        setActive(act);
      }
    };

    const frame = () => {
      raf = 0;
      const track = trackRef.current;
      const stage = stageRef.current;
      if (!track || !stage) return;
      const vh = window.innerHeight;

      if (mode === "scroll") {
        const rect = track.getBoundingClientRect();
        const top = parseFloat(getComputedStyle(stage).top) || 84;
        const dist = Math.max(1, rect.height - stage.offsetHeight);
        const p = clamp((top - rect.top) / dist);
        const seg = Math.min(p * N, N - 1e-6);
        const i0 = Math.floor(seg);
        const local = seg - i0;
        const isLast = i0 === N - 1;
        const t = i0 + (isLast ? 0 : smooth(clamp((local - DWELL) / (1 - DWELL))));
        const prog = PHONES.map((_, i) => (i < i0 ? 1 : i > i0 ? 0 : clamp(local / (isLast ? 0.8 : DWELL))));

        tileRefs.current.forEach((el, i) => {
          if (!el) return;
          const st = tileStyle(i - t);
          el.style.transform = st.transform;
          el.style.opacity = String(st.opacity);
          el.style.zIndex = String(st.zIndex);
          el.style.visibility = st.visibility;
        });
        stepRefs.current.forEach((el, i) => el?.style.setProperty("--fill", String(prog[i])));
        commit(prog, Math.round(t));
      } else {
        const prog = PHONES.map((_, i) => {
          const el = tileRefs.current[i]?.querySelector<HTMLElement>("[data-photo]");
          if (!el) return 0;
          const r = el.getBoundingClientRect();
          return clamp((vh * 0.82 - r.top) / (r.height * 0.95));
        });
        const act = prog.reduce((best, v, i) => (v > 0 && v < 1 ? i : best), 0);
        commit(prog, act);
      }
    };

    const onScroll = () => {
      if (!raf) raf = requestAnimationFrame(frame);
    };
    // Capture catches the scroll of the app shell as well as the window.
    window.addEventListener("scroll", onScroll, { passive: true, capture: true });
    window.addEventListener("resize", onScroll, { passive: true });
    frame();
    return () => {
      window.removeEventListener("scroll", onScroll, { capture: true });
      window.removeEventListener("resize", onScroll);
      if (raf) cancelAnimationFrame(raf);
      tileRefs.current.forEach((el) => {
        if (!el) return;
        el.style.transform = "";
        el.style.opacity = "";
        el.style.zIndex = "";
        el.style.visibility = "";
      });
    };
  }, [mode, reduced]);

  // Jump to a step from the list on the left.
  const go = (i: number) => {
    const track = trackRef.current;
    const stage = stageRef.current;
    if (!track || !stage) return;
    const scroller = scrollParent(track);
    if (!scroller) return;
    const rect = track.getBoundingClientRect();
    const top = parseFloat(getComputedStyle(stage).top) || 84;
    const dist = rect.height - stage.offsetHeight;
    const target = ((i + 0.62 * (i === N - 1 ? 1.2 : 1)) / N) * dist;
    scroller.scrollTo({ top: scroller.scrollTop + rect.top - top + target, behavior: "smooth" });
  };

  return (
    <div ref={trackRef} className={s.track} data-mode={mode} style={{ ["--n" as string]: N } as React.CSSProperties}>
      <div ref={stageRef} className={s.stage}>
        <div className={s.captions}>
          <span className={s.counter} aria-hidden="true">
            <b>{String(active + 1).padStart(2, "0")}</b> / {String(N).padStart(2, "0")}
          </span>
          <ol className={s.steps}>
            {PHONES.map((ph, i) => (
              <li
                key={ph.id}
                ref={(el) => {
                  stepRefs.current[i] = el;
                }}
                className={`${s.step} ${i === active ? s.stepOn : ""}`}
              >
                <button type="button" className={s.stepBtn} onClick={() => go(i)} aria-current={i === active ? "step" : undefined}>
                  <span className={s.stepHead}>
                    <span className={s.stepNum}>{String(i + 1).padStart(2, "0")}</span>
                    <span className={s.stepTitle}>{ph.title}</span>
                  </span>
                  <span className={s.stepBody}>
                    <span>
                      <span className={s.stepText}>{ph.text}</span>
                    </span>
                  </span>
                </button>
              </li>
            ))}
          </ol>
        </div>

        <div ref={deckRef} className={s.deck}>
          {PHONES.map((ph, i) => (
            <figure
              key={ph.id}
              ref={(el) => {
                tileRefs.current[i] = el;
              }}
              className={s.tile}
              aria-label={`${ph.label}: ${ph.title}`}
            >
              <PhoneTile ph={ph} i={i} progress={progress[i]} active={reduced ? false : i === active} fit={mode === "scroll" ? 0.9 : 0.88} />
              <figcaption className={s.figcap}>
                <span className={s.figNum}>
                  {String(i + 1).padStart(2, "0")}
                  <span className={s.figLabel}>{ph.label}</span>
                </span>
                <span className={s.figTitle}>{ph.title}</span>
                <span className={s.figText}>{ph.text}</span>
              </figcaption>
            </figure>
          ))}
        </div>
      </div>
    </div>
  );
}

/**
 * One phone on its own, playing its screen on a loop. Used where there is no
 * scroll to drive it, such as the sign-in page.
 */
export function LivePhone({
  id = "chat",
  screen,
  zoom,
  fill,
  className,
}: {
  /** Which step's island and timing to use. */
  id?: string;
  /** Which screen to play (defaults to the step's own): chat, invoice, messages, voice, video, communities. */
  screen?: string;
  /** Kept for compatibility; the device always fits its box now. Values above 1 are ignored. */
  zoom?: number;
  /** Share of the box's limiting side the phone takes (e.g. 0.85). */
  fill?: number;
  className?: string;
}) {
  const i = Math.max(0, PHONES.findIndex((ph) => ph.id === id));
  const ScreenOverride = screen ? SCREENS[screen] : undefined;
  const ref = useRef<HTMLDivElement>(null);
  const [p, setP] = useState(0);
  const [visible, setVisible] = useState(true);

  useEffect(() => {
    const el = ref.current;
    if (!el || typeof IntersectionObserver === "undefined") return;
    const io = new IntersectionObserver(([e]) => setVisible(e.isIntersecting));
    io.observe(el);
    return () => io.disconnect();
  }, []);

  useEffect(() => {
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
      setP(1);
      return;
    }
    if (!visible) return;
    const PLAY = 6500;
    const HOLD = 3000;
    let start = performance.now();
    const timer = window.setInterval(() => {
      if (document.hidden) return;
      const t = performance.now() - start;
      if (t > PLAY + HOLD) {
        start = performance.now();
        setP(0);
        return;
      }
      setP(Math.round(clamp(t / PLAY) * 50) / 50);
    }, 120);
    return () => window.clearInterval(timer);
  }, [visible]);

  const fit = fill ?? (zoom && zoom <= 1 ? zoom : 0.9);
  return (
    <div ref={ref} className={`${s.live} ${className ?? ""}`}>
      <PhoneTile ph={PHONES[i]} i={i} progress={p} active={visible} screen={ScreenOverride} fit={fit} />
    </div>
  );
}

export { s as phoneShowcaseStyles };
