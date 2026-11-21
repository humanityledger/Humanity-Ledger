/**
 * 21 November 2026 fixes, checked in the source:
 *   - the encryption notice scrolls with the conversation (it was above the list, and messages were
 *     cut off under it in the middle of the screen);
 *   - no full-screen fixed layer on <html> (Safari on iOS 26 painted a white band beside its
 *     floating toolbar because of it).
 */
import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';

describe('chat layout fixes', () => {
  it('passes the encryption notice into the scrolling list', () => {
    const chat = readFileSync('components/terminal/LedgerChatV2.tsx', 'utf8');
    expect(chat).toMatch(/<VirtualizedMessageList\s+header=\{encryptionNotice\}/);
    const container = chat.indexOf('ledger-chat-container');
    const iife = chat.indexOf('const encryptionNotice = (', container);
    expect(iife).toBeGreaterThan(container);
    // the notice is not rendered on its own between the container and the list any more
    const between = chat.slice(container, iife);
    expect(between).not.toMatch(/Messages in this chat are end-to-end encrypted/);
    const list = readFileSync('components/chat/VirtualizedMessageList.tsx', 'utf8');
    expect(list).toMatch(/header && hiddenCount === 0/);
  });

  it('has no fixed full-screen pseudo-element on html', () => {
    const css = readFileSync('app/globals.css', 'utf8');
    expect(css).not.toMatch(/html::after\s*\{[^}]*position:\s*fixed/);
    expect(css).not.toMatch(/html::before\s*\{[^}]*position:\s*fixed/);
  });
});
