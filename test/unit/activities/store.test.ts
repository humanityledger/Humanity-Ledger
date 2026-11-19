import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { findActivity, resetActivities, useActivities } from '@/lib/activities/store';
import { runOpenAction, setOpenAction } from '@/lib/activities/actions';
import { toAmount, toDisplayName } from '@/lib/activities/values';

const store = () => useActivities.getState();
const peer = toDisplayName('Ana Ruiz');
const callState = { phase: 'active' as const, micMuted: false, cameraOff: false, remoteVideo: true, connectedAt: 1 };

describe('ActivityManager', () => {
  beforeEach(() => { vi.useFakeTimers(); resetActivities(); });
  afterEach(() => { resetActivities(); vi.useRealTimers(); });

  it('the call is a singleton: a new phase updates it and keeps its start', () => {
    store().start('call', { peer, media: 'audio' }, { ...callState, phase: 'outgoing', connectedAt: undefined });
    const startedAt = store().activities[0].startedAt;
    vi.advanceTimersByTime(3000);
    store().start('call', { peer, media: 'audio' }, callState);
    expect(store().activities).toHaveLength(1);
    expect(store().activities[0].startedAt).toBe(startedAt);
    expect(findActivity('call', 'call')?.state.phase).toBe('active');
  });

  it('messages from one sender add up instead of stacking, and leave on their own', () => {
    store().start('message', { from: toDisplayName('Leo') }, { count: 1 }, { dismissAfter: 4000 });
    vi.advanceTimersByTime(3000);
    store().start('message', { from: toDisplayName('Leo') }, { count: 1 }, { dismissAfter: 4000 });
    expect(store().activities).toHaveLength(1);
    expect(findActivity('message', 'message:Leo')?.state.count).toBe(2);
    vi.advanceTimersByTime(3999);
    expect(store().activities).toHaveLength(1); // the second message restarted the timer
    vi.advanceTimersByTime(1);
    expect(store().activities).toHaveLength(0);
  });

  it('end with linger keeps the final state on screen, then removes it', () => {
    const id = store().start('paymentProof', { to: peer, amount: toAmount('25', 'HLC')! }, { step: 'sending', updatedAt: 0 }, { id: 'proof:1' });
    store().end(id, { linger: 3000, finalState: { step: 'settled' } });
    expect(findActivity('paymentProof', id)?.state.step).toBe('settled');
    vi.advanceTimersByTime(3000);
    expect(findActivity('paymentProof', id)).toBeUndefined();
  });

  it('a new call cancels the lingering "Call ended" of the previous one', () => {
    store().start('call', { peer, media: 'audio' }, callState);
    store().end('call', { linger: 2400, finalState: { phase: 'ended', endedAfter: 252 } });
    store().start('call', { peer: toDisplayName('Leo'), media: 'video' }, { ...callState, phase: 'incoming', connectedAt: undefined });
    vi.advanceTimersByTime(5000);
    const next = findActivity('call', 'call');
    expect(next?.state.phase).toBe('incoming');
    expect(next?.state.endedAfter).toBeUndefined(); // nothing of the old call carries over
  });

  it('one presentation for the whole app; dismissing the call returns it to the stage', () => {
    store().start('call', { peer, media: 'video' }, callState);
    store().expand('call');
    store().setPresentation('window');
    expect(store().presentation).toBe('window');
    expect(store().expandedId).toBeNull(); // moving the call collapses the island
    store().dismiss('call');
    expect(store().presentation).toBe('stage');
  });

  it('dismissing a message forgets its open action', () => {
    const open = vi.fn();
    const id = store().start('message', { from: toDisplayName('Leo') }, { count: 1 });
    setOpenAction(id, open);
    store().dismiss(id);
    runOpenAction(id);
    expect(open).not.toHaveBeenCalled();
  });

  it('a proof whose page was closed goes stale instead of spinning forever', () => {
    store().start('paymentProof', { to: peer, amount: toAmount('1', 'HLC')! }, { step: 'proving', updatedAt: 0 }, { id: 'proof:2', staleAfter: 60_000 });
    store().sweep(Date.now() + 59_999);
    expect(store().activities).toHaveLength(1);
    store().sweep(Date.now() + 60_000);
    expect(store().activities).toHaveLength(0);
  });
});
