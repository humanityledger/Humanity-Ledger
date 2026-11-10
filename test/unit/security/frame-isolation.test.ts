/**
 * 4.11: a community app is hostile code. Its isolation rests on two things
 * that the existing P6 suite did not pin: the CSP `sandbox` directive (which
 * keeps the origin opaque even when the frame URL is opened as a top-level
 * tab, where the iframe attribute does not apply), and never granting
 * allow-same-origin (which with allow-scripts lets a frame remove its own
 * sandbox and reach localStorage, OPFS with the PXE store, and XMTP data).
 */
import { describe, it, expect } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';
import { APP_FRAME_CSP, APP_FRAME_SANDBOX, isAppFramePath } from '@/lib/community-apps/framePolicy';

const root = path.resolve(__dirname, '../../..');
const read = (p: string) => fs.readFileSync(path.join(root, p), 'utf8');
const directives = APP_FRAME_CSP.split(';').map((d) => d.trim());

describe('community app frame isolation', () => {
  it('the CSP itself sandboxes the document with scripts only', () => {
    expect(directives).toContain('sandbox allow-scripts');
    expect(directives.filter((d) => d.startsWith('sandbox'))).toEqual(['sandbox allow-scripts']);
  });

  it('never grants same-origin, top navigation, popups, forms or modals', () => {
    for (const flag of ['allow-same-origin', 'allow-top-navigation', 'allow-popups', 'allow-forms', 'allow-modals', 'allow-storage-access']) {
      expect(APP_FRAME_CSP).not.toContain(flag);
      expect(APP_FRAME_SANDBOX).not.toContain(flag);
    }
  });

  it('the iframe uses the shared sandbox constant, with no permissions and no referrer', () => {
    const src = read('components/chat/community-apps/AppFrame.tsx');
    expect(src).toMatch(/sandbox=\{APP_FRAME_SANDBOX\}/);
    expect(src).toMatch(/allow=""/);
    expect(src).toMatch(/referrerPolicy="no-referrer"/);
    expect(src).not.toMatch(/allow-same-origin/);
    // Bridge messages are trusted only from this iframe's own window.
    expect(src).toMatch(/event\.source !== frameRef\.current\.contentWindow/);
  });

  it('the frame route and the middleware both send the frame CSP for the frame path only', () => {
    expect(read('app/api/chat/communities/[id]/apps/[appId]/frame/route.ts')).toMatch(/'Content-Security-Policy': APP_FRAME_CSP/);
    expect(read('middleware.ts')).toMatch(/isAppFramePath\(pathname\)[\s\S]{0,120}Content-Security-Policy', APP_FRAME_CSP/);
    expect(isAppFramePath('/api/chat/communities/c1/apps/a1/frame')).toBe(true);
    expect(isAppFramePath('/api/chat/communities/c1/apps/a1/state')).toBe(false);
    expect(isAppFramePath('/chat')).toBe(false);
  });
});
