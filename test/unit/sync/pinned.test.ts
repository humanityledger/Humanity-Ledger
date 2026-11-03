import { isValidOp } from '@/lib/sync/lww';
import { DeviceStateStore, type KV } from '@/lib/sync/deviceState';

const A = '0x' + 'a'.repeat(40);
const B = '0x' + 'b'.repeat(40);
const ME = '0x' + '1'.repeat(40);

class MemKV implements KV {
  private m = new Map<string, string>();
  get length() { return this.m.size; }
  key(i: number) { return [...this.m.keys()][i] ?? null; }
  getItem(k: string) { return this.m.has(k) ? this.m.get(k)! : null; }
  setItem(k: string, v: string) { this.m.set(k, String(v)); }
  removeItem(k: string) { this.m.delete(k); }
}

describe('pinned chats in the device store', () => {
  it('accepts pinned:<peer> with true or null only', () => {
    expect(isValidOp([`pinned:${A}`, true, 1, 'device1'])).toBe(true);
    expect(isValidOp([`pinned:${A}`, null, 1, 'device1'])).toBe(true);
    expect(isValidOp([`pinned:${A}`, 'yes', 1, 'device1'])).toBe(false);
    expect(isValidOp([`pinned:not-an-address`, true, 1, 'device1'])).toBe(false);
  });

  it('a pin made on one device reaches the other and survives as a list', () => {
    const pcKV = new MemKV(), phoneKV = new MemKV();
    const pc = new DeviceStateStore(ME, 'pcdevice1', pcKV);
    const phone = new DeviceStateStore(ME, 'phonedev1', phoneKV);
    phone.applyRemote(pc.set({ [`pinned:${A}`]: true, [`pinned:${B}`]: true }));
    expect(phone.peersWhere('pinned')).toEqual([A, B]);
    expect(JSON.parse(phoneKV.getItem(`ledger_pinned_${ME}`)!)).toEqual([A, B]);

    pc.applyRemote(phone.set({ [`pinned:${A}`]: null }));
    expect(pc.peersWhere('pinned')).toEqual([B]);
  });

  it('muting writes the key the notification code reads', () => {
    const kv = new MemKV();
    const s = new DeviceStateStore(ME, 'pcdevice1', kv);
    s.set({ [`muted:${A}`]: true });
    expect(kv.getItem(`ledger_muted_${A}`)).toBe('1');
    expect(s.peersWhere('muted')).toEqual([A]);
  });
});
