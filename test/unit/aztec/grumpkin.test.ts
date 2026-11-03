/**
 * Gap G1: Grumpkin point and Aztec address validation (lib/aztec/grumpkin.ts).
 */

import { describe, it, expect } from 'vitest';
import {
  GRUMPKIN_P,
  GRUMPKIN_GENERATOR,
  isOnGrumpkin,
  hasGrumpkinPoint,
  isValidAztecAddress,
} from '../../../lib/aztec/grumpkin';

const hex = (v: bigint) => '0x' + v.toString(16).padStart(64, '0');

describe('Grumpkin validation (G1)', () => {
  it('accepts the generator and rejects a perturbed point', () => {
    expect(isOnGrumpkin(GRUMPKIN_GENERATOR.x, GRUMPKIN_GENERATOR.y)).toBe(true);
    expect(isOnGrumpkin(GRUMPKIN_GENERATOR.x, GRUMPKIN_GENERATOR.y + BigInt(1))).toBe(false);
  });

  it('accepts the negated generator (x, -y)', () => {
    expect(isOnGrumpkin(GRUMPKIN_GENERATOR.x, GRUMPKIN_P - GRUMPKIN_GENERATOR.y)).toBe(true);
  });

  it('rejects coordinates outside the field', () => {
    expect(isOnGrumpkin(GRUMPKIN_P + GRUMPKIN_GENERATOR.x, GRUMPKIN_GENERATOR.y)).toBe(false);
    expect(hasGrumpkinPoint(GRUMPKIN_P)).toBe(false);
  });

  it('finds that x = 1 has a point and x = 3 has none', () => {
    expect(hasGrumpkinPoint(BigInt(1))).toBe(true);
    expect(hasGrumpkinPoint(BigInt(3))).toBe(false);
  });

  it('validates address strings: format, field range and curve', () => {
    expect(isValidAztecAddress(hex(BigInt(1)))).toBe(true);
    expect(isValidAztecAddress(hex(BigInt(3)))).toBe(false);
    expect(isValidAztecAddress('0x1234')).toBe(false);
    expect(isValidAztecAddress('0x' + 'f'.repeat(64))).toBe(false); // above p
    expect(isValidAztecAddress(` ${hex(BigInt(1))} `)).toBe(true);
  });

  it('about half of all x-coordinates have a point', () => {
    let valid = 0;
    for (let i = 1; i <= 400; i++) if (hasGrumpkinPoint(BigInt(i))) valid++;
    expect(valid).toBeGreaterThan(150);
    expect(valid).toBeLessThan(250);
  });
});
