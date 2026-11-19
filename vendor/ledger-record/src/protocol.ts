/**
 * Ledger Record v2.
 *
 * The content key is random and is wrapped under a key derived from the MLS
 * exporter secret of one epoch. The pointer does not carry that content key.
 * A later epoch does not unwrap an earlier record. A member who already
 * unwrapped it can keep the content key in the local store; wiping that store
 * does not remove the key from anyone else's device.
 *
 * This file does not fetch, does not talk to a network, and does not move money.
 * It refuses any epoch secret that is not declared as the MLS exporter output.
 */

import { aadHashHex, recordAad, recordHeadLines, versionHeadV2, type RecordKind } from './bind';
import { aesOpen, aesSeal, fromHex, hexEqual, randomBytes, sha256Hex, toHex, utf8, utf8Decode, zeroize } from './hex';
import { hkdfSha256 } from './kdf';
import { Sha256 } from './sha256';

export const RECORD_TYPE = 'ledger.record';
export const RECORD_VERSION = 2 as const;
export const RECORD_SCHEME = 'aes-256-gcm-hkdf-epoch-v2';
export const CHUNK_PLAINTEXT = 64 * 1024;
export const EXPORTER_LABEL = 'ledger-record';
export const EXPORTER_CONTEXT = 'ledger-record/v2';
export const EXPORTER_LENGTH = 32;

export const ZERO_HEAD = '0'.repeat(64);
export const MAX_MEMBERS = 256;
export const MAX_LABEL = 80;
export const MAX_NOTE_BYTES = 8 * 1024;
export const MAX_FILE_BYTES = 20 * 1024 * 1024;
export const MAX_GENERATION = 1_000_000;
export const MAX_MESSAGE_CHARS = 48_000;
export const MAX_CONVERSATION_ID = 128;

const MEMBER_RE = /^[A-Za-z0-9][A-Za-z0-9_.:@+\-]{0,199}$/;
const HEX32 = /^[0-9a-f]{32}$/;
const HEX24 = /^[0-9a-f]{24}$/;
const HEX64 = /^[0-9a-f]{64}$/;
const LABEL_RE = /^[^\u0000-\u001f\u007f]{1,80}$/;
const FILE_URL_RE = /^\/api\/chat\/attachments\/[0-9a-f]{32}$/;
const EVM_RE = /^0x[0-9a-f]{40}$/;
const EPOCH_RE = /^(0|[1-9][0-9]{0,20})$/;
const CONV_RE = /^[A-Za-z0-9][A-Za-z0-9_.:@+\-]{0,127}$/;

export type { RecordKind };
export type HandoffAction = 'pay' | 'agreement';

/** 32-byte MLS-Exporter output for this epoch. HMAC keys are not accepted. */
export interface EpochSecret {
  bytes: Uint8Array;
  mlsEpoch: string;
  conversationId: string;
  source: 'mls-exporter';
}

export interface RecordPointer {
  type: typeof RECORD_TYPE;
  v: typeof RECORD_VERSION;
  id: string;
  kind: RecordKind;
  generation: number;
  conversationId: string;
  mlsEpoch: string;
  epoch: string;
  head: string;
  prev: string;
  scheme: typeof RECORD_SCHEME;
  wrap: string;
  wrapNonce: string;
  nonce: string;
  digest: string;
  bytes: number;
  chunks: number;
  label: string;
  aad: string;
  inline?: string;
  url?: string;
  action?: HandoffAction;
  peer?: string;
  commitment?: string;
  installation: string;
  bodyGen?: number;
  /** Set only when this version rewraps an older ciphertext. Content AAD uses these, not the wrap fields. */
  bodyEpoch?: string;
  bodyInstallation?: string;
  bodyPrev?: string;
}

export interface OpenedRecord {
  pointer: RecordPointer;
  plain: Uint8Array;
  text: string | null;
  handoff: { action: HandoffAction; peer: string; commitment: string } | null;
  /** Content key. The caller stores it locally and must zeroize it. */
  contentKey: Uint8Array;
}

export interface SealedRecord {
  pointer: RecordPointer;
  message: string;
  contentKey: Uint8Array;
  ciphertext: Uint8Array;
  timings: { encryptMs: number; chunks: number; bytes: number; chunkBytes: number };
}

export class RecordError extends Error {
  constructor(readonly code: string, message: string) {
    super(message);
    this.name = 'RecordError';
  }
}

const KINDS: readonly RecordKind[] = ['note', 'file', 'handoff'];
const ACTIONS: readonly HandoffAction[] = ['pay', 'agreement'];
const FIELD_ORDER = [
  'type', 'v', 'id', 'kind', 'generation', 'conversationId', 'mlsEpoch', 'epoch', 'head', 'prev',
  'scheme', 'wrap', 'wrapNonce', 'nonce', 'digest', 'bytes', 'chunks', 'label', 'aad',
  'inline', 'url', 'action', 'peer', 'commitment', 'installation', 'bodyGen',
  'bodyEpoch', 'bodyInstallation', 'bodyPrev',
] as const;

const INSTALL_RE = /^[A-Za-z0-9_\-]{0,128}$/;

export function assertEpochSecret(secret: EpochSecret): void {
  if (!secret || secret.source !== 'mls-exporter') {
    throw new RecordError('epoch', 'The epoch secret must be the MLS exporter output');
  }
  if (!(secret.bytes instanceof Uint8Array) || secret.bytes.byteLength !== 32) {
    throw new RecordError('epoch', 'The exporter output must be 32 bytes');
  }
  if (!EPOCH_RE.test(secret.mlsEpoch)) throw new RecordError('epoch', 'The MLS epoch number is not usable');
  if (!CONV_RE.test(secret.conversationId)) throw new RecordError('conversation', 'The conversation id is not usable');
}

export function normalizeMembers(members: readonly string[]): string[] {
  if (!Array.isArray(members) || members.length === 0 || members.length > MAX_MEMBERS) {
    throw new RecordError('members', 'A record names between 1 and 256 members');
  }
  const sorted = members.map((member) => {
    if (typeof member !== 'string' || !MEMBER_RE.test(member)) throw new RecordError('members', 'A member id is not usable');
    return member;
  }).sort();
  for (let i = 1; i < sorted.length; i++) {
    if (sorted[i] === sorted[i - 1]) throw new RecordError('members', 'A member is listed twice');
  }
  return sorted;
}

export async function membershipEpoch(members: readonly string[]): Promise<string> {
  return sha256Hex(utf8(normalizeMembers(members).join('\n')));
}

export function exporterContextFor(conversationId: string): Uint8Array {
  if (!CONV_RE.test(conversationId)) throw new RecordError('conversation', 'The conversation id is not usable');
  return utf8(`${EXPORTER_CONTEXT}\0${conversationId}`);
}

export function handoffBody(args: {
  action: HandoffAction;
  peer: string;
  commitment?: string;
  conversationId: string;
  mlsEpoch: string;
}): Uint8Array {
  const commitment = args.commitment ?? ZERO_HEAD;
  const peer = args.peer.toLowerCase();
  if (!ACTIONS.includes(args.action) || !EVM_RE.test(peer)) {
    throw new RecordError('handoff', 'A handoff names a payment or an agreement, and one address');
  }
  if (!HEX64.test(commitment)) throw new RecordError('handoff', 'The commitment must be 32 bytes');
  if (!CONV_RE.test(args.conversationId) || !EPOCH_RE.test(args.mlsEpoch)) {
    throw new RecordError('handoff', 'A handoff is bound to one conversation and one epoch');
  }
  return utf8(`{"action":"${args.action}","commitment":"${commitment}","conversation":"${args.conversationId}","epoch":"${args.mlsEpoch}","peer":"${peer}"}`);
}

function installationOf(value: string | undefined): string {
  const installation = value ?? '';
  if (!INSTALL_RE.test(installation)) throw new RecordError('installation', 'The installation id is not usable');
  return installation;
}

function assertLabel(label: string): string {
  const trimmed = label.trim();
  if (!LABEL_RE.test(trimmed)) throw new RecordError('label', 'The label is empty or too long');
  return trimmed;
}

async function kekFor(secret: EpochSecret, membership: string, kind: RecordKind): Promise<Uint8Array> {
  assertEpochSecret(secret);
  const salt = fromHex(await sha256Hex(utf8(`ledger-record/v2\0${secret.conversationId}\0${secret.mlsEpoch}`)));
  const info = `ledger-record/v2/kek\0${membership}\0${kind}`;
  return hkdfSha256(secret.bytes, salt, info, 32);
}

function chunkNonce(base: Uint8Array, index: number): Uint8Array {
  const n = new Uint8Array(base);
  new DataView(n.buffer).setUint32(8, index, false);
  return n;
}

type ChunkFn = (key: Uint8Array, nonce: Uint8Array, data: Uint8Array, aad: Uint8Array) => Promise<Uint8Array>;
let encryptImpl: ChunkFn = (key, nonce, data, aad) => aesSeal(key, nonce, data, aad);
let decryptImpl: ChunkFn = (key, nonce, data, aad) => aesOpen(key, nonce, data, aad);

/** Tests and the chat worker replace the AES call. Null restores Web Crypto on this thread. */
export function setRecordCipher(impl: { encrypt?: ChunkFn; decrypt?: ChunkFn } | null): void {
  encryptImpl = impl?.encrypt ?? ((key, nonce, data, aad) => aesSeal(key, nonce, data, aad));
  decryptImpl = impl?.decrypt ?? ((key, nonce, data, aad) => aesOpen(key, nonce, data, aad));
}

async function encryptChunks(key: Uint8Array, baseNonce: Uint8Array, plain: Uint8Array, aadFor: (index: number, count: number) => Uint8Array): Promise<{ cipher: Uint8Array; chunks: number; digest: string }> {
  const count = Math.ceil(plain.byteLength / CHUNK_PLAINTEXT);
  const hash = new Sha256();
  const parts: Uint8Array[] = [];
  let total = 0;
  for (let i = 0; i < count; i++) {
    const start = i * CHUNK_PLAINTEXT;
    const slice = plain.subarray(start, Math.min(start + CHUNK_PLAINTEXT, plain.byteLength));
    const nonce = chunkNonce(baseNonce, i);
    const cipher = await encryptImpl(key, nonce, slice, aadFor(i, count));
    zeroize(nonce);
    hash.update(cipher);
    parts.push(cipher);
    total += cipher.byteLength;
  }
  const out = new Uint8Array(total);
  let o = 0;
  for (const p of parts) {
    out.set(p, o);
    o += p.byteLength;
  }
  return { cipher: out, chunks: count, digest: toHex(hash.digest()) };
}

async function encryptReader(
  key: Uint8Array,
  baseNonce: Uint8Array,
  reader: { size: number; read: (start: number, end: number) => Promise<Uint8Array> },
  aadFor: (index: number, count: number) => Uint8Array,
): Promise<{ cipher: Uint8Array; chunks: number; digest: string }> {
  const count = Math.ceil(reader.size / CHUNK_PLAINTEXT);
  const hash = new Sha256();
  const parts: Uint8Array[] = [];
  let total = 0;
  for (let i = 0; i < count; i++) {
    const start = i * CHUNK_PLAINTEXT;
    const slice = await reader.read(start, Math.min(start + CHUNK_PLAINTEXT, reader.size));
    const nonce = chunkNonce(baseNonce, i);
    const cipher = await encryptImpl(key, nonce, slice, aadFor(i, count));
    if (slice.byteLength === slice.buffer.byteLength) zeroize(slice);
    zeroize(nonce);
    hash.update(cipher);
    parts.push(cipher);
    total += cipher.byteLength;
  }
  const out = new Uint8Array(total);
  let o = 0;
  for (const p of parts) {
    out.set(p, o);
    o += p.byteLength;
    zeroize(p);
  }
  return { cipher: out, chunks: count, digest: toHex(hash.digest()) };
}

async function decryptChunks(key: Uint8Array, baseNonce: Uint8Array, cipher: Uint8Array, chunks: number, bytes: number, aadFor: (index: number, count: number) => Uint8Array): Promise<Uint8Array> {
  const plain = new Uint8Array(bytes);
  let inOff = 0;
  let outOff = 0;
  for (let i = 0; i < chunks; i++) {
    const plainLen = Math.min(CHUNK_PLAINTEXT, bytes - outOff);
    const cipherLen = plainLen + 16;
    if (inOff + cipherLen > cipher.byteLength) throw new RecordError('truncated', 'The ciphertext is shorter than the record says');
    const slice = cipher.subarray(inOff, inOff + cipherLen);
    const nonce = chunkNonce(baseNonce, i);
    let opened: Uint8Array;
    try {
      opened = await decryptImpl(key, nonce, slice, aadFor(i, chunks));
    } catch {
      zeroize(nonce);
      throw new RecordError('decrypt', 'The record could not be opened');
    }
    zeroize(nonce);
    if (opened.byteLength !== plainLen) throw new RecordError('bytes', 'A chunk length does not match');
    plain.set(opened, outOff);
    zeroize(opened);
    inOff += cipherLen;
    outOff += plainLen;
  }
  if (inOff !== cipher.byteLength || outOff !== bytes) throw new RecordError('truncated', 'The ciphertext length does not match');
  return plain;
}

export interface SealInput {
  kind: RecordKind;
  label: string;
  members: readonly string[];
  epoch: EpochSecret;
  plain?: Uint8Array;
  previous?: Pick<RecordPointer, 'id' | 'head' | 'generation'>;
  action?: HandoffAction;
  peer?: string;
  commitment?: string;
  url?: string;
  installation?: string;
  /** When set, plaintext is read one chunk at a time and each slice is wiped. */
  reader?: { size: number; read: (start: number, end: number) => Promise<Uint8Array> };
  /** Generation that encrypted the bytes, when a later version only rewraps the key. */
  bodyGen?: number;
}

export async function seal(input: SealInput): Promise<SealedRecord> {
  assertEpochSecret(input.epoch);
  const label = assertLabel(input.label);
  if (!KINDS.includes(input.kind)) throw new RecordError('kind', 'Unknown record kind');
  const plainBytes = input.reader ? input.reader.size : input.plain?.byteLength ?? 0;
  if (!input.reader && (!(input.plain instanceof Uint8Array) || input.plain.byteLength === 0)) throw new RecordError('plain', 'A record body is not empty');
  if (input.reader && input.reader.size <= 0) throw new RecordError('plain', 'A record body is not empty');
  if (input.kind === 'file') {
    if (plainBytes > MAX_FILE_BYTES) throw new RecordError('plain', 'A file record is at most 20 MB');
    if (input.url && !FILE_URL_RE.test(input.url)) throw new RecordError('url', 'A file record points at Ledger storage');
  } else if (plainBytes > MAX_NOTE_BYTES) {
    throw new RecordError('plain', 'An inline record is at most 8 KB');
  }

  let commitment = input.commitment ?? ZERO_HEAD;
  if (input.kind === 'handoff') {
    if (!input.action || !input.peer) throw new RecordError('handoff', 'A handoff names an action and an address');
    commitment = input.commitment ?? ZERO_HEAD;
    const expected = handoffBody({
      action: input.action,
      peer: input.peer,
      commitment,
      conversationId: input.epoch.conversationId,
      mlsEpoch: input.epoch.mlsEpoch,
    });
    if (!input.plain || expected.byteLength !== input.plain.byteLength || !bytesEqual(expected, input.plain)) {
      throw new RecordError('handoff', 'The handoff body does not match its action');
    }
  } else if (input.action || input.peer || (input.commitment && input.commitment !== ZERO_HEAD)) {
    throw new RecordError('handoff', 'Only a handoff record names an action');
  }

  const membership = await membershipEpoch(input.members);
  const generation = input.previous ? input.previous.generation + 1 : 1;
  if (!Number.isInteger(generation) || generation < 1 || generation > MAX_GENERATION) {
    throw new RecordError('generation', 'The version number is out of range');
  }
  const idBytes = input.previous ? fromHex(input.previous.id) : randomBytes(16);
  const id = toHex(idBytes);
  const prevHex = input.previous ? input.previous.head : ZERO_HEAD;
  const prev = fromHex(prevHex);
  const baseNonce = randomBytes(12);
  baseNonce[8] = 0; baseNonce[9] = 0; baseNonce[10] = 0; baseNonce[11] = 0;
  const contentKey = randomBytes(32);
  const wrapNonce = randomBytes(12);
  const installation = installationOf(input.installation);
  const bodyGen = input.bodyGen ?? generation;
  const started = typeof performance !== 'undefined' ? performance.now() : Date.now();

  const bound = {
    conversationId: input.epoch.conversationId,
    mlsEpoch: input.epoch.mlsEpoch,
    membership,
    kind: input.kind,
    label,
    id: idBytes,
    prev,
    installation,
  };
  const aadOf = (index: number, count: number) => recordAad({ ...bound, generation: bodyGen }, index, count);
  const wrapAad = recordAad({ ...bound, generation });

  const kek = await kekFor(input.epoch, membership, input.kind);
  const wrap = await aesSeal(kek, wrapNonce, contentKey, wrapAad);
  zeroize(kek);

  const sealed = input.reader
    ? await encryptReader(contentKey, baseNonce, input.reader, aadOf)
    : await encryptChunks(contentKey, baseNonce, input.plain, aadOf);
  const aad = aadHashHex(wrapAad);
  const head = await versionHeadV2(recordHeadLines({
    id, generation, conversationId: input.epoch.conversationId, mlsEpoch: input.epoch.mlsEpoch,
    membership, prev: prevHex, digest: sealed.digest, bytes: plainBytes, chunks: sealed.chunks,
    kind: input.kind, label, installation, bodyGen, bodyEpoch: '', bodyInstallation: '', bodyPrev: '', aad,
  }));

  const pointer: RecordPointer = {
    type: RECORD_TYPE,
    v: RECORD_VERSION,
    id,
    kind: input.kind,
    generation,
    conversationId: input.epoch.conversationId,
    mlsEpoch: input.epoch.mlsEpoch,
    epoch: membership,
    head,
    prev: prevHex,
    scheme: RECORD_SCHEME,
    wrap: toHex(wrap),
    wrapNonce: toHex(wrapNonce),
    nonce: toHex(baseNonce),
    digest: sealed.digest,
    bytes: plainBytes,
    chunks: sealed.chunks,
    label,
    aad,
    installation,
  };
  if (bodyGen !== generation) pointer.bodyGen = bodyGen;
  if (input.kind === 'file') pointer.url = input.url;
  else pointer.inline = toHex(sealed.cipher);
  if (input.kind === 'handoff') {
    pointer.action = input.action;
    pointer.peer = input.peer!.toLowerCase();
    pointer.commitment = commitment;
  }
  zeroize(wrapNonce);
  zeroize(baseNonce);
  const message = encodeRecordMessage(pointer);
  const encryptMs = (typeof performance !== 'undefined' ? performance.now() : Date.now()) - started;
  return {
    pointer,
    message,
    contentKey,
    ciphertext: sealed.cipher,
    timings: { encryptMs, chunks: sealed.chunks, bytes: plainBytes, chunkBytes: CHUNK_PLAINTEXT },
  };
}

function bytesEqual(a: Uint8Array, b: Uint8Array): boolean {
  if (a.byteLength !== b.byteLength) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) diff |= a[i] ^ b[i];
  return diff === 0;
}

export function encodeRecordMessage(pointer: RecordPointer): string {
  const body: Record<string, string | number> = {};
  for (const key of FIELD_ORDER) {
    const value = pointer[key];
    if (value !== undefined) body[key] = value;
  }
  const message = JSON.stringify(body);
  if (message.length > MAX_MESSAGE_CHARS) throw new RecordError('message', 'The record message is too large');
  if (message.includes('"key"')) throw new RecordError('message', 'A v2 record must not carry a raw key');
  return message;
}

export function recordPreview(pointer: { kind?: string; label?: string; action?: string; v?: number } | null): string {
  if (!pointer) return 'Record';
  if (pointer.kind === 'handoff') return pointer.action === 'agreement' ? 'Private agreement' : 'Private payment';
  if (pointer.kind === 'file') return pointer.label ? `File: ${pointer.label}` : 'Sealed file';
  if (pointer.label && pointer.label !== 'Note') return pointer.label;
  return 'Sealed note';
}

export function parseRecordMessage(content: unknown): RecordPointer | null {
  if (typeof content !== 'string' || content.length === 0 || content.length > MAX_MESSAGE_CHARS) return null;
  const text = content.trim();
  if (!text.startsWith('{"type":"ledger.record"')) return null;
  let value: unknown;
  try { value = JSON.parse(text); } catch { return null; }
  if (!value || typeof value !== 'object' || Array.isArray(value)) return null;
  const row = value as Record<string, unknown>;
  if (row.v === 1) return null;
  for (const key of Object.keys(row)) {
    if (!(FIELD_ORDER as readonly string[]).includes(key)) return null;
  }
  if (row.type !== RECORD_TYPE || row.v !== 2 || row.scheme !== RECORD_SCHEME) return null;
  if (row.key !== undefined) return null;
  if (typeof row.kind !== 'string' || !(KINDS as readonly string[]).includes(row.kind)) return null;
  if (typeof row.id !== 'string' || !HEX32.test(row.id)) return null;
  if (typeof row.conversationId !== 'string' || !CONV_RE.test(row.conversationId)) return null;
  if (typeof row.mlsEpoch !== 'string' || !EPOCH_RE.test(row.mlsEpoch)) return null;
  if (typeof row.generation !== 'number' || !Number.isInteger(row.generation) || row.generation < 1 || row.generation > MAX_GENERATION) return null;
  if (typeof row.chunks !== 'number' || !Number.isInteger(row.chunks) || row.chunks < 1 || row.chunks > 512) return null;
  for (const key of ['epoch', 'head', 'prev', 'digest', 'aad'] as const) {
    if (typeof row[key] !== 'string' || !HEX64.test(row[key])) return null;
  }
  for (const key of ['wrapNonce', 'nonce'] as const) {
    if (typeof row[key] !== 'string' || !HEX24.test(row[key])) return null;
  }
  if (typeof row.wrap !== 'string' || row.wrap.length < 64 || row.wrap.length % 2 !== 0 || !/^[0-9a-f]+$/.test(row.wrap)) return null;
  if (typeof row.bytes !== 'number' || !Number.isInteger(row.bytes) || row.bytes < 1 || row.bytes > MAX_FILE_BYTES) return null;
  if (typeof row.label !== 'string' || !LABEL_RE.test(row.label)) return null;
  if (typeof row.installation !== 'string' || !INSTALL_RE.test(row.installation)) return null;
  if (row.bodyGen !== undefined && (typeof row.bodyGen !== 'number' || !Number.isInteger(row.bodyGen) || row.bodyGen < 1 || row.bodyGen > row.generation)) return null;
  if (row.bodyEpoch !== undefined && (typeof row.bodyEpoch !== 'string' || !EPOCH_RE.test(row.bodyEpoch))) return null;
  if (row.bodyInstallation !== undefined && (typeof row.bodyInstallation !== 'string' || !INSTALL_RE.test(row.bodyInstallation))) return null;
  if (row.bodyPrev !== undefined && (typeof row.bodyPrev !== 'string' || !HEX64.test(row.bodyPrev))) return null;
  const kind = row.kind as RecordKind;
  const hasInline = typeof row.inline === 'string';
  const hasUrl = typeof row.url === 'string';
  if (hasInline === hasUrl) return null;
  if (kind === 'file' && hasUrl && !FILE_URL_RE.test(row.url as string)) return null;
  if (kind !== 'file' && !hasInline) return null;
  if (kind !== 'file' && row.bytes > MAX_NOTE_BYTES) return null;
  let action: HandoffAction | undefined;
  let peer: string | undefined;
  let commitment: string | undefined;
  if (kind === 'handoff') {
    if (typeof row.action !== 'string' || !(ACTIONS as readonly string[]).includes(row.action)) return null;
    if (typeof row.peer !== 'string' || !EVM_RE.test(row.peer)) return null;
    if (typeof row.commitment !== 'string' || !HEX64.test(row.commitment)) return null;
    action = row.action as HandoffAction;
    peer = row.peer;
    commitment = row.commitment;
  } else if (row.action !== undefined || row.peer !== undefined || row.commitment !== undefined) {
    return null;
  }
  const pointer: RecordPointer = {
    type: RECORD_TYPE,
    v: 2,
    id: row.id,
    kind,
    generation: row.generation,
    conversationId: row.conversationId,
    mlsEpoch: row.mlsEpoch,
    epoch: row.epoch as string,
    head: row.head as string,
    prev: row.prev as string,
    scheme: RECORD_SCHEME,
    wrap: row.wrap,
    wrapNonce: row.wrapNonce,
    nonce: row.nonce,
    digest: row.digest as string,
    bytes: row.bytes,
    chunks: row.chunks,
    label: row.label,
    aad: row.aad as string,
    installation: row.installation,
  };
  if (typeof row.bodyGen === 'number') pointer.bodyGen = row.bodyGen;
  if (typeof row.bodyEpoch === 'string') pointer.bodyEpoch = row.bodyEpoch;
  if (typeof row.bodyInstallation === 'string') pointer.bodyInstallation = row.bodyInstallation;
  if (typeof row.bodyPrev === 'string') pointer.bodyPrev = row.bodyPrev;
  if (hasInline) pointer.inline = row.inline as string;
  if (hasUrl) pointer.url = row.url as string;
  if (action && peer && commitment) {
    pointer.action = action;
    pointer.peer = peer;
    pointer.commitment = commitment;
  }
  return pointer;
}

export function isRecordMessage(content: unknown): boolean {
  return parseRecordMessage(content) !== null || isLegacyMessage(content);
}

function isLegacyMessage(content: unknown): boolean {
  if (typeof content !== 'string') return false;
  const t = content.trim();
  if (!t.startsWith('{"type":"ledger.record"')) return false;
  try {
    const v = (JSON.parse(t) as { v?: unknown }).v;
    return v === 1;
  } catch {
    return false;
  }
}

async function assertBinding(pointer: RecordPointer, membership: string): Promise<void> {
  if (!hexEqual(membership, pointer.epoch)) throw new RecordError('epoch', 'This record was sealed for a different set of people');
  const aad = recordAad({
    conversationId: pointer.conversationId,
    mlsEpoch: pointer.mlsEpoch,
    membership,
    generation: pointer.generation,
    kind: pointer.kind,
    label: pointer.label,
    id: fromHex(pointer.id),
    prev: fromHex(pointer.prev),
    installation: pointer.installation,
  });
  if (!hexEqual(aadHashHex(aad), pointer.aad)) throw new RecordError('aad', 'The record binding was altered');
  const head = await versionHeadV2(recordHeadLines({
    id: pointer.id, generation: pointer.generation, conversationId: pointer.conversationId, mlsEpoch: pointer.mlsEpoch,
    membership, prev: pointer.prev, digest: pointer.digest, bytes: pointer.bytes, chunks: pointer.chunks,
    kind: pointer.kind, label: pointer.label, installation: pointer.installation,
    bodyGen: pointer.bodyGen ?? pointer.generation, bodyEpoch: pointer.bodyEpoch ?? '',
    bodyInstallation: pointer.bodyInstallation ?? '', bodyPrev: pointer.bodyPrev ?? '', aad: pointer.aad,
  }));
  if (!hexEqual(head, pointer.head)) throw new RecordError('head', 'This record was altered');
}

async function unwrapKey(pointer: RecordPointer, secret: EpochSecret, membership: string): Promise<Uint8Array> {
  if (secret.conversationId !== pointer.conversationId || secret.mlsEpoch !== pointer.mlsEpoch) {
    throw new RecordError('epoch', 'This record was sealed for a different epoch');
  }
  await assertBinding(pointer, membership);
  const aad = recordAad({
    conversationId: pointer.conversationId,
    mlsEpoch: pointer.mlsEpoch,
    membership,
    generation: pointer.generation,
    kind: pointer.kind,
    label: pointer.label,
    id: fromHex(pointer.id),
    prev: fromHex(pointer.prev),
    installation: pointer.installation,
  });
  const kek = await kekFor(secret, membership, pointer.kind);
  try {
    return await aesOpen(kek, fromHex(pointer.wrapNonce), fromHex(pointer.wrap), aad);
  } catch {
    throw new RecordError('unwrap', 'The record key does not open for this epoch');
  } finally {
    zeroize(kek);
  }
}

export async function openRecord(
  raw: string | RecordPointer,
  members: readonly string[],
  secret: EpochSecret | null,
  ciphertext?: Uint8Array,
  cachedKey?: Uint8Array | null,
): Promise<OpenedRecord> {
  const pointer = typeof raw === 'string' ? parseRecordMessage(raw) : raw;
  if (!pointer) throw new RecordError('message', 'This is not a v2 record');
  const membership = await membershipEpoch(members);
  await assertBinding(pointer, membership);

  let contentKey: Uint8Array | null = null;
  if (cachedKey) {
    if (cachedKey.byteLength !== 32) throw new RecordError('key', 'The stored record key is not usable');
    contentKey = new Uint8Array(cachedKey);
  }
  if (!contentKey) {
    if (!secret) throw new RecordError('epoch', 'The epoch secret for this record is gone, and this device has no stored key');
    contentKey = await unwrapKey(pointer, secret, membership);
  }
  if (contentKey.byteLength !== 32) {
    zeroize(contentKey);
    throw new RecordError('key', 'The record key is not usable');
  }

  let cipher = ciphertext;
  if (pointer.inline) {
    if (ciphertext) {
      zeroize(contentKey);
      throw new RecordError('body', 'An inline record carries its own ciphertext');
    }
    try { cipher = fromHex(pointer.inline); } catch {
      zeroize(contentKey);
      throw new RecordError('body', 'The ciphertext is not valid');
    }
  }
  if (!cipher) {
    zeroize(contentKey);
    throw new RecordError('body', 'The ciphertext is missing');
  }
  const hash = new Sha256();
  hash.update(cipher);
  if (!hexEqual(toHex(hash.digest()), pointer.digest)) {
    zeroize(contentKey);
    throw new RecordError('digest', 'The ciphertext does not match its digest');
  }

  const id = fromHex(pointer.id);
  const prev = fromHex(pointer.prev);
  const aadOf = (index: number, count: number) => recordAad({
    conversationId: pointer.conversationId,
    mlsEpoch: pointer.bodyEpoch ?? pointer.mlsEpoch,
    membership,
    generation: pointer.bodyGen ?? pointer.generation,
    kind: pointer.kind,
    label: pointer.label,
    id,
    prev: fromHex(pointer.bodyPrev ?? pointer.prev),
    installation: pointer.bodyInstallation ?? pointer.installation,
  }, index, count);
  let plain: Uint8Array;
  try {
    plain = await decryptChunks(contentKey, fromHex(pointer.nonce), cipher, pointer.chunks, pointer.bytes, aadOf);
  } catch (error) {
    zeroize(contentKey);
    throw error;
  }

  if (pointer.kind === 'handoff') {
    const expected = handoffBody({
      action: pointer.action!,
      peer: pointer.peer!,
      commitment: pointer.commitment!,
      conversationId: pointer.conversationId,
      mlsEpoch: pointer.mlsEpoch,
    });
    if (!bytesEqual(plain, expected)) {
      zeroize(contentKey);
      zeroize(plain);
      throw new RecordError('handoff', 'The handoff body does not match its action');
    }
    return { pointer, plain, text: null, handoff: { action: pointer.action!, peer: pointer.peer!, commitment: pointer.commitment! }, contentKey };
  }
  let text: string | null = null;
  if (pointer.kind === 'note') {
    try { text = utf8Decode(plain); } catch {
      zeroize(contentKey);
      throw new RecordError('text', 'The note is not text');
    }
  }
  return { pointer, plain, text, handoff: null, contentKey };
}

export async function sealNote(args: {
  text: string;
  members: readonly string[];
  epoch: EpochSecret;
  label?: string;
  previous?: Pick<RecordPointer, 'id' | 'head' | 'generation'>;
  installation?: string;
}): Promise<SealedRecord> {
  if (typeof args.text !== 'string' || args.text.length === 0) throw new RecordError('plain', 'The note is empty');
  return seal({
    kind: 'note',
    label: args.label ?? 'Note',
    members: args.members,
    epoch: args.epoch,
    plain: utf8(args.text),
    previous: args.previous,
    installation: args.installation,
  });
}

export async function sealHandoff(args: {
  action: HandoffAction;
  peer: string;
  members: readonly string[];
  epoch: EpochSecret;
  commitment?: string;
  previous?: Pick<RecordPointer, 'id' | 'head' | 'generation'>;
}): Promise<SealedRecord> {
  const peer = args.peer.toLowerCase();
  const commitment = args.commitment ?? ZERO_HEAD;
  const plain = handoffBody({
    action: args.action,
    peer,
    commitment,
    conversationId: args.epoch.conversationId,
    mlsEpoch: args.epoch.mlsEpoch,
  });
  return seal({
    kind: 'handoff',
    label: args.action === 'pay' ? 'Private payment' : 'Private agreement',
    members: args.members,
    epoch: args.epoch,
    plain,
    action: args.action,
    peer,
    commitment,
    previous: args.previous,
  });
}

export async function sealFileBody(bytes: Uint8Array, args: {
  label: string;
  members: readonly string[];
  epoch: EpochSecret;
  url: string;
  previous?: Pick<RecordPointer, 'id' | 'head' | 'generation'>;
  installation?: string;
  reader?: { size: number; read: (start: number, end: number) => Promise<Uint8Array> };
}): Promise<SealedRecord> {
  return seal({
    kind: 'file',
    label: args.label,
    members: args.members,
    epoch: args.epoch,
    plain: args.reader ? undefined : bytes,
    reader: args.reader,
    url: args.url,
    installation: args.installation,
    previous: args.previous,
  });
}

/** Wipe secret bytes the caller still holds. Other members are not affected. */
/** Set the storage path after the ciphertext is uploaded. The path is not inside the version hash. */
export function bindFileUrl(pointer: RecordPointer, url: string): string {
  if (pointer.kind !== 'file') throw new RecordError('url', 'Only a file record has a storage path');
  if (!FILE_URL_RE.test(url)) throw new RecordError('url', 'A file record points at Ledger storage');
  return encodeRecordMessage({ ...pointer, url });
}

/**
 * Wrap the same content key for a newer epoch. The ciphertext does not change.
 * A removed member who lacks the content key and is outside the new epoch
 * cannot open the new pointer. A late joiner can open it only after a current
 * member chooses this. It is never automatic.
 */
export async function rewrapToEpoch(args: {
  pointer: RecordPointer;
  contentKey: Uint8Array;
  members: readonly string[];
  epoch: EpochSecret;
  installation?: string;
}): Promise<SealedRecord> {
  assertEpochSecret(args.epoch);
  if (args.contentKey.byteLength !== 32) throw new RecordError('key', 'The record key is not usable');
  await assertBinding(args.pointer, args.pointer.epoch);
  const membership = await membershipEpoch(args.members);
  const generation = args.pointer.generation + 1;
  if (generation > MAX_GENERATION) throw new RecordError('generation', 'The version number is out of range');
  const installation = installationOf(args.installation);
  const bodyGen = args.pointer.bodyGen ?? args.pointer.generation;
  const bodyEpoch = args.pointer.bodyEpoch ?? args.pointer.mlsEpoch;
  const bodyInstallation = args.pointer.bodyInstallation ?? args.pointer.installation;
  const bodyPrev = args.pointer.bodyPrev ?? args.pointer.prev;
  const idBytes = fromHex(args.pointer.id);
  const prev = fromHex(args.pointer.head);
  const wrapNonce = randomBytes(12);
  const started = typeof performance !== 'undefined' ? performance.now() : Date.now();
  const wrapAad = recordAad({
    conversationId: args.epoch.conversationId,
    mlsEpoch: args.epoch.mlsEpoch,
    membership,
    generation,
    kind: args.pointer.kind,
    label: args.pointer.label,
    id: idBytes,
    prev,
    installation,
  });
  const kek = await kekFor(args.epoch, membership, args.pointer.kind);
  const wrap = await aesSeal(kek, wrapNonce, args.contentKey, wrapAad);
  zeroize(kek);
  const aad = aadHashHex(wrapAad);
  const head = await versionHeadV2(recordHeadLines({
    id: args.pointer.id, generation, conversationId: args.epoch.conversationId, mlsEpoch: args.epoch.mlsEpoch,
    membership, prev: args.pointer.head, digest: args.pointer.digest, bytes: args.pointer.bytes, chunks: args.pointer.chunks,
    kind: args.pointer.kind, label: args.pointer.label, installation, bodyGen, bodyEpoch, bodyInstallation, bodyPrev, aad,
  }));
  const pointer: RecordPointer = {
    ...args.pointer,
    generation,
    conversationId: args.epoch.conversationId,
    mlsEpoch: args.epoch.mlsEpoch,
    epoch: membership,
    head,
    prev: args.pointer.head,
    wrap: toHex(wrap),
    wrapNonce: toHex(wrapNonce),
    aad,
    installation,
    bodyGen,
    bodyEpoch,
    bodyInstallation,
    bodyPrev,
  };
  zeroize(wrapNonce);
  const message = encodeRecordMessage(pointer);
  const encryptMs = (typeof performance !== 'undefined' ? performance.now() : Date.now()) - started;
  return {
    pointer,
    message,
    contentKey: args.contentKey,
    ciphertext: pointer.inline ? fromHex(pointer.inline) : new Uint8Array(),
    timings: { encryptMs, chunks: pointer.chunks, bytes: pointer.bytes, chunkBytes: CHUNK_PLAINTEXT },
  };
}

export function wipeRecordKeys(...keys: Array<Uint8Array | null | undefined>): void {
  for (const key of keys) zeroize(key);
}

export async function verifyChain(messages: readonly string[], members: readonly string[]): Promise<boolean> {
  if (messages.length === 0) return false;
  const membership = await membershipEpoch(members);
  let previous: RecordPointer | null = null;
  for (const message of messages) {
    const pointer = parseRecordMessage(message);
    if (!pointer) return false;
    if (!hexEqual(pointer.epoch, membership)) return false;
    const head = await versionHeadV2(recordHeadLines({
      id: pointer.id, generation: pointer.generation, conversationId: pointer.conversationId, mlsEpoch: pointer.mlsEpoch,
      membership, prev: pointer.prev, digest: pointer.digest, bytes: pointer.bytes, chunks: pointer.chunks,
      kind: pointer.kind, label: pointer.label, installation: pointer.installation,
      bodyGen: pointer.bodyGen ?? pointer.generation, bodyEpoch: pointer.bodyEpoch ?? '',
      bodyInstallation: pointer.bodyInstallation ?? '', bodyPrev: pointer.bodyPrev ?? '', aad: pointer.aad,
    }));
    if (!hexEqual(head, pointer.head)) return false;
    if (!previous) {
      if (pointer.generation !== 1 || pointer.prev !== ZERO_HEAD) return false;
    } else if (pointer.id !== previous.id || pointer.generation !== previous.generation + 1 || pointer.prev !== previous.head) {
      return false;
    }
    previous = pointer;
  }
  return true;
}
