# Humanity Ledger — Load Test Plan
**Version 1.0 — 2026-10-31**  
**Authority**: Directive Section 4.2

---

## 1. Overview

This document defines the load testing strategy for Humanity Ledger server-side infrastructure. ZK proof generation and private state remain client-side (Aztec PXE) and are not load-tested here — only the Next.js application server, API endpoints, and supporting services are in scope.

**Primary Milestone**: 10,000 concurrent user connections with < 500ms p95 API response time.

---

## 2. Tools

| Tool | Purpose |
|---|---|
| [k6](https://k6.io/) | Primary load generator (scripted, CI-compatible) |
| Artillery | Alternative for WebSocket / XMTP connection simulation |
| Grafana | Metrics dashboard during load test |
| Railway Metrics | Server-side CPU/memory/request rate |

---

## 3. Test Scenarios

### Scenario 1: REST API Baseline (Milestone 1 — 10k concurrent)

**Target**: `/api/chat`, `/api/aztec/session`, `/api/auth`

```javascript
// scripts/load-test-k6.js
import http from 'k6/http';
import { check, sleep } from 'k6';

export const options = {
  stages: [
    { duration: '2m', target: 1000 },   // Ramp up to 1k
    { duration: '5m', target: 5000 },   // Ramp to 5k
    { duration: '5m', target: 10000 },  // Ramp to 10k
    { duration: '10m', target: 10000 }, // Sustain 10k
    { duration: '3m', target: 0 },      // Ramp down
  ],
  thresholds: {
    http_req_duration: ['p(95)<500'],   // 95% of requests < 500ms
    http_req_failed: ['rate<0.01'],     // < 1% error rate
  },
};

export default function () {
  const res = http.get('https://humanidfi.com/api/health');
  check(res, { 'status is 200': (r) => r.status === 200 });
  sleep(1);
}
```

**Run command**:
```bash
k6 run scripts/load-test-k6.js
```

### Scenario 2: WebSocket / Real-Time (XMTP message stream)

```javascript
// scripts/load-test-ws.js — Artillery
// Target: XMTP WebSocket connections (via XMTP SDK)
// Simulates 1,000 concurrent message stream listeners
```

### Scenario 3: Database Saturation

- Tool: pgbench (PostgreSQL)
- Target: 10,000 concurrent read queries on user identity table
- Goal: verify read replica handles load without primary saturation

---

## 4. Infrastructure Scaling Approach

### 4.1 Current Architecture

| Component | Provider | Current Limits |
|---|---|---|
| Next.js App Server | Railway | Auto-scaling (up to 10 replicas) |
| PostgreSQL | Railway Managed | 100 connections per node |
| Redis Cache | Railway Redis | 1,000 connections |
| XMTP Nodes | XMTP Labs network | External; not in our control |
| Aztec Node | drpc.org (testnet) | External; batch size = 3 per req |

### 4.2 Scaling Plan for 10k → 50k+ Connections

| Layer | Strategy |
|---|---|
| App Server | Railway auto-scale: `min=2, max=20` replicas; Cloudflare edge caching for static assets |
| PostgreSQL | Read replicas (PgBouncer pooling for 10k+ connections); write via primary only |
| Redis | Redis Cluster with 3 nodes; Lua scripts for atomic rate-limiting |
| XMTP | MLS group message rate limits (item 86 in FORTIFICATION_CHECKLIST); exponential backoff on SDK |
| Aztec RPC | Batch size = 3; connection pooling; fallback endpoints per `docs/SEQUENCER_RESILIENCE.md` |

### 4.3 Database Sharding Strategy

- **Phase 1** (< 100k users): Single PostgreSQL primary + 2 read replicas
- **Phase 2** (100k–1M users): Horizontal sharding by `user_id mod N`; PgBouncer per shard
- **Phase 3** (> 1M users): Distributed PostgreSQL (Citus) or migration to PlanetScale

---

## 5. Milestones

| Milestone | Target | Success Criterion |
|---|---|---|
| M1 | 10,000 concurrent connections | p95 API < 500ms, error rate < 1% |
| M2 | 50,000 concurrent connections | p95 API < 800ms, error rate < 2% |
| M3 | 100,000 concurrent connections | p95 API < 1,200ms; sharding active |

---

## 6. Load Test CI Integration

```yaml
# .github/workflows/load-test.yml (quarterly)
name: Quarterly Load Test
on:
  schedule:
    - cron: '0 2 1 */3 *'  # Every 3 months
jobs:
  k6-load-test:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: grafana/setup-k6-action@v1
      - run: k6 run scripts/load-test-k6.js --out json=results/load-test.json
      - uses: actions/upload-artifact@v4
        with:
          name: load-test-results
          path: results/load-test.json
```

---

## 7. Non-Goals

- Load testing ZK proof generation (client-side, not server-side)
- Load testing L1 contract calls (Ethereum network constraint, not app server)
- Load testing XMTP internals (third-party network)
