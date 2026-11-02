/**
 * Mattermost-grade Native Command Interceptor for Humanity Ledger
 * Handles slash commands (/me, /shrug, /code, /table, /urgent, /away, /online, /dnd, /price, /ens, /gas, /help)
 * Client-side transforms execute with zero mock data and zero latency.
 */

export interface SlashCommandDef {
  command: string;
  syntax: string;
  description: string;
  category: 'format' | 'status' | 'crypto' | 'utility';
}

export const SLASH_COMMANDS: SlashCommandDef[] = [
  // Formatting & Personality
  { command: '/me', syntax: '/me <action>', description: 'Send a third-person action message', category: 'format' },
  { command: '/shrug', syntax: '/shrug [text]', description: 'Append ¯\\_(ツ)_/¯ to message', category: 'format' },
  { command: '/code', syntax: '/code <code>', description: 'Format text as a syntax-highlighted code block', category: 'format' },
  { command: '/table', syntax: '/table Col1, Col2 | Val1, Val2', description: 'Format values as a Markdown table', category: 'format' },
  { command: '/urgent', syntax: '/urgent <text>', description: 'Send high-priority urgent alert', category: 'format' },
  
  // Status & Presence
  { command: '/online', syntax: '/online', description: 'Set presence status to Online', category: 'status' },
  { command: '/away', syntax: '/away', description: 'Set presence status to Away', category: 'status' },
  { command: '/dnd', syntax: '/dnd', description: 'Set Do Not Disturb mode', category: 'status' },
  
  // Crypto & Network
  { command: '/price', syntax: '/price <token>', description: 'Real-time crypto price from live oracle', category: 'crypto' },
  { command: '/ens', syntax: '/ens <name.eth>', description: 'Resolve ENS address on-chain', category: 'crypto' },
  { command: '/gas', syntax: '/gas', description: 'Current live Ethereum gas tracker', category: 'crypto' },
  
  // Utility
  { command: '/studio', syntax: '/studio [prompt]', description: 'Open Ledger Studio (AI). Nothing is sent to the chat', category: 'utility' },
  { command: '/sequencer', syntax: '/sequencer', description: 'Open the Aztec sequencer dashboard', category: 'utility' },
  { command: '/help', syntax: '/help', description: 'List all native slash commands', category: 'utility' },
  { command: '/clear', syntax: '/clear', description: 'Clear local view history', category: 'utility' },
];

export const BOT_COMMANDS = SLASH_COMMANDS.map(c => c.command);

export function isBotCommand(text: string): boolean {
  const trimmed = text.trim();
  return SLASH_COMMANDS.some(cmd => 
    trimmed.toLowerCase().startsWith(cmd.command + ' ') || 
    trimmed.toLowerCase() === cmd.command
  );
}

/**
 * Transforms client-side text-formatting slash commands directly before sending
 */
export function transformClientCommand(text: string, senderDisplayName: string = 'User'): { transformed: string; isHandledLocally: boolean; action?: 'clear' | 'status_online' | 'status_away' | 'status_dnd' } {
  const trimmed = text.trim();
  const lower = trimmed.toLowerCase();

  // /shrug [message]
  if (lower === '/shrug') {
    return { transformed: '¯\\_(ツ)_/¯', isHandledLocally: false };
  }
  if (lower.startsWith('/shrug ')) {
    const rest = trimmed.slice(7).trim();
    return { transformed: `${rest} ¯\\_(ツ)_/¯`, isHandledLocally: false };
  }

  // /me <action>
  if (lower.startsWith('/me ')) {
    const action = trimmed.slice(4).trim();
    return { transformed: `* ${senderDisplayName} ${action} *`, isHandledLocally: false };
  }

  // /code <code>
  if (lower.startsWith('/code ')) {
    const code = trimmed.slice(6);
    return { transformed: `\`\`\`\n${code}\n\`\`\``, isHandledLocally: false };
  }

  // /urgent <text>
  if (lower.startsWith('/urgent ')) {
    const urgentText = trimmed.slice(8).trim();
    return { transformed: `__URGENT__::${urgentText}`, isHandledLocally: false };
  }

  // /table Header1, Header2 | Val1, Val2
  if (lower.startsWith('/table ')) {
    const raw = trimmed.slice(7).trim();
    const rows = raw.split('|').map(r => r.split(',').map(c => c.trim()));
    if (rows.length >= 2) {
      const headers = rows[0];
      const headerLine = `| ${headers.join(' | ')} |`;
      const sepLine = `| ${headers.map(() => '---').join(' | ')} |`;
      const bodyLines = rows.slice(1).map(r => `| ${r.join(' | ')} |`).join('\n');
      return { transformed: `${headerLine}\n${sepLine}\n${bodyLines}`, isHandledLocally: false };
    }
  }

  // /clear
  if (lower === '/clear') {
    return { transformed: '', isHandledLocally: true, action: 'clear' };
  }

  // /online, /away, /dnd
  if (lower === '/online') return { transformed: '', isHandledLocally: true, action: 'status_online' };
  if (lower === '/away') return { transformed: '', isHandledLocally: true, action: 'status_away' };
  if (lower === '/dnd') return { transformed: '', isHandledLocally: true, action: 'status_dnd' };

  return { transformed: text, isHandledLocally: false };
}

export async function executeBotCommand(text: string): Promise<string | null> {
  const trimmed = text.trim();
  const parts = trimmed.split(' ');
  const command = parts[0].toLowerCase();
  const args = parts.slice(1).join(' ');

  if (command === '/help') {
    return `⚡ **Humanity Ledger Commands:**\n` +
      SLASH_COMMANDS.map(c => `• \`${c.syntax}\` — ${c.description}`).join('\n');
  }

  if (command === '/sequencer') {
    return `**Aztec sequencer**\n` +
      `Live network status, your node, stake, committee duties and publisher gas, read from the Aztec node and the Rollup contract on Ethereum.\n` +
      `[Open the sequencer dashboard](/sequencer)`;
  }

  // For server-resolved commands
  if (['/price', '/ens', '/mc', '/gas'].includes(command)) {
    try {
      const res = await fetch('/api/bots/command', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ command, args })
      });
      const data = await res.json();
      return data.response || null;
    } catch {
      return '❌ Live network oracle unreachable. Try again in a moment.';
    }
  }

  return null;
}
