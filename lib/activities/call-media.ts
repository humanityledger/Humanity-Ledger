/**
 * The live half of a call that cannot be serialised: its media streams and its controls.
 *
 * The call engine (components/terminal/LedgerChatV2.tsx) registers them here; the floating window
 * and the island read them. Keeping them out of the activity store keeps ContentState plain data
 * for ActivityKit, and lets the window draw the same MediaStream wherever the user is in the app.
 *
 * Nothing in this file creates or stops media. A stream belongs to the engine; the window only
 * shows it.
 */
import { create } from 'zustand';

export interface CallControls {
  answer?: () => void;
  decline?: () => void;
  end: () => void;
  toggleMic: () => void;
  toggleCamera?: () => void;
  /** Back to the full-screen call. The layer navigates to /chat first when needed. */
  openStage: () => void;
}

interface CallMediaStore {
  remote: MediaStream | null;
  local: MediaStream | null;
  controls: CallControls | null;
  /** True while a <video> of this call is in the browser's picture in picture. */
  inBrowserPip: boolean;
  register(media: { remote: MediaStream | null; local: MediaStream | null; controls: CallControls }): void;
  clear(): void;
  setInBrowserPip(on: boolean): void;
}

export const useCallMedia = create<CallMediaStore>((set) => ({
  remote: null,
  local: null,
  controls: null,
  inBrowserPip: false,
  register({ remote, local, controls }) {
    set({ remote, local, controls });
  },
  clear() {
    set({ remote: null, local: null, controls: null, inBrowserPip: false });
  },
  setInBrowserPip(on) {
    set({ inBrowserPip: on });
  },
}));

/** True when the stream carries a live video track. */
export function hasLiveVideo(stream: MediaStream | null): boolean {
  return !!stream && stream.getVideoTracks().some((t) => t.readyState === 'live' && t.enabled);
}

/**
 * Puts a stream on a <video> and starts it, muted (the voice plays through the engine's one
 * <audio> element, never twice). iOS Safari and some Android browsers show a black frame until
 * play() is called, so it is called whenever the element is paused.
 */
export function attachStream(el: HTMLVideoElement | null, stream: MediaStream | null) {
  if (!el) return;
  if (el.srcObject !== stream) el.srcObject = stream;
  el.muted = true;
  el.playsInline = true;
  if (stream && el.paused) el.play().catch(() => undefined);
}
