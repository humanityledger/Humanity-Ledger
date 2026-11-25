/**
 * lib/dashboard/sources.ts — the one place that decides where the dashboard's data comes from.
 *
 * Normal path ("live"): only this account's own data, all of it on this device or public chain state.
 *   - wallet state: the private wallet in this tab — its PXE runs in this browser, decrypts this
 *     account's notes, and keeps the activity record (lib/aztec/wallet/client.ts);
 *   - proven counterparties: verified peer bindings in this browser's storage (lib/aztec/peer-binding.ts);
 *   - names: the contacts this browser keeps for the signed-in account (lib/wallet/localAddressBook.ts).
 * Nothing is filled in when a source is empty: no account means no account, no activity means none.
 *
 * Example path: a made-up account (lib/dashboard/example.ts), reached only when the URL query is
 * exactly ?example=1, and labelled on every view by the page. test/unit/dashboard/real-data.test.ts
 * fails if an example value can reach the live path, or if anything but this file imports the example.
 */
import { readBindings, type DashInputs } from './model';
import { EXAMPLE_ACCOUNT, exampleBindings, exampleContacts, exampleWalletState } from './example';

export type DataMode = 'live' | 'example';

/** 'example' only for ?example=1: not "true", not "0", not "1 " and not absent. */
export function dataMode(search: string): DataMode {
  try {
    return new URLSearchParams(search).get('example') === '1' ? 'example' : 'live';
  } catch {
    return 'live';
  }
}

/** The Ledger Chat account the page is about: the session's own, or '' when signed out. */
export function accountFor(mode: DataMode, session: string | null | undefined): string {
  if (mode === 'example') return EXAMPLE_ACCOUNT;
  return typeof session === 'string' ? session : '';
}

interface WalletLike {
  phase: string;
  busy: boolean;
  aztecAddress?: string;
  balances: unknown[];
  activity: unknown[];
  feeJuice?: unknown;
}

/** The wallet state to draw. Live: the private wallet's own state object, unchanged. */
export function walletView<S extends WalletLike>(mode: DataMode, live: S, now: number): S {
  if (mode === 'live') return live;
  return { ...live, ...exampleWalletState(now), step: undefined, error: undefined, errorDetail: undefined } as S;
}

/**
 * True when the wallet in this tab may be shown for `account`: it was opened for that same Ethereum
 * account. A wallet opened earlier in this tab for another account is treated as not open.
 */
export function walletIsFor(mode: DataMode, openedFor: string | null | undefined, account: string): boolean {
  if (mode === 'example') return true;
  return !!account && !!openedFor && openedFor.toLowerCase() === account.toLowerCase();
}

export interface InputSources {
  activity: DashInputs['activity'];
  tokens: DashInputs['tokens'];
  storage: Pick<Storage, 'length' | 'key' | 'getItem'> | undefined;
  contacts: { peerAddress: string; name: string }[];
  now: number;
}

/** The model's input. Live: from the sources passed in and nothing else. */
export function modelInputs(mode: DataMode, src: InputSources): DashInputs {
  if (mode === 'example') return { activity: src.activity, tokens: src.tokens, bindings: exampleBindings(), contacts: exampleContacts(), now: src.now };
  return {
    activity: src.activity,
    tokens: src.tokens,
    bindings: readBindings(src.storage),
    contacts: src.contacts.map((c) => ({ address: c.peerAddress, name: c.name })),
    now: src.now,
  };
}
