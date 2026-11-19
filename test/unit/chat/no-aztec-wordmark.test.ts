import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';

describe('/chat has no Aztec wordmark above the card', () => {
  it('the link and the image are gone, the card container is unchanged', () => {
    const page = readFileSync('components/chat/surface/ChatSurface.tsx', 'utf8');
    expect(page).not.toMatch(/aztec-wordmark/);
    expect(page).not.toMatch(/href="https:\/\/aztec\.network"/);
    // The margin is symmetrical and follows the window, so zoom keeps the card whole (18 November 2026).
    expect(page).toMatch(/md:\[padding:clamp\(12px,3vh,56px\)_clamp\(16px,3\.2vw,72px\)\]/);
  });
});
