/**
 * Artifacts: files Studio writes next to the conversation (code, documents,
 * HTML pages, diagrams). The model creates and edits them through one tool,
 * `artifact`; the same pure functions run on the server (to answer the tool
 * call) and in the browser (to store the new version).
 */

export const ARTIFACT_TYPES = ['code', 'markdown', 'html', 'svg', 'mermaid', 'json', 'csv'] as const;
export type ArtifactType = (typeof ARTIFACT_TYPES)[number];

export interface ArtifactVersion {
  content: string;
  createdAt: number;
  /** Who wrote this version. */
  by: 'studio' | 'user';
  note?: string;
}

export interface Artifact {
  id: string;
  title: string;
  type: ArtifactType;
  language?: string;
  conversationId: string;
  projectId?: string | null;
  versions: ArtifactVersion[];
  createdAt: number;
  updatedAt: number;
}

export const MAX_ARTIFACT_CHARS = 400_000;

export interface ArtifactToolInput {
  command: 'create' | 'update' | 'rewrite';
  id: string;
  title?: string;
  type?: ArtifactType;
  language?: string;
  content?: string;
  old_str?: string;
  new_str?: string;
}

/** JSON schema the model sees. */
export const ARTIFACT_TOOL = {
  name: 'artifact',
  description:
    'Create or edit an artifact: a standalone file shown in a panel beside the chat (code, a document, an HTML page, an SVG, a Mermaid diagram, JSON or CSV). ' +
    'Use it for anything the user will copy, run, save or keep editing, typically more than ~20 lines, a full document, or a page. ' +
    'Do not use it for short snippets or plain answers. ' +
    'Commands: "create" a new artifact with a short kebab-case id; "update" replaces exactly one occurrence of old_str with new_str in the latest version (old_str must match exactly and be unique); ' +
    '"rewrite" replaces the whole content. Prefer "update" for small changes to an existing artifact. ' +
    'HTML artifacts run in a sandbox with no network access: inline all CSS and JS, no external URLs.',
  input_schema: {
    type: 'object' as const,
    properties: {
      command: { type: 'string', enum: ['create', 'update', 'rewrite'] },
      id: { type: 'string', description: 'Stable id, e.g. "landing-page" or "escrow-contract".' },
      title: { type: 'string', description: 'Human title (create; optional on rewrite).' },
      type: { type: 'string', enum: [...ARTIFACT_TYPES] },
      language: { type: 'string', description: 'For type "code": typescript, solidity, noir, python, rust, sql, bash...' },
      content: { type: 'string', description: 'Full content (create, rewrite).' },
      old_str: { type: 'string', description: 'Exact text to replace (update).' },
      new_str: { type: 'string', description: 'Replacement text (update).' },
    },
    required: ['command', 'id'],
  },
};

export interface ArtifactSnapshot {
  id: string;
  title: string;
  type: ArtifactType;
  language?: string;
  content: string;
}

export type ApplyResult =
  | { ok: true; artifact: ArtifactSnapshot; created: boolean; message: string }
  | { ok: false; error: string };

const ID_RE = /^[a-z0-9][a-z0-9-_]{0,63}$/;

export function normalizeArtifactId(raw: string): string {
  return String(raw || '').trim().toLowerCase().replace(/[^a-z0-9-_]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 64);
}

/** Apply one tool call to the current artifacts. Pure: returns the new snapshot. */
export function applyArtifactCommand(current: Map<string, ArtifactSnapshot>, input: ArtifactToolInput): ApplyResult {
  const id = normalizeArtifactId(input?.id);
  if (!id || !ID_RE.test(id)) return { ok: false, error: 'Invalid id. Use a short kebab-case id.' };
  const existing = current.get(id);

  switch (input.command) {
    case 'create': {
      if (typeof input.content !== 'string') return { ok: false, error: 'create needs content.' };
      if (input.content.length > MAX_ARTIFACT_CHARS) return { ok: false, error: `Content is over ${MAX_ARTIFACT_CHARS} characters.` };
      const type = (ARTIFACT_TYPES as readonly string[]).includes(String(input.type)) ? (input.type as ArtifactType) : 'code';
      const artifact: ArtifactSnapshot = {
        id,
        title: (input.title || existing?.title || id).slice(0, 120),
        type,
        language: type === 'code' ? (input.language || existing?.language || 'text').slice(0, 32) : undefined,
        content: input.content,
      };
      return { ok: true, artifact, created: !existing, message: existing ? `Replaced artifact "${id}".` : `Created artifact "${id}".` };
    }
    case 'rewrite': {
      if (!existing) return { ok: false, error: `No artifact "${id}". Use create.` };
      if (typeof input.content !== 'string') return { ok: false, error: 'rewrite needs content.' };
      if (input.content.length > MAX_ARTIFACT_CHARS) return { ok: false, error: `Content is over ${MAX_ARTIFACT_CHARS} characters.` };
      return { ok: true, created: false, message: `Rewrote "${id}".`, artifact: { ...existing, title: (input.title || existing.title).slice(0, 120), content: input.content } };
    }
    case 'update': {
      if (!existing) return { ok: false, error: `No artifact "${id}". Use create.` };
      if (typeof input.old_str !== 'string' || input.old_str === '' || typeof input.new_str !== 'string') {
        return { ok: false, error: 'update needs a non-empty old_str and a new_str.' };
      }
      const first = existing.content.indexOf(input.old_str);
      if (first < 0) return { ok: false, error: 'old_str was not found in the latest version. Re-read it and copy the text exactly.' };
      if (existing.content.indexOf(input.old_str, first + 1) >= 0) return { ok: false, error: 'old_str appears more than once. Include more surrounding text.' };
      const content = existing.content.slice(0, first) + input.new_str + existing.content.slice(first + input.old_str.length);
      if (content.length > MAX_ARTIFACT_CHARS) return { ok: false, error: `Result is over ${MAX_ARTIFACT_CHARS} characters.` };
      return { ok: true, created: false, message: `Updated "${id}".`, artifact: { ...existing, content } };
    }
    default:
      return { ok: false, error: 'Unknown command. Use create, update or rewrite.' };
  }
}

export function latestContent(a: Artifact): string {
  return a.versions[a.versions.length - 1]?.content ?? '';
}

export function toSnapshot(a: Artifact): ArtifactSnapshot {
  return { id: a.id, title: a.title, type: a.type, language: a.language, content: latestContent(a) };
}

export function fileNameFor(a: Pick<ArtifactSnapshot, 'id' | 'type' | 'language'>): string {
  const ext: Record<string, string> = {
    markdown: 'md', html: 'html', svg: 'svg', mermaid: 'mmd', json: 'json', csv: 'csv',
  };
  const langExt: Record<string, string> = {
    typescript: 'ts', tsx: 'tsx', javascript: 'js', jsx: 'jsx', python: 'py', solidity: 'sol', noir: 'nr', rust: 'rs',
    go: 'go', sql: 'sql', bash: 'sh', shell: 'sh', css: 'css', yaml: 'yaml', toml: 'toml', java: 'java', kotlin: 'kt',
    swift: 'swift', c: 'c', cpp: 'cpp', csharp: 'cs', php: 'php', ruby: 'rb', html: 'html', json: 'json', text: 'txt',
  };
  const e = a.type === 'code' ? langExt[(a.language || 'text').toLowerCase()] ?? 'txt' : ext[a.type] ?? 'txt';
  return `${a.id}.${e}`;
}

/**
 * A complete HTML document for the sandboxed preview. The CSP forbids every
 * network request, so a page Studio writes cannot phone home or load
 * anything the user did not see.
 */
export function sandboxDocument(a: Pick<ArtifactSnapshot, 'type' | 'content'>): string {
  const csp = `<meta http-equiv="Content-Security-Policy" content="default-src 'none'; script-src 'unsafe-inline'; style-src 'unsafe-inline'; img-src data: blob:; font-src data:; media-src data: blob:; form-action 'none'; base-uri 'none'">`;
  // <meta http-equiv="refresh"> navigates even with scripts off: drop it.
  const c = a.content.replace(/<meta\b[^>]*http-equiv\s*=\s*["']?\s*refresh[^>]*>/gi, '');
  if (a.type === 'svg') {
    return `<!doctype html><html><head><meta charset="utf-8">${csp}<style>html,body{margin:0;height:100%;display:grid;place-items:center;background:#fff}svg{max-width:100%;max-height:100%}</style></head><body>${c}</body></html>`;
  }
  if (/<html[\s>]/i.test(c)) {
    // Inject the CSP as the first thing in <head> (or right after <html>).
    // `<head>` exactly (not `<header>`): a CSP meta outside <head> is ignored.
    const HEAD = /<head(?:\s[^>]*)?>/i;
    if (HEAD.test(c)) return c.replace(HEAD, m => `${m}<meta charset="utf-8">${csp}`);
    return c.replace(/<html(?:\s[^>]*)?>/i, m => `${m}<head><meta charset="utf-8">${csp}</head>`);
  }
  return `<!doctype html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">${csp}</head><body>${c}</body></html>`;
}
