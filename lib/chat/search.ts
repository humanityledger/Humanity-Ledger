// lib/chat/search.ts
export function searchLocalIndex(query: string, messages: Array<{ id: string; content: string }>) {
  const q = query.toLowerCase().trim();
  if (!q) return [];
  return messages.filter(m => m.content && m.content.toLowerCase().includes(q));
}
