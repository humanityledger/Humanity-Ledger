import { describe, expect, it } from 'vitest';
import { openArchive, passphraseProblem, sealArchive, PBKDF2_ITERATIONS } from '@/lib/backup/encrypted-archive';

const PASS = 'correct horse battery staple';
const DATA = { kind: 'chat-history', messages: [{ id: 'm1', content: 'hola' }], conversations: [] };

describe('encrypted archive', () => {
  it('round-trips with the right passphrase and hides the content', async () => {
    const sealed = await sealArchive(DATA, PASS, 100_000);
    expect(JSON.stringify(sealed)).not.toContain('hola');
    expect(await openArchive(sealed, PASS)).toEqual(DATA);
  });
  it('refuses a wrong passphrase and a modified file', async () => {
    const sealed = await sealArchive(DATA, PASS, 100_000);
    await expect(openArchive(sealed, PASS + '!')).rejects.toThrow('Wrong passphrase or damaged file.');
    const flipped = { ...sealed, ciphertext: (sealed.ciphertext[0] === 'A' ? 'B' : 'A') + sealed.ciphertext.slice(1) };
    await expect(openArchive(flipped, PASS)).rejects.toThrow();
  });
  it('rejects weak passphrases and foreign files', async () => {
    expect(passphraseProblem('short')).toMatch(/at least/);
    expect(passphraseProblem('aaaaaaaaaaaaaa')).toMatch(/repeated/);
    await expect(sealArchive(DATA, 'short')).rejects.toThrow();
    await expect(openArchive({ hello: 1 }, PASS)).rejects.toThrow('not a Ledger Chat archive');
  });
  it('uses at least 600,000 PBKDF2 iterations by default', () => {
    expect(PBKDF2_ITERATIONS).toBeGreaterThanOrEqual(600_000);
  });
});
