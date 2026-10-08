import { NextRequest, NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';

async function handlePriceCommand(args: string): Promise<string> {
  const token = args.trim().toUpperCase() || 'ETH';
  try {
    const res = await fetch(
      `https://api.coingecko.com/api/v3/simple/price?ids=${encodeURIComponent(token.toLowerCase())}&vs_currencies=usd&include_24hr_change=true`,
      { next: { revalidate: 30 } }
    );
    const data = await res.json();
    const tokenKey = Object.keys(data)[0];
    if (!tokenKey) return `❌ Token "${token}" not found on CoinGecko.`;
    const price = data[tokenKey].usd;
    const change = data[tokenKey].usd_24h_change?.toFixed(2);
    const arrow = change >= 0 ? '📈' : '📉';
    return `${arrow} **${token}**: $${price.toLocaleString()} (${change > 0 ? '+' : ''}${change}% 24h)`;
  } catch {
    return `❌ Failed to fetch price for ${token}. Try again.`;
  }
}

async function handleEnsCommand(args: string): Promise<string> {
  const name = args.trim();
  if (!name.endsWith('.eth')) return '❌ Please provide a valid .eth name';
  try {
    const res = await fetch(`https://api.ensideas.com/ens/resolve/${name}`);
    const data = await res.json();
    if (data.address) {
      return `🔍 **${name}**\n\`${data.address}\``;
    }
    return `❌ ENS name "${name}" not found or not resolved.`;
  } catch {
    return `❌ Failed to resolve ${name}.`;
  }
}

export async function POST(req: NextRequest) {
  try {
    const { command, args } = await req.json();
    let response = '';

    switch (command) {
      case '/price': response = await handlePriceCommand(args); break;
      case '/ens':   response = await handleEnsCommand(args); break;
      case '/mc':
        response = `📊 Market cap data coming soon. Try /price ${args} for now.`;
        break;
      case '/gas': {
        try {
          const res = await fetch('https://api.etherscan.io/api?module=gastracker&action=gasoracle', { next: { revalidate: 15 } });
          const data = await res.json();
          if (data.result?.ProposeGasPrice) {
            response = `⛽ **Gas Prices** (Gwei)\nSlow: ${data.result.SafeGasPrice} | Standard: ${data.result.ProposeGasPrice} | Fast: ${data.result.FastGasPrice}`;
          } else {
            response = '❌ Gas data unavailable.';
          }
        } catch { response = '❌ Failed to fetch gas prices.'; }
        break;
      }
      default:
        response = `❓ Unknown command: ${command}\nAvailable: /price <token>, /ens <name.eth>, /gas`;
    }

    return NextResponse.json({ response });
  } catch (e) {
    return NextResponse.json({ error: 'Command failed' }, { status: 500 });
  }
}
