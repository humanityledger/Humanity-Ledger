"use client";

/**
 * DeviceFrame — a vector iPhone (15 / 16 Pro Max proportions) that shows a
 * live HTML screen. No photographs and no raster assets: the body, titanium
 * band, buttons, Dynamic Island, lens and glass are SVG and CSS, so the device
 * is sharp at any size and the screen inside is real, selectable markup.
 *
 * Geometry, in CSS px at scale 1 (1 px = 1 pt on the device):
 *   display      430 x 932, continuous corners, radius 55
 *   bezel+band   12 on every side -> body 454 x 956, radius 67
 *   island       126 x 37.33, 11 below the top of the display
 * The whole device is laid out at that size and scaled with one transform
 * to fit its box, so nothing is ever cropped or re-proportioned.
 *
 * Corners are not border-radius. They are continuous-curvature "squircle"
 * corners (Figma's corner smoothing algorithm, smoothing 0.6, which is the
 * look of iOS corners), drawn as SVG paths and applied to the screen with
 * clip-path: path(). A plain border-radius has a visible kink where the
 * straight edge meets the arc; these do not.
 */

import React, { useEffect, useId, useLayoutEffect, useRef, useState } from "react";
import s from "./DeviceFrame.module.css";

// ─── Geometry ───────────────────────────────────────────────────────────────

export const SCREEN_W = 430;
export const SCREEN_H = 932;
const SCREEN_R = 55;
const INSET = 12; // bezel + band, each side
const BODY_W = SCREEN_W + INSET * 2; // 454
const BODY_H = SCREEN_H + INSET * 2; // 956
const BODY_R = SCREEN_R + INSET; // 67
const BAND = 2.6; // visible titanium band from the front
const OVERHANG = 3; // buttons stand proud of the band
const CANVAS_W = BODY_W + OVERHANG * 2;
const CANVAS_H = BODY_H;

const rad = (deg: number) => (deg * Math.PI) / 180;

/**
 * Rounded rectangle with continuous ("smoothed") corners, as an SVG path.
 * Port of the corner construction used by Figma (and the figma-squircle
 * package): a circular arc in the middle of each corner, eased into the
 * straight edges by two cubic Béziers, over a length of (1 + smoothing) * r.
 */
export function squirclePath(x: number, y: number, w: number, h: number, r: number, smoothing = 0.6): string {
  const maxR = Math.min(w, h) / 2;
  const radius = Math.min(r, maxR);
  const p = Math.min((1 + smoothing) * radius, maxR);
  const arcMeasure = 90 * (1 - smoothing);
  const arc = Math.sin(rad(arcMeasure / 2)) * radius * Math.SQRT2;
  const alpha = (90 - arcMeasure) / 2;
  const p3p4 = radius * Math.tan(rad(alpha / 2));
  const beta = 45 * smoothing;
  const c = p3p4 * Math.cos(rad(beta));
  const d = c * Math.tan(rad(beta));
  const b = (p - arc - c - d) / 3;
  const a = 2 * b;
  const f = (n: number) => +n.toFixed(3);
  const A = f(a), AB = f(a + b), ABC = f(a + b + c), B_C = f(b + c), C = f(c), D = f(d), R = f(radius), ARC = f(arc);
  return [
    `M ${f(x + w - p)} ${f(y)}`,
    // top right
    `c ${A} 0 ${AB} 0 ${ABC} ${D}`,
    `a ${R} ${R} 0 0 1 ${ARC} ${ARC}`,
    `c ${D} ${C} ${D} ${B_C} ${D} ${ABC}`,
    `L ${f(x + w)} ${f(y + h - p)}`,
    // bottom right
    `c 0 ${A} 0 ${AB} ${-D} ${ABC}`,
    `a ${R} ${R} 0 0 1 ${-ARC} ${ARC}`,
    `c ${-C} ${D} ${-B_C} ${D} ${-ABC} ${D}`,
    `L ${f(x + p)} ${f(y + h)}`,
    // bottom left
    `c ${-A} 0 ${-AB} 0 ${-ABC} ${-D}`,
    `a ${R} ${R} 0 0 1 ${-ARC} ${-ARC}`,
    `c ${-D} ${-C} ${-D} ${-B_C} ${-D} ${-ABC}`,
    `L ${f(x)} ${f(y + p)}`,
    // top left
    `c 0 ${-A} 0 ${-AB} ${D} ${-ABC}`,
    `a ${R} ${R} 0 0 1 ${ARC} ${-ARC}`,
    `c ${C} ${-D} ${B_C} ${-D} ${ABC} ${-D}`,
    "Z",
  ].join(" ");
}

// Paths in canvas coordinates (the body starts OVERHANG from the left).
const BX = OVERHANG;
const BODY_PATH = squirclePath(BX, 0, BODY_W, BODY_H, BODY_R);
const BEZEL_PATH = squirclePath(BX + BAND, BAND, BODY_W - BAND * 2, BODY_H - BAND * 2, BODY_R - BAND);
const SHADOW_PATH = squirclePath(BX + 18, 26, BODY_W - 36, BODY_H - 34, BODY_R - 18);
/** Relative to the screen's own box: used for clip-path and the glass overlay. */
export const SCREEN_PATH = squirclePath(0, 0, SCREEN_W, SCREEN_H, SCREEN_R);

/** Side buttons as share of body height (measured from iPhone 15 Pro Max front views). */
const BUTTONS = [
  { side: "left", top: 0.188, len: 0.034 }, // Action button
  { side: "left", top: 0.258, len: 0.068 }, // volume up
  { side: "left", top: 0.343, len: 0.068 }, // volume down
  { side: "right", top: 0.282, len: 0.104 }, // side button
] as const;

// ─── Dynamic Island ─────────────────────────────────────────────────────────

/**
 * idle    the plain island
 * secure  an MLS session: lock on the left, a quiet emerald dot on the right
 * call    voice call: green duration on the left, live waveform on the right,
 *         and iOS's ORANGE microphone indicator
 * video   video call: camera glyph, and iOS's GREEN camera indicator
 * The colours follow iOS: orange means the microphone is on, green the camera.
 */
export type IslandState = "idle" | "secure" | "call" | "video";

const ISLAND_W: Record<IslandState, number> = { idle: 126, secure: 166, call: 212, video: 176 };

function Island({ state, seconds }: { state: IslandState; seconds: number }) {
  const mm = String(Math.floor(seconds / 60)).padStart(1, "0");
  const ss = String(seconds % 60).padStart(2, "0");
  return (
    <div className={s.island} data-state={state} style={{ width: ISLAND_W[state] }} aria-hidden="true">
      <span className={s.islandLead}>
        {state === "secure" && (
          <svg width="13" height="15" viewBox="0 0 13 15">
            <rect x="1" y="6.4" width="11" height="8" rx="2.2" fill="currentColor" />
            <path d="M3.4 6.6V4.6a3.1 3.1 0 0 1 6.2 0v2" fill="none" stroke="currentColor" strokeWidth="1.7" />
          </svg>
        )}
        {state === "call" && (
          <>
            <svg width="14" height="14" viewBox="0 0 24 24">
              <path
                fill="currentColor"
                d="M6.6 10.8a15.1 15.1 0 0 0 6.6 6.6l2.2-2.2c.3-.3.7-.4 1-.2 1.1.4 2.3.6 3.6.6.6 0 1 .4 1 1V20c0 .6-.4 1-1 1A17 17 0 0 1 3 4c0-.6.4-1 1-1h3.5c.6 0 1 .4 1 1 0 1.3.2 2.5.6 3.6.1.3 0 .7-.2 1z"
              />
            </svg>
            <span className={s.islandTime}>
              {mm}:{ss}
            </span>
          </>
        )}
        {state === "video" && (
          <svg width="17" height="12" viewBox="0 0 17 12">
            <rect x="0.5" y="1" width="11" height="10" rx="2.4" fill="currentColor" />
            <path d="M12.5 4.6 16.5 2v8l-4-2.6z" fill="currentColor" />
          </svg>
        )}
      </span>
      <span className={s.islandTrail}>
        {state === "call" && (
          <span className={s.islandWave}>
            {[0, 1, 2, 3, 4].map((i) => (
              <i key={i} style={{ animationDelay: `${i * 0.11}s` }} />
            ))}
          </span>
        )}
        {state === "secure" && <span className={s.islandDotSecure} />}
      </span>
      {/* Front camera: sits at the right end of the pill on the real device. */}
      <span className={s.lens} />
    </div>
  );
}

// ─── Frame ──────────────────────────────────────────────────────────────────

export interface DeviceFrameProps {
  children: React.ReactNode;
  island?: IslandState;
  /** Seconds shown in the call island. */
  callSeconds?: number;
  /** Share of the box the device may take (0..1) along its limiting side. */
  fit?: number;
  finish?: "black" | "natural";
  className?: string;
  /** Accessible description of what the screen shows. */
  label?: string;
}

export function DeviceFrame({
  children,
  island = "idle",
  callSeconds = 0,
  fit = 0.92,
  finish = "black",
  className,
  label,
}: DeviceFrameProps) {
  const ref = useRef<HTMLDivElement>(null);
  const [k, setK] = useState<number | null>(null);
  // Decided after mount, so the server and the first client render agree (transform), and the switch
  // to zoom is an ordinary update. Every current engine supports zoom (Chrome, Edge, Safari, Firefox 126+).
  const [zoomOk, setZoomOk] = useState(false);
  useEffect(() => {
    setZoomOk(typeof CSS !== "undefined" && typeof CSS.supports === "function" && CSS.supports("zoom", "2"));
  }, []);
  const uid = useId().replace(/[^a-zA-Z0-9]/g, "");
  const id = (n: string) => `${n}-${uid}`;

  // Measure the box and scale the device to fit it. useLayoutEffect so the
  // first paint is already at the right size (no jump), with a guard for SSR.
  const useIso = typeof window === "undefined" ? useEffect : useLayoutEffect;
  useIso(() => {
    const el = ref.current;
    if (!el) return;
    const measure = () => {
      const W = el.clientWidth;
      const H = el.clientHeight;
      if (!W || !H) return;
      setK(Math.min(W / CANVAS_W, H / CANVAS_H) * fit);
    };
    measure();
    if (typeof ResizeObserver === "undefined") return;
    const ro = new ResizeObserver(measure);
    ro.observe(el);
    return () => ro.disconnect();
  }, [fit]);

  return (
    <div
      ref={ref}
      className={`${s.box} ${className ?? ""}`}
      role={label ? "img" : undefined}
      aria-label={label}
      aria-hidden={label ? undefined : true}
    >
      <div
        className={s.canvas}
        data-finish={finish}
        data-ready={k !== null ? "1" : undefined}
        // CSS zoom lays the phone out at its real size, so text and vectors are drawn sharp at any
        // scale. A transform scale was rasterized once and stretched: blurry on Retina Macs, iPhone and
        // Android, worst inside the scroll scenes (will-change layers). The transform stays as the
        // fallback for a browser without zoom.
        style={
          zoomOk && k !== null
            ? { width: CANVAS_W, height: CANVAS_H, zoom: k, marginLeft: -CANVAS_W / 2, marginTop: -CANVAS_H / 2 }
            : { width: CANVAS_W, height: CANVAS_H, transform: `translate(-50%, -50%) scale(${k ?? 0.5})` }
        }
      >
        {/* Body: shadow, buttons, titanium band, black bezel. */}
        <svg className={s.body} width={CANVAS_W} height={CANVAS_H} viewBox={`0 0 ${CANVAS_W} ${CANVAS_H}`} aria-hidden="true">
          <defs>
            <linearGradient id={id("band")} x1="0" y1="0" x2="1" y2="0">
              {finish === "natural" ? (
                <>
                  <stop offset="0" stopColor="#6d6f73" />
                  <stop offset="0.035" stopColor="#d7d8da" />
                  <stop offset="0.09" stopColor="#9a9c9f" />
                  <stop offset="0.5" stopColor="#b9bbbe" />
                  <stop offset="0.91" stopColor="#9a9c9f" />
                  <stop offset="0.965" stopColor="#dcdddf" />
                  <stop offset="1" stopColor="#6d6f73" />
                </>
              ) : (
                <>
                  <stop offset="0" stopColor="#1a1b1e" />
                  <stop offset="0.035" stopColor="#6b6e74" />
                  <stop offset="0.09" stopColor="#2c2e32" />
                  <stop offset="0.5" stopColor="#3a3c41" />
                  <stop offset="0.91" stopColor="#2c2e32" />
                  <stop offset="0.965" stopColor="#71747a" />
                  <stop offset="1" stopColor="#1a1b1e" />
                </>
              )}
            </linearGradient>
            {/* Studio light from above: brightens the top of the band. */}
            <linearGradient id={id("bandTop")} x1="0" y1="0" x2="0" y2="1">
              <stop offset="0" stopColor="#fff" stopOpacity="0.28" />
              <stop offset="0.12" stopColor="#fff" stopOpacity="0" />
              <stop offset="0.9" stopColor="#000" stopOpacity="0" />
              <stop offset="1" stopColor="#000" stopOpacity="0.25" />
            </linearGradient>
            <linearGradient id={id("btn")} x1="0" y1="0" x2="1" y2="0">
              <stop offset="0" stopColor={finish === "natural" ? "#8d8f93" : "#2a2c30"} />
              <stop offset="0.5" stopColor={finish === "natural" ? "#cfd0d2" : "#5c5f65"} />
              <stop offset="1" stopColor={finish === "natural" ? "#8d8f93" : "#2a2c30"} />
            </linearGradient>
            <filter id={id("shadowA")} x="-30%" y="-30%" width="160%" height="160%">
              <feGaussianBlur stdDeviation="20" />
            </filter>
            <filter id={id("shadowB")} x="-40%" y="-40%" width="180%" height="180%">
              <feGaussianBlur stdDeviation="50" />
            </filter>
          </defs>

          {/* Ambient shadows: a tight contact shadow and a wide, faint Aztec violet halo.
              They are inset paths, blurred, which is what a negative box-shadow spread does. */}
          <path d={SHADOW_PATH} fill="rgba(0,0,0,0.42)" transform="translate(0 12)" filter={`url(#${id("shadowA")})`} />
          <path d={SHADOW_PATH} fill="rgba(82,0,255,0.16)" transform="translate(0 34)" filter={`url(#${id("shadowB")})`} />

          {BUTTONS.map((b, i) => {
            const y = b.top * BODY_H;
            const h = b.len * BODY_H;
            const x = b.side === "left" ? 0 : CANVAS_W - OVERHANG - 1.5;
            return <rect key={i} x={x} y={y} width={OVERHANG + 1.5} height={h} rx={1.6} fill={`url(#${id("btn")})`} />;
          })}

          <path d={BODY_PATH} fill={`url(#${id("band")})`} />
          <path d={BODY_PATH} fill={`url(#${id("bandTop")})`} />
          {/* Antenna lines across the band, just past each top and bottom corner. */}
          {[
            [BX + BODY_R * 1.6, 0], [BX + BODY_W - BODY_R * 1.6 - 3, 0],
            [BX + BODY_R * 1.6, BODY_H - BAND], [BX + BODY_W - BODY_R * 1.6 - 3, BODY_H - BAND],
          ].map(([x, y], i) => (
            <rect key={i} x={x} y={y} width={3} height={BAND} fill="rgba(0,0,0,0.38)" />
          ))}
          <path d={BEZEL_PATH} fill="#030304" />
          {/* Fine highlight where the glass meets the band. */}
          <path d={BEZEL_PATH} fill="none" stroke="rgba(255,255,255,0.1)" strokeWidth="0.8" />
        </svg>

        {/* Display */}
        <div className={s.screen} style={{ left: BX + INSET, top: INSET, width: SCREEN_W, height: SCREEN_H, clipPath: `path("${SCREEN_PATH}")` }}>
          {children}
        </div>

        <div className={s.islandSlot} style={{ left: BX + INSET, top: INSET + 11, width: SCREEN_W }}>
          <Island state={island} seconds={callSeconds} />
        </div>

        {/* Glass: studio softbox reflection, a bloom from the top left, and the
            1 px light edge (rgba 255,255,255,0.15) of the cover glass. */}
        <svg
          className={s.glass}
          style={{ left: BX + INSET, top: INSET }}
          width={SCREEN_W}
          height={SCREEN_H}
          viewBox={`0 0 ${SCREEN_W} ${SCREEN_H}`}
          aria-hidden="true"
        >
          <defs>
            <linearGradient id={id("softbox")} x1="0" y1="0" x2="1" y2="0.62">
              <stop offset="0" stopColor="#fff" stopOpacity="0.16" />
              <stop offset="0.2" stopColor="#fff" stopOpacity="0.06" />
              <stop offset="0.36" stopColor="#fff" stopOpacity="0" />
              <stop offset="0.62" stopColor="#fff" stopOpacity="0" />
              <stop offset="0.7" stopColor="#fff" stopOpacity="0.035" />
              <stop offset="0.78" stopColor="#fff" stopOpacity="0" />
            </linearGradient>
            <radialGradient id={id("bloom")} cx="0.08" cy="-0.04" r="0.75">
              <stop offset="0" stopColor="#fff" stopOpacity="0.14" />
              <stop offset="1" stopColor="#fff" stopOpacity="0" />
            </radialGradient>
            <linearGradient id={id("falloff")} x1="0" y1="0" x2="0" y2="1">
              <stop offset="0.72" stopColor="#000" stopOpacity="0" />
              <stop offset="1" stopColor="#000" stopOpacity="0.06" />
            </linearGradient>
          </defs>
          <path d={SCREEN_PATH} fill={`url(#${id("softbox")})`} className={s.glassLight} />
          <path d={SCREEN_PATH} fill={`url(#${id("bloom")})`} className={s.glassLight} />
          <path d={SCREEN_PATH} fill={`url(#${id("falloff")})`} />
          <path d={SCREEN_PATH} fill="none" stroke="rgba(255,255,255,0.15)" strokeWidth="1" />
        </svg>
      </div>
    </div>
  );
}
