/**
 * Skills: named instruction packs Studio follows when they are switched on
 * for a conversation or a project. Built-in skills ship here; people can add
 * their own (stored on their device and synced with their data).
 */

export interface StudioSkill {
  id: string;
  name: string;
  description: string;
  instructions: string;
  builtin?: boolean;
  /** Emoji-free short tag shown in the UI. */
  tag?: string;
}

export const MAX_SKILL_CHARS = 12_000;

export const BUILTIN_SKILLS: StudioSkill[] = [
  {
    id: 'code-review',
    name: 'Code review',
    tag: 'Engineering',
    description: 'Review code for bugs, security issues and maintainability, worst first.',
    builtin: true,
    instructions: [
      'When reviewing code, read all of it before commenting.',
      'Report findings worst first: correctness bugs, security issues (injection, SSRF, auth, secrets, unsafe deserialization), data loss, concurrency, then maintainability.',
      'For each finding give: the file/line or snippet, what goes wrong with a concrete input, and the minimal fix as a diff or code.',
      'Say plainly when something is fine. Do not invent issues to fill a list.',
    ].join('\n'),
  },
  {
    id: 'solidity-audit',
    name: 'Smart contract audit',
    tag: 'Web3',
    description: 'Audit Solidity contracts: reentrancy, access control, oracle and math issues, gas.',
    builtin: true,
    instructions: [
      'Audit Solidity with the checklist: reentrancy (including read-only and cross-function), access control and initializer protection, unchecked external calls, integer and rounding issues, oracle manipulation, front-running/MEV, signature replay (nonce, chainId, EIP-712 domain), ERC-20 quirks (fee-on-transfer, non-standard returns), denial of service by unbounded loops, upgradeability storage layout, and event coverage.',
      'Classify each finding Critical / High / Medium / Low / Informational with an exploit scenario and a fix.',
      'Never claim a contract is safe; say what was and was not checked, and recommend a professional audit before real funds.',
    ].join('\n'),
  },
  {
    id: 'noir-aztec',
    name: 'Noir and Aztec contracts',
    tag: 'Web3',
    description: 'Write and review Noir circuits and Aztec v6 contracts (private and public state).',
    builtin: true,
    instructions: [
      'Target Aztec v6 (azteclabs, @aztec-labs/* 6.0.0 packages). State which aztec-nr version you assume.',
      'Separate private functions, public functions and utility functions; explain what leaks to the public (function selectors, public state writes, enqueued public calls, note emission patterns).',
      'Check note handling (nullifier derivation, double spend), authwit usage, and private-to-public call ordering.',
      'Say when an API detail may have changed and should be checked against docs.aztec.network.',
    ].join('\n'),
  },
  {
    id: 'product-spec',
    name: 'Product spec',
    tag: 'Product',
    description: 'Turn an idea into a spec: problem, users, scope, non-goals, flows, metrics, risks.',
    builtin: true,
    instructions: [
      'Write specs as an artifact (markdown) with: Problem, Who it is for, Goals, Non-goals, User flows, Requirements (must/should), Edge cases, Success metrics, Risks and open questions, Rollout.',
      'Prefer concrete examples over adjectives. Flag assumptions explicitly.',
    ].join('\n'),
  },
  {
    id: 'web-page',
    name: 'Landing page builder',
    tag: 'Design',
    description: 'Build complete, responsive single-file HTML pages with real copy.',
    builtin: true,
    instructions: [
      'Build pages as one self-contained HTML artifact: semantic HTML, inline CSS, minimal inline JS, no external URLs (the preview blocks the network).',
      'Mobile first, accessible (labels, contrast, focus states), no lorem ipsum: write real, specific copy.',
      'Keep a restrained visual system: one typeface stack, a small palette, consistent spacing.',
    ].join('\n'),
  },
  {
    id: 'research',
    name: 'Deep research',
    tag: 'Research',
    description: 'Research a question on the web with several searches and cite every claim.',
    builtin: true,
    instructions: [
      'Plan the research, then run several focused web searches and fetch the most relevant primary sources.',
      'Cite sources for every factual claim. Distinguish facts, estimates and opinions. Note where sources disagree.',
      'End with a short answer first, then the evidence.',
    ].join('\n'),
  },
  {
    id: 'data-analysis',
    name: 'Data analysis',
    tag: 'Data',
    description: 'Analyse CSV/JSON the user uploads; show the method and the numbers.',
    builtin: true,
    instructions: [
      'When given tabular data, first describe its shape (rows, columns, types, missing values).',
      'Compute carefully and show the method. Never estimate a number you can compute from the data.',
      'Put derived tables in a CSV or markdown artifact.',
    ].join('\n'),
  },
];

export function skillsById(custom: StudioSkill[] = []): Map<string, StudioSkill> {
  const m = new Map<string, StudioSkill>();
  for (const s of BUILTIN_SKILLS) m.set(s.id, s);
  for (const s of custom) if (s && s.id && !m.has(s.id)) m.set(s.id, s);
  return m;
}
