/**
 * scripts/load-test-k6.js
 *
 * k6 Load Test Scenario for Humanity Ledger Server-Side Infrastructure.
 * Milestone 1 Target: 10,000 concurrent user connections.
 *
 * Scenarios:
 * 1. Health check & dependency readiness probe (/api/health, /api/health/aztec)
 * 2. ZK proof metrics ingestion probe (/api/security/csp-report)
 * 3. Rate-limiting and connection saturation bounds
 *
 * Authority: docs/LOAD_TEST_PLAN.md §3 & PROTOCOL_SPEC.md §4
 *
 * How to run:
 *   k6 run scripts/load-test-k6.js
 *
 * Custom target environment:
 *   k6 run -e BASE_URL=https://humanidfi.com scripts/load-test-k6.js
 */

import http from 'k6/http';
import { check, sleep } from 'k6';

const BASE_URL = __ENV.BASE_URL || 'https://humanidfi.com';

export const options = {
  stages: [
    { duration: '2m', target: 1000 },  // Ramp-up to 1,000 VUs
    { duration: '5m', target: 5000 },  // Scale to 5,000 VUs
    { duration: '5m', target: 10000 }, // Peak load: 10,000 VUs
    { duration: '10m', target: 10000 },// Sustain 10,000 VUs (Milestone 1)
    { duration: '3m', target: 0 },     // Graceful ramp-down
  ],
  thresholds: {
    // 95% of HTTP requests must complete within 500 ms (Milestone 1 SLA)
    http_req_duration: ['p(95)<500'],
    // HTTP failure rate must stay strictly below 1%
    http_req_failed: ['rate<0.01'],
  },
};

export default function () {
  const params = {
    headers: {
      'User-Agent': 'HumanityLedger-LoadTest-k6/1.0',
      'Accept': 'application/json',
    },
    timeout: '5s',
  };

  // 1. Core Health Probe
  const healthRes = http.get(`${BASE_URL}/api/health`, params);
  check(healthRes, {
    'health status is 200': (r) => r.status === 200,
  });

  // 2. Aztec RPC Readiness Probe
  const aztecRes = http.get(`${BASE_URL}/api/health/aztec`, params);
  check(aztecRes, {
    'aztec probe returns 200 or 503 (degraded)': (r) => r.status === 200 || r.status === 503,
  });

  // 3. Security CSP Violation Collector Probe (lightweight JSON payload)
  const cspPayload = JSON.stringify({
    'csp-report': {
      'document-uri': `${BASE_URL}/`,
      'violated-directive': 'connect-src',
      'blocked-uri': 'https://unauthorized-endpoint.example.com',
      'disposition': 'report',
    },
  });

  const cspRes = http.post(`${BASE_URL}/api/security/csp-report`, cspPayload, {
    headers: {
      'Content-Type': 'application/csp-report',
      'User-Agent': 'HumanityLedger-LoadTest-k6/1.0',
    },
    timeout: '5s',
  });

  check(cspRes, {
    'csp report returns 204 or 200': (r) => r.status === 204 || r.status === 200,
  });

  sleep(1);
}
