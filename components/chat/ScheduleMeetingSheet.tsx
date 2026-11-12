'use client';

import React, { useEffect, useMemo, useState } from 'react';
import { Phone, Video } from 'lucide-react';
import { Sheet, PrimaryButton } from './ui/kit';
import { MAX_NOTE, MAX_TITLE, encodeMeeting, newMeetingId, type MeetingKind } from '@/lib/chat/meeting';

/**
 * ScheduleMeetingSheet — invite the person in this chat to a call at a set time.
 *
 * The invitation is sent as an ordinary encrypted message (lib/chat/meeting.ts);
 * both people then see a card with Join and Add to calendar.
 */

const DURATIONS = [15, 30, 45, 60, 90, 120];

const pad = (n: number) => String(n).padStart(2, '0');
const toDateInput = (d: Date) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
const toTimeInput = (d: Date) => `${pad(d.getHours())}:${pad(d.getMinutes())}`;

/** The next half hour that is at least 20 minutes away. */
function defaultStart(now = new Date()) {
  const d = new Date(now.getTime() + 20 * 60_000);
  d.setSeconds(0, 0);
  d.setMinutes(d.getMinutes() <= 30 ? 30 : 60);
  return d;
}

export function ScheduleMeetingSheet({
  open,
  onClose,
  peerName,
  onSend,
}: {
  open: boolean;
  onClose: () => void;
  peerName: string;
  /** Sends the invitation text; resolves true once it is on its way. */
  onSend: (text: string) => Promise<boolean>;
}) {
  const [title, setTitle] = useState('');
  const [date, setDate] = useState('');
  const [time, setTime] = useState('');
  const [duration, setDuration] = useState(30);
  const [kind, setKind] = useState<MeetingKind>('video');
  const [note, setNote] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!open) return;
    const start = defaultStart();
    setTitle(`Call with ${peerName}`);
    setDate(toDateInput(start));
    setTime(toTimeInput(start));
    setDuration(30);
    setKind('video');
    setNote('');
    setError(null);
    setBusy(false);
  }, [open, peerName]);

  const tz = useMemo(() => {
    try {
      return Intl.DateTimeFormat().resolvedOptions().timeZone;
    } catch {
      return '';
    }
  }, []);

  const submit = async () => {
    const startsAt = new Date(`${date}T${time}`).getTime();
    if (!title.trim()) return setError('Give the call a name.');
    if (!Number.isFinite(startsAt)) return setError('Choose a date and a time.');
    if (startsAt < Date.now() - 60_000) return setError('Choose a time in the future.');
    if (startsAt > Date.now() + 366 * 86_400_000) return setError('Choose a time within the next year.');
    setError(null);
    setBusy(true);
    try {
      const text = encodeMeeting({ v: 1, id: newMeetingId(), title, startsAt, durationMin: duration, kind, ...(note.trim() ? { note } : {}) });
      const ok = await onSend(text);
      if (ok) onClose();
      else setError('The invitation was not sent. Check your connection and try again.');
    } catch {
      setError('The invitation was not sent. Check your connection and try again.');
    } finally {
      setBusy(false);
    }
  };

  const field = 'w-full h-11 px-3 rounded-xl border border-[#d0d5dd] bg-white text-[15px] text-[#15171c] outline-none focus:border-[#15171c]';
  const label = 'block text-[13px] font-medium text-[#475061] mb-1.5';

  return (
    <Sheet
      open={open}
      onClose={onClose}
      title="Schedule a call"
      subtitle={`With ${peerName}`}
      footer={
        <div className="flex flex-col gap-3">
          {error && (
            <p role="alert" className="text-[13.5px] text-[#c0362c]">
              {error}
            </p>
          )}
          <PrimaryButton onClick={submit} disabled={busy} className="w-full">
            {busy ? 'Sending' : 'Send invitation'}
          </PrimaryButton>
          <p className="text-[12.5px] leading-relaxed text-[#727a88]">
            Sent as an encrypted message. You both get a Join button ten minutes before, and can add the call to your
            calendar.
          </p>
        </div>
      }
    >
      <div className="px-5 pb-4 flex flex-col gap-4">
        <div>
          <label htmlFor="meet-title" className={label}>
            Name
          </label>
          <input id="meet-title" className={field} value={title} maxLength={MAX_TITLE} onChange={(e) => setTitle(e.target.value)} />
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div>
            <label htmlFor="meet-date" className={label}>
              Date
            </label>
            <input id="meet-date" type="date" className={field} value={date} onChange={(e) => setDate(e.target.value)} />
          </div>
          <div>
            <label htmlFor="meet-time" className={label}>
              Time
            </label>
            <input id="meet-time" type="time" step={300} className={field} value={time} onChange={(e) => setTime(e.target.value)} />
          </div>
        </div>
        {tz && <p className="-mt-2 text-[12.5px] text-[#727a88]">Your time zone: {tz.replace(/_/g, ' ')}. {peerName} sees it in theirs.</p>}

        <div>
          <label htmlFor="meet-duration" className={label}>
            Length
          </label>
          <select id="meet-duration" className={field} value={duration} onChange={(e) => setDuration(Number(e.target.value))}>
            {DURATIONS.map((m) => (
              <option key={m} value={m}>
                {m < 60 ? `${m} minutes` : m === 60 ? '1 hour' : `${m / 60} hours`}
              </option>
            ))}
          </select>
        </div>

        <fieldset>
          <legend className={label}>Type</legend>
          <div className="grid grid-cols-2 gap-2 p-1 rounded-xl bg-[#f2f4f7]">
            {(['video', 'voice'] as const).map((k) => (
              <button
                key={k}
                type="button"
                aria-pressed={kind === k}
                onClick={() => setKind(k)}
                className={`h-10 rounded-lg flex items-center justify-center gap-2 text-[14.5px] font-medium transition-colors ${
                  kind === k ? 'bg-white text-[#15171c] shadow-[0_1px_2px_rgba(16,24,40,0.1)]' : 'text-[#475061]'
                }`}
              >
                {k === 'video' ? <Video size={17} strokeWidth={1.8} aria-hidden="true" /> : <Phone size={17} strokeWidth={1.8} aria-hidden="true" />}
                {k === 'video' ? 'Video' : 'Voice'}
              </button>
            ))}
          </div>
        </fieldset>

        <div>
          <label htmlFor="meet-note" className={label}>
            Note <span className="font-normal text-[#a3a9b4]">(optional)</span>
          </label>
          <textarea
            id="meet-note"
            rows={2}
            maxLength={MAX_NOTE}
            className="w-full px-3 py-2.5 rounded-xl border border-[#d0d5dd] bg-white text-[15px] text-[#15171c] outline-none focus:border-[#15171c] resize-none"
            value={note}
            onChange={(e) => setNote(e.target.value)}
            placeholder="What you want to talk about"
          />
        </div>
      </div>
    </Sheet>
  );
}

export default ScheduleMeetingSheet;
