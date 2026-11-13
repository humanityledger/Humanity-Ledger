/**
 * Private value never moves inside a community: the community server would see
 * the message, and G7 proofs are bound to a direct conversation. A community
 * hands the member's wallet address to the 1:1 chat, which opens the payment or
 * agreement there. Only the EVM address and the action name cross; nothing else.
 */
export type ValueAction = 'pay' | 'agreement';

export const VALUE_HANDOFF_EVENT = 'hl:open-dm-value';

export interface ValueHandoff {
  peer: string;
  action: ValueAction;
}

const EVM = /^0x[0-9a-fA-F]{40}$/;

export function parseValueHandoff(detail: unknown): ValueHandoff | null {
  const d = detail as Partial<ValueHandoff> | null;
  if (!d || typeof d.peer !== 'string' || !EVM.test(d.peer)) return null;
  if (d.action !== 'pay' && d.action !== 'agreement') return null;
  return { peer: d.peer, action: d.action };
}

export function requestValueHandoff(h: ValueHandoff): boolean {
  if (typeof window === 'undefined' || !parseValueHandoff(h)) return false;
  window.dispatchEvent(new CustomEvent(VALUE_HANDOFF_EVENT, { detail: { peer: h.peer, action: h.action } }));
  return true;
}
