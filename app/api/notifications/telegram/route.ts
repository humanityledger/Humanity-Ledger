import { NextRequest, NextResponse } from 'next/server';
import { sendTelegramMessage, formatHumanityLedgerTelegram, formatPriceAlertTelegram, formatDailyDigestTelegram } from '@/lib/telegramBot';

/**
 * Telegram Notification API
 * Send alerts via Telegram Bot
 * 
 * Setup Guide:
 * 1. Go to Telegram and search for @BotFather
 * 2. Send /newbot and follow instructions
 * 3. Copy bot token to TELEGRAM_BOT_TOKEN env variable
 * 4. User starts a chat with your bot and you get their chat_id
 */

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { chatId, topicId, type, data } = body;

    if (!chatId) {
      return NextResponse.json(
        { error: 'chatId is required' },
        { status: 400 }
      );
    }

    if (!type) {
      return NextResponse.json(
        { error: 'Notification type is required' },
        { status: 400 }
      );
    }

    let message: string;

    // Format message based on type
    switch (type) {
      case 'ledger_alert':
        message = formatHumanityLedgerTelegram(data);
        break;
      
      case 'price_alert':
        message = formatPriceAlertTelegram(data);
        break;
      
      case 'daily_digest':
        message = formatDailyDigestTelegram(data);
        break;
      
      case 'custom':
        message = data.message || 'Test notification from Humanity Ledger VIP';
        break;
      
      default:
        return NextResponse.json(
          { error: `Unknown notification type: ${type}` },
          { status: 400 }
        );
    }

    // Send via Telegram
    const success = await sendTelegramMessage({
      chatId,
      text: message,
      parseMode: 'HTML',
      threadId: topicId, // Pass topicId if present
    });

    if (!success) {
      return NextResponse.json(
        { error: 'Failed to send Telegram message' },
        { status: 500 }
      );
    }

    return NextResponse.json({
      success: true,
      message: 'Notification sent successfully',
      timestamp: new Date().toISOString(),
    });
  } catch (error: any) {
    console.error('Telegram notification error:', error);
    
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
 * Test endpoint - GET request sends a test message
 */
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const chatId = searchParams.get('chatId');
    const topicId = searchParams.get('topicId');

    if (!chatId) {
      return NextResponse.json({
        error: 'Provide chatId as query parameter',
        example: '/api/notifications/telegram?chatId=YOUR_CHAT_ID',
        setup: [
          '1. Talk to @BotFather on Telegram',
          '2. Create a new bot with /newbot',
          '3. Copy the bot token to TELEGRAM_BOT_TOKEN env',
          '4. Start a chat with your bot',
          '5. Get your chat_id from @userinfobot',
        ],
      }, { status: 400 });
    }

    const success = await sendTelegramMessage({
      chatId,
      text: `
 <b>Test Notification</b>

 Your Telegram alerts are working!

This is a test message from <b>Humanity Ledger VIP</b>.

You will now receive:
 Ledger movement alerts
 Price threshold notifications
 Daily portfolio digests

 ${new Date().toLocaleString()}
      `.trim(),
      parseMode: 'HTML',
      threadId: topicId || undefined,
    });

    if (!success) {
      return NextResponse.json(
        { error: 'Failed to send test message' },
        { status: 500 }
      );
    }

    return NextResponse.json({
      success: true,
      message: 'Test notification sent!',
      chatId,
    });
  } catch (error: any) {
    return NextResponse.json(
      {
        error: 'Test failed',
        details: 'Error details redacted',
      },
      { status: 500 }
    );
  }
}


