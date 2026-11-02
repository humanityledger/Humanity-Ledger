/**
 * lib/community-apps/validate.ts
 *
 * Checks an app before it is stored. The sandbox (framePolicy.ts) is the real
 * boundary; these checks catch what the sandbox cannot see as a problem:
 * an app that asks people for secrets, or one that tries to leave its frame.
 * They are pattern checks and can be evaded by a determined author, which is
 * why the interface also names the author of every app and lets admins
 * remove it.
 */

export const MAX_APP_BYTES = 200_000;

interface Rule {
  test: RegExp;
  reason: string;
}

const RULES: Rule[] = [
  {
    test: /seed\s*phrase|recovery\s*phrase|secret\s*recovery|mnemonic|private\s*key|frase\s*(semilla|de\s*recuperaci[oó]n)|clave\s*privada|palabras\s*de\s*recuperaci[oó]n/i,
    reason: 'Apps cannot ask for recovery phrases or private keys.',
  },
  {
    test: /type\s*=\s*["']?password/i,
    reason: 'Apps cannot ask for passwords.',
  },
  {
    test: /\b(location\s*(\.\s*(href|assign|replace)|\s*=)|window\s*\.\s*open|top\s*\.\s*location|parent\s*\.\s*location|document\s*\.\s*location)/i,
    reason: 'Apps cannot navigate away from their frame or open windows.',
  },
  {
    test: /<\s*(iframe|frame|object|embed|base|form)\b/i,
    reason: 'Apps cannot embed other pages or submit forms.',
  },
  {
    test: /<\s*(script|link|img|audio|video|source)[^>]+(src|href)\s*=\s*["']?\s*(https?:)?\/\//i,
    reason: 'Apps cannot load files from the internet.',
  },
  {
    test: /\b(fetch\s*\(|XMLHttpRequest|WebSocket|EventSource|navigator\s*\.\s*sendBeacon|importScripts)/,
    reason: 'Apps have no network access.',
  },
  {
    test: /\b(localStorage|sessionStorage|indexedDB|document\s*\.\s*cookie)\b/,
    reason: 'Apps keep their data with hl.set and hl.setMine.',
  },
];

export interface ValidationResult {
  ok: boolean;
  problems: string[];
}

export function validateAppHtml(html: string): ValidationResult {
  const problems: string[] = [];
  if (!html || !html.trim()) problems.push('The app is empty.');
  if (Buffer.byteLength(html, 'utf8') > MAX_APP_BYTES) {
    problems.push(`The app is larger than ${Math.round(MAX_APP_BYTES / 1000)} KB.`);
  }
  for (const rule of RULES) {
    if (rule.test.test(html)) problems.push(rule.reason);
  }
  return { ok: problems.length === 0, problems };
}
