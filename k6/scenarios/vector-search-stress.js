import http from 'k6/http';
import { check, sleep } from 'k6';

export const options = {
  stages: [
    { duration: '5s', target: 15 },
    { duration: '15s', target: 30 }, // 30 concurrent vector queries
    { duration: '5s', target: 0 },
  ],
  thresholds: {
    http_req_duration: ['p(95)<150'], // HNSW sub-millisecond query threshold
    http_req_failed: ['rate<0.01'],
  },
};

const BASE_URL = __ENV.BASE_URL || 'http://localhost:3000';
const QUERIES = [
  'mobil listrik keluarga',
  'motor matic 150cc',
  'toyota avanza bensin',
  'truk diesel logistik',
  'wuling air ev',
];

export default function () {
  const queryText = QUERIES[Math.floor(Math.random() * QUERIES.length)];

  const payload = JSON.stringify({
    queryText,
    limit: 5,
  });

  const res = http.post(`${BASE_URL}/api/v1/vehicles/similarity`, payload, {
    headers: { 'Content-Type': 'application/json' },
  });

  check(res, {
    'vector search returns 200': (r) => r.status === 200,
    'returned matches': (r) => {
      try {
        const body = JSON.parse(r.body);
        return body.data && body.data.length > 0;
      } catch {
        return false;
      }
    },
  });

  sleep(0.05);
}
