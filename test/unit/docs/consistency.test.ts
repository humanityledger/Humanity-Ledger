/**
 * One vocabulary everywhere (docs/plan/prompts/06-single-source-of-truth.md): the forbidden terms
 * of docs/GLOSSARY.md never appear in app/, components/, lib/ or docs/ outside their allowed use.
 * Historical records, prompts and unsigned legal drafts are skipped, as the glossary lists.
 */
import { findViolations, readRules } from '../../../scripts/docs/check-consistency.mjs';

describe('docs/GLOSSARY.md forbidden terms', () => {
  const rules = readRules();

  it('the glossary has rules and every pattern compiles', () => {
    expect(rules.rules.length).toBeGreaterThanOrEqual(10);
    for (const r of rules.rules) {
      expect(() => new RegExp(r.pattern, r.flags ?? 'i'), r.term).not.toThrow();
      if (r.allow) expect(() => new RegExp(r.allow, 'i'), r.term).not.toThrow();
    }
  });

  it('no forbidden term outside its allowed use (file:line on failure)', () => {
    const found = findViolations(rules).map((v: { file: string; line: number; term: string; text: string }) => `${v.file}:${v.line} [${v.term}] ${v.text}`);
    expect(found).toEqual([]);
  });

  it('the rules catch what they are meant to catch', () => {
    const re = (term: string) => {
      const r = rules.rules.find((x: { term: string }) => x.term === term);
      return { hit: new RegExp(r.pattern, r.flags ?? 'i'), allow: r.allow ? new RegExp(r.allow, 'i') : null };
    };
    const caught = (term: string, line: string) => { const { hit, allow } = re(term); return hit.test(line) && !(allow && allow.test(line)); };
    expect(caught('audited', 'Our contracts are audited by a top firm.')).toBe(true);
    expect(caught('audited', 'The contracts are not audited yet.')).toBe(false);
    expect(caught('partner', 'Ledger Chat is an Aztec partner.')).toBe(true);
    expect(caught('HLC sale words', 'Join the HLC airdrop next week')).toBe(true);
    expect(caught('HLC sale words', 'HLC is never sold or airdropped')).toBe(false);
    expect(caught('Humanity Ledger Corp', "name: 'Humanity Ledger Corp.'")).toBe(true);
  });
});
