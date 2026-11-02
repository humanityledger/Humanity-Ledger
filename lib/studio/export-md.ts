/**
 * A conversation as a Markdown file the person can keep or share: what was
 * said, the files each turn changed and the sources it cited. API-only
 * blocks (tool calls, signatures) are left out.
 */

import type { Conversation, DisplayMessage } from './store';

const fence = (s: string) => {
  // A fence longer than any run of backticks inside the text.
  const longest = Math.max(2, ...Array.from(s.matchAll(/`+/g), m => m[0].length));
  return '`'.repeat(longest + 1);
};

function fileLines(m: DisplayMessage): string[] {
  const list = (m.fileChanges ?? []).filter(f => !f.parent);
  if (!list.length) return [];
  return [
    '',
    '**Files changed**',
    '',
    ...list.map(f => `- \`${f.path}\` (${f.op}${f.added || f.removed ? `, +${f.added} −${f.removed}` : ''})`),
  ];
}

function sourceLines(m: DisplayMessage): string[] {
  const list = (m.citations ?? []).filter(c => /^https:\/\//i.test(c.url));
  if (!list.length) return [];
  return ['', '**Sources**', '', ...list.map(c => `- [${(c.title || c.url).replace(/[[\]]/g, '')}](${c.url})`)];
}

export function conversationMarkdown(c: Conversation, labels: { you: string; studio: string } = { you: 'You', studio: 'Ledger Studio' }): string {
  const out: string[] = [`# ${c.title.replace(/\n/g, ' ')}`, ''];
  const date = new Date(c.createdAt);
  out.push(`_${date.toISOString().slice(0, 10)} · ${c.mode === 'code' ? 'Code' : 'Chat'} · ${c.model}_`, '');
  for (const m of c.messages) {
    if (m.role === 'user') {
      const text = m.text || (m.label ? `/${m.label}` : '');
      if (!text && !m.attachments?.length) continue;
      out.push(`## ${labels.you}`, '');
      if (text) out.push(text, '');
      for (const a of m.attachments ?? []) out.push(`- 📎 ${a.name}`);
      if (m.attachments?.length) out.push('');
    } else {
      out.push(`## ${labels.studio}`, '');
      if (m.text) out.push(m.text, '');
      out.push(...fileLines(m), ...sourceLines(m));
      if (m.error) {
        const msg = m.error.message;
        const f = fence(msg);
        out.push('', `${f}text`, msg, f);
      }
      out.push('');
    }
  }
  return `${out.join('\n').replace(/\n{3,}/g, '\n\n').trim()}\n`;
}

export function markdownFileName(title: string): string {
  return `${title.replace(/[^\p{L}\p{N}._-]+/gu, '-').replace(/^-+|-+$/g, '').slice(0, 60) || 'conversation'}.md`;
}
