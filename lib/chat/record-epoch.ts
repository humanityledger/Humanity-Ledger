/**
 * Reads the MLS epoch number and, when the installed SDK exposes it, the
 * MLS-Exporter output for Ledger Record.
 *
 * The browser SDK we ship (XMTP) can report the epoch number and can return
 * HMAC keys. Those HMAC keys are for a different job. They are not the epoch
 * secret, and this file never reads them. If the exporter is missing, this
 * returns null. A note can still be sealed inside the encrypted message.
 */
import { EXPORTER_LABEL, EXPORTER_LENGTH, exporterContextFor, type EpochSecret } from '@/vendor/ledger-record/src/index';
import { extractPeerAddress } from '@/lib/xmtp/client';

let provider: (() => Promise<EpochSecret | null>) | null = null;

/** The open chat registers how to read the current conversation's exporter secret. */
export function setRecordEpochProvider(fn: (() => Promise<EpochSecret | null>) | null): void {
  provider = fn;
}

export function requestRecordEpoch(): Promise<EpochSecret | null> {
  return provider ? provider() : Promise.resolve(null);
}

export class RecordEpochError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'RecordEpochError';
  }
}

type Exporter = (label: string, context: Uint8Array, length: number) => Promise<Uint8Array> | Uint8Array;

type ConversationLike = {
  id?: string;
  debugInfo?: () => Promise<{ epoch?: bigint }>;
  exportSecret?: Exporter;
  exporter?: Exporter;
  mlsExporter?: Exporter;
};

function exporterOf(conversation: ConversationLike): Exporter | null {
  if (typeof conversation.exportSecret === 'function') return conversation.exportSecret;
  if (typeof conversation.exporter === 'function') return conversation.exporter;
  if (typeof conversation.mlsExporter === 'function') return conversation.mlsExporter;
  return null;
}

export async function epochFromConversation(conversation: ConversationLike): Promise<EpochSecret | null> {
  if (!conversation.id || !conversation.debugInfo) {
    throw new RecordEpochError('This conversation has no MLS epoch to bind a record to.');
  }
  const conversationId = conversation.id;
  const info = await conversation.debugInfo();
  if (typeof info.epoch !== 'bigint' || info.epoch < 0n) {
    throw new RecordEpochError('This conversation did not report an MLS epoch.');
  }
  const fn = exporterOf(conversation);
  if (!fn) return null;
  const bytes = new Uint8Array(await fn.call(conversation, EXPORTER_LABEL, exporterContextFor(conversationId), EXPORTER_LENGTH));
  if (bytes.byteLength !== EXPORTER_LENGTH) {
    throw new RecordEpochError('The MLS exporter returned a secret of the wrong length.');
  }
  return {
    bytes,
    mlsEpoch: info.epoch.toString(10),
    conversationId: conversation.id,
    source: 'mls-exporter',
  };
}

type ClientLike = {
  inboxId?: string;
  conversations?: { listDms?: () => Promise<ConversationLike[]> ; sync?: () => Promise<void> };
};

/** The direct conversation with this address, or a clear failure. */
export async function epochForPeer(client: ClientLike, peer: string, selfAddress: string): Promise<EpochSecret | null> {
  const list = client.conversations?.listDms;
  if (!list) throw new RecordEpochError('Encrypted messaging is not ready on this device.');
  let dms = await list.call(client.conversations);
  let match: ConversationLike | undefined;
  for (const dm of dms) {
    const who = await extractPeerAddress(dm, client.inboxId || '', selfAddress);
    if (who && who.toLowerCase() === peer.toLowerCase()) { match = dm; break; }
  }
  if (!match && client.conversations?.sync) {
    await client.conversations.sync();
    dms = await list.call(client.conversations);
    for (const dm of dms) {
      const who = await extractPeerAddress(dm, client.inboxId || '', selfAddress);
      if (who && who.toLowerCase() === peer.toLowerCase()) { match = dm; break; }
    }
  }
  if (!match) throw new RecordEpochError('Start the encrypted conversation before sealing a record.');
  return epochFromConversation(match);
}
