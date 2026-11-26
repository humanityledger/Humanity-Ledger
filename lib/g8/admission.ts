/**
 * The G8 admission decision every client applies to an incoming DM, request or
 * call (spec §7). Existing contacts (consent Allowed) are never affected.
 */
import { G8Level } from '@/lib/g8/constants';

export type ConsentState = 'allowed' | 'unknown' | 'denied';
export type Admission = 'deliver' | 'request' | 'quarantine' | 'drop';

export interface AdmissionFacts {
  consent: ConsentState;
  /** I blocked this wallet, or this sender's G8 fingerprint for me. */
  blocked: boolean;
  /** Recipient's shield: undefined = off. */
  requiredLevel?: G8Level;
  /** Best evidence the sender presented: a valid invite (Level 0) or a verified proof level. */
  presented?: G8Level;
}

export function decideAdmission(f: AdmissionFacts): Admission {
  if (f.blocked || f.consent === 'denied') return 'drop';
  if (f.consent === 'allowed') return 'deliver';
  if (f.requiredLevel === undefined) return 'request';
  return f.presented !== undefined && f.presented >= f.requiredLevel ? 'request' : 'quarantine';
}

/** Quarantined items never download attachments, ring, or notify. */
export const quarantineEffects = { downloadAttachments: false, ring: false, notify: false } as const;
