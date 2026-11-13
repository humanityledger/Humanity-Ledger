import { describe, expect, it } from 'vitest';
import { encodePresence, decodePresence, visiblePresence, ONLINE_WINDOW_MS, PRESENCE_TTL_S } from '@/lib/chat/presencePolicy';

describe('presence: online only while in the foreground, last seen kept', () => {
  const now = 1_800_000_000_000;
  it('a fresh foreground heartbeat is online', () => {
    expect(visiblePresence(encodePresence(now - 5_000, 'contacts'), 'contacts', now)).toEqual({ lastActiveAt: now - 5_000, online: true });
  });
  it('a window that left is offline at once, with last seen = when it left', () => {
    const raw = encodePresence(now - 1_000, 'contacts', 'off');
    expect(decodePresence(raw)?.offline).toBe(true);
    expect(visiblePresence(raw, 'contacts', now)).toEqual({ lastActiveAt: now - 1_000, online: false });
  });
  it('a stale heartbeat (crash, no network) stops being online after the window', () => {
    expect(visiblePresence(encodePresence(now - ONLINE_WINDOW_MS - 1, 'everybody'), 'contacts', now).online).toBe(false);
  });
  it('hidden last seen hides online too', () => {
    expect(visiblePresence(encodePresence(now, 'nobody'), 'contacts', now)).toEqual({ lastActiveAt: null, online: false });
    expect(visiblePresence(encodePresence(now, 'contacts'), 'nobody', now)).toEqual({ lastActiveAt: null, online: false });
  });
  it('older values without a state still read, and last seen lives 30 days', () => {
    expect(visiblePresence(`${now - 2_000}|contacts`, 'contacts', now).online).toBe(true);
    expect(PRESENCE_TTL_S).toBe(30 * 24 * 3600);
  });
});
