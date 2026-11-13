import { describe, expect, it } from 'vitest';
import { GLYPH_COUNT, GLYPH_RAMP, canonicalSafetyText, safetyGlyphs } from '@/lib/chat/safety-glyphs';

const alice = { inboxId: 'AAA111', installationIds: ['i2', 'i1'] };
const bob = { inboxId: 'bbb222', installationIds: ['j1'] };

describe('safety glyphs', () => {
  it('are the same on both sides of the chat', async () => {
    expect(canonicalSafetyText(alice, bob)).toBe(canonicalSafetyText(bob, alice));
    expect(await safetyGlyphs(alice, bob)).toEqual(await safetyGlyphs(bob, alice));
  });

  it('do not depend on the order devices are listed in', async () => {
    expect(await safetyGlyphs({ ...alice, installationIds: ['i1', 'i2'] }, bob)).toEqual(await safetyGlyphs(alice, bob));
  });

  it('change when a device is added to either account', async () => {
    const before = await safetyGlyphs(alice, bob);
    const after = await safetyGlyphs(alice, { ...bob, installationIds: ['j1', 'j-new'] });
    expect(after).not.toEqual(before);
  });

  it('are 48 glyphs from the ramp', async () => {
    const g = await safetyGlyphs(alice, bob);
    expect(g).toHaveLength(GLYPH_COUNT);
    for (const c of g) expect(GLYPH_RAMP).toContain(c);
  });
});
