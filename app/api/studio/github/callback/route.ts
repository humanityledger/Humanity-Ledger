import { NextRequest, NextResponse } from 'next/server';
import { requireWallet } from '@/lib/security/requireWallet';
import { appOrigin, exchangeCode, githubOAuthConfig, keepToken, takeState } from '@/lib/studio/github-oauth';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/** A static page for the popup: no scripts, nothing from the network. */
function page(ok: boolean, status = 200) {
  const title = ok ? 'GitHub connected' : 'GitHub sign-in failed';
  const body = ok
    ? 'GitHub is connected to Ledger Studio. You can close this window. / GitHub está conectado a Ledger Studio. Puedes cerrar esta ventana.'
    : 'The sign-in did not finish. Close this window and try again. / El inicio de sesión no terminó. Cierra esta ventana e inténtalo de nuevo.';
  return new NextResponse(
    `<!doctype html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>${title}</title>` +
    `<style>body{font-family:system-ui,-apple-system,sans-serif;margin:0;min-height:100vh;display:grid;place-items:center;background:#f7f8fa;color:#15171c}main{max-width:420px;padding:32px;text-align:center}h1{font-size:18px}p{color:#4a505c;line-height:1.5}</style></head>` +
    `<body><main><h1>${title}</h1><p>${body}</p></main></body></html>`,
    {
      status,
      headers: {
        'Content-Type': 'text/html; charset=utf-8',
        'Cache-Control': 'no-store',
        'Content-Security-Policy': "default-src 'none'; style-src 'unsafe-inline'; base-uri 'none'; form-action 'none'; frame-ancestors 'none'",
        'Referrer-Policy': 'no-referrer',
      },
    },
  );
}

/** GET /api/studio/github/callback?code&state — GitHub sends the popup here. */
export async function GET(req: NextRequest) {
  if (!githubOAuthConfig()) return page(false, 404);
  const auth = await requireWallet(req);
  if (auth.errorResponse) return page(false, 401);
  const url = new URL(req.url);
  const state = url.searchParams.get('state') ?? '';
  const code = url.searchParams.get('code') ?? '';
  // The state is single use and must belong to this wallet.
  const owner = await takeState(state);
  if (!owner || owner !== auth.walletAddress.toLowerCase() || !code) return page(false, 400);
  const token = await exchangeCode(code, `${appOrigin(req.url)}/api/studio/github/callback`);
  if (!token) return page(false, 502);
  await keepToken(state, auth.walletAddress, token);
  return page(true);
}
