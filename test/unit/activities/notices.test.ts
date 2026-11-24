import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  buttonLabel, NOTICE_DEFAULT_MS, NOTICE_ERROR_MS, noticeDuration, noticeId, noticeSignature, noticeState, noticeTone, progressOf, textOf,
} from '@/lib/activities/notices';
import { cancelNotice, holdNotices, resetNoticeClock, scheduleNotice } from '@/lib/activities/notice-clock';
import { NOTICE_TEXT_MAX, toNoticeText } from '@/lib/activities/values';

/** What a React element looks like to textOf: an object with props.children. */
const el = (children: unknown) => ({ $$typeof: Symbol.for('react.element'), type: 'span', props: { children } });

describe('toasts become notices', () => {
  it('every sonner type maps to a tone', () => {
    expect(noticeTone('success')).toBe('success');
    expect(noticeTone('error')).toBe('error');
    expect(noticeTone('warning')).toBe('warning');
    expect(noticeTone('info')).toBe('info');
    expect(noticeTone('loading')).toBe('loading');
    for (const t of ['normal', 'default', 'action', undefined]) expect(noticeTone(t)).toBe('neutral');
  });

  it('reads the words of strings, numbers and React elements, and nothing of functions', () => {
    expect(textOf('Saved')).toBe('Saved');
    expect(textOf(42)).toBe('42');
    expect(textOf(el(['Forwarded to ', el('Ana')]))).toBe('Forwarded to Ana');
    expect(textOf(() => 'x')).toBe('');
    expect(textOf(null)).toBe('');
    expect(textOf(false)).toBe('');
    // A cycle cannot hang it.
    const loop: { props: { children: unknown } } = { props: { children: null } };
    loop.props.children = loop;
    expect(textOf(loop)).toBe('');
  });

  it('reads progress from a percentage or a count, and only real ones', () => {
    expect(progressOf('Sending photo.jpg, 42%')).toBeCloseTo(0.42);
    expect(progressOf('Step 10% then 80%')).toBeCloseTo(0.8); // the last one
    expect(progressOf('Importing 3/10')).toBeCloseTo(0.3);
    expect(progressOf('Encrypting photo.jpg')).toBeUndefined();
    expect(progressOf('250%')).toBeUndefined();
    expect(progressOf('4/0')).toBeUndefined();
    expect(progressOf('11/10')).toBeUndefined();
  });

  it('a toast becomes one line of copy; long or multi-line text is cut, never spread', () => {
    const st = noticeState({ id: 1, type: 'error', title: 'Could not send\nRetry later', description: 'x'.repeat(400) })!;
    expect(st.tone).toBe('error');
    expect(st.title).toBe('Could not send Retry later');
    expect(Array.from(st.detail!).length).toBe(NOTICE_TEXT_MAX);
    expect(st.detail!.endsWith('…')).toBe(true);
  });

  it('a toast with no words still says something, by its tone; a description alone becomes the title', () => {
    expect(noticeState({ id: 1, type: 'success', title: '' })!.title).toBe('Done');
    expect(noticeState({ id: 1, type: 'error' })!.title).toBe('That did not work');
    const onlyDetail = noticeState({ id: 1, type: 'info', title: '', description: 'Messages will wait' })!;
    expect(onlyDetail.title).toBe('Messages will wait');
    expect(onlyDetail.detail).toBeUndefined();
  });

  it('a toast being removed is not a notice', () => {
    expect(noticeState({ id: 1, type: 'success', title: 'x', delete: true })).toBeNull();
  });

  it('action and cancel are kept only when sonner could run them', () => {
    expect(buttonLabel({ label: 'Undo', onClick: () => undefined })).toBe('Undo');
    expect(buttonLabel({ label: 'Undo' })).toBeUndefined();
    expect(buttonLabel(el('A custom button'))).toBeUndefined();
    const st = noticeState({ id: 1, type: 'success', title: 'Deleted', action: { label: 'Undo', onClick: () => undefined }, cancel: { label: 'Keep', onClick: () => undefined } })!;
    expect(st.action).toBe('Undo');
    expect(st.cancel).toBe('Keep');
  });

  it('a loading toast that succeeds is the same notice, and loses its progress', () => {
    const loading = noticeState({ id: 'up', type: 'loading', title: 'Sending photo.jpg, 64%' })!;
    expect(loading.progress).toBeCloseTo(0.64);
    const done = noticeState({ id: 'up', type: 'success', title: 'Sent' })!;
    // Spread over the old state, the explicit undefined wins.
    expect({ ...loading, ...done }.progress).toBeUndefined();
    expect(noticeId('up')).toBe('notice:up');
    expect(noticeSignature(loading, Infinity)).not.toBe(noticeSignature(done, NOTICE_DEFAULT_MS));
  });

  it('stays as long as a toast did; errors longer; loading until it changes; an explicit duration wins', () => {
    expect(noticeDuration({ id: 1 }, 'success')).toBe(NOTICE_DEFAULT_MS);
    expect(noticeDuration({ id: 1 }, 'error')).toBe(NOTICE_ERROR_MS);
    expect(noticeDuration({ id: 1 }, 'loading')).toBe(Infinity);
    expect(noticeDuration({ id: 1, duration: 10_000 }, 'loading')).toBe(10_000);
    expect(noticeDuration({ id: 1, duration: Infinity }, 'success')).toBe(Infinity);
  });

  it('toNoticeText gives null for nothing, so no notice is blank', () => {
    expect(toNoticeText('   ')).toBeNull();
    expect(toNoticeText(undefined)).toBeNull();
    expect(toNoticeText('Ok‮')).toBe('Ok');
  });
});

describe('notice clock', () => {
  beforeEach(() => { vi.useFakeTimers(); resetNoticeClock(); });
  afterEach(() => { resetNoticeClock(); vi.useRealTimers(); });

  it('runs out on time, and never for Infinity', () => {
    const fn = vi.fn();
    const never = vi.fn();
    scheduleNotice('a', 4000, fn);
    scheduleNotice('b', Infinity, never);
    vi.advanceTimersByTime(3999);
    expect(fn).not.toHaveBeenCalled();
    vi.advanceTimersByTime(1);
    expect(fn).toHaveBeenCalledOnce();
    vi.advanceTimersByTime(60_000);
    expect(never).not.toHaveBeenCalled();
  });

  it('waits while the user reads, then resumes with what was left (at least a moment)', () => {
    const fn = vi.fn();
    scheduleNotice('a', 4000, fn);
    vi.advanceTimersByTime(3000);
    holdNotices(true);
    vi.advanceTimersByTime(20_000);
    expect(fn).not.toHaveBeenCalled();
    holdNotices(false);
    vi.advanceTimersByTime(1199);
    expect(fn).not.toHaveBeenCalled(); // 1000 ms were left, but it gets at least 1200
    vi.advanceTimersByTime(1);
    expect(fn).toHaveBeenCalledOnce();
  });

  it('a new schedule replaces the old one; cancel stops it', () => {
    const first = vi.fn();
    const second = vi.fn();
    scheduleNotice('a', 1000, first);
    scheduleNotice('a', 3000, second);
    vi.advanceTimersByTime(1000);
    expect(first).not.toHaveBeenCalled();
    cancelNotice('a');
    vi.advanceTimersByTime(5000);
    expect(second).not.toHaveBeenCalled();
  });

  it('a notice scheduled while held starts only when released', () => {
    const fn = vi.fn();
    holdNotices(true);
    scheduleNotice('a', 2000, fn);
    vi.advanceTimersByTime(10_000);
    expect(fn).not.toHaveBeenCalled();
    holdNotices(false);
    vi.advanceTimersByTime(2000);
    expect(fn).toHaveBeenCalledOnce();
  });
});
