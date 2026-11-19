'use client';
/**
 * The browser's own call controls (Media Session API): the hang-up, microphone and camera buttons
 * that Chrome and Edge show in their media hub and in automatic picture in picture. Each action is
 * set inside try/catch because browsers reject the ones they do not know.
 */

type Handler = (() => void) | null;
const setAction = (action: string, handler: Handler) => {
  try {
    (navigator.mediaSession.setActionHandler as (a: string, h: Handler) => void)(action, handler);
  } catch {
    /* unsupported action in this browser */
  }
};

export function hasMediaSession(): boolean {
  return typeof navigator !== 'undefined' && 'mediaSession' in navigator;
}

export function setCallSession(peer: string, actions: { hangup: () => void; toggleMic: () => void; toggleCamera?: () => void }, state: { micMuted: boolean; cameraOff: boolean }) {
  if (!hasMediaSession()) return;
  try {
    // Title only: who the call is with. Never anything from a conversation.
    navigator.mediaSession.metadata = new MediaMetadata({ title: `Call with ${peer}`, artist: 'Ledger Chat' });
  } catch { /* MediaMetadata missing */ }
  setAction('hangup', actions.hangup);
  setAction('togglemicrophone', actions.toggleMic);
  setAction('togglecamera', actions.toggleCamera ?? null);
  const ms = navigator.mediaSession as MediaSession & { setMicrophoneActive?: (on: boolean) => void; setCameraActive?: (on: boolean) => void };
  try { ms.setMicrophoneActive?.(!state.micMuted); } catch { /* not supported */ }
  try { ms.setCameraActive?.(!state.cameraOff); } catch { /* not supported */ }
}

/** Lets the browser move the call video to picture in picture by itself when the tab is hidden. */
export function setAutoPip(handler: Handler) {
  if (!hasMediaSession()) return;
  setAction('enterpictureinpicture', handler);
}

export function clearCallSession() {
  if (!hasMediaSession()) return;
  for (const a of ['hangup', 'togglemicrophone', 'togglecamera', 'enterpictureinpicture']) setAction(a, null);
  try { navigator.mediaSession.metadata = null; } catch { /* ignore */ }
}
