/**
 * k6 Load Scenario: Chat Hot Paths (Presence, Search, Profile, Stories)
 * Requires SESSION_COOKIE (siwe-session / signed cookie) for authenticated endpoints.
 *
 * Usage:
 *   k6 run -e BASE_URL=https://staging.ledgerchat.org -e SESSION_COOKIE="siwe_session=..." scripts/load-tests/chat-hot-paths.js
 */
import http from 'k6/http';
import { check, sleep } from 'k6';

const BASE = (__ENV.BASE_URL || 'https://ledgerchat.org').replace(/\/+$/, '');
const COOKIE = __ENV.SESSION_COOKIE || '';
const QUERIES = ['alice', 'bob', 'ledger', '0x0000', 'crypto'];

export const options = {
  scenarios: {
    chat_api_hot_paths: {
      executor: 'ramping-arrival-rate',
      startRate: 20,
      timeUnit: '1s',
      preAllocatedVUs: 50,
      maxVUs: 500,
      stages: [
        { target: 150, duration: '30s' },
        { target: 300, duration: '1m' },
        { target: 50, duration: '20s' },
      ],
    },
  },
  thresholds: {
    'http_req_duration{endpoint:users-search}': ['p(95)<200', 'p(99)<500'],
    'http_req_duration{endpoint:stories}': ['p(95)<250'],
  },
};

export default function () {
  const headers = COOKIE
    ? { Cookie: COOKIE, Origin: BASE, 'Content-Type': 'application/json' }
    : { Origin: BASE, 'Content-Type': 'application/json' };

  const q = QUERIES[(__VU + __ITER) % QUERIES.length];
  const search = http.get(`${BASE}/api/chat/users/search?q=${encodeURIComponent(q)}`, {
    headers,
    tags: { endpoint: 'users-search' },
  });
  check(search, {
    'search 200 or 401 when unauthenticated': (r) => r.status === 200 || r.status === 401 || r.status === 429,
  });

  const stories = http.get(`${BASE}/api/chat/stories`, {
    headers,
    tags: { endpoint: 'stories' },
  });
  check(stories, {
    'stories 200 or 401': (r) => r.status === 200 || r.status === 401,
  });

  if (COOKIE) {
    const presence = http.post(
      `${BASE}/api/chat/presence`,
      JSON.stringify({ state: 'active', visibility: 'contacts' }),
      { headers, tags: { endpoint: 'presence' } },
    );
    check(presence, {
      'presence 200 or 429': (r) => r.status === 200 || r.status === 429,
    });
  }

  sleep(1);
}
