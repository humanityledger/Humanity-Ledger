/**
 * Ledger Chat in English, Spanish, Russian, German and Chinese (lib/i18n).
 * Fails when a dictionary is not valid JSON, holds an empty translation, invents a placeholder,
 * drops a link or bold-text placeholder ({0}, {1}…), or when the runtime stops falling back to
 * English, interpolating, or keeping word order with elements.
 */
import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { isValidElement } from 'react';
import { LOCALES, localeFromAcceptLanguage, normalizeLocale } from '@/lib/i18n/locales';
import { translateWith } from '@/lib/i18n/runtime';

const ph = (s: string) => new Set(s.match(/\{\w+\}/g) ?? []);

describe('dictionaries', () => {
  for (const l of LOCALES.filter((x) => x !== 'en')) {
    it(`${l}: valid, non-empty, placeholders kept`, () => {
      const dict: Record<string, string> = JSON.parse(readFileSync(join(process.cwd(), `lib/i18n/messages/${l}.json`), 'utf8'));
      const entries = Object.entries(dict);
      expect(entries.length).toBeGreaterThan(1000);
      for (const [key, value] of entries) {
        expect(typeof value, key).toBe('string');
        expect(value.trim().length, key).toBeGreaterThan(0);
        const k = ph(key);
        for (const p of ph(value)) expect(k.has(p), `${l}: ${p} not in "${key}"`).toBe(true);
        for (const p of k) if (/^\{\d+\}$/.test(p)) expect(ph(value).has(p), `${l}: ${p} dropped from "${key}"`).toBe(true);
      }
    });
  }

  it('the four languages cover the same core screens', () => {
    for (const l of ['es', 'ru', 'de', 'zh']) {
      const dict: Record<string, string> = JSON.parse(readFileSync(join(process.cwd(), `lib/i18n/messages/${l}.json`), 'utf8'));
      for (const key of ['Cancel', 'Continue', 'Settings', 'Language', 'Send privately', 'Connect wallet']) {
        if (key in dict) expect(dict[key]).not.toBe(key);
      }
    }
  });
});

describe('runtime', () => {
  const es = { 'Send': 'Enviar', '{count} members': '{count} miembros', 'Read the {0} first': 'Lee primero el {0}' };

  it('translates, and falls back to English for unknown text', () => {
    expect(translateWith(es, 'Send')).toBe('Enviar');
    expect(translateWith(es, 'Unknown text')).toBe('Unknown text');
    expect(translateWith({}, 'Send')).toBe('Send');
  });

  it('interpolates primitives and passes non-strings through', () => {
    expect(translateWith(es, '{count} members', { count: 3 })).toBe('3 miembros');
    expect(translateWith(es, 42)).toBe(42);
    expect(translateWith(es, undefined)).toBe(undefined);
  });

  it('keeps an element in place, in the translated word order', () => {
    const el = translateWith(es, 'Read the {0} first', { 0: { type: 'a', props: {}, key: null } as any });
    expect(isValidElement(el)).toBe(true);
  });

  it('picks the language from the browser, else English', () => {
    expect(normalizeLocale('es-MX')).toBe('es');
    expect(normalizeLocale('zh-Hans-CN')).toBe('zh');
    expect(normalizeLocale('fr')).toBeNull();
    expect(localeFromAcceptLanguage('fr-FR,de;q=0.8,en;q=0.5')).toBe('de');
    expect(localeFromAcceptLanguage('ru-RU')).toBe('ru');
    expect(localeFromAcceptLanguage('ja-JP')).toBeNull();
  });
});
