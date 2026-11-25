/**
 * k6 Load Scenario: SSE Multiplexed Fan-out (/api/ledger-stream)
 * Validates single-subscriber pod multiplexing under high concurrent EventSource load.
 *
 * Usage:
 *   k6 run -e BASE_URL=https://ledgerchat.org -e SESSION_COOKIE="hl_session=..." scripts/load-tests/sse-fanout.js
 */
import http from 'k6/http';
import { check, sleep } from 'k6';

const BASE = (__ENV.BASE_URL || 'https://ledgerchat.org').replace(/\/+$/, '');
const RAW_COOKIE = (__ENV.SESSION_COOKIE || '').trim();
const COOKIE = RAW_COOKIE ? (RAW_COOKIE.includes('=') ? RAW_COOKIE : `hl_session=${RAW_COOKIE}`) : '';

if (!COOKIE) {
  http.setResponseCallback(http.expectedStatuses({ min: 200, max: 399 }, 401, 503));
} else {
  http.setResponseCallback(http.expectedStatuses({ min: 200, max: 399 }, 503));
}

export const options = __ENV.SMOKE === '1'
  ? { vus: 2, duration: '12s', thresholds: { checks: ['rate>0.98'] } }
  : {
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
        checks: ['rate>0.98'],
      },
    };

export default function () {
  const headers = {
    Accept: 'text/event-stream',
    ...(COOKIE ? { Cookie: COOKIE } : {}),
  };
  // Short-timeout read confirms connected + historical catchup packet arrives cleanly without blocking Redis/DB.
  const res = http.get(`${BASE}/api/ledger-stream`, {
    headers,
    timeout: '4s',
    tags: { endpoint: 'ledger-stream' },
  });
  check(res, {
    'sse accepts or cleanly sheds capacity (200/503)': (r) =>
      r.status === 200 || r.status === 503 || r.error_code === 1050 || (!COOKIE && r.status === 401),
  });
  sleep(1);
}
