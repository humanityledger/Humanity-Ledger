#!/usr/bin/env node
/**
 * scripts/check-staged-secrets.mjs
 *
 * Refuses a commit that adds a credential. Runs from .husky/pre-commit.
 *
 * Written on 3 Nov 2026 after an audit of the public history found a Railway
 * database password, a Resend key, several JWT secrets and API keys in files
 * that had been committed and later deleted. Deleting a file does not remove
 * it from history; the only safe secret is one that is never committed.
 *
 * Scans only the lines being added. Exits 1 with the file and line of each
 * finding (the value itself is masked). Bypass for a reviewed false
 * positive: put `secret-scan: allow` on the same line.
 */
import { execSync } from 'child_process';

const PATTERNS = [
  ['Anthropic key', /sk-ant-(api|admin)\d{2}-[A-Za-z0-9_-]{30,}/],
  ['OpenAI key', /\bsk-(proj-)?[A-Za-z0-9]{32,}/],
  ['Stripe live key', /\b(sk|rk)_live_[A-Za-z0-9]{16,}/],
  ['Stripe webhook secret', /\bwhsec_[A-Za-z0-9]{24,}/],
  ['AWS access key', /\bAKIA[0-9A-Z]{16}\b/],
  ['GitHub token', /\b(ghp|gho|ghs)_[A-Za-z0-9]{30,}|github_pat_[A-Za-z0-9_]{40,}/],
  ['Slack token', /\bxox[baprs]-[0-9A-Za-z-]{20,}/],
  ['Google API key', /\bAIza[0-9A-Za-z_-]{35}\b/],
  ['Resend key', /\bre_[A-Za-z0-9]{8}_[A-Za-z0-9]{20,}/],
  ['Private key block', /-----BEGIN (RSA |EC |OPENSSH |)PRIVATE KEY-----/],
  ['Database URL with password', /\b(postgres(ql)?|mysql|mongodb(\+srv)?|rediss?):\/\/[^:@\s/'"]+:[^@\s'"$]{8,}@(?!localhost|127\.0\.0\.1|postgres:|redis:|host\b)/],
  ['Secret assignment', /\b(JWT_SECRET|NEXTAUTH_SECRET|ENCLAVE_PIN_PEPPER|ENCLAVE_PIN_SECRET|[A-Z_]*API_KEY|[A-Z_]*PRIVATE_KEY)\s*=\s*["']?(?![<$]|your|change|example|dummy|xxx|\.\.\.)[A-Za-z0-9_+/=-]{20,}/],
];

let diff = '';
try {
  diff = execSync('git diff --cached -U0 --no-color --diff-filter=AM', { encoding: 'utf8', maxBuffer: 64 * 1024 * 1024 });
} catch {
  process.exit(0); // not in a git checkout
}

const findings = [];
let file = '';
let line = 0;
for (const raw of diff.split('\n')) {
  if (raw.startsWith('+++ b/')) { file = raw.slice(6); continue; }
  const hunk = /^@@ -\d+(?:,\d+)? \+(\d+)/.exec(raw);
  if (hunk) { line = Number(hunk[1]); continue; }
  if (!raw.startsWith('+') || raw.startsWith('+++')) continue;
  const text = raw.slice(1);
  if (!/secret-scan: allow/.test(text) && !/package-lock\.json$/.test(file)) {
    for (const [name, re] of PATTERNS) {
      const m = re.exec(text);
      if (m) {
        const v = m[0];
        findings.push(`  ${file}:${line}  ${name}: ${v.slice(0, 8)}…${v.slice(-3)}`);
        break;
      }
    }
  }
  line++;
}

if (findings.length) {
  console.error('Commit blocked: these lines look like credentials.\n' + findings.join('\n'));
  console.error('Put secrets in .env.local (ignored) or the host\'s variables, never in the repository.');
  process.exit(1);
}
