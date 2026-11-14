/**
 * lib/chat/compress-image.ts — photos re-encoded in the browser before they are sent.
 *
 * A phone photo is 2–8 MB. Re-encoded as JPEG at up to 2048 px it is usually a few hundred KB,
 * sends faster, and fits the inline path (700 KB) when file storage is unavailable. Re-encoding
 * also drops the photo's metadata (EXIF), including the GPS position a camera may have written.
 *
 * Only still photos are touched (JPEG, HEIC/HEIF, WebP, and PNG over the target). GIFs keep their
 * animation, SVGs are not raster images, and anything that fails to decode is sent as it was.
 */

const PHOTO = /^image\/(jpeg|jpg|pjpeg|heic|heif|webp|png)$/;

/** The longest side and JPEG quality tried in turn until the result fits the target. */
const STEPS: Array<[number, number]> = [
  [2048, 0.85],
  [2048, 0.75],
  [1600, 0.72],
  [1280, 0.7],
  [1024, 0.68],
];

export function isCompressiblePhoto(mime: string, size: number, targetBytes: number): boolean {
  if (!PHOTO.test(mime)) return false;
  // A PNG is kept as it is (it may be a screenshot with sharp text, or transparent) unless too big.
  if (mime === 'image/png') return size > targetBytes;
  return true;
}

function encode(canvas: HTMLCanvasElement, quality: number): Promise<Blob | null> {
  return new Promise((resolve) => canvas.toBlob((b) => resolve(b), 'image/jpeg', quality));
}

/**
 * Returns a JPEG no larger than `targetBytes`, or null when the browser cannot decode the image or
 * no step gets it under the target (the caller then sends the original, or refuses it).
 */
export async function shrinkPhoto(file: Blob, targetBytes: number): Promise<Blob | null> {
  if (typeof document === 'undefined' || typeof createImageBitmap !== 'function') return null;
  let bitmap: ImageBitmap;
  try {
    bitmap = await createImageBitmap(file, { imageOrientation: 'from-image' } as ImageBitmapOptions);
  } catch {
    return null;
  }
  try {
    for (const [maxSide, quality] of STEPS) {
      const scale = Math.min(1, maxSide / Math.max(bitmap.width, bitmap.height));
      const w = Math.max(1, Math.round(bitmap.width * scale));
      const h = Math.max(1, Math.round(bitmap.height * scale));
      const canvas = document.createElement('canvas');
      canvas.width = w;
      canvas.height = h;
      const ctx = canvas.getContext('2d');
      if (!ctx) return null;
      // JPEG has no transparency: a white background instead of black.
      ctx.fillStyle = '#ffffff';
      ctx.fillRect(0, 0, w, h);
      ctx.drawImage(bitmap, 0, 0, w, h);
      const blob = await encode(canvas, quality);
      if (blob && blob.size > 0 && blob.size <= targetBytes) return blob;
    }
    return null;
  } finally {
    bitmap.close?.();
  }
}
