/**
 * lib/aztec/wallet/passkey-store.ts — where passkey records live (lib/aztec/wallet/passkey.ts).
 *
 * A record holds no secret: credential id, PRF salt, IV and the AES-GCM ciphertext of the account
 * root. It is kept on this device (localStorage) and in the person's encrypted backup on the server
 * (GET/PUT/DELETE /api/aztec/passkeys, signed-in wallet only), so a passkey that syncs to another
 * device finds its record there. The server stores ciphertext it cannot open: the key is the PRF
 * output, which only the authenticator can produce.
 */
import { mergeKeepingLocal, mergeRecords, PasskeyRecordSchema, type PasskeyRecord } from './passkey';

const KEY = (network: string, evm: string) => `hl.passkeys.${network}.${evm}`;

function storage(): Storage | null {
  try {
    return typeof localStorage !== 'undefined' ? localStorage : null;
  } catch {
    return null;
  }
}

export function localRecords(evm: string, network: string): PasskeyRecord[] {
  try {
    const raw = storage()?.getItem(KEY(network, evm));
    return raw ? mergeRecords(JSON.parse(raw)) : [];
  } catch {
    return [];
  }
}

function saveLocal(evm: string, network: string, records: PasskeyRecord[]) {
  try {
    storage()?.setItem(KEY(network, evm), JSON.stringify(records));
  } catch {
    /* kept in the backup only */
  }
}

/** The person's backup. Null when not signed in or the server cannot be reached (never fatal). */
export async function backupRecords(network: string, f: typeof fetch = fetch): Promise<PasskeyRecord[] | null> {
  try {
    const res = await f(`/api/aztec/passkeys?network=${encodeURIComponent(network)}`, { credentials: 'include', cache: 'no-store' });
    if (!res.ok) return null;
    const body = await res.json();
    return Array.isArray(body?.records) ? body.records.filter((r: unknown) => PasskeyRecordSchema.safeParse(r).success) : null;
  } catch {
    return null;
  }
}

/** This device's records and the backup's, merged; the device copy is refreshed. */
export async function allRecords(evm: string, network: string, f: typeof fetch = fetch): Promise<PasskeyRecord[]> {
  const local = localRecords(evm, network);
  const remote = ((await backupRecords(network, f)) ?? []).filter((r) => r.evm === evm);
  const merged = mergeKeepingLocal(local, remote);
  if (remote.length) saveLocal(evm, network, merged);
  return merged;
}

/** Saves a new record here and in the backup. Returns whether the backup holds it. */
export async function saveRecord(r: PasskeyRecord, f: typeof fetch = fetch): Promise<{ backedUp: boolean }> {
  PasskeyRecordSchema.parse(r);
  saveLocal(r.evm, r.network, mergeRecords(localRecords(r.evm, r.network), [r]));
  try {
    const res = await f('/api/aztec/passkeys', {
      method: 'PUT',
      credentials: 'include',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ record: r }),
    });
    return { backedUp: res.ok };
  } catch {
    return { backedUp: false };
  }
}

/** Removes a record here and from the backup. The passkey itself stays in the authenticator. */
export async function removeRecord(evm: string, network: string, credentialId: string, f: typeof fetch = fetch): Promise<void> {
  saveLocal(evm, network, localRecords(evm, network).filter((r) => r.credentialId !== credentialId));
  try {
    await f(`/api/aztec/passkeys?credentialId=${encodeURIComponent(credentialId)}`, { method: 'DELETE', credentials: 'include' });
  } catch {
    /* the local copy is gone; the backup is retried on the next removal */
  }
}
