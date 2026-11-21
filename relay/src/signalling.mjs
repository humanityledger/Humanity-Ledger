// @ts-check
/**
 * Call signalling, compatible with the PeerJS client Ledger Chat already uses (lib/calls). With
 * NEXT_PUBLIC_PEERJS_HOST set to a relay and NEXT_PUBLIC_PEERJS_PATH to "/peerjs/", calls stop
 * depending on the public PeerJS cloud. XMTP ringing stays the primary path; this is the fallback
 * the call engine dials through.
 *
 * Protocol (PeerJS server, as the client expects it):
 *   - WebSocket at <path>peerjs?key=<key>&id=<id>&token=<token>; the server answers {type:"OPEN"};
 *   - the client sends {type, dst, payload} for OFFER, ANSWER, CANDIDATE, LEAVE and HEARTBEAT;
 *   - the server forwards it to dst with src set to the sender's id; if dst is not connected yet,
 *     the message waits (expireMs), then the sender gets {type:"EXPIRE", src: dst};
 *   - GET <path><key>/id returns a random id for clients that do not bring their own.
 *
 * What the hub sees: peer ids (Ledger Chat derives them, no wallet address), connection timing and
 * the SDP the two browsers exchange, which contains their network candidates. Media never passes
 * through it. Nothing is logged or written to disk; queues live in memory for seconds.
 */
import { randomUUID } from 'node:crypto';

const FORWARD = new Set(['OFFER', 'ANSWER', 'CANDIDATE', 'LEAVE', 'EXPIRE']);
const MAX_MESSAGE = 64 * 1024;
const MAX_QUEUE = 64;
const ID_RE = /^[A-Za-z0-9][A-Za-z0-9_-]{0,127}$/;

/** @typedef {{ send: (data: string) => void; close: (code?: number, reason?: string) => void }} Sock */

export class PeerHub {
  /**
   * @param {{ key: string; expireMs: number; aliveMs: number; maxClients: number }} opts
   * @param {() => number} [clock]
   */
  constructor(opts, clock = Date.now) {
    this.opts = opts;
    this.clock = clock;
    /** @type {Map<string, { sock: Sock; token: string; seen: number; budget: number; refill: number }>} */
    this.clients = new Map();
    /** @type {Map<string, { msg: any; at: number }[]>} */
    this.queues = new Map();
  }

  newId() {
    return randomUUID();
  }

  /**
   * A client connects. Returns false when it was refused (the socket is told why and closed).
   * @param {Sock} sock
   * @param {{ key?: string | null; id?: string | null; token?: string | null }} q
   */
  connect(sock, q) {
    const send = (/** @type {object} */ m) => { try { sock.send(JSON.stringify(m)); } catch { /* closed */ } };
    if (q.key !== this.opts.key) {
      send({ type: 'ERROR', payload: { msg: 'Invalid key provided' } });
      sock.close(1008, 'invalid key');
      return false;
    }
    if (!q.id || !q.token || !ID_RE.test(q.id) || q.token.length > 128) {
      send({ type: 'ERROR', payload: { msg: 'No id, token, or key supplied to websocket server' } });
      sock.close(1008, 'missing id');
      return false;
    }
    const existing = this.clients.get(q.id);
    if (existing && existing.token !== q.token) {
      send({ type: 'ID-TAKEN', payload: { msg: 'ID is taken' } });
      sock.close(1008, 'id taken');
      return false;
    }
    if (!existing && this.clients.size >= this.opts.maxClients) {
      send({ type: 'ERROR', payload: { msg: 'Server has reached its concurrent user limit' } });
      sock.close(1013, 'full');
      return false;
    }
    if (existing && existing.sock !== sock) {
      try { existing.sock.close(1000, 'replaced'); } catch { /* already closed */ }
    }
    this.clients.set(q.id, { sock, token: q.token, seen: this.clock(), budget: 200, refill: this.clock() });
    send({ type: 'OPEN' });
    // Deliver what waited for this peer.
    const queued = this.queues.get(q.id);
    if (queued) {
      this.queues.delete(q.id);
      for (const { msg } of queued) send(msg);
    }
    return true;
  }

  /** The socket of `id` closed. */
  disconnect(/** @type {string} */ id, /** @type {Sock} */ sock) {
    const c = this.clients.get(id);
    if (c && c.sock === sock) this.clients.delete(id);
  }

  /**
   * A message from `id`. Returns false when it was dropped.
   * @param {string} id
   * @param {string} raw
   */
  message(id, raw) {
    const c = this.clients.get(id);
    if (!c || typeof raw !== 'string' || raw.length > MAX_MESSAGE) return false;
    const now = this.clock();
    c.seen = now;
    // 50 messages a second sustained, bursts of 200: ICE candidates arrive in bursts.
    c.budget = Math.min(200, c.budget + ((now - c.refill) / 1000) * 50);
    c.refill = now;
    if (c.budget < 1) return false;
    c.budget -= 1;
    let msg;
    try {
      msg = JSON.parse(raw);
    } catch {
      return false;
    }
    if (!msg || typeof msg.type !== 'string') return false;
    if (msg.type === 'HEARTBEAT') return true;
    if (!FORWARD.has(msg.type)) return false;
    const dst = typeof msg.dst === 'string' ? msg.dst : '';
    const out = { type: msg.type, src: id, dst, payload: msg.payload };
    const target = dst ? this.clients.get(dst) : undefined;
    if (target) {
      try {
        target.sock.send(JSON.stringify(out));
        return true;
      } catch {
        this.clients.delete(dst);
      }
    }
    if (msg.type === 'LEAVE' && !dst) {
      this.clients.delete(id);
      return true;
    }
    if (msg.type === 'LEAVE' || msg.type === 'EXPIRE' || !dst) return false;
    const q = this.queues.get(dst) ?? [];
    if (q.length >= MAX_QUEUE) return false;
    q.push({ msg: out, at: now });
    this.queues.set(dst, q);
    return true;
  }

  /** Expires waiting messages and silent clients. Call every second or so. */
  tick() {
    const now = this.clock();
    for (const [dst, q] of this.queues) {
      const keep = [];
      const told = new Set();
      for (const item of q) {
        if (now - item.at < this.opts.expireMs) {
          keep.push(item);
          continue;
        }
        const src = item.msg.src;
        if (told.has(src)) continue;
        told.add(src);
        const sender = this.clients.get(src);
        if (sender) {
          try { sender.sock.send(JSON.stringify({ type: 'EXPIRE', src: dst, dst: src })); } catch { /* closed */ }
        }
      }
      if (keep.length) this.queues.set(dst, keep);
      else this.queues.delete(dst);
    }
    for (const [id, c] of this.clients) {
      if (now - c.seen > this.opts.aliveMs) {
        try { c.sock.close(1001, 'timeout'); } catch { /* closed */ }
        this.clients.delete(id);
      }
    }
  }

  stats() {
    return { peers: this.clients.size, waiting: [...this.queues.values()].reduce((n, q) => n + q.length, 0) };
  }
}
