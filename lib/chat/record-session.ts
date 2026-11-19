/**
 * The in-memory record-key session. Locking it does not touch other devices.
 * Device-only keys in IndexedDB are a separate store. This session is the
 * passphrase and passkey layer.
 */
import { RecordKeySession } from '@/vendor/ledger-record/src/index';

const session = new RecordKeySession();

export function lockRecordSession(): void {
  session.lock();
}

export function recordSession(): RecordKeySession {
  return session;
}
