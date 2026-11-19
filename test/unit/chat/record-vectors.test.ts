import { describe, expect, it } from 'vitest';
import { recordAad, recordHeadLines, versionHeadV2 } from '@/vendor/ledger-record/src/bind';
import { sha256Bytes } from '@/vendor/ledger-record/src/sha256';
import { hkdfSha256 } from '@/vendor/ledger-record/src/kdf';
import { toHex, utf8 } from '@/vendor/ledger-record/src/hex';
import { exporterContextFor, handoffBody, membershipEpoch } from '@/vendor/ledger-record/src/index';

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
function cat(parts: Uint8Array[]): Uint8Array {
  const out = new Uint8Array(parts.reduce((n, p) => n + p.length, 0));
  let o = 0;
  for (const p of parts) { out.set(p, o); o += p.length; }
  return out;
}

describe('known answers', () => {
  it('matches FIPS 180-4 SHA-256 on the empty string, abc, and the two-block vector', () => {
    expect(toHex(sha256Bytes(utf8('')))).toBe('e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855');
    expect(toHex(sha256Bytes(utf8('abc')))).toBe('ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad');
    expect(toHex(sha256Bytes(utf8('abcdbcdecdefdefgefghfghighijhijkijkljklmklmnlmnomnopnopq')))).toBe('248d6a61d20638b8e5c026930c3e6039a33ce45964ff2167f6ecedd419db06c1');
  });

  it('builds associated data exactly as the byte layout says, not as a second copy of the library', () => {
    const id = new Uint8Array(16).fill(0x11);
    const prev = new Uint8Array(32).fill(0x22);
    const conv = utf8('conv-1');
    const epoch = utf8('4');
    const members = utf8('aa');
    const label = utf8('Note');
    const installation = utf8('dev');
    const reference = cat([
      utf8('ledger-record/v2\0'),
      u16(conv.length), conv,
      u16(epoch.length), epoch,
      u16(members.length), members,
      u32(2),
      new Uint8Array([1]),
      u16(label.length), label,
      id,
      prev,
      u16(installation.length), installation,
      u32(0),
      u32(1),
    ]);
    const got = recordAad({
      conversationId: 'conv-1', mlsEpoch: '4', membership: 'aa', generation: 2,
      kind: 'note', label: 'Note', id, prev, installation: 'dev',
    }, 0, 1);
    expect(toHex(got)).toBe(toHex(reference));
  });

  it('pins the membership hash, the exporter context, and the handoff body', async () => {
    const members = ['0xbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb', '0xaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa'];
    expect(await membershipEpoch(members)).toBe('d5521e05a81242d5f5e0ecb6ccc728505be4d82fe981212091f67f4b93a34c11');
    expect(await membershipEpoch(members)).toBe(await membershipEpoch([members[1], members[0]]));
    expect(toHex(exporterContextFor('conv-1'))).toBe(toHex(utf8('ledger-record/v2\0conv-1')));
    const body = handoffBody({
      action: 'pay', peer: '0xCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCC',
      commitment: 'ab'.repeat(32), conversationId: 'conv-1', mlsEpoch: '4',
    });
    expect(new TextDecoder().decode(body)).toBe(
      '{"action":"pay","commitment":"' + 'ab'.repeat(32) + '","conversation":"conv-1","epoch":"4","peer":"0xcccccccccccccccccccccccccccccccccccccccc"}',
    );
  });

  it('HKDF separates the conversation from the kind, and the head lines are one list', async () => {
    const ikm = new Uint8Array(32).fill(0x0b);
    const salt = utf8('ledger-record-salt');
    const a = await hkdfSha256(ikm, salt, 'ledger-record/v2/kek\0member\0note', 32);
    const b = await hkdfSha256(ikm, salt, 'ledger-record/v2/kek\0member\0file', 32);
    expect(toHex(a)).toBe('a65e4ba9865ad02166d5d0ddad9856929fa8b6c4bbede88cfb23df0571b35873');
    expect(toHex(a)).not.toBe(toHex(b));
    const lines = recordHeadLines({
      id: 'ab', generation: 1, conversationId: 'conv-1', mlsEpoch: '4', membership: 'aa',
      prev: '0'.repeat(64), digest: 'cd', bytes: 3, chunks: 1, kind: 'note', label: 'Note',
      installation: '', bodyGen: 1, bodyEpoch: '', bodyInstallation: '', bodyPrev: '', aad: 'ee',
    });
    expect(lines).toEqual([
      'ab', '1', 'conv-1', '4', 'aa', '0'.repeat(64), 'cd', '3', '1', 'note', 'Note', '', '1', '', '', '', 'ee',
    ]);
    expect(await versionHeadV2(lines)).toBe('34f30d5cf84df05716a4c85c3319aa959b79133597ac0ba34acb6f964e5887a5');
  });
});
