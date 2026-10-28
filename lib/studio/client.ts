/** The Anthropic client Studio uses (server only). Adds the workspace header when configured. */

import Anthropic from '@anthropic-ai/sdk';
import { studioWorkspaceHeaders } from './workspace';

export { studioWorkspaceHeaders };

export function createStudioClient(apiKey: string, opts: { maxRetries?: number; timeout?: number } = {}): Anthropic {
  const headers = studioWorkspaceHeaders();
  return new Anthropic({ apiKey, ...opts, ...(headers ? { defaultHeaders: headers } : {}) });
}
