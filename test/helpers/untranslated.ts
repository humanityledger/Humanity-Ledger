/**
 * Source as it read before lib/i18n wrapped user-facing text in t(): `title={tr("Devices")}` reads
 * `title="Devices"`, `{t("Retry")}` reads `Retry`, `tr("Chats")` reads `'Chats'`, and
 * `t("Hi {name}", { name })` reads `'Hi {name}', { name })`. Tests that check a screen says a given
 * sentence read the source through this, so they keep checking the English text (the source of
 * every translation) instead of the call around it. Only for matching; the result is not code.
 */
const FN = '(?:tr|t|__t)';
const STR = '"((?:[^"\\\\]|\\\\.)*)"';
const unescape = (s: string) => s.replace(/\\(["\\])/g, '$1');
export function untranslated(src: string): string {
  return src
    .replace(new RegExp(`=\\{${FN}\\(${STR}\\)\\}`, 'g'), (_, s) => `="${unescape(s)}"`)
    .replace(new RegExp(`\\{${FN}\\(${STR}\\)\\}`, 'g'), (_, s) => unescape(s))
    .replace(new RegExp(`\\b${FN}\\(${STR}\\)`, 'g'), (_, s) => `'${unescape(s)}'`)
    .replace(new RegExp(`\\b${FN}\\(${STR},`, 'g'), (_, s) => `'${unescape(s)}',`);
}
