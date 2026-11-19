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
