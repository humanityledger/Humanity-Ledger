/**
 * lib/payments/private-asset.ts: the token private payments use on this build, in words. HLC (a
 * test token) until the operator turns on cUSDC for everyone (lib/payments/cusdc-public.ts); then
 * cUSDC replaces it in the wallet and in these texts.
 */
import { CUSDC_PUBLIC } from '@/lib/aztec/wallet/config';

export const PRIVATE_ASSET = CUSDC_PUBLIC
  ? { symbol: 'cUSDC', test: false, phrase: 'cUSDC, a dollar token issued by human.tech' }
  : { symbol: 'HLC', test: true, phrase: 'HLC, a test token with no monetary value' };
