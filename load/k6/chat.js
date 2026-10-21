// k6 load test simulating 50k - 200k clients
export const options = {
  stages: [
    { duration: '2m', target: 50000 },
    { duration: '5m', target: 200000 },
    { duration: '2m', target: 0 },
  ],
  thresholds: {
    http_req_duration: ['p(95)<300'],
  },
};
export default function () {}
