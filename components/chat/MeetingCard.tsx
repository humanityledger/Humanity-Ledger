'use client';

import React, { useEffect, useState } from 'react';
import { CalendarPlus, Phone, Video } from 'lucide-react';
import {
  MEETING_JOIN_EVENT,
  buildIcs,
  describeCountdown,
  describeMeetingTime,
  meetingPhase,
  type MeetingInvite,
} from '@/lib/chat/meeting';

/**
 * MeetingCard — a scheduled call inside the conversation.
 *
 * Shows the time in the reader's own time zone, counts down, offers the call as
 * an .ics file made on this device, and lights up Join from ten minutes before
 * the start until the end. Join asks the chat to start an ordinary call with the
 * person in this conversation (MEETING_JOIN_EVENT).
 */
export function MeetingCard({ invite, isMe, peerName }: { invite: MeetingInvite; isMe: boolean; peerName?: string }) {
  const [now, setNow] = useState(() => Date.now());

  useEffect(() => {
    const phaseNow = meetingPhase(invite, Date.now());
    if (phaseNow === 'ended') return;
    const t = window.setInterval(() => setNow(Date.now()), 30_000);
    return () => window.clearInterval(t);
  }, [invite]);

  const phase = meetingPhase(invite, now);
  const Icon = invite.kind === 'video' ? Video : Phone;
  const canJoin = phase === 'joinable' || phase === 'live';

  const addToCalendar = () => {
    const ics = buildIcs(invite, peerName);
    const url = URL.createObjectURL(new Blob([ics], { type: 'text/calendar;charset=utf-8' }));
    const a = document.createElement('a');
    a.href = url;
    a.download = `${invite.title.replace(/[^\w\s-]/g, '').trim().slice(0, 40) || 'call'}.ics`;
    document.body.appendChild(a);
    a.click();
    a.remove();
    window.setTimeout(() => URL.revokeObjectURL(url), 10_000);
  };

  const join = () => window.dispatchEvent(new CustomEvent(MEETING_JOIN_EVENT, { detail: { kind: invite.kind, id: invite.id } }));

  return (
    <div
      className={`w-[280px] max-w-full rounded-[20px] border overflow-hidden ${
        isMe ? 'bg-[#15171c] border-[#15171c] text-white' : 'bg-white border-[#e4e7ec] text-[#15171c]'
      }`}
    >
      <div className="px-4 pt-3.5 pb-3 flex flex-col gap-2">
        <span className={`flex items-center gap-2 text-[11.5px] font-semibold uppercase tracking-[0.06em] ${isMe ? 'text-[#b9bdc6]' : 'text-[#727a88]'}`}>
          <Icon size={14} strokeWidth={2} aria-hidden="true" />
          {invite.kind === 'video' ? 'Video call' : 'Voice call'}
        </span>
        <p className="text-[16.5px] font-semibold leading-snug tracking-[-0.01em] break-words">{invite.title}</p>
        <p className={`text-[13.5px] ${isMe ? 'text-[#d9dce1]' : 'text-[#475061]'}`}>{describeMeetingTime(invite)}</p>
        {invite.note && <p className={`text-[13.5px] leading-relaxed break-words ${isMe ? 'text-[#b9bdc6]' : 'text-[#727a88]'}`}>{invite.note}</p>}
      </div>
      <div className={`px-3 py-2.5 flex items-center gap-2 ${isMe ? 'bg-[#1f2128]' : 'bg-[#f7f8fa] border-t border-[#eceef2]'}`}>
        <span
          className={`flex-1 text-[12.5px] font-medium tabular-nums ${
            phase === 'live' || phase === 'joinable' ? 'text-[#12a150]' : isMe ? 'text-[#b9bdc6]' : 'text-[#727a88]'
          }`}
          aria-live="polite"
        >
          {describeCountdown(invite, now)}
        </span>
        {phase !== 'ended' && (
          <button
            type="button"
            onClick={addToCalendar}
            aria-label="Add to calendar"
            title="Add to calendar"
            className={`w-9 h-9 rounded-full flex items-center justify-center transition-colors ${isMe ? 'hover:bg-white/10 text-white' : 'hover:bg-[#eceef2] text-[#15171c]'}`}
          >
            <CalendarPlus size={17} strokeWidth={1.8} aria-hidden="true" />
          </button>
        )}
        {phase !== 'ended' && (
          <button
            type="button"
            onClick={join}
            disabled={!canJoin}
            title={canJoin ? 'Join the call' : 'Join opens ten minutes before the start'}
            className={`h-9 px-4 rounded-full text-[13.5px] font-semibold transition-colors ${
              canJoin
                ? 'bg-[#12a150] text-white hover:bg-[#0f8a44]'
                : isMe
                  ? 'bg-white/10 text-[#8b909a] cursor-not-allowed'
                  : 'bg-[#eceef2] text-[#a3a9b4] cursor-not-allowed'
            }`}
          >
            Join
          </button>
        )}
      </div>
    </div>
  );
}

export default MeetingCard;
