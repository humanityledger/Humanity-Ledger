/**
 * Slash commands in the Studio composer (pure, shared by the UI and tests).
 * Built-in commands act locally or send a prepared prompt; custom commands
 * expand their template with the text typed after them ($ARGUMENTS).
 */

export type BuiltinCommandId =
  | 'help' | 'clear' | 'compact' | 'plan' | 'ask' | 'auto' | 'code' | 'chat' | 'model' | 'effort' | 'sandbox'
  | 'cost' | 'memory' | 'init' | 'review' | 'agents' | 'commands' | 'rewind' | 'files' | 'todos';

export interface BuiltinCommand {
  id: BuiltinCommandId;
  /** Shown as the argument hint. */
  args?: string;
  /** Only meaningful in Code mode. */
  code?: boolean;
}

export const BUILTIN_COMMANDS: BuiltinCommand[] = [
  { id: 'help' },
  { id: 'clear' },
  { id: 'compact', args: '[focus]' },
  { id: 'code' },
  { id: 'chat' },
  { id: 'plan', code: true },
  { id: 'ask', code: true },
  { id: 'auto', code: true },
  { id: 'model', args: 'opus | sonnet | haiku' },
  { id: 'effort', args: 'auto | low | medium | high | xhigh | max' },
  { id: 'sandbox', args: 'on | off', code: true },
  { id: 'init', code: true },
  { id: 'review', args: '[what]', code: true },
  { id: 'memory' },
  { id: 'files', code: true },
  { id: 'todos', code: true },
  { id: 'rewind', code: true },
  { id: 'agents' },
  { id: 'commands' },
  { id: 'cost' },
];

export interface CustomCommandLike { name: string; description: string; template: string }

export type ParsedCommand =
  | { kind: 'builtin'; id: BuiltinCommandId; args: string }
  | { kind: 'custom'; command: CustomCommandLike; args: string; prompt: string }
  | { kind: 'unknown'; name: string };

export const COMMAND_NAME_RE = /^[a-z0-9][a-z0-9_-]{0,39}$/;

/** "/name rest" → its parts, or null when the text is not a command. */
export function splitCommand(text: string): { name: string; args: string } | null {
  const m = /^\/([A-Za-z0-9][\w-]{0,39})(?:\s+([\s\S]*))?$/.exec(text.trim());
  if (!m) return null;
  return { name: m[1].toLowerCase(), args: (m[2] ?? '').trim() };
}

export function expandTemplate(template: string, args: string): string {
  return template.includes('$ARGUMENTS') ? template.split('$ARGUMENTS').join(args) : args ? `${template}\n\n${args}` : template;
}

export function parseCommand(text: string, custom: CustomCommandLike[]): ParsedCommand | null {
  const s = splitCommand(text);
  if (!s) return null;
  // Custom commands may not shadow built-ins.
  const builtin = BUILTIN_COMMANDS.find(c => c.id === s.name);
  if (builtin) return { kind: 'builtin', id: builtin.id, args: s.args };
  const c = custom.find(x => x.name.toLowerCase() === s.name);
  if (c) return { kind: 'custom', command: c, args: s.args, prompt: expandTemplate(c.template, s.args) };
  return { kind: 'unknown', name: s.name };
}

/** Commands whose name starts with what was typed after "/". */
export function matchCommands(text: string, custom: CustomCommandLike[]): { name: string; args?: string; custom?: CustomCommandLike; builtin?: BuiltinCommand }[] {
  const m = /^\/([\w-]*)$/.exec(text.trim());
  if (!m) return [];
  const q = m[1].toLowerCase();
  return [
    ...BUILTIN_COMMANDS.filter(c => c.id.startsWith(q)).map(c => ({ name: c.id, args: c.args, builtin: c })),
    ...custom.filter(c => c.name.toLowerCase().startsWith(q) && !BUILTIN_COMMANDS.some(b => b.id === c.name.toLowerCase())).map(c => ({ name: c.name, custom: c })),
  ];
}

export const INIT_PROMPT = [
  'Analyze this workspace and create a STUDIO.md file at its root that will guide you in future sessions (like CLAUDE.md).',
  'Include: what the project is, how it is structured, the main commands to build, test and run it (only ones you can see in the files), the conventions the code follows, and anything non-obvious a new engineer would get wrong.',
  'Keep it short and specific to this codebase. If STUDIO.md already exists, improve it instead of replacing what is still correct.',
].join('\n');

export const REVIEW_PROMPT = [
  'Review the code in this workspace{what} like a careful senior engineer.',
  'Look for bugs, security problems, unhandled errors, edge cases and confusing code. Read the relevant files before judging.',
  'Report the findings ordered by severity, each with the file path and line and a concrete fix. Do not change files unless I ask.',
].join('\n');

export const COMPACT_PROMPT = [
  'Summarize our conversation so far so we can continue from the summary alone{focus}.',
  'Keep: my goals and decisions, the current state of the work, files changed and why, important code and errors, open questions and what is next.',
  'Write the summary only. Do not call any tools.',
].join('\n');

export const CONTINUE_PROMPT = 'Continue where you left off.';

export function modelFromArg(arg: string): string | null {
  const a = arg.trim().toLowerCase();
  if (a.startsWith('opus')) return 'claude-opus-5-5';
  if (a.startsWith('sonnet')) return 'claude-sonnet-5-5';
  if (a.startsWith('haiku')) return 'claude-haiku-5-5';
  return null;
}
