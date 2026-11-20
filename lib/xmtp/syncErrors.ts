/**
 * lib/xmtp/syncErrors.ts — errors from libxmtp that do not mean "nothing happened".
 *
 * libxmtp reports a sync that timed out waiting for the network to acknowledge an intent as an
 * error whose text is only the sync summary: "synced 1 messages, 0 failed 1 succeeded from cursor
 * Some(Cursor { … })" (SyncFailedToWait, xmtp/libxmtp#4524 and #3990: "a sync timeout or retry
 * error that wraps a summary with no errors in it"). The commit was published; only the wait for
 * its receipt ran out. Creating a group or a DM that throws this has usually created it, so the
 * app must look for it instead of telling the person it failed (18 November 2026: "errors when
 * creating groups" showing exactly that text).
 */
export function isSyncWaitError(e: unknown): boolean {
  const text = String((e as { message?: unknown })?.message ?? e ?? '');
  // The same condition, worded by newer libxmtp builds (production log, 20/11/2026).
  return /SyncFailedToWait/i.test(text) || /sync failed to wait for intent/i.test(text) || /synced \d+ messages?, \d+ failed \d+ succeeded/i.test(text);
}

/** Error text safe to log: no hex ids, addresses or inbox ids, at most 160 characters. */
export function redactXmtpError(e: unknown): string {
  const text = String((e as { message?: unknown })?.message ?? e ?? 'unknown');
  return text.replace(/0x[0-9a-fA-F]{6,}/g, '0x…').replace(/\b[0-9a-f]{32,}\b/gi, '…').replace(/Some\(Cursor \{[^}]*\}\)/g, 'Some(Cursor)').slice(0, 160);
}
