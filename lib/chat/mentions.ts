// lib/chat/mentions.ts
export function extractMentions(text: string): string[] {
  const matches = text.match(/@([a-zA-Z0-9._-]+)/g) || [];
  return matches.map(m => m.slice(1));
}
