/** The two-session payments harness exists only in test builds and drives the real components. */
import fs from 'node:fs';

describe('payments e2e harness', () => {
  const surface = fs.readFileSync('components/chat/surface/ChatSurface.tsx', 'utf8');
  const harness = fs.readFileSync('components/chat/e2e/PaymentsHarness.tsx', 'utf8');
  it('is mounted only when NEXT_PUBLIC_E2E_HARNESS is 1, at /chat?e2e=payments', () => {
    expect(surface).toMatch(/const PaymentsHarness = E2E \? dynamic\(\(\) => import\('@\/components\/chat\/e2e\/PaymentsHarness'\)/);
    expect(surface).toMatch(/harnessName\(\) === 'payments'/);
  });
  it('uses the real cards, composer, notifier and payment message', () => {
    for (const s of ['AgreementCard', 'PaymentRequestComposer', 'IncomingPaymentNotifier', 'buildPaymentMessage', 'PAY_REQUEST_EVENT', 'rememberPaidRequest']) {
      expect(harness).toContain(s);
    }
  });
  it('the workflow builds with the harness on and runs the two-session script', () => {
    const wf = fs.readFileSync('.github/workflows/payments-e2e.yml', 'utf8');
    expect(wf).toMatch(/NEXT_PUBLIC_E2E_HARNESS: '1'/);
    expect(wf).toMatch(/node scripts\/ui\/payments-e2e\.mjs/);
  });
  it('the production build never declares the harness flag', () => {
    expect(fs.readFileSync('Dockerfile', 'utf8')).not.toMatch(/ARG NEXT_PUBLIC_E2E_HARNESS/);
  });
});
