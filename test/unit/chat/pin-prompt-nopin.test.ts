import { describe, it, expect, vi, afterEach } from 'vitest';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { PinPrompt } from '@/components/chat/pin/PinPrompt';

/**
 * The repo has no DOM test environment (vitest runs in node and there is no
 * testing-library), so this suite renders PinPrompt on the server and also
 * checks the component source. It guards the rule that a missing PIN never
 * offers a way past the lock.
 */

const SOURCE = readFileSync(
  path.resolve(__dirname, '../../../components/chat/pin/PinPrompt.tsx'),
  'utf8',
);

afterEach(() => {
  vi.unstubAllGlobals();
});

describe('PinPrompt without a PIN', () => {
  it('never renders a "Continue without a PIN" bypass', () => {
    const fetchMock = vi.fn(async () =>
      new Response(JSON.stringify({ needsPinSetup: true }), { status: 404 }),
    );
    vi.stubGlobal('fetch', fetchMock);

    const html = renderToStaticMarkup(
      React.createElement(PinPrompt, { onUnlock: () => {}, onCreatePin: () => {} }),
    );

    expect(html).not.toContain('Continue without a PIN');
  });

  it('does not contain the bypass text or an onUnlock wired to the nopin phase', () => {
    expect(SOURCE).not.toContain('Continue without a PIN');
    expect(SOURCE).not.toMatch(/phase === 'nopin'[^]*?onClick=\{onUnlock\}/);
  });

  it('shows the create-PIN message and exposes the optional setup props', () => {
    expect(SOURCE).toContain('No PIN is set for this account. Create one to continue.');
    expect(SOURCE).toContain('onNeedsSetup?: () => void;');
    expect(SOURCE).toContain('onCreatePin?: () => void;');
  });
});
