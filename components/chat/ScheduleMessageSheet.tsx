"use client";
/**
 * ScheduleMessageSheet — pick when the next message in this chat is sent.
 *
 * The chosen time goes back to the chat, which stores the message with this
 * conversation and sends it from this device at that time
 * (lib/chat/scheduled.ts).
 */

import React, { useEffect, useState } from 'react';
import { Sheet, PrimaryButton } from './ui/kit';
import { describeSendTime, scheduleTimeError } from '@/lib/chat/scheduled';

interface ScheduleMessageSheetProps {
  isOpen: boolean;
  onSchedule: (date: Date) => void;
  onClose: () => void;
}

const QUICK_OPTIONS: { label: string; getValue: () => Date }[] = [
  { label: 'In 30 minutes', getValue: () => new Date(Date.now() + 30 * 60 * 1000) },
  { label: 'In 1 hour', getValue: () => new Date(Date.now() + 60 * 60 * 1000) },
  {
    label: 'Tonight at 20:00',
    getValue: () => {
      const d = new Date();
      d.setHours(20, 0, 0, 0);
      if (d.getTime() < Date.now() + 60_000) d.setDate(d.getDate() + 1);
      return d;
    },
  },
  {
    label: 'Tomorrow at 9:00',
    getValue: () => {
      const d = new Date();
      d.setDate(d.getDate() + 1);
      d.setHours(9, 0, 0, 0);
      return d;
    },
  },
];

const pad = (n: number) => String(n).padStart(2, '0');
const toLocalInput = (d: Date) =>
  `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;

export function ScheduleMessageSheet({ isOpen, onSchedule, onClose }: ScheduleMessageSheetProps) {
  const [value, setValue] = useState('');
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!isOpen) return;
    setValue(toLocalInput(new Date(Date.now() + 60 * 60 * 1000)));
    setError(null);
  }, [isOpen]);

  const confirm = () => {
    const t = new Date(value).getTime();
    const err = scheduleTimeError(t);
    if (err) {
      setError(err);
      return;
    }
    onSchedule(new Date(t));
    onClose();
  };

  const parsed = new Date(value).getTime();

  return (
    <Sheet
      open={isOpen}
      onClose={onClose}
      title="Schedule a message"
      subtitle="Choose the time, then write and send it as usual"
      footer={
        <div className="flex flex-col gap-3">
          {error && (
            <p role="alert" className="text-[13.5px] text-[#c0362c]">
              {error}
            </p>
          )}
          <PrimaryButton onClick={confirm} className="w-full">
            {Number.isFinite(parsed) && !scheduleTimeError(parsed) ? `Send ${describeSendTime(parsed).toLowerCase()}` : 'Choose a time'}
          </PrimaryButton>
          <p className="text-[12.5px] leading-relaxed text-[#727a88]">
            Your messages are encrypted on this device, so it is this device that sends it. If Ledger Chat is closed at
            that time, it goes the next time you open it. You can cancel it until then.
          </p>
        </div>
      }
    >
      <div className="px-5 pb-4 flex flex-col gap-4">
        <div className="flex flex-wrap gap-2" role="group" aria-label="Quick choices">
          {QUICK_OPTIONS.map((opt) => (
            <button
              key={opt.label}
              type="button"
              onClick={() => {
                setValue(toLocalInput(opt.getValue()));
                setError(null);
              }}
              className="h-9 px-3.5 rounded-full border border-[#d0d5dd] bg-white text-[14px] font-medium text-[#15171c] hover:bg-[#f2f4f7] transition-colors"
            >
              {opt.label}
            </button>
          ))}
        </div>
        <div>
          <label htmlFor="schedule-at" className="block text-[13px] font-medium text-[#475061] mb-1.5">
            Date and time
          </label>
          <input
            id="schedule-at"
            type="datetime-local"
            value={value}
            min={toLocalInput(new Date(Date.now() + 60_000))}
            onChange={(e) => {
              setValue(e.target.value);
              setError(null);
            }}
            className="w-full h-11 px-3 rounded-xl border border-[#d0d5dd] bg-white text-[15px] text-[#15171c] outline-none focus:border-[#15171c]"
          />
        </div>
      </div>
    </Sheet>
  );
}

export default ScheduleMessageSheet;
