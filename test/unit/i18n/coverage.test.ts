/**
 * 25 November 2026: choosing Español, Русский, Deutsch or 中文 left about 1,650 texts per language
 * in English, so Ledger Chat came out half translated. Every text written as t("…") or t('…') in
 * app/, components/, lib/ and hooks/ now has an entry in each dictionary.
 *
 * This fails when a new t("…") text is added without its Spanish, Russian, German and Chinese
 * entries, or when a source text is written in a language other than English (the dictionaries
 * map English to the other languages, so a Spanish source text would stay Spanish in English).
 */
import { describe, expect, it } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';

const ROOTS = ['app', 'components', 'lib', 'hooks'];
const KEY = /\b(?:t|tr|__t)\(\s*("(?:[^"\\\n]|\\.)*"|'(?:[^'\\\n]|\\.)*')/g;

function files(dir: string, out: string[] = []): string[] {
  for (const d of fs.readdirSync(dir, { withFileTypes: true })) {
    const p = path.join(dir, d.name);
    if (d.isDirectory()) {
      if (p.includes(path.join('i18n', 'messages')) || d.name === 'node_modules') continue;
      files(p, out);
    } else if (/\.(tsx|ts)$/.test(d.name) && !d.name.endsWith('.d.ts')) out.push(p);
  }
  return out;
}

function unquote(lit: string): string {
  if (lit.startsWith('"')) return JSON.parse(lit);
  return JSON.parse('"' + lit.slice(1, -1).replace(/\\'/g, "'").replace(/"/g, '\\"') + '"');
}

/** Terminal settings labels are constants that resolve to English in hooks/useSystemTranslation.ts. */
function systemLabels(): Map<string, string> {
  const src = fs.readFileSync('hooks/useSystemTranslation.ts', 'utf8');
  return new Map([...src.matchAll(/'([A-Z0-9_]+)':\s*'([^']*)'/g)].map((m) => [m[1], m[2]]));
}

function sourceTexts(): Map<string, string> {
  const sys = systemLabels();
  const keys = new Map<string, string>();
  for (const root of ROOTS) {
    for (const f of files(root)) {
      const src = fs.readFileSync(f, 'utf8');
      for (const m of src.matchAll(KEY)) {
        let k: string;
        try {
          k = unquote(m[1]);
        } catch {
          continue;
        }
        if (!/[A-Za-z]/.test(k)) continue;
        if (f.endsWith('TerminalSettingsPanel.tsx') && sys.has(k)) k = sys.get(k)!;
        if (!keys.has(k)) keys.set(k, f);
      }
    }
  }
  for (const v of sys.values()) if (!keys.has(v)) keys.set(v, 'hooks/useSystemTranslation.ts');
  return keys;
}

describe('every text has a translation', () => {
  const keys = sourceTexts();

  it('finds the texts', () => {
    expect(keys.size).toBeGreaterThan(3000);
  });

  for (const l of ['es', 'ru', 'de', 'zh']) {
    it(`${l}: no t("…") text is missing`, () => {
      const dict: Record<string, string> = JSON.parse(fs.readFileSync(`lib/i18n/messages/${l}.json`, 'utf8'));
      const missing = [...keys].filter(([k]) => !(k in dict)).map(([k, f]) => `${f}: ${k}`);
      expect(missing, missing.slice(0, 20).join('\n')).toEqual([]);
    });
  }

  it('source texts are English', () => {
    // Words that only appear in Spanish sentences; a source text with one of them was written in Spanish.
    const spanish = /\b(Señaliz\w*|Configuración|Obligatorio|Cargando|Monitoreo|Desplegado|Época|Lotes?|Bloque|Transacciones|Promedio|Restricciones|Amortizad\w*|Ver Noticia|Ver Propuesta|Guía Oficial|Copiad[oa]|Copiar|Tx Privadas)\b/;
    const bad = [...keys].filter(([k]) => spanish.test(k)).map(([k, f]) => `${f}: ${k}`);
    expect(bad, bad.join('\n')).toEqual([]);
  });
});
