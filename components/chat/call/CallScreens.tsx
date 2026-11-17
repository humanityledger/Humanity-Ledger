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
import { formatCallDuration } from '@/lib/calls/format';

export { formatCallDuration };

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

/** The hue of a person's tint, for the soft halo behind their picture. */
function hueOf(address?: string | null) {
  const hex = (address || '').replace(/^0x/i, '').slice(0, 6);
  return hex ? parseInt(hex, 16) % 360 : 250;
}

/** Seconds since the screen opened, ticking on its own (the chat around it does not re-render). */
function Elapsed() {
  const [startedAt] = React.useState(() => Date.now());
  return <CallClock startedAt={startedAt} />;
}

function Top({ label, isVideo, dark }: { label: string; isVideo: boolean; dark?: boolean }) {
  const Icon = isVideo ? Video : Phone;
  return (
    <div className={`${s.top} ${dark ? s.topDark : ''}`}>
      <span className={s.brand}>
        <span className={s.brandMark} aria-hidden="true" />
        Ledger Chat
      </span>
      <span className={s.kind}>
        <Icon size={14} strokeWidth={2.1} aria-hidden="true" />
        {label}
      </span>
    </div>
  );
}

function Secure({ dark }: { dark?: boolean }) {
  return (
    <p className={`${s.secure} ${dark ? s.secureDark : ''}`}>
      <Lock size={12} strokeWidth={2.25} aria-hidden="true" />
      Encrypted end to end, device to device
    </p>
  );
}

function Who({
  peerName,
  peerAddress,
  photo,
  status,
  live,
  dark,
}: {
  peerName: string;
  peerAddress?: string | null;
  photo?: string | null;
  status: React.ReactNode;
  live?: boolean;
  dark?: boolean;
}) {
  return (
    <div className={s.centre}>
      <div className={s.avatarWrap} style={{ ['--hue' as any]: hueOf(peerAddress) }}>
        <span className={s.halo} aria-hidden="true" />
        <span className={s.ring} aria-hidden="true" />
        <span className={s.ring} aria-hidden="true" />
        <span className={s.ring} aria-hidden="true" />
        <CallAvatar name={peerName} address={peerAddress} photo={photo} />
      </div>
      <div className={s.identity}>
        <p className={`${s.name} ${dark ? s.nameDark : ''}`} title={peerName}>{peerName}</p>
        {peerAddress && peerName !== peerAddress && (
          <p className={`${s.address} ${dark ? s.addressDark : ''}`}>{shorten(peerAddress)}</p>
        )}
        <p className={`${s.status} ${dark ? s.statusDark : ''}`} role="status" aria-live="polite">
          <span className={`${s.dot} ${live ? s.dotLive : s.dotWait}`} aria-hidden="true" />
          {/* One text run: the gap of the row is only between the dot and the words. */}
          <span>{status}</span>
        </p>
      </div>
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
  // One tap per call: a second tap on Answer (or Decline right after it) does nothing.
  const [busy, setBusy] = React.useState(false);
  const once = (fn: () => void) => () => {
    if (busy) return;
    setBusy(true);
    fn();
  };
  // Keyboard: Escape declines (desktop).
  const answerRef = React.useRef<HTMLButtonElement>(null);
  // Keyboard users land on Answer (Enter answers); on touch screens nothing is focused, so no ring.
  React.useEffect(() => {
    if (window.matchMedia?.('(pointer: fine)').matches) answerRef.current?.focus({ preventScroll: true, focusVisible: false } as FocusOptions);
  }, []);
  return (
    <div
      className={s.backdrop}
      role="dialog"
      aria-modal="true"
      aria-label={`Incoming ${isVideo ? 'video' : 'voice'} call from ${peerName}`}
      onKeyDown={(e) => {
        if (e.key === 'Escape') { e.preventDefault(); once(onDecline)(); }
      }}
    >
      <div className={s.screen} data-kind="incoming">
        <Top label={isVideo ? 'Video call' : 'Voice call'} isVideo={isVideo} />

        <Who
          peerName={peerName}
          peerAddress={peerAddress}
          photo={photo}
          status={<>{isVideo ? 'Incoming video call' : 'Incoming voice call'}<span className={s.ellipsis} aria-hidden="true" /></>}
        />

        <div className={s.bottom}>
          <div className={s.actions}>
            <div className={s.action}>
              <button type="button" className={`${s.round} ${s.decline}`} onClick={once(onDecline)} disabled={busy} aria-label="Decline">
                <PhoneOff size={27} strokeWidth={2} aria-hidden="true" />
              </button>
              <span>Decline</span>
            </div>
            {onMessage && (
              <div className={s.action}>
                <button type="button" className={`${s.round} ${s.secondary}`} onClick={once(onMessage)} disabled={busy} aria-label="Decline and reply with a message">
                  <MessageSquare size={21} strokeWidth={1.9} aria-hidden="true" />
                </button>
                <span>Message</span>
              </div>
            )}
            <div className={s.action}>
              <button
                ref={answerRef}
                type="button"
                className={`${s.round} ${s.accept}`}
                onClick={once(onAnswer)}
                disabled={busy}
                aria-label={isVideo ? 'Answer with video' : 'Answer'}
              >
                <span className={s.acceptPulse} aria-hidden="true" />
                {isVideo ? <Video size={27} strokeWidth={2} aria-hidden="true" /> : <Phone size={27} strokeWidth={2} aria-hidden="true" />}
              </button>
              <span>{busy ? 'Connecting' : 'Answer'}</span>
            </div>
          </div>
          <Secure />
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
  preview,
  onCancel,
}: {
  peerName: string;
  peerAddress?: string | null;
  photo?: string | null;
  isVideo: boolean;
  /** Our own camera while it rings (video calls), mirrored like a mirror. */
  preview?: MediaStream | null;
  onCancel: () => void;
}) {
  // A video call shows our own camera full screen while it rings, under a dark veil; a voice call
  // keeps the light screen.
  const camera = isVideo && !!preview && preview.getVideoTracks().some((t) => t.readyState === 'live');
  const [cancelled, setCancelled] = React.useState(false);
  return (
    <div
      className={`${s.backdrop} ${camera ? s.backdropDark : ''}`}
      role="dialog"
      aria-modal="true"
      aria-label={`Calling ${peerName}`}
      onKeyDown={(e) => { if (e.key === 'Escape' && !cancelled) { e.preventDefault(); setCancelled(true); onCancel(); } }}
    >
      <div className={`${s.screen} ${camera ? s.screenCamera : ''}`} data-kind="outgoing">
        {camera && (
          <>
            <video
              className={s.preview}
              ref={(el) => { if (el && el.srcObject !== preview) el.srcObject = preview!; }}
              autoPlay
              playsInline
              muted
              aria-label="Your camera"
            />
            <span className={s.veil} aria-hidden="true" />
          </>
        )}
        <Top label={isVideo ? 'Video call' : 'Voice call'} isVideo={isVideo} dark={camera} />

        <Who
          peerName={peerName}
          peerAddress={peerAddress}
          photo={photo}
          dark={camera}
          status={<>Calling<span className={s.ellipsis} aria-hidden="true" /><span className={s.sep} aria-hidden="true">·</span><span className={s.mono}><Elapsed /></span></>}
        />

        <div className={s.bottom}>
          <div className={s.actions}>
            <div className={`${s.action} ${camera ? s.actionDark : ''}`}>
              <button
                type="button"
                className={`${s.round} ${s.decline}`}
                onClick={() => { if (cancelled) return; setCancelled(true); onCancel(); }}
                disabled={cancelled}
                aria-label="Cancel call"
              >
                <PhoneOff size={27} strokeWidth={2} aria-hidden="true" />
              </button>
              <span>Cancel</span>
            </div>
          </div>
          <Secure dark={camera} />
        </div>
      </div>
    </div>
  );
}

/** The light background of an audio call in progress. */
/**
 * The call's running time. It ticks on its own, so the chat around it does not re-render every
 * second during a call (it used to: the whole chat, once a second, for the length of the call).
 */
export function CallClock({ startedAt }: { startedAt: number | null }) {
  const [, tick] = React.useState(0);
  React.useEffect(() => {
    if (!startedAt) return;
    const id = setInterval(() => tick((n) => n + 1), 1000);
    return () => clearInterval(id);
  }, [startedAt]);
  return <>{formatCallDuration(startedAt ? (Date.now() - startedAt) / 1000 : 0)}</>;
}

/**
 * Moves an element with the loudness of a stream: ~12 updates a second, written straight to the
 * element's style (no React state, so nothing re-renders), and the analyser is never connected to
 * the speakers (the <audio> element plays the voice).
 */
function useVoicePulse(stream: MediaStream | null | undefined, active: boolean, target: React.RefObject<HTMLElement | null>) {
  React.useEffect(() => {
    const el = target.current;
    if (!active || !stream || !el || !stream.getAudioTracks().length) return;
    const Ctx: typeof AudioContext | undefined = (window as any).AudioContext || (window as any).webkitAudioContext;
    if (!Ctx) return;
    let ctx: AudioContext | null = null;
    let id: ReturnType<typeof setInterval> | null = null;
    try {
      ctx = new Ctx({ latencyHint: 'interactive' });
      const analyser = ctx.createAnalyser();
      analyser.fftSize = 64;
      analyser.smoothingTimeConstant = 0.6;
      ctx.createMediaStreamSource(stream).connect(analyser);
      const data = new Uint8Array(analyser.frequencyBinCount);
      let last = -1;
      id = setInterval(() => {
        if (document.visibilityState === 'hidden') return;
        analyser.getByteFrequencyData(data);
        let sum = 0;
        for (let i = 0; i < data.length; i++) sum += data[i];
        const level = Math.round(Math.min(sum / data.length, 60) / 6); // 0..10
        if (level === last) return;
        last = level;
        el.style.transform = `scale(${1 + level / 100})`;
      }, 80);
    } catch {
      /* no analyser on this browser: no pulse */
    }
    return () => {
      if (id) clearInterval(id);
      el.style.transform = '';
      ctx?.close().catch(() => {});
    };
  }, [stream, active, target]);
}

export function AudioCallStage({
  peerName,
  peerAddress,
  photo,
  connected,
  startedAt = null,
  durationLabel,
  poorConnection,
  reconnecting,
  levelStream,
}: {
  peerName: string;
  peerAddress?: string | null;
  photo?: string | null;
  connected: boolean;
  /** When the call was answered; shows a running clock. */
  startedAt?: number | null;
  /** Fixed label instead of the clock. */
  durationLabel?: string;
  poorConnection?: boolean;
  /** The connection dropped and the call is recovering (lib/calls/resume.ts). */
  reconnecting?: boolean;
  /** The other person's stream, for the voice pulse. */
  levelStream?: MediaStream | null;
}) {
  const pulse = React.useRef<HTMLDivElement>(null);
  useVoicePulse(levelStream, connected, pulse);
  return (
    <div className={`${s.stage} ${connected ? s.still : ''}`}>
      <div className={s.avatarWrap} style={{ ['--hue' as any]: hueOf(peerAddress) }}>
        <span className={s.halo} aria-hidden="true" />
        <span className={s.ring} aria-hidden="true" />
        <span className={s.ring} aria-hidden="true" />
        <span className={s.ring} aria-hidden="true" />
        <div ref={pulse} style={{ transition: 'transform 90ms linear', willChange: 'transform' }}>
          <CallAvatar name={peerName} address={peerAddress} photo={photo} />
        </div>
      </div>
      <div className={s.identity}>
        <p className={s.name} title={peerName}>{peerName}</p>
        {peerAddress && peerName !== peerAddress && <p className={s.address}>{shorten(peerAddress)}</p>}
        <p className={`${s.status} ${poorConnection || reconnecting ? s.statusWarn : ''}`} role="status" aria-live="polite">
          <span className={`${s.dot} ${connected ? (poorConnection || reconnecting ? s.dotWarn : s.dotLive) : s.dotWait}`} aria-hidden="true" />
          <span>{!connected
            ? <>Connecting<span className={s.ellipsis} aria-hidden="true" /></>
            : reconnecting
              ? <>Reconnecting<span className={s.ellipsis} aria-hidden="true" /></>
              : poorConnection
                ? 'Weak connection'
                : <span className={s.mono}>{durationLabel ?? <CallClock startedAt={startedAt} />}</span>}</span>
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
      {isVideo && onSwitchCamera && !cameraOff && (
        <button type="button" className={s.control} onClick={onSwitchCamera} aria-label="Switch camera" title="Switch camera">
          <SwitchCamera size={21} strokeWidth={1.9} />
        </button>
      )}
      {onScreenShare && (
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
      {onToggleCamera && (
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
