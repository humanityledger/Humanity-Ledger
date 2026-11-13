"use client";

import React, { useCallback, useEffect, useRef, useState } from "react";
import { HLLogo } from "@/components/shared/HLLogo";
import landing from "./Landing.module.css";
import s from "./Showcase.module.css";

/**
 * The new landing scenes: the brand bar in the hero, the desktop tour, Live
 * Activities, the Aztec Network section and the scale section.
 *
 * Motion rules for all of them:
 *   - Scenes are driven by the scroll position, never by a one-off trigger,
 *     so scrolling back plays them backwards exactly.
 *   - One passive scroll listener per scene, throttled to animation frames
 *     and only while the scene is near the screen. Styles are written straight
 *     to the elements; React only re-renders when the active chapter changes.
 *   - Narrow screens, touch screens and reduced motion get plain, stacked
 *     layouts with the same content.
 *
 * Aztec's marks are the official files from aztec.network/brand, shown as
 * supplied: the symbol and the wordmark apart, never joined to our logo, never
 * narrower than 60px, with clear space and no effects.
 */

const clamp = (v: number, a = 0, b = 1) => Math.min(b, Math.max(a, v));
const smooth = (t: number) => t * t * (3 - 2 * t);

const AZTEC_WORDMARK_INK = "/brand/aztec/aztec-wordmark-ink.svg";
const AZTEC_SYMBOL = "/brand/aztec/aztec-symbol.svg";
const AZTEC_URL = "https://aztec.network";

/* ── Shared hooks ──────────────────────────────────────────────────────── */

/** True when the scene can be pinned and scrubbed: wide, fine pointer, motion allowed. */
function useScrubMode(minWidth = 1024) {
  const [on, setOn] = useState(false);
  useEffect(() => {
    const wide = window.matchMedia(`(min-width: ${minWidth}px) and (hover: hover) and (pointer: fine)`);
    const motion = window.matchMedia("(prefers-reduced-motion: reduce)");
    const apply = () => setOn(wide.matches && !motion.matches);
    apply();
    wide.addEventListener?.("change", apply);
    motion.addEventListener?.("change", apply);
    return () => {
      wide.removeEventListener?.("change", apply);
      motion.removeEventListener?.("change", apply);
    };
  }, [minWidth]);
  return on;
}

function useReducedMotion() {
  const [reduce, setReduce] = useState(false);
  useEffect(() => {
    const mq = window.matchMedia("(prefers-reduced-motion: reduce)");
    const apply = () => setReduce(mq.matches);
    apply();
    mq.addEventListener?.("change", apply);
    return () => mq.removeEventListener?.("change", apply);
  }, []);
  return reduce;
}

/**
 * Progress (0 to 1) of a pinned stage through its track, read from the two
 * boxes only, so it holds under the 67% page zoom and in any scroll container.
 * Calls `onFrame` on every animation frame while the track is near the screen.
 */
function useTrackProgress(
  enabled: boolean,
  trackRef: React.RefObject<HTMLElement | null>,
  stageRef: React.RefObject<HTMLElement | null>,
  onFrame: (p: number) => void,
) {
  const cb = useRef(onFrame);
  cb.current = onFrame;
  useEffect(() => {
    if (!enabled) return;
    const track = trackRef.current;
    const stage = stageRef.current;
    if (!track || !stage) return;
    let raf = 0;
    let near = true;
    const frame = () => {
      raf = 0;
      const t = track.getBoundingClientRect();
      const st = stage.getBoundingClientRect();
      const dist = Math.max(1, t.height - st.height);
      cb.current(clamp((st.top - t.top) / dist));
    };
    const onScroll = () => {
      if (near && !raf) raf = requestAnimationFrame(frame);
    };
    const io =
      typeof IntersectionObserver !== "undefined"
        ? new IntersectionObserver(([e]) => {
            near = e.isIntersecting;
            if (near) onScroll();
          }, { rootMargin: "200px 0px" })
        : null;
    io?.observe(track);
    // Capture catches the app shell's own scroll as well as the window's.
    window.addEventListener("scroll", onScroll, { passive: true, capture: true });
    window.addEventListener("resize", onScroll, { passive: true });
    frame();
    return () => {
      io?.disconnect();
      window.removeEventListener("scroll", onScroll, { capture: true });
      window.removeEventListener("resize", onScroll);
      if (raf) cancelAnimationFrame(raf);
    };
  }, [enabled, trackRef, stageRef]);
}

/** Scroll the page so a pinned track shows chapter `i` of `n`. */
function scrollToChapter(track: HTMLElement | null, stage: HTMLElement | null, i: number, n: number) {
  if (!track || !stage) return;
  let scroller: HTMLElement | null = track.parentElement;
  while (scroller) {
    const oy = getComputedStyle(scroller).overflowY;
    if ((oy === "auto" || oy === "scroll") && scroller.scrollHeight > scroller.clientHeight) break;
    scroller = scroller.parentElement;
  }
  const el = scroller ?? (document.scrollingElement as HTMLElement | null);
  if (!el) return;
  const t = track.getBoundingClientRect();
  const st = stage.getBoundingClientRect();
  const dist = t.height - st.height;
  // Under the page zoom, box values and scrollTop share the same (visual) pixels.
  const target = ((i + 0.5) / n) * dist;
  const delta = t.top + target - st.top;
  const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  el.scrollTo({ top: el.scrollTop + delta, behavior: reduce ? "auto" : "smooth" });
}

/* ── Brand bar ─────────────────────────────────────────────────────────── */

/** Humanity Ledger, then "Private payments on" and Aztec's wordmark, well apart. */
export function BrandBar() {
  return (
    <div className={s.brandBar}>
      <HLLogo size={30} />
      <span className={s.brandRule} aria-hidden="true" />
      <a href={AZTEC_URL} target="_blank" rel="noopener noreferrer" className={s.brandAztec}>
        <span className={s.brandLabel}>Private payments on</span>
        <img src={AZTEC_WORDMARK_INK} alt="Aztec Network" width={92} height={21} className={s.brandWordmark} />
      </a>
    </div>
  );
}

/* ── Desktop tour ──────────────────────────────────────────────────────── */

const DESKTOP = [
  {
    id: "chats",
    title: "Chats",
    text: "Conversations, voice notes and private payments in one thread. A live call stays pinned above it as you keep writing.",
    alt: "Ledger Chat on desktop. The chat list, a conversation with Maya with a private payment of 48 AZTEC, a voice note, and the contact panel with safety glyphs.",
  },
  {
    id: "calls",
    title: "Calls",
    text: "Voice and video calls, encrypted end to end and connected directly between the two devices whenever the network allows.",
    alt: "Ledger Chat on desktop. Call history on the left and an encrypted direct video call with Leo.",
  },
  {
    id: "updates",
    title: "Updates",
    text: "Status that disappears after a day, and posts you send to the circle you choose: contacts, close friends, or everyone.",
    alt: "Ledger Chat on desktop. Status updates, a post composer with an audience picker, a poll and the feed.",
  },
  {
    id: "communities",
    title: "Communities",
    text: "Channels, live voice rooms, announcements from admins and roles for members, with guidelines everyone accepts on the way in.",
    alt: "Ledger Chat on desktop. A community with channels, a live voice room, a pinned announcement and the member list.",
  },
] as const;

function shotSrc(id: string) {
  return {
    src: `/landing/desktop/${id}-1440.webp`,
    // Up to four times the drawn size, so the text stays sharp when the page is zoomed in.
    srcSet: [1440, 2880, 4320, 5760].map((w) => `/landing/desktop/${id}-${w}.webp ${w}w`).join(", "),
  };
}

function BrowserBar() {
  return (
    <div className={s.browserBar} aria-hidden="true">
      <span className={s.browserDots}>
        <i />
        <i />
        <i />
      </span>
      <span className={s.browserUrl}>
        <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4">
          <rect x="5" y="11" width="14" height="10" rx="2" />
          <path d="M8 11V8a4 4 0 0 1 8 0v3" />
        </svg>
        ledgerchat.org
      </span>
      <span className={s.browserDots} style={{ visibility: "hidden" }}>
        <i />
        <i />
        <i />
      </span>
    </div>
  );
}

export function DesktopTour() {
  const scrub = useScrubMode(1024);
  const trackRef = useRef<HTMLDivElement>(null);
  const stageRef = useRef<HTMLDivElement>(null);
  const windowRef = useRef<HTMLDivElement>(null);
  const shotRefs = useRef<(HTMLDivElement | null)[]>([]);
  const chapterRefs = useRef<(HTMLLIElement | null)[]>([]);
  const [active, setActive] = useState(0);
  const activeRef = useRef(0);
  const N = DESKTOP.length;

  useTrackProgress(scrub, trackRef, stageRef, (p) => {
    // Each chapter dwells for most of its share, then hands over.
    const seg = Math.min(p * N, N - 1e-6);
    const i0 = Math.floor(seg);
    const local = seg - i0;
    const t = i0 + (i0 === N - 1 ? 0 : smooth(clamp((local - 0.62) / 0.38)));
    shotRefs.current.forEach((el, i) => {
      if (!el) return;
      const d = i - t;
      const o = clamp(1 - Math.abs(d) * 1.25);
      el.style.opacity = o.toFixed(3);
      el.style.transform = `translate3d(0, ${(d * 28).toFixed(1)}px, 0) scale(${(1 - Math.min(0.05, Math.abs(d) * 0.05)).toFixed(4)})`;
      el.style.visibility = o < 0.002 ? "hidden" : "visible";
    });
    chapterRefs.current.forEach((el, i) => {
      el?.style.setProperty("--fill", String(clamp(seg - i)));
    });
    const a = Math.round(t);
    if (a !== activeRef.current) {
      activeRef.current = a;
      setActive(a);
    }
  });

  // Reset inline styles when leaving scrub mode.
  useEffect(() => {
    if (scrub) return;
    shotRefs.current.forEach((el) => {
      if (!el) return;
      el.style.opacity = "";
      el.style.transform = "";
      el.style.visibility = "";
    });
  }, [scrub]);

  // The window leans towards the cursor, a few degrees at most, with a moving highlight.
  useEffect(() => {
    if (!scrub) return;
    const win = windowRef.current;
    if (!win) return;
    let raf = 0;
    const target = { x: 0, y: 0 };
    const cur = { x: 0, y: 0 };
    const tick = () => {
      cur.x += (target.x - cur.x) * 0.12;
      cur.y += (target.y - cur.y) * 0.12;
      win.style.setProperty("--rx", `${(-cur.y * 4).toFixed(2)}deg`);
      win.style.setProperty("--ry", `${(cur.x * 5).toFixed(2)}deg`);
      win.style.setProperty("--gx", `${(50 + cur.x * 40).toFixed(1)}%`);
      win.style.setProperty("--gy", `${(30 + cur.y * 40).toFixed(1)}%`);
      raf = Math.abs(target.x - cur.x) + Math.abs(target.y - cur.y) > 0.001 ? requestAnimationFrame(tick) : 0;
    };
    const onMove = (e: PointerEvent) => {
      const r = win.getBoundingClientRect();
      target.x = clamp((e.clientX - (r.left + r.width / 2)) / (r.width / 2), -1, 1);
      target.y = clamp((e.clientY - (r.top + r.height / 2)) / (r.height / 2), -1, 1);
      if (!raf) raf = requestAnimationFrame(tick);
    };
    const onLeave = () => {
      target.x = 0;
      target.y = 0;
      if (!raf) raf = requestAnimationFrame(tick);
    };
    const stage = stageRef.current;
    stage?.addEventListener("pointermove", onMove, { passive: true });
    stage?.addEventListener("pointerleave", onLeave);
    return () => {
      stage?.removeEventListener("pointermove", onMove);
      stage?.removeEventListener("pointerleave", onLeave);
      if (raf) cancelAnimationFrame(raf);
    };
  }, [scrub]);

  const go = useCallback((i: number) => scrollToChapter(trackRef.current, stageRef.current, i, N), [N]);

  return (
    <section id="desktop" data-glow className={`${landing.card} ${s.tourCard}`} aria-labelledby="desktop-title">
      <div className={landing.sectionHead}>
        <p className={landing.eyebrow}>Ledger Chat on your computer</p>
        <h2 id="desktop-title" className={landing.h2}>
          Every conversation. <em>One calm window.</em>
        </h2>
        <p className={landing.lead}>
          Chats, calls, updates and communities, side by side on a large screen, with the same privacy as on your
          phone.
        </p>
      </div>

      {scrub ? (
        <div ref={trackRef} className={s.tourTrack} style={{ ["--n" as string]: N } as React.CSSProperties}>
          <div ref={stageRef} className={s.tourStage}>
            <ol className={s.chapters}>
              {DESKTOP.map((d, i) => (
                <li
                  key={d.id}
                  ref={(el) => {
                    chapterRefs.current[i] = el;
                  }}
                  className={`${s.chapter} ${i === active ? s.chapterOn : ""}`}
                >
                  <button type="button" className={s.chapterBtn} onClick={() => go(i)} aria-current={i === active ? "step" : undefined}>
                    <span className={s.chapterNum}>{String(i + 1).padStart(2, "0")}</span>
                    <span className={s.chapterTitle}>{d.title}</span>
                    <span className={s.chapterText}>{d.text}</span>
                    <span className={s.chapterBar} aria-hidden="true" />
                  </button>
                </li>
              ))}
            </ol>

            <div className={s.windowWrap}>
              <div ref={windowRef} className={s.window}>
                <BrowserBar />
                <div className={s.shots}>
                  {DESKTOP.map((d, i) => (
                    <div
                      key={d.id}
                      ref={(el) => {
                        shotRefs.current[i] = el;
                      }}
                      className={s.shot}
                      aria-hidden={i !== active}
                    >
                      <img
                        {...shotSrc(d.id)}
                        sizes="(min-width: 1024px) 60vw, 100vw"
                        alt={d.alt}
                        width={1440}
                        height={900}
                        loading={i === 0 ? "eager" : "lazy"}
                        decoding="async"
                        draggable={false}
                      />
                    </div>
                  ))}
                </div>
                <span className={s.windowSheen} aria-hidden="true" />
              </div>
            </div>
          </div>
        </div>
      ) : (
        <ol className={s.tourList}>
          {DESKTOP.map((d, i) => (
            <li key={d.id} className={s.tourItem}>
              <div className={s.tourItemHead}>
                <span className={s.chapterNum}>{String(i + 1).padStart(2, "0")}</span>
                <h3 className={landing.h3}>{d.title}</h3>
                <p className={landing.body}>{d.text}</p>
              </div>
              <div className={`${s.window} ${s.windowFlat}`}>
                <BrowserBar />
                <img
                  {...shotSrc(d.id)}
                  sizes="100vw"
                  alt={d.alt}
                  width={1440}
                  height={900}
                  loading="lazy"
                  decoding="async"
                  className={s.flatImg}
                />
              </div>
            </li>
          ))}
        </ol>
      )}
    </section>
  );
}

/* ── Live Activities ───────────────────────────────────────────────────── */

type IslandState = {
  id: string;
  kind: "compact" | "expanded" | "minimal";
  title: string;
  text: string;
};

const ISLAND: IslandState[] = [
  {
    id: "call",
    kind: "compact",
    title: "A call that follows you",
    text: "Leave the call screen and the call stays around the camera, with its timer and a live voice level.",
  },
  {
    id: "incoming",
    kind: "expanded",
    title: "Answer from anywhere",
    text: "An incoming call opens the island with the caller's name and two clear choices.",
  },
  {
    id: "proving",
    kind: "expanded",
    title: "A payment, proved on your phone",
    text: "Sending privately takes a few seconds of proving on the device. The island shows each step until it settles.",
  },
  {
    id: "received",
    kind: "expanded",
    title: "Money arrives quietly",
    text: "A payment received shows who sent it and the amount, and nothing about the conversation it came from.",
  },
  {
    id: "both",
    kind: "minimal",
    title: "Two at once",
    text: "A call and a payment at the same time split into two small shapes, each one a tap away.",
  },
];

function IslandContent({ id }: { id: string }) {
  switch (id) {
    case "call":
      return (
        <span className={s.icCompact}>
          <span className={s.icDot}>
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="2.4" strokeLinejoin="round">
              <path d="M5 4h3l2 5-2.5 1.5a11 11 0 0 0 6 6L15 14l5 2v3a2 2 0 0 1-2 2A16 16 0 0 1 3 6a2 2 0 0 1 2-2z" />
            </svg>
          </span>
          <span className={s.icRight}>
            <span className={s.icBars}>
              <i />
              <i />
              <i />
              <i />
            </span>
            <span className={s.icTimer}>04:12</span>
          </span>
        </span>
      );
    case "incoming":
      return (
        <span className={s.icExpanded}>
          <span className={s.icAvatar} style={{ background: "#e7ecf7" }}>
            MO
          </span>
          <span className={s.icText}>
            <span className={s.icKicker}>Ledger video</span>
            <span className={s.icName}>Maya Okafor</span>
          </span>
          <span className={`${s.icBtn} ${s.icDecline}`}>
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="2" strokeLinejoin="round">
              <path d="M3 14c5-5 13-5 18 0l-2.5 2.5-3-1.5v-2.5a10 10 0 0 0-7 0V15l-3 1.5z" />
            </svg>
          </span>
          <span className={`${s.icBtn} ${s.icAccept}`}>
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="1.9" strokeLinejoin="round">
              <rect x="3" y="6" width="13" height="12" rx="3" />
              <path d="M16 10l5-3v10l-5-3z" />
            </svg>
          </span>
        </span>
      );
    case "proving":
      return (
        <span className={s.icProving}>
          <span className={s.icExpanded}>
            <span className={s.icAvatar} style={{ background: "#e7ecf7" }}>
              MO
            </span>
            <span className={s.icText}>
              <span className={s.icKicker}>Proving privately</span>
              <span className={s.icName}>To Maya Okafor</span>
            </span>
            <span className={s.icAmount}>48.00</span>
          </span>
          <span className={s.icSteps}>
            <i className={s.icStepDone} />
            <i className={s.icStepRun} />
            <i />
          </span>
          <span className={s.icStepLabels}>
            <span>Encrypt</span>
            <span className={s.icStepLabelOn}>Prove on device</span>
            <span>Settle</span>
          </span>
        </span>
      );
    case "received":
      return (
        <span className={s.icExpanded}>
          <span className={s.icAvatar} style={{ background: "#f6ece4" }}>
            AT
          </span>
          <span className={s.icText}>
            <span className={s.icKicker} style={{ color: "#5fd38d" }}>
              Received privately
            </span>
            <span className={s.icName}>Aiko Tanaka</span>
          </span>
          <span className={s.icAmount}>+20.00</span>
        </span>
      );
    default:
      return null;
  }
}

/** The island itself: one black shape that morphs between states. */
function Island({ state }: { state: number }) {
  const st = ISLAND[state];
  return (
    <div className={s.islandRow} data-kind={st.kind} data-state={st.id}>
      <div className={s.island}>
        {ISLAND.map((x, i) =>
          x.kind === "minimal" ? null : (
            <span key={x.id} className={`${s.islandLayer} ${i === state ? s.islandLayerOn : ""}`} aria-hidden={i !== state}>
              <IslandContent id={x.id} />
            </span>
          ),
        )}
        {st.kind === "minimal" && (
          <span className={`${s.islandLayer} ${s.islandLayerOn}`}>
            <span className={s.icCompact}>
              <span className={s.icDot} />
            </span>
          </span>
        )}
      </div>
      <div className={s.islandBubble} aria-hidden="true">
        <span className={s.icRing} />
      </div>
    </div>
  );
}

/** A slice of the iPhone's screen behind the island: the top of the chat list. */
function PhoneTop({ state }: { state: number }) {
  return (
    <div className={s.phoneTop}>
      <div className={s.phoneGlass}>
        <Island state={state} />
        <div className={s.phoneContent} aria-hidden="true">
          <div className={s.phoneTitleRow}>
            <span className={s.phoneTitle}>Chats</span>
            <span className={s.phonePlus}>+</span>
          </div>
          <div className={s.phoneSearch}>Search</div>
          {[
            ["MO", "Maya Okafor", "Only the two of us. Not even the network.", "#e7ecf7"],
            ["CT", "Core team", "Leo: shipping the sponsor build tonight", "#ece9f6"],
            ["LB", "Leo Brandt", "On a call", "#e5f3ea"],
          ].map(([ini, name, last, tint]) => (
            <div key={ini} className={s.phoneRow}>
              <span className={s.phoneAvatar} style={{ background: tint }}>
                {ini}
              </span>
              <span className={s.phoneRowText}>
                <b>{name}</b>
                <span>{last}</span>
              </span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

export function LiveActivities() {
  const scrub = useScrubMode(1024);
  const reduce = useReducedMotion();
  const trackRef = useRef<HTMLDivElement>(null);
  const stageRef = useRef<HTMLDivElement>(null);
  const rootRef = useRef<HTMLElement>(null);
  const itemRefs = useRef<(HTMLLIElement | null)[]>([]);
  const [state, setState] = useState(0);
  const stateRef = useRef(0);
  const N = ISLAND.length;

  useTrackProgress(scrub, trackRef, stageRef, (p) => {
    const seg = Math.min(p * N, N - 1e-6);
    itemRefs.current.forEach((el, i) => el?.style.setProperty("--fill", String(clamp(seg - i))));
    const a = Math.floor(seg);
    if (a !== stateRef.current) {
      stateRef.current = a;
      setState(a);
    }
  });

  // Without a pinned track (phones, tablets) the island plays on its own while it is on screen.
  useEffect(() => {
    if (scrub || reduce) return;
    const el = rootRef.current;
    if (!el || typeof IntersectionObserver === "undefined") return;
    let timer = 0;
    const io = new IntersectionObserver(([e]) => {
      window.clearInterval(timer);
      if (!e.isIntersecting) return;
      timer = window.setInterval(() => {
        if (document.hidden) return;
        setState((v) => (v + 1) % N);
      }, 2600);
    }, { threshold: 0.35 });
    io.observe(el);
    return () => {
      io.disconnect();
      window.clearInterval(timer);
    };
  }, [scrub, reduce, N]);

  const go = useCallback(
    (i: number) => {
      if (scrub) scrollToChapter(trackRef.current, stageRef.current, i, N);
      else setState(i);
    },
    [scrub, N],
  );

  const list = (
    <ol className={s.liveList}>
      {ISLAND.map((x, i) => (
        <li
          key={x.id}
          ref={(el) => {
            itemRefs.current[i] = el;
          }}
          className={`${s.liveItem} ${i === state ? s.liveItemOn : ""}`}
        >
          <button type="button" className={s.liveBtn} onClick={() => go(i)} aria-current={i === state ? "step" : undefined}>
            <span className={s.liveKind}>{x.kind}</span>
            <span className={s.liveTitle}>{x.title}</span>
            <span className={s.liveText}>{x.text}</span>
            <span className={s.liveBar} aria-hidden="true" />
          </button>
        </li>
      ))}
    </ol>
  );

  return (
    <section ref={rootRef} id="live-activities" className={`${landing.card} ${s.liveCard}`} aria-labelledby="live-title">
      <div className={`${landing.sectionHead} ${s.liveHead}`}>
        <p className={`${landing.eyebrow} ${s.liveEyebrow}`}>Live Activities on iPhone</p>
        <h2 id="live-title" className={`${landing.h2} ${s.liveH2}`}>
          Calls and payments, <em>alive around the camera.</em>
        </h2>
        <p className={`${landing.lead} ${s.liveLead}`}>
          Ledger Chat keeps what is happening in the Dynamic Island while you use the rest of your phone. Names and
          amounts only. Message text never appears there.
        </p>
      </div>

      {reduce ? (
        <div className={s.liveGrid}>
          {ISLAND.map((x, i) => (
            <figure key={x.id} className={s.liveCell}>
              <div className={s.liveCellStage}>
                <Island state={i} />
              </div>
              <figcaption>
                <span className={s.liveTitle}>{x.title}</span>
                <span className={s.liveText}>{x.text}</span>
              </figcaption>
            </figure>
          ))}
        </div>
      ) : scrub ? (
        <div ref={trackRef} className={s.liveTrack} style={{ ["--n" as string]: N } as React.CSSProperties}>
          <div ref={stageRef} className={s.liveStage}>
            {list}
            <div className={s.liveVisual}>
              <PhoneTop state={state} />
            </div>
          </div>
        </div>
      ) : (
        <div className={s.liveStatic}>
          <div className={s.liveVisual}>
            <PhoneTop state={state} />
          </div>
          {list}
        </div>
      )}

      <ul className={s.liveRules}>
        <li>Never the text of a message. Only names and amounts.</li>
        <li>Amounts hide while the screen is shared or recorded.</li>
        <li>On a computer, the same pill floats at the top of the conversation.</li>
      </ul>
      <p className={s.liveNote}>A design for the native iPhone app, which is in development. Today Ledger Chat runs in Safari.</p>
    </section>
  );
}

/* ── Aztec Network ─────────────────────────────────────────────────────── */

const AZTEC_FACTS = [
  {
    k: "Proved on your device",
    v: "Each payment is turned into a zero knowledge proof on your own phone or computer before it leaves.",
  },
  {
    k: "Private notes",
    v: "Balances live as encrypted notes. The amount and the person you paid stay off the public record.",
  },
  {
    k: "Settled on Ethereum",
    v: "Aztec is an Ethereum layer 2 run by permissionless sequencers and provers, not by us.",
  },
];

export function AztecSection() {
  const panelRef = useRef<HTMLDivElement>(null);
  const scrub = useScrubMode(980);

  // The ink panel answers the cursor with a soft light; the symbol itself never changes.
  useEffect(() => {
    if (!scrub) return;
    const el = panelRef.current;
    if (!el) return;
    const onMove = (e: PointerEvent) => {
      const r = el.getBoundingClientRect();
      el.style.setProperty("--mx", `${(((e.clientX - r.left) / r.width) * 100).toFixed(1)}%`);
      el.style.setProperty("--my", `${(((e.clientY - r.top) / r.height) * 100).toFixed(1)}%`);
      el.style.setProperty("--lit", "1");
    };
    const onLeave = () => el.style.setProperty("--lit", "0");
    el.addEventListener("pointermove", onMove, { passive: true });
    el.addEventListener("pointerleave", onLeave);
    return () => {
      el.removeEventListener("pointermove", onMove);
      el.removeEventListener("pointerleave", onLeave);
    };
  }, [scrub]);

  return (
    <section id="aztec" className={`${landing.card} ${landing.reveal} ${s.aztecCard}`} aria-labelledby="aztec-title">
      <div className={s.aztecGrid}>
        <div className={s.aztecCopy}>
          <p className={s.aztecLabel}>Aztec Network</p>
          <h2 id="aztec-title" className={s.aztecH2}>
            Freedom to pay, <em>unseen.</em>
          </h2>
          <p className={s.aztecLead}>
            Private payments in Ledger Chat settle on Aztec Network, the privacy layer 2 for Ethereum. You see a
            payment in the conversation. The public ledger sees that a transaction happened, and not who paid whom or
            how much.
          </p>
          <dl className={s.aztecFacts}>
            {AZTEC_FACTS.map((f) => (
              <div key={f.k} className={s.aztecFact}>
                <dt>{f.k}</dt>
                <dd>{f.v}</dd>
              </div>
            ))}
          </dl>
          <div className={s.aztecFoot}>
            <a href={AZTEC_URL} target="_blank" rel="noopener noreferrer" className={s.aztecWordmarkLink}>
              <img src={AZTEC_WORDMARK_INK} alt="Aztec Network" width={124} height={29} />
            </a>
            <p className={s.aztecDisclaimer}>
              Ledger Chat is an independent application built on Aztec. The Aztec marks belong to Aztec and appear here as
              Aztec supplies them.
            </p>
          </div>
        </div>
        <div ref={panelRef} className={s.aztecPanel}>
          <span className={s.aztecTexture} aria-hidden="true" />
          <img src={AZTEC_SYMBOL} alt="Aztec symbol" width={207} height={207} className={s.aztecSymbol} />
        </div>
      </div>
    </section>
  );
}

/* ── Built for billions ────────────────────────────────────────────────── */

const SCALE = [
  {
    title: "The work happens on each device",
    text: "Encryption and payment proofs run on the phone or computer of the person using them. As more people join, that work spreads across their devices instead of piling up on one server.",
  },
  {
    title: "Open networks carry it",
    text: "Messages travel over XMTP and payments settle on Aztec, networks run by many independent operators rather than by one company.",
  },
  {
    title: "No phone number, no bank account",
    text: "A wallet made in the browser is enough to start. Nobody has to approve an account, and sponsored fees mean a newcomer does not need tokens first.",
  },
  {
    title: "Light enough for any phone",
    text: "Ledger Chat runs in the browser with nothing to install, so it reaches the phones people already own, wherever they are.",
  },
];

const SCALE_TARGET = 4_000_000_000;
const fmtCount = (n: number) => Math.round(n).toLocaleString("en-US");

export function ScaleSection() {
  const rootRef = useRef<HTMLElement>(null);
  const numRef = useRef<HTMLSpanElement>(null);
  const reduce = useReducedMotion();

  // The figure counts up as the section rises into view, and back down when you scroll back.
  useEffect(() => {
    const root = rootRef.current;
    const num = numRef.current;
    if (!root || !num) return;
    if (reduce) {
      num.textContent = fmtCount(SCALE_TARGET);
      return;
    }
    let raf = 0;
    let near = false;
    const frame = () => {
      raf = 0;
      const r = root.getBoundingClientRect();
      // innerHeight and the box are both in visual pixels, also under the page zoom.
      const vh = window.innerHeight;
      const p = clamp((vh - r.top) / (vh * 0.75));
      const eased = 1 - Math.pow(1 - p, 3);
      num.textContent = fmtCount(SCALE_TARGET * eased);
    };
    const onScroll = () => {
      if (near && !raf) raf = requestAnimationFrame(frame);
    };
    const io =
      typeof IntersectionObserver !== "undefined"
        ? new IntersectionObserver(([e]) => {
            near = e.isIntersecting;
            if (near) onScroll();
          }, { rootMargin: "100px 0px" })
        : null;
    if (io) io.observe(root);
    else near = true;
    window.addEventListener("scroll", onScroll, { passive: true, capture: true });
    window.addEventListener("resize", onScroll, { passive: true });
    frame();
    return () => {
      io?.disconnect();
      window.removeEventListener("scroll", onScroll, { capture: true });
      window.removeEventListener("resize", onScroll);
      if (raf) cancelAnimationFrame(raf);
    };
  }, [reduce]);

  return (
    <section ref={rootRef} id="scale" data-glow className={`${landing.card} ${landing.reveal} ${s.scaleCard}`} aria-labelledby="scale-title">
      <div className={s.scaleTop}>
        <p className={landing.eyebrow}>Built for billions</p>
        <p className={s.scaleFigure} aria-hidden="true">
          <span ref={numRef}>{fmtCount(SCALE_TARGET)}</span>
        </p>
        <h2 id="scale-title" className={landing.h2}>
          Private messages and payments <em>for four billion people.</em>
        </h2>
        <p className={landing.lead}>
          That is the scale Humanity Ledger is designed for: everyone with a phone and a browser. It is a design target,
          not a user count, and Ledger Chat has not been tested at that scale yet. These are the choices that make it
          reachable.
        </p>
      </div>
      <ol className={s.scaleGrid}>
        {SCALE.map((x, i) => (
          <li key={x.title} className={s.scaleItem} data-glow>
            <span className={s.scaleNum}>{String(i + 1).padStart(2, "0")}</span>
            <h3 className={landing.h3}>{x.title}</h3>
            <p className={landing.body}>{x.text}</p>
          </li>
        ))}
      </ol>
    </section>
  );
}
