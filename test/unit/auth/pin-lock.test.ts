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
