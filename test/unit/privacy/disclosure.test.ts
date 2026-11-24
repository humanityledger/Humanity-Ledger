import { describe, expect, it } from 'vitest';
import { disclosureFor, feeModeFor, type DisclosureAction } from '@/lib/privacy/disclosure';

const ACTIONS: DisclosureAction[] = ['send', 'receive', 'shield', 'unshield', 'request'];

describe('privacy disclosure map', () => {
  it('Alpha pays its own Fee Juice; the test network is sponsored', () => {
    expect(feeModeFor('mainnet')).toBe('own-fee-juice');
    expect(feeModeFor('testnet')).toBe('sponsored');
  });

  it('never claims the sender is hidden when the account pays its own fee', () => {
    const d = disclosureFor('send', 'own-fee-juice');
    expect(d.private.join(' ')).not.toMatch(/you sent/i);
    expect(d.summary).not.toMatch(/you and the recipient/i);
    expect(d.public.join(' ')).toMatch(/your account/i);
    expect(d.public.join(' ')).toMatch(/linked/i);
  });

  it('shield and unshield always say the amount is visible', () => {
    for (const a of ['shield', 'unshield'] as const) {
      for (const f of ['own-fee-juice', 'sponsored'] as const) {
        expect(disclosureFor(a, f).public.join(' ')).toMatch(/amount/i);
      }
    }
  });

  it('every action lists both sides and a summary', () => {
    for (const a of ACTIONS) {
      for (const f of ['own-fee-juice', 'sponsored'] as const) {
        const d = disclosureFor(a, f);
        expect(d.private.length).toBeGreaterThan(0);
        expect(d.public.length).toBeGreaterThan(0);
        expect(d.summary.length).toBeGreaterThan(10);
      }
    }
  });

  it('uses none of the forbidden absolute claims', () => {
    for (const a of ACTIONS) {
      for (const f of ['own-fee-juice', 'sponsored'] as const) {
        const d = disclosureFor(a, f);
        const text = [...d.private, ...d.public, d.summary].join(' ');
        expect(text).not.toMatch(/100\s?%|fully private|untraceable|anonymous|audited/i);
      }
    }
  });
});
