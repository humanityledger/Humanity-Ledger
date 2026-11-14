import { describe, it, expect } from 'vitest';
import { explorerTxUrl, sanitiseExplorerUrl } from '@/lib/aztec/client';

// AztecScan serves a transaction at /tx-effects/0x<hash>; /tx-effect/<hash> answers 404 (checked 14 Nov 2026).
const H = '0x0a333fc0b698454e51f28d8ee18dcf3174a21605479a40a67568d4295c6fcc94';

describe('AztecScan links', () => {
  it('builds /tx-effects/0x<hash> for a real hash', () => {
    expect(explorerTxUrl(H)).toBe(`https://aztecscan.xyz/tx-effects/${H}`);
  });
  it('sends virtual or empty hashes to the explorer home', () => {
    expect(explorerTxUrl('aztec-airdrop-1')).toBe('https://aztecscan.xyz');
    expect(explorerTxUrl(undefined)).toBe('https://aztecscan.xyz');
  });
  it('repairs links stored in older formats', () => {
    expect(sanitiseExplorerUrl(`https://aztecscan.xyz/tx-effect/${H.slice(2)}`)).toBe(`https://aztecscan.xyz/tx-effects/${H}`);
    expect(sanitiseExplorerUrl(`https://aztecscan.xyz/tx/${H}`)).toBe(`https://aztecscan.xyz/tx-effects/${H}`);
    expect(sanitiseExplorerUrl(`https://aztecscan.xyz/tx-effects/${H}`)).toBe(`https://aztecscan.xyz/tx-effects/${H}`);
  });
});
