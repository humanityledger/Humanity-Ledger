"use client";

import React, { useCallback, useRef, useState } from "react";
import {
  motion,
  useAnimation,
  AnimatePresence,
  PanInfo,
} from "framer-motion";
import { Archive, BellOff, Trash2, Pin, CheckCheck } from "lucide-react";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

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

type RevealSide = "left" | "right" | "none";

// ---------------------------------------------------------------------------
// Action definitions with Dynamic Island styling
// ---------------------------------------------------------------------------

interface ActionDef {
  id: string;
  label: string;
  Icon: React.ElementType;
  color: string;
  gradient: string;
  side: RevealSide;
}

const LEFT_ACTIONS: ActionDef[] = [
  {
    id: "archive",
    label: "Archive",
    Icon: Archive,
    color: "#3b82f6",
    gradient: "linear-gradient(135deg, #2563eb 0%, #3b82f6 100%)",
    side: "left",
  },
  {
    id: "mute",
    label: "Mute",
    Icon: BellOff,
    color: "#6b7280",
    gradient: "linear-gradient(135deg, #4b5563 0%, #6b7280 100%)",
    side: "left",
  },
  {
    id: "delete",
    label: "Delete",
    Icon: Trash2,
    color: "#ef4444",
    gradient: "linear-gradient(135deg, #dc2626 0%, #ef4444 100%)",
    side: "left",
  },
];

const RIGHT_ACTIONS: ActionDef[] = [
  {
    id: "pin",
    label: "Pin",
    Icon: Pin,
    color: "#f59e0b",
    gradient: "linear-gradient(135deg, #d97706 0%, #f59e0b 100%)",
    side: "right",
  },
  {
    id: "markasread",
    label: "Read",
    Icon: CheckCheck,
    color: "#10b981",
    gradient: "linear-gradient(135deg, #059669 0%, #10b981 100%)",
    side: "right",
  },
];

// Drag constraint constants. A full swipe stops here. It never runs the action.
const DRAG_LEFT_MAX = -175;
const DRAG_RIGHT_MAX = 120;
const LEFT_THRESHOLD = -55;
const RIGHT_THRESHOLD = 45;
const EASE: [number, number, number, number] = [0.22, 1, 0.36, 1];
const SETTLE = { duration: 0.32, ease: EASE };

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export default function SwipeableConversationRow({
  peerAddress: _peerAddress,
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
  const controls = useAnimation();
  const [revealSide, setRevealSide] = useState<RevealSide>("none");
  const [isDragging, setIsDragging] = useState(false);
  const hasVibratedRef = useRef(false);
  const suppressClickRef = useRef(false);

  // Map action id to callback
  const callbackMap: Record<string, (() => void) | undefined> = {
    archive: onArchive,
    mute: onMute,
    delete: onDelete,
    pin: onPin,
    markasread: onMarkAsRead,
  };

  // -------------------------------------------------------------------------
  // Action handler with Dynamic Island pulse
  // -------------------------------------------------------------------------

  const handleAction = useCallback(
    (actionId: string, actionLabel: string, callback?: () => void) => {
      callback?.();

      // Feedback comes from the action itself (a toast). The Dynamic Island is
      // kept for live activity (calls, recording), not for confirming a tap.

      // Snap row back to center with spring
      controls.start({ x: 0, transition: SETTLE });
      setRevealSide("none");
    },
    [controls]
  );

  // -------------------------------------------------------------------------
  // Drag callbacks
  // -------------------------------------------------------------------------

  const onDragStart = useCallback(() => {
    setIsDragging(true);
    suppressClickRef.current = false;
  }, []);

  const onDrag = useCallback(
    (_e: MouseEvent | TouchEvent | PointerEvent, info: PanInfo) => {
      const x = info.offset.x;
      if (Math.abs(x) > 8) suppressClickRef.current = true;
      const crossedNormal = x < LEFT_THRESHOLD || x > RIGHT_THRESHOLD;

      if (crossedNormal && !hasVibratedRef.current) {
        navigator.vibrate?.(12);
        hasVibratedRef.current = true;
      }
      if (!crossedNormal) hasVibratedRef.current = false;

      if (x < LEFT_THRESHOLD) setRevealSide("left");
      else if (x > RIGHT_THRESHOLD) setRevealSide("right");
      else setRevealSide("none");
    },
    []
  );

  const onDragEnd = useCallback(
    (_e: MouseEvent | TouchEvent | PointerEvent, info: PanInfo) => {
      setIsDragging(false);
      const x = info.offset.x;
      hasVibratedRef.current = false;

      // Stop on the revealed actions. The person taps one to run it.
      if (x < LEFT_THRESHOLD) {
        setRevealSide("left");
        controls.start({ x: DRAG_LEFT_MAX, transition: SETTLE });
        return;
      }

      if (x > RIGHT_THRESHOLD) {
        setRevealSide("right");
        controls.start({ x: DRAG_RIGHT_MAX, transition: SETTLE });
        return;
      }

      setRevealSide("none");
      controls.start({ x: 0, transition: SETTLE });
    },
    [controls]
  );

  // -------------------------------------------------------------------------
  // Render Dynamic Island Action Pill
  // -------------------------------------------------------------------------

  const renderIslandActions = (actions: ActionDef[], from: number) => (
    <motion.div
      initial={{ opacity: 0, x: from }}
      animate={{ opacity: 1, x: 0 }}
      exit={{ opacity: 0, x: from }}
      transition={{ duration: 0.28, ease: EASE }}
      className="flex items-center gap-1.5 px-2 py-1.5 bg-[#121316]/95 backdrop-blur-2xl rounded-full border border-white/10 shadow-[0_8px_32px_rgba(0,0,0,0.4)] ring-1 ring-white/10"
    >
      {actions.map((action) => (
        <motion.button
          key={action.id}
          whileTap={{ scale: 0.96 }}
          transition={{ duration: 0.16, ease: EASE }}
          className="relative flex flex-col items-center justify-center w-11 h-11 rounded-full text-white shadow-md transition-all overflow-hidden group select-none"
          style={{
            background: action.gradient,
            boxShadow: `0 4px 14px ${action.color}45`,
          }}
          onClick={() =>
            handleAction(action.id, action.label, callbackMap[action.id])
          }
          aria-label={action.label}
        >
          <action.Icon
            size={16}
            strokeWidth={2.4}
            className="transition-transform group-hover:scale-110"
          />
          <span className="text-[8.5px] font-bold tracking-tight mt-0.5 leading-none opacity-95">
            {action.label}
          </span>
        </motion.button>
      ))}
    </motion.div>
  );

  // -------------------------------------------------------------------------
  // Render
  // -------------------------------------------------------------------------

  return (
    <div className="relative overflow-hidden bg-[#f7f8fa] border-b border-black/[0.04]">
      {/* Left Dynamic Island capsule (revealed when swiped left) */}
      <AnimatePresence>
        {revealSide === "left" && (
          <div className="absolute inset-y-0 right-3 flex items-center justify-center z-0 pointer-events-auto">
            {renderIslandActions(LEFT_ACTIONS, 10)}
          </div>
        )}
      </AnimatePresence>

      {/* Right Dynamic Island capsule (revealed when swiped right) */}
      <AnimatePresence>
        {revealSide === "right" && (
          <div className="absolute inset-y-0 left-3 flex items-center justify-center z-0 pointer-events-auto">
            {renderIslandActions(RIGHT_ACTIONS, -10)}
          </div>
        )}
      </AnimatePresence>

      {/* Draggable contact row with lift elevation & dynamic corner smoothing */}
      <motion.div
        drag="x"
        dragConstraints={{ left: DRAG_LEFT_MAX, right: DRAG_RIGHT_MAX }}
        dragElastic={0}
        dragMomentum={false}
        animate={controls}
        onDragStart={onDragStart}
        onDrag={onDrag}
        onDragEnd={onDragEnd}
        onClickCapture={(e) => {
          if (!suppressClickRef.current) return;
          suppressClickRef.current = false;
          e.preventDefault();
          e.stopPropagation();
        }}
        className={`relative z-10 will-change-transform bg-white transition-shadow duration-200 ${
          isDragging || revealSide !== "none"
            ? "shadow-md rounded-2xl"
            : "rounded-none"
        }`}
        style={{ touchAction: "pan-y" }}
        data-pinned={isPinned}
        data-muted={isMuted}
      >
        {children}
      </motion.div>
    </div>
  );
}
