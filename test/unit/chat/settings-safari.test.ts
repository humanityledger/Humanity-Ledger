import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';

const css = readFileSync('app/globals.css', 'utf8');
const settings = readFileSync('components/chat/LedgerSettingsFull.tsx', 'utf8');

describe('Settings opens its sections on phones and tablets (cause found 18/11/2026)', () => {
  it('the global nav centering rule never un-hides a hidden nav', () => {
    // Zero specificity (:where), so Tailwind's .hidden always wins over the centering rule.
    expect(css).toMatch(/:where\(\.tab-row, \[role="tablist"\], nav\[class\*="flex"\]\) \{/);
    expect(css).not.toMatch(/^nav\[class\*="flex"\]( |,)/m);
  });
  it('the section list is rendered only when it is to be seen, not hidden by a class', () => {
    expect(settings).toMatch(/\{\(wide \|\| activeTab === 'home'\) && \(\s*<nav aria-label="Settings sections"/);
    expect(settings).not.toMatch(/\? 'flex' : 'hidden'\} flex-col overflow-y-auto/);
  });
  it('the panel is on screen from its first frame, never waiting for a slide-in to finish', () => {
    const root = settings.slice(settings.indexOf('<motion.div\n      initial={false}'), settings.indexOf('ref={rootRef}'));
    expect(root).toMatch(/initial=\{false\}/);
    expect(root).not.toMatch(/x: '100%'/);
  });
  it('opening a section focuses its heading, and Escape returns to the list on one pane', () => {
    expect(settings).toMatch(/sectionTitleRef\.current\?\.focus\(\{ preventScroll: true \}\)/);
    expect(settings).toMatch(/e\.key === 'Escape'\) setActiveTab\('home'\)/);
  });
  it('the WebKit and Chromium test exists and covers desktop, iPhone 15 and iPad Pro 11', () => {
    const t = readFileSync('scripts/ui/settings-webkit.mjs', 'utf8');
    expect(t).toMatch(/devices\['iPhone 15'\]/);
    expect(t).toMatch(/devices\['iPad Pro 11'\]/);
    expect(t).toMatch(/\['webkit', webkit\], \['chromium', chromium\]/);
  });
});
