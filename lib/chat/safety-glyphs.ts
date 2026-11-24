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

/**
 * The same digest as 60 digits in 12 groups of 5, for people who prefer to read numbers aloud.
 * Both people get the same digits while neither inbox has gained or lost a device.
 */
export async function safetyDigits(a: InboxDevices, b: InboxDevices): Promise<string> {
  const data = new TextEncoder().encode('ledger-chat-safety-v1|' + canonicalSafetyText(a, b));
  const d = new Uint8Array(await crypto.subtle.digest('SHA-256', data));
  const groups: string[] = [];
  for (let i = 0; i < 12; i++) {
    // 5 digits from 20 bits; 12 × 20 = 240 of the digest's 256 bits.
    const bit = i * 20;
    const byte = bit >> 3;
    const v = ((d[byte] << 16) | (d[byte + 1] << 8) | d[byte + 2]) >> (4 - (bit & 7)) & 0xfffff;
    groups.push(String(v % 100000).padStart(5, '0'));
  }
  return groups.join(' ');
}

/** Looks up both inboxes and their devices through a signed-in XMTP client. Null if either is missing. */
export async function inboxDevicesFor(client: any, peerAddress: string): Promise<[InboxDevices, InboxDevices] | null> {
  const self: string | undefined = client?.inboxId;
  if (!self || !peerAddress) return null;
  const peer: string | undefined = (await client.findInboxIdByIdentifier({ identifier: peerAddress.toLowerCase(), identifierKind: 'Ethereum' })) || undefined;
  if (!peer) return null;
  const states: any[] = await client.preferences.inboxStateFromInboxIds([self, peer], true);
  const devices: InboxDevices[] = states.map((s) => ({ inboxId: String(s.inboxId), installationIds: (s.installations || []).map((i: any) => String(i.id)) }));
  if (devices.length !== 2 || devices.some((x) => !x.installationIds.length) || !devices.some((x) => x.inboxId === peer)) return null;
  return [devices[0], devices[1]];
}
