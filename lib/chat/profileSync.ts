// Your public profile (name, bio, photo). Saved in three places so it shows
// up everywhere it should: the settings engine (synced to your other
// devices), localStorage (read by older screens) and the server profile
// that other people's apps fetch.

export interface PublicProfilePatch {
  displayName?: string;
  bio?: string;
  avatarUrl?: string;
}

/** The server accepts avatars up to 500 KB of data URL; aim far below it. */
export const AVATAR_MAX_EDGE = 320;

export async function downscaleAvatar(file: File, maxEdge = AVATAR_MAX_EDGE): Promise<string> {
  const src = await new Promise<string>((resolve, reject) => {
    const r = new FileReader();
    r.onload = () => resolve(String(r.result || ''));
    r.onerror = () => reject(new Error('Could not read the photo.'));
    r.readAsDataURL(file);
  });
  const img = await new Promise<HTMLImageElement>((resolve, reject) => {
    const i = new Image();
    i.onload = () => resolve(i);
    i.onerror = () => reject(new Error('That file is not an image we can open.'));
    i.src = src;
  });
  // Centre-crop to a square so the round avatar never shows a squashed face.
  const side = Math.min(img.naturalWidth, img.naturalHeight);
  const sx = (img.naturalWidth - side) / 2;
  const sy = (img.naturalHeight - side) / 2;
  const edge = Math.min(maxEdge, side);
  const canvas = document.createElement('canvas');
  canvas.width = edge;
  canvas.height = edge;
  const ctx = canvas.getContext('2d');
  if (!ctx) return src;
  ctx.imageSmoothingQuality = 'high';
  ctx.drawImage(img, sx, sy, side, side, 0, 0, edge, edge);
  return canvas.toDataURL('image/jpeg', 0.86);
}

export async function pushPublicProfile(walletAddress: string, patch: PublicProfilePatch): Promise<{ ok: boolean; error?: string }> {
  try {
    const res = await fetch('/api/user/profile', {
      method: 'PUT',
      credentials: 'include',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ walletAddress, ...patch }),
    });
    if (res.ok) return { ok: true };
    const body = await res.json().catch(() => ({}));
    return { ok: false, error: typeof body?.error === 'string' ? body.error : `HTTP ${res.status}` };
  } catch {
    return { ok: false, error: 'offline' };
  }
}
