import { describe, it, expect } from 'vitest';
import { extensionForRecording, pickRecordingMimeType } from '@/lib/chat/recording';

const only = (...types: string[]) => (t: string) => types.includes(t);

describe('voice note recording type', () => {
  it('prefers AAC in MP4, which plays on every browser', () => {
    expect(pickRecordingMimeType(only('audio/mp4;codecs=mp4a.40.2', 'audio/webm;codecs=opus'))).toBe('audio/mp4;codecs=mp4a.40.2');
  });
  it('uses Opus/WebM on Chromium and Firefox without AAC recording', () => {
    expect(pickRecordingMimeType(only('audio/webm;codecs=opus', 'audio/webm'))).toBe('audio/webm;codecs=opus');
  });
  it('uses plain MP4 on Safari 14.1-18.3, and falls back to the browser default', () => {
    expect(pickRecordingMimeType(only('audio/mp4'))).toBe('audio/mp4');
    expect(pickRecordingMimeType(only())).toBe('');
    expect(pickRecordingMimeType(undefined)).toBe('');
    expect(pickRecordingMimeType(() => { throw new Error('boom'); })).toBe('');
  });
  it('names files from the real recorded type', () => {
    expect(extensionForRecording('audio/mp4;codecs=mp4a.40.2')).toBe('m4a');
    expect(extensionForRecording('audio/aac')).toBe('aac');
    expect(extensionForRecording('audio/webm;codecs=opus')).toBe('webm');
    expect(extensionForRecording('audio/ogg;codecs=opus')).toBe('ogg');
  });
});
