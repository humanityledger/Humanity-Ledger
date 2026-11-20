'use client';
/**
 * Picture in picture for a call that shows both faces.
 *
 * The standard API moves ONE <video> into a floating window. The call window used to hand it the
 * remote <video>, so the floating window showed only the other person and the self view was
 * unmounted. This module never does that. It picks, in order:
 *
 *   1. Document Picture-in-Picture (Chrome and Edge on desktop): a small always-on-top page with
 *      the remote video filling it, our own camera as an inset, and Mute, Camera and End buttons.
 *   2. A composed video (Safari, Chrome on Android): the remote frame and our inset are drawn into
 *      one canvas, its captureStream() feeds a hidden <video>, and that video goes to picture in
 *      picture. Frames are paced by a worker, so a hidden tab does not slow them to one a second.
 *   3. Where neither works, nothing: the button is hidden. The remote-only floating window is
 *      never offered as if it were the call.
 *
 * Audio never moves: every video here is muted, the call's own <audio> keeps playing.
 */
import type { CallControls } from '@/lib/activities/call-media';

export type CallPipMode = 'document' | 'composed';

interface DocPipApi {
  requestWindow(opts?: { width?: number; height?: number }): Promise<Window>;
  window: Window | null;
}
type WebkitVideo = HTMLVideoElement & {
  webkitSupportsPresentationMode?: (mode: string) => boolean;
  webkitSetPresentationMode?: (mode: string) => void;
  webkitPresentationMode?: string;
};

const docPip = (): DocPipApi | null =>
  typeof window !== 'undefined' && 'documentPictureInPicture' in window ? ((window as unknown as { documentPictureInPicture: DocPipApi }).documentPictureInPicture) : null;

function videoPipSupported(): boolean {
  if (typeof document === 'undefined') return false;
  const v = document.createElement('video') as WebkitVideo;
  const standard = 'pictureInPictureEnabled' in document && !!document.pictureInPictureEnabled && typeof v.requestPictureInPicture === 'function';
  const webkit = typeof v.webkitSupportsPresentationMode === 'function' && v.webkitSupportsPresentationMode('picture-in-picture');
  return standard || webkit;
}

function canvasCaptureSupported(): boolean {
  return typeof document !== 'undefined' && typeof (document.createElement('canvas') as HTMLCanvasElement & { captureStream?: unknown }).captureStream === 'function';
}

/** Which mode this browser can give, or null (then no picture-in-picture button is shown). */
export function callPipMode(): CallPipMode | null {
  if (docPip()) return 'document';
  if (videoPipSupported() && canvasCaptureSupported()) return 'composed';
  return null;
}

export interface CallPipInput {
  remote: MediaStream | null;
  local: MediaStream | null;
  controls: CallControls | null;
  micMuted?: boolean;
  cameraOff?: boolean;
  /** Called with false when the floating window closes for any reason. */
  onChange: (open: boolean) => void;
}

interface Session {
  mode: CallPipMode;
  update: (remote: MediaStream | null, local: MediaStream | null) => void;
  close: () => void;
}
let session: Session | null = null;

export const callPipOpen = () => session !== null;

/** Inset geometry shared by both modes: bottom-right, 30 % of the width, 4:3 or the camera's ratio. */
export const INSET = { widthShare: 0.3, margin: 12, radius: 12 } as const;

const liveVideo = (s: MediaStream | null) => !!s && s.getVideoTracks().some((t) => t.readyState === 'live' && t.enabled);

function makeVideo(doc: Document, stream: MediaStream | null, mirror: boolean): HTMLVideoElement {
  const v = doc.createElement('video');
  v.autoplay = true;
  v.muted = true;
  v.playsInline = true;
  v.setAttribute('playsinline', '');
  v.srcObject = stream;
  if (mirror) v.style.transform = 'scaleX(-1)';
  void v.play().catch(() => undefined);
  return v;
}

// ---- 1. Document Picture-in-Picture ---------------------------------------------------------

function button(doc: Document, label: string, path: string, onClick: () => void, danger = false): HTMLButtonElement {
  const b = doc.createElement('button');
  b.type = 'button';
  b.setAttribute('aria-label', label);
  b.title = label;
  b.style.cssText = `width:40px;height:40px;border-radius:20px;border:1px solid ${danger ? '#FF3B30' : '#E4E7EC'};background:${danger ? '#FF3B30' : '#FFFFFF'};display:grid;place-items:center;cursor:pointer;padding:0`;
  b.innerHTML = `<svg width="20" height="20" viewBox="0 0 20 20" fill="none" stroke="${danger ? '#FFFFFF' : '#15171C'}" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${path}</svg>`;
  b.addEventListener('click', onClick);
  return b;
}

const ICON = {
  mic: '<rect x="7" y="2.5" width="6" height="10" rx="3"/><path d="M4.5 9.5a5.5 5.5 0 0 0 11 0M10 15v2.5"/>',
  camera: '<rect x="2.5" y="5.5" width="10.5" height="9" rx="2"/><path d="M13 8.5l4.5-2.5v8L13 11.5"/>',
  end: '<path d="M3 11.5c4.2-3.6 9.8-3.6 14 0l-1.6 2.1-2.9-1.1v-2a8.4 8.4 0 0 0-5 0v2l-2.9 1.1z"/>',
};

async function openDocument(input: CallPipInput): Promise<Session | null> {
  const api = docPip();
  if (!api) return null;
  let win: Window;
  try {
    win = await api.requestWindow({ width: 360, height: 300 });
  } catch {
    return null; // no user gesture, or refused
  }
  const doc = win.document;
  doc.title = 'Ledger Chat call';
  doc.body.style.cssText = 'margin:0;background:#15171C;font:13px system-ui,sans-serif;overflow:hidden';
  const stage = doc.createElement('div');
  stage.style.cssText = 'position:fixed;inset:0';
  const remoteEl = makeVideo(doc, input.remote, false);
  remoteEl.style.cssText = 'position:absolute;inset:0;width:100%;height:100%;object-fit:cover;background:#15171C';
  const selfBox = doc.createElement('div');
  selfBox.style.cssText = `position:absolute;right:${INSET.margin}px;bottom:${INSET.margin + 52}px;width:${INSET.widthShare * 100}%;aspect-ratio:3/4;border-radius:${INSET.radius}px;overflow:hidden;border:1px solid #E4E7EC;background:#15171C`;
  const selfEl = makeVideo(doc, input.local, true);
  selfEl.style.cssText += ';width:100%;height:100%;object-fit:cover';
  selfBox.appendChild(selfEl);
  const bar = doc.createElement('div');
  bar.style.cssText = 'position:absolute;left:0;right:0;bottom:0;height:56px;display:flex;align-items:center;justify-content:center;gap:12px;background:#FFFFFF;border-top:1px solid #E4E7EC';
  const c = input.controls;
  if (c) {
    bar.appendChild(button(doc, 'Mute or unmute microphone', ICON.mic, () => c.toggleMic()));
    if (c.toggleCamera) bar.appendChild(button(doc, 'Turn camera on or off', ICON.camera, () => c.toggleCamera?.()));
    bar.appendChild(button(doc, 'End call', ICON.end, () => c.end(), true));
  }
  stage.append(remoteEl, selfBox, bar);
  doc.body.appendChild(stage);

  const update = (remote: MediaStream | null, local: MediaStream | null) => {
    if (remoteEl.srcObject !== remote) { remoteEl.srcObject = remote; void remoteEl.play().catch(() => undefined); }
    if (selfEl.srcObject !== local) { selfEl.srcObject = local; void selfEl.play().catch(() => undefined); }
    selfBox.style.display = liveVideo(local) ? 'block' : 'none';
  };
  update(input.remote, input.local);
  let closed = false;
  const close = () => {
    if (closed) return;
    closed = true;
    try { win.close(); } catch { /* already closed */ }
  };
  win.addEventListener('pagehide', () => { closed = true; if (session?.mode === 'document') session = null; input.onChange(false); }, { once: true });
  return { mode: 'document', update, close };
}

// ---- 2. Composed video -----------------------------------------------------------------------

function ticker(fps: number, onTick: () => void): () => void {
  // A worker's timer keeps its pace when the tab is hidden; a page timer drops to about 1 Hz.
  try {
    const src = `let t=setInterval(()=>postMessage(0),${Math.round(1000 / fps)});onmessage=()=>{clearInterval(t);close()}`;
    const url = URL.createObjectURL(new Blob([src], { type: 'text/javascript' }));
    const w = new Worker(url);
    w.onmessage = onTick;
    return () => { w.postMessage(0); w.terminate(); URL.revokeObjectURL(url); };
  } catch {
    const t = setInterval(onTick, Math.round(1000 / fps));
    return () => clearInterval(t);
  }
}

function drawCover(ctx: CanvasRenderingContext2D, v: HTMLVideoElement, x: number, y: number, w: number, h: number, mirror: boolean) {
  const vw = v.videoWidth, vh = v.videoHeight;
  if (!vw || !vh) return false;
  const scale = Math.max(w / vw, h / vh);
  const sw = w / scale, sh = h / scale;
  const sx = (vw - sw) / 2, sy = (vh - sh) / 2;
  ctx.save();
  if (mirror) { ctx.translate(x + w, y); ctx.scale(-1, 1); ctx.drawImage(v, sx, sy, sw, sh, 0, 0, w, h); }
  else ctx.drawImage(v, sx, sy, sw, sh, x, y, w, h);
  ctx.restore();
  return true;
}

function roundRect(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r: number) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y, x + w, y + h, r);
  ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r);
  ctx.arcTo(x, y, x + w, y, r);
  ctx.closePath();
}

/** One composed frame: remote cover, then our inset (mirrored) when our camera sends. Exported for the test. */
export function composeFrame(ctx: CanvasRenderingContext2D, W: number, H: number, remoteEl: HTMLVideoElement, selfEl: HTMLVideoElement, selfOn: boolean) {
  ctx.fillStyle = '#15171C';
  ctx.fillRect(0, 0, W, H);
  drawCover(ctx, remoteEl, 0, 0, W, H, false);
  if (!selfOn) return;
  const iw = Math.round(W * INSET.widthShare);
  const ih = Math.round(iw * 4 / 3 > H * 0.5 ? H * 0.5 : iw * 4 / 3);
  const ix = W - iw - INSET.margin, iy = H - ih - INSET.margin;
  ctx.save();
  roundRect(ctx, ix, iy, iw, ih, INSET.radius);
  ctx.clip();
  ctx.fillStyle = '#15171C';
  ctx.fillRect(ix, iy, iw, ih);
  drawCover(ctx, selfEl, ix, iy, iw, ih, true);
  ctx.restore();
  ctx.strokeStyle = '#E4E7EC';
  ctx.lineWidth = 2;
  roundRect(ctx, ix, iy, iw, ih, INSET.radius);
  ctx.stroke();
}

async function openComposed(input: CallPipInput): Promise<Session | null> {
  if (!videoPipSupported() || !canvasCaptureSupported()) return null;
  const W = 640, H = 360;
  const host = document.createElement('div');
  // In the DOM (Safari decodes and allows picture in picture only for attached videos), not visible.
  host.style.cssText = 'position:fixed;left:0;bottom:0;width:2px;height:2px;opacity:0.01;pointer-events:none;overflow:hidden;z-index:-1';
  host.setAttribute('aria-hidden', 'true');
  const remoteEl = makeVideo(document, input.remote, false);
  const selfEl = makeVideo(document, input.local, false);
  const canvas = document.createElement('canvas');
  canvas.width = W;
  canvas.height = H;
  const ctx = canvas.getContext('2d');
  const out = document.createElement('video') as WebkitVideo;
  out.muted = true;
  out.playsInline = true;
  out.setAttribute('playsinline', '');
  host.append(remoteEl, selfEl, canvas, out);
  document.body.appendChild(host);
  if (!ctx) { host.remove(); return null; }

  let local = input.local;
  const draw = () => composeFrame(ctx, W, H, remoteEl, selfEl, liveVideo(local));
  draw();
  const stopTicks = ticker(24, draw);
  const stream = (canvas as HTMLCanvasElement & { captureStream(fps?: number): MediaStream }).captureStream(24);
  out.srcObject = stream;
  let closed = false;
  const cleanup = () => {
    if (closed) return;
    closed = true;
    stopTicks();
    stream.getTracks().forEach((t) => t.stop());
    host.remove();
    if (session?.mode === 'composed') session = null;
    input.onChange(false);
  };
  out.addEventListener('leavepictureinpicture', cleanup);
  out.addEventListener('webkitpresentationmodechanged', () => { if (out.webkitPresentationMode !== 'picture-in-picture') cleanup(); });
  try {
    await out.play();
    if (typeof out.requestPictureInPicture === 'function' && document.pictureInPictureEnabled) await out.requestPictureInPicture();
    else if (typeof out.webkitSetPresentationMode === 'function') out.webkitSetPresentationMode('picture-in-picture');
    else throw new Error('no picture in picture');
  } catch {
    closed = true;
    stopTicks();
    stream.getTracks().forEach((t) => t.stop());
    host.remove();
    return null;
  }
  const update = (remote: MediaStream | null, l: MediaStream | null) => {
    local = l;
    if (remoteEl.srcObject !== remote) { remoteEl.srcObject = remote; void remoteEl.play().catch(() => undefined); }
    if (selfEl.srcObject !== l) { selfEl.srcObject = l; void selfEl.play().catch(() => undefined); }
  };
  const close = () => {
    try {
      if (document.pictureInPictureElement === out) void document.exitPictureInPicture();
      else if (out.webkitPresentationMode === 'picture-in-picture') out.webkitSetPresentationMode?.('inline');
    } catch { /* already closed */ }
    cleanup();
  };
  return { mode: 'composed', update, close };
}

// ---- public API ------------------------------------------------------------------------------

/** Opens picture in picture with both faces. Must run inside a user gesture or the browser's auto-PiP handler. */
export async function enterCallPip(input: CallPipInput): Promise<CallPipMode | null> {
  if (session) { session.update(input.remote, input.local); return session.mode; }
  const s = (await openDocument(input)) ?? (await openComposed(input));
  if (!s) return null;
  session = s;
  input.onChange(true);
  return s.mode;
}

/** Keeps the floating window on the current streams (camera toggled, remote renegotiated). */
export function updateCallPip(remote: MediaStream | null, local: MediaStream | null) {
  session?.update(remote, local);
}

export function exitCallPip() {
  const s = session;
  session = null;
  s?.close();
}
