import { describe, expect, it } from 'vitest';
import fs from 'node:fs';
import { safetyDigits } from '@/lib/chat/safety-glyphs';

const A = { inboxId: 'aaa111', installationIds: ['d1', 'd2'] };
const B = { inboxId: 'bbb222', installationIds: ['e1'] };

describe('safety number from inboxes and devices', () => {
  it('is 12 groups of 5 digits and the same for both people', async () => {
    const ab = await safetyDigits(A, B);
    expect(ab).toMatch(/^(\d{5} ){11}\d{5}$/);
    expect(await safetyDigits(B, A)).toBe(ab);
  });
  it('ignores the order of devices', async () => {
    expect(await safetyDigits({ ...A, installationIds: ['d2', 'd1'] }, B)).toBe(await safetyDigits(A, B));
  });
  it('changes when either side adds a device', async () => {
    const before = await safetyDigits(A, B);
    expect(await safetyDigits(A, { ...B, installationIds: ['e1', 'e2'] })).not.toBe(before);
    expect(await safetyDigits({ ...A, installationIds: ['d1'] }, B)).not.toBe(before);
  });
  it('the sheet no longer derives it from wallet addresses', () => {
    const src = fs.readFileSync('components/chat/EncryptionInfoSheet.tsx', 'utf8');
    expect(src).not.toMatch(/Derived from both wallet addresses/);
    expect(src).toMatch(/inboxDevicesFor\(client, peerAddress\)/);
  });
});
