/**
 * Bot command interceptor — runs client-side before sending to XMTP.
 * Commands starting with / are intercepted and sent to the bot API.
 */

export const BOT_COMMANDS = ['/price', '/ens', '/mc', '/gas', '/addr', '/help'];

export function isBotCommand(text: string): boolean {
  const trimmed = text.trim();
  return BOT_COMMANDS.some(cmd => trimmed.toLowerCase().startsWith(cmd + ' ') || trimmed.toLowerCase() === cmd);
}

export async function executeBotCommand(text: string): Promise<string | null> {
  const trimmed = text.trim();
  const parts = trimmed.split(' ');
  const command = parts[0].toLowerCase();
  const args = parts.slice(1).join(' ');

  if (!BOT_COMMANDS.includes(command)) return null;

  if (command === '/help') {
    return `🤖 **Available commands:**\n/price <token> — Crypto price\n/ens <name.eth> — ENS lookup\n/gas — Current gas prices`;
  }

  try {
    const res = await fetch('/api/bots/command', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ command, args })
    });
    const data = await res.json();
    return data.response || null;
  } catch {
    return '❌ Bot service unavailable.';
  }
}
