/**
 * Ledger Record v1.
 *
 * A record is a sealed object addressed to a set of members. The chat message
 * carries a pointer. The bytes of the object are ciphertext. This file does
 * not fetch, does not store, and does not move money.
 *
 * The pointer rides inside a conversation that Ledger Chat already encrypts
 * (MLS). That is what keeps the record key between those people. The epoch
 * names the set the sealer committed to, and the head binds the epoch, the
 * digest and the previous version. A new member does not receive older keys:
 * someone who still has the plaintext seals a new version for the new set.
 */

import { aesOpen, aesSeal, fromHex, hexEqual, randomBytes, sha256Hex, toHex, utf8, utf8Decode } from './hex';

export const RECORD_TYPE = 'ledger.record';
export const RECORD_VERSION = 1 as const;
export const RECORD_SCHEME = 'aes-256-gcm';

export const ZERO_HEAD = '0'.repeat(64);
export const MAX_MEMBERS = 256;
export const MAX_LABEL = 80;
export const MAX_NOTE_BYTES = 8 * 1024;
export const MAX_FILE_BYTES = 20 * 1024 * 1024;
export const MAX_GENERATION = 1_000_000;
export const MAX_MESSAGE_CHARS = 48_000;

const MEMBER_RE = /^[A-Za-z0-9][A-Za-z0-9_.:@+\-]{0,199}$/;
const HEX32 = /^[0-9a-f]{32}$/;
const HEX24 = /^[0-9a-f]{24}$/;
const HEX64 = /^[0-9a-f]{64}$/;
const LABEL_RE = /^[^\u0000-\u001f\u007f]{1,80}$/;
const FILE_URL_RE = /^\/api\/chat\/attachments\/[0-9a-f]{32}$/;
const EVM_RE = /^0x[0-9a-f]{40}$/;

export type RecordKind = 'note' | 'file' | 'handoff';
export type HandoffAction = 'pay' | 'agreement';

export interface RecordPointer {
  type: typeof RECORD_TYPE;
  v: typeof RECORD_VERSION;
  id: string;
  kind: RecordKind;
  generation: number;
  epoch: string;
  head: string;
  prev: string;
  scheme: typeof RECORD_SCHEME;
  key: string;
  nonce: string;
  digest: string;
  bytes: number;
  label: string;
  inline?: string;
  url?: string;
  action?: HandoffAction;
  peer?: string;
}

export interface OpenedRecord {
  pointer: RecordPointer;
  plain: Uint8Array;
  text: string | null;
  handoff: { action: HandoffAction; peer: string } | null;
}

export class RecordError extends Error {
  constructor(readonly code: string, message: string) {
    super(message);
    this.name = 'RecordError';
  }
}

const KINDS: readonly RecordKind[] = ['note', 'file', 'handoff'];
const ACTIONS: readonly HandoffAction[] = ['pay', 'agreement'];

/** Sorted, unique member ids. Rejects an empty set, duplicates and odd characters. */
export function normalizeMembers(members: readonly string[]): string[] {
  if (!Array.isArray(members) || members.length === 0 || members.length > MAX_MEMBERS) {
    throw new RecordError('members', 'A record names between 1 and 256 members');
  }
  const ids = members.map((member) => {
    if (typeof member !== 'string' || !MEMBER_RE.test(member)) {
      throw new RecordError('members', 'A member id is not usable');
    }
    return member;
  });
  const sorted = [...ids].sort();
  for (let i = 1; i < sorted.length; i++) {
    if (sorted[i] === sorted[i - 1]) throw new RecordError('members', 'A member is listed twice');
  }
  return sorted;
}

export async function membershipEpoch(members: readonly string[]): Promise<string> {
  return sha256Hex(utf8(normalizeMembers(members).join('\n')));
}

export function handoffBody(action: HandoffAction, peer: string): Uint8Array {
  if (!ACTIONS.includes(action) || !EVM_RE.test(peer)) {
    throw new RecordError('handoff', 'A handoff names a payment or an agreement, and one address');
  }
  return utf8(`{"action":"${action}","peer":"${peer.toLowerCase()}"}`);
}

function assertLabel(label: string): string {
  const trimmed = label.trim();
  if (!LABEL_RE.test(trimmed) || trimmed.length > MAX_LABEL) {
    throw new RecordError('label', 'The label is empty or too long');
  }
  return trimmed;
}

/** The hash of one version. The URL is not inside it: storage can move, the bytes cannot. */
export async function versionHead(fields: {
  id: string;
  generation: number;
  epoch: string;
  prev: string;
  digest: string;
  bytes: number;
  kind: RecordKind;
  label: string;
}): Promise<string> {
  const lines = [
    'ledger.record/1',
    fields.id,
    String(fields.generation),
    fields.epoch,
    fields.prev,
    fields.digest,
    String(fields.bytes),
    fields.kind,
    fields.label,
  ];
  return sha256Hex(utf8(lines.join('\n')));
}

export interface SealedBody {
  ciphertext: Uint8Array;
  key: string;
  nonce: string;
  digest: string;
}

/** Fresh key, fresh nonce. The ciphertext is AES-256-GCM, tag included. */
export async function encryptBody(plain: Uint8Array): Promise<SealedBody> {
  if (!(plain instanceof Uint8Array) || plain.byteLength === 0) {
    throw new RecordError('plain', 'A record body is not empty');
  }
  if (plain.byteLength > MAX_FILE_BYTES) throw new RecordError('plain', 'A record body is at most 20 MB');
  const key = randomBytes(32);
  const nonce = randomBytes(12);
  const ciphertext = await aesSeal(key, nonce, plain);
  return { ciphertext, key: toHex(key), nonce: toHex(nonce), digest: await sha256Hex(ciphertext) };
}

export interface BuildPointerInput {
  kind: RecordKind;
  label: string;
  members: readonly string[];
  plain: Uint8Array;
  sealed: SealedBody;
  /** Ciphertext hex, for a note or a handoff. A file leaves this empty and sets url. */
  inline?: string;
  url?: string;
  action?: HandoffAction;
  peer?: string;
  /** The version this one follows. Omitted for the first version. */
  previous?: Pick<RecordPointer, 'id' | 'head' | 'generation'>;
}

export async function buildPointer(input: BuildPointerInput): Promise<RecordPointer> {
  const label = assertLabel(input.label);
  if (!KINDS.includes(input.kind)) throw new RecordError('kind', 'Unknown record kind');
  const epoch = await membershipEpoch(input.members);
  const generation = input.previous ? input.previous.generation + 1 : 1;
  if (!Number.isInteger(generation) || generation < 1 || generation > MAX_GENERATION) {
    throw new RecordError('generation', 'The version number is out of range');
  }
  const id = input.previous ? input.previous.id : toHex(randomBytes(16));
  const prev = input.previous ? input.previous.head : ZERO_HEAD;
  if (!HEX32.test(id) || !HEX64.test(prev)) throw new RecordError('link', 'The previous version is not a record');

  const hasInline = typeof input.inline === 'string';
  const hasUrl = typeof input.url === 'string';
  if (hasInline === hasUrl) throw new RecordError('body', 'A record carries its ciphertext inline or at one storage path');

  if (input.kind === 'file') {
    if (!hasUrl || !FILE_URL_RE.test(input.url!)) throw new RecordError('url', 'A file record points at Ledger storage');
    if (input.plain.byteLength > MAX_FILE_BYTES) throw new RecordError('plain', 'A file record is at most 20 MB');
  } else {
    if (!hasInline) throw new RecordError('body', 'A note or a handoff stays inside the conversation');
    if (input.plain.byteLength > MAX_NOTE_BYTES) throw new RecordError('plain', 'An inline record is at most 8 KB');
    if (toHex(input.sealed.ciphertext) !== input.inline) throw new RecordError('body', 'The inline ciphertext does not match');
  }

  if (input.kind === 'handoff') {
    if (!input.action || !input.peer) throw new RecordError('handoff', 'A handoff names an action and an address');
    const expected = handoffBody(input.action, input.peer);
    if (expected.byteLength !== input.plain.byteLength || !bytesEqual(expected, input.plain)) {
      throw new RecordError('handoff', 'The handoff body does not match its action');
    }
  } else if (input.action || input.peer) {
    throw new RecordError('handoff', 'Only a handoff record names an action');
  }

  if (input.sealed.digest !== await sha256Hex(input.sealed.ciphertext)) {
    throw new RecordError('digest', 'The ciphertext does not match its digest');
  }

  const digest = input.sealed.digest;
  const head = await versionHead({
    id, generation, epoch, prev, digest, bytes: input.plain.byteLength, kind: input.kind, label,
  });

  const pointer: RecordPointer = {
    type: RECORD_TYPE,
    v: RECORD_VERSION,
    id,
    kind: input.kind,
    generation,
    epoch,
    head,
    prev,
    scheme: RECORD_SCHEME,
    key: input.sealed.key,
    nonce: input.sealed.nonce,
    digest,
    bytes: input.plain.byteLength,
    label,
  };
  if (hasInline) pointer.inline = input.inline;
  if (hasUrl) pointer.url = input.url;
  if (input.kind === 'handoff') {
    pointer.action = input.action;
    pointer.peer = input.peer!.toLowerCase();
  }
  return pointer;
}

function bytesEqual(a: Uint8Array, b: Uint8Array): boolean {
  if (a.byteLength !== b.byteLength) return false;
  let diff = 0;
  for (let i = 0; i < a.byteLength; i++) diff |= a[i] ^ b[i];
  return diff === 0;
}

const FIELD_ORDER = [
  'type', 'v', 'id', 'kind', 'generation', 'epoch', 'head', 'prev', 'scheme',
  'key', 'nonce', 'digest', 'bytes', 'label', 'inline', 'url', 'action', 'peer',
] as const;

export function encodeRecordMessage(pointer: RecordPointer): string {
  const body: Record<string, string | number> = {};
  for (const key of FIELD_ORDER) {
    const value = pointer[key];
    if (value !== undefined) body[key] = value;
  }
  const message = JSON.stringify(body);
  if (message.length > MAX_MESSAGE_CHARS) throw new RecordError('message', 'The record message is too large');
  return message;
}

export async function sealNote(args: {
  text: string;
  members: readonly string[];
  label?: string;
  previous?: Pick<RecordPointer, 'id' | 'head' | 'generation'>;
}): Promise<RecordPointer> {
  if (typeof args.text !== 'string' || args.text.length === 0) throw new RecordError('plain', 'The note is empty');
  const plain = utf8(args.text);
  if (plain.byteLength > MAX_NOTE_BYTES) throw new RecordError('plain', 'An inline record is at most 8 KB');
  const sealed = await encryptBody(plain);
  return buildPointer({
    kind: 'note',
    label: args.label ?? 'Note',
    members: args.members,
    plain,
    sealed,
    inline: toHex(sealed.ciphertext),
    previous: args.previous,
  });
}

export async function sealHandoff(args: {
  action: HandoffAction;
  peer: string;
  members: readonly string[];
  previous?: Pick<RecordPointer, 'id' | 'head' | 'generation'>;
}): Promise<RecordPointer> {
  const peer = args.peer.toLowerCase();
  const plain = handoffBody(args.action, peer);
  const sealed = await encryptBody(plain);
  return buildPointer({
    kind: 'handoff',
    label: args.action === 'pay' ? 'Private payment' : 'Private agreement',
    members: args.members,
    plain,
    sealed,
    inline: toHex(sealed.ciphertext),
    action: args.action,
    peer,
    previous: args.previous,
  });
}

/**
 * Encrypt a file. The caller uploads `ciphertext` and then calls buildPointer
 * with the storage path. The digest the server returns must equal `digest`.
 */
export async function sealFileBody(bytes: Uint8Array): Promise<SealedBody> {
  if (bytes.byteLength > MAX_FILE_BYTES) throw new RecordError('plain', 'A file record is at most 20 MB');
  return encryptBody(bytes);
}

/** Words safe to show in a list, a notification or a copy. Never the key. */
export function recordPreview(pointer: Pick<RecordPointer, 'kind' | 'label' | 'action'> | null): string {
  if (!pointer) return 'Record';
  if (pointer.kind === 'handoff') return pointer.action === 'agreement' ? 'Private agreement' : 'Private payment';
  if (pointer.kind === 'file') return pointer.label ? `File: ${pointer.label}` : 'Sealed file';
  return pointer.label && pointer.label !== 'Note' ? pointer.label : 'Sealed note';
}

export function isRecordMessage(content: unknown): boolean {
  return parseRecordMessage(content) !== null;
}

/** The pointer, or null. Never throws. A message that fails here is not a record. */
export function parseRecordMessage(content: unknown): RecordPointer | null {
  if (typeof content !== 'string' || content.length === 0 || content.length > MAX_MESSAGE_CHARS) return null;
  const text = content.trim();
  if (!text.startsWith('{"type":"ledger.record"')) return null;
  let value: unknown;
  try {
    value = JSON.parse(text);
  } catch {
    return null;
  }
  if (!value || typeof value !== 'object' || Array.isArray(value)) return null;
  const row = value as Record<string, unknown>;
  for (const key of Object.keys(row)) {
    if (!(FIELD_ORDER as readonly string[]).includes(key)) return null;
  }
  if (row.type !== RECORD_TYPE || row.v !== 1 || row.scheme !== RECORD_SCHEME) return null;
  if (typeof row.kind !== 'string' || !(KINDS as readonly string[]).includes(row.kind)) return null;
  if (typeof row.id !== 'string' || !HEX32.test(row.id)) return null;
  if (typeof row.generation !== 'number' || !Number.isInteger(row.generation) || row.generation < 1 || row.generation > MAX_GENERATION) return null;
  for (const key of ['epoch', 'head', 'prev', 'key', 'digest'] as const) {
    if (typeof row[key] !== 'string' || !HEX64.test(row[key] as string)) return null;
  }
  if (typeof row.nonce !== 'string' || !HEX24.test(row.nonce)) return null;
  if (typeof row.bytes !== 'number' || !Number.isInteger(row.bytes) || row.bytes < 1 || row.bytes > MAX_FILE_BYTES) return null;
  if (typeof row.label !== 'string' || !LABEL_RE.test(row.label)) return null;

  const inline = row.inline;
  const url = row.url;
  const hasInline = typeof inline === 'string';
  const hasUrl = typeof url === 'string';
  if (hasInline === hasUrl) return null;
  if (hasInline && !HEX.test(inline as string)) return null;
  if (hasUrl && !FILE_URL_RE.test(url as string)) return null;

  const kind = row.kind as RecordKind;
  if (kind === 'file' && !hasUrl) return null;
  if (kind !== 'file' && !hasInline) return null;
  if (kind !== 'file' && row.bytes > MAX_NOTE_BYTES) return null;

  let action: HandoffAction | undefined;
  let peer: string | undefined;
  if (kind === 'handoff') {
    if (typeof row.action !== 'string' || !(ACTIONS as readonly string[]).includes(row.action)) return null;
    if (typeof row.peer !== 'string' || !EVM_RE.test(row.peer)) return null;
    action = row.action as HandoffAction;
    peer = row.peer;
  } else if (row.action !== undefined || row.peer !== undefined) {
    return null;
  }

  const pointer: RecordPointer = {
    type: RECORD_TYPE,
    v: 1,
    id: row.id,
    kind,
    generation: row.generation,
    epoch: row.epoch as string,
    head: row.head as string,
    prev: row.prev as string,
    scheme: RECORD_SCHEME,
    key: row.key as string,
    nonce: row.nonce,
    digest: row.digest as string,
    bytes: row.bytes,
    label: row.label,
  };
  if (hasInline) pointer.inline = inline as string;
  if (hasUrl) pointer.url = url as string;
  if (action && peer) {
    pointer.action = action;
    pointer.peer = peer;
  }
  return pointer;
}

/**
 * Check the epoch, the head and the digest, then decrypt.
 * `ciphertext` is required for a file. A note or a handoff reads `inline`.
 */
export async function openRecord(
  raw: string | RecordPointer,
  members: readonly string[],
  ciphertext?: Uint8Array,
): Promise<OpenedRecord> {
  const pointer = typeof raw === 'string' ? parseRecordMessage(raw) : raw;
  if (!pointer) throw new RecordError('message', 'This is not a record');

  const epoch = await membershipEpoch(members);
  if (!hexEqual(epoch, pointer.epoch)) throw new RecordError('epoch', 'This record was sealed for a different set of people');

  const head = await versionHead(pointer);
  if (!hexEqual(head, pointer.head)) throw new RecordError('head', 'This record was altered');

  let cipher = ciphertext;
  if (pointer.inline) {
    if (ciphertext) throw new RecordError('body', 'An inline record carries its own ciphertext');
    try {
      cipher = fromHex(pointer.inline);
    } catch {
      throw new RecordError('body', 'The ciphertext is not valid');
    }
  }
  if (!cipher) throw new RecordError('body', 'The ciphertext is missing');

  const digest = await sha256Hex(cipher);
  if (!hexEqual(digest, pointer.digest)) throw new RecordError('digest', 'The ciphertext does not match its digest');

  let plain: Uint8Array;
  try {
    plain = await aesOpen(fromHex(pointer.key), fromHex(pointer.nonce), cipher);
  } catch {
    throw new RecordError('decrypt', 'The record could not be opened');
  }
  if (plain.byteLength !== pointer.bytes) throw new RecordError('bytes', 'The record length does not match');

  if (pointer.kind === 'handoff') {
    const expected = handoffBody(pointer.action!, pointer.peer!);
    if (!bytesEqual(plain, expected)) throw new RecordError('handoff', 'The handoff body does not match its action');
    return {
      pointer,
      plain,
      text: null,
      handoff: { action: pointer.action!, peer: pointer.peer! },
    };
  }

  let text: string | null = null;
  if (pointer.kind === 'note') {
    try {
      text = utf8Decode(plain);
    } catch {
      throw new RecordError('text', 'The note is not text');
    }
  }
  return { pointer, plain, text, handoff: null };
}

/** Each version must follow the previous head, with the same id and the next number. */
export async function verifyChain(messages: readonly string[]): Promise<boolean> {
  if (messages.length === 0) return false;
  let previous: RecordPointer | null = null;
  for (const message of messages) {
    const pointer = parseRecordMessage(message);
    if (!pointer) return false;
    const head = await versionHead(pointer);
    if (!hexEqual(head, pointer.head)) return false;
    if (!previous) {
      if (pointer.generation !== 1 || pointer.prev !== ZERO_HEAD) return false;
    } else if (
      pointer.id !== previous.id
      || pointer.generation !== previous.generation + 1
      || pointer.prev !== previous.head
    ) {
      return false;
    }
    previous = pointer;
  }
  return true;
}

const HEX = /^[0-9a-f]+$/;
