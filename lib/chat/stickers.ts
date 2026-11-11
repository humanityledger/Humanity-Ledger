/**
 * lib/chat/stickers.ts — Ledger Chat's own sticker pack ("Ledger"), drawn for the app
 * (public/stickers/ledger/*.svg, black and white with one accent, die-cut white border).
 *
 * A sticker travels as the message text `__STICKER__img:<pack>/<id>`; the receiver renders the
 * picture from this site only, so a message can never make the client load an arbitrary URL.
 */
export interface Sticker { id: string; label: string }

export const LEDGER_STICKERS: Sticker[] = [
  { id: 'hi', label: 'Hi' }, { id: 'gm', label: 'Good morning' }, { id: 'love', label: 'Love it' },
  { id: 'lol', label: 'LOL' }, { id: 'thanks', label: 'Thank you' }, { id: 'paid', label: 'Paid' },
  { id: 'private', label: 'Private' }, { id: 'ok', label: 'OK' }, { id: 'hmm', label: 'Hmm' },
  { id: 'wow', label: 'Wow' }, { id: 'sad', label: 'Oh no' }, { id: 'gn', label: 'Good night' },
];

const PACKS: Record<string, Sticker[]> = { ledger: LEDGER_STICKERS };

export const stickerMessage = (pack: string, id: string) => `__STICKER__img:${pack}/${id}`;

/** The image path for a sticker message, or null when it is not one of ours. */
export function stickerSrc(content: string): string | null {
  const m = /^__STICKER__img:([a-z0-9-]{1,32})\/([a-z0-9-]{1,32})$/.exec(content.trim());
  if (!m || !PACKS[m[1]]?.some(s => s.id === m[2])) return null;
  return `/stickers/${m[1]}/${m[2]}.svg`;
}

export function stickerLabel(content: string): string | null {
  const m = /^__STICKER__img:([a-z0-9-]{1,32})\/([a-z0-9-]{1,32})$/.exec(content.trim());
  return m ? PACKS[m[1]]?.find(s => s.id === m[2])?.label ?? null : null;
}
