import { describe, it, expect } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';

// Phones over WalletConnect (report of 14 Nov 2026: Safari and Chrome on iPhone, Chrome on Android
// stuck on "Unlock this device"): the chat's signatures must follow the sign-in flow of
// lib/auth/wc-sign-request.ts, and the entry screen must never open the wallet by itself.
const root = process.cwd();
const chat = fs.readFileSync(path.join(root, 'components/terminal/LedgerChatV2.tsx'), 'utf8');
const pad = fs.readFileSync(path.join(root, 'components/terminal/PadlockLoader.tsx'), 'utf8');
const bubble = fs.readFileSync(path.join(root, 'components/chat/MessageBubble.tsx'), 'utf8');

describe('mobile signing in the chat', () => {
  it('holds WalletConnect auto-open on iPhone and waits for the relay before offering the link', () => {
    expect(chat).toContain('holdWalletConnectAutoOpen(provider)');
    expect(chat).toContain('watchSentSignRequest(provider');
    expect(chat).toContain('signLink={signLink}');
  });
  it('the entry screen opens the wallet only from a tap', () => {
    expect(pad).not.toMatch(/setTimeout\(\(\) => \{\s*try \{\s*openMobileWalletApp/);
    expect(pad).toContain('openSignLink(signLink)');
  });
});

describe('message bubbles', () => {
  it('break long words instead of overflowing the chat', () => {
    expect(bubble).toContain('[overflow-wrap:anywhere]');
    expect(bubble).not.toContain('max-w-[82vw]');
  });
});
