import { NextRequest, NextResponse } from 'next/server';
import crypto from 'crypto';

export async function POST(req: NextRequest) {
  try {
    const { walletAddress, baseCurrencyAmount, baseCurrencyCode, currencyCode, redirectURL } = await req.json();

    if (!walletAddress || !baseCurrencyAmount || !currencyCode) {
      return NextResponse.json({ error: 'Missing required parameters' }, { status: 400 });
    }

    // [SECURITY HARDENING] Use server-side env vars ONLY.
    // NEXT_PUBLIC_MOONPAY_KEY is visible in the browser bundle and MUST NOT be used
    // as a cryptographic signing key. Only private server-side vars are safe.
    // Also removed the dangerous fallback to STRIPE_SECRET_KEY which would cross-contaminate secrets.
    const apiKey = process.env.MOONPAY_API_KEY || '';
    const secretKey = process.env.MOONPAY_SECRET_KEY || '';

    if (!apiKey) {
      return NextResponse.json(
        { error: 'MoonPay API key not configured. Set MOONPAY_API_KEY in Railway environment variables.' },
        { status: 500 }
      );
    }

    // Use sandbox URL for test keys (pk_test_...), production URL for live keys (pk_live_...)
    const isSandbox = apiKey.startsWith('pk_test_');
    const baseUrl = isSandbox ? 'https://buy-sandbox.moonpay.com' : 'https://buy.moonpay.com';

    const params = new URLSearchParams({
      apiKey,
      currencyCode: currencyCode.toLowerCase(),
      baseCurrencyCode: (baseCurrencyCode || 'usd').toLowerCase(),
      baseCurrencyAmount: baseCurrencyAmount.toString(),
      walletAddress,
      theme: 'light',
    });

    // colorCode must NOT contain '#' in the URLSearchParams value
    // MoonPay expects it as %23FFFFFF not %2523FFFFFF
    params.append('colorCode', encodeURIComponent('#FFFFFF'));

    if (redirectURL) {
      params.append('redirectURL', redirectURL);
    }

    const queryString = `?${params.toString()}`;
    const urlToSign = `${baseUrl}${queryString}`;

    // Fail closed: a live key needs a signed URL, or the wallet address in it could be swapped.
    // Only the sandbox accepts an unsigned URL.
    if (!secretKey) {
      if (!isSandbox) {
        return NextResponse.json({ error: 'MoonPay signing is not configured (MOONPAY_SECRET_KEY).' }, { status: 503 });
      }
      return NextResponse.json({ url: urlToSign, sandbox: true });
    }

    // HMAC SHA256 — MoonPay signs only the query string portion (including the leading '?')
    const signature = crypto
      .createHmac('sha256', secretKey)
      .update(queryString)
      .digest('base64');

    const signedUrl = `${urlToSign}&signature=${encodeURIComponent(signature)}`;

    return NextResponse.json({ url: signedUrl, sandbox: isSandbox });
  } catch (error: any) {
    console.error('[MoonPay API] Signature generation failed:', error);
    return NextResponse.json({ error: 'Signature generation failed.' }, { status: 500 });
  }
}
