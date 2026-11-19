import { describe, expect, it } from 'vitest';
import {
  MAX_NOTE_BYTES,
  ZERO_HEAD,
  buildPointer,
  encodeRecordMessage,
  isRecordMessage,
  membershipEpoch,
  openRecord,
  parseRecordMessage,
  recordPreview,
  sealFileBody,
  sealHandoff,
  sealNote,
  verifyChain,
} from '@/vendor/ledger-record/src/index';
import { sha256Hex, toHex, utf8 } from '@/vendor/ledger-record/src/hex';

const members = ['0xaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa', '0xbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb'];

describe('Ledger Record', () => {
  it('matches the known digest of abc', async () => {
    expect(await sha256Hex(utf8('abc'))).toBe('ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad');
  });

  it('opens a note only for the members it names, and the preview hides the key', async () => {
    const pointer = await sealNote({ text: 'The deed is in the drawer.', members, label: 'Note' });
    const message = encodeRecordMessage(pointer);
    expect(message.startsWith('{"type":"ledger.record"')).toBe(true);
    expect(recordPreview(pointer)).toBe('Sealed note');
    expect(recordPreview(pointer)).not.toContain(pointer.key);
    expect(isRecordMessage(message)).toBe(true);
    const opened = await openRecord(message, members);
    expect(opened.text).toBe('The deed is in the drawer.');
    expect(pointer.prev).toBe(ZERO_HEAD);
    expect(pointer.epoch).toBe(await membershipEpoch([...members].reverse()));
  });

  it('refuses a different set of people and a flipped ciphertext bit', async () => {
    const pointer = await sealNote({ text: 'secret', members });
    const message = encodeRecordMessage(pointer);
    await expect(openRecord(message, [members[0]])).rejects.toMatchObject({ code: 'epoch' });
    const cipher = pointer.inline!;
    const at = 20;
    const digit = cipher[at] === '0' ? '1' : '0';
    const tampered = { ...pointer, inline: cipher.slice(0, at) + digit + cipher.slice(at + 1) };
    await expect(openRecord(tampered, members)).rejects.toMatchObject({ code: 'digest' });
    const relabeled = { ...pointer, label: 'Other' };
    await expect(openRecord(relabeled, members)).rejects.toMatchObject({ code: 'head' });
  });

  it('rejects what is not a record, without throwing', () => {
    expect(parseRecordMessage('hello')).toBeNull();
    expect(parseRecordMessage('{"type":"ledger.record"')).toBeNull();
    expect(parseRecordMessage('{"type":"hl.attachment","v":1}')).toBeNull();
    expect(isRecordMessage(123)).toBe(false);
  });

  it('rejects an oversized note', async () => {
    await expect(sealNote({ text: 'x'.repeat(MAX_NOTE_BYTES + 1), members })).rejects.toMatchObject({ code: 'plain' });
  });

  it('links a second version to the first', async () => {
    const first = await sealNote({ text: 'v1', members });
    const second = await sealNote({
      text: 'v2',
      members,
      previous: { id: first.id, head: first.head, generation: first.generation },
    });
    expect(second.id).toBe(first.id);
    expect(second.prev).toBe(first.head);
    expect(second.key).not.toBe(first.key);
    const chain = [encodeRecordMessage(first), encodeRecordMessage(second)];
    expect(await verifyChain(chain)).toBe(true);
    expect(await verifyChain([chain[1]])).toBe(false);
    expect((await openRecord(chain[1], members)).text).toBe('v2');
  });

  it('a handoff names an action and an address, and an amount does not fit', async () => {
    const peer = '0xcccccccccccccccccccccccccccccccccccccccc';
    const pointer = await sealHandoff({ action: 'pay', peer, members });
    const opened = await openRecord(encodeRecordMessage(pointer), members);
    expect(opened.handoff).toEqual({ action: 'pay', peer });
    expect(recordPreview(pointer)).toBe('Private payment');
    expect(recordPreview(pointer)).not.toContain(pointer.key);
    const lie = { ...pointer, action: 'agreement' as const };
    await expect(openRecord(lie, members)).rejects.toThrow();

    const extra = utf8('{"action":"agreement","peer":"' + pointer.peer + '","amount":"1"}');
    const sealed = await sealFileBody(extra);
    await expect(buildPointer({
      kind: 'handoff',
      label: 'Private agreement',
      members,
      plain: extra,
      sealed,
      inline: toHex(sealed.ciphertext),
      action: 'agreement',
      peer: pointer.peer,
    })).rejects.toMatchObject({ code: 'handoff' });
  });

  it('a file binds the digest, and the pointer cannot name another host', async () => {
    const plain = utf8('file-bytes');
    const sealed = await sealFileBody(plain);
    const url = '/api/chat/attachments/' + 'ab'.repeat(16);
    const pointer = await buildPointer({ kind: 'file', label: 'deed.pdf', members, plain, sealed, url });
    const opened = await openRecord(pointer, members, sealed.ciphertext);
    expect(new TextDecoder().decode(opened.plain)).toBe('file-bytes');
    expect(recordPreview(pointer)).toBe('File: deed.pdf');
    const other = new Uint8Array(sealed.ciphertext);
    other[0] ^= 0xff;
    await expect(openRecord(pointer, members, other)).rejects.toMatchObject({ code: 'digest' });
    expect(parseRecordMessage(encodeRecordMessage({ ...pointer, url: 'https://evil.example/x' }))).toBeNull();
  });

  it('member order does not matter, and a duplicate is rejected', async () => {
    expect(await membershipEpoch(members)).toBe(await membershipEpoch([members[1], members[0]]));
    await expect(membershipEpoch([members[0], members[0]])).rejects.toMatchObject({ code: 'members' });
    await expect(membershipEpoch([])).rejects.toMatchObject({ code: 'members' });
  });
});
