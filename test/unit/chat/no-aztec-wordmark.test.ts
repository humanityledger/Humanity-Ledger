import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';

describe('/chat has no Aztec wordmark above the card', () => {
  it('the link and the image are gone, and the frame fills the window', () => {
    const page = readFileSync('components/chat/surface/ChatSurface.tsx', 'utf8');
    expect(page).not.toMatch(/aztec-wordmark/);
    expect(page).not.toMatch(/href="https:\/\/aztec\.network"/);
    // 21 November 2026: a full-bleed workspace, no margin around a card.
    expect(page).toContain('data-chat-page="true"');
    expect(page).not.toMatch(/md:\[padding:clamp/);
  });
});
