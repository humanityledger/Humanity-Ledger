/**
 * Community apps V2 (27 Nov 2026): wallet-extension noise never reaches the creator as an app error,
 * the generation prompt is three blocks that fit Groq's free tier, the seven templates pass the
 * same checks as generated apps, edited code is validated on the server, and the frame sandbox is
 * exactly what it was.
 */
import { describe, it, expect } from 'vitest';
import fs from 'node:fs';
import { APP_SDK_JS, APP_BASE_CSS, APP_PREVIEW_SHELL, isExtensionNoiseMessage, buildAppDocument } from '@/lib/community-apps/sdk';
import { SYSTEM_BLOCKS, compactSource } from '@/lib/community-apps/generate';
import { APP_TEMPLATES } from '@/lib/community-apps/templates';
import { validateAppHtml, MAX_APP_BYTES } from '@/lib/community-apps/validate';
import { APP_FRAME_CSP, APP_FRAME_SANDBOX } from '@/lib/community-apps/framePolicy';
import { fitSystem, estimateTokens, DEFAULT_TPM_LIMIT } from '@/lib/studio/groq';

const read = (p: string) => fs.readFileSync(p, 'utf8');

describe('MetaMask and other wallet extensions inside the sandbox', () => {
  it('the frame filters extension noise before reporting, and keeps window.ethereum absent', () => {
    expect(APP_SDK_JS).toMatch(/function isExtensionNoise\(/);
    expect(APP_SDK_JS).toMatch(/addEventListener\('error', function \(e\) \{\s*if \(isExtensionNoise\(/);
    expect(APP_SDK_JS).toMatch(/addEventListener\('unhandledrejection', function \(e\) \{\s*if \(isExtensionNoise\(/);
    expect(APP_SDK_JS).toMatch(/getOwnPropertyDescriptor\(window, 'ethereum'\)/);
    expect(APP_SDK_JS).toMatch(/configurable: true/);
    expect(() => new Function(APP_SDK_JS)).not.toThrow();
  });
  it('the host ignores the same noise if an older app document still reports it', () => {
    expect(isExtensionNoiseMessage('Failed to connect to MetaMask')).toBe(true);
    expect(isExtensionNoiseMessage('x', 'at chrome-extension://nkbihfbeogaeaoehlefnkodbefgpgknn/inpage.js:1:1')).toBe(true);
    expect(isExtensionNoiseMessage('Cannot read properties of undefined (reading "map")')).toBe(false);
    expect(read('components/chat/community-apps/AppFrame.tsx')).toMatch(/if \(isExtensionNoiseMessage\(message/);
  });
  it('the SDK keeps every old call and adds patch, remove, pick and formatDate', () => {
    for (const k of ['get:', 'set:', 'list:', 'mine:', 'setMine:', 'everyone:', 'onChange:', 'uid:', 'esc:', 'patch:', 'remove:', 'pick:', 'formatDate:']) expect(APP_SDK_JS).toContain(k);
  });
  it('the base stylesheet uses the full width and the light institutional palette', () => {
    expect(APP_BASE_CSS).not.toMatch(/\.app\{[^}]*max-width:640px/);
    expect(APP_BASE_CSS).toMatch(/\.app\{width:100%;max-width:1040px/);
    for (const c of ['.app-header{', '.app-body{', '.grid-auto{', '.kpi{', '.tabs{', '.badge-ok{', '.search-row{', '.notice{']) expect(APP_BASE_CSS).toContain(c);
    expect(APP_BASE_CSS).toContain('--accent:#2754d6');
    expect(APP_BASE_CSS).not.toMatch(/prefers-color-scheme:\s*dark|#4f46e5|#6366f1|gradient/i);
  });
});

describe('generation fits the free tier', () => {
  it('the system prompt is three blocks: rules, design, reference', () => {
    expect(SYSTEM_BLOCKS).toHaveLength(3);
    expect(SYSTEM_BLOCKS[0].text).toMatch(/<title>[\s\S]*<summary>[\s\S]*<app>/);
    expect(SYSTEM_BLOCKS[0].text).toMatch(/NO network/);
    expect(SYSTEM_BLOCKS[1].text).toMatch(/app-header/);
    expect(SYSTEM_BLOCKS[2].text).toMatch(/Reference pattern/);
    const total = SYSTEM_BLOCKS.reduce((n, b) => n + estimateTokens(b.text), 0);
    expect(total).toBeLessThan(DEFAULT_TPM_LIMIT / 2);
  });
  it('when space is short, the rules are kept whole and the other blocks are shortened', () => {
    const { system, clipped } = fitSystem(SYSTEM_BLOCKS, 1200);
    expect(clipped).toBe(true);
    expect(system[0].text).toBe(SYSTEM_BLOCKS[0].text);
  });
  it('a revision sends the current app compacted', () => {
    expect(compactSource('  <div>\r\n\r\n\r\n\t\t<p>x</p>   \n</div>')).toBe('<div>\n\n<p>x</p>\n</div>');
    expect(read('lib/community-apps/generate.ts')).toMatch(/compactSource\(input\.current\.html\)/);
  });
});

describe('templates', () => {
  it('seven templates, every one passes the same checks as a generated app', () => {
    const ids = APP_TEMPLATES.map((t) => t.id);
    expect(ids).toEqual(['poll', 'signup', 'list', 'when', 'padel-league', 'expense-split', 'idea-board']);
    for (const t of APP_TEMPLATES) {
      expect(validateAppHtml(t.html).problems, t.id).toEqual([]);
      expect(t.html.includes('`') || t.html.includes('${') || t.html.includes('\\'), t.id).toBe(false);
      expect(t.title.es && t.title.en && t.summary.es && t.summary.en, t.id).toBeTruthy();
    }
  });
  it('the new templates use the full-screen layout and member keys where people must not overwrite each other', () => {
    for (const id of ['padel-league', 'expense-split', 'idea-board']) {
      const html = APP_TEMPLATES.find((t) => t.id === id)!.html;
      expect(html).toContain('app-header');
      expect(html).toContain('app-body');
      expect(html).not.toMatch(/onclick=|alert\(|confirm\(/);
    }
    expect(APP_TEMPLATES.find((t) => t.id === 'idea-board')!.html).toMatch(/hl\.setMine\('vote:'/);
    expect(APP_TEMPLATES.find((t) => t.id === 'expense-split')!.html).toMatch(/Payments happen in Ledger Chat, outside the app/);
  });
});

describe('editing code', () => {
  it('validation works in the browser too (no Buffer) and still bounds the size', () => {
    expect(read('lib/community-apps/validate.ts')).not.toMatch(/Buffer\./);
    expect(validateAppHtml('x'.repeat(MAX_APP_BYTES + 1)).ok).toBe(false);
    expect(validateAppHtml('<script>fetch("https://x")</script>').ok).toBe(false);
  });
  it('PATCH accepts { html } from the creator only, validates it and bumps the version', () => {
    const src = read('app/api/chat/communities/[id]/apps/[appId]/route.ts');
    expect(src).toMatch(/creatorAddress\.toLowerCase\(\) !== access\.caller/);
    expect(src).toMatch(/validateAppHtml\(html\)/);
    expect(src).toMatch(/version = \{ increment: 1 \}/);
  });
  it('the live preview runs in the same sandbox and the frame route serves its shell to the creator only', () => {
    const apps = read('components/chat/community-apps/CommunityApps.tsx');
    expect(apps).toMatch(/sandbox=\{APP_FRAME_SANDBOX\}/);
    expect(apps).not.toMatch(/allow-same-origin/);
    const frame = read('app/api/chat/communities/[id]/apps/[appId]/frame/route.ts');
    expect(frame).toMatch(/searchParams\.get\('preview'\) === '1'[\s\S]{0,200}!== access\.caller/);
    expect(APP_PREVIEW_SHELL).toMatch(/e\.source!==parent/);
    expect(buildAppDocument('<p>x</p>', 'T')).toContain(APP_SDK_JS);
  });
  it('the frame policy is exactly scripts-only', () => {
    expect(APP_FRAME_SANDBOX).toBe('allow-scripts');
    expect(APP_FRAME_CSP.split(';').map((d) => d.trim())).toContain('sandbox allow-scripts');
  });
});
