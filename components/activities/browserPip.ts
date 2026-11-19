'use client';
/**
 * The browser's own picture in picture for a <video>: the standard API (Chrome, Edge, Firefox on
 * desktop, Chrome on Android, Safari on macOS) or WebKit's presentation mode (Safari on iOS).
 * Returns null where neither exists, and the call window stays as it is.
 */

type WebkitVideo = HTMLVideoElement & {
  webkitSupportsPresentationMode?: (mode: string) => boolean;
  webkitSetPresentationMode?: (mode: string) => void;
  webkitPresentationMode?: string;
};

export function canBrowserPip(el: HTMLVideoElement | null): boolean {
  if (!el || typeof document === 'undefined') return false;
  if ('pictureInPictureEnabled' in document && document.pictureInPictureEnabled && typeof el.requestPictureInPicture === 'function') return true;
  const w = el as WebkitVideo;
  return typeof w.webkitSupportsPresentationMode === 'function' && w.webkitSupportsPresentationMode('picture-in-picture');
}

export async function enterBrowserPip(el: HTMLVideoElement): Promise<boolean> {
  try {
    if ('pictureInPictureEnabled' in document && document.pictureInPictureEnabled && typeof el.requestPictureInPicture === 'function') {
      await el.requestPictureInPicture();
      return true;
    }
    const w = el as WebkitVideo;
    if (typeof w.webkitSetPresentationMode === 'function') {
      w.webkitSetPresentationMode('picture-in-picture');
      return true;
    }
  } catch {
    // Refused (no user gesture, or the video has no frame yet): stay in the window.
  }
  return false;
}

export async function exitBrowserPip(el: HTMLVideoElement | null) {
  try {
    if (typeof document !== 'undefined' && document.pictureInPictureElement) await document.exitPictureInPicture();
    const w = el as WebkitVideo | null;
    if (w?.webkitPresentationMode === 'picture-in-picture') w.webkitSetPresentationMode?.('inline');
  } catch {
    /* already closed */
  }
}

/** Calls `onChange(true|false)` when this element enters or leaves picture in picture. */
export function watchBrowserPip(el: HTMLVideoElement, onChange: (on: boolean) => void): () => void {
  const enter = () => onChange(true);
  const leave = () => onChange(false);
  const webkit = () => onChange((el as WebkitVideo).webkitPresentationMode === 'picture-in-picture');
  el.addEventListener('enterpictureinpicture', enter);
  el.addEventListener('leavepictureinpicture', leave);
  el.addEventListener('webkitpresentationmodechanged', webkit);
  return () => {
    el.removeEventListener('enterpictureinpicture', enter);
    el.removeEventListener('leavepictureinpicture', leave);
    el.removeEventListener('webkitpresentationmodechanged', webkit);
  };
}
