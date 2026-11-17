import { describe, it, expect } from 'vitest';
import { withdrawProblem } from '@/lib/portal/withdraw';

const own = new Set(['0x' + 'a'.repeat(40)]);
const ok = { to: '0x' + 'b'.repeat(40), amount: '25.5', decimals: 6, own };

describe('withdrawal checks', () => {
  it('accepts a valid amount and an outside address', () => {
    expect(withdrawProblem(ok)).toBeNull();
  });
  it('refuses bad amounts', () => {
    expect(withdrawProblem({ ...ok, amount: '' })).not.toBeNull();
    expect(withdrawProblem({ ...ok, amount: '1e5' })).not.toBeNull();
    expect(withdrawProblem({ ...ok, amount: '0.0' })).not.toBeNull();
    expect(withdrawProblem({ ...ok, amount: '1.1234567' })).toBe('At most 6 decimals.');
  });
  it('refuses the zero address and the person\'s own receiver addresses', () => {
    expect(withdrawProblem({ ...ok, to: '0x' + '0'.repeat(40) })).toMatch(/zero address/);
    expect(withdrawProblem({ ...ok, to: '0x' + 'A'.repeat(40) })).toMatch(/own receiver/);
    expect(withdrawProblem({ ...ok, to: '0x123' })).toMatch(/not an Ethereum address/);
  });
});
