/** The rail uses Ledger Chat's own icons, no dead entries, and wallets without a photo get a glyph. */
import fs from 'node:fs';
import { walletCells, walletInk } from '@/components/chat/WalletGlyph';

describe('wallet glyph', () => {
  it('is deterministic, mirrored, never empty or full', () => {
    const a = '0x5012aa3c9d0e44f1b6d9';
    expect(walletCells(a)).toEqual(walletCells(a));
    const c = walletCells(a);
    for (let r = 0; r < 5; r++) {
      expect(c[r * 5 + 0]).toBe(c[r * 5 + 4]);
      expect(c[r * 5 + 1]).toBe(c[r * 5 + 3]);
    }
    expect(walletCells('0x0000000000000000').some(Boolean)).toBe(true);
    expect(walletCells('0xffffffffffffffff').every(Boolean)).toBe(false);
    expect(walletCells(a)).not.toEqual(walletCells('0x1ba9ccccdeadbeef0f675'));
    expect(walletInk(a)).toMatch(/^hsl\(\d+ 38% 30%\)$/);
  });
});

describe('rail', () => {
  const src = fs.readFileSync('components/terminal/LedgerChatV2.tsx', 'utf8');
  const rail = src.slice(src.indexOf('<nav aria-label="Ledger Chat"'), src.indexOf('</nav>', src.indexOf('<nav aria-label="Ledger Chat"')));
  it('has Chats, Calls, Status, Contacts, Communities, Payments and Settings with the custom icons', () => {
    for (const icon of ['ChatsIcon', 'CallsIcon', 'StatusIcon', 'ContactsIcon', 'CommunitiesIcon', 'PaymentsIcon', 'SettingsIcon']) expect(rail).toContain(`<${icon}`);
    expect(rail).not.toMatch(/lucide|<MessageSquare|<Wallet |<Settings size/);
  });
  it('keeps the order Chats, Calls, Status, Contacts, Payments, Communities, then Settings', () => {
    const at = (x: string) => rail.indexOf(x);
    const seq = ["id: 'chats'", "id: 'calls'", "id: 'updates'", "id: 'contacts'", "id: 'payments'", "id: 'communities'", '<SettingsIcon'];
    for (let i = 1; i < seq.length; i++) expect(at(seq[i - 1])).toBeLessThan(at(seq[i]));
    expect(at(seq[0])).toBeGreaterThan(-1);
  });
  it('the settings icon is a gear outline with a hub, not a sun of spokes', () => {
    const icons = fs.readFileSync('components/chat/icons/LedgerIcons.tsx', 'utf8');
    const gear = icons.slice(icons.indexOf('export const SettingsIcon'), icons.indexOf('export const BellIcon'));
    expect((gear.match(/A9 9 0 0 1/g) || []).length).toBe(8);
    expect(gear).toMatch(/<circle cx="12" cy="12" r="2.75" \/>/);
    expect(gear).not.toMatch(/M12 3v2/);
  });
  it('has no entry to the closed Ledger Studio', () => {
    expect(rail).not.toMatch(/openStudio|Ledger Studio"/);
  });
  it('contacts without a photo show a wallet glyph, not two letters', () => {
    expect(src).toMatch(/return <WalletGlyph address=\{address\} size=\{size\} \/>;/);
    expect(src).not.toMatch(/const initials = address \? address\.slice\(2, 4\)/);
  });
  it('no icon in the set comes from an icon library', () => {
    expect(fs.readFileSync('components/chat/icons/LedgerIcons.tsx', 'utf8')).not.toMatch(/lucide|heroicons|@mui/);
  });
});
