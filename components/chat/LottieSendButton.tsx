'use client';
import React from 'react';
import { Send } from 'lucide-react';

interface LottieSendButtonProps {
  onTrigger?: () => void;
  disabled?: boolean;
  'data-key'?: number;
}

export function LottieSendButton({ onTrigger, disabled }: LottieSendButtonProps) {
  return (
    <button
      type="submit"
      disabled={disabled}
      onClick={onTrigger}
      className={`w-[38px] h-[38px] rounded-full flex items-center justify-center transition-all shadow-sm shrink-0 ${disabled ? 'bg-[#E5E5EA] text-[#8E8E93] cursor-not-allowed' : 'bg-[#25D366] text-white hover:bg-[#128C7E] active:scale-90'}`}
      aria-label="Send message"
    >
      <Send size={18} strokeWidth={2.5} className="ml-1" />
    </button>
  );
}
