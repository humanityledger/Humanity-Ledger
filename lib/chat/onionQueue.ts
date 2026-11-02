/**
 * Onion exit delivery: the last relay of an onion circuit hands the
 * decrypted message to this queue, from where the recipient's client picks
 * it up. The sender stays hidden: the relay is recorded as the sender.
 *
 * This used to be an HTTP endpoint (/api/chat/onion/queue) that the relay
 * called over the network. Any signed-in account could call it too and drop
 * messages into anyone's inbox, so it is now a function the relay calls in
 * process, and the endpoint is retired.
 */

import { getPrisma } from '@/lib/prisma';

const seen = new Map<string, number>();
const NONCE_TTL_MS = 10 * 60 * 1000;
const ADDRESS_RE = /^0x[a-f0-9]{40}$/;

export type OnionDeliveryResult = { ok: true } | { ok: false; status: number; error: string };

export async function enqueueOnionDelivery(input: { destination?: unknown; payload?: unknown; nonce?: unknown }): Promise<OnionDeliveryResult> {
  const destination = typeof input.destination === 'string' ? input.destination.trim().toLowerCase() : '';
  const nonce = typeof input.nonce === 'string' ? input.nonce : '';
  const content = typeof input.payload === 'string' ? input.payload.trim() : '';
  if (!ADDRESS_RE.test(destination) || !nonce || nonce.length > 128) {
    return { ok: false, status: 400, error: 'Missing or invalid destination or nonce.' };
  }
  if (!content || content.length > 8192) {
    return { ok: false, status: 400, error: 'Invalid payload size.' };
  }

  // Replay protection.
  const now = Date.now();
  for (const [k, t] of seen) if (now - t > NONCE_TTL_MS) seen.delete(k);
  if (seen.has(nonce)) return { ok: false, status: 409, error: 'Duplicate nonce: replay rejected.' };
  seen.set(nonce, now);

  try {
    await getPrisma().pendingChatMessage.create({
      data: { sender: 'onion-relay', recipient: destination, content },
    });
    return { ok: true };
  } catch (err: any) {
    console.error('[OnionQueue] DB write failed:', err?.message);
    return { ok: false, status: 500, error: 'Queue write failed.' };
  }
}
