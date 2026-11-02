"use client";

import React, { useCallback, useRef, useState } from "react";
import {
  motion,
  useAnimation,
  AnimatePresence,
  PanInfo,
} from "framer-motion";
import { Archive, BellOff, Trash2, Pin, CheckCheck } from "lucide-react";
import { useDynamicIsland } from "@/lib/store/dynamic-island-store";

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

// Drag constraint constants
const DRAG_LEFT_MAX = -175;
const DRAG_RIGHT_MAX = 120;
const LEFT_THRESHOLD = -55;
const RIGHT_THRESHOLD = 45;
const DEEP_SWIPE_LEFT = -140;
const DEEP_SWIPE_RIGHT = 95;

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
  const { setState: setIslandState } = useDynamicIsland();
  const [revealSide, setRevealSide] = useState<RevealSide>("none");
  const [isDragging, setIsDragging] = useState(false);
  const [isPastDeepThreshold, setIsPastDeepThreshold] = useState(false);
  const hasVibratedRef = useRef(false);

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

      // Trigger the floating Dynamic Island notification
      setIslandState(
        "notification",
        {
          title: `${actionLabel} · ${displayName}`,
          subtitle: "Conversation updated",
          color:
            actionId === "archive"
              ? "#3b82f6"
              : actionId === "mute"
              ? "#6b7280"
              : actionId === "delete"
              ? "#ef4444"
              : actionId === "pin"
              ? "#f59e0b"
              : "#10b981",
        },
        2200
      );

      // Snap row back to center with spring
      controls.start({
        x: 0,
        transition: { type: "spring", stiffness: 420, damping: 32 },
      });
      setRevealSide("none");
      setIsPastDeepThreshold(false);
    },
    [controls, displayName, setIslandState]
  );

  // -------------------------------------------------------------------------
  // Drag callbacks
  // -------------------------------------------------------------------------

  const onDragStart = useCallback(() => {
    setIsDragging(true);
  }, []);

  const onDrag = useCallback(
    (_e: MouseEvent | TouchEvent | PointerEvent, info: PanInfo) => {
      const x = info.offset.x;
      const crossedNormal = x < LEFT_THRESHOLD || x > RIGHT_THRESHOLD;
      const crossedDeep = x < DEEP_SWIPE_LEFT || x > DEEP_SWIPE_RIGHT;

      if (crossedDeep !== isPastDeepThreshold) {
        setIsPastDeepThreshold(crossedDeep);
        if (crossedDeep && navigator.vibrate) {
          navigator.vibrate(40);
        }
      }

      if (crossedNormal && !hasVibratedRef.current) {
        navigator.vibrate?.(30);
        hasVibratedRef.current = true;
      }
      if (!crossedNormal) {
        hasVibratedRef.current = false;
      }

      if (x < LEFT_THRESHOLD) {
        setRevealSide("left");
      } else if (x > RIGHT_THRESHOLD) {
        setRevealSide("right");
      }
    },
    [isPastDeepThreshold]
  );

  const onDragEnd = useCallback(
    (_e: MouseEvent | TouchEvent | PointerEvent, info: PanInfo) => {
      setIsDragging(false);
      const x = info.offset.x;
      hasVibratedRef.current = false;

      // Deep full-swipe triggers primary action automatically (Telegram style)
      if (x < DEEP_SWIPE_LEFT) {
        handleAction("archive", "Archived", onArchive);
        return;
      }

      if (x > DEEP_SWIPE_RIGHT) {
        handleAction("pin", isPinned ? "Unpinned" : "Pinned", onPin);
        return;
      }

      // Medium swipe reveals Dynamic Island options
      if (x < LEFT_THRESHOLD) {
        setRevealSide("left");
        controls.start({
          x: DRAG_LEFT_MAX,
          transition: { type: "spring", stiffness: 400, damping: 28 },
        });
        return;
      }

      if (x > RIGHT_THRESHOLD) {
        setRevealSide("right");
        controls.start({
          x: DRAG_RIGHT_MAX,
          transition: { type: "spring", stiffness: 400, damping: 28 },
        });
        return;
      }

      // Insufficient swipe — snap back
      setRevealSide("none");
      setIsPastDeepThreshold(false);
      controls.start({
        x: 0,
        transition: { type: "spring", stiffness: 420, damping: 32 },
      });
    },
    [controls, handleAction, isPinned, onArchive, onPin]
  );

  // -------------------------------------------------------------------------
  // Render Dynamic Island Action Pill
  // -------------------------------------------------------------------------

  const renderIslandActions = (actions: ActionDef[]) => (
    <motion.div
      initial={{ opacity: 0, scale: 0.82, y: 0 }}
      animate={{ opacity: 1, scale: 1, y: 0 }}
      exit={{ opacity: 0, scale: 0.82, y: 0 }}
      transition={{ type: "spring", stiffness: 450, damping: 28 }}
      className="flex items-center gap-1.5 px-2 py-1.5 bg-[#121316]/95 backdrop-blur-2xl rounded-full border border-white/10 shadow-[0_8px_32px_rgba(0,0,0,0.4)] ring-1 ring-white/10"
    >
      {actions.map((action, idx) => (
        <motion.button
          key={action.id}
          whileHover={{ scale: 1.08 }}
          whileTap={{ scale: 0.92 }}
          initial={{ opacity: 0, scale: 0.7 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{
            type: "spring",
            stiffness: 450,
            damping: 26,
            delay: idx * 0.03,
          }}
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
            {renderIslandActions(LEFT_ACTIONS)}
          </div>
        )}
      </AnimatePresence>

      {/* Right Dynamic Island capsule (revealed when swiped right) */}
      <AnimatePresence>
        {revealSide === "right" && (
          <div className="absolute inset-y-0 left-3 flex items-center justify-center z-0 pointer-events-auto">
            {renderIslandActions(RIGHT_ACTIONS)}
          </div>
        )}
      </AnimatePresence>

      {/* Draggable contact row with lift elevation & dynamic corner smoothing */}
      <motion.div
        drag="x"
        dragConstraints={{ left: DRAG_LEFT_MAX, right: DRAG_RIGHT_MAX }}
        dragElastic={{ left: 0.2, right: 0.2 }}
        animate={controls}
        onDragStart={onDragStart}
        onDrag={onDrag}
        onDragEnd={onDragEnd}
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
