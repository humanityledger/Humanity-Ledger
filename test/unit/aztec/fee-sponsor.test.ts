/** Fee Juice paid by a contact (components/zk/FeeSponsor.tsx): the reserved claim secret. */
import { nextSecretIndex } from '@/lib/aztec/fee-juice';

const SPONSOR = 15; // SPONSOR_SECRET_INDEX in lib/aztec/wallet/client.ts (CLAIM_SECRETS - 1)

describe('sponsored Fee Juice', () => {
  it('own deposits never take the index reserved for sponsors', () => {
    const claims = Array.from({ length: 14 }, (_, i) => ({ secretIndex: i } as any));
    expect(nextSecretIndex(claims, [SPONSOR])).toBe(14);
    expect(nextSecretIndex([...claims, { secretIndex: 14 } as any], [SPONSOR])).toBe(16); // refused by bridgeFeeJuice (>= SPONSOR)
  });
});
