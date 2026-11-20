'use client';
/**
 * The floating call window. It draws the one call that the island and the stage also know about
 * (same activity, same streams): it never owns media and never ends a call by itself.
 *
 * Placement
 *   It always rests in one of four corners, inside the visible area: below the island, inside the
 *   safe areas and above an open keyboard (lib/activities/geometry.ts). Drag or throw it and it
 *   lands in the nearest corner; the corner is remembered on this device.
 * Keyboard (focus the window)
 *   Arrow keys  move to the next corner      Enter   open the full call
 *   + / -       larger / smaller (video)     Escape  put it back in the island
 * Browser picture in picture (components/activities/callPip.ts)
 *   Where the browser offers it, the call leaves the page with BOTH faces: the other person fills the
 *   floating window and our camera is an inset in its corner (Document Picture-in-Picture on Chrome
 *   and Edge desktop, a composed video on Safari and Chrome on Android). Where neither exists the
 *   button is not shown. While it is out, this window shows the controls only.
 */
import React, { useCallback, useEffect, useRef, useState } from 'react';
import { animate, motion, useMotionValue, type PanInfo } from 'framer-motion';
import { Camera, CameraOff, Maximize2, Mic, MicOff, Minimize2, PhoneOff, PictureInPicture2, Plus, Minus } from 'lucide-react';
import { useActivities } from '@/lib/activities/store';
import { windowCall } from '@/lib/activities/priority';
import { attachStream, hasLiveVideo, useCallMedia } from '@/lib/activities/call-media';
import { CORNER_LABEL, cornerByKey, cornerPoint, nearestCorner, windowBox, type Corner, type WindowSize } from '@/lib/activities/geometry';
import { formatElapsed, spokenDuration } from '@/lib/activities/values';
import { callPipMode, enterCallPip, exitCallPip, updateCallPip } from './callPip';
import { setAutoPip } from './mediaSession';
import { CALL_SURFACE_ID } from './Island';
import { initials } from './presentations';
import { useMotionPreset } from './motion';
import { useNow } from './useNow';
import { useViewport } from './useViewport';
import s from './activities.module.css';

const CORNER_KEY = 'hl_call_window_corner';
const SIZE_KEY = 'hl_call_window_size';
const read = <T extends string>(k: string, ok: readonly T[], fallback: T): T => {
  try { const v = localStorage.getItem(k) as T | null; return v && ok.includes(v) ? v : fallback; } catch { return fallback; }
};
const write = (k: string, v: string) => { try { localStorage.setItem(k, v); } catch { /* private mode */ } };

const I = { size: 16, strokeWidth: 2, 'aria-hidden': true } as const;

export function CallWindow({ announce }: { announce: (text: string) => void }) {
  const activities = useActivities((st) => st.activities);
  const presentation = useActivities((st) => st.presentation);
  const setPresentation = useActivities((st) => st.setPresentation);
  const call = windowCall(activities, presentation);
  const { remote, local, controls, inBrowserPip, setInBrowserPip } = useCallMedia();
  const vp = useViewport();
  const motionPreset = useMotionPreset();
  const now = useNow(!!call?.state.connectedAt);

  const [corner, setCorner] = useState<Corner>(() => read<Corner>(CORNER_KEY, ['top-left', 'top-right', 'bottom-left', 'bottom-right'], 'top-right'));
  const [size, setSize] = useState<WindowSize>(() => read<WindowSize>(SIZE_KEY, ['small', 'large'], 'small'));
  const [chrome, setChrome] = useState(false); // controls shown after a tap on touch screens
  const x = useMotionValue(0);
  const y = useMotionValue(0);
  const placed = useRef(false);
  const dragging = useRef(false);
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const selfRef = useRef<HTMLVideoElement | null>(null);

  const video = !!call && call.attributes.media === 'video' && (hasLiveVideo(remote) || call.state.remoteVideo);
  // The window renders nothing until the viewport is measured; effects that touch its elements
  // wait for `ready` (otherwise they would run once against a missing <video> and never again).
  const ready = !!call && !!vp;
  const box = vp ? windowBox(video && !inBrowserPip ? 'video' : 'voice', size, vp) : { width: 0, height: 0 };

  // Rest in the corner; jump there the first time, glide there after (resize, keyboard, size).
  useEffect(() => {
    if (!vp || !call || dragging.current) return;
    const p = cornerPoint(corner, box, vp);
    if (!placed.current || motionPreset.reduced) { x.set(p.x); y.set(p.y); placed.current = true; return; }
    const ax = animate(x, p.x, motionPreset.throw);
    const ay = animate(y, p.y, motionPreset.throw);
    return () => { ax.stop(); ay.stop(); };
  }, [vp, corner, box.width, box.height, !!call]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => { if (!call) placed.current = false; }, [call]);

  // Streams onto the elements; the self view only when our camera sends.
  useEffect(() => { attachStream(videoRef.current, video ? remote : null); }, [ready, remote, video, inBrowserPip]);
  useEffect(() => { attachStream(selfRef.current, hasLiveVideo(local) ? local : null); }, [ready, local, size, video, inBrowserPip]);

  const [pipAvailable, setPipAvailable] = useState(false);
  useEffect(() => { setPipAvailable(video && callPipMode() !== null); }, [ready, video]);

  // Both faces, always: the floating window gets the remote video AND our camera (callPip.ts).
  const openPip = useCallback(() => {
    void enterCallPip({
      remote,
      local,
      controls,
      onChange: (on) => {
        setInBrowserPip(on);
        announce(on ? 'The call is in picture in picture, with both cameras' : 'The call is back in the window');
      },
    });
  }, [remote, local, controls, setInBrowserPip, announce]);

  // Keep the floating window on the current streams (camera toggled, remote renegotiated).
  useEffect(() => { if (inBrowserPip) updateCallPip(video ? remote : null, hasLiveVideo(local) ? local : null); }, [inBrowserPip, remote, local, video]);
  // The call ended or stopped being a video call: close the floating window with it.
  useEffect(() => { if ((!call || !video) && inBrowserPip) exitCallPip(); }, [call, video, inBrowserPip]);
  useEffect(() => () => exitCallPip(), []);

  // Chrome and Edge can open picture in picture by themselves when the tab is hidden.
  useEffect(() => {
    if (!video) return;
    setAutoPip(openPip);
    return () => setAutoPip(null);
  }, [ready, video, openPip]);

  const moveTo = useCallback((c: Corner) => {
    setCorner(c);
    write(CORNER_KEY, c);
    announce(`Call window moved to the ${CORNER_LABEL[c]}`);
  }, [announce]);

  const onDragEnd = (_: unknown, info: PanInfo) => {
    dragging.current = false;
    if (!vp) return;
    const c = nearestCorner({ x: x.get() + box.width / 2, y: y.get() + box.height / 2 }, info.velocity, vp);
    const p = cornerPoint(c, box, vp);
    // The landing keeps the throw's speed, so the window glides into the corner instead of stopping.
    if (motionPreset.reduced) { x.set(p.x); y.set(p.y); }
    else {
      animate(x, p.x, { type: 'spring', stiffness: 360, damping: 30, mass: 1, velocity: info.velocity.x });
      animate(y, p.y, { type: 'spring', stiffness: 360, damping: 30, mass: 1, velocity: info.velocity.y });
    }
    if (c !== corner) moveTo(c);
  };

  const resize = (next: WindowSize) => {
    if (next === size) return;
    setSize(next);
    write(SIZE_KEY, next);
    announce(next === 'large' ? 'Larger call window' : 'Smaller call window');
  };

  const onKeyDown = (e: React.KeyboardEvent) => {
    if (e.target !== e.currentTarget) return; // keys on a button stay that button's
    const next = cornerByKey(corner, e.key);
    if (next) { e.preventDefault(); moveTo(next); return; }
    if (e.key === 'Enter') { e.preventDefault(); controls?.openStage(); }
    else if (e.key === 'Escape') { e.preventDefault(); setPresentation('island'); }
    else if (e.key === '+' || e.key === '=') { e.preventDefault(); resize('large'); }
    else if (e.key === '-') { e.preventDefault(); resize('small'); }
  };

  if (!call || !vp) return null;

  const peer = call.attributes.peer;
  const { phase, connectedAt, micMuted, cameraOff } = call.state;
  const warn = phase === 'reconnecting';
  const timer = connectedAt ? formatElapsed(now - connectedAt) : phase === 'outgoing' ? 'Calling' : 'Connecting';
  const spoken = `Call with ${peer}, ${warn ? 'reconnecting' : connectedAt ? spokenDuration(now - connectedAt) : timer.toLowerCase()}${micMuted ? ', muted' : ''}. Arrow keys move the window, Enter opens the full call, Escape puts it in the island.`;
  const showChrome = chrome || dragging.current;

  return (
    <motion.div
      key="call-window"
      layoutId={CALL_SURFACE_ID}
      className={`${s.window} ${video && !inBrowserPip ? s.video : s.voice}`}
      style={{ x, y, width: box.width, height: box.height, borderRadius: 20 }}
      drag
      dragMomentum={false}
      dragElastic={0.14}
      dragConstraints={{ left: vp.insets.left, top: vp.offsetTop, right: vp.width - box.width - vp.insets.right, bottom: vp.offsetTop + vp.height - box.height }}
      onDragStart={() => { dragging.current = true; }}
      onDragEnd={onDragEnd}
      onTap={(e) => { if (!(e.target as Element | null)?.closest?.('button')) setChrome((v) => !v); }}
      onHoverStart={() => setChrome(true)}
      onHoverEnd={() => setChrome(false)}
      onFocus={() => setChrome(true)}
      transition={motionPreset.morph}
      initial={motionPreset.appear.initial}
      animate={motionPreset.appear.animate}
      exit={motionPreset.appear.exit}
      tabIndex={0}
      role="group"
      aria-roledescription="Floating call window"
      aria-label={spoken}
      onKeyDown={onKeyDown}
      onDoubleClick={() => controls?.openStage()}
    >
      {/* Mounted for every video call, even while in picture in picture: removing it would close it. */}
      {call.attributes.media === 'video' && (
        <video ref={videoRef} className={s.videoEl} autoPlay playsInline muted aria-hidden="true" style={{ opacity: video && !inBrowserPip ? 1 : 0 }} />
      )}

      {video && !inBrowserPip ? (
        <>
          {hasLiveVideo(local) && size === 'large' && (
            <div className={s.selfView} aria-hidden="true"><video ref={selfRef} autoPlay playsInline muted /></div>
          )}
          <span className={s.chip} aria-hidden="true">
            <span className={`${s.chipDot} ${warn ? s.chipDotWarn : ''}`} />
            {warn ? 'Reconnecting' : timer}
          </span>
          <motion.div
            className={s.bar}
            initial={false}
            animate={{ opacity: showChrome ? 1 : 0, y: showChrome ? 0 : 8 }}
            transition={{ duration: 0.18 }}
            style={{ pointerEvents: showChrome ? 'auto' : 'none' }}
          >
            <button type="button" className={`${s.barBtn} ${micMuted ? s.barBtnOn : ''}`} onClick={controls?.toggleMic} aria-pressed={micMuted} aria-label={micMuted ? 'Unmute' : 'Mute'}>
              {micMuted ? <MicOff {...I} /> : <Mic {...I} />}
            </button>
            {controls?.toggleCamera && (
              <button type="button" className={`${s.barBtn} ${cameraOff ? s.barBtnOn : ''}`} onClick={controls.toggleCamera} aria-pressed={cameraOff} aria-label={cameraOff ? 'Turn camera on' : 'Turn camera off'}>
                {cameraOff ? <CameraOff {...I} /> : <Camera {...I} />}
              </button>
            )}
            {pipAvailable && (
              <button type="button" className={s.barBtn} onClick={openPip} aria-label="Picture in picture, with both cameras">
                <PictureInPicture2 {...I} />
              </button>
            )}
            <button type="button" className={s.barBtn} onClick={() => resize(size === 'small' ? 'large' : 'small')} aria-label={size === 'small' ? 'Larger window' : 'Smaller window'}>
              {size === 'small' ? <Plus {...I} /> : <Minus {...I} />}
            </button>
            <button type="button" className={s.barBtn} onClick={controls?.openStage} aria-label="Open the full call">
              <Maximize2 {...I} />
            </button>
            <button type="button" className={`${s.barBtn} ${s.barBtnDanger}`} onClick={controls?.end} aria-label="End call">
              <PhoneOff {...I} />
            </button>
          </motion.div>
        </>
      ) : (
        <>
          <span className={s.voiceAvatar} aria-hidden="true">
            {initials(peer)}
            <span className={`${s.voiceLive} ${warn ? s.voiceLiveWarn : ''}`} />
          </span>
          <div className={s.voiceText}>
            <p className={s.voiceName}>{peer}</p>
            <p className={s.voiceTime}>{inBrowserPip ? 'In picture in picture' : warn ? 'Reconnecting…' : timer}</p>
          </div>
          <button type="button" className={`${s.vBtn} ${micMuted ? s.vBtnOn : ''}`} onClick={controls?.toggleMic} aria-pressed={micMuted} aria-label={micMuted ? 'Unmute' : 'Mute'}>
            {micMuted ? <MicOff {...I} /> : <Mic {...I} />}
          </button>
          <button type="button" className={s.vBtn} onClick={() => setPresentation('island')} aria-label="Put the call in the island">
            <Minimize2 {...I} />
          </button>
          <button type="button" className={s.vBtn} onClick={controls?.openStage} aria-label="Open the full call">
            <Maximize2 {...I} />
          </button>
          <button type="button" className={`${s.vBtn} ${s.vBtnDanger}`} onClick={controls?.end} aria-label="End call">
            <PhoneOff {...I} />
          </button>
        </>
      )}
    </motion.div>
  );
}
