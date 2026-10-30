import { NextRequest, NextResponse } from 'next/server';
import crypto from 'crypto';

// MoonPay Webhook Events
interface MoonPayWebhook {
  type: 'transaction_created' | 'transaction_updated' | 'transaction_completed' | 'transaction_failed';
  data: {
    id: string;
    status: string;
    walletAddress: string;
    cryptoCurrency: string;
    cryptoAmount: number;
    fiatCurrency: string;
    fiatAmount: number;
    txHash?: string;
    createdAt: string;
    updatedAt: string;
  };
}

/**
 * Verify MoonPay webhook signature
 */
function verifySignature(payload: string, signature: string, secret: string): boolean {
  if (!secret || secret.length < 16) {
    console.error('[MoonPay Webhook] Secret is missing or too short.');
    return false;
  }
  try {
    const hmac = crypto.createHmac('sha256', secret);
    hmac.update(payload);
    const computed = hmac.digest('hex');
    const hashProvided = crypto.createHash('sha256').update(signature).digest();
    const hashComputed = crypto.createHash('sha256').update(computed).digest();
    return crypto.timingSafeEqual(hashProvided, hashComputed);
  } catch (error) {
    console.error('[MoonPay Webhook] Signature verification failed:', error);
    return false;
  }
}

/**
 * Trigger portfolio refresh for a wallet address
 */
async function triggerPortfolioRefresh(walletAddress: string) {
  try {
    // Option 1: Invalidate cache in PortfolioService (if server-side cache exists)
    // For now, we'll rely on the SSE to push updates to connected clients
    
    // Option 2: Broadcast via SSE to connected clients
    await broadcastToSSE(walletAddress, {
      type: 'transaction.incoming',
      source: 'moonpay',
      timestamp: Date.now()
    });
    
    console.log(`[MoonPay Webhook] Portfolio refresh triggered for ${walletAddress}`);
  } catch (error) {
    console.error('[MoonPay Webhook] Failed to trigger refresh:', error);
  }
}

/**
 * Send event to SSE clients (we'll implement the SSE manager separately)
 */
async function broadcastToSSE(walletAddress: string, event: any) {
  // This will be connected to our SSE service
  // For now, we can use a simple in-memory event emitter
  if ((global as any).sseEmitter) {
    (global as any).sseEmitter.emit(`wallet:${walletAddress}`, event);
  }
}

/**
 * POST /api/webhooks/moonpay
 * Receives webhook notifications from MoonPay
 */
export async function POST(req: NextRequest) {
  try {
    // 1. Verify webhook secret
    const secret = process.env.MOONPAY_WEBHOOK_SECRET;
    if (!secret) {
      console.error('[MoonPay Webhook] MOONPAY_WEBHOOK_SECRET not configured');
      return NextResponse.json({ error: 'Webhook not configured' }, { status: 500 });
    }

    // 2. Get signature from headers
    const signature = req.headers.get('moonpay-signature') || req.headers.get('x-moonpay-signature') || '';
    if (!signature) {
      return NextResponse.json({ error: 'Missing signature' }, { status: 401 });
    }

    // 3. Get raw body
    const rawBody = await req.text();
    
    // 4. Verify signature
    if (!verifySignature(rawBody, signature, secret)) {
      console.warn('[MoonPay Webhook] Invalid signature');
      return NextResponse.json({ error: 'Invalid signature' }, { status: 401 });
    }

    // 5. Parse payload
    const webhook: MoonPayWebhook = JSON.parse(rawBody);
    console.log('[MoonPay Webhook] Received:', webhook.type, webhook.data.id);

    // 6. Process based on event type
    if (webhook.type === 'transaction_completed' && webhook.data.status === 'completed') {
      const { walletAddress, cryptoCurrency, cryptoAmount, txHash } = webhook.data;
      
      console.log(`[MoonPay Webhook] Transaction completed: +${cryptoAmount} ${cryptoCurrency} to ${walletAddress}`);
      
      // Trigger immediate portfolio refresh
      await triggerPortfolioRefresh(walletAddress);
      
      // Optionally: Store transaction in database for history
      // await prisma.transaction.create({ ... })
    }

    // 7. Return 200 to acknowledge receipt
    return NextResponse.json({ received: true, eventId: webhook.data.id });

  } catch (error) {
    console.error('[MoonPay Webhook] Error processing webhook:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

// Verify webhook configuration on GET
export async function GET(req: NextRequest) {
  const configured = !!process.env.MOONPAY_WEBHOOK_SECRET;
  return NextResponse.json({ 
    configured,
    endpoint: '/api/webhooks/moonpay',
    note: 'Configure this URL in your MoonPay dashboard'
  });
}

