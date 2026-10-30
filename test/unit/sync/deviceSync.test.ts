import { vi } from 'vitest';
import {
  applyOps, chunkOps, decodeMessage, encodeMessage, isValidOp, nextTime, wins,
  MAX_MESSAGE_BYTES, SYNC_PREFIX, type SyncOp,
} from '@/lib/sync/lww';
import { DeviceStateStore, getOrCreateDeviceId, type KV } from '@/lib/sync/deviceState';

const A = '0x' + 'a'.repeat(40);
const B = '0x' + 'b'.repeat(40);
const ME = '0x' + '1'.repeat(40);

/** A localStorage stand-in with key()/length, like the real one. */
class MemKV implements KV {
  private m = new Map<string, string>();
  get length() { return this.m.size; }
  key(i: number) { return [...this.m.keys()][i] ?? null; }
  getItem(k: string) { return this.m.has(k) ? this.m.get(k)! : null; }
  setItem(k: string, v: string) { this.m.set(k, String(v)); }
  removeItem(k: string) { this.m.delete(k); }
}

function shuffle<T>(arr: T[], seed: number): T[] {
  const a = arr.slice();
  let s = seed;
  for (let i = a.length - 1; i > 0; i--) {
    s = (s * 9301 + 49297) % 233280;
    const j = Math.floor((s / 233280) * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

describe('lww core', () => {
  it('higher time wins; equal time is broken by device id', () => {
    expect(wins({ v: 1, t: 2, d: 'devaaa' }, { v: 2, t: 1, d: 'devzzz' })).toBe(true);
    expect(wins({ v: 1, t: 1, d: 'devaaa' }, { v: 2, t: 1, d: 'devzzz' })).toBe(false);
    expect(wins({ v: 1, t: 1, d: 'devzzz' }, { v: 2, t: 1, d: 'devaaa' })).toBe(true);
  });

  it('converges to the same state whatever the order, with duplicates', () => {
    const ops: SyncOp[] = [
      [`muted:${A}`, true, 10, 'phone1'],
      [`muted:${A}`, null, 20, 'laptop1'],
      [`muted:${A}`, true, 15, 'tablet1'],
      [`archived:${B}`, true, 5, 'phone1'],
      [`read:${A}`, 1000, 30, 'laptop1'],
      [`read:${A}`, 900, 30, 'phone1'], // same time: higher device id wins
    ];
    const reference = applyOps({}, ops).state;
    for (let seed = 1; seed < 40; seed++) {
      const shuffled = shuffle([...ops, ...ops.slice(0, 3)], seed);
      expect(applyOps({}, shuffled).state).toEqual(reference);
    }
    expect(reference[`muted:${A}`].v).toBe(null);
    expect(reference[`read:${A}`].v).toBe(900);
  });

  it('reports only keys whose value changed', () => {
    const s1 = applyOps({}, [[`muted:${A}`, true, 1, 'phone1']]);
    expect(s1.changed).toEqual([`muted:${A}`]);
    const s2 = applyOps(s1.state, [[`muted:${A}`, true, 2, 'laptop1']]);
    expect(s2.changed).toEqual([]);
  });

  it('rejects keys, values and devices outside the schema', () => {
    expect(isValidOp([`muted:${A}`, true, 1, 'phone1'])).toBe(true);
    expect(isValidOp([`muted:${A}`, 'yes', 1, 'phone1'])).toBe(false);
    expect(isValidOp([`muted:0xABC`, true, 1, 'phone1'])).toBe(false);
    expect(isValidOp(['__proto__', true, 1, 'phone1'])).toBe(false);
    expect(isValidOp(['ledger_xmtp_db_key_0x', 'k', 1, 'phone1'])).toBe(false);
    expect(isValidOp([`disappearing:${A}`, '1y', 1, 'phone1'])).toBe(false);
    expect(isValidOp([`disappearing:${A}`, '7d', 1, 'phone1'])).toBe(true);
    expect(isValidOp([`cleared:${A}`, -5, 1, 'phone1'])).toBe(false);
    expect(isValidOp([`muted:${A}`, true, 1, 'x'])).toBe(false);
    expect(isValidOp([`muted:${A}`, true, 0, 'phone1'])).toBe(false);
    expect(isValidOp(['pref:theme', 'dark', 1, 'phone1'])).toBe(true);
    expect(isValidOp(['pref:Theme', 'dark', 1, 'phone1'])).toBe(false);
  });

  it('decodes only well-formed messages and drops invalid ops inside them', () => {
    const good = encodeMessage({ k: 'ops', from: 'phone1', ops: [[`muted:${A}`, true, 1, 'phone1'], ['evil', 1, 1, 'phone1'] as any] });
    const m = decodeMessage(good)!;
    expect(m.k).toBe('ops');
    expect(m.ops).toHaveLength(1);
    expect(decodeMessage('hello')).toBeNull();
    expect(decodeMessage(SYNC_PREFIX + '{not json')).toBeNull();
    expect(decodeMessage(SYNC_PREFIX + JSON.stringify({ k: 'rm -rf', from: 'phone1', ops: [] }))).toBeNull();
    expect(decodeMessage(SYNC_PREFIX + 'x'.repeat(MAX_MESSAGE_BYTES + 1))).toBeNull();
  });

  it('chunks large states into messages under the size limit', () => {
    const ops: SyncOp[] = [];
    for (let i = 0; i < 1200; i++) {
      const peer = '0x' + i.toString(16).padStart(40, '0');
      ops.push([`archived:${peer}`, true, i + 1, 'phone1']);
    }
    const texts = chunkOps(ops, batch => ({ k: 'snap', from: 'phone1', ops: batch }));
    expect(texts.length).toBeGreaterThan(1);
    let total = 0;
    for (const t of texts) {
      expect(t.length).toBeLessThanOrEqual(MAX_MESSAGE_BYTES);
      total += decodeMessage(t)!.ops.length;
    }
    expect(total).toBe(1200);
  });

  it('the clock never goes backwards', () => {
    expect(nextTime(5000, 1000)).toBe(5001);
    expect(nextTime(1000, 5000)).toBe(5000);
  });
});

describe('DeviceStateStore', () => {
  let pcKV: MemKV, phoneKV: MemKV;
  beforeEach(() => { pcKV = new MemKV(); phoneKV = new MemKV(); });

  it('mirrors a change from the PC to the phone, including the legacy keys', () => {
    const pc = new DeviceStateStore(ME, 'pcdevice1', pcKV);
    const phone = new DeviceStateStore(ME, 'phonedev1', phoneKV);

    const ops = pc.set({ [`muted:${A}`]: true, [`archived:${B}`]: true, [`disappearing:${A}`]: '7d' });
    expect(ops).toHaveLength(3);
    phone.applyRemote(ops);

    expect(phone.get(`muted:${A}`)).toBe(true);
    expect(phoneKV.getItem(`ledger_muted_${A}`)).toBe('1');
    expect(JSON.parse(phoneKV.getItem(`ledger_archived_${ME}`)!)).toEqual([B]);
    expect(phoneKV.getItem(`ledger_disappearing_${A}`)).toBe('7d');

    const back = phone.set({ [`muted:${A}`]: null });
    pc.applyRemote(back);
    expect(pc.get(`muted:${A}`)).toBe(null);
    expect(pcKV.getItem(`ledger_muted_${A}`)).toBeNull();
  });

  it('does not emit or produce ops when nothing changes', () => {
    const pc = new DeviceStateStore(ME, 'pcdevice1', pcKV);
    let events = 0;
    pc.onChange(() => events++);
    expect(pc.set({ [`muted:${A}`]: true })).toHaveLength(1);
    expect(pc.set({ [`muted:${A}`]: true })).toHaveLength(0);
    expect(events).toBe(1);
  });

  it('tells listeners whether a change was local or remote', () => {
    const pc = new DeviceStateStore(ME, 'pcdevice1', pcKV);
    const phone = new DeviceStateStore(ME, 'phonedev1', phoneKV);
    const seen: string[] = [];
    phone.onChange((keys, source) => seen.push(`${source}:${keys.join(',')}`));
    phone.applyRemote(pc.set({ [`locked:${A}`]: true }));
    expect(seen).toEqual([`remote:locked:${A}`]);
  });

  it('imports existing per-device settings once, and real changes beat them', () => {
    pcKV.setItem(`ledger_muted_${A}`, '1');
    pcKV.setItem(`ledger_archived_${ME}`, JSON.stringify([B]));
    pcKV.setItem(`ledger_cleared_${ME}_${A}`, '1700000000000');
    pcKV.setItem('ledger_favourites', JSON.stringify([A]));
    const pc = new DeviceStateStore(ME, 'pcdevice1', pcKV);
    expect(pc.get(`muted:${A}`)).toBe(true);
    expect(pc.get(`archived:${B}`)).toBe(true);
    expect(pc.get(`cleared:${A}`)).toBe(1700000000000);
    expect(pc.get(`fav:${A}`)).toBe(true);

    const phone = new DeviceStateStore(ME, 'phonedev1', phoneKV);
    phone.applyRemote(pc.snapshot());
    pc.applyRemote(phone.set({ [`muted:${A}`]: null }));
    expect(pc.get(`muted:${A}`)).toBe(null);
  });

  it('survives a reload and re-validates what it reads from storage', () => {
    const pc = new DeviceStateStore(ME, 'pcdevice1', pcKV);
    pc.set({ [`muted:${A}`]: true });
    const raw = JSON.parse(pcKV.getItem(`hl_devsync_${ME}`)!);
    raw['evil:key'] = { v: 'x', t: 1, d: 'pcdevice1' };
    pcKV.setItem(`hl_devsync_${ME}`, JSON.stringify(raw));

    const reloaded = new DeviceStateStore(ME, 'pcdevice1', pcKV);
    expect(reloaded.get(`muted:${A}`)).toBe(true);
    expect(reloaded.get('evil:key')).toBeUndefined();
  });

  it('keeps accounts apart', () => {
    const other = '0x' + '2'.repeat(40);
    const a = new DeviceStateStore(ME, 'pcdevice1', pcKV);
    a.set({ [`archived:${A}`]: true });
    const b = new DeviceStateStore(other, 'pcdevice1', pcKV);
    expect(b.get(`archived:${A}`)).toBeUndefined();
  });

  it('keeps one stable device id per browser', () => {
    let n = 0;
    const id1 = getOrCreateDeviceId(pcKV, () => `device${++n}xx`);
    const id2 = getOrCreateDeviceId(pcKV, () => `device${++n}xx`);
    expect(id1).toBe(id2);
  });

  it('three devices editing concurrently end up identical', () => {
    const kvs = [new MemKV(), new MemKV(), new MemKV()];
    const devs = kvs.map((kv, i) => new DeviceStateStore(ME, `device${i}aa`, kv));
    const all: SyncOp[] = [];
    all.push(...devs[0].set({ [`muted:${A}`]: true, [`fav:${B}`]: true }));
    all.push(...devs[1].set({ [`muted:${A}`]: null }));
    all.push(...devs[2].set({ [`disappearing:${B}`]: '24h', [`fav:${B}`]: null }));
    devs.forEach((d, i) => d.applyRemote(shuffle(all, i + 3)));
    const snaps = devs.map(d => Object.fromEntries(d.snapshot().map(o => [o[0], o[1]])));
    expect(snaps[1]).toEqual(snaps[0]);
    expect(snaps[2]).toEqual(snaps[0]);
  });
});

describe('DeviceStateStore with a checksummed address', () => {
  it('writes account-scoped legacy keys with the address spelled as the UI spells it', () => {
    const checksummed = '0xAbCdEf' + '0'.repeat(34);
    const kv = new MemKV();
    const store = new DeviceStateStore(checksummed, 'pcdevice1', kv);
    store.set({ [`archived:${A}`]: true, [`cleared:${A}`]: 1700000000000 });
    expect(JSON.parse(kv.getItem(`ledger_archived_${checksummed}`)!)).toEqual([A]);
    expect(kv.getItem(`ledger_cleared_${checksummed}_${A}`)).toBe('1700000000000');
    // The sync state itself is keyed by the lowercase account.
    expect(kv.getItem(`hl_devsync_${checksummed.toLowerCase()}`)).not.toBeNull();
  });
});
