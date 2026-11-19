/** Package 5: one statement of fee privacy on Alpha, used by the web and the wallet. */
import fs from 'node:fs';
import { FEE_PRIVACY } from '@/lib/landing/content';

const USERS = [
  'components/zk/PaymentProgress.tsx',
  'components/chat/AgreementComposer.tsx',
  'components/zk/ZkInvoiceModal.tsx',
  'components/chat/LedgerSettingsFull.tsx',
  'components/zk/walletCreationSteps.ts',
];

describe('fee privacy on Aztec Alpha', () => {
  it('says the fee payer is visible and the amount and parties are not', () => {
    expect(FEE_PRIVACY.short).toMatch(/Amount and parties stay private/);
    expect(FEE_PRIVACY.short).toMatch(/pays the fee is public/);
    expect(FEE_PRIVACY.long).toMatch(/linked to each other/);
    expect(FEE_PRIVACY.long).toMatch(/Nothing is sponsored/);
    expect(FEE_PRIVACY.onChain).toMatch(/the account that paid it\. Not the amount or the recipient/);
  });
  it('the wallet and the web read it from one place', () => {
    for (const f of USERS) expect(fs.readFileSync(f, 'utf8')).toMatch(/FEE_PRIVACY\.(short|long|onChain)/);
  });
  it('nothing claims the sender or the fee payer is hidden', () => {
    for (const f of USERS) {
      const src = fs.readFileSync(f, 'utf8');
      expect(src).not.toMatch(/Not the amount, you/);
      expect(src).not.toMatch(/fee payer (is |stays )?(private|hidden)/i);
    }
  });
  it('the FPC evaluation keeps the decision: no sponsoring', () => {
    const doc = fs.readFileSync('docs/aztec/FPC_EVALUATION.md', 'utf8');
    expect(doc).toMatch(/\*\*Decision: no change\.\*\*/);
    expect(fs.readFileSync('lib/security/retiredRoutes.ts', 'utf8')).toContain("'/api/aztec/sponsor'");
  });
});
