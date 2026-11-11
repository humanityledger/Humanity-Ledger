import { NextRequest, NextResponse } from 'next/server';
import { callerSession } from '@/lib/auth/linkedSession';
import {
  answerRequest, createRequest, DEVICE_ID_RE, dropRequest, getRequest, listDevices, pendingRequests, removeDevice,
  REQUEST_ID_RE, touchDevice, type SignKind,
} from '@/lib/auth/linkedDevices';
import { QR_UUID_RE, qrEphKey, readKey } from '@/lib/security/qrLogin';
import { revokeFingerprint } from '@/lib/security/sessionRevocation';
import { checkRateLimit } from '@/lib/security/rateLimiter';
import { expireSessionCookies } from '@/lib/security/sessionCookies';

export const dynamic = 'force-dynamic';

/**
 * /api/auth/link — linked devices (WhatsApp Web / Signal Desktop model). See lib/auth/linkedDevices.ts.
 *
 * GET  ?uuid=<qr uuid>     phone: what is asking to be linked (label, when, expiry), for its approval screen
 * GET  ?devices=1          phone or computer: linked computers of this wallet ("current" marks the caller)
 * GET  ?pending=1          phone: signing requests from linked computers (ciphertext only)
 * GET  ?request=<id>       computer: the answer to one of its own requests
 * POST { action: 'request', kind, ciphertext, iv }       computer: ask the phone to sign
 * POST { action: 'answer', id, ciphertext, iv }          phone: the encrypted signature
 * POST { action: 'decline', id }                         phone: refused
 * POST { action: 'revoke', id }                          phone (any device) or the computer itself: unlink
 *
 * Payloads are AES-GCM ciphertext under a key only the two devices have; this route never
 * reads them. CSRF is enforced by the middleware for every POST.
 */
const B64_RE = /^[A-Za-z0-9+/=_-]{8,60000}$/;
const KINDS: SignKind[] = ['xmtp', 'aztec'];
const noStore = { headers: { 'Cache-Control': 'no-store' } };
const json = (status: number, body: unknown) => NextResponse.json(body, { status, ...noStore });

export async function GET(req: NextRequest) {
  const me = await callerSession(req);
  if (!me) return json(401, { error: 'NO_SESSION' });
  const q = req.nextUrl.searchParams;

  const uuid = q.get('uuid');
  if (uuid !== null) {
    if (me.deviceId) return json(403, { error: 'Link new devices from your phone.' });
    if (!QR_UUID_RE.test(uuid)) return json(400, { error: 'Invalid code' });
    const raw = await readKey(qrEphKey(uuid));
    if (!raw) return json(410, { error: 'This code has expired. Refresh it on the computer.' });
    try {
      const r = JSON.parse(raw);
      return json(200, { label: String(r.label || 'A computer'), createdAt: Number(r.createdAt) || null, expiresAt: Number(r.exp) || null });
    } catch {
      return json(410, { error: 'This code has expired. Refresh it on the computer.' });
    }
  }

  if (q.has('devices')) {
    if (me.deviceId && !(await touchDevice(me.wallet, me.deviceId))) return json(401, { error: 'UNLINKED' });
    const list = await listDevices(me.wallet);
    return json(200, {
      primary: !me.deviceId,
      devices: list.map(d => ({ id: d.id, label: d.label, createdAt: d.createdAt, lastSeenAt: d.lastSeenAt, expiresAt: d.expiresAt, current: d.id === me.deviceId })),
    });
  }

  if (q.has('pending')) {
    if (me.deviceId) return json(403, { error: 'Only your phone answers signing requests.' });
    const devices = await listDevices(me.wallet);
    const byId = new Map(devices.map(d => [d.id, d]));
    const list = (await pendingRequests(me.wallet)).filter(r => byId.has(r.deviceId));
    return json(200, {
      requests: list.map(r => ({ id: r.id, deviceId: r.deviceId, deviceLabel: byId.get(r.deviceId)!.label, kind: r.kind, ciphertext: r.ciphertext, iv: r.iv, createdAt: r.createdAt })),
    });
  }

  const id = q.get('request');
  if (id !== null) {
    if (!me.deviceId) return json(403, { error: 'Not a linked device.' });
    if (!REQUEST_ID_RE.test(id)) return json(400, { error: 'Invalid request' });
    const r = await getRequest(me.wallet, id);
    if (!r || r.deviceId !== me.deviceId) return json(404, { status: 'expired' });
    if (!r.answer) return json(200, { status: 'pending' });
    await dropRequest(me.wallet, id);
    if (r.answer.declined) return json(200, { status: 'declined' });
    return json(200, { status: 'answered', ciphertext: r.answer.ciphertext, iv: r.answer.iv });
  }

  return json(400, { error: 'Unknown query' });
}

export async function POST(req: NextRequest) {
  const me = await callerSession(req);
  if (!me) return json(401, { error: 'NO_SESSION' });
  const body = await req.json().catch(() => null);
  const action = body?.action;

  if (action === 'request') {
    if (!me.deviceId) return json(403, { error: 'Only a linked computer asks the phone to sign.' });
    if (!(await touchDevice(me.wallet, me.deviceId))) return json(401, { error: 'UNLINKED' });
    const rl = await checkRateLimit(`${me.wallet}:${me.deviceId}`, { max: 20, windowSec: 600, prefix: 'rl:link-req' });
    if (!rl.allowed) return json(429, { error: 'Too many signing requests. Wait a few minutes.' });
    const { kind, ciphertext, iv } = body;
    if (!KINDS.includes(kind) || typeof ciphertext !== 'string' || !B64_RE.test(ciphertext) || typeof iv !== 'string' || !B64_RE.test(iv)) {
      return json(400, { error: 'Invalid request' });
    }
    const r = await createRequest(me.wallet, { deviceId: me.deviceId, kind, ciphertext, iv });
    if (r === 'TOO_MANY') return json(429, { error: 'Your phone already has requests waiting. Answer them first.' });
    if (!r) return json(503, { error: 'Linked devices are unavailable right now. Try again in a minute.' });
    return json(200, { id: r.id });
  }

  if (action === 'answer' || action === 'decline') {
    if (me.deviceId) return json(403, { error: 'Only your phone answers signing requests.' });
    const { id, ciphertext, iv } = body;
    if (typeof id !== 'string' || !REQUEST_ID_RE.test(id)) return json(400, { error: 'Invalid request' });
    if (action === 'answer' && (typeof ciphertext !== 'string' || !B64_RE.test(ciphertext) || typeof iv !== 'string' || !B64_RE.test(iv))) {
      return json(400, { error: 'Invalid answer' });
    }
    const res = await answerRequest(me.wallet, id, action === 'decline' ? { declined: true, at: Date.now() } : { ciphertext, iv, at: Date.now() });
    if (res === 'GONE') return json(410, { error: 'This request has expired.' });
    if (res === 'ANSWERED') return json(409, { error: 'Already answered.' });
    return json(200, { ok: true });
  }

  if (action === 'revoke') {
    const id = body?.id;
    if (typeof id !== 'string' || !DEVICE_ID_RE.test(id)) return json(400, { error: 'Invalid device' });
    // The phone may unlink any computer; a computer only itself ("Sign out of this computer").
    if (me.deviceId && me.deviceId !== id) return json(403, { error: 'Unlink other devices from your phone.' });
    const d = await removeDevice(me.wallet, id);
    if (d) await revokeFingerprint(d.tokenFp, (d.expiresAt - Date.now()) / 1000);
    const res = json(200, { ok: true, removed: !!d });
    if (me.deviceId === id) expireSessionCookies(res, req.headers.get('host'));
    return res;
  }

  return json(400, { error: 'Unknown action' });
}
