/**
 * Associated data and the version head. Length-prefixed, so two different
 * field splits cannot produce the same bytes.
 */

import { sha256Hex, utf8 } from './hex';
import { sha256Bytes } from './sha256';

export type RecordKind = 'note' | 'file' | 'handoff';

const KIND: Record<RecordKind, number> = { note: 1, file: 2, handoff: 3 };

function u16(n: number): Uint8Array {
  const b = new Uint8Array(2);
  new DataView(b.buffer).setUint16(0, n, false);
  return b;
}

function u32(n: number): Uint8Array {
  const b = new Uint8Array(4);
  new DataView(b.buffer).setUint32(0, n, false);
  return b;
}

function concat(parts: Uint8Array[]): Uint8Array {
  let n = 0;
  for (const p of parts) n += p.length;
  const out = new Uint8Array(n);
  let o = 0;
  for (const p of parts) {
    out.set(p, o);
    o += p.length;
  }
  return out;
}

export interface BindFields {
  conversationId: string;
  mlsEpoch: string;
  membership: string;
  generation: number;
  kind: RecordKind;
  label: string;
  id: Uint8Array;
  prev: Uint8Array;
  /** Sealer's XMTP installation id. Empty when the client has none. Public. Not part of the KEK. */
  installation: string;
}

/** Canonical AAD for the content cipher and the key wrap. */
export function recordAad(fields: BindFields, chunkIndex?: number, chunkCount?: number): Uint8Array {
  const conv = utf8(fields.conversationId);
  const epoch = utf8(fields.mlsEpoch);
  const members = utf8(fields.membership);
  const label = utf8(fields.label);
  const parts = [
    utf8('ledger-record/v2\0'),
    u16(conv.length), conv,
    u16(epoch.length), epoch,
    u16(members.length), members,
    u32(fields.generation),
    new Uint8Array([KIND[fields.kind]]),
    u16(label.length), label,
    fields.id,
    fields.prev,
    u16(utf8(fields.installation).length), utf8(fields.installation),
  ];
  if (chunkIndex !== undefined && chunkCount !== undefined) {
    parts.push(u32(chunkIndex), u32(chunkCount));
  }
  return concat(parts);
}

export function aadHashHex(aad: Uint8Array): string {
  let s = '';
  const d = sha256Bytes(aad);
  for (let i = 0; i < d.length; i++) s += d[i].toString(16).padStart(2, '0');
  return s;
}

export async function versionHeadV2(lines: string[]): Promise<string> {
  return sha256Hex(utf8(['ledger-record/v2/head', ...lines].join('\n')));
}
