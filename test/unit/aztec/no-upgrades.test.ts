/** ADR 005: no contract of ours is upgradeable in the alpha. */
import fs from 'node:fs';
import path from 'node:path';

describe('ADR 005: no upgradeable contracts', () => {
  it('no contract of ours calls the instance registry to update its class, or exposes update_to', () => {
    for (const c of fs.readdirSync('contracts/aztec')) {
      const src = path.join('contracts/aztec', c, 'src');
      if (!fs.existsSync(src)) continue;
      for (const f of fs.readdirSync(src).filter((x) => x.endsWith('.nr'))) {
        const code = fs.readFileSync(path.join(src, f), 'utf8');
        expect(code, `${c}/${f}`).not.toMatch(/fn\s+update_to\b|update_contract_class|ContractInstanceRegistry::at\([^)]*\)\.update/);
      }
    }
  });
  it('the ADR exists with its decision', () => {
    expect(fs.readFileSync('docs/ADR/005-contratos-no-actualizables-en-alpha.md', 'utf8')).toMatch(/ningún contrato propio es actualizable/);
  });
});
