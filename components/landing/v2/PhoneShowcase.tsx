"use client";

/**
 * "Ledger Chat in your hand": four photographs of an iPhone, each showing a
 * live Ledger Chat screen (a conversation, a voice call, a video call and a
 * private payment).
 *
 * How the screen sits on the photograph: every photo has a 3D matrix that
 * maps the 430 x 932 glass of the phone onto its pixels. The screen is plain
 * HTML laid out on that glass, transformed with the matrix, and the fingers
 * that cross the glass are drawn again on top from a cut-out.
 *
 * Wide screens: the stage stays pinned while the visitor scrolls, the
 * photographs travel along a diagonal and the step on the left follows.
 * Narrow screens and reduced motion: the photographs stack with their text.
 */

import React, { useCallback, useEffect, useRef, useState } from "react";
import { ChatScreen, PaymentScreen, VideoCallScreen, VoiceCallScreen, type ScreenProps } from "./phoneScreens";
import s from "./PhoneShowcase.module.css";

interface Phone {
  id: string;
  label: string;
  title: string;
  text: string;
  src: string;
  fingers: string;
  w: number;
  h: number;
  /** matrix3d, column-major, from the glass (430 x 932) to photo pixels. */
  m: number[];
  f: { x: number; y: number; w: number; h: number };
  Screen: React.ComponentType<ScreenProps>;
}

const PHONES: Phone[] = [
  {
    id: "chat",
    label: "Messages",
    title: "Talk like you always do.",
    text: "Direct messages are encrypted on your device before they are sent and travel over XMTP, an open messaging network. You sign in with your wallet, so there is no phone number or email to hand over.",
    src: "/landing/phones/p1.webp",
    fingers: "/landing/phones/p1-fingers.webp",
    w: 1600,
    h: 1067,
    m: [
      0.903914422, -0.199539273, 0, -4.6e-8, 0.306408086, 0.826558745, 0, -1.0101e-5, 0, 0, 1, 0, 464.399993896,
      181.600006104, 0, 1,
    ],
    f: { x: 479, y: 105, w: 656, h: 848 },
    Screen: ChatScreen,
  },
  {
    id: "voice",
    label: "Voice calls",
    title: "Call straight from the chat.",
    text: "Voice calls connect browser to browser over WebRTC and are encrypted in transit with DTLS-SRTP. No phone number is involved at any point.",
    src: "/landing/phones/p3.webp",
    fingers: "/landing/phones/p3-fingers.webp",
    w: 1600,
    h: 1066,
    m: [0.863255842, 0, 0, 0, 0, 0.847210299, 0, 0, 0, 0, 1, 0, 612.0, 86.400001526, 0, 1],
    f: { x: 610, y: 423, w: 0, h: 0 },
    Screen: VoiceCallScreen,
  },
  {
    id: "video",
    label: "Video calls",
    title: "Face to face, on your terms.",
    text: "Video calls use the same encrypted connection. Turn on Hide my IP address in settings and calls are routed through a relay, so the other person never sees your IP address.",
    src: "/landing/phones/p2.webp",
    fingers: "/landing/phones/p2-fingers.webp",
    w: 1600,
    h: 1066,
    m: [
      0.824615639, 0.012275579, 0, 1.3135e-5, 0.054036733, 0.778028224, 0, -2.125e-6, 0, 0, 1, 0, 532.960021973,
      79.919998169, 0, 1,
    ],
    f: { x: 552, y: 374, w: 0, h: 0 },
    Screen: VideoCallScreen,
  },
  {
    id: "pay",
    label: "Payments",
    title: "Settle up where you agreed it.",
    text: "Send ETH, USDC or USDT from your own wallet, or try private payments on the Aztec test network, where the amount and the recipient stay hidden. Test tokens only, with no real value.",
    src: "/landing/phones/p4.webp",
    fingers: "/landing/phones/p4-fingers.webp",
    w: 1600,
    h: 1066,
    m: [0.885581367, 0, 0, 0, 0, 0.871244647, 0, 0, 0, 0, 1, 0, 605.600036621, 59.200000763, 0, 1],
    f: { x: 602, y: 496, w: 263, h: 379 },
    Screen: PaymentScreen,
  },
];

const N = PHONES.length;
/** Share of each step spent playing its screen before moving to the next. */
const DWELL = 0.66;

const clamp = (v: number, a = 0, b = 1) => Math.min(b, Math.max(a, v));
const smooth = (x: number) => x * x * (3 - 2 * x);

/** Where the middle of the phone falls on the photograph. */
function phoneCentre(m: number[]) {
  const gx = 215;
  const gy = 466;
  const w = m[3] * gx + m[7] * gy + m[15];
  return { x: (m[0] * gx + m[4] * gy + m[12]) / w, y: (m[1] * gx + m[5] * gy + m[13]) / w };
}

const CENTRES = PHONES.map((ph) => phoneCentre(ph.m));

/** Position the photo inside its tile: cover the tile, zoomed towards the phone. */
function fitPhoto(el: HTMLElement, i: number, zoom: number) {
  const ph = PHONES[i];
  const W = el.clientWidth;
  const H = el.clientHeight;
  if (!W || !H) return;
  const sc = Math.max(W / ph.w, H / ph.h) * zoom;
  const fx = CENTRES[i].x * 0.7 + (ph.w / 2) * 0.3;
  const fy = CENTRES[i].y * 0.7 + (ph.h / 2) * 0.3;
  const ox = clamp(W / 2 - fx * sc, W - ph.w * sc, 0);
  const oy = clamp(H / 2 - fy * sc, H - ph.h * sc, 0);
  el.style.setProperty("--s", String(sc));
  el.style.setProperty("--ox", `${ox}px`);
  el.style.setProperty("--oy", `${oy}px`);
  // The photo stays hidden until it has been fitted once (see .photo[data-fit]).
  el.dataset.fit = "1";
}

/**
 * A deck: the next photo waits just behind the current one, peeking out
 * below and to the right, and comes forward as the visitor scrolls; the
 * current one lifts away up and to the left. Every tile stays inside the
 * stage, so no photo is ever cut by the edge of the card.
 */
function tileStyle(d: number) {
  const a = Math.abs(d);
  let tx: number, ty: number, sc: number, op: number, rz: number;
  if (d >= 0) {
    // d = 1: the one waiting behind; d = 2 and further: hidden behind it.
    const k = Math.min(d, 1);
    tx = k * 8;
    ty = k * 7;
    sc = 1 - 0.08 * k;
    rz = k * 1.6;
    // Opaque while it comes forward, so it covers the one leaving.
    op = d <= 1 ? 1 : clamp(1 - (d - 1) * 1.6);
  } else {
    tx = d * 22;
    ty = d * 26;
    sc = 1 - 0.05 * a;
    rz = d * 2.4;
    op = clamp(1 - 1.4 * a);
  }
  return {
    transform: `perspective(1800px) translate3d(${tx}%, ${ty}%, 0) rotateX(${d * 2.5}deg) rotateY(${d * -4}deg) rotateZ(${rz}deg) scale(${sc})`,
    opacity: op,
    zIndex: 100 - Math.round(a * 10) - (d < 0 ? 20 : 0),
    visibility: op < 0.01 ? "hidden" : "visible",
  } as const;
}

/** Screen pixels per CSS pixel for this element (below 1 while the page is zoomed out). */
function screenScale(el: HTMLElement, rect = el.getBoundingClientRect()) {
  return el.offsetHeight > 0 && rect.height > 0 ? rect.height / el.offsetHeight : 1;
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

function PhonePhoto({ ph, i, progress, active, screen }: { ph: Phone; i: number; progress: number; active: boolean; screen?: React.ComponentType<ScreenProps> }) {
  const Screen = screen ?? ph.Screen;
  return (
    <div className={s.photo} data-photo={i} aria-hidden="true">
      <div className={s.frame}>
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img className={s.base} src={ph.src} width={ph.w} height={ph.h} alt="" loading="lazy" decoding="async" draggable={false} />
        <div className={s.glass} style={{ transform: `matrix3d(${ph.m.join(",")})` }}>
          <div className={s.screen}>
            <Screen p={progress} active={active} />
          </div>
        </div>
        {/* eslint-disable-next-line @next/next/no-img-element */}
        {ph.f.w > 0 && (
          <img
            className={s.fingers}
            src={ph.fingers}
            alt=""
            loading="lazy"
            decoding="async"
            draggable={false}
            style={{ left: ph.f.x, top: ph.f.y, width: ph.f.w, height: ph.f.h }}
          />
        )}
      </div>
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

  // Size the tiles and fit each photo.
  const layout = useCallback(() => {
    const deck = deckRef.current;
    if (!deck) return;
    if (mode === "scroll") {
      const dw = deck.clientWidth;
      const dh = deck.clientHeight;
      const aspect = 1.25;
      // Room for the next photo peeking out from behind (8% right, 7% down).
      const tw = Math.min(dw * 0.88, dh * 0.86 * aspect);
      deck.style.setProperty("--tw", `${tw}px`);
      deck.style.setProperty("--th", `${tw / aspect}px`);
    }
    deck.querySelectorAll<HTMLElement>("[data-photo]").forEach((el) => {
      fitPhoto(el, Number(el.dataset.photo), mode === "scroll" ? 1.12 : 1.38);
    });
  }, [mode]);

  useEffect(() => {
    layout();
    const deck = deckRef.current;
    if (!deck) return;
    // Fit again whenever the deck or any photo changes size, once the photos
    // have loaded and when the page is shown again: a photo fitted while it
    // still had no size would otherwise keep the default scale and leave an
    // empty band at the bottom of its tile.
    const ro = typeof ResizeObserver !== "undefined" ? new ResizeObserver(() => layout()) : null;
    ro?.observe(deck);
    deck.querySelectorAll<HTMLElement>("[data-photo]").forEach((el) => ro?.observe(el));
    const imgs = [...deck.querySelectorAll<HTMLImageElement>("img")];
    imgs.forEach((img) => img.addEventListener("load", layout));
    window.addEventListener("load", layout);
    window.addEventListener("pageshow", layout);
    const late = [80, 400, 1200].map((ms) => window.setTimeout(layout, ms));
    return () => {
      ro?.disconnect();
      imgs.forEach((img) => img.removeEventListener("load", layout));
      window.removeEventListener("load", layout);
      window.removeEventListener("pageshow", layout);
      late.forEach(clearTimeout);
    };
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
        // Rects are in screen pixels; CSS lengths are not when the page is zoomed (67% on desktop).
        const z = screenScale(track, rect);
        const top = (parseFloat(getComputedStyle(stage).top) || 84) * z;
        const dist = Math.max(1, rect.height - stage.offsetHeight * z);
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
    const z = screenScale(track, rect);
    const top = (parseFloat(getComputedStyle(stage).top) || 84) * z;
    const dist = rect.height - stage.offsetHeight * z;
    const target = ((i + 0.62 * (i === N - 1 ? 1.2 : 1)) / N) * dist;
    // scrollTop is in CSS pixels, the distances above in screen pixels.
    scroller.scrollTo({ top: scroller.scrollTop + (rect.top - top + target) / z, behavior: "smooth" });
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
              <PhonePhoto ph={ph} i={i} progress={progress[i]} active={reduced ? false : i === active} />
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
 * One photograph on its own, playing its screen on a loop. Used where there
 * is no scroll to drive it, such as the sign-in page.
 */
export function LivePhone({
  id = "chat",
  screen,
  zoom,
  fill,
  className,
}: {
  /** Which photograph to use. */
  id?: string;
  /** Which screen to play on it (defaults to the photo's own). */
  screen?: string;
  /** Override how far the photo is zoomed towards the phone. */
  zoom?: number;
  /** Instead of a zoom: the share of the tile's height the whole phone should take (e.g. 0.85). */
  fill?: number;
  className?: string;
}) {
  const i = Math.max(0, PHONES.findIndex((ph) => ph.id === id));
  const ScreenOverride = screen ? PHONES.find((ph) => ph.id === screen)?.Screen : undefined;
  const ref = useRef<HTMLDivElement>(null);
  const [p, setP] = useState(0);
  const [visible, setVisible] = useState(true);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const fit = () => {
      const photo = el.querySelector<HTMLElement>("[data-photo]");
      if (!photo) return;
      let z = zoom ?? (el.clientWidth < 520 ? 1.4 : 1.06);
      if (fill) {
        // Size the photo so the whole phone takes `fill` of the tile's height,
        // whatever the tile's shape, but never leave the tile uncovered.
        const ph = PHONES[i];
        const W = photo.clientWidth;
        const H = photo.clientHeight;
        if (W && H) {
          const cover = Math.max(W / ph.w, H / ph.h);
          const glassH = Math.hypot(ph.m[4], ph.m[5]) * 932;
          z = Math.max(1, (fill * H) / glassH / cover);
        }
      }
      fitPhoto(photo, i, z);
    };
    fit();
    const ro = typeof ResizeObserver !== "undefined" ? new ResizeObserver(fit) : null;
    ro?.observe(el);
    const imgs = [...el.querySelectorAll<HTMLImageElement>("img")];
    imgs.forEach((img) => img.addEventListener("load", fit));
    window.addEventListener("pageshow", fit);
    const late = [80, 400, 1200].map((ms) => window.setTimeout(fit, ms));
    return () => {
      ro?.disconnect();
      imgs.forEach((img) => img.removeEventListener("load", fit));
      window.removeEventListener("pageshow", fit);
      late.forEach(clearTimeout);
    };
  }, [i, zoom, fill]);

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

  return (
    <div ref={ref} className={`${s.live} ${className ?? ""}`}>
      <PhonePhoto ph={PHONES[i]} i={i} progress={p} active={visible} screen={ScreenOverride} />
    </div>
  );
}

export { s as phoneShowcaseStyles };
