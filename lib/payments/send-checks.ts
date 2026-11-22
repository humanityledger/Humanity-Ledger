/**
 * lib/payments/send-checks.ts: checks the private payment form makes before it starts a proof, so
 * a payment that cannot work stops with a clear reason instead of minutes later. The wallet and
 * the contract still check everything again; these only make the form fast and clear.
 */
import { formatUnits, parseUnits } from '@/lib/aztec/wallet/amounts';
import type { RecipientAnswer } from '@/lib/beta/cusdc-beta-client';

/** Null when the amount fits the private balance, or the balance is not loaded yet. */
export function balanceProblem(
  amount: string,
  token: { symbol: string; decimals: number },
  balance: { privateUnits: bigint; publicUnits: bigint } | undefined,
): string | null {
  if (!balance) return null;
  let units: bigint;
  try {
    units = parseUnits(amount, token.decimals);
  } catch {
    return null; // the amount itself is checked when sending
  }
  if (units <= 0n || units <= balance.privateUnits) return null;
  const have = `${formatUnits(balance.privateUnits, token.decimals, token.decimals)} ${token.symbol}`;
  const hint = balance.publicUnits > 0n ? ` Make your public ${token.symbol} private in the wallet first, or send less.` : ' Send less, or receive more first.';
  return `Your private balance is ${have}, less than this payment.${hint}`;
}

/** Null when a cUSDC payment can go to this peer (or the token is not in the closed beta). */
export function recipientProblem(answer: RecipientAnswer | null, who: string): { text: string; checking: boolean } | null {
  if (answer === 'member') return null;
  if (answer === null) return { text: `Checking that ${who} is in the cUSDC beta…`, checking: true };
  if (answer === 'notMember') {
    return { text: `${who} is not in the cUSDC beta yet, so they could not see this payment. Ask them to join with an invitation, or pay in another token.`, checking: false };
  }
  return { text: `Could not check that ${who} is in the cUSDC beta. Check your connection, then open the payment again.`, checking: false };
}
