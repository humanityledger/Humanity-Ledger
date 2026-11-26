import { describe, it, expect } from 'vitest';
import { readFileSync } from 'fs';
import path from 'path';

const root = path.resolve(__dirname, '../../..');
const read = (p: string) => readFileSync(path.join(root, p), 'utf8');
const ui = ['components/g8/HumanVerificationCenter.tsx', 'components/g8/RequestBanner.tsx', 'components/connect/ConnectView.tsx', 'components/connect/HumanGateCard.tsx'];
const keys = (s: string) => [...s.matchAll(/\bt\(\s*'((?:[^'\\]|\\.)*)'|\bt\(\s*"((?:[^"\\]|\\.)*)"/g)].map(m => (m[1] ?? m[2]).replace(/\\(['"])/g, "$1"));

describe('G8 UI', () => {
  it('every visible G8 string is translated in es, de, ru and zh', () => {
    const all = ui.flatMap(f => keys(read(f)));
    for (const l of ['es', 'de', 'ru', 'zh']) {
      const d = JSON.parse(read(`lib/i18n/messages/${l}.json`));
      const missing = all.filter(k => !(k in d));
      expect(missing).toEqual([]);
      for (const k of all) if (/\{(\w+)\}/.test(k)) expect(d[k]).toMatch(new RegExp(k.match(/\{(\w+)\}/)![0].replace(/[{}]/g, '\\$&')));
    }
  });
  it('Level 2 is shown as not available, never as reached', () => {
    const c = read('components/g8/HumanVerificationCenter.tsx');
    expect(c).toMatch(/<Step n=\{2\} active=\{false\} done=\{false\} soon/);
    expect(c).not.toMatch(/G8Level\.UniqueHuman : /);
  });
  it('settings privacy tab hosts the center; chat shows the request banner', () => {
    expect(read('components/chat/LedgerSettingsFull.tsx')).toMatch(/<HumanVerificationCenter[\s\S]*g8_privacy_shield/);
    expect(read('components/terminal/LedgerChatV2.tsx')).toMatch(/<RequestBanner owner=/);
    expect(read('components/landing/ConnectPage.tsx')).toMatch(/rememberInviteFromUrl/);
  });
});
