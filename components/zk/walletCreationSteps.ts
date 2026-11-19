/**
 * components/zk/walletCreationSteps.ts — the steps of opening a private wallet and what each shows.
 * Pure, so the rule is tested without rendering (test/unit/aztec/wallet-creation-steps.test.ts).
 */
import { FEE_PRIVACY } from '@/lib/landing/content';

export type CreationPhase = 'idle' | 'signing' | 'starting' | 'needs-fee-juice' | 'deploying' | 'ready' | 'error' | string;

export type StepKey = 'sign' | 'keys' | 'fees' | 'account';

export function creationSteps(alpha: boolean, networkName: string, linkedComputer?: boolean): { key: StepKey; label: string; note: string }[] {
  return [
    {
      key: 'sign',
      label: linkedComputer ? 'Approve on your phone' : 'Sign a message in your wallet',
      note: 'Free, and it sends no transaction. Check that the site is ledgerchat.org',
    },
    { key: 'keys', label: 'Create your keys on this device', note: 'We never receive them' },
    ...(alpha ? [{ key: 'fees' as const, label: 'Add Fee Juice', note: `Your account pays its own network fee. ${FEE_PRIVACY.short}` }] : []),
    { key: 'account', label: `Create your account on ${networkName}`, note: 'About a minute. Keep this page open' },
  ];
}

export const AT: Record<string, StepKey | undefined> = { signing: 'sign', starting: 'keys', 'needs-fee-juice': 'fees', deploying: 'account' };

export type StepState = 'done' | 'active' | 'bad' | 'todo';

/**
 * What each step shows, from the wallet's real phase (lib/aztec/wallet/client.ts):
 *  - after a valid signature the keys are made in 'starting'; leaving it, both are done;
 *  - 'needs-fee-juice': Add Fee Juice is the current step and has no check;
 *  - 'deploying' is reached only with Fee Juice present (or a ready deposit), so Add Fee Juice is done;
 *  - an account that already exists goes straight to 'ready' and never sits on this sheet;
 *  - 'error' marks the step that was running and leaves every later one unchecked.
 */
export function stepStates(phase: CreationPhase, steps: ReadonlyArray<{ key: StepKey }>, lastRunning?: StepKey): StepState[] {
  if (phase === 'ready') return steps.map(() => 'done');
  const failed = phase === 'error';
  const current = failed ? lastRunning ?? 'sign' : AT[phase];
  const at = current ? steps.findIndex((x) => x.key === current) : -1;
  return steps.map((_, i) => (i < at ? 'done' : i === at ? (failed ? 'bad' : 'active') : 'todo'));
}

