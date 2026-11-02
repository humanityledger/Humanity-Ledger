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
// Action definitions
// ---------------------------------------------------------------------------

interface ActionDef {
  id: string;
  label: string;
  Icon: React.ElementType;
  color: string;
  side: RevealSide;
}

const LEFT_ACTIONS: ActionDef[] = [
  { id: "archive", label: "Archive", Icon: Archive, color: "#3b82f6", side: "left" },
  { id: "mute",    label: "Mute",    Icon: BellOff,  color: "#6b7280", side: "left" },
  { id: "delete",  label: "Delete",  Icon: Trash2,   color: "#ef4444", side: "left" },
];

const RIGHT_ACTIONS: ActionDef[] = [
  { id: "pin",         label: "Pin",          Icon: Pin,       color: "#f59e0b", side: "right" },
  { id: "markasread",  label: "Mark as Read", Icon: CheckCheck, color: "#10b981", side: "right" },
];

// Drag constraint constants (px)
const DRAG_LEFT_MAX  = -160;
const DRAG_RIGHT_MAX =  80;
const LEFT_THRESHOLD  = -60;
const RIGHT_THRESHOLD =  40;

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
  isPinned  = false,
  isMuted   = false,
}: SwipeableConversationRowProps) {
  const controls = useAnimation();
  const { setState: setIslandState } = useDynamicIsland();
  const [revealSide, setRevealSide] = useState<RevealSide>("none");
  const hasVibratedRef = useRef(false);

  // -------------------------------------------------------------------------
  // Action handler factory
  // -------------------------------------------------------------------------

  const handleAction = useCallback(
    (actionId: string, actionLabel: string, callback?: () => void) => {
      callback?.();
      setIslandState(
        "notification",
        { title: actionLabel, subtitle: displayName },
        2000
      );
      // Snap row back to center
      controls.start({ x: 0, transition: { type: "spring", stiffness: 400, damping: 35 } });
      setRevealSide("none");
    },
    [controls, displayName, setIslandState]
  );

  // Map action id to callback
  const callbackMap: Record<string, (() => void) | undefined> = {
    archive:    onArchive,
    mute:       onMute,
    delete:     onDelete,
    pin:        onPin,
    markasread: onMarkAsRead,
  };

  // -------------------------------------------------------------------------
  // Drag callbacks
  // -------------------------------------------------------------------------

  const onDrag = useCallback(
    (_e: MouseEvent | TouchEvent | PointerEvent, info: PanInfo) => {
      const x = info.offset.x;
      const crossedThreshold =
        x < LEFT_THRESHOLD || x > RIGHT_THRESHOLD;

      if (crossedThreshold && !hasVibratedRef.current) {
        navigator.vibrate?.(50);
        hasVibratedRef.current = true;
      }
      if (!crossedThreshold) {
        hasVibratedRef.current = false;
      }
    },
    []
  );

  const onDragEnd = useCallback(
    (_e: MouseEvent | TouchEvent | PointerEvent, info: PanInfo) => {
      const x = info.offset.x;
      hasVibratedRef.current = false;

      if (x < LEFT_THRESHOLD) {
        setRevealSide("left");
        // Snap to left reveal position
        controls.start({
          x: DRAG_LEFT_MAX,
          transition: { type: "spring", stiffness: 380, damping: 30 },
        });
        return;
      }

      if (x > RIGHT_THRESHOLD) {
        setRevealSide("right");
        // Snap to right reveal position
        controls.start({
          x: DRAG_RIGHT_MAX,
          transition: { type: "spring", stiffness: 380, damping: 30 },
        });
        return;
      }

      // Insufficient swipe — snap back
      setRevealSide("none");
      controls.start({
        x: 0,
        transition: { type: "spring", stiffness: 400, damping: 35 },
      });
    },
    [controls]
  );

  // -------------------------------------------------------------------------
  // Render action strip
  // -------------------------------------------------------------------------

  const renderActions = (actions: ActionDef[]) =>
    actions.map((action, idx) => (
      <motion.button
        key={action.id}
        initial={{ opacity: 0, scale: 0.75 }}
        animate={{ opacity: 1, scale: 1 }}
        exit={{ opacity: 0, scale: 0.75 }}
        transition={{
          type: "spring",
          stiffness: 420,
          damping: 28,
          delay: idx * 0.04,
        }}
        className="flex flex-col items-center justify-center gap-1 h-full px-4 min-w-[52px] select-none"
        style={{ backgroundColor: action.color }}
        onClick={() =>
          handleAction(action.id, action.label, callbackMap[action.id])
        }
        aria-label={action.label}
      >
        <action.Icon size={20} className="text-white" strokeWidth={2} />
        <span className="text-white text-[10px] font-semibold leading-none">
          {action.label}
        </span>
      </motion.button>
    ));

  // -------------------------------------------------------------------------
  // Render
  // -------------------------------------------------------------------------

  return (
    <div className="relative overflow-hidden">
      {/* Left action strip (visible when swiped left) */}
      <AnimatePresence>
        {revealSide === "left" && (
          <motion.div
            key="left-actions"
            className="absolute inset-y-0 right-0 flex flex-row items-stretch"
            style={{ width: Math.abs(DRAG_LEFT_MAX) }}
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
          >
            {renderActions(LEFT_ACTIONS)}
          </motion.div>
        )}
      </AnimatePresence>

      {/* Right action strip (visible when swiped right) */}
      <AnimatePresence>
        {revealSide === "right" && (
          <motion.div
            key="right-actions"
            className="absolute inset-y-0 left-0 flex flex-row items-stretch"
            style={{ width: DRAG_RIGHT_MAX }}
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
          >
            {renderActions(RIGHT_ACTIONS)}
          </motion.div>
        )}
      </AnimatePresence>

      {/* Draggable row */}
      <motion.div
        drag="x"
        dragConstraints={{ left: DRAG_LEFT_MAX, right: DRAG_RIGHT_MAX }}
        dragElastic={{ left: 0.15, right: 0.15 }}
        animate={controls}
        onDrag={onDrag}
        onDragEnd={onDragEnd}
        className="relative z-10 will-change-transform"
        style={{ touchAction: "pan-y" }}
        // Expose state as data attributes for external styling hooks
        data-pinned={isPinned}
        data-muted={isMuted}
      >
        {children}
      </motion.div>
    </div>
  );
}
