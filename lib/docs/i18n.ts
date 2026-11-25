/**
 * lib/docs/i18n.ts — the documentation in Spanish, Russian, German and Chinese.
 *
 * Pages are data (lib/docs/pages). Their text is looked up, string by string, in the
 * documentation dictionaries in lib/i18n/docs/<locale>.json (English text → translation), and
 * the translated page is rendered. These dictionaries are separate from the interface ones
 * (lib/i18n/messages) and are read only on the server, so the app does not download them.
 *
 * Not translated:
 *   - code blocks, Mermaid source, links' targets, image paths, names of people;
 *   - the legal pages (legal notice, terms, privacy, cookies, content policy, disclaimer):
 *     the English text is the binding one. They open with a translated note that says so.
 * Heading anchors keep their English ids, so links to a section work in every language.
 *
 * test/unit/i18n/docs-coverage.test.ts fails when a page has a text without an entry in each
 * dictionary, or when an entry loses a placeholder, inline code, a link target or markup.
 */
import type { Block, DocPage } from './types';
import { headingId } from './registry';
import { diagramTexts, parseDiagram } from './diagram';

export type Tr = (text: string) => string;

/** Binding legal texts: published in English only. */
export const ENGLISH_ONLY_SLUGS = new Set(['legal-notice', 'terms', 'privacy', 'cookies', 'content-policy', 'disclaimer']);

/** Pages translated for reading, where the English text still prevails. */
export const ENGLISH_PREVAILS_SLUGS = new Set(['community-guidelines']);

export const ENGLISH_ONLY_NOTE = 'This page is published in English only. The English text is the binding version.';
export const ENGLISH_PREVAILS_NOTE = 'This page is a translation for your convenience. If it differs from the English version, the English version applies.';
export const NOTE_TITLE = 'Language';

/** Texts that show the page title, summary and group, plus every visible text of the blocks. */
export function docTexts(page: DocPage, group?: string): string[] {
  const out: string[] = [page.label, page.summary];
  if (page.title) out.push(page.title);
  if (group) out.push(group);
  if (ENGLISH_ONLY_SLUGS.has(page.slug)) return out.filter(has);
  for (const b of page.blocks) out.push(...blockTexts(b));
  return out.filter(has);
}

function has(s: string | undefined): s is string {
  return typeof s === 'string' && /\p{L}/u.test(s);
}

export function blockTexts(b: Block): string[] {
  switch (b.t) {
    case 'p':
    case 'h2':
    case 'h3':
      return [b.text];
    case 'ul':
    case 'ol':
      return b.items;
    case 'steps':
      return b.items.flatMap((i) => [i.title, i.text]);
    case 'table':
      return [...b.head, ...b.rows.flat()];
    case 'hint':
      return [b.title ?? '', b.text];
    case 'code':
      return [b.label ?? ''];
    case 'defs':
      return b.items.flatMap((i) => [i.term, i.text]);
    case 'cards':
      return b.items.flatMap((i) => [i.title, i.text]);
    case 'status':
      return b.items.flatMap((i) => [i.label, i.text]);
    case 'figure':
      return [b.caption];
    case 'diagram':
      return [b.caption, b.title ?? '', ...diagramTexts(parseDiagram(b.code))];
    case 'person':
      return [b.role, ...b.links.map((l) => l.label)];
    case 'gallery':
      return b.items.flatMap((i) => [i.alt, i.caption]);
    default:
      return [];
  }
}

function translateBlock(b: Block, tr: Tr): Block {
  const m = (xs: string[]) => xs.map(tr);
  switch (b.t) {
    case 'p':
      return { ...b, text: tr(b.text) };
    case 'h2':
    case 'h3':
      // The anchor stays the English one, so /docs/page#section links work in every language.
      return { ...b, id: headingId(b.text, b.id), text: tr(b.text) };
    case 'ul':
    case 'ol':
      return { ...b, items: m(b.items) };
    case 'steps':
      return { ...b, items: b.items.map((i) => ({ title: tr(i.title), text: tr(i.text) })) };
    case 'table':
      return { ...b, head: m(b.head), rows: b.rows.map(m) };
    case 'hint':
      return { ...b, title: b.title ? tr(b.title) : b.title, text: tr(b.text) };
    case 'code':
      return { ...b, label: b.label ? tr(b.label) : b.label };
    case 'defs':
      return { ...b, items: b.items.map((i) => ({ term: tr(i.term), text: tr(i.text) })) };
    case 'cards':
      return { ...b, items: b.items.map((i) => ({ ...i, title: tr(i.title), text: tr(i.text) })) };
    case 'status':
      return { ...b, items: b.items.map((i) => ({ ...i, label: tr(i.label), text: tr(i.text) })) };
    case 'figure':
      return { ...b, caption: tr(b.caption) };
    case 'diagram':
      // The Mermaid source stays as written (it is offered for copying); the drawing is translated.
      return { ...b, caption: tr(b.caption), title: b.title ? tr(b.title) : b.title };
    case 'person':
      return { ...b, role: tr(b.role), links: b.links.map((l) => ({ ...l, label: tr(l.label) })) };
    case 'gallery':
      return { ...b, items: b.items.map((i) => ({ ...i, alt: tr(i.alt), caption: tr(i.caption) })) };
    default:
      return b;
  }
}

/** The page as a reader in this language sees it. English (`tr` absent) returns it unchanged. */
export function translatePage(page: DocPage, tr: Tr | null): DocPage {
  if (!tr) return page;
  const head = { ...page, label: tr(page.label), title: page.title ? tr(page.title) : page.title, summary: tr(page.summary) };
  if (ENGLISH_ONLY_SLUGS.has(page.slug)) {
    const note: Block = { t: 'hint', tone: 'info', title: tr(NOTE_TITLE), text: tr(ENGLISH_ONLY_NOTE) };
    return { ...head, blocks: [note, ...page.blocks] };
  }
  const blocks = page.blocks.map((b) => translateBlock(b, tr));
  if (ENGLISH_PREVAILS_SLUGS.has(page.slug)) {
    blocks.unshift({ t: 'hint', tone: 'info', title: tr(NOTE_TITLE), text: tr(ENGLISH_PREVAILS_NOTE) });
  }
  return { ...head, blocks };
}

/** Lookup in one dictionary; a text without an entry stays in English. */
export function translatorFrom(dict: Record<string, string>): Tr {
  return (text: string) => {
    if (!text) return text;
    const hit = dict[text];
    if (typeof hit === 'string' && hit.length) return hit;
    // Fragments keep their surrounding spaces in the source; the dictionary stores them trimmed.
    const trimmed = text.trim();
    if (trimmed !== text) {
      const inner = dict[trimmed];
      if (typeof inner === 'string' && inner.length) return text.replace(trimmed, inner);
    }
    return text;
  };
}
