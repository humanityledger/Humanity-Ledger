// lib/alpha/rules.mjs: closed alpha rules shared by the app (TypeScript) and the operator scripts
// (scripts/alpha/*.mjs), so both apply exactly the same checks. Pure functions, no I/O.

const ISO_DAY = /^\d{4}-\d{2}-\d{2}$/;
const text = (v) => typeof v === 'string' && v.trim().length > 0;
const day = (v) => typeof v === 'string' && ISO_DAY.test(v) && !Number.isNaN(Date.parse(`${v}T00:00:00Z`));

/**
 * Who distributes HLC to testers (MiCA art. 4(1)(a); preliminary legal note, A.2). Null until
 * counsel decides: then nobody can create invitation codes, redeem them or issue HLC.
 *   { kind: 'company', legalName, taxId, registry }
 *   { kind: 'natural-person', legalNote: { ref, signedBy, signedOn: 'YYYY-MM-DD' } }
 * @param {unknown} d
 * @returns {string | null} why it does not allow distribution, or null when it does
 */
export function distributorProblem(d) {
  if (d === null || d === undefined) return 'No distributor of HLC is recorded yet (closedAlpha.distributor). Counsel decides who distributes it.';
  if (typeof d !== 'object' || Array.isArray(d)) return 'closedAlpha.distributor must be an object.';
  if (d.kind === 'company') {
    for (const k of ['legalName', 'taxId', 'registry']) if (!text(d[k])) return `closedAlpha.distributor.${k} is missing.`;
    return null;
  }
  if (d.kind === 'natural-person') {
    const n = d.legalNote;
    if (!n || typeof n !== 'object') return 'A natural person distributes HLC only with a signed legal note (closedAlpha.distributor.legalNote).';
    if (!text(n.ref)) return 'closedAlpha.distributor.legalNote.ref is missing.';
    if (!text(n.signedBy)) return 'closedAlpha.distributor.legalNote.signedBy is missing.';
    if (!day(n.signedOn)) return 'closedAlpha.distributor.legalNote.signedOn must be a date (YYYY-MM-DD).';
    return null;
  }
  return 'closedAlpha.distributor.kind must be "company" or "natural-person".';
}

const SHA256 = /^[0-9a-f]{64}$/;

/**
 * Package 4. The signed version of the alpha terms (Anexo I, signed by counsel, OD-8). While
 * ALPHA_TERMS_VERSION or ALPHA_TERMS_SHA256 is empty, no invitation is redeemed.
 * @param {{ version?: string, sha256?: string }} terms
 * @returns {string | null}
 */
export function termsProblem(terms) {
  if (!text(terms?.version)) return 'No signed version of the alpha terms is recorded yet (ALPHA_TERMS_VERSION, OD-8).';
  if (!SHA256.test(String(terms?.sha256 ?? ''))) return 'ALPHA_TERMS_SHA256 must be the SHA-256 (64 hex characters) of the signed terms.';
  return null;
}

/**
 * Package 4. The three separate boxes, none ticked in advance, and the hash of the exact text the
 * tester was shown, which must be the signed version.
 * @param {unknown} body  { accept: { terms, risks, eligibility }, termsSha256 }
 * @param {{ version?: string, sha256?: string }} terms
 * @returns {string | null}
 */
export function acceptanceProblem(body, terms) {
  const t = termsProblem(terms);
  if (t) return t;
  const a = body && typeof body === 'object' ? body.accept : null;
  if (!a || a.terms !== true) return 'Accept the terms of the closed alpha.';
  if (a.risks !== true) return 'Accept the risks in clause 6 of the terms.';
  if (a.eligibility !== true) return 'Confirm that you are 18 or older and meet clause 3 of the terms.';
  if (String(body.termsSha256 ?? '').toLowerCase() !== String(terms.sha256).toLowerCase()) return 'The terms changed. Read the current version and accept it again.';
  return null;
}

/**
 * Package 4. The operator's two checks before a code is created for a tester: the EU consolidated
 * sanctions list (date of the list used, result) and that the tester is an adult. Only the result
 * is stored, never an identity document. A match never gets a code.
 * @param {{ sanctionsListDate?: string, sanctionsResult?: string, adultChecked?: boolean }} c
 * @returns {string | null}
 */
export function inviteChecksProblem(c) {
  if (!day(c?.sanctionsListDate)) return 'Give the date of the EU consolidated sanctions list you checked (--sanctions-list-date YYYY-MM-DD).';
  if (c.sanctionsResult === 'match') return 'The sanctions check matched: no code is created for this person.';
  if (c.sanctionsResult !== 'clear') return 'Record the sanctions result (--sanctions clear). A match never gets a code.';
  if (c.adultChecked !== true) return 'Confirm that you checked the tester is 18 or older (--adult-checked).';
  return null;
}

/** Package 4. When the personal fields of the admission are deleted: 6 months after the alpha ends. */
export function retainUntil(alphaUntil) {
  const t = typeof alphaUntil === 'string' ? Date.parse(alphaUntil) : NaN;
  if (Number.isNaN(t)) return null;
  const d = new Date(t);
  d.setUTCMonth(d.getUTCMonth() + 6);
  return d;
}
