/** /studio must open whatever an older build left in IndexedDB. */
import { describe, it, expect } from 'vitest';
import { sanitizePrefs, isConversationShape, DEFAULT_PREFS } from '@/lib/studio/store';

describe('sanitizePrefs', () => {
  it('falls back field by field on wrong shapes', () => {
    const p = sanitizePrefs({ customSkills: 'x', rules: { allow: 'a' }, webSearch: 'yes', defaultModel: 'claude-sonnet-4-5', memory: 'm' }, (v) => v === 'claude-sonnet-5-5');
    expect(Array.isArray(p.customSkills)).toBe(true);
    expect(p.rules.allow).toEqual([]);
    expect(p.rules.deny).toEqual(DEFAULT_PREFS.rules.deny);
    expect(p.webSearch).toBe(DEFAULT_PREFS.webSearch);
    expect(p.defaultModel).toBe(DEFAULT_PREFS.defaultModel);
    expect(p.memory).toBe('m');
  });
  it('handles missing or garbage records', () => {
    expect(sanitizePrefs(undefined).uiLanguage).toBe(DEFAULT_PREFS.uiLanguage);
    expect(sanitizePrefs('corrupt').personalization).toEqual(DEFAULT_PREFS.personalization);
  });
});

describe('isConversationShape', () => {
  it('drops half-written conversations', () => {
    expect(isConversationShape({ id: 'c_1', messages: [], updatedAt: 1 })).toBe(true);
    expect(isConversationShape({ id: 'c_1', updatedAt: 1 })).toBe(false);
    expect(isConversationShape(null)).toBe(false);
  });
});
