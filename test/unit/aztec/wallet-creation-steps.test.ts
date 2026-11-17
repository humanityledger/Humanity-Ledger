/**
 * The creation steps advance only when they are true (components/zk/WalletCreation.tsx).
 */
import { describe, it, expect } from 'vitest';
import fs from 'node:fs';
import { creationSteps, stepStates } from '@/components/zk/walletCreationSteps';

const alpha = creationSteps(true, 'Aztec Alpha');
const keys = alpha.map((s) => s.key);

describe('wallet creation steps on Aztec Alpha', () => {
  it('are the four steps, in order', () => {
    expect(alpha.map((s) => s.label)).toEqual(['Sign a message in your wallet', 'Create your keys on this device', 'Add Fee Juice', 'Create your account on Aztec Alpha']);
  });

  it('nothing is checked before or during the signature', () => {
    expect(stepStates('idle', alpha)).toEqual(['todo', 'todo', 'todo', 'todo']);
    expect(stepStates('signing', alpha)).toEqual(['active', 'todo', 'todo', 'todo']);
  });

  it('a refused signature stays on the first step and checks nothing later', () => {
    expect(stepStates('error', alpha, 'sign')).toEqual(['bad', 'todo', 'todo', 'todo']);
  });

  it('after a valid signature and the keys, an account without Fee Juice waits on Add Fee Juice, unchecked', () => {
    expect(stepStates('needs-fee-juice', alpha)).toEqual(['done', 'done', 'active', 'todo']);
  });

  it('with Fee Juice already there, Add Fee Juice is checked and the account is being created', () => {
    expect(stepStates('deploying', alpha)).toEqual(['done', 'done', 'done', 'active']);
  });

  it('a failure while creating the account keeps the earlier checks and marks only that step', () => {
    expect(stepStates('error', alpha, 'account')).toEqual(['done', 'done', 'done', 'bad']);
  });

  it('an existing account is ready after the signature; the wallet, not this sheet, is shown', () => {
    expect(stepStates('ready', alpha)).toEqual(['done', 'done', 'done', 'done']);
    const client = fs.readFileSync('lib/aztec/wallet/client.ts', 'utf8');
    // INITIALIZED accounts skip deployAccount and go to 'ready' (no Fee Juice step, no deposit asked).
    expect(client).toMatch(/if \(String\(meta\?\.initializationStatus\) !== 'INITIALIZED'\) \{\s*const deployed = await this\.deployAccount\(\);/);
    const panel = fs.readFileSync('components/zk/ZkWalletPanel.tsx', 'utf8');
    expect(panel).toMatch(/\) : !ready \? \(\s*(?:<>\s*)?<WalletCreation/);
    expect(keys).toContain('fees');
  });
});
