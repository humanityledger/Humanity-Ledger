import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';

describe('/chat has no Aztec wordmark above the card', () => {
  it('the link and the image are gone, the card container is unchanged', () => {
    const page = readFileSync('app/chat/page.tsx', 'utf8');
    expect(page).not.toMatch(/aztec-wordmark/);
    expect(page).not.toMatch(/href="https:\/\/aztec\.network"/);
    expect(page).toMatch(/md:p-\[50px\] lg:p-\[75px\] xl:p-\[95px\] 2xl:p-\[120px\]/);
  });
});
