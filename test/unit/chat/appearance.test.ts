/** Wallpapers and bubble styles (lib/chat/wallpapers.ts, lib/chat/bubbleStyles.ts). */
import { WALLPAPERS, WALLPAPER_GROUPS, canvasCss, isWallpaperId, resolveWallpaper } from '@/lib/chat/wallpapers';
import { BUBBLE_STYLES, bubbleClasses, isBubbleStyleId } from '@/lib/chat/bubbleStyles';
import { CHAT_THEMES, CHAT_THEME_GROUPS } from '@/lib/chat/themes';
import fs from 'node:fs';

describe('wallpapers', () => {
  it('dozens of them, unique ids, every one in a known group, "Theme" first', () => {
    expect(WALLPAPERS.length).toBeGreaterThanOrEqual(48);
    const ids = WALLPAPERS.map(w => w.id);
    expect(new Set(ids).size).toBe(ids.length);
    expect(ids[0]).toBe('default');
    for (const w of WALLPAPERS) expect(WALLPAPER_GROUPS.includes(w.group)).toBe(true);
  });

  it('only stored ids or the exact CSS of older builds resolve; anything else is ignored', () => {
    expect(resolveWallpaper('scene-city')?.tone).toBe('dark');
    expect(resolveWallpaper('linear-gradient(160deg, #134e5e 0%, #71b280 100%)')?.id).toBe('forest');
    expect(resolveWallpaper('#000000')?.id).toBe('amoled');
    expect(resolveWallpaper('url(https://evil.example/x.png)')).toBeNull();
    expect(resolveWallpaper('red; background-image: url(x)')).toBeNull();
    expect(resolveWallpaper(42)).toBeNull();
    expect(isWallpaperId('dots')).toBe(true);
  });

  it('draws only from data: URLs and gradients, never a remote image', () => {
    for (const w of WALLPAPERS) {
      const css = JSON.stringify(w.style).replace(/xmlns='http:\/\/www\.w3\.org\/2000\/svg'/g, '');
      const urls = css.match(/url\((?!%23|#)/g)?.length ?? 0; // url(#id) is a gradient inside the SVG
      const dataUrls = css.match(/url\(\\?"data:image\/svg\+xml,/g)?.length ?? 0;
      expect(urls).toBe(dataUrls);
      expect(css).not.toMatch(/https?:/);
    }
  });

  it('the canvas always gets the same five longhands (no shorthand/longhand mix in React)', () => {
    const keys = ['backgroundColor', 'backgroundImage', 'backgroundSize', 'backgroundPosition', 'backgroundRepeat'];
    for (const w of [null, ...WALLPAPERS]) expect(Object.keys(canvasCss(w, '#f7f8fa')).sort()).toEqual([...keys].sort());
    expect(canvasCss(resolveWallpaper('default'), '#123456').backgroundColor).toBe('#123456');
  });
});

describe('bubble styles', () => {
  it('fourteen styles, each drawn in the stylesheet', () => {
    expect(BUBBLE_STYLES.length).toBe(14);
    const css = fs.readFileSync('app/ledger-chat-settings.css', 'utf8');
    for (const b of BUBBLE_STYLES) expect(css).toMatch(new RegExp(`\\.bs-${b.id}\\b`));
  });

  it('marks who sent it and how a theme may recolour it; unknown styles fall back', () => {
    expect(bubbleClasses('gradient', true)).toBe('bs bs-gradient msg-bubble-sent msg-bubble-own');
    expect(bubbleClasses('minimal', false)).toContain('msg-bubble-plain');
    expect(bubbleClasses('cyberpunk', true)).toContain('msg-bubble-fixed');
    expect(bubbleClasses('url(x)', true)).toBe('bs bs-default msg-bubble-sent');
    expect(isBubbleStyleId('glass')).toBe(true);
    expect(isBubbleStyleId('nope')).toBe(false);
  });
});

describe('themes', () => {
  it('forty themes, in the studio groups', () => {
    expect(CHAT_THEMES.length).toBe(40);
    for (const t of CHAT_THEMES) expect(CHAT_THEME_GROUPS.includes(t.group)).toBe(true);
  });
});
