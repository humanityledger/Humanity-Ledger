/**
 * Aztec wallet connection.
 *
 * Non-custodial: keys are created and stored in the browser only.
 * The server never has access to private keys or notes.
 *
 * Usage (client-side only, requires NEXT_PUBLIC_ZK_MODE=testnet):
 *   const wallet = await connectAztecWallet(pxeUrl);
 *   const address = await getAztecAddress(wallet);
 */

export async function connectAztecWallet(pxeUrl?: string): Promise<unknown> {
  const zkMode = process.env.NEXT_PUBLIC_ZK_MODE;
  if (zkMode !== 'testnet') {
    throw Object.assign(
      new Error('Aztec wallet requires NEXT_PUBLIC_ZK_MODE=testnet'),
      { status: 503 }
    );
  }

  // Dynamic import to avoid including Aztec in the main bundle
  // Requires: @aztec/aztec.js with stable pinned version (see H-002)
  try {
    const { createPXEClient, getSchnorrAccount, Fr, GrumpkinScalar } =
      (await import('@aztec/aztec.js')) as any;

    const url = pxeUrl ?? process.env.NEXT_PUBLIC_AZTEC_PXE_URL ?? 'http://localhost:8080';
    const pxe = createPXEClient(url);

    // Derive or generate a Schnorr signing key from the user's session
    // In production: derive from the user's XMTP installation key or passkey
    // For testnet: use a stored random key from the browser's secure storage
    const signingKey = GrumpkinScalar.random();
    const salt = Fr.zero();

    const account = getSchnorrAccount(pxe, signingKey, signingKey, salt);
    const wallet = await account.waitSetup();
    return wallet;
  } catch (err: any) {
    if (err.message?.includes('Cannot find module')) {
      throw new Error(
        'Aztec packages not installed. Run: npm install @aztec/aztec.js@<pinned-version>'
      );
    }
    throw err;
  }
}

export async function getAztecAddress(wallet: any): Promise<string> {
  return wallet.getAddress().toString();
}
