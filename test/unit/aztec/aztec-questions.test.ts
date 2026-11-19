/** Package 8: the Aztec questions carry repository evidence and the forum draft claims no relationship. */
import fs from 'node:fs';

describe('Aztec questions Q1, Q2, Q4, Q5', () => {
  const doc = fs.readFileSync('docs/AZTEC_DECISIONS.md', 'utf8');
  it('each has repository evidence and stays OPEN with no reply', () => {
    for (const q of ['Q1', 'Q2', 'Q4', 'Q5']) {
      const part = doc.slice(doc.indexOf(`## ${q} `), doc.indexOf('\n---\n', doc.indexOf(`## ${q} `)));
      expect(part).toMatch(/\*\*Repository evidence \(19\/11\/2026\):\*\*/);
      expect(part).toMatch(/\*\*Status:\*\* OPEN/);
      expect(part).toMatch(/\*\*Aztec reply:\*\* \*\(none yet\)\*/);
    }
  });
  it('the document is in English and claims nothing in production', () => {
    expect(doc).not.toMatch(/Posición|Decisiones conservadoras|Este apartado/);
    expect(doc).not.toMatch(/used in production/);
  });
  it('the forum draft asks; it implies no relationship with Aztec Labs', () => {
    const draft = fs.readFileSync('docs/aztec/FORUM_DRAFT_2026-11-19.md', 'utf8');
    expect(draft).toMatch(/Stefan posts this/);
    const body = draft.slice(draft.indexOf('**Title:**'));
    expect(body).not.toMatch(/partner|official|endorse|backed by|in collaboration with|anonymous|untraceable|audited/i);
  });
});
