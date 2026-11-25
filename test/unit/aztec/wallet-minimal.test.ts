/**
 * The private wallet is light and quiet (24 November 2026): white surfaces, hairlines, one ink colour
 * for primary actions. No dark cards, no gradients, no shield icons. These checks keep it so.
 */
import { describe, expect, it } from 'vitest';
import fs from 'node:fs';

const FILES = [
  'components/zk/ZkWalletPanel.tsx',
  'components/zk/WalletCreation.tsx',
  'components/zk/wallet/WalletUI.tsx',
  'components/zk/wallet/WalletSheets.tsx',
  'components/zk/AlphaNetworkBanner.tsx',
];
const code = (f: string) => fs.readFileSync(f, 'utf8').replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '');
/** The recipient's identicon is a picture of an address, drawn with colour on purpose: not a surface. */
const surfaces = (f: string) => code(f).replace(/export function AddressAvatar[\s\S]*?\n\}\n/, '');

describe('the private wallet stays light and minimal', () => {
  it('has no shield icons', () => {
    for (const f of FILES) expect(code(f), f).not.toMatch(/\bShield(Check|Alert|Off|Plus|Half)?\b\s*(size|\/|,|\})/);
  });
  it('has no dark surfaces and no gradients', () => {
    for (const f of FILES) {
      expect(surfaces(f), f).not.toMatch(/VAULT_BG|NoteField|radial-gradient|linear-gradient|bg-gradient-to/);
      expect(surfaces(f), f).not.toMatch(/text-white\/\[|bg-white\/\[0\.0/);
    }
  });
  it('labels are sentence case, not spaced capitals', () => {
    for (const f of FILES) expect(code(f), f).not.toMatch(/uppercase tracking-\[0\.08em\]/);
  });
  it('the primary button is flat ink', () => {
    const ui = code('components/zk/wallet/WalletUI.tsx');
    expect(ui).toMatch(/bg-\[#0d0f14\] hover:bg-\[#2a2d34\] text-white/);
  });
});
