import 'server-only';
/**
 * lib/docs/i18n-server.ts — the documentation dictionary for the reader's language, on the server.
 * Each language is a separate JSON chunk loaded only when a page is rendered in it (lib/docs/i18n.ts).
 */
import { getServerLocale } from '@/lib/i18n/server';
import type { Locale } from '@/lib/i18n/locales';
import { translatorFrom, type Tr } from './i18n';

const LOADERS: Record<Exclude<Locale, 'en'>, () => Promise<{ default: Record<string, string> }>> = {
  es: () => import('@/lib/i18n/docs/es.json') as Promise<any>,
  ru: () => import('@/lib/i18n/docs/ru.json') as Promise<any>,
  de: () => import('@/lib/i18n/docs/de.json') as Promise<any>,
  zh: () => import('@/lib/i18n/docs/zh.json') as Promise<any>,
};

const cache = new Map<Locale, Tr>();

/** null for English: pages render as written. */
export async function docsTranslator(): Promise<Tr | null> {
  const locale = await getServerLocale();
  if (locale === 'en') return null;
  const hit = cache.get(locale);
  if (hit) return hit;
  const dict = (await LOADERS[locale]()).default;
  const tr = translatorFrom(dict);
  cache.set(locale, tr);
  return tr;
}
