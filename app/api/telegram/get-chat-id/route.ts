import { NextRequest, NextResponse } from 'next/server';

/**
 * Helper endpoint to get Telegram Chat ID
 * Visit: /api/telegram/get-chat-id to see recent chat updates
 * 
 * This helps users find their chat_id after starting a conversation with the bot
 */

const BOT_TOKEN = process.env.TELEGRAM_BOT_TOKEN;

export async function GET(request: NextRequest) {
  if (!BOT_TOKEN) {
    return NextResponse.json({
      error: 'Bot token not configured',
      setup: 'Add TELEGRAM_BOT_TOKEN to .env.local',
    }, { status: 500 });
  }

  try {
    // Get recent updates from Telegram
    const response = await fetch(
      `https://api.telegram.org/bot${BOT_TOKEN}/getUpdates`,
      { method: 'GET' }
    );

    if (!response.ok) {
      throw new Error('Failed to fetch updates from Telegram');
    }

    const data = await response.json();

    if (!data.ok) {
      throw new Error(data.description || 'Telegram API error');
    }

    // Extract chat IDs from updates
    const updates = data.result || [];
    const chats = updates
      .map((update: any) => {
        const message = update.message || update.edited_message;
        if (message?.chat) {
          return {
            chatId: message.chat.id,
            firstName: message.chat.first_name,
            username: message.chat.username,
            type: message.chat.type,
            lastMessage: message.text,
            date: new Date(message.date * 1000).toLocaleString(),
          };
        }
        return null;
      })
      .filter(Boolean);

    // Remove duplicates by chatId
    const uniqueChats = Array.from(
      new Map(chats.map((chat: any) => [chat.chatId, chat])).values()
    );

    return NextResponse.json({
      success: true,
      totalUpdates: updates.length,
      chats: uniqueChats,
      instructions: {
        step1: 'Open your bot in Telegram',
        step2: 'Send /start to your bot',
        step3: 'Refresh this page to see your chat ID',
        step4: 'Copy your chat ID and paste it in VIP  Notifications  Telegram',
      },
      botInfo: {
        token: `${BOT_TOKEN.slice(0, 10)}...${BOT_TOKEN.slice(-10)}`,
        configured: true,
      },
    });
  } catch (error: any) {
    console.error('Get Chat ID Error:', error);
    
    return NextResponse.json({
      error: 'Failed to get chat IDs',
      details: 'Error details redacted',
      instructions: 'Make sure you have sent /start to your bot first',
    }, { status: 500 });
  }
}

