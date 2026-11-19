'use client';
/**
 * Keeps the chat (and the call engine inside it) alive across routes while a call is live.
 *
 *   on /chat                  the chat surface is shown where the page used to be
 *   elsewhere, call live      the same instance stays mounted, hidden and inert; the call is in the
 *                             floating window or the island (the engine leaves the stage by itself)
 *   elsewhere, no call        nothing is mounted, as before
 *
 * The wrapper element never changes type or position in the tree, so React never remounts the chat:
 * only its visibility changes. It sits in ClientLayout's <main>, at the same place for every route.
 */
import React, { useCallback, useEffect, useState } from 'react';
import { usePathname, useRouter } from 'next/navigation';
import { useActivities } from '@/lib/activities/store';
import { ChatSurface } from './ChatSurface';

export function ChatKeepAlive() {
  const pathname = usePathname() ?? '/';
  const router = useRouter();
  const onChat = pathname === '/chat' || pathname.startsWith('/chat/') || pathname.startsWith('/chat?');
  const callLive = useActivities((s) => s.activities.some((a) => a.kind === 'call' && a.state.phase !== 'ended'));
  const [alive, setAlive] = useState(onChat);

  useEffect(() => {
    if (onChat) setAlive(true);
    else if (!callLive) setAlive(false);
  }, [onChat, callLive]);

  const goToChat = useCallback(() => router.push('/chat'), [router]);

  if (!onChat && !(alive && callLive)) return null;
  return (
    <div
      data-chat-keepalive={onChat ? 'visible' : 'hidden'}
      hidden={!onChat}
      inert={!onChat}
      aria-hidden={onChat ? undefined : true}
      className="bg-transparent flex flex-col flex-1 w-full h-full relative overflow-hidden"
    >
      <ChatSurface visible={onChat} onRequestVisible={goToChat} />
    </div>
  );
}
