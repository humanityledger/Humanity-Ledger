/**
 * CIRCUIT BREAKER  Test Suite
 * Validates all state transitions: CLOSED  OPEN  HALF_OPEN  CLOSED
 */

import { vi } from 'vitest';
import { CircuitBreaker } from '../../../lib/resilience/circuit-breaker';

const makeBreaker = (overrides = {}) =>
  new CircuitBreaker({ name: 'test', failureThreshold: 3, openDurationMs: 100, heartbeatIntervalMs: 9999, ...overrides });

const fail = () => Promise.reject(new Error('upstream failure'));
const succeed = () => Promise.resolve('ok');

describe('CircuitBreaker', () => {
  it('starts in CLOSED state', () => {
    const cb = makeBreaker();
    expect(cb.getMetrics().state).toBe('CLOSED');
  });

  it('stays CLOSED after failures below threshold', async () => {
    const cb = makeBreaker({ failureThreshold: 3 });
    for (let i = 0; i < 2; i++) {
      await cb.execute(fail).catch(() => {});
    }
    expect(cb.getMetrics().state).toBe('CLOSED');
    expect(cb.getMetrics().consecutiveFailures).toBe(2);
  });

  it('transitions CLOSED  OPEN at failure threshold', async () => {
    const cb = makeBreaker({ failureThreshold: 3 });
    for (let i = 0; i < 3; i++) {
      await cb.execute(fail).catch(() => {});
    }
    expect(cb.getMetrics().state).toBe('OPEN');
  });

  it('rejects immediately while OPEN', async () => {
    const cb = makeBreaker({ failureThreshold: 1, openDurationMs: 60_000 });
    await cb.execute(fail).catch(() => {});
    expect(cb.getMetrics().state).toBe('OPEN');
    await expect(cb.execute(succeed)).rejects.toThrow('Circuit OPEN');
  });

  it('transitions OPEN  HALF_OPEN after duration', async () => {
    const cb = makeBreaker({ failureThreshold: 1, openDurationMs: 50 });
    await cb.execute(fail).catch(() => {});
    expect(cb.getMetrics().state).toBe('OPEN');
    await new Promise(r => setTimeout(r, 60));
    // Next execute should attempt probe (HALF_OPEN)
    await cb.execute(succeed).catch(() => {});
    expect(cb.getMetrics().state).toBe('CLOSED');
  });

  it('transitions HALF_OPEN  CLOSED on probe success', async () => {
    const cb = makeBreaker({ failureThreshold: 1, openDurationMs: 50 });
    await cb.execute(fail).catch(() => {});
    await new Promise(r => setTimeout(r, 60));
    await cb.execute(succeed);
    expect(cb.getMetrics().state).toBe('CLOSED');
    expect(cb.getMetrics().consecutiveFailures).toBe(0);
  });

  it('transitions HALF_OPEN  OPEN on probe failure', async () => {
    const cb = makeBreaker({ failureThreshold: 1, openDurationMs: 50 });
    await cb.execute(fail).catch(() => {});
    await new Promise(r => setTimeout(r, 60));
    await cb.execute(fail).catch(() => {});
    expect(cb.getMetrics().state).toBe('OPEN');
  });

  it('resets to CLOSED manually', async () => {
    const cb = makeBreaker({ failureThreshold: 1 });
    await cb.execute(fail).catch(() => {});
    expect(cb.getMetrics().state).toBe('OPEN');
    cb.reset();
    expect(cb.getMetrics().state).toBe('CLOSED');
    expect(cb.getMetrics().consecutiveFailures).toBe(0);
  });

  it('tracks total failures and successes', async () => {
    const cb = makeBreaker({ failureThreshold: 10 });
    await cb.execute(succeed);
    await cb.execute(succeed);
    await cb.execute(fail).catch(() => {});
    const m = cb.getMetrics();
    expect(m.totalSuccesses).toBe(2);
    expect(m.totalFailures).toBe(1);
  });

  it('notifies state change callback', async () => {
    const onChange = vi.fn();
    const cb = new CircuitBreaker({ name: 'test', failureThreshold: 1, openDurationMs: 100, heartbeatIntervalMs: 9999 }, onChange);
    await cb.execute(fail).catch(() => {});
    expect(onChange).toHaveBeenCalledWith('CLOSED', 'OPEN', 'test');
  });
});
