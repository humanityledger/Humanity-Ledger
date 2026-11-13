import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

const chat = readFileSync(join(process.cwd(), 'components/terminal/LedgerChatV2.tsx'), 'utf8');

describe('app lock (Settings › Security)', () => {
  it('never unlocks by itself', () => {
    expect(chat).not.toMatch(/setTimeout\(\(\) => setIsBiometricallyUnlocked\(true\)/);
    expect(chat).not.toMatch(/challenge: new Uint8Array\(32\)/);
    // Only the PIN screen (checked by the server) or an account without a PIN opens it.
    const calls = chat.match(/setIsBiometricallyUnlocked\(true\)/g) || [];
    expect(calls).toHaveLength(2);
    const lock = chat.slice(chat.indexOf('if (ledgerSettings?.biometric_lock && !isBiometricallyUnlocked) {'));
    expect(lock).toMatch(/<PinPrompt[^]*?onUnlock=\{\(\) => setIsBiometricallyUnlocked\(true\)\}[^]*?onNeedsSetup=/);
  });
});
