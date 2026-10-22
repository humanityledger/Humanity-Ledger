'use client';

import React from 'react';
import {
  Lock,
  MessageSquare,
  Mic,
  MicOff,
  MonitorUp,
  Phone,
  PhoneOff,
  SwitchCamera,
  Video,
  VideoOff,
} from 'lucide-react';
import s from './CallScreens.module.css';

/**
 * Call screens for Ledger Chat.
 *
 * Presentational only: every action is a callback, so the call logic in
 * LedgerChatV2 stays where it is. Icons come from lucide; nothing here is a
 * hand drawn SVG.
 */

const shorten = (a?: string | null) => (a ? `${a.slice(0, 6)}…${a.slice(-4)}` : '');

/** A soft colour per address, so the same person always looks the same. */
export function peerTint(address?: string | null) {
  const hex = (address || '').replace(/^0x/i, '').slice(0, 6);
  const hue = hex ? parseInt(hex, 16) % 360 : 220;
  return { background: `hsl(${hue} 55% 91%)`, color: `hsl(${hue} 42% 28%)` };
}

export function initialsFor(name?: string | null, address?: string | null) {
  const clean = (name || '').trim();
  if (clean && !/^0x[0-9a-f]/i.test(clean)) {
    const parts = clean.split(/\s+/).filter(Boolean);
    return ((parts[0]?.[0] || '') + (parts.length > 1 ? parts[parts.length - 1][0] : '')).toUpperCase();
  }
  return address ? address.slice(2, 4).toUpperCase() : '';
}

export function CallAvatar({
  name,
  address,
  photo,
  scale = 1,
}: {
  name?: string | null;
  address?: string | null;
  photo?: string | null;
  scale?: number;
}) {
  return (
    <div className={s.avatar} style={{ ...peerTint(address), transform: `scale(${scale})` }} aria-hidden="true">
      {photo ? <img src={photo} alt="" /> : initialsFor(name, address)}
    </div>
  );
}

function Top({ label, isVideo }: { label: string; isVideo: boolean }) {
  const Icon = isVideo ? Video : Phone;
  return (
    <div className={s.top}>
      <span className={s.kind}>
        <Icon size={16} strokeWidth={2} aria-hidden="true" />
        {label}
      </span>
      <span className={s.secure}>
        <Lock size={12} strokeWidth={2.25} aria-hidden="true" />
        Encrypted end to end
      </span>
    </div>
  );
}

export function IncomingCallScreen({
  peerName,
  peerAddress,
  photo,
  isVideo,
  onDecline,
  onAnswer,
  onMessage,
}: {
  peerName: string;
  peerAddress?: string | null;
  photo?: string | null;
  isVideo: boolean;
  onDecline: () => void;
  onAnswer: () => void;
  onMessage?: () => void;
}) {
  return (
    <div className={s.screen} role="dialog" aria-modal="true" aria-label={`Incoming call from ${peerName}`}>
      <Top label={isVideo ? 'Incoming video call' : 'Incoming voice call'} isVideo={isVideo} />

      <div className={s.centre}>
        <div className={s.avatarWrap}>
          <span className={s.ring} />
          <span className={s.ring} />
          <CallAvatar name={peerName} address={peerAddress} photo={photo} />
        </div>
        <div>
          <p className={s.name}>{peerName}</p>
          {peerAddress && peerName !== peerAddress && <p className={s.address}>{shorten(peerAddress)}</p>}
        </div>
      </div>

      <div className={s.actions}>
        <div className={s.action}>
          <button type="button" className={`${s.round} ${s.decline}`} onClick={onDecline} aria-label="Decline">
            <PhoneOff size={28} strokeWidth={2} />
          </button>
          Decline
        </div>
        {onMessage && (
          <div className={s.action}>
            <button type="button" className={`${s.round} ${s.secondary}`} onClick={onMessage} aria-label="Decline and reply">
              <MessageSquare size={22} strokeWidth={1.9} />
            </button>
            Reply
          </div>
        )}
        <div className={s.action}>
          <button type="button" className={`${s.round} ${s.accept}`} onClick={onAnswer} aria-label="Answer">
            {isVideo ? <Video size={28} strokeWidth={2} /> : <Phone size={28} strokeWidth={2} />}
          </button>
          Answer
        </div>
      </div>
    </div>
  );
}

export function OutgoingCallScreen({
  peerName,
  peerAddress,
  photo,
  isVideo,
  onCancel,
}: {
  peerName: string;
  peerAddress?: string | null;
  photo?: string | null;
  isVideo: boolean;
  onCancel: () => void;
}) {
  return (
    <div className={s.screen} role="dialog" aria-modal="true" aria-label={`Calling ${peerName}`}>
      <Top label={isVideo ? 'Video call' : 'Voice call'} isVideo={isVideo} />

      <div className={s.centre}>
        <div className={s.avatarWrap}>
          <span className={s.ring} />
          <span className={s.ring} />
          <CallAvatar name={peerName} address={peerAddress} photo={photo} />
        </div>
        <div>
          <p className={s.name}>{peerName}</p>
          {peerAddress && peerName !== peerAddress && <p className={s.address}>{shorten(peerAddress)}</p>}
          <p className={s.status} role="status">
            <span className={s.dot} aria-hidden="true" />
            Calling
          </p>
        </div>
      </div>

      <div className={s.actions}>
        <div className={s.action}>
          <button type="button" className={`${s.round} ${s.decline}`} onClick={onCancel} aria-label="Cancel call">
            <PhoneOff size={28} strokeWidth={2} />
          </button>
          Cancel
        </div>
      </div>
    </div>
  );
}

/** The light background of an audio call in progress. */
export function AudioCallStage({
  peerName,
  peerAddress,
  photo,
  connected,
  durationLabel,
  poorConnection,
  audioLevel = 0,
}: {
  peerName: string;
  peerAddress?: string | null;
  photo?: string | null;
  connected: boolean;
  durationLabel: string;
  poorConnection?: boolean;
  audioLevel?: number;
}) {
  // A gentle pulse with the other person's voice, capped so it never jumps.
  const scale = connected ? 1 + Math.min(audioLevel, 60) / 600 : 1;
  return (
    <div className={`${s.stage} ${connected ? s.still : ''}`}>
      <div className={s.avatarWrap}>
        <span className={s.ring} />
        <span className={s.ring} />
        <CallAvatar name={peerName} address={peerAddress} photo={photo} scale={scale} />
      </div>
      <div>
        <p className={s.name}>{peerName}</p>
        <p className={`${s.status} ${poorConnection ? s.statusWarn : ''}`} role="status">
          <span className={`${s.dot} ${connected ? (poorConnection ? s.dotWarn : s.dotLive) : ''}`} aria-hidden="true" />
          {!connected ? 'Connecting' : poorConnection ? 'Weak connection' : durationLabel}
        </p>
      </div>
    </div>
  );
}

export function CallControls({
  tone,
  isVideo,
  micMuted,
  cameraOff,
  screenSharing,
  onSwitchCamera,
  onScreenShare,
  onToggleCamera,
  onToggleMic,
  onEnd,
}: {
  tone: 'light' | 'dark';
  isVideo: boolean;
  micMuted: boolean;
  cameraOff?: boolean;
  screenSharing?: boolean;
  onSwitchCamera?: () => void;
  onScreenShare?: () => void;
  onToggleCamera?: () => void;
  onToggleMic: () => void;
  onEnd: () => void;
}) {
  return (
    <div className={`${s.controls} ${tone === 'light' ? s.controlsLight : s.controlsDark}`} role="toolbar" aria-label="Call controls">
      {isVideo && onSwitchCamera && (
        <button type="button" className={s.control} onClick={onSwitchCamera} aria-label="Switch camera" title="Switch camera">
          <SwitchCamera size={21} strokeWidth={1.9} />
        </button>
      )}
      {isVideo && onScreenShare && (
        <button
          type="button"
          className={`${s.control} ${screenSharing ? s.controlOn : ''}`}
          onClick={onScreenShare}
          aria-pressed={!!screenSharing}
          aria-label={screenSharing ? 'Stop sharing your screen' : 'Share your screen'}
          title={screenSharing ? 'Stop sharing' : 'Share screen'}
        >
          <MonitorUp size={21} strokeWidth={1.9} />
        </button>
      )}
      {isVideo && onToggleCamera && (
        <button
          type="button"
          className={`${s.control} ${cameraOff ? s.controlOn : ''}`}
          onClick={onToggleCamera}
          aria-pressed={!!cameraOff}
          aria-label={cameraOff ? 'Turn camera on' : 'Turn camera off'}
          title={cameraOff ? 'Turn camera on' : 'Turn camera off'}
        >
          {cameraOff ? <VideoOff size={21} strokeWidth={1.9} /> : <Video size={21} strokeWidth={1.9} />}
        </button>
      )}
      <button
        type="button"
        className={`${s.control} ${micMuted ? s.controlOn : ''}`}
        onClick={onToggleMic}
        aria-pressed={micMuted}
        aria-label={micMuted ? 'Unmute' : 'Mute'}
        title={micMuted ? 'Unmute' : 'Mute'}
      >
        {micMuted ? <MicOff size={21} strokeWidth={1.9} /> : <Mic size={21} strokeWidth={1.9} />}
      </button>
      <button type="button" className={s.controlEnd} onClick={onEnd} aria-label="End call" title="End call">
        <PhoneOff size={22} strokeWidth={2} />
      </button>
    </div>
  );
}
