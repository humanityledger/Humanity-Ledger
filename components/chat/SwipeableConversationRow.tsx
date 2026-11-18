"use client";

/**
 * components/chat/SwipeableConversationRow.tsx
 *
 * A conversation in the list that slides to show its actions in a small dark capsule (the
 * "island"): right for Pin and Read, left for Archive, Mute and Delete.
 *
 * How it behaves:
 *   - The row follows the finger. The island grows out of the edge as the row moves, each action
 *     appearing in turn, so what will be shown is visible before letting go.
 *   - On release the row settles in exactly one of three places: closed (centred), open on the
 *     left, or open on the right. The distance and the speed of the gesture decide which; it never
 *     stays halfway.
 *   - A swipe never runs an action. It stops on the actions. The person taps one to run it.
 *   - An open row closes on: a tap on the row (which then does not open the chat), a tap anywhere
 *     else, scrolling the list, Escape, or another row opening. Only one row is open at a time.
 *   - With reduced motion the row moves without the spring.
 *   - Only on touch screens. With a mouse the row does not slide: right click opens the same actions.
 */

import React, { useCallback, useEffect, useRef, useState } from "react";
import {
  motion,
  animate,
  useMotionValue,
  useTransform,
  useReducedMotion,
  type MotionValue,
  type PanInfo,
} from "framer-motion";
import { Archive, BellOff, Bell, Trash2, Pin, PinOff, CheckCheck } from "lucide-react";

export interface SwipeableConversationRowProps {
  peerAddress: string;
  displayName: string;
  children: React.ReactNode;
  onArchive?: () => void;
  onMute?: () => void;
  onDelete?: () => void;
  onPin?: () => void;
  onMarkAsRead?: () => void;
  isPinned?: boolean;
  isMuted?: boolean;
}

type Side = "left" | "right";

interface Action {
  id: string;
  label: string;
  Icon: React.ElementType;
  color: string;
  run?: () => void;
}

/* Island geometry: 36 px buttons, 6 px apart, 5 px padding, 10 px from the row's edge. */
const BTN = 36;
const GAP = 6;
const PAD = 5;
const EDGE = 10;
const trayWidth = (n: number) => n * BTN + (n - 1) * GAP + 2 * PAD + 2 * EDGE;

const SPRING = { type: "spring" as const, stiffness: 560, damping: 44, mass: 0.9 };
const INSTANT = { duration: 0.12 };

/** One open row at a time: opening a row closes the previous one. */
let closeOpenRow: (() => void) | null = null;

export default function SwipeableConversationRow({
  displayName,
  children,
  onArchive,
  onMute,
  onDelete,
  onPin,
  onMarkAsRead,
  isPinned = false,
  isMuted = false,
}: SwipeableConversationRowProps) {
  const reduced = useReducedMotion();
  // Touch screens slide; a mouse uses right click (the list's own menu) instead.
  const [touch, setTouch] = useState(false);
  useEffect(() => {
    if (typeof window === 'undefined' || !window.matchMedia) return;
    const q = window.matchMedia('(pointer: coarse)');
    const on = () => setTouch(q.matches);
    on();
    q.addEventListener?.('change', on);
    return () => q.removeEventListener?.('change', on);
  }, []);
  const x = useMotionValue(0);
  const rowRef = useRef<HTMLDivElement>(null);
  const [open, setOpen] = useState<Side | null>(null);
  const openRef = useRef<Side | null>(null);
  const dragged = useRef(false);
  const ticked = useRef(false);

  const right: Action[] = [
    { id: "pin", label: isPinned ? "Unpin" : "Pin", Icon: isPinned ? PinOff : Pin, color: "#c27803", run: onPin },
    { id: "read", label: "Mark as read", Icon: CheckCheck, color: "#1f7a4d", run: onMarkAsRead },
  ].filter((a) => a.run);
  const left: Action[] = [
    { id: "archive", label: "Archive", Icon: Archive, color: "#2456e6", run: onArchive },
    { id: "mute", label: isMuted ? "Unmute" : "Mute", Icon: isMuted ? Bell : BellOff, color: "#4a505c", run: onMute },
    { id: "delete", label: "Delete", Icon: Trash2, color: "#d93036", run: onDelete },
  ].filter((a) => a.run);

  const RIGHT_W = right.length ? trayWidth(right.length) : 0;
  const LEFT_W = left.length ? trayWidth(left.length) : 0;

  // Stable reference for the "one open row" registry; it always closes with the latest settle.
  const closeRef = useRef<() => void>(() => {});
  const close = useCallback(() => closeRef.current(), []);

  const settle = useCallback(
    (to: Side | null) => {
      const target = to === "right" ? RIGHT_W : to === "left" ? -LEFT_W : 0;
      animate(x, target, reduced ? INSTANT : SPRING);
      openRef.current = to;
      setOpen(to);
      if (to) {
        if (closeOpenRow && closeOpenRow !== close) closeOpenRow();
        closeOpenRow = close;
      } else if (closeOpenRow === close) {
        closeOpenRow = null;
      }
    },
    [LEFT_W, RIGHT_W, reduced, x, close],
  );
  closeRef.current = () => settle(null);

  // While open: a tap outside, a scroll of the list, or Escape closes the row.
  useEffect(() => {
    if (!open) return;
    const onDown = (e: PointerEvent) => {
      if (rowRef.current && !rowRef.current.contains(e.target as Node)) close();
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") close();
    };
    const onScroll = (e: Event) => {
      if (rowRef.current && e.target instanceof Node && e.target.contains(rowRef.current)) close();
    };
    document.addEventListener("pointerdown", onDown, true);
    document.addEventListener("keydown", onKey);
    document.addEventListener("scroll", onScroll, true);
    return () => {
      document.removeEventListener("pointerdown", onDown, true);
      document.removeEventListener("keydown", onKey);
      document.removeEventListener("scroll", onScroll, true);
    };
  }, [open, close]);

  useEffect(() => () => {
    if (closeOpenRow === close) closeOpenRow = null;
  }, [close]);

  const onDragStart = useCallback(() => {
    dragged.current = true;
    ticked.current = false;
  }, []);

  const onDrag = useCallback(() => {
    const v = x.get();
    const past = v > RIGHT_W * 0.5 || v < -LEFT_W * 0.5;
    if (past && !ticked.current) {
      navigator.vibrate?.(8);
      ticked.current = true;
    } else if (!past) {
      ticked.current = false;
    }
  }, [x, LEFT_W, RIGHT_W]);

  const onDragEnd = useCallback(
    (_e: MouseEvent | TouchEvent | PointerEvent, info: PanInfo) => {
      // Where the row would come to rest if the gesture carried on for 120 ms: a quick flick
      // opens, a quick flick back closes, a slow release goes to the nearest place.
      const projected = x.get() + info.velocity.x * 0.12;
      if (RIGHT_W && projected > RIGHT_W * 0.5) settle("right");
      else if (LEFT_W && projected < -LEFT_W * 0.5) settle("left");
      else settle(null);
    },
    [x, settle, LEFT_W, RIGHT_W],
  );

  const run = (a: Action) => {
    settle(null);
    // After the row has started closing, so the change (pin moves the row) does not jump.
    window.setTimeout(() => a.run?.(), reduced ? 0 : 140);
  };

  return (
    <div ref={rowRef} className="relative overflow-hidden bg-[#f2f4f7]" data-swipe-open={open ?? "none"}>
      {touch && RIGHT_W > 0 && <Island side="right" actions={right} width={RIGHT_W} x={x} interactive={open === "right"} onRun={run} name={displayName} />}
      {touch && LEFT_W > 0 && <Island side="left" actions={left} width={LEFT_W} x={x} interactive={open === "left"} onRun={run} name={displayName} />}

      <motion.div
        drag={touch ? "x" : false}
        dragDirectionLock
        dragConstraints={{ left: -LEFT_W, right: RIGHT_W }}
        dragElastic={0.12}
        dragMomentum={false}
        style={{ x, touchAction: "pan-y" }}
        onDragStart={onDragStart}
        onDrag={onDrag}
        onDragEnd={onDragEnd}
        onPointerDown={() => {
          dragged.current = false;
        }}
        onClickCapture={(e) => {
          // A drag never counts as a tap. A tap on an open row closes it instead of opening the chat.
          if (dragged.current) {
            dragged.current = false;
            e.preventDefault();
            e.stopPropagation();
            return;
          }
          if (openRef.current) {
            e.preventDefault();
            e.stopPropagation();
            settle(null);
          }
        }}
        className="relative z-10 bg-white will-change-transform"
        data-pinned={isPinned}
        data-muted={isMuted}
      >
        {children}
      </motion.div>
    </div>
  );
}

/**
 * The capsule behind the row. It is anchored to the edge the row uncovers and grows with the
 * row's offset: width, opacity and each button follow `x`, so it is never larger than the gap.
 */
function Island({
  side,
  actions,
  width,
  x,
  interactive,
  onRun,
  name,
}: {
  side: Side;
  actions: Action[];
  width: number;
  x: MotionValue<number>;
  interactive: boolean;
  onRun: (a: Action) => void;
  name: string;
}) {
  const sign = side === "right" ? 1 : -1;
  const reveal = useTransform(x, (v) => Math.max(0, Math.min(1, (sign * v) / width)));
  const capsule = width - 2 * EDGE;
  const capsuleWidth = useTransform(reveal, (r) => Math.max(BTN * 0.6, capsule * r));
  const opacity = useTransform(reveal, [0, 0.15, 0.45], [0, 0.6, 1]);

  return (
    <motion.div
      className={`absolute inset-y-0 z-0 flex items-center ${side === "right" ? "left-0 justify-start" : "right-0 justify-end"}`}
      style={{ width, paddingLeft: side === "right" ? EDGE : 0, paddingRight: side === "left" ? EDGE : 0, opacity, pointerEvents: interactive ? "auto" : "none" }}
      aria-hidden={!interactive}
    >
      {/* No black capsule behind the actions (18 Nov 2026): only the buttons, on the row background. */}
      <motion.div
        role="toolbar"
        aria-label={`Actions for ${name}`}
        className={`h-[46px] flex items-center ${side === "right" ? "justify-start" : "justify-end"}`}
        style={{ width: capsuleWidth, paddingLeft: PAD, paddingRight: PAD }}
      >
        <div className="flex items-center" style={{ gap: GAP }}>
          {actions.map((a, i) => (
            <IslandButton key={a.id} a={a} i={i} n={actions.length} side={side} reveal={reveal} interactive={interactive} onRun={onRun} />
          ))}
        </div>
      </motion.div>
    </motion.div>
  );
}

function IslandButton({
  a,
  i,
  n,
  side,
  reveal,
  interactive,
  onRun,
}: {
  a: Action;
  i: number;
  n: number;
  side: Side;
  reveal: MotionValue<number>;
  interactive: boolean;
  onRun: (a: Action) => void;
}) {
  // Buttons appear one after another from the edge the row uncovers.
  const order = side === "right" ? i : n - 1 - i;
  const start = 0.2 + (order / n) * 0.55;
  const scale = useTransform(reveal, [start, start + 0.25], [0.5, 1], { clamp: true });
  const opacity = useTransform(reveal, [start, start + 0.2], [0, 1], { clamp: true });
  return (
    <motion.button
      type="button"
      tabIndex={interactive ? 0 : -1}
      onClick={(e) => {
        e.stopPropagation();
        onRun(a);
      }}
      title={a.label}
      aria-label={a.label}
      className="shrink-0 rounded-full flex items-center justify-center text-white outline-none shadow-[0_4px_12px_-4px_rgba(16,24,40,0.35)] focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-[#15171c] active:brightness-90"
      style={{ width: BTN, height: BTN, background: a.color, scale, opacity }}
    >
      <a.Icon size={16} strokeWidth={2.2} aria-hidden="true" />
    </motion.button>
  );
}
