/**
 * WebAuthn PRF. The authenticator returns 32 bytes. Those bytes become a
 * wrapping key only after HKDF. If the browser has no PRF, this throws.
 * It does not fall back to putting a record key in a message.
 */
import { derivePasskeyKek } from '@/vendor/ledger-record/src/index';

const SALT = new TextEncoder().encode('ledger-record/v2/prf-eval');

type PrfResult = { getClientExtensionResults?: () => { prf?: { results?: { first?: ArrayBuffer } } } };

export async function passkeyKek(): Promise<Uint8Array> {
  if (typeof navigator === 'undefined' || !navigator.credentials?.get) {
    throw new Error('This browser has no passkey.');
  }
  const cred = await navigator.credentials.get({
    publicKey: {
      challenge: crypto.getRandomValues(new Uint8Array(32)),
      userVerification: 'required',
      extensions: { prf: { eval: { first: SALT } } } as AuthenticationExtensionsClientInputs,
    },
  }) as PrfResult | null;
  const first = cred?.getClientExtensionResults?.().prf?.results?.first;
  if (!first) throw new Error('This passkey did not return a PRF result.');
  return derivePasskeyKek(new Uint8Array(first));
}
