'use client';
import React, { useEffect, useLayoutEffect, useRef, useMemo, useCallback, useState } from 'react';
import { REVEAL_MESSAGE_EVENT } from '@/lib/chat/reveal-message';

interface VirtualizedMessageListProps {
  messages: any[];
  activePeer: string;
  myAddress: string;
  clientInboxId?: string;
  renderMessage: (msg: any, isMe: boolean) => React.ReactNode;
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

const MemoizedMessageRow = React.memo(({
  msg,
  myAddressLower,
  clientInboxIdLower,
  renderMessage
}: {
  msg: any;
  myAddressLower: string;
  clientInboxIdLower: string;
  renderMessage: (msg: any, isMe: boolean) => React.ReactNode;
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
      {renderMessage(msg, isMe)}
    </div>
  );
}, (prev, next) =>
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

  // Another conversation: back to the newest window.
  useEffect(() => {
    setWindowSize(MESSAGE_WINDOW);
    isNearBottomRef.current = true;
  }, [activePeer]);

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
  useEffect(() => {
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
      container.scrollTop = container.scrollHeight;
      // Secondary RAF pass to ensure layout after media/badge paint
      const raf = requestAnimationFrame(() => {
        if (container) {
          container.scrollTop = container.scrollHeight;
        }
      });
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
          key={msg.id}
          msg={msg}
          myAddressLower={myAddressLower}
          clientInboxIdLower={clientInboxIdLower}
          renderMessage={renderMessage}
        />
      ))}

      {/* Typing indicator inside the scroll flow to avoid compressing list height */}
      {isTyping && (
        <div className="flex self-start items-start mt-2 ml-1" role="status" aria-label={typingLabel || "Typing"}>
          <div className="px-4 py-2.5 bg-white rounded-[18px] rounded-bl-[6px] border border-[#e4e7ec] flex items-center gap-1.5">
            <div className="w-1.5 h-1.5 bg-[#a3a9b4] rounded-full" />
            <div className="w-1.5 h-1.5 bg-[#a3a9b4] rounded-full" />
            <div className="w-1.5 h-1.5 bg-[#a3a9b4] rounded-full" />
          </div>
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
