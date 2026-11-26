/**
 * BoundedLRU — a Map with a hard entry cap and an optional byte budget.
 * Reads refresh recency; inserting past either limit evicts the oldest
 * entries (onEvict lets owners revoke object URLs, close handles, etc.).
 * Zero dependencies; O(1) get/set via Map insertion order.
 */
import { registerCache } from '@/lib/perf/memory-observatory';

export interface BoundedLRUOptions<K, V> {
  max: number;
  maxBytes?: number;
  /** Values larger than this are not cached at all. */
  maxItemBytes?: number;
  sizeOf?: (value: V, key: K) => number;
  onEvict?: (key: K, value: V) => void;
  /** Report in the MemoryObservatory under this name. */
  name?: string;
}

export class BoundedLRU<K, V> {
  private map = new Map<K, { v: V; b: number }>();
  private bytes = 0;
  private hits = 0;
  private misses = 0;
  constructor(private readonly o: BoundedLRUOptions<K, V>) {
    if (!(o.max > 0)) throw new Error('BoundedLRU: max must be > 0');
    if (o.name) registerCache(o.name, () => ({ name: o.name!, size: this.map.size, capacity: o.max, bytes: o.maxBytes ? this.bytes : undefined, hits: this.hits, misses: this.misses }));
  }
  get size(): number { return this.map.size; }
  get byteSize(): number { return this.bytes; }
  has(k: K): boolean { return this.map.has(k); }
  get(k: K): V | undefined {
    const e = this.map.get(k);
    if (!e) { this.misses++; return undefined; }
    this.hits++;
    this.map.delete(k); this.map.set(k, e);
    return e.v;
  }
  /** Read without touching recency or counters. */
  peek(k: K): V | undefined { return this.map.get(k)?.v; }
  set(k: K, v: V): this {
    const b = this.o.sizeOf ? Math.max(0, this.o.sizeOf(v, k)) : 0;
    const itemCap = Math.min(this.o.maxItemBytes ?? Infinity, this.o.maxBytes ?? Infinity);
    if (b > itemCap) { this.delete(k); return this; } // never cache oversize values
    const old = this.map.get(k);
    if (old) { this.bytes -= old.b; this.map.delete(k); }
    this.map.set(k, { v, b });
    this.bytes += b;
    this.trim();
    return this;
  }
  delete(k: K): boolean {
    const e = this.map.get(k);
    if (!e) return false;
    this.map.delete(k); this.bytes -= e.b;
    return true;
  }
  clear(): void {
    for (const [k, e] of this.map) this.o.onEvict?.(k, e.v);
    this.map.clear(); this.bytes = 0;
  }
  keys(): IterableIterator<K> { return this.map.keys(); }
  *entries(): IterableIterator<[K, V]> { for (const [k, e] of this.map) yield [k, e.v]; }
  private trim(): void {
    while (this.map.size > this.o.max || (this.o.maxBytes !== undefined && this.bytes > this.o.maxBytes)) {
      const first = this.map.keys().next();
      if (first.done) break;
      const e = this.map.get(first.value)!;
      this.map.delete(first.value); this.bytes -= e.b;
      this.o.onEvict?.(first.value, e.v);
    }
  }
}
