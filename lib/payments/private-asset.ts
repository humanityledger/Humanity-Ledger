/**
 * lib/payments/private-asset.ts: the token private payments use on Aztec Alpha, in words. cUSDC:
 * for members of the closed beta, or for everyone once the operator turns that on
 * (lib/payments/cusdc-public.ts). HLC, the test token, is no longer listed on Alpha.
 */
import { CUSDC_PUBLIC } from '@/lib/aztec/wallet/config';

export const PRIVATE_ASSET = CUSDC_PUBLIC
  ? { symbol: 'cUSDC', test: false, phrase: 'cUSDC, a dollar token issued by human.tech' }
  : { symbol: 'cUSDC', test: false, phrase: 'cUSDC, a dollar token issued by human.tech, for members of the closed beta' };
