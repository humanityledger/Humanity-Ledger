/**
 * Attachment Storage — P0 #8: No blobs in database.
 * 
 * Strategy:
 * 1. If CLOUDFLARE_R2_* env vars are set → upload to R2, return URL
 * 2. Fallback → base64 inline (dev only, limited to 512KB)
 */

export interface StoredAttachment {
  url: string;          // Public URL or data: URL for fallback
  key: string;          // Storage key for deletion
  size: number;         // bytes
  mimeType: string;
  encrypted: boolean;   // Whether the file is client-side encrypted
  storageBackend: 'r2' | 'supabase' | 'inline';
}

export async function uploadAttachment(
  file: File,
  walletAddress: string
): Promise<StoredAttachment> {
  const maxInlineSize = 512 * 1024; // 512KB

  // Check available backend
  const hasR2 = !!(process.env.NEXT_PUBLIC_R2_ENDPOINT && process.env.NEXT_PUBLIC_R2_BUCKET);

  if (!hasR2 || file.size > maxInlineSize * 100) {
    // Try to upload to server API
    const formData = new FormData();
    formData.append('file', file);
    formData.append('wallet', walletAddress);
    const res = await fetch('/api/storage/upload', { method: 'POST', body: formData });
    if (res.ok) {
      const data = await res.json();
      if (data.url) {
        return {
          url: data.url,
          key: data.key,
          size: file.size,
          mimeType: file.type,
          encrypted: false,
          storageBackend: 'r2'
        };
      }
    }
  }

  // Fallback: inline base64 (dev/small files)
  if (file.size > maxInlineSize) {
    throw new Error(`File too large for inline storage (${(file.size / 1024).toFixed(0)}KB > 512KB). Configure object storage for larger files.`);
  }

  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      resolve({
        url: reader.result as string,
        key: `inline-${Date.now()}`,
        size: file.size,
        mimeType: file.type,
        encrypted: false,
        storageBackend: 'inline'
      });
    };
    reader.onerror = () => reject(new Error('Failed to read file'));
    reader.readAsDataURL(file);
  });
}

export function formatAttachmentMessage(attachment: StoredAttachment): string {
  return `__MEDIA__${JSON.stringify({
    url: attachment.url,
    mime: attachment.mimeType,
    size: attachment.size,
    backend: attachment.storageBackend
  })}`;
}
