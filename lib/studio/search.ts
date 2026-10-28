/**
 * Search across everything Studio keeps on the device: conversations
 * (titles and messages), projects and artifacts. Accent- and case-insensitive.
 */

import type { Artifact } from './artifacts';
import { latestContent } from './artifacts';
import type { Conversation, Project } from './store';

export interface SearchHit {
  kind: 'conversation' | 'project' | 'artifact';
  id: string;
  /** For artifacts: the conversation they belong to. */
  conversationId?: string;
  title: string;
  snippet: string;
  score: number;
  updatedAt: number;
}

export function fold(s: string): string {
  return s.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();
}

function snippetAround(text: string, q: string, radius = 60): string {
  const i = fold(text).indexOf(q);
  if (i < 0) return text.slice(0, radius * 2).replace(/\s+/g, ' ').trim();
  const start = Math.max(0, i - radius);
  const end = Math.min(text.length, i + q.length + radius);
  return `${start > 0 ? '…' : ''}${text.slice(start, end).replace(/\s+/g, ' ').trim()}${end < text.length ? '…' : ''}`;
}

export function searchStudio(query: string, data: { conversations: Conversation[]; projects: Project[]; artifacts: Artifact[] }, limit = 30): SearchHit[] {
  const q = fold(query.trim());
  if (q.length < 2) return [];
  const hits: SearchHit[] = [];

  for (const c of data.conversations) {
    const inTitle = fold(c.title).includes(q);
    const msg = c.messages.find(m => fold(m.text).includes(q));
    if (inTitle || msg) {
      hits.push({
        kind: 'conversation', id: c.id, title: c.title,
        snippet: msg ? snippetAround(msg.text, q) : snippetAround(c.messages[0]?.text ?? '', q),
        score: (inTitle ? 3 : 0) + (msg ? 1 : 0), updatedAt: c.updatedAt,
      });
    }
  }
  for (const p of data.projects) {
    const hay = `${p.name}\n${p.description}\n${p.instructions}`;
    if (fold(hay).includes(q)) hits.push({ kind: 'project', id: p.id, title: p.name, snippet: snippetAround(hay, q), score: fold(p.name).includes(q) ? 3 : 1, updatedAt: p.updatedAt });
  }
  for (const a of data.artifacts) {
    const content = latestContent(a);
    const inTitle = fold(a.title).includes(q) || a.id.includes(q);
    const inBody = fold(content).includes(q);
    if (inTitle || inBody) hits.push({ kind: 'artifact', id: a.id, conversationId: a.conversationId, title: a.title, snippet: snippetAround(content, q), score: (inTitle ? 2 : 0) + (inBody ? 1 : 0), updatedAt: a.updatedAt });
  }
  return hits.sort((x, y) => y.score - x.score || y.updatedAt - x.updatedAt).slice(0, limit);
}
