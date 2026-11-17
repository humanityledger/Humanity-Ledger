/**
 * lib/portal/withdraw.ts — checks on a withdrawal to Ethereum before anything is proved.
 */

/** What withdraw refuses, in one sentence, or null. */
export function withdrawProblem(p: { to: string; amount: string; decimals: number; own: Set<string> }): string | null {
  if (!p.amount) return 'Enter an amount.';
  if (!/^\d+(\.\d+)?$/.test(p.amount)) return 'Enter the amount as a number, like 25 or 0.5.';
  const frac = p.amount.split('.')[1];
  if (frac && frac.length > p.decimals) return `At most ${p.decimals} decimals.`;
  if (!/[1-9]/.test(p.amount)) return 'Enter an amount above zero.';
  if (!p.to) return 'Enter the Ethereum address to pay.';
  if (!/^0x[0-9a-fA-F]{40}$/.test(p.to)) return 'That is not an Ethereum address (0x and 40 characters).';
  if (/^0x0{40}$/i.test(p.to)) return 'That is the zero address. Funds sent there are lost.';
  if (p.own.has(p.to.toLowerCase())) return 'That is one of your own receiver addresses. Withdraw to a wallet you control on Ethereum.';
  return null;
}
