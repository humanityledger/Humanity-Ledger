'use client';

import { useEffect, useState } from 'react';
import { currentValueMode, type ValueModeResult } from './value-mode';

/** For display only: the action itself asks again (assertNewValueAllowed). null while loading. */
export function useValueMode(): ValueModeResult | null {
  const [r, setR] = useState<ValueModeResult | null>(null);
  useEffect(() => {
    let live = true;
    currentValueMode().then((v) => live && setR(v));
    return () => { live = false; };
  }, []);
  return r;
}
