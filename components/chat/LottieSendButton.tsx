'use client';
import React from 'react';
import { ArrowUp, Send } from 'lucide-react';

interface LottieSendButtonProps {
  onTrigger?: () => void;
  disabled?: boolean;
  className?: string;
  'data-key'?: number;
}

/**
 * The send button. On phones a dark circle with an arrow; on wide screens a
 * blue rounded square with a paper plane, beside the message field.
 */
export function LottieSendButton({ onTrigger, disabled, className = '' }: LottieSendButtonProps) {
  return (
    <button
      type="submit"
      disabled={disabled}
      onClick={onTrigger}
      className={`w-10 h-10 mb-[2px] md:w-12 md:h-12 md:mb-0 rounded-full md:rounded-2xl flex items-center justify-center transition-colors shrink-0 ${
        disabled
          ? 'bg-[#e4e7ec] text-[#a3a9b4] md:bg-[#2456e6]/35 md:text-white cursor-not-allowed'
          : 'bg-[#15171c] text-white hover:bg-[#2b2f38] md:bg-[#2456e6] md:hover:bg-[#1d47c4] active:scale-95'
      } ${className}`}
      aria-label="Send message"
    >
      <ArrowUp size={20} strokeWidth={2.2} className="md:hidden" aria-hidden="true" />
      <Send size={19} strokeWidth={1.9} className="hidden md:block -translate-x-[1px] translate-y-[1px]" aria-hidden="true" />
    </button>
  );
}
