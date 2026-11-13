/**
 * lib/auth/wallet-sign.ts — the sign-in signature, asked of the wallet exactly once per attempt.
 *
 * The request goes straight to the EIP-1193 provider of the connected wallet (`personal_sign`, the
 * method every wallet implements: MetaMask, Rainbow, Coinbase, Trust and the other in-app browsers, and
 * every wallet behind WalletConnect). The message is sent as hex of its UTF-8 bytes, which is the form
 * EIP-1193 wallets parse without guessing, and with the address exactly as the wallet reported it.
 *
 * A request that reached the wallet is never sent again while the person may still be looking at it:
 * a second copy is what made MetaMask's in-app browser show one prompt and answer another, and the page
 * then waited on a request nobody would approve. Only an error raised before the wallet saw the request
 * (provider not ready, disconnected, unauthorised) is retried.
 */

export interface Eip1193Provider {
  request(args: { method: string; params?: unknown[] }): Promise<unknown>;
}

export function utf8ToHex(text: string): `0x${string}` {
  const bytes = new TextEncoder().encode(text);
  let hex = '0x';
  for (const b of bytes) hex += b.toString(16).padStart(2, '0');
  return hex as `0x${string}`;
}

/** 65 byte ECDSA, or a longer contract wallet signature (ERC-1271 / ERC-6492). */
export function isSignature(v: unknown): v is `0x${string}` {
  return typeof v === 'string' && /^0x[0-9a-fA-F]{130,}$/.test(v) && v.length % 2 === 0;
}

/** True when the error came before the wallet received the request, so sending it again is safe. */
export function failedBeforeWallet(e: unknown): boolean {
  const err = e as { code?: unknown; message?: unknown; cause?: { code?: unknown; message?: unknown } } | null;
  const code = Number(err?.code ?? err?.cause?.code);
  if (code === 4100 || code === 4900 || code === 4901) return true; // unauthorised, disconnected, chain disconnected
  const text = `${typeof err?.message === 'string' ? err.message : ''} ${typeof err?.cause?.message === 'string' ? err.cause.message : ''}`.toLowerCase();
  return /not connected|provider not found|no provider|connector not found|reconnecting/.test(text);
}

export async function personalSign(provider: Eip1193Provider, address: string, message: string): Promise<`0x${string}`> {
  const result = await provider.request({ method: 'personal_sign', params: [utf8ToHex(message), address] });
  if (!isSignature(result)) {
    throw Object.assign(new Error('The wallet answered without a valid signature.'), { code: 'BAD_SIGNATURE' });
  }
  return result;
}
