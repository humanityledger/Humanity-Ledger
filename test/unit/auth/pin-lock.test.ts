import { describe, it, expect } from 'vitest';
import { pinLockEnabled } from '@/lib/auth/pin-lock';

/** The PIN screen is off unless the build says exactly "on". */
describe('pinLockEnabled', () => {
  const KEY = 'NEXT_PUBLIC_ENCLAVE_PIN_LOCK';
  const saved = process.env[KEY];
  const set = (v: string | undefined) => { if (v === undefined) delete process.env[KEY]; else process.env[KEY] = v; };

  it('is off when unset, empty or anything but "on"', () => {
    for (const v of [undefined, '', 'off', 'true', '1', 'ON', 'yes', ' on']) {
      set(v);
      expect(pinLockEnabled()).toBe(false);
    }
    set(saved);
  });

  it('is on only for the exact value "on"', () => {
    set('on');
    expect(pinLockEnabled()).toBe(true);
    set(saved);
  });
});

/**
 * With the PIN screen off, TuringShieldGate must show its neutral loading screen
 * (never the PIN pad) while it waits for the session check. Before 11 November
 * 2026 the pad flashed for the moment /api/auth/enclave-pin took to answer.
 */
describe('TuringShieldGate with the PIN screen off', () => {
  it('keeps the neutral loading screen until the gate is cleared', async () => {
    const fs = await import('node:fs');
    const path = await import('node:path');
    const src = fs.readFileSync(path.resolve(__dirname, '../../../components/auth/TuringShieldGate.tsx'), 'utf8');
    const loading = src.indexOf('aria-label="Loading"');
    const gate = src.indexOf('MAIN PIN GATE');
    expect(loading).toBeGreaterThan(0);
    expect(gate).toBeGreaterThan(loading);
    expect(src).toMatch(/if \(!mounted \|\| \(!cleared && !settingPin && !pinLockEnabled\(\)\)\) \{/);
  });
});

/**
 * The optional app lock inside the chat (Settings → biometric_lock, off by default) must not render its
 * PIN screen when it is off. It used to show for the first render of every visit.
 */
describe('LedgerChat app lock', () => {
  it('renders the lock screen only while the app lock is on', async () => {
    const fs = await import('node:fs');
    const path = await import('node:path');
    const src = fs.readFileSync(path.resolve(__dirname, '../../../components/terminal/LedgerChatV2.tsx'), 'utf8');
    expect(src).toMatch(/if \(ledgerSettings\?\.biometric_lock && !isBiometricallyUnlocked\) \{/);
    expect(src).not.toMatch(/\n\s*if \(!isBiometricallyUnlocked\) \{/);
  });
});
