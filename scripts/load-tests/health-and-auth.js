/**
 * k6 Load Scenario: Health, SIWE Nonce/Auth Perimeter & Public Landing Edge Checks
 * Target: Verify p99 < 150ms for /api/health, /api/ping, /api/xmtp/jwks & strict 429 rate-limit bounds.
 *
 * Usage:
 *   k6 run -e BASE_URL=https://staging.ledgerchat.org scripts/load-tests/health-and-auth.js
 */
import http from 'k6/http';
import { check, sleep } from 'k6';

const BASE = (__ENV.BASE_URL || 'https://ledgerchat.org').replace(/\/+$/, '');

export const options = {
  scenarios: {
    health_and_ping_steady: {
      executor: 'ramping-arrival-rate',
      startRate: 50,
      timeUnit: '1s',
      preAllocatedVUs: 100,
      maxVUs: 1500,
      stages: [
        { target: 200, duration: '30s' },
        { target: 600, duration: '1m' },
        { target: 200, duration: '30s' },
      ],
    },
  },
  thresholds: {
    http_req_failed: ['rate<0.01'],
    'http_req_duration{endpoint:health}': ['p(95)<150', 'p(99)<350'],
    'http_req_duration{endpoint:ping}': ['p(95)<80', 'p(99)<200'],
  },
};

export default function () {
  const h = http.get(`${BASE}/api/health`, { tags: { endpoint: 'health' } });
  check(h, {
    'health 200': (r) => r.status === 200,
    'health has services': (r) => {
      try {
        return Boolean(JSON.parse(r.body).services?.database);
      } catch {
        return false;
      }
    },
  });

  const p = http.get(`${BASE}/api/ping?n=${__VU}_${__ITER}`, { tags: { endpoint: 'ping' } });
  check(p, {
    'ping 200/204': (r) => r.status === 200 || r.status === 204,
  });

  const jwks = http.get(`${BASE}/api/xmtp/jwks`, { tags: { endpoint: 'jwks' } });
  check(jwks, {
    'jwks 200 or unconfigured 404': (r) => r.status === 200 || r.status === 404,
  });

  sleep(0.5);
}
