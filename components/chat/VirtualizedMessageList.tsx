'use client';
import React, { useEffect, useRef, useMemo, useCallback } from 'react';
import { LoaderCircle } from 'lucide-react';

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
  const bottomRef = useRef<HTMLDivElement>(null);
  const isNearBottomRef = useRef(true);
  
  const myAddressLower = useMemo(() => myAddress.toLowerCase(), [myAddress]);
  const clientInboxIdLower = useMemo(() => (clientInboxId ?? '').toLowerCase(), [clientInboxId]);

  const handleScroll = useCallback(() => {
    if (!scrollRef.current) return;
    const { scrollTop, scrollHeight, clientHeight } = scrollRef.current;
    isNearBottomRef.current = scrollHeight - scrollTop - clientHeight < 120;
    if (scrollTop < 60 && !isLoadingMore) {
      onLoadMore();
    }
  }, [isLoadingMore, onLoadMore]);

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
      className="flex-1 overflow-y-auto overscroll-contain flex flex-col p-4 space-y-2"
      style={{ WebkitOverflowScrolling: 'touch' }}
    >
      {isLoadingMore && (
        <div className="h-10 w-full flex items-center justify-center shrink-0">
          <div className="text-xs text-black/40 animate-pulse font-medium">Loading previous messages...</div>
        </div>
      )}
      {messages.map((msg: any) => (
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
          <div className="px-4 py-2.5 bg-white rounded-[18px] rounded-bl-[6px] border border-[#e4e7ec] flex items-center gap-1.5 shadow-[0_1px_2px_rgba(16,24,40,0.04)]">
            <div className="w-1.5 h-1.5 bg-[#a3a9b4] rounded-full animate-bounce" style={{ animationDelay: '0ms' }} />
            <div className="w-1.5 h-1.5 bg-[#a3a9b4] rounded-full animate-bounce" style={{ animationDelay: '150ms' }} />
            <div className="w-1.5 h-1.5 bg-[#a3a9b4] rounded-full animate-bounce" style={{ animationDelay: '300ms' }} />
          </div>
        </div>
      )}

      {/* Sending micro-status inside the scroll flow */}
      {isSending && (
        <div className="flex self-end items-center gap-1.5 mt-1 mr-2 text-[12px] text-[#727a88]" role="status">
          <LoaderCircle size={12} strokeWidth={2.2} className="animate-spin text-[#2754d6]" aria-hidden="true" />
          <span>Sending</span>
        </div>
      )}

      <div ref={bottomRef} className="h-1 shrink-0" />
    </div>
  );
};
