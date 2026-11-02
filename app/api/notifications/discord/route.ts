import { NextRequest, NextResponse } from 'next/server';

import { safeToFixed, safeToLocaleString } from '@/lib/utils/number-format';
/**
 * Discord Webhook Notification API
 * Send rich embeds to Discord channels
 * 
 * Setup: User creates webhook in Discord channel settings and provides URL
 */

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { webhookUrl, type, data } = body;

    if (!webhookUrl) {
      return NextResponse.json(
        { error: 'Discord webhook URL is required' },
        { status: 400 }
      );
    }

    let embed: any;

    // Format embed based on type
    switch (type) {
      case 'ledger_alert':
        embed = formatHumanityLedgerDiscord(data);
        break;
      
      case 'price_alert':
        embed = formatPriceAlertDiscord(data);
        break;
      
      case 'daily_digest':
        embed = formatDailyDigestDiscord(data);
        break;
      
      default:
        return NextResponse.json(
          { error: `Unknown notification type: ${type}` },
          { status: 400 }
        );
    }

    // Send to Discord webhook
    const response = await fetch(webhookUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        username: 'Humanity Ledger VIP',
        avatar_url: 'https://sovereign.pro/logo-mark.png', // Optional
        embeds: [embed],
      }),
    });

    if (!response.ok) {
      const error = await response.text();
      console.error('Discord webhook error:', error);
      return NextResponse.json(
        { error: 'Failed to send Discord notification' },
        { status: 500 }
      );
    }

    return NextResponse.json({
      success: true,
      message: 'Discord notification sent',
      timestamp: new Date().toISOString(),
    });
  } catch (error: any) {
    console.error('Discord notification error:', error);
    
    return NextResponse.json(
      {
        error: 'Failed to send notification',
        details: 'Error details redacted',
      },
      { status: 500 }
    );
  }
}

/**
 * Discord Rich Embed Formatters
 */

function formatHumanityLedgerDiscord(data: {
  address: string;
  type: string;
  amount: number;
  token: string;
  txHash?: string;
}): any {
  // Color based on amount
  let color = 0x3498db; // Blue
  if (data.amount > 1000000) color = 0xf39c12; // Orange
  if (data.amount > 5000000) color = 0xe74c3c; // Red

  return {
    title: ' Humanity Ledger',
    color,
    fields: [
      {
        name: ' Amount',
        value: `$${safeToLocaleString(data.amount)}`,
        inline: true,
      },
      {
        name: ' Type',
        value: data.type,
        inline: true,
      },
      {
        name: ' Token',
        value: data.token,
        inline: true,
      },
      {
        name: ' Wallet',
        value: `\`${data.address.slice(0, 10)}...${data.address.slice(-8)}\``,
        inline: false,
      },
    ],
    footer: {
      text: 'Humanity Ledger VIP - Ledger Tracker',
    },
    timestamp: new Date().toISOString(),
    ...(data.txHash && {
      url: `https://basescan.org/tx/${data.txHash}`,
    }),
  };
}

function formatPriceAlertDiscord(data: {
  token: string;
  currentPrice: number;
  targetPrice: number;
  condition: string;
}): any {
  const emoji = data.condition === 'above' ? '' : '';
  const color = data.condition === 'above' ? 0x2ecc71 : 0xe74c3c;

  return {
    title: `${emoji} PRICE ALERT`,
    color,
    fields: [
      {
        name: ' Token',
        value: data.token,
        inline: true,
      },
      {
        name: ' Current Price',
        value: `$${safeToLocaleString(data.currentPrice)}`,
        inline: true,
      },
      {
        name: ' Target Price',
        value: `$${safeToLocaleString(data.targetPrice)}`,
        inline: true,
      },
      {
        name: ' Condition',
        value: data.condition.toUpperCase(),
        inline: true,
      },
    ],
    footer: {
      text: 'Humanity Ledger VIP - Price Alerts',
    },
    timestamp: new Date().toISOString(),
  };
}

function formatDailyDigestDiscord(data: {
  walletsTracked: number;
  totalValue: number;
  transactions24h: number;
  topMovers: Array<{ address: string; change: number }>;
}): any {
  const topMoversList = data.topMovers
    .slice(0, 5)
    .map((m, i) => {
      const emoji = m.change > 0 ? '' : '';
      const shortAddr = `${m.address.slice(0, 6)}...${m.address.slice(-4)}`;
      return `${i + 1}. \`${shortAddr}\`: ${emoji} ${m.change > 0 ? '+' : ''}${safeToFixed(m.change, 2)}%`;
    })
    .join('\n');

  return {
    title: ' DAILY DIGEST',
    color: 0x9b59b6,
    fields: [
      {
        name: ' Wallets Tracked',
        value: data.walletsTracked.toString(),
        inline: true,
      },
      {
        name: ' Total Value',
        value: `$${safeToFixed(data.totalValue / 1e6, 2)}M`,
        inline: true,
      },
      {
        name: ' 24h Transactions',
        value: data.transactions24h.toString(),
        inline: true,
      },
      {
        name: ' Top Movers',
        value: topMoversList || 'No movements',
        inline: false,
      },
    ],
    footer: {
      text: 'Humanity Ledger VIP - Daily Report',
    },
    timestamp: new Date().toISOString(),
  };
}


