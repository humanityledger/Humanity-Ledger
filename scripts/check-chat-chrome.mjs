#!/usr/bin/env node
/**
 * scripts/check-chat-chrome.mjs
 *
 * Guards the Ledger Chat and Studio interface against regressions the
 * 3 Nov 2026 redesign removed. Exits 1 on any finding.
 *
 *   1. Emoji in interface chrome (labels, buttons, menus, empty states).
 *      Emoji are fine as user content: reaction pickers, the status-emoji
 *      picker and quick-reaction lists are allow-listed by name below.
 *   2. Raw status lines such as "Request failed (500)" shown to users.
 *   3. New Tailwind `dark:` variants (themes are CSS variables, not dark:).
 *
 * Run: node scripts/check-chat-chrome.mjs
 */
import { readFileSync, readdirSync, statSync } from 'fs';
import { join, relative } from 'path';

const ROOT = process.cwd();
const SCOPE = [
  'components/chat',
  'components/studio',
  'components/terminal/LedgerChatV2.tsx',
  'components/terminal/LedgerChatSettings.tsx',
  'components/ui/DynamicIsland.tsx',
  'components/auth/TuringShieldGate.tsx',
];

// Pictographic emoji and the dingbat range. Arrows and math symbols are not
// emoji and are allowed (they are typography).
const EMOJI = /[\u{1F300}-\u{1FAFF}\u{2600}-\u{27BF}\u{2B1B}\u{2B1C}\u{2B50}\u{23F0}-\u{23FA}]/u;

/** Lines that may hold emoji because they are content, not chrome. */
const ALLOW = [
  // Reaction and emoji pickers: the emoji are the content being picked.
  /\b(TAPBACKS|EXTENDED_EMOJIS|QUICK_EMOJIS|STATUS_EMOJIS|REACTION_EMOJIS|EMOJI_LIST|EMOJIS|ALL_EMOJIS|REACTION_COLORS|stickers)\b/,
  /^\s*(['"][^'"]+['"]\s*:?\s*['"#0-9A-Za-z]*\s*,\s*)+$/, // continuation lines of those arrays/maps
  /onReact\(/,
  /setSelectedEmoji\(|useState\('.'\)|selectedEmoji/,
  /content\.replace\(\/\^/, // stripping a legacy prefix from stored content
];

function files(p) {
  const full = join(ROOT, p);
  let st;
  try { st = statSync(full); } catch { return []; }
  if (st.isFile()) return /\.(tsx?|jsx?)$/.test(p) ? [full] : [];
  return readdirSync(full, { withFileTypes: true }).flatMap(e =>
    e.name === 'node_modules' ? [] : files(join(p, e.name)));
}

const findings = [];
for (const file of SCOPE.flatMap(files)) {
  const rel = relative(ROOT, file);
  const lines = readFileSync(file, 'utf8').split('\n');
  lines.forEach((line, i) => {
    const t = line.trim();
    if (t.startsWith('//') || t.startsWith('*') || t.startsWith('/*') || t.startsWith('{/*')) return;
    if (EMOJI.test(line) && !ALLOW.some(r => r.test(line))) {
      findings.push(`${rel}:${i + 1}  emoji in interface text: ${t.slice(0, 120)}`);
    }
    if (/Request failed \(/.test(line)) {
      findings.push(`${rel}:${i + 1}  raw status line shown to users: ${t.slice(0, 120)}`);
    }
    if (/["'`\s]dark:[a-z]/.test(line)) {
      findings.push(`${rel}:${i + 1}  Tailwind dark: variant: ${t.slice(0, 120)}`);
    }
  });
}

if (findings.length) {
  console.error(`Chat chrome check: ${findings.length} finding(s)\n` + findings.map(f => '  ' + f).join('\n'));
  process.exit(1);
}
console.log('Chat chrome check: no emoji in chrome, no raw status lines, no dark: variants.');
