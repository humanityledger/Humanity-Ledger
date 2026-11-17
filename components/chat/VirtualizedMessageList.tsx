'use client';
import React, { useEffect, useLayoutEffect, useRef, useMemo, useCallback, useState } from 'react';
import { REVEAL_MESSAGE_EVENT } from '@/lib/chat/reveal-message';
import { renderKey } from '@/lib/chat/optimistic-send';
import { PeerTypingLottie } from '@/components/chat/ChatLottie';

interface VirtualizedMessageListProps {
  messages: any[];
  activePeer: string;
  myAddress: string;
  clientInboxId?: string;
  /** `enter`: play the entrance (a message that arrived or was sent while this chat is open, once). */
  renderMessage: (msg: any, isMe: boolean, enter: boolean) => React.ReactNode;
  onLoadMore: () => void;
  isLoadingMore: boolean;
  isTyping?: boolean;
  typingLabel?: string;
  isSending?: boolean;
}

/**
 * Windowing. A long conversation used to mount every bubble (thousands of DOM nodes and React
 * fibers on a mid-range phone). Only the newest WINDOW messages are mounted; when the reader
 * scrolls near the top, the next STEP older ones are mounted and the scroll position is kept, so
 * the content does not jump. Opening another conversation starts from the newest window again.
 * Bubbles have variable heights (media, polls, payments), so the window grows from the end
 * instead of measuring rows; no dependency is added (IntersectionObserver only).
 */
export const MESSAGE_WINDOW = 60;
export const MESSAGE_WINDOW_STEP = 40;

/**
 * Entrance animation, decided once per render key. A message animates when it is newer than the
 * moment this conversation was opened (sent or received live; history loaded later does not), and
 * only within ENTER_WINDOW_MS of that decision: a later remount (the window grows, the chat is
 * reopened) never plays it again.
 */
const ENTER_WINDOW_MS = 600;
const msgTimeMs = (m: any) => {
  const t = Number(m?.sentAtNs ?? 0);
  return t > 1e14 ? t / 1e6 : t;
};

const MemoizedMessageRow = React.memo(({
  msg,
  myAddressLower,
  clientInboxIdLower,
  renderMessage,
  enter,
}: {
  msg: any;
  myAddressLower: string;
  clientInboxIdLower: string;
  renderMessage: (msg: any, isMe: boolean, enter: boolean) => React.ReactNode;
  enter: boolean;
}) => {
  const senderLower = (msg.senderInboxId ?? '').toLowerCase();
  const isMe =
    (typeof msg.isMe === 'boolean' ? msg.isMe : false) ||
    (typeof msg.fromPeer === 'boolean' ? !msg.fromPeer : false) ||
    (clientInboxIdLower && !!senderLower && senderLower === clientInboxIdLower) ||
    (!!senderLower && senderLower === myAddressLower) ||
    (!!msg.senderAddress && msg.senderAddress.toLowerCase() === myAddressLower);

  return (
    <div className="w-full pb-1">
      {renderMessage(msg, isMe, enter)}
    </div>
  );
}, (prev, next) =>
  prev.enter === next.enter &&
  prev.msg.id === next.msg.id &&
  prev.msg.status === next.msg.status &&
  prev.msg.failed === next.msg.failed &&
  prev.msg.reactions === next.msg.reactions
);
MemoizedMessageRow.displayName = 'MemoizedMessageRow';

export const VirtualizedMessageList: React.FC<VirtualizedMessageListProps> = ({
  messages,
  activePeer,
  myAddress,
  clientInboxId,
  renderMessage,
  onLoadMore,
  isLoadingMore,
  isTyping,
  typingLabel,
  isSending,
}) => {
  const scrollRef = useRef<HTMLDivElement>(null);
  const topSentinelRef = useRef<HTMLDivElement>(null);
  const isNearBottomRef = useRef(true);
  /** scrollHeight before older messages were mounted, to keep the reader's place. */
  const anchorRef = useRef<number | null>(null);
  const [windowSize, setWindowSize] = useState(MESSAGE_WINDOW);

  const myAddressLower = useMemo(() => myAddress.toLowerCase(), [myAddress]);
  const clientInboxIdLower = useMemo(() => (clientInboxId ?? '').toLowerCase(), [clientInboxId]);

  // Entrance decisions: render key -> time it was decided to animate (absent: never animates).
  const openedAtRef = useRef(Date.now());
  const enterRef = useRef<Map<string, number>>(new Map());
  const decidedRef = useRef<Set<string>>(new Set());
  const shouldEnter = (msg: any): boolean => {
    const key = renderKey(msg);
    if (!decidedRef.current.has(key)) {
      decidedRef.current.add(key);
      if (msgTimeMs(msg) >= openedAtRef.current - 1500) enterRef.current.set(key, Date.now());
    }
    const at = enterRef.current.get(key);
    return at !== undefined && Date.now() - at < ENTER_WINDOW_MS;
  };

  // Another conversation: back to the newest window, nothing in it animates.
  useEffect(() => {
    setWindowSize(MESSAGE_WINDOW);
    isNearBottomRef.current = true;
    openedAtRef.current = Date.now();
    enterRef.current.clear();
    decidedRef.current.clear();
  }, [activePeer]);

  // The list's own height changes (keyboard opening, composer growing, panel above): a reader at the
  // bottom stays at the bottom, without a scroll animation.
  useEffect(() => {
    const el = scrollRef.current;
    if (!el || typeof ResizeObserver === 'undefined') return;
    const ro = new ResizeObserver(() => {
      if (isNearBottomRef.current) el.scrollTop = el.scrollHeight;
    });
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  const hiddenCount = Math.max(0, messages.length - windowSize);
  const visible = useMemo(() => (hiddenCount > 0 ? messages.slice(hiddenCount) : messages), [messages, hiddenCount]);

  const showOlder = useCallback(() => {
    const el = scrollRef.current;
    if (!el) return;
    anchorRef.current = el.scrollHeight;
    setWindowSize((w) => w + MESSAGE_WINDOW_STEP);
  }, []);

  // Jump to a message that is not mounted (search, pinned, saved, reply quote): mount up to it.
  const messagesRef = useRef(messages);
  messagesRef.current = messages;
  useEffect(() => {
    const onReveal = (e: Event) => {
      const id = (e as CustomEvent<{ id?: string }>).detail?.id;
      if (!id) return;
      const list = messagesRef.current;
      const index = list.findIndex((m) => m?.id === id);
      if (index < 0) return;
      setWindowSize((w) => Math.max(w, list.length - index + 10));
    };
    window.addEventListener(REVEAL_MESSAGE_EVENT, onReveal);
    return () => window.removeEventListener(REVEAL_MESSAGE_EVENT, onReveal);
  }, []);

  // Mount older messages when the top sentinel comes into view.
  useEffect(() => {
    const root = scrollRef.current;
    const sentinel = topSentinelRef.current;
    if (!root || !sentinel || hiddenCount === 0 || typeof IntersectionObserver === 'undefined') return;
    const io = new IntersectionObserver(
      (entries) => {
        if (entries.some((e) => e.isIntersecting)) showOlder();
      },
      { root, rootMargin: '400px 0px 0px 0px' },
    );
    io.observe(sentinel);
    return () => io.disconnect();
  }, [hiddenCount, showOlder]);

  // Keep the reader's place after older messages were mounted above.
  useLayoutEffect(() => {
    const el = scrollRef.current;
    if (!el || anchorRef.current === null) return;
    el.scrollTop += el.scrollHeight - anchorRef.current;
    anchorRef.current = null;
  }, [windowSize]);

  const handleScroll = useCallback(() => {
    if (!scrollRef.current) return;
    const { scrollTop, scrollHeight, clientHeight } = scrollRef.current;
    isNearBottomRef.current = scrollHeight - scrollTop - clientHeight < 120;
    if (scrollTop < 60 && !isLoadingMore && hiddenCount === 0) {
      onLoadMore();
    }
  }, [isLoadingMore, onLoadMore, hiddenCount]);

  // Rock-solid container-only scroll to bottom — never uses scrollIntoView
  // which can cause ancestor layout shifts or jumpy scrolling on webkit/blink.
  useLayoutEffect(() => {
    if (!scrollRef.current) return;
    const container = scrollRef.current;
    const lastMsg = messages[messages.length - 1];
    const isMe = lastMsg && (
      lastMsg.isMe ||
      lastMsg.senderAddress?.toLowerCase() === myAddressLower ||
      (clientInboxIdLower && lastMsg.senderInboxId?.toLowerCase() === clientInboxIdLower)
    );

    // Auto-scroll if user is already looking at the bottom, or if this user just sent a message
    if (isNearBottomRef.current || isMe) {
      // One jump to the end, no smooth scroll: the new bubble itself rises into place (transform),
      // so a scroll animation on top of it would be a second motion. Runs before paint (layout
      // effect), so the new bubble is never drawn below the fold first. A second pass on the next
      // frame covers a badge or image that changed the height meanwhile (no-op otherwise).
      container.scrollTop = container.scrollHeight;
      isNearBottomRef.current = true;
      const raf = requestAnimationFrame(() => { container.scrollTop = container.scrollHeight; });
      return () => cancelAnimationFrame(raf);
    }
  }, [messages.length, activePeer, isTyping, isSending, myAddressLower, clientInboxIdLower]);

  return (
    <div
      ref={scrollRef}
      onScroll={handleScroll}
      className="flex-1 overflow-y-auto overscroll-contain flex flex-col px-3 py-4 sm:px-5 lg:px-8 space-y-2"
      style={{ WebkitOverflowScrolling: 'touch' }}
    >
      {hiddenCount > 0 && (
        <div ref={topSentinelRef} className="w-full flex justify-center shrink-0">
          <button
            type="button"
            onClick={showOlder}
            className="min-h-[44px] px-4 text-[12px] font-medium text-[#727A88] hover:text-[#15171C] transition-colors duration-150 ease-out"
          >
            {hiddenCount} earlier {hiddenCount === 1 ? 'message' : 'messages'}
          </button>
        </div>
      )}
      {isLoadingMore && (
        <div className="h-10 w-full flex items-center justify-center shrink-0" role="status">
          <div className="text-xs text-black/40 font-medium">Loading previous messages…</div>
        </div>
      )}
      {visible.map((msg: any) => (
        <MemoizedMessageRow
          // Stable from the optimistic insert to the confirmed copy (renderKey): never remounts on send.
          key={renderKey(msg)}
          msg={msg}
          myAddressLower={myAddressLower}
          clientInboxIdLower={clientInboxIdLower}
          renderMessage={renderMessage}
          enter={shouldEnter(msg)}
        />
      ))}

      {/* Typing indicator inside the scroll flow to avoid compressing list height */}
      {isTyping && (
        <div className="hl-fade-in flex self-start items-start mt-2 ml-1" role="status" aria-label={typingLabel || "Typing"} data-testid="peer-typing">
          {/* The animation draws its own grey bubble with the three dots. */}
          <PeerTypingLottie />
        </div>
      )}

      {/* Sending micro-status inside the scroll flow */}
      {isSending && (
        <div className="flex self-end items-center gap-1.5 mt-1 mr-2 text-[12px] text-[#727a88]" role="status">
          <span className="w-1.5 h-1.5 rounded-full bg-[#727a88]" aria-hidden="true" />
          <span>Sending</span>
        </div>
      )}

      <div className="h-1 shrink-0" />
    </div>
  );
};
