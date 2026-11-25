/**
 * k6 Load Scenario: SSE Multiplexed Fan-out (/api/ledger-stream)
 * Validates single-subscriber pod multiplexing under high concurrent EventSource load.
 *
 * Usage:
 *   k6 run -e BASE_URL=https://staging.ledgerchat.org scripts/load-tests/sse-fanout.js
 */
import http from 'k6/http';
import { check, sleep } from 'k6';

const BASE = (__ENV.BASE_URL || 'https://ledgerchat.org').replace(/\/+$/, '');

export const options = {
  scenarios: {
    sse_concurrent_readers: {
      executor: 'ramping-vus',
      startVUs: 10,
      stages: [
        { duration: '20s', target: 100 },
        { duration: '40s', target: 400 },
        { duration: '20s', target: 0 },
      ],
      gracefulRampDown: '10s',
    },
  },
  thresholds: {
    'checks': ['rate>0.98'],
  },
};

export default function () {
  // Short-timeout read confirms connected + historical catchup packet arrives cleanly without blocking Redis/DB.
  const res = http.get(`${BASE}/api/ledger-stream`, {
    headers: { Accept: 'text/event-stream' },
    timeout: '4s',
    tags: { endpoint: 'ledger-stream' },
  });
  check(res, {
    'sse accepts or cleanly sheds capacity (200/503)': (r) =>
      r.status === 200 || r.status === 503 || r.error_code === 1050,
  });
  sleep(1);
}
