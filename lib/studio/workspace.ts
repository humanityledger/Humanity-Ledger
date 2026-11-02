/**
 * Personal and service-account Claude API keys that are not limited to one
 * workspace must name the workspace on every request (`anthropic-workspace-id`),
 * or the API answers 400. Set ANTHROPIC_WORKSPACE_ID (wrkspc_...) for those keys;
 * keys limited to one workspace work without it. No imports: usable anywhere on the server.
 */

const WORKSPACE_RE = /^wrkspc_[A-Za-z0-9]{10,64}$/;

export function studioWorkspaceHeaders(): Record<string, string> | undefined {
  const id = (process.env.ANTHROPIC_WORKSPACE_ID || '').trim();
  return WORKSPACE_RE.test(id) ? { 'anthropic-workspace-id': id } : undefined;
}
