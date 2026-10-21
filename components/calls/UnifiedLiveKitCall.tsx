'use client';
import React, { useState } from 'react';

export interface LiveKitCallOptions {
  roomName: string;
  token: string;
  forceTurnRelay?: boolean;
  e2eeKey?: string;
  enableScreenShare?: boolean;
}

export function UnifiedLiveKitCall({ options }: { options: LiveKitCallOptions }) {
  const [isMuted, setIsMuted] = useState(false);
  const [isVideoOff, setIsVideoOff] = useState(false);
  const [isScreenSharing, setIsScreenSharing] = useState(false);
  const [quality, setQuality] = useState<'excellent' | 'good' | 'poor'>('excellent');

  return (
    <div className="relative w-full h-full bg-neutral-900 rounded-3xl overflow-hidden flex flex-col text-white">
      {/* Stage Header */}
      <div className="p-4 flex items-center justify-between z-10 bg-gradient-to-b from-black/60 to-transparent">
        <div className="flex items-center gap-2">
          <span className="w-2.5 h-2.5 rounded-full bg-emerald-500 animate-pulse" />
          <span className="font-semibold text-sm">{options.roomName}</span>
          {options.forceTurnRelay && (
            <span className="px-2 py-0.5 text-[10px] bg-neutral-800 border border-neutral-700 rounded-full font-mono text-emerald-400">
              TURN RELAY (IP HIDDEN)
            </span>
          )}
        </div>
        <div className="text-xs font-mono text-neutral-400">Quality: {quality}</div>
      </div>

      {/* Video Grid */}
      <div className="flex-1 flex items-center justify-center p-4">
        <div className="w-24 h-24 rounded-full bg-neutral-800 flex items-center justify-center text-xl font-bold border border-neutral-700">
          HL
        </div>
      </div>

      {/* Control Bar */}
      <div className="p-4 flex items-center justify-center gap-4 bg-neutral-950/80 backdrop-blur border-t border-neutral-800">
        <button
          onClick={() => setIsMuted(!isMuted)}
          className={`p-3 rounded-full ${isMuted ? 'bg-rose-600' : 'bg-neutral-800 hover:bg-neutral-700'}`}
        >
          {isMuted ? 'Unmute' : 'Mute'}
        </button>
        <button
          onClick={() => setIsVideoOff(!isVideoOff)}
          className={`p-3 rounded-full ${isVideoOff ? 'bg-rose-600' : 'bg-neutral-800 hover:bg-neutral-700'}`}
        >
          {isVideoOff ? 'Camera On' : 'Camera Off'}
        </button>
        <button
          onClick={() => setIsScreenSharing(!isScreenSharing)}
          className={`p-3 rounded-full ${isScreenSharing ? 'bg-blue-600' : 'bg-neutral-800 hover:bg-neutral-700'}`}
        >
          Share
        </button>
      </div>
    </div>
  );
}
