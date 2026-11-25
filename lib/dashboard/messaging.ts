'use client';

/**
 * lib/dashboard/messaging.ts — what the messaging database on this device says about the account,
 * opened only when the person asks (Dashboard → Messaging → Read). Everything is read from the
 * local XMTP database (OPFS) through the same client the chat uses: counts and identifiers, no
 * message content, no names of the people you talk to. Nothing is sent to our server; opening the
 * client talks to the XMTP network exactly as opening the chat does.
 */
import { getXMTPClient } from '@/lib/xmtp/client';

export interface MessagingStats {
  inboxId: string;
  installationId?: string;
  installations?: number;
  dms: number;
  groups: number;
  allowed: number;
  requests: number;
  denied: number;
  readAt: number;
}

type Signer = Parameters<typeof getXMTPClient>[0];

export async function readMessagingStats(signer: Signer): Promise<MessagingStats> {
  const client: any = await getXMTPClient(signer);
  const convs: any[] = (await client.conversations.list?.()) ?? [];
  let dms = 0;
  let groups = 0;
  let allowed = 0;
  let requests = 0;
  let denied = 0;
  for (const c of convs) {
    const isDm = typeof c.peerInboxId === 'function' || c.constructor?.name === 'Dm' || c.conversationType === 'dm';
    if (isDm) dms++;
    else groups++;
    let state: unknown;
    try {
      state = await c.consentState?.();
    } catch {
      state = undefined;
    }
    const s = String(state ?? '').toLowerCase();
    if (s.includes('allow') || s === '1') allowed++;
    else if (s.includes('deny') || s === '2') denied++;
    else requests++;
  }
  let installations: number | undefined;
  try {
    const st = await client.preferences?.inboxState?.(false);
    if (Array.isArray(st?.installations)) installations = st.installations.length;
  } catch {
    installations = undefined;
  }
  return {
    inboxId: String(client.inboxId ?? ''),
    installationId: client.installationId ? String(client.installationId) : undefined,
    installations,
    dms,
    groups,
    allowed,
    requests,
    denied,
    readAt: Date.now(),
  };
}
