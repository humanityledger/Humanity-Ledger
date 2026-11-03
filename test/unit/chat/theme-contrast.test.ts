import { CHAT_THEMES, ON_ACCENT, contrastRatio, findChatTheme, isChatThemeId, chatThemeVars } from '@/lib/chat/themes';

describe('chat themes', () => {
  it('ids are unique and the first is the default', () => {
    const ids = CHAT_THEMES.map(t => t.id);
    expect(new Set(ids).size).toBe(ids.length);
    expect(ids[0]).toBe('default');
  });

  for (const t of CHAT_THEMES) {
    describe(t.label, () => {
      it('white text on the sent bubble meets WCAG AA (4.5:1)', () => {
        expect(contrastRatio(ON_ACCENT, t.accent)).toBeGreaterThanOrEqual(4.5);
      });
      it('text and secondary text on the received bubble meet 4.5:1', () => {
        expect(contrastRatio(t.receivedText, t.received)).toBeGreaterThanOrEqual(4.5);
        expect(contrastRatio(t.receivedMuted, t.received)).toBeGreaterThanOrEqual(4.5);
      });
      it('the time under a message meets 4.5:1 on the canvas', () => {
        expect(contrastRatio(t.meta, t.canvas)).toBeGreaterThanOrEqual(4.5);
      });
      it('the read tick meets 3:1 on the canvas', () => {
        expect(contrastRatio(t.read, t.canvas)).toBeGreaterThanOrEqual(3);
      });
    });
  }

  it('an unknown id falls back to Classic and is not accepted as an id', () => {
    expect(findChatTheme('nope').id).toBe('default');
    expect(findChatTheme(undefined).id).toBe('default');
    expect(isChatThemeId('midnight')).toBe(true);
    expect(isChatThemeId('url(javascript:alert(1))')).toBe(false);
    expect(isChatThemeId(42)).toBe(false);
  });

  it('only emits hex colours as CSS values (no user-supplied CSS)', () => {
    for (const t of CHAT_THEMES) {
      for (const v of Object.values(chatThemeVars(t))) expect(v).toMatch(/^#[0-9a-f]{6}$/i);
    }
  });

  it('contrastRatio matches known reference values', () => {
    expect(contrastRatio('#000000', '#ffffff')).toBeCloseTo(21, 5);
    expect(contrastRatio('#777777', '#ffffff')).toBeCloseTo(4.48, 2);
  });
});
