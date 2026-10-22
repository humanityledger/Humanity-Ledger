'use client';
import React from 'react';
import { ArrowUp } from 'lucide-react';

interface LottieSendButtonProps {
  onTrigger?: () => void;
  disabled?: boolean;
  'data-key'?: number;
}

/** The send button: a dark circle with an arrow, like the rest of the app's primary actions. */
export function LottieSendButton({ onTrigger, disabled }: LottieSendButtonProps) {
  return (
    <button
      type="submit"
      disabled={disabled}
      onClick={onTrigger}
      className={`w-10 h-10 mb-[2px] rounded-full flex items-center justify-center transition-colors shrink-0 ${disabled ? 'bg-[#e4e7ec] text-[#a3a9b4] cursor-not-allowed' : 'bg-[#15171c] text-white hover:bg-[#2b2f38] active:scale-95'}`}
      aria-label="Send message"
    >
      <ArrowUp size={20} strokeWidth={2.2} />
    </button>
  );
}
