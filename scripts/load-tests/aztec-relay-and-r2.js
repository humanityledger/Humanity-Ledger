/**
 * k6 Load Scenario: Aztec RPC Relay Coalescing (/api/aztec/node) & R2 Presign (/api/chat/attachments/presign)
 * Usage:
 *   k6 run -e BASE_URL=https://staging.ledgerchat.org -e SESSION_COOKIE="siwe_session=..." scripts/load-tests/aztec-relay-and-r2.js
 */
import http from 'k6/http';
import { check, sleep } from 'k6';

const BASE = (__ENV.BASE_URL || 'https://ledgerchat.org').replace(/\/+$/, '');
const RAW_COOKIE = (__ENV.SESSION_COOKIE || '').trim();
const COOKIE = RAW_COOKIE ? (RAW_COOKIE.includes('=') ? RAW_COOKIE : `hl_session=${RAW_COOKIE}`) : '';

if (!COOKIE) {
  http.setResponseCallback(http.expectedStatuses({ min: 200, max: 399 }, 401, 503));
}

export const options = __ENV.SMOKE === '1'
  ? {
      vus: 2,
      duration: '15s',
      thresholds: {
        'http_req_duration{endpoint:aztec-node}': ['p(95)<300'],
        'http_req_duration{endpoint:presign}': ['p(95)<200'],
      },
    }
  : {
      scenarios: {
        aztec_and_presign: {
          executor: 'constant-arrival-rate',
          rate: 100,
          timeUnit: '1s',
          duration: '1m',
          preAllocatedVUs: 50,
          maxVUs: 400,
        },
      },
      thresholds: {
        'http_req_duration{endpoint:aztec-node}': ['p(95)<300'],
        'http_req_duration{endpoint:presign}': ['p(95)<200'],
      },
    };

export default function () {
  const headers = {
    ...(COOKIE ? { Cookie: COOKIE } : {}),
    Origin: BASE,
    'Sec-Fetch-Site': 'same-origin',
    'Content-Type': 'application/json',
  };

  const rpc = http.post(
    `${BASE}/api/aztec/node`,
    JSON.stringify({ jsonrpc: '2.0', id: __ITER, method: 'aztec_getNodeInfo', params: [] }),
    { headers, tags: { endpoint: 'aztec-node' } },
  );
  check(rpc, {
    'aztec relay valid or unauth/429/503': (r) => [200, 401, 429, 502, 503].includes(r.status),
  });

  const presign = http.post(
    `${BASE}/api/chat/attachments/presign`,
    JSON.stringify({ mime: 'application/octet-stream', sizeBytes: 1024 * 1024 }),
    { headers, tags: { endpoint: 'presign' } },
  );
  check(presign, {
    'presign valid or unauth/429': (r) => [200, 401, 429].includes(r.status),
  });

  sleep(0.5);
}
