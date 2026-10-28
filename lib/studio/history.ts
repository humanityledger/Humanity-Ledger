/**
 * Conversation history helpers (pure, shared by the UI and tests).
 */

export type ApiMessage = { role: 'user' | 'assistant'; content: any };

const IMAGE_TYPES = new Set(['image/png', 'image/jpeg', 'image/gif', 'image/webp']);
const TEXT_EXT = /\.(txt|md|markdown|csv|tsv|json|jsonl|ya?ml|toml|ini|env\.example|xml|html?|css|scss|js|jsx|ts|tsx|mjs|cjs|py|rb|go|rs|java|kt|swift|c|h|cpp|hpp|cs|php|sol|nr|vy|move|sql|sh|bash|zsh|ps1|dockerfile|tf|graphql|proto|lock|log)$/i;

export const MAX_IMAGE_BYTES = 5 * 1024 * 1024; // API limit per image
export const MAX_TEXT_CHARS = 400_000;

export type AttachmentKind = 'image' | 'pdf' | 'text' | 'unsupported';

export function attachmentKind(name: string, mime: string): AttachmentKind {
  if (IMAGE_TYPES.has(mime)) return 'image';
  if (mime === 'application/pdf' || /\.pdf$/i.test(name)) return 'pdf';
  if (mime.startsWith('text/') || mime === 'application/json' || mime === 'application/xml' || TEXT_EXT.test(name) || /^(dockerfile|makefile|readme|license)$/i.test(name)) return 'text';
  return 'unsupported';
}

/** Content block for one attachment. `data` is base64 for image/pdf, text otherwise. */
export function attachmentBlock(kind: Exclude<AttachmentKind, 'unsupported'>, name: string, mime: string, data: string): any {
  if (kind === 'image') return { type: 'image', source: { type: 'base64', media_type: mime, data } };
  if (kind === 'pdf') return { type: 'document', source: { type: 'base64', media_type: 'application/pdf', data }, title: name.slice(0, 200) };
  const text = data.length > MAX_TEXT_CHARS ? data.slice(0, MAX_TEXT_CHARS) + '\n[...truncated]' : data;
  return { type: 'text', text: `<file name="${name.replace(/"/g, "'")}">\n${text}\n</file>` };
}

/** Append a user turn, merging with a trailing user message (e.g. after a tool_result). */
export function appendUserTurn(history: ApiMessage[], content: any[]): ApiMessage[] {
  const last = history[history.length - 1];
  if (last && last.role === 'user') {
    const prev = typeof last.content === 'string' ? [{ type: 'text', text: last.content }] : last.content;
    return [...history.slice(0, -1), { role: 'user', content: [...prev, ...content] }];
  }
  return [...history, { role: 'user', content }];
}

/**
 * Keep requests small: images and PDFs are kept for the last `keepTurns`
 * user turns and replaced by a short note before that. Text stays.
 */
export function compactHistory(history: ApiMessage[], keepTurns = 3): ApiMessage[] {
  let userTurnsSeen = 0;
  const out: ApiMessage[] = [];
  for (let i = history.length - 1; i >= 0; i--) {
    const m = history[i];
    if (m.role === 'user' && Array.isArray(m.content) && m.content.some((b: any) => b?.type !== 'tool_result')) userTurnsSeen++;
    if (m.role === 'user' && userTurnsSeen > keepTurns && Array.isArray(m.content)) {
      out.unshift({
        role: 'user',
        content: m.content.map((b: any) =>
          b?.type === 'image' ? { type: 'text', text: '[An image was attached here earlier.]' }
          : b?.type === 'document' ? { type: 'text', text: `[A PDF${b.title ? ` "${b.title}"` : ''} was attached here earlier.]` }
          : b),
      });
    } else {
      out.unshift(m);
    }
  }
  return out;
}

/**
 * Keep at most `max` messages, dropping the oldest. The result must still
 * start with a real user message (not a tool_result whose tool_use was
 * dropped), or the API rejects it.
 */
export function trimHistory(history: ApiMessage[], max: number): ApiMessage[] {
  if (history.length <= max) return history;
  let start = history.length - max;
  const isFreshUserTurn = (m: ApiMessage) =>
    m.role === 'user' && (typeof m.content === 'string' || (Array.isArray(m.content) && m.content.some((b: any) => b?.type !== 'tool_result')));
  while (start < history.length - 1 && !isFreshUserTurn(history[start])) start++;
  const out = history.slice(start);
  const first = out[0];
  if (first && Array.isArray(first.content) && first.content.some((b: any) => b?.type === 'tool_result')) {
    out[0] = { ...first, content: first.content.filter((b: any) => b?.type !== 'tool_result') };
  }
  return out;
}

/**
 * After the API compacted a conversation it ignores everything before the
 * compaction block, so there is no need to keep sending it. The history must
 * still start with a user message, so a short placeholder takes its place.
 */
export function dropBeforeCompaction(history: ApiMessage[]): ApiMessage[] {
  for (let i = history.length - 1; i >= 0; i--) {
    const m = history[i];
    if (m.role !== 'assistant' || !Array.isArray(m.content)) continue;
    const j = m.content.map((b: any) => b?.type).lastIndexOf('compaction');
    if (j < 0) continue;
    if (i === 1 && j === 0 && typeof history[0].content === 'string' && history[0].content.startsWith('[Earlier conversation')) return history;
    return [
      { role: 'user', content: '[Earlier conversation, summarized below.]' },
      { role: 'assistant', content: m.content.slice(j) },
      ...history.slice(i + 1),
    ];
  }
  return history;
}

/** Tool calls in the last assistant message that have no result yet. */
export function unansweredToolUses(history: ApiMessage[]): string[] {
  const last = history[history.length - 1];
  if (!last || last.role !== 'assistant' || !Array.isArray(last.content)) return [];
  return last.content.filter((b: any) => b?.type === 'tool_use' && typeof b.id === 'string').map((b: any) => b.id);
}

/** Rough size check before sending (bytes of JSON). */
export function requestBytes(payload: unknown): number {
  try { return new TextEncoder().encode(JSON.stringify(payload)).length; } catch { return Infinity; }
}

/** Plain text of a user or assistant content array, for search and titles. */
export function plainText(content: any): string {
  if (typeof content === 'string') return content;
  if (!Array.isArray(content)) return '';
  return content.filter((b: any) => b?.type === 'text' && b.text).map((b: any) => b.text).join('\n').trim();
}
