/** The closed alpha join screen: three separate boxes, the hash of the text read, nothing ticked in advance. */
import fs from 'node:fs';

const page = fs.readFileSync('app/alpha/page.tsx', 'utf8');

describe('/alpha join screen (package 4)', () => {
  it('three separate boxes, none ticked in advance', () => {
    expect(page).toMatch(/useState\(\{ terms: false, risks: false, eligibility: false \}\)/);
    expect(page).toMatch(/box\('terms'/);
    expect(page).toMatch(/box\('risks'/);
    expect(page).toMatch(/box\('eligibility'/);
  });
  it('hashes the terms text it shows and redeems only when it equals the signed version', () => {
    expect(page).toMatch(/crypto\.subtle\.digest\('SHA-256'/);
    expect(page).toMatch(/hash === status!\.terms\.sha256/);
    expect(page).toMatch(/termsSha256: hash/);
  });
  it('says the alpha is not open while the terms are not signed, and tells the truth about the assets', () => {
    expect(page).toMatch(/its terms have not been signed/);
    expect(page).toMatch(/HLC, a test token with no monetary value/);
    expect(page).toMatch(/internal security review, not an external audit/);
    expect(fs.readFileSync('middleware.ts', 'utf8')).toMatch(/'\/alpha',/);
  });
});
