import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { findActivity, resetActivities, useActivities } from '@/lib/activities/store';
import { hasAction, runAction } from '@/lib/activities/actions';
import { MISSED_CALL_MS, notifyMissedCall } from '@/lib/activities/hooks';

describe('missed calls', () => {
  beforeEach(() => { vi.useFakeTimers(); resetActivities(); });
  afterEach(() => { resetActivities(); vi.useRealTimers(); });

  it('one per person: a second miss counts up instead of stacking, and the timer restarts', () => {
    notifyMissedCall('Ana Ruiz', 'video');
    vi.advanceTimersByTime(MISSED_CALL_MS - 1000);
    notifyMissedCall('Ana Ruiz', 'video');
    const a = findActivity('missedCall', 'missed:Ana Ruiz');
    expect(useActivities.getState().activities).toHaveLength(1);
    expect(a?.state.count).toBe(2);
    expect(a?.attributes.media).toBe('video');
    vi.advanceTimersByTime(MISSED_CALL_MS - 1);
    expect(useActivities.getState().activities).toHaveLength(1);
    vi.advanceTimersByTime(1);
    expect(useActivities.getState().activities).toHaveLength(0);
  });

  it('Call back and Message run what the chat gave, and leave with the activity', () => {
    const callBack = vi.fn();
    const open = vi.fn();
    notifyMissedCall('Leo', 'audio', { callBack, open });
    expect(runAction('missed:Leo', 'callBack')).toBe(true);
    expect(runAction('missed:Leo', 'open')).toBe(true);
    expect(callBack).toHaveBeenCalledOnce();
    expect(open).toHaveBeenCalledOnce();
    useActivities.getState().dismiss('missed:Leo');
    expect(hasAction('missed:Leo', 'callBack')).toBe(false);
    expect(runAction('missed:Leo', 'open')).toBe(false);
  });

  it('a name that is really a message body is cut to one short line', () => {
    notifyMissedCall('Hi, the code for the door is 4471.\nCall me when you get here', 'audio');
    const a = useActivities.getState().activities[0];
    expect(a.kind).toBe('missedCall');
    if (a.kind === 'missedCall') {
      expect(a.attributes.peer).not.toContain('\n');
      expect(Array.from(a.attributes.peer).length).toBeLessThanOrEqual(32);
    }
  });
});
