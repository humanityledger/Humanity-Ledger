/**
 * lib/chat/safety-glyphs.ts — the pattern two people compare to check a chat.
 *
 * XMTP encrypts a conversation to every device (installation) registered on
 * each person's inbox. Someone who manages to add a device to either inbox
 * could read what is sent afterwards. The safety glyphs are a digest of both
 * inboxes and the devices on them: both people see the same pattern while
 * nothing has changed, and a different one as soon as a device is added or
 * removed on either side.
 *
 * The digest is SHA-256 over a canonical text: the two inboxes in sorted
 * order, each followed by its sorted installation ids.
 */

export const GLYPH_RAMP = ['·', ':', 'I', 'T', '7', 'Z'] as const;
export const GLYPH_COUNT = 48;

export interface InboxDevices {
  inboxId: string;
  installationIds: string[];
}

export function canonicalSafetyText(a: InboxDevices, b: InboxDevices): string {
  const norm = (x: InboxDevices) =>
    `${x.inboxId.toLowerCase()}:${[...new Set(x.installationIds.map((i) => i.toLowerCase()))].sort().join(',')}`;
  return [norm(a), norm(b)].sort().join('|');
}

/** 48 glyphs from the digest; the same on both sides because the text is canonical. */
export async function safetyGlyphs(a: InboxDevices, b: InboxDevices): Promise<string[]> {
  const data = new TextEncoder().encode('ledger-chat-safety-v1|' + canonicalSafetyText(a, b));
  const digest = new Uint8Array(await crypto.subtle.digest('SHA-256', data));
  // 32 bytes give 64 nibbles; each glyph takes one byte-pair mix so all 32 bytes count.
  const out: string[] = [];
  for (let i = 0; i < GLYPH_COUNT; i++) {
    const v = digest[i % 32] ^ (digest[(i * 7 + 3) % 32] >> (i % 5));
    out.push(GLYPH_RAMP[v % GLYPH_RAMP.length]);
  }
  return out;
}
