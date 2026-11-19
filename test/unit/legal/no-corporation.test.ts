/**
 * Package 2: no route, page or library claims a company that does not exist. Until the S.L. is
 * incorporated the provider is Stefan Antonio Cirisanu, a private individual (lib/constants/legalEntity.ts).
 */
import fs from 'node:fs';
import path from 'node:path';
import { isRetiredApiRoute } from '@/lib/security/retiredRoutes';

function files(dir: string, out: string[] = []): string[] {
  for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
    const p = path.join(dir, e.name);
    if (e.isDirectory()) files(p, out);
    else if (/\.(ts|tsx|js|mjs|json)$/.test(e.name)) out.push(p);
  }
  return out;
}

describe('no company that does not exist (package 2)', () => {
  it('app/, components/ and lib/ never say "Humanity Ledger Corp", "Corporation", "Corp." or ledgeralert.corp', () => {
    const hits: string[] = [];
    for (const f of [...files('app'), ...files('components'), ...files('lib')]) {
      if (f.includes(`${path.sep}abi${path.sep}`)) continue;
      fs.readFileSync(f, 'utf8').split('\n').forEach((l, i) => {
        if (/Humanity Ledger Corp|\bCorporation\b|\bCorp\.|ledgeralert\.corp/.test(l)) hits.push(`${f}:${i + 1}`);
      });
    }
    expect(hits).toEqual([]);
  });

  it('the legacy paid-API routes are gone and refused at the edge', () => {
    for (const r of ['payment/webhook', 'v1/ledger/events', 'v1/ledger/signals']) {
      expect(fs.existsSync(`app/api/${r}/route.ts`), r).toBe(false);
      expect(isRetiredApiRoute(`/api/${r}`), r).toBe(true);
    }
  });

  it('emails sign with the real provider, read from the legal entity constant', () => {
    const email = fs.readFileSync('lib/email.ts', 'utf8');
    expect(email).toMatch(/LEGAL_ENTITY\.name/);
  });
});
