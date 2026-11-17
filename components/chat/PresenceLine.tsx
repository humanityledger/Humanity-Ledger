'use client';
import { PeerTypingLottie } from '@/components/chat/ChatLottie';
import React from 'react';

/**
 * The status line under a contact's name in the chat header: "typing…", "Online", or a last-seen /
 * fallback text. One line of fixed height that never changes the header's layout; a new text fades
 * in (opacity + 3 px rise, 150 ms, .hl-fade-in). Keyed by the text, so it only animates when the text
 * actually changes, never on an unrelated re-render.
 */
export function PresenceLine({ typing, online, idle }: { typing: boolean; online: boolean; idle: string }) {
  const text = typing ? 'typing…' : online ? 'Online' : idle;
  const live = typing || online;
  return (
    <span className="relative block h-[18px] leading-[18px] min-w-0" aria-live="polite">
      <span key={text} className={`hl-fade-in flex items-center gap-1 truncate text-[13px] ${live ? 'font-medium text-[#12804a]' : 'text-[#5b606b]'}`}>
        {typing ? <PeerTypingLottie size="inline" /> : null}
        <span className="truncate">{text}</span>
      </span>
    </span>
  );
}

/** The green dot on the avatar: always mounted, it scales and fades in and out (150 ms). */
export function OnlineDot({ online }: { online: boolean }) {
  return (
    <span
      className={`absolute bottom-0 right-0 w-[11px] h-[11px] rounded-full border-2 border-white bg-[#12a150] transition-[opacity,transform] duration-150 ease-out ${online ? 'opacity-100 scale-100' : 'opacity-0 scale-50'}`}
      aria-hidden="true"
    />
  );
}
