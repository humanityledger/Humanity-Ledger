/** Package 3: nobody distributes HLC until closedAlpha.distributor records who does and on what basis. */
import fs from 'node:fs';
import { distributorProblem } from '@/lib/alpha/rules.mjs';
import { distributionDecision } from '@/lib/alpha/gate';

const company = { kind: 'company', legalName: 'Example S.L.', taxId: 'B00000000', registry: 'Registro Mercantil de Madrid' };
const person = { kind: 'natural-person', legalNote: { ref: 'docs/legal/NOTA_FIRMADA.md', signedBy: 'Counsel name', signedOn: '2026-11-20' } };

describe('closedAlpha.distributor (MiCA art. 4(1)(a))', () => {
  it('null: nobody can distribute', () => {
    expect(distributorProblem(null)).toMatch(/No distributor/);
    expect(distributionDecision({ enabled: true, until: null, classes: [], distributor: null }).ok).toBe(false);
    expect(distributionDecision(undefined).ok).toBe(false);
  });

  it('a company with legal name, tax id and registry', () => {
    expect(distributorProblem(company)).toBeNull();
    expect(distributionDecision({ enabled: false, until: null, classes: [], distributor: company })).toEqual({ ok: true });
  });

  it('a natural person only with a signed legal note', () => {
    expect(distributorProblem(person)).toBeNull();
    expect(distributorProblem({ kind: 'natural-person' })).toMatch(/signed legal note/);
  });

  it('refuses incomplete or unknown forms', () => {
    for (const k of ['legalName', 'taxId', 'registry']) expect(distributorProblem({ ...company, [k]: '' })).toMatch(k);
    expect(distributorProblem({ ...person, legalNote: { ...person.legalNote, ref: ' ' } })).toMatch(/ref/);
    expect(distributorProblem({ ...person, legalNote: { ...person.legalNote, signedBy: undefined } })).toMatch(/signedBy/);
    expect(distributorProblem({ ...person, legalNote: { ...person.legalNote, signedOn: '20/11/2026' } })).toMatch(/signedOn/);
    expect(distributorProblem({ kind: 'trust' })).toMatch(/kind/);
    expect(distributorProblem([company])).toMatch(/object/);
  });

  it('is null in the record today, and every path that distributes checks it', () => {
    const record = JSON.parse(fs.readFileSync('deployments/aztec-mainnet.json', 'utf8'));
    expect(record.closedAlpha.distributor).toBeNull();
    expect(fs.readFileSync('app/api/alpha/redeem/route.ts', 'utf8')).toMatch(/distributionDecision\(/);
    expect(fs.readFileSync('scripts/alpha/invites.mjs', 'utf8')).toMatch(/distributorProblem\(record\?\.closedAlpha\?\.distributor/);
    expect(fs.readFileSync('components/zk/ZkWalletPanel.tsx', 'utf8')).toMatch(/distributionDecision\(\(mainnetRecord/);
  });
});
