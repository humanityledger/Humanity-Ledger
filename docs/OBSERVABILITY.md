# Humanity Ledger — Observability Metrics
**Version 1.0 — 2026-10-31**  
**Authority**: Directive Section 4.3

---

## 1. Overview

This document defines the canonical set of observability metrics for the Humanity Ledger protocol. Metrics are grouped by subsystem. All metrics use standard Prometheus naming conventions.

---

## 2. ZK Proof Generation (Client-Side)

| Metric | Type | Labels | Description |
|---|---|---|---|
| `hl_proof_generation_duration_ms` | Histogram | `circuit={escrow,streams,identity}` | Time to generate UltraHonk proof in browser |
| `hl_proof_generation_errors_total` | Counter | `circuit`, `error_type` | Failed proof generation attempts |
| `hl_proof_size_bytes` | Gauge | `circuit` | Compressed proof size in bytes |
| `hl_witness_generation_duration_ms` | Histogram | `circuit` | Time to execute circuit and generate witness |

**Targets**: p50 < 5s, p95 < 8s on mid-range mobile (see `docs/PROOF_BENCHMARKS.md`)

**Collection**: Client-side metrics sent to `/api/metrics/proof` (privacy-preserving: no user identifiers)

---

## 3. Aztec Network / Sequencer

| Metric | Type | Labels | Description |
|---|---|---|---|
| `hl_aztec_tx_inclusion_duration_ms` | Histogram | `rpc_endpoint` | Time from submission to sequencer inclusion |
| `hl_aztec_tx_submitted_total` | Counter | `circuit`, `status={success,timeout,rejected}` | Total transactions submitted |
| `hl_aztec_rpc_errors_total` | Counter | `endpoint`, `error_code` | RPC errors by type |
| `hl_aztec_sequencer_timeout_total` | Counter | `endpoint` | Times the 60s timeout was triggered |
| `hl_aztec_fallback_activated_total` | Counter | `from_endpoint`, `to_endpoint` | Sequencer fallback activations |

**Targets**: p50 inclusion < 30s, p95 < 120s

---

## 4. XMTP / MLS Messaging

| Metric | Type | Labels | Description |
|---|---|---|---|
| `hl_xmtp_message_delivery_duration_ms` | Histogram | `message_type` | E2E message delivery latency |
| `hl_xmtp_message_send_errors_total` | Counter | `error_type` | Failed message send attempts |
| `hl_xmtp_epoch_advance_total` | Counter | — | MLS epoch advances triggered (PCS events) |
| `hl_xmtp_group_member_count` | Gauge | `group_id` | Current MLS group size |

**Targets**: p50 delivery < 1s, p95 < 5s

---

## 5. Application Server (Next.js / Railway)

| Metric | Type | Labels | Description |
|---|---|---|---|
| `hl_http_request_duration_ms` | Histogram | `route`, `method`, `status` | API endpoint latency |
| `hl_http_requests_total` | Counter | `route`, `method`, `status` | Total requests |
| `hl_http_errors_total` | Counter | `route`, `error_type` | Server errors |
| `hl_active_connections` | Gauge | — | Current active connections |
| `hl_rate_limit_hits_total` | Counter | `route`, `limit_type` | Rate limit activations |

**Targets**: p95 API < 500ms at 10k concurrent (Milestone 1)

---

## 6. Security Events

| Metric | Type | Labels | Description |
|---|---|---|---|
| `hl_security_events_total` | Counter | `event_type` | Security events (HONEYPOT_HIT, INVALID_SIG, etc.) |
| `hl_canary_breach_total` | Counter | — | Canary key access detected |
| `hl_csp_violations_total` | Counter | `directive`, `source` | CSP violations reported to `/api/security/csp-report` |
| `hl_eaf_rejection_total` | Counter | `reason` | EAF bridge operations rejected by guard |
| `hl_vk_mismatch_total` | Counter | `circuit` | Client-side VK hash assertion failures |

**Alert thresholds**:
- `hl_canary_breach_total` > 0 → **CRITICAL** immediate alert
- `hl_security_events_total{event_type="HONEYPOT_HIT"}` > 5/min → **HIGH** alert
- `hl_vk_mismatch_total` > 0 → **CRITICAL** immediate alert

---

## 7. EAF (Ephemeral Application Framework)

| Metric | Type | Labels | Description |
|---|---|---|---|
| `hl_eaf_message_size_bytes` | Histogram | `app_id` | postMessage payload size distribution |
| `hl_eaf_kill_switch_activations_total` | Counter | `app_id`, `reason` | Frame kill-switch activations |
| `hl_eaf_api_calls_total` | Counter | `app_id`, `method`, `status` | API calls from sandboxed apps |

---

## 8. Infrastructure

| Metric | Source | Description |
|---|---|---|
| `node_cpu_seconds_total` | Node Exporter | Server CPU usage |
| `node_memory_MemAvailable_bytes` | Node Exporter | Available memory |
| `pg_stat_activity_count` | PostgreSQL Exporter | Active DB connections |
| `redis_connected_clients` | Redis Exporter | Active Redis connections |

---

## 9. Dashboard Configuration

**Recommended**: Grafana Cloud (free tier sufficient for current scale)

```yaml
# Minimal grafana dashboard panels:
panels:
  - title: "ZK Proof Generation p95 (7-day)"
    query: "histogram_quantile(0.95, hl_proof_generation_duration_ms_bucket)"
    alert: "> 8000ms"

  - title: "Aztec Sequencer Inclusion p95"
    query: "histogram_quantile(0.95, hl_aztec_tx_inclusion_duration_ms_bucket)"
    alert: "> 120000ms"

  - title: "Security Events (24h)"
    query: "sum(increase(hl_security_events_total[24h])) by (event_type)"
    alert: "canary_breach > 0"

  - title: "API Latency p95 (10-min)"
    query: "histogram_quantile(0.95, hl_http_request_duration_ms_bucket)"
    alert: "> 500ms"
```

---

## 10. Metrics Collection Architecture

```
Client (browser)
  └── /api/metrics/proof  (privacy-preserving, no PII)
         │
Server (Next.js/Railway)
  └── Prometheus scrape endpoint: /metrics
         │
Grafana Cloud
  └── Dashboards + Alerts
         │
PagerDuty / Slack
  └── Alert routing
```

**Privacy Constraint**: No user identifiers (wallet addresses, XMTP addresses) in metrics labels. Use `circuit`, `route`, `event_type` labels only.
