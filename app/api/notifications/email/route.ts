import { NextRequest, NextResponse } from 'next/server';
import { Resend } from 'resend';

import { safeToFixed, safeToLocaleString } from '@/lib/utils/number-format';
/**
 * Email Notification API via Resend
 * Already configured in your project
 */

// Initialize Resend with a dummy key if missing to prevent build crash
// In production, the key must be present for emails to work.
const apiKey = process.env.RESEND_API_KEY as string; 
const resend = new Resend(apiKey || 're_dummy_key_for_build_time');

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { to, type, data } = body;

    if (!to) {
      return NextResponse.json(
        { error: 'Recipient email is required' },
        { status: 400 }
      );
    }

    let subject: string;
    let html: string;

    // Format email based on type
    switch (type) {
      case 'ledger_alert':
        subject = ` Humanity Ledger: $${safeToLocaleString(data.amount)} Movement`;
        html = formatHumanityLedgerEmail(data);
        break;
      
      case 'price_alert':
        subject = ` Price Alert: ${data.token} ${data.condition} $${data.targetPrice}`;
        html = formatPriceAlertEmail(data);
        break;
      
      case 'daily_digest':
        subject = ` Daily Digest: ${data.walletsTracked} Wallets Tracked`;
        html = formatDailyDigestEmail(data);
        break;
      
      default:
        return NextResponse.json(
          { error: `Unknown notification type: ${type}` },
          { status: 400 }
        );
    }

    // Send via Resend
    const result = await resend.emails.send({
      from: 'Humanity Ledger Sovereign <alerts@sovereign.pro>',
      to: [to],
      subject,
      html,
    });

    return NextResponse.json({
      success: true,
      messageId: result.data?.id,
      timestamp: new Date().toISOString(),
    });
  } catch (error: any) {
    console.error('Email notification error:', error);
    
    return NextResponse.json(
      {
        error: 'Failed to send email',
        details: 'Error details redacted',
      },
      { status: 500 }
    );
  }
}

/**
 * Email Templates
 */

function formatHumanityLedgerEmail(data: {
  address: string;
  type: string;
  amount: number;
  token: string;
  txHash?: string;
}): string {
  return `
<!DOCTYPE html>
<html>
<head>
  <style>
    body { font-family: -apple-system, BlinkMacSystemFont, sans-serif; background: #f5f5f5; margin: 0; padding: 20px; }
    .container { max-width: 600px; margin: 0 auto; background: white; border-radius: 16px; overflow: hidden; box-shadow: 0 4px 12px rgba(0,0,0,0.1); }
    .header { background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); padding: 30px; text-align: center; }
    .header h1 { color: white; margin: 0; font-size: 28px; }
    .content { padding: 30px; }
    .stat { margin: 20px 0; padding: 15px; background: #f8f9fa; border-radius: 8px; }
    .stat-label { font-size: 14px; color: #666; margin-bottom: 5px; }
    .stat-value { font-size: 24px; font-weight: bold; color: #1a1a1a; }
    .button { display: inline-block; padding: 12px 24px; background: #667eea; color: white; text-decoration: none; border-radius: 8px; margin-top: 20px; }
    .footer { padding: 20px; text-align: center; color: #999; font-size: 12px; }
  </style>
</head>
<body>
  <div class="container">
    <div class="header">
      <h1> Humanity Ledger</h1>
    </div>
    <div class="content">
      <p>A significant transaction has been detected on one of your tracked wallets.</p>
      
      <div class="stat">
        <div class="stat-label"> Amount</div>
        <div class="stat-value">$${safeToLocaleString(data.amount)}</div>
      </div>
      
      <div class="stat">
        <div class="stat-label"> Type</div>
        <div class="stat-value">${data.type}</div>
      </div>
      
      <div class="stat">
        <div class="stat-label"> Token</div>
        <div class="stat-value">${data.token}</div>
      </div>
      
      <div class="stat">
        <div class="stat-label"> Wallet</div>
        <div class="stat-value" style="font-size: 14px; font-family: monospace;">${data.address}</div>
      </div>
      
      ${data.txHash ? `<a href="https://basescan.org/tx/${data.txHash}" class="button">View Transaction</a>` : ''}
    </div>
    <div class="footer">
      Humanity Ledger VIP - Ledger Tracking Platform<br>
      <a href="/vip" style="color: #ffffff;">Manage Alerts</a>
    </div>
  </div>
</body>
</html>
  `.trim();
}

function formatPriceAlertEmail(data: {
  token: string;
  currentPrice: number;
  targetPrice: number;
  condition: string;
}): string {
  const emoji = data.condition === 'above' ? '' : '';
  
  return `
<!DOCTYPE html>
<html>
<head>
  <style>
    body { font-family: -apple-system, BlinkMacSystemFont, sans-serif; background: #f5f5f5; margin: 0; padding: 20px; }
    .container { max-width: 600px; margin: 0 auto; background: white; border-radius: 16px; overflow: hidden; box-shadow: 0 4px 12px rgba(0,0,0,0.1); }
    .header { background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); padding: 30px; text-align: center; }
    .header h1 { color: white; margin: 0; font-size: 28px; }
    .content { padding: 30px; }
    .stat { margin: 20px 0; padding: 15px; background: #f8f9fa; border-radius: 8px; }
    .stat-label { font-size: 14px; color: #666; margin-bottom: 5px; }
    .stat-value { font-size: 24px; font-weight: bold; color: #1a1a1a; }
  </style>
</head>
<body>
  <div class="container">
    <div class="header">
      <h1>${emoji} Price Alert</h1>
    </div>
    <div class="content">
      <p>Your price target has been reached!</p>
      
      <div class="stat">
        <div class="stat-label"> Token</div>
        <div class="stat-value">${data.token}</div>
      </div>
      
      <div class="stat">
        <div class="stat-label"> Current Price</div>
        <div class="stat-value">$${safeToLocaleString(data.currentPrice)}</div>
      </div>
      
      <div class="stat">
        <div class="stat-label"> Target Price</div>
        <div class="stat-value">$${safeToLocaleString(data.targetPrice)}</div>
      </div>
    </div>
  </div>
</body>
</html>
  `.trim();
}

function formatDailyDigestEmail(data: {
  walletsTracked: number;
  totalValue: number;
  transactions24h: number;
  topMovers: Array<{ address: string; change: number }>;
}): string {
  const topMoversList = data.topMovers
    .slice(0, 5)
    .map((m, i) => {
      const emoji = m.change > 0 ? '' : '';
      return `
        <div style="padding: 10px; margin: 5px 0; background: ${m.change > 0 ? '#d4edda' : '#f8d7da'}; border-radius: 8px;">
          ${i + 1}. <code>${m.address.slice(0, 10)}...${m.address.slice(-8)}</code>
          <strong>${emoji} ${m.change > 0 ? '+' : ''}${safeToFixed(m.change, 2)}%</strong>
        </div>
      `;
    })
    .join('');

  return `
<!DOCTYPE html>
<html>
<head>
  <style>
    body { font-family: -apple-system, BlinkMacSystemFont, sans-serif; background: #f5f5f5; margin: 0; padding: 20px; }
    .container { max-width: 600px; margin: 0 auto; background: white; border-radius: 16px; overflow: hidden; box-shadow: 0 4px 12px rgba(0,0,0,0.1); }
    .header { background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); padding: 30px; text-align: center; }
    .header h1 { color: white; margin: 0; font-size: 28px; }
    .content { padding: 30px; }
    .stat { margin: 20px 0; padding: 15px; background: #f8f9fa; border-radius: 8px; text-align: center; }
    .stat-label { font-size: 14px; color: #666; margin-bottom: 5px; }
    .stat-value { font-size: 28px; font-weight: bold; color: #1a1a1a; }
  </style>
</head>
<body>
  <div class="container">
    <div class="header">
      <h1> Daily Digest</h1>
    </div>
    <div class="content">
      <div class="stat">
        <div class="stat-label"> Wallets Tracked</div>
        <div class="stat-value">${data.walletsTracked}</div>
      </div>
      
      <div class="stat">
        <div class="stat-label"> Total Value</div>
        <div class="stat-value">$${safeToFixed(data.totalValue / 1e6, 2)}M</div>
      </div>
      
      <div class="stat">
        <div class="stat-label"> 24h Transactions</div>
        <div class="stat-value">${data.transactions24h}</div>
      </div>
      
      <h3 style="margin-top: 30px;"> Top Movers</h3>
      ${topMoversList}
    </div>
  </div>
</body>
</html>
  `.trim();
}


