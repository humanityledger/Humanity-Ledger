'use client';

import { useEffect, useState } from 'react';
import { addressFingerprint } from '@/lib/aztec/address-fingerprint';

/** Hash fingerprint of an Aztec address; null while computing or when the address is missing or malformed. */
export function useAddressFingerprint(address: string | undefined): string | null {
  const [fp, setFp] = useState<string | null>(null);
  useEffect(() => {
    setFp(null);
    if (!address) return;
    let live = true;
    addressFingerprint(address).then((v) => live && setFp(v), () => live && setFp(null));
    return () => { live = false; };
  }, [address]);
  return fp;
}
